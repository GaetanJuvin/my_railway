# Railway Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an open-source Railway.com clone — a cloud deployment platform with git-push deploys, database provisioning, networking, scaling, monitoring, and a CLI tool.

**Architecture:** React Router v7 (framework mode) for SSR + client UI, shadcn/ui for components, Drizzle ORM for data, Dockerode for container orchestration, Traefik for reverse proxy. All running locally via Docker.

**Tech Stack:** TypeScript, React Router v7, shadcn/ui, Tailwind CSS v4, Drizzle ORM, SQLite, Dockerode, Traefik, Vitest, BraveMCP

---

## Phase 1: Foundation

### Task 1: Project Scaffold — React Router v7 + shadcn

**Files:**

- Create: `package.json`
- Create: `react-router.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.css`
- Create: `app/root.tsx`
- Create: `app/routes.ts`
- Create: `.gitignore`

**Step 1: Initialize React Router v7 project**

```bash
cd /Users/gaetanjuvin/Project/my_railway
npx create-react-router@latest . --yes
```

**Step 2: Install shadcn/ui**

```bash
npx shadcn@latest init -d
```

**Step 3: Install core dependencies**

```bash
npm install drizzle-orm better-sqlite3 dockerode
npm install -D drizzle-kit @types/better-sqlite3 @types/dockerode
```

**Step 4: Verify dev server starts**

Run: `npm run dev`
Expected: Dev server starts on localhost

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: project scaffold with React Router v7 + shadcn/ui"
```

---

### Task 2: Database Schema + Drizzle Setup

**Files:**

- Create: `app/lib/db.server.ts`
- Create: `drizzle/schema.ts`
- Create: `drizzle.config.ts`

**Step 1: Write the database schema**

`drizzle/schema.ts`:

```typescript
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  name: text("name").notNull(),
  type: text("type").notNull(), // "web", "worker", "cron"
  repoUrl: text("repo_url"),
  branch: text("branch").default("main"),
  dockerfilePath: text("dockerfile_path").default("Dockerfile"),
  port: integer("port"),
  replicas: integer("replicas").default(1),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const deployments = sqliteTable("deployments", {
  id: text("id").primaryKey(),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id),
  status: text("status").notNull(), // "building", "deploying", "active", "failed", "rolled_back"
  commitSha: text("commit_sha"),
  commitMessage: text("commit_message"),
  imageTag: text("image_tag"),
  containerId: text("container_id"),
  buildLog: text("build_log"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
});

export const envVars = sqliteTable("env_vars", {
  id: text("id").primaryKey(),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id),
  environmentId: text("environment_id").references(() => environments.id),
  key: text("key").notNull(),
  value: text("value").notNull(),
  isSecret: integer("is_secret", { mode: "boolean" }).default(false),
});

