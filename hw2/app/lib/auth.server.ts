import { createHash, randomBytes } from "node:crypto";
import { createCookie } from "react-router";
import { getDatabase } from "./db.server";
import { verifyPassword } from "./password.server";

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
const SESSION_COOKIE_NAME = "hw2_session";
const SESSION_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

const sessionCookie = createCookie(SESSION_COOKIE_NAME, {
  httpOnly: true,
  maxAge: SESSION_DURATION_SECONDS,
  path: "/",
  sameSite: "lax",
});

type UserRow = {
  id: number;
  username: string;
  role: "student" | "teacher";
};

type UserWithPasswordRow = UserRow & {
  password_hash: string;
};

export type CurrentUser = UserRow;

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isHttps(request: Request) {
  return new URL(request.url).protocol === "https:";
}

async function readSessionToken(request: Request) {
  const value = await sessionCookie.parse(request.headers.get("Cookie"));
  return typeof value === "string" && SESSION_TOKEN_PATTERN.test(value)
    ? value
    : null;
}

export async function getCurrentUser(request: Request) {
  const token = await readSessionToken(request);
  if (!token) return null;

  const db = await getDatabase();
  const tokenHash = hashSessionToken(token);
  const user = db
    .prepare(
      `SELECT users.id, users.username, users.role
       FROM sessions
       INNER JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?
         AND users.role IN ('student', 'teacher')
       LIMIT 1`,
    )
    .get(tokenHash, Date.now()) as UserRow | undefined;

  if (!user) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
    return null;
  }

  return user;
}

export async function verifyCredentials(usernameValue: unknown, passwordValue: unknown) {
  const username =
    typeof usernameValue === "string" ? usernameValue.trim().toLowerCase() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (username.length === 0 || username.length > 30 || password.length === 0 || password.length > 128) {
    return null;
  }

  const db = await getDatabase();
  const user = db
    .prepare(
      `SELECT id, username, role, password_hash
       FROM users
       WHERE username = ? COLLATE NOCASE
         AND role IN ('student', 'teacher')
       LIMIT 1`,
    )
    .get(username) as UserWithPasswordRow | undefined;

  if (!user || !(await verifyPassword(password, user.password_hash))) return null;

  return { id: user.id, username: user.username, role: user.role } satisfies CurrentUser;
}

export async function createUserSession(request: Request, userId: number) {
  const db = await getDatabase();
  const token = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + SESSION_DURATION_SECONDS * 1_000;

  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
  db.prepare(
    `INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run(hashSessionToken(token), userId, expiresAt, new Date().toISOString());

  return sessionCookie.serialize(token, { secure: isHttps(request) });
}

export async function clearUserSession(request: Request) {
  const token = await readSessionToken(request);

  if (token) {
    const db = await getDatabase();
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
      hashSessionToken(token),
    );
  }

  return sessionCookie.serialize("", {
    expires: new Date(0),
    maxAge: 0,
    secure: isHttps(request),
  });
}
