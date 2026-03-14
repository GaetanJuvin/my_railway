import { randomUUID } from "crypto";
import { execSync } from "child_process";
import { mkdtempSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { db } from "./db.server";
import { deployments, services, envVars } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import * as docker from "./docker.server";

export type DeployLog = (line: string) => void;

export async function deploy(
  serviceId: string,
  onLog: DeployLog = () => {},
): Promise<string> {
  const service = db
    .select()
    .from(services)
    .where(eq(services.id, serviceId))
    .get();
  if (!service) throw new Error("Service not found");

  const deployId = randomUUID();

  db.insert(deployments)
    .values({
      id: deployId,
      serviceId,
      status: "building",
      createdAt: new Date(),
    })
    .run();

  try {
    // 1. Clone repo
    onLog("Cloning repository...\n");
    const workDir = mkdtempSync(join(tmpdir(), "myrailway-build-"));

    if (service.repoUrl) {
      execSync(
        `git clone --depth=1 --branch=${service.branch || "main"} ${service.repoUrl} .`,
        { cwd: workDir, stdio: "pipe" },
      );

      const commitSha = execSync("git rev-parse HEAD", { cwd: workDir })
        .toString()
        .trim();
      const commitMessage = execSync("git log -1 --pretty=%B", {
        cwd: workDir,
      })
        .toString()
        .trim();

      db.update(deployments)
        .set({ commitSha, commitMessage })
        .where(eq(deployments.id, deployId))
        .run();

      onLog(`Checked out ${commitSha.slice(0, 7)}: ${commitMessage}\n`);
    }

    // 2. Build Docker image
    const imageTag = `myrailway/${service.name}:${deployId.slice(0, 8)}`;
    onLog("Building Docker image...\n");

    const dockerfile = service.dockerfilePath || "Dockerfile";
    if (!existsSync(join(workDir, dockerfile))) {
      throw new Error(`Dockerfile not found at ${dockerfile}`);
    }

    await docker.buildImage(workDir, imageTag, dockerfile, onLog);

    db.update(deployments)
      .set({ status: "deploying", imageTag })
      .where(eq(deployments.id, deployId))
      .run();

    onLog("Image built successfully.\n");

    // 3. Gather env vars
    const vars = db
      .select()
      .from(envVars)
      .where(eq(envVars.serviceId, serviceId))
      .all();
    const envMap: Record<string, string> = {};
    for (const v of vars) {
      envMap[v.key] = v.value;
    }

    // 4. Stop previous active deployment
    const prevDeploy = db
      .select()
      .from(deployments)
      .where(
        and(
          eq(deployments.serviceId, serviceId),
          eq(deployments.status, "active"),
        ),
      )
      .get();

    if (prevDeploy?.containerId) {
      onLog("Stopping previous deployment...\n");
      await docker.stopContainer(prevDeploy.containerId);
      db.update(deployments)
        .set({ status: "rolled_back" })
        .where(eq(deployments.id, prevDeploy.id))
        .run();
    }

    // 5. Start new container
    onLog("Starting container...\n");
    const containerName = `myrailway-${service.name}-${deployId.slice(0, 8)}`;
    const containerId = await docker.createAndStartContainer({
      image: imageTag,
      name: containerName,
      env: envMap,
      port: service.port ?? undefined,
    });

    db.update(deployments)
      .set({ status: "active", containerId, finishedAt: new Date() })
      .where(eq(deployments.id, deployId))
      .run();

    onLog(`Deployment ${deployId.slice(0, 8)} is live!\n`);

    return deployId;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    db.update(deployments)
      .set({ status: "failed", buildLog: message, finishedAt: new Date() })
      .where(eq(deployments.id, deployId))
      .run();

    onLog(`Deploy failed: ${message}\n`);
    throw error;
  }
}

export async function rollback(
  serviceId: string,
  targetDeployId: string,
): Promise<string> {
  const target = db
    .select()
    .from(deployments)
    .where(
      and(
        eq(deployments.id, targetDeployId),
        eq(deployments.serviceId, serviceId),
      ),
    )
    .get();

  if (!target?.imageTag) throw new Error("Cannot rollback: no image tag");

  // Stop current active deployment
  const current = db
    .select()
    .from(deployments)
    .where(
      and(
        eq(deployments.serviceId, serviceId),
        eq(deployments.status, "active"),
      ),
    )
    .get();

  if (current?.containerId) {
    await docker.stopContainer(current.containerId);
    db.update(deployments)
      .set({ status: "rolled_back" })
      .where(eq(deployments.id, current.id))
      .run();
  }

  // Gather env vars
  const vars = db
    .select()
    .from(envVars)
    .where(eq(envVars.serviceId, serviceId))
    .all();
  const envMap: Record<string, string> = {};
  for (const v of vars) {
    envMap[v.key] = v.value;
  }

  // Restart from target image
  const service = db
    .select()
    .from(services)
    .where(eq(services.id, serviceId))
    .get()!;
  const containerName = `myrailway-${service.name}-rollback-${Date.now()}`;

  const containerId = await docker.createAndStartContainer({
    image: target.imageTag,
    name: containerName,
    env: envMap,
    port: service.port ?? undefined,
  });

  db.update(deployments)
    .set({ status: "active", containerId })
    .where(eq(deployments.id, targetDeployId))
    .run();

  return targetDeployId;
}
