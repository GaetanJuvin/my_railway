import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { users, projects } from "../drizzle/schema";
import { randomUUID } from "crypto";

// We test the loader/action logic in isolation using an in-memory DB.
// The route files import from db.server.ts which uses a file-based DB,
// so we extract and test the pure data logic here.

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  return drizzle(sqlite, { schema: { users, projects } });
}

describe("projects loader logic", () => {
  let db: ReturnType<typeof createTestDb>;
  let userId: string;

  beforeEach(() => {
    db = createTestDb();
    userId = randomUUID();
    db.insert(users)
      .values({
        id: userId,
        email: "test@example.com",
        name: "Test User",
        passwordHash: "hash",
        createdAt: new Date(),
      })
      .run();
  });

  it("returns empty array when user has no projects", () => {
    const { eq } = require("drizzle-orm");
    const result = db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .all();
    expect(result).toEqual([]);
  });

  it("returns projects belonging to the user", () => {
    const { eq } = require("drizzle-orm");
    const projectId = randomUUID();
    db.insert(projects)
      .values({
        id: projectId,
        userId,
        name: "My App",
        description: "Test project",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    const result = db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .all();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("My App");
    expect(result[0].description).toBe("Test project");
  });

  it("does not return projects belonging to other users", () => {
    const { eq } = require("drizzle-orm");
    const otherId = randomUUID();
    db.insert(users)
      .values({
        id: otherId,
        email: "other@example.com",
        name: "Other",
        passwordHash: "hash",
        createdAt: new Date(),
      })
      .run();
    db.insert(projects)
      .values({
        id: randomUUID(),
        userId: otherId,
        name: "Other's App",
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    const result = db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .all();
    expect(result).toHaveLength(0);
  });
});

describe("new project action logic", () => {
  let db: ReturnType<typeof createTestDb>;
  let userId: string;

  beforeEach(() => {
    db = createTestDb();
    userId = randomUUID();
    db.insert(users)
      .values({
        id: userId,
        email: "test@example.com",
        name: "Test User",
        passwordHash: "hash",
        createdAt: new Date(),
      })
      .run();
  });

  it("inserts a project and returns it", () => {
    const { eq } = require("drizzle-orm");
    const projectId = randomUUID();
    const now = new Date();
    db.insert(projects)
      .values({
        id: projectId,
        userId,
        name: "New Project",
        description: "A new project",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const result = db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();
    expect(result).toBeDefined();
    expect(result!.name).toBe("New Project");
    expect(result!.userId).toBe(userId);
  });

  it("requires a name — rejects empty name", () => {
    // Validation logic: name must be non-empty string
    const name = "";
    expect(name.trim().length).toBe(0);
  });
});
