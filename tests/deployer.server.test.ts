import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Docker module
vi.mock("~/lib/docker.server", () => ({
  buildImage: vi.fn().mockResolvedValue("myrailway/test-svc:abcd1234"),
  createAndStartContainer: vi.fn().mockResolvedValue("container-new-123"),
  stopContainer: vi.fn().mockResolvedValue(undefined),
}));

// Mock child_process.execSync for git operations
vi.mock("child_process", () => ({
  execSync: vi.fn((cmd: string) => {
    if (cmd.startsWith("git clone")) return Buffer.from("");
    if (cmd === "git rev-parse HEAD") return Buffer.from("abc1234def5678\n");
    if (cmd === "git log -1 --pretty=%B")
      return Buffer.from("feat: initial commit\n");
    return Buffer.from("");
  }),
}));

// Mock fs for temp dir and Dockerfile detection
vi.mock("fs", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    mkdtempSync: vi.fn(() => "/tmp/myrailway-build-xyz"),
    existsSync: vi.fn(() => true),
  };
});

// Mock the db module with an in-memory SQLite database
vi.mock("~/lib/db.server", async () => {
  const Database = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const schema = await import("../drizzle/schema");

  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      repo_url TEXT,
      branch TEXT DEFAULT 'main',
      dockerfile_path TEXT DEFAULT 'Dockerfile',
      port INTEGER,
      replicas INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS deployments (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      status TEXT NOT NULL,
      commit_sha TEXT,
      commit_message TEXT,
      image_tag TEXT,
      container_id TEXT,
      build_log TEXT,
      created_at INTEGER NOT NULL,
      finished_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS env_vars (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      environment_id TEXT,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      is_secret INTEGER DEFAULT 0
    );
  `);

  return { db: drizzle(sqlite, { schema }) };
});

import { db } from "~/lib/db.server";
import {
  services,
  deployments,
  envVars,
  projects,
  users,
} from "../drizzle/schema";
import * as dockerMock from "~/lib/docker.server";
import { execSync } from "child_process";
import { existsSync } from "fs";

// Import the module under test
const { deploy, rollback } = await import("~/lib/deployer.server");

// Helper to seed a service
function seedService(overrides: Partial<typeof services.$inferInsert> = {}) {
  const userId = "user-1";
  const projectId = "project-1";
  const serviceId = overrides.id ?? "service-1";

  // Ensure user & project exist (ignore duplicates)
  try {
    db.insert(users)
      .values({
        id: userId,
        email: "test@test.com",
        name: "Test",
        passwordHash: "hash",
        createdAt: new Date(),
      })
      .run();
  } catch {
    /* already exists */
  }
  try {
    db.insert(projects)
      .values({
        id: projectId,
        userId,
        name: "Test Project",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
  } catch {
    /* already exists */
  }

  db.insert(services)
    .values({
      id: serviceId,
      projectId,
      name: "test-svc",
      type: "web",
      repoUrl: "https://github.com/test/repo.git",
      branch: "main",
      dockerfilePath: "Dockerfile",
      port: 3000,
      createdAt: new Date(),
      ...overrides,
    })
    .run();

  return serviceId;
}

beforeEach(() => {
  // Clear tables between tests
  db.delete(deployments).run();
  db.delete(envVars).run();
  db.delete(services).run();
  db.delete(projects).run();
  db.delete(users).run();

  // Reset mocks
  vi.clearAllMocks();
});

describe("deploy", () => {
  it("creates a deployment record with building status", async () => {
    const serviceId = seedService();
    const deployId = await deploy(serviceId);

    const dep = db.select().from(deployments).all();
    expect(dep.length).toBe(1);
    expect(dep[0]!.id).toBe(deployId);
    expect(dep[0]!.serviceId).toBe(serviceId);
    // Final status should be active (it transitions through building → deploying → active)
    expect(dep[0]!.status).toBe("active");
  });

  it("clones the repo using git clone --depth=1", async () => {
    const serviceId = seedService();
    await deploy(serviceId);

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining("git clone --depth=1"),
      expect.objectContaining({ cwd: "/tmp/myrailway-build-xyz" }),
    );
  });

  it("extracts commit SHA and message from git", async () => {
    const serviceId = seedService();
    const deployId = await deploy(serviceId);

    const dep = db.select().from(deployments).all();
    expect(dep[0]!.commitSha).toBe("abc1234def5678");
    expect(dep[0]!.commitMessage).toBe("feat: initial commit");
  });

  it("builds Docker image with correct tag", async () => {
    const serviceId = seedService();
    const deployId = await deploy(serviceId);

    expect(dockerMock.buildImage).toHaveBeenCalledWith(
      "/tmp/myrailway-build-xyz",
      expect.stringMatching(/^myrailway\/test-svc:/),
      "Dockerfile",
      expect.any(Function),
    );
  });

  it("stores the image tag on the deployment record", async () => {
    const serviceId = seedService();
    await deploy(serviceId);

    const dep = db.select().from(deployments).all();
    expect(dep[0]!.imageTag).toMatch(/^myrailway\/test-svc:/);
  });

  it("passes env vars to the container", async () => {
    const serviceId = seedService();
    db.insert(envVars)
      .values([
        {
          id: "env-1",
          serviceId,
          key: "DATABASE_URL",
          value: "postgres://localhost/db",
        },
        { id: "env-2", serviceId, key: "PORT", value: "3000" },
      ])
      .run();

    await deploy(serviceId);

    expect(dockerMock.createAndStartContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        env: { DATABASE_URL: "postgres://localhost/db", PORT: "3000" },
        port: 3000,
      }),
    );
  });

  it("stops previous active deployment before starting new one", async () => {
    const serviceId = seedService();

    // Insert a previous active deployment
    db.insert(deployments)
      .values({
        id: "prev-deploy",
        serviceId,
        status: "active",
        containerId: "old-container-id",
        createdAt: new Date(),
      })
      .run();

    await deploy(serviceId);

    expect(dockerMock.stopContainer).toHaveBeenCalledWith("old-container-id");

    // Previous deployment should be marked as rolled_back
    const prev = db.select().from(deployments).all();
    const prevDep = prev.find((d) => d.id === "prev-deploy");
    expect(prevDep!.status).toBe("rolled_back");
  });

  it("starts new container and marks deployment active", async () => {
    const serviceId = seedService();
    const deployId = await deploy(serviceId);

    expect(dockerMock.createAndStartContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        image: expect.stringMatching(/^myrailway\/test-svc:/),
        name: expect.stringContaining("myrailway-test-svc-"),
      }),
    );

    const dep = db.select().from(deployments).all();
    expect(dep[0]!.status).toBe("active");
    expect(dep[0]!.containerId).toBe("container-new-123");
    expect(dep[0]!.finishedAt).toBeTruthy();
  });

  it("records failed status when build fails", async () => {
    const serviceId = seedService();
    vi.mocked(dockerMock.buildImage).mockRejectedValueOnce(
      new Error("Build failed: syntax error"),
    );

    await expect(deploy(serviceId)).rejects.toThrow("Build failed");

    const dep = db.select().from(deployments).all();
    expect(dep[0]!.status).toBe("failed");
    expect(dep[0]!.buildLog).toContain("Build failed");
    expect(dep[0]!.finishedAt).toBeTruthy();
  });

  it("throws when service not found", async () => {
    await expect(deploy("nonexistent-service")).rejects.toThrow(
      "Service not found",
    );
  });

  it("throws when Dockerfile not found", async () => {
    const serviceId = seedService();
    vi.mocked(existsSync).mockReturnValueOnce(false);

    await expect(deploy(serviceId)).rejects.toThrow("Dockerfile not found");

    const dep = db.select().from(deployments).all();
    expect(dep[0]!.status).toBe("failed");
  });

  it("calls onLog callback with progress messages", async () => {
    const serviceId = seedService();
    const logs: string[] = [];
    await deploy(serviceId, (line) => logs.push(line));

    expect(logs.some((l) => l.includes("Cloning repository"))).toBe(true);
    expect(logs.some((l) => l.includes("Building Docker image"))).toBe(true);
    expect(logs.some((l) => l.includes("Starting container"))).toBe(true);
    expect(logs.some((l) => l.includes("is live"))).toBe(true);
  });

  it("captures build logs in deployment record on failure", async () => {
    const serviceId = seedService();
    vi.mocked(dockerMock.buildImage).mockRejectedValueOnce(
      new Error("npm ERR! missing dependency"),
    );

    await expect(deploy(serviceId)).rejects.toThrow();

    const dep = db.select().from(deployments).all();
    expect(dep[0]!.buildLog).toContain("npm ERR! missing dependency");
  });

  it("skips git clone when service has no repoUrl", async () => {
    const serviceId = seedService({ repoUrl: null });
    await deploy(serviceId);

    expect(execSync).not.toHaveBeenCalledWith(
      expect.stringContaining("git clone"),
      expect.anything(),
    );
  });
});

describe("rollback", () => {
  it("stops current active deployment", async () => {
    const serviceId = seedService();

    // Current active deployment
    db.insert(deployments)
      .values({
        id: "current-deploy",
        serviceId,
        status: "active",
        containerId: "current-container",
        imageTag: "myrailway/test-svc:current",
        createdAt: new Date(),
      })
      .run();

    // Target deployment to rollback to
    db.insert(deployments)
      .values({
        id: "target-deploy",
        serviceId,
        status: "rolled_back",
        imageTag: "myrailway/test-svc:target",
        createdAt: new Date(),
      })
      .run();

    await rollback(serviceId, "target-deploy");

    expect(dockerMock.stopContainer).toHaveBeenCalledWith("current-container");
  });

  it("marks current deployment as rolled_back", async () => {
    const serviceId = seedService();

    db.insert(deployments)
      .values({
        id: "current-deploy",
        serviceId,
        status: "active",
        containerId: "current-container",
        imageTag: "myrailway/test-svc:current",
        createdAt: new Date(),
      })
      .run();

    db.insert(deployments)
      .values({
        id: "target-deploy",
        serviceId,
        status: "rolled_back",
        imageTag: "myrailway/test-svc:target",
        createdAt: new Date(),
      })
      .run();

    await rollback(serviceId, "target-deploy");

    const current = db
      .select()
      .from(deployments)
      .all()
      .find((d) => d.id === "current-deploy");
    expect(current!.status).toBe("rolled_back");
  });

  it("restarts container from target image and marks it active", async () => {
    const serviceId = seedService();

    db.insert(deployments)
      .values({
        id: "target-deploy",
        serviceId,
        status: "rolled_back",
        imageTag: "myrailway/test-svc:target",
        createdAt: new Date(),
      })
      .run();

    await rollback(serviceId, "target-deploy");

    expect(dockerMock.createAndStartContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        image: "myrailway/test-svc:target",
        port: 3000,
      }),
    );

    const target = db
      .select()
      .from(deployments)
      .all()
      .find((d) => d.id === "target-deploy");
    expect(target!.status).toBe("active");
    expect(target!.containerId).toBe("container-new-123");
  });

  it("passes env vars to the rolled-back container", async () => {
    const serviceId = seedService();

    db.insert(envVars)
      .values({ id: "env-1", serviceId, key: "API_KEY", value: "secret123" })
      .run();

    db.insert(deployments)
      .values({
        id: "target-deploy",
        serviceId,
        status: "rolled_back",
        imageTag: "myrailway/test-svc:target",
        createdAt: new Date(),
      })
      .run();

    await rollback(serviceId, "target-deploy");

    expect(dockerMock.createAndStartContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        env: { API_KEY: "secret123" },
      }),
    );
  });

  it("throws when target deployment has no image tag", async () => {
    const serviceId = seedService();

    db.insert(deployments)
      .values({
        id: "no-image-deploy",
        serviceId,
        status: "failed",
        createdAt: new Date(),
      })
      .run();

    await expect(rollback(serviceId, "no-image-deploy")).rejects.toThrow(
      "Cannot rollback: no image tag",
    );
  });

  it("throws when target deployment not found", async () => {
    const serviceId = seedService();

    await expect(rollback(serviceId, "nonexistent")).rejects.toThrow(
      "Cannot rollback",
    );
  });

  it("works when there is no current active deployment", async () => {
    const serviceId = seedService();

    db.insert(deployments)
      .values({
        id: "target-deploy",
        serviceId,
        status: "failed",
        imageTag: "myrailway/test-svc:target",
        createdAt: new Date(),
      })
      .run();

    await rollback(serviceId, "target-deploy");

    expect(dockerMock.stopContainer).not.toHaveBeenCalled();
    expect(dockerMock.createAndStartContainer).toHaveBeenCalled();
  });
});
