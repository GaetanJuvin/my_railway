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