export const environments = sqliteTable("environments", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  name: text("name").notNull(), // "production", "staging", "preview-pr-123"
  isProduction: integer("is_production", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const databases = sqliteTable("databases", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  name: text("name").notNull(),
  engine: text("engine").notNull(), // "postgres", "redis", "mysql"
  version: text("version"),
  containerId: text("container_id"),
  port: integer("port"),
  connectionString: text("connection_string"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const domains = sqliteTable("domains", {
  id: text("id").primaryKey(),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id),
  hostname: text("hostname").notNull().unique(),
  isCustom: integer("is_custom", { mode: "boolean" }).default(false),
  sslEnabled: integer("ssl_enabled", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const cronJobs = sqliteTable("cron_jobs", {
  id: text("id").primaryKey(),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id),
  schedule: text("schedule").notNull(), // cron expression
  command: text("command").notNull(),
  lastRunAt: integer("last_run_at", { mode: "timestamp" }),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
});

export const volumes = sqliteTable("volumes", {
  id: text("id").primaryKey(),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id),
  name: text("name").notNull(),
  mountPath: text("mount_path").notNull(),
  sizeGb: real("size_gb").default(1),
  dockerVolume: text("docker_volume"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const teamMembers = sqliteTable("team_members", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role").notNull(), // "admin", "member", "viewer"
});

export const alerts = sqliteTable("alerts", {
  id: text("id").primaryKey(),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id),
  name: text("name").notNull(),
  condition: text("condition").notNull(), // JSON: { metric, operator, threshold }
  channel: text("channel").notNull(), // "slack", "discord", "email"
  target: text("target").notNull(), // webhook URL or email
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const metrics = sqliteTable("metrics", {
  id: text("id").primaryKey(),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id),
  type: text("type").notNull(), // "cpu", "memory", "network", "requests"
  value: real("value").notNull(),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
});
```

**Step 2: Create db.server.ts**

`app/lib/db.server.ts`:

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../../drizzle/schema";

const sqlite = new Database("railway.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
```

**Step 3: Create drizzle.config.ts**

```typescript
import type { Config } from "drizzle-kit";

export default {
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "./railway.db",
  },
} satisfies Config;
```

**Step 4: Generate and run migration**

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

**Step 5: Commit**

```bash
git add drizzle/ app/lib/db.server.ts drizzle.config.ts
git commit -m "feat: database schema with Drizzle ORM (all core entities)"
```

---

### Task 3: Auth — Session-Based Login/Signup

**Files:**

- Create: `app/lib/auth.server.ts`
- Create: `app/routes/_auth.login.tsx`
- Create: `app/routes/_auth.signup.tsx`

**Step 1: Install auth deps**

```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

**Step 2: Implement auth server logic**

`app/lib/auth.server.ts`:

```typescript
import bcrypt from "bcryptjs";
import { createCookieSessionStorage, redirect } from "react-router";
import { db } from "./db.server";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET || "dev-secret-change-me"],
    secure: process.env.NODE_ENV === "production",
  },
});

export async function signup(email: string, password: string, name: string) {
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) throw new Error("Email already registered");

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: randomUUID(),
    email,
    name,
    passwordHash,
    createdAt: new Date(),
  };
  db.insert(users).values(user).run();
  return user;
}

export async function login(email: string, password: string) {
  const user = db.select().from(users).where(eq(users.email, email)).get();
  if (!user) throw new Error("Invalid credentials");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error("Invalid credentials");

  return user;
}

export async function createSession(userId: string, redirectTo: string) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
  });
}

export async function requireUser(request: Request) {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie"),
  );
  const userId = session.get("userId");
  if (!userId) throw redirect("/login");

  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw redirect("/login");

  return user;
}

