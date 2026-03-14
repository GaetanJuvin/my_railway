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

export const environments = sqliteTable("environments", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  name: text("name").notNull(), // "production", "staging", "preview-pr-123"
  isProduction: integer("is_production", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
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
