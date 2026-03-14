import { describe, it, expect, afterAll } from "vitest";
import { existsSync, unlinkSync } from "fs";

describe("app/lib/db.server.ts — database connection", () => {
  afterAll(() => {
    // Clean up test database
    if (existsSync("test-railway.db")) unlinkSync("test-railway.db");
    if (existsSync("test-railway.db-wal")) unlinkSync("test-railway.db-wal");
    if (existsSync("test-railway.db-shm")) unlinkSync("test-railway.db-shm");
  });

  it("exports a db instance", async () => {
    const mod = await import("../../app/lib/db.server");
    expect(mod).toHaveProperty("db");
    expect(mod.db).toBeDefined();
  });

  it("db instance has drizzle query interface", async () => {
    const { db } = await import("../../app/lib/db.server");
    // Drizzle instances expose .select, .insert, .update, .delete
    expect(typeof db.select).toBe("function");
    expect(typeof db.insert).toBe("function");
    expect(typeof db.update).toBe("function");
    expect(typeof db.delete).toBe("function");
  });
});