export async function logout(request: Request) {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie"),
  );
  return redirect("/login", {
    headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
  });
}
```

**Step 3: Implement login route**

`app/routes/_auth.login.tsx`:

```tsx
import type { Route } from "./+types/_auth.login";
import { login, createSession } from "~/lib/auth.server";
import { Form, Link, useActionData } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  try {
    const user = await login(email, password);
    return createSession(user.id, "/projects");
  } catch (e: any) {
    return { error: e.message };
  }
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to my_railway</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-4">
            {actionData?.error && (
              <p className="text-sm text-red-500">{actionData.error}</p>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </Form>
          <p className="mt-4 text-center text-sm">
            No account?{" "}
            <Link to="/signup" className="underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 4: Install shadcn components**

```bash
npx shadcn@latest add button input label card
```

**Step 5: Commit**

```bash
git add app/lib/auth.server.ts app/routes/_auth.login.tsx app/routes/_auth.signup.tsx
git commit -m "feat: session-based auth with login/signup"
```

---

### Task 4: Dashboard Layout + Project List

**Files:**

- Create: `app/routes/_dashboard.tsx`
- Create: `app/routes/_dashboard.projects.tsx`
- Create: `app/routes/_dashboard.projects.new.tsx`
- Create: `app/components/sidebar.tsx`

**Step 1: Create dashboard layout with sidebar**

`app/routes/_dashboard.tsx`:

```tsx
import type { Route } from "./+types/_dashboard";
import { requireUser, logout } from "~/lib/auth.server";
import { Outlet, useLoaderData, Form } from "react-router";
import { Sidebar } from "~/components/sidebar";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user: { id: user.id, name: user.name, email: user.email } };
}

export async function action({ request }: Route.ActionArgs) {
  return logout(request);
}

export default function DashboardLayout() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div className="flex h-screen">
      <Sidebar user={user} />
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

`app/components/sidebar.tsx`:

```tsx
import { NavLink, Form } from "react-router";
import { Button } from "~/components/ui/button";

interface SidebarProps {
  user: { id: string; name: string; email: string };
}

export function Sidebar({ user }: SidebarProps) {
  return (
    <aside className="flex w-64 flex-col border-r bg-muted/40 p-4">
      <div className="mb-8">
        <h1 className="text-xl font-bold">my_railway</h1>
      </div>
      <nav className="flex-1 space-y-1">
        <NavLink
          to="/projects"
          className={({ isActive }) =>
            `block rounded-md px-3 py-2 text-sm ${isActive ? "bg-accent" : "hover:bg-accent/50"}`
          }
        >
          Projects
        </NavLink>
      </nav>
      <div className="border-t pt-4">
        <p className="mb-2 text-sm text-muted-foreground">{user.email}</p>
        <Form method="post">
          <Button variant="ghost" size="sm" type="submit">
            Sign out
          </Button>
        </Form>
      </div>
    </aside>
  );
}
```

**Step 2: Create project list page**

`app/routes/_dashboard.projects.tsx`:

```tsx
import type { Route } from "./+types/_dashboard.projects";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/lib/db.server";
import { projects, services, deployments } from "../../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { Link, useLoaderData } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const userProjects = db
    .select()
    .from(projects)
    .where(eq(projects.userId, user.id))
    .all();
  return { projects: userProjects };
}

export default function ProjectsPage() {
  const { projects } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Projects</h2>
        <Button asChild>
          <Link to="/projects/new">New Project</Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <CardTitle>
                <Link to={`/project/${project.id}`} className="hover:underline">
                  {project.name}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {project.description || "No description"}
              </p>
            </CardContent>
          </Card>
        ))}
        {projects.length === 0 && (
          <p className="text-muted-foreground">
            No projects yet. Create one to get started.
          </p>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add app/routes/_dashboard.tsx app/routes/_dashboard.projects.tsx app/components/sidebar.tsx
git commit -m "feat: dashboard layout with sidebar + project list"
```

---

### Task 5: Docker Runtime Backend

**Files:**

- Create: `app/lib/docker.server.ts`

**Step 1: Implement Docker wrapper**

`app/lib/docker.server.ts`:

```typescript
import Docker from "dockerode";
import { Readable } from "stream";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const NETWORK_NAME = "myrailway-internal";

export async function ensureNetwork() {
  const networks = await docker.listNetworks({
    filters: { name: [NETWORK_NAME] },
  });
  if (networks.length === 0) {
    await docker.createNetwork({ Name: NETWORK_NAME, Driver: "bridge" });
  }
}

export async function buildImage(
  contextPath: string,
  tag: string,
  dockerfile: string = "Dockerfile",
  onLog?: (line: string) => void,
): Promise<string> {
  const stream = await docker.buildImage(
    { context: contextPath, src: ["."] },
    { t: tag, dockerfile },
  );

  return new Promise((resolve, reject) => {
    docker.modem.followProgress(
      stream,
      (err: any, output: any) => {
        if (err) reject(err);
        else resolve(tag);
      },
      (event: any) => {
        if (event.stream && onLog) onLog(event.stream);
      },
    );
  });
}

export async function createAndStartContainer(options: {
  image: string;
  name: string;
  env: Record<string, string>;
  port?: number;
  volumes?: { host: string; container: string }[];
}): Promise<string> {
  await ensureNetwork();

  const envArray = Object.entries(options.env).map(([k, v]) => `${k}=${v}`);
  const portBindings: Record<string, any[]> = {};
  const exposedPorts: Record<string, {}> = {};

  if (options.port) {
    const containerPort = `${options.port}/tcp`;
    exposedPorts[containerPort] = {};
    portBindings[containerPort] = [{ HostPort: "0" }]; // random host port
  }

  const binds = (options.volumes || []).map((v) => `${v.host}:${v.container}`);

  const container = await docker.createContainer({
    Image: options.image,
    name: options.name,
    Env: envArray,
    ExposedPorts: exposedPorts,
    HostConfig: {
      PortBindings: portBindings,
      Binds: binds,
      NetworkMode: NETWORK_NAME,
      RestartPolicy: { Name: "unless-stopped" },
    },
  });

  await container.start();
  return container.id;
}

export async function stopContainer(containerId: string) {
  const container = docker.getContainer(containerId);
  await container.stop().catch(() => {}); // ignore if already stopped
  await container.remove().catch(() => {});
}

export async function getContainerLogs(
  containerId: string,
  tail: number = 100,
): Promise<string> {
  const container = docker.getContainer(containerId);
  const logs = await container.logs({
    stdout: true,
    stderr: true,
    tail,
    timestamps: true,
  });
  return logs.toString();
}

export async function getContainerStats(containerId: string) {
  const container = docker.getContainer(containerId);
  const stats = await container.stats({ stream: false });
  return {
    cpuPercent: calculateCpuPercent(stats),
    memoryUsageMb: (stats.memory_stats.usage || 0) / 1024 / 1024,
    memoryLimitMb: (stats.memory_stats.limit || 0) / 1024 / 1024,
    networkRxBytes: Object.values(stats.networks || {}).reduce(
      (sum: number, n: any) => sum + (n.rx_bytes || 0),
      0,
    ),
    networkTxBytes: Object.values(stats.networks || {}).reduce(
      (sum: number, n: any) => sum + (n.tx_bytes || 0),
      0,
    ),
  };
}

function calculateCpuPercent(stats: any): number {
  const cpuDelta =
    stats.cpu_stats.cpu_usage.total_usage -
    stats.precpu_stats.cpu_usage.total_usage;
  const sysDelta =
    stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuCount = stats.cpu_stats.online_cpus || 1;
  if (sysDelta > 0) {
    return (cpuDelta / sysDelta) * cpuCount * 100;
  }
  return 0;
}

export async function getContainerPort(
  containerId: string,
  containerPort: number,
): Promise<number | null> {
  const container = docker.getContainer(containerId);
  const info = await container.inspect();
  const portKey = `${containerPort}/tcp`;
  const bindings = info.NetworkSettings.Ports[portKey];
  if (bindings && bindings.length > 0) {
    return parseInt(bindings[0].HostPort, 10);
  }
  return null;
}

export async function listContainers(prefix: string) {
  const containers = await docker.listContainers({
    all: true,
    filters: { name: [prefix] },
  });
  return containers;
}

export { docker };
```

**Step 2: Commit**

```bash
git add app/lib/docker.server.ts
git commit -m "feat: Docker runtime backend via dockerode"
```

---

### Task 6: Deploy Service — Git Clone + Docker Build + Start

**Files:**

- Create: `app/lib/deployer.server.ts`

**Step 1: Implement deploy pipeline**

`app/lib/deployer.server.ts`:

```typescript
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

  // Insert deployment record
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
        {
          cwd: workDir,
          stdio: "pipe",
        },
      );

      const commitSha = execSync("git rev-parse HEAD", { cwd: workDir })
        .toString()
        .trim();
      const commitMsg = execSync("git log -1 --pretty=%B", { cwd: workDir })
        .toString()
        .trim();

      db.update(deployments)
        .set({ commitSha, commitMessage: commitMsg })
        .where(eq(deployments.id, deployId))
        .run();

      onLog(`Checked out ${commitSha.slice(0, 7)}: ${commitMsg}\n`);
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

    // 4. Stop previous container
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
      port: service.port || undefined,
    });

    db.update(deployments)
      .set({ status: "active", containerId, finishedAt: new Date() })
      .where(eq(deployments.id, deployId))
      .run();

    onLog(`Deployment ${deployId.slice(0, 8)} is live!\n`);

    return deployId;
  } catch (error: any) {
    const buildLog = error.message || "Unknown error";
    db.update(deployments)
      .set({ status: "failed", buildLog, finishedAt: new Date() })
      .where(eq(deployments.id, deployId))
      .run();

    onLog(`Deploy failed: ${buildLog}\n`);
    throw error;
  }
}

