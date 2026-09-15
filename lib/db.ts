import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Application, DB } from "./types";
import { SOURCES } from "./types";

export const DATA_DIR = process.env.VERONICA_DATA_DIR ?? path.join(process.cwd(), "data");
/** Test seam: one file for everything, whatever the user id. */
const SINGLE = process.env.VERONICA_DATA;
const LEGACY = path.join(DATA_DIR, "veronica.json");

const file = (userId: string) => SINGLE ?? path.join(DATA_DIR, "users", `${userId}.json`);
export const docsDir = (userId: string) => path.join(DATA_DIR, "documents", userId);

// ponytail: one JSON file per user, single process; swap to better-sqlite3 if it ever chokes
export function read(userId: string): DB {
  return JSON.parse(readFileSync(file(userId), "utf8")) as DB;
}

export function write(userId: string, mutate: (db: DB) => void) {
  const db = read(userId);
  mutate(db);
  mkdirSync(path.dirname(file(userId)), { recursive: true });
  writeFileSync(file(userId), JSON.stringify(db, null, 2));
}

/** Every user that has data; the runner walks these. */
export function listDbUsers(): string[] {
  if (SINGLE) return ["test"];
  try { return readdirSync(path.join(DATA_DIR, "users")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)); } catch { return []; }
}

export function emptyDb(name: string, email: string): DB {
  return {
    profile: {
      name, email, phone: "", linkedin: "", website: "", workRights: "", availability: "", notes: "",
      targets: [], keywords: [], locations: [], remote: true, salaryFloor: { amount: 0, currency: "AUD" }, sectors: [],
      languages: [{ name: "English", level: "Fluent" }], dealBreakers: [],
      sources: SOURCES.map((s) => ({ id: s.id, enabled: true })), watchList: [], schedule: "daily",
    },
    jobs: [], applications: [], drafts: [],
    agent: { log: [], paused: false, nextRunAt: "9999-12-31T00:00:00.000Z" },
    research: {},
  };
}

/** Create the user's store if it does not exist yet. */
export function ensureDb(userId: string, name: string, email: string) {
  if (existsSync(file(userId))) return;
  mkdirSync(path.dirname(file(userId)), { recursive: true });
  writeFileSync(file(userId), JSON.stringify(emptyDb(name, email), null, 2));
}

/** Move the single-user data file to the given user. */
export function adoptLegacy(userId: string) {
  if (!existsSync(LEGACY) || existsSync(file(userId))) return;
  mkdirSync(path.dirname(file(userId)), { recursive: true });
  renameSync(LEGACY, file(userId));
}

export const now = () => new Date().toISOString();
export const today = () => now().slice(0, 10);

export function agentLog(db: DB, text: string) {
  db.agent.log.push({ at: now(), text });
  if (db.agent.log.length > 300) db.agent.log.splice(0, db.agent.log.length - 300);
}

export function timeline(a: Application, actor: "agent" | "you", event: string) {
  a.timeline.push({ at: now(), actor, event });
}
