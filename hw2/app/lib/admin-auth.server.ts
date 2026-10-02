import { createCookie, redirect } from "react-router";
import { verifyPassword } from "./password.server";
import { ADMIN_BASE_PATH, ADMIN_LOGIN_PATH } from "./admin-paths";

const COOKIE_NAME = "hw2_admin";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;

type AdminSession = {
  username: string;
  expiresAt: number;
};

function getAdminConfig() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;

  if (!username || username.length > 30 || !passwordHash || !sessionSecret || sessionSecret.length < 32) {
    return null;
  }

  return { username, passwordHash, sessionSecret };
}

function adminCookie(secret?: string) {
  return createCookie(COOKIE_NAME, {
    httpOnly: true,
    maxAge: SESSION_DURATION_SECONDS,
    path: ADMIN_BASE_PATH,
    sameSite: "lax",
    ...(secret ? { secrets: [secret] } : {}),
  });
}

function isHttps(request: Request) {
  return new URL(request.url).protocol === "https:";
}

export function requireAdminConfig() {
  const config = getAdminConfig();
  if (!config) throw new Response("Admin authentication is not configured", { status: 503 });
  return config;
}

export async function verifyAdminCredentials(username: unknown, password: unknown) {
  const config = requireAdminConfig();
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    username.length === 0 ||
    username.length > 30 ||
    password.length === 0 ||
    password.length > 128
  ) {
    return false;
  }

  const passwordMatches = await verifyPassword(password, config.passwordHash);
  return passwordMatches && username.trim() === config.username;
}

export async function getAdminIdentity(request: Request) {
  const config = getAdminConfig();
  if (!config) return null;

  let session: AdminSession | null;
  try {
    session = await adminCookie(config.sessionSecret).parse(request.headers.get("Cookie"));
  } catch {
    return null;
  }

  if (
    !session ||
    typeof session.username !== "string" ||
    !Number.isFinite(session.expiresAt) ||
    session.username !== config.username ||
    session.expiresAt <= Date.now()
  ) {
    return null;
  }

  return { username: config.username, role: "admin" as const };
}

export async function requireAdmin(request: Request) {
  requireAdminConfig();
  const admin = await getAdminIdentity(request);
  if (!admin) throw redirect(ADMIN_LOGIN_PATH);
  return admin;
}

export async function createAdminSession(request: Request) {
  const config = requireAdminConfig();
  return adminCookie(config.sessionSecret).serialize(
    {
      username: config.username,
      expiresAt: Date.now() + SESSION_DURATION_SECONDS * 1_000,
    } satisfies AdminSession,
    { secure: isHttps(request) },
  );
}

export async function clearAdminSession(request: Request) {
  const secret = getAdminConfig()?.sessionSecret;
  return adminCookie(secret).serialize("", {
    expires: new Date(0),
    maxAge: 0,
    secure: isHttps(request),
  });
}