export async function rollback(serviceId: string, targetDeployId: string) {
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

  // Stop current active
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

  // Restart from target image
  const vars = db
    .select()
    .from(envVars)
    .where(eq(envVars.serviceId, serviceId))
    .all();
  const envMap: Record<string, string> = {};
  for (const v of vars) envMap[v.key] = v.value;

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
    port: service.port || undefined,
  });

  db.update(deployments)
    .set({ status: "active", containerId })
    .where(eq(deployments.id, targetDeployId))
    .run();

  return targetDeployId;
}
```

**Step 2: Commit**

```bash
git add app/lib/deployer.server.ts
git commit -m "feat: deploy service — git clone, Docker build, container start, rollback"
```

---

### Task 7: Project Detail + Service Management Routes

This task creates the core dashboard pages for viewing a project, managing services, deployments, and environment variables. These are the primary CRUD routes that users interact with.

**Files:**

- Create: `app/routes/_dashboard.project.$id.tsx`
- Create: `app/routes/_dashboard.project.$id.services.tsx`
- Create: `app/routes/_dashboard.project.$id.deployments.tsx`
- Create: `app/routes/_dashboard.project.$id.variables.tsx`

Implementation follows the same pattern: loader fetches data, action handles mutations, component renders with shadcn/ui. Each route will be created as a GitHub Issue for Symphony to implement.

**Step 1: Commit route stubs**

Create minimal route files that load data and render placeholder UI. Each will be fleshed out via GitHub Issues.

**Step 2: Commit**

```bash
git add app/routes/_dashboard.project.*
git commit -m "feat: project detail routes (services, deployments, env vars)"
```

---

### Task 8: Database Provisioning Service

**Files:**

- Create: `app/lib/databases.server.ts`
- Create: `app/routes/_dashboard.project.$id.databases.tsx`

**Step 1: Implement database provisioning**

`app/lib/databases.server.ts` — provisions Postgres/Redis/MySQL containers via Docker, generates connection strings, links to services via env vars.

**Step 2: Commit**

```bash
git add app/lib/databases.server.ts app/routes/_dashboard.project.$id.databases.tsx
git commit -m "feat: database provisioning (Postgres, Redis, MySQL via Docker)"
```

---

### Task 9: Networking — Traefik Reverse Proxy

**Files:**

- Create: `app/lib/networking.server.ts`
- Create: `docker-compose.traefik.yml`

**Step 1: Implement Traefik dynamic config management**

Generates Traefik dynamic configuration for routing. Public URLs use `{service}.local.railway` pattern. Custom domains supported via DNS verification.

**Step 2: Commit**

```bash
git add app/lib/networking.server.ts docker-compose.traefik.yml
git commit -m "feat: networking layer with Traefik reverse proxy"
```

---

### Task 10: Monitoring + Metrics Dashboard

**Files:**

- Create: `app/lib/metrics.server.ts`
- Create: `app/routes/_dashboard.project.$id.monitoring.tsx`
- Create: `app/components/metrics-chart.tsx`

**Step 1: Implement metrics collection from Docker stats**

Polls container stats periodically, stores in metrics table, renders charts in dashboard.

**Step 2: Commit**

```bash
git add app/lib/metrics.server.ts app/routes/_dashboard.project.$id.monitoring.tsx app/components/metrics-chart.tsx
git commit -m "feat: monitoring dashboard with container metrics"
```

---

### Task 11: CLI Tool

**Files:**

- Create: `cli/package.json`
- Create: `cli/src/index.ts`
- Create: `cli/src/commands/deploy.ts`
- Create: `cli/src/commands/logs.ts`
- Create: `cli/src/commands/env.ts`
- Create: `cli/src/api-client.ts`

**Step 1: Scaffold CLI with commander**

```bash
cd cli && npm init -y && npm install commander chalk ora node-fetch
```

**Step 2: Implement core commands**

`myrailway login`, `deploy`, `up`, `logs`, `env`, `link`

**Step 3: Commit**

```bash
git add cli/
git commit -m "feat: CLI tool (myrailway) with deploy, logs, env commands"
```

---

### Task 12: Scaling — Replicas + Health Checks

**Files:**

- Modify: `app/lib/docker.server.ts`
- Create: `app/lib/scaling.server.ts`
- Modify: `app/routes/_dashboard.project.$id.services.tsx`

**Step 1: Implement replica management**

Scale services to N replicas, managed via Docker. Health check endpoint configurable per service. Load balancing via Traefik.

**Step 2: Commit**

```bash
git add app/lib/scaling.server.ts
git commit -m "feat: service scaling with replicas + health checks"
```

---

### Task 13: Teams + Billing

**Files:**

- Create: `app/routes/_dashboard.teams.tsx`
- Create: `app/lib/billing.server.ts`
- Create: `app/routes/_dashboard.billing.tsx`

**Step 1: Implement team management**

Invite members, role-based access, team-scoped projects.

**Step 2: Implement usage tracking**

Track CPU/memory/storage per project, compute billing based on usage.

**Step 3: Commit**

```bash
git add app/routes/_dashboard.teams.tsx app/lib/billing.server.ts app/routes/_dashboard.billing.tsx
git commit -m "feat: teams + usage-based billing"
```

---

### Task 14: Templates + Cron Jobs + Volumes

**Files:**

- Create: `app/lib/templates.server.ts`
- Create: `app/routes/_dashboard.templates.tsx`

**Step 1: Implement template marketplace**

Pre-configured service templates (Next.js, Express, FastAPI, etc.) that create projects with Dockerfile + env vars pre-set.

**Step 2: Implement cron job scheduling**

Docker-based cron execution tied to services.

**Step 3: Implement persistent volumes**

Docker volumes mounted to containers, configurable per service.

**Step 4: Commit**

```bash
git add app/lib/templates.server.ts app/routes/_dashboard.templates.tsx
git commit -m "feat: templates, cron jobs, persistent volumes"
```

---

### Task 15: E2E Tests with BraveMCP

**Files:**

- Create: `tests/e2e/auth.test.ts`
- Create: `tests/e2e/deploy.test.ts`
- Create: `tests/e2e/projects.test.ts`

**Step 1: Write E2E test for signup → create project → deploy flow**

Uses BraveMCP to automate browser interactions against the running dev server.

**Step 2: Commit**

```bash
git add tests/e2e/
git commit -m "feat: E2E tests with BraveMCP"
```

---

### Task 16: GitHub Repo + Issues for Symphony

**Step 1: Create GitHub repo**

```bash
cd /Users/gaetanjuvin/Project/my_railway
gh repo create GaetanJuvin/my_railway --public --source=. --remote=origin --push
```

**Step 2: Create GitHub Issues for each phase**

Create labeled issues (`todo`, `priority:N`) for Symphony to pick up:

- Phase 1 issues: scaffold, schema, auth, dashboard, docker
- Phase 2 issues: deploy service, service CRUD, env vars
- Phase 3 issues: database provisioning
- Phase 4 issues: networking, custom domains, SSL
- Phase 5 issues: scaling, replicas, health checks
- Phase 6 issues: monitoring, metrics, alerts
- Phase 7 issues: teams, billing, templates, cron, volumes

Each issue should reference the relevant task in this plan and include acceptance criteria.
