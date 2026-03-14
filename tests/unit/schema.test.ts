import { describe, it, expect } from "vitest";

describe("drizzle/schema.ts — table exports", () => {
  it("exports all required tables", async () => {
    const schema = await import("../../drizzle/schema");
    const requiredTables = [
      "users",
      "projects",
      "services",
      "deployments",
      "envVars",
      "environments",
      "databases",
      "domains",
      "cronJobs",
      "volumes",
      "teams",
      "teamMembers",
      "alerts",
      "metrics",
    ];
    for (const table of requiredTables) {
      expect(schema, `expected table '${table}' to be exported`).toHaveProperty(table);
    }
  });

  it("users table has required columns", async () => {
    const { users } = await import("../../drizzle/schema");
    const cols = Object.keys(users);
    expect(cols).toContain("id");
    expect(cols).toContain("email");
    expect(cols).toContain("name");
    expect(cols).toContain("passwordHash");
    expect(cols).toContain("createdAt");
  });

  it("projects table references users via userId", async () => {
    const { projects } = await import("../../drizzle/schema");
    const cols = Object.keys(projects);
    expect(cols).toContain("userId");
  });

  it("services table references projects via projectId", async () => {
    const { services } = await import("../../drizzle/schema");
    const cols = Object.keys(services);
    expect(cols).toContain("projectId");
  });

  it("deployments table references services via serviceId", async () => {
    const { deployments } = await import("../../drizzle/schema");
    const cols = Object.keys(deployments);
    expect(cols).toContain("serviceId");
    expect(cols).toContain("status");
  });

  it("envVars table references services and environments", async () => {
    const { envVars } = await import("../../drizzle/schema");
    const cols = Object.keys(envVars);
    expect(cols).toContain("serviceId");
    expect(cols).toContain("environmentId");
    expect(cols).toContain("key");
    expect(cols).toContain("value");
  });

  it("environments table references projects via projectId", async () => {
    const { environments } = await import("../../drizzle/schema");
    const cols = Object.keys(environments);
    expect(cols).toContain("projectId");
    expect(cols).toContain("name");
  });

  it("databases table has engine column", async () => {
    const { databases } = await import("../../drizzle/schema");
    const cols = Object.keys(databases);
    expect(cols).toContain("projectId");
    expect(cols).toContain("engine");
  });

  it("domains table references services", async () => {
    const { domains } = await import("../../drizzle/schema");
    const cols = Object.keys(domains);
    expect(cols).toContain("serviceId");
    expect(cols).toContain("hostname");
  });

  it("cronJobs table references services", async () => {
    const { cronJobs } = await import("../../drizzle/schema");
    const cols = Object.keys(cronJobs);
    expect(cols).toContain("serviceId");
    expect(cols).toContain("schedule");
    expect(cols).toContain("command");
  });

  it("volumes table references services", async () => {
    const { volumes } = await import("../../drizzle/schema");
    const cols = Object.keys(volumes);
    expect(cols).toContain("serviceId");
    expect(cols).toContain("mountPath");
  });

  it("teams table references users via ownerId", async () => {
    const { teams } = await import("../../drizzle/schema");
    const cols = Object.keys(teams);
    expect(cols).toContain("ownerId");
  });

  it("teamMembers table references teams and users", async () => {
    const { teamMembers } = await import("../../drizzle/schema");
    const cols = Object.keys(teamMembers);
    expect(cols).toContain("teamId");
    expect(cols).toContain("userId");
    expect(cols).toContain("role");
  });

  it("alerts table references services", async () => {
    const { alerts } = await import("../../drizzle/schema");
    const cols = Object.keys(alerts);
    expect(cols).toContain("serviceId");
    expect(cols).toContain("condition");
    expect(cols).toContain("channel");
  });

  it("metrics table references services", async () => {
    const { metrics } = await import("../../drizzle/schema");
    const cols = Object.keys(metrics);
    expect(cols).toContain("serviceId");
    expect(cols).toContain("type");
    expect(cols).toContain("value");
    expect(cols).toContain("timestamp");
  });
});
