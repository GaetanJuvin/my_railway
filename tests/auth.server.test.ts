import { describe, it, expect, vi, beforeEach } from "vitest";

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
    )
  `);

  return { db: drizzle(sqlite, { schema }) };
});

// Set required env vars before importing auth
process.env.SESSION_SECRET = "test-secret-for-tests-only";

const { signup, login, requireUser, logout, createSession } = await import(
  "~/lib/auth.server"
);

describe("signup", () => {
  beforeEach(async () => {
    // Clear users table between tests
    const { db } = await import("~/lib/db.server");
    const { users } = await import("../drizzle/schema");
    db.delete(users).run();
  });

  it("creates a user with a hashed password", async () => {
    const user = await signup("alice@example.com", "password123", "Alice");

    expect(user.email).toBe("alice@example.com");
    expect(user.name).toBe("Alice");
    expect(user.id).toBeTruthy();
    expect(user.passwordHash).not.toBe("password123");
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
  });

  it("throws when email is already registered", async () => {
    await signup("bob@example.com", "pass1", "Bob");

    await expect(signup("bob@example.com", "pass2", "Bob2")).rejects.toThrow(
      "Email already registered",
    );
  });
});

describe("login", () => {
  beforeEach(async () => {
    const { db } = await import("~/lib/db.server");
    const { users } = await import("../drizzle/schema");
    db.delete(users).run();
    await signup("carol@example.com", "correctpass", "Carol");
  });

  it("returns user when credentials are valid", async () => {
    const user = await login("carol@example.com", "correctpass");
    expect(user.email).toBe("carol@example.com");
  });

  it("throws with wrong password", async () => {
    await expect(login("carol@example.com", "wrongpass")).rejects.toThrow(
      "Invalid credentials",
    );
  });

  it("throws when email does not exist", async () => {
    await expect(login("nobody@example.com", "pass")).rejects.toThrow(
      "Invalid credentials",
    );
  });
});

describe("requireUser", () => {
  it("throws a redirect to /login when no session cookie is present", async () => {
    const request = new Request("http://localhost/dashboard");

    const result = requireUser(request);

    await expect(result).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof Response && e.status === 302 && e.headers.get("Location") === "/login",
    );
  });
});

describe("logout", () => {
  it("redirects to /login and destroys the session", async () => {
    const request = new Request("http://localhost/dashboard");
    const response = await logout(request);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login");
    // Session cookie should be expired/cleared
    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toBeTruthy();
  });
});
