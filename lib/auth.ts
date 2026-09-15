import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DATA_DIR } from "./db";

export interface User { id: string; name: string; email: string; hash: string; salt: string; createdAt: string }

const USERS = path.join(DATA_DIR, "users.json");
const SECRET = path.join(DATA_DIR, ".secret");
const COOKIE = "veronica.session";

// ponytail: local accounts in a JSON file, scrypt hashes, HMAC-signed cookie; swap for Auth.js if this ever needs OAuth
function secret(): string {
  mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(SECRET)) writeFileSync(SECRET, randomBytes(32).toString("hex"), { mode: 0o600 });
  return readFileSync(SECRET, "utf8").trim();
}
export function listUsers(): User[] {
  try { return JSON.parse(readFileSync(USERS, "utf8")) as User[]; } catch { return []; }
}
function saveUsers(users: User[]) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(USERS, JSON.stringify(users, null, 2));
}
const hash = (password: string, salt: string) => scryptSync(password, salt, 32).toString("hex");
const norm = (email: string) => email.trim().toLowerCase();

export function createUser(name: string, email: string, password: string): User {
  name = name.trim(); email = norm(email);
  if (!name) throw new Error("Enter your name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email.");
  if (password.length < 8) throw new Error("Use at least 8 characters for the password.");
  const users = listUsers();
  if (users.some((u) => u.email === email)) throw new Error("There is already an account with that email. Sign in instead.");
  const salt = randomBytes(16).toString("hex");
  const user: User = { id: randomBytes(8).toString("hex"), name, email, hash: hash(password, salt), salt, createdAt: new Date().toISOString() };
  saveUsers([...users, user]);
  return user;
}

export function verifyUser(email: string, password: string): User | undefined {
  const u = listUsers().find((x) => x.email === norm(email));
  if (!u) return undefined;
  const a = Buffer.from(hash(password, u.salt), "hex"), b = Buffer.from(u.hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b) ? u : undefined;
}

const sign = (id: string) => `${id}.${createHmac("sha256", secret()).update(id).digest("hex")}`;
function verifyToken(token: string | undefined): string | undefined {
  if (!token) return undefined;
  const [id, mac] = token.split(".");
  if (!id || !mac) return undefined;
  const a = Buffer.from(mac), b = Buffer.from(sign(id).split(".")[1]);
  return a.length === b.length && timingSafeEqual(a, b) ? id : undefined;
}

export async function currentUser(): Promise<User | undefined> {
  const id = verifyToken((await cookies()).get(COOKIE)?.value);
  return id ? listUsers().find((u) => u.id === id) : undefined;
}
/** The signed-in user, or a redirect to /login. */
export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}
export async function setSession(id: string) {
  (await cookies()).set(COOKIE, sign(id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 });
}
export async function clearSession() {
  (await cookies()).delete(COOKIE);
}
