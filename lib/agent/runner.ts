import { agentLog, listDbUsers, now, read, timeline, write } from "../db";
import { band, excludedReason, jobKey, normUrl, searchQueries, type Application, type DB, type Job } from "../types";
import { assistedApply } from "./apply";
import { draftDocuments, redraft } from "./draft";
import { fetchPage } from "./fetch";
import { notReady } from "./llm";
import { buildPrep, mockReply } from "./prep";
import { companyKey } from "./profile";
import { evaluate, triage } from "./score";
import * as sources from "./sources";
import type { Candidate } from "./sources";

declare global { var __vxRunner: { work: boolean; search: boolean; timer?: ReturnType<typeof setInterval> } | undefined }
const state = () => (globalThis.__vxRunner ??= { work: false, search: false });

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ").slice(0, 300);
const getApp = (db: DB, id: string) => { const a = db.applications.find((x) => x.id === id); if (!a) throw new Error(`No application ${id}`); return a; };
const getJob = (db: DB, a: Application) => { const j = db.jobs.find((x) => x.id === a.jobId); if (!j) throw new Error(`No job ${a.jobId}`); return j; };
const setNow = (uid: string, task: string, target: string) => write(uid, (db) => { db.agent.now = { task, target, startedAt: now() }; });
const log = (uid: string, text: string) => write(uid, (db) => agentLog(db, text));

type Task = { kind: "evaluate" | "draft" | "apply" | "prep" | "mock"; id: string };

/** The work lane is state-driven: whatever the data says is waiting on the agent, in priority order. Restart-safe. */
export function nextWork(db: DB): Task | undefined {
  const apps = db.applications.filter((a) => !a.error);
  const pick = (kind: Task["kind"], f: (a: Application) => boolean) => { const a = apps.find(f); return a ? { kind, id: a.id } : undefined; };
  return (
    pick("apply", (a) => a.status === "applying" && a.submission?.step === "filling") ??
    pick("draft", (a) => a.status === "shortlisted" || (a.status === "drafting" && db.drafts.some((d) => d.applicationId === a.id && d.status === "drafting"))) ??
    pick("mock", (a) => a.prep?.mock.at(-1)?.role === "you") ??
    pick("prep", (a) => a.status === "interview" && !a.prep) ??
    pick("evaluate", (a) => a.status === "found" && !a.fit)
  );
}

export function searchDue(db: DB): boolean {
  return Boolean(db.agent.searchRequested) || (!db.agent.paused && db.agent.nextRunAt <= now());
}

/** Nudge both lanes; returns immediately. Call after any state change the agent should react to. */
export function kick() {
  setImmediate(() => { void workLoop(); void searchLoop(); });
}

export function startScheduler() {
  const s = state();
  if (s.timer) return;
  // Nothing can be in flight at boot; a leftover marker means the last run was cut off.
  for (const uid of listDbUsers()) write(uid, (db) => {
    if (db.agent.now) { agentLog(db, `${db.agent.now.task} was interrupted by a restart`); db.agent.now = undefined; }
    if (db.agent.search) { agentLog(db, "Search was interrupted by a restart"); db.agent.search = undefined; }
  });
  s.timer = setInterval(kick, 60_000);
  kick();
}

async function workLoop() {
  const s = state();
  if (s.work) return;
  s.work = true;
  try {
    for (const uid of listDbUsers()) {
      for (let n = 0; n < 100; n++) {
        const t = nextWork(read(uid));
        if (!t) break;
        await runTask(uid, t);
      }
    }
  } finally {
    s.work = false;
  }
}

async function runTask(uid: string, t: Task) {
  try {
    const blocked = notReady();
    if (blocked) throw new Error(blocked);
    const db = read(uid);
    if (!db.profile.masterCv?.text || !db.profile.targets.length) throw new Error("Finish your profile in Settings first: upload your CV and add what you are looking for.");
    await HANDLERS[t.kind](uid, t.id);
  } catch (e) {
    const msg = errMsg(e);
    write(uid, (db) => {
      const a = getApp(db, t.id);
      a.error = msg;
      if (t.kind === "apply" && a.submission) { a.submission.step = "failed"; a.submission.error = msg; a.submission.updatedAt = now(); }
      timeline(a, "agent", `Failed to ${t.kind}: ${msg}`);
      agentLog(db, `${t.kind} failed for ${getJob(db, a).company}: ${msg}`);
      db.agent.now = undefined;
    });
  }
}

async function searchLoop() {
  const s = state();
  if (s.search) return;
  s.search = true;
  try {
    for (const uid of listDbUsers()) {
      if (!searchDue(read(uid))) continue;
      try {
        await runSearch(uid);
      } catch (e) {
        write(uid, (db) => { agentLog(db, `Search failed: ${errMsg(e)}`); db.agent.search = undefined; db.agent.searchRequested = false; db.agent.nextRunAt = nextRun(db.profile.schedule); });
      }
    }
  } finally {
    s.search = false;
  }
}

// ---------- handlers ----------

async function evaluateApp(uid: string, id: string) {
  const db = read(uid);
  const a = getApp(db, id);
  const j = getJob(db, a);
  setNow(uid, "Evaluating", `${j.company} · ${j.title}`);
  let text = j.rawText;
  if (text.length < 200 && j.url) {
    const pg = await fetchPage(j.url);
    text = pg.ld?.description ? [pg.ld.title, pg.ld.company, pg.ld.location, pg.ld.deadline && `Closes: ${pg.ld.deadline}`, "", pg.ld.description].filter(Boolean).join("\n") : pg.text;
  }
  if (text.length < 100) throw new Error("Could not read the posting text. Paste it in instead.");
  const manual = j.source === "manual";
  const { posting, fit } = await evaluate(text, { url: j.url, source: j.source, title: manual ? undefined : j.title, company: manual ? undefined : j.company, location: manual ? undefined : j.location, postedAt: j.postedAt }, db.profile);
  write(uid, (db) => {
    const a = getApp(db, id);
    const j = getJob(db, a);
    Object.assign(j, {
      title: posting.title || j.title, company: posting.company || j.company, location: posting.location || j.location, remote: posting.remote,
      salary: posting.salary ?? j.salary, language: posting.language || j.language, deadline: posting.deadline ?? j.deadline, postedAt: posting.postedAt ?? j.postedAt,
      rawText: text.slice(0, 20_000),
    });
    a.fit = fit;
    a.error = undefined;
    const why = excludedReason(fit);
    if (why) { a.status = "dismissed"; timeline(a, "agent", `Excluded: ${why}`); }
    else timeline(a, "agent", `Scored ${fit.score} · ${band(fit.score)}`);
    if (!posting.isOpen) { a.status = "dismissed"; timeline(a, "agent", "Posting is closed"); }
    agentLog(db, why ? `Excluded ${j.company} · ${j.title}: ${why.slice(0, 140)}` : `Scored ${j.company} · ${fit.score} · ${band(fit.score)}`);
    db.agent.now = undefined;
  });
}

async function draftApp(uid: string, id: string) {
  const db = read(uid);
  const a = getApp(db, id);
  const j = getJob(db, a);
  const pending = db.drafts.filter((d) => d.applicationId === id && d.status === "drafting");
  write(uid, (db) => {
    const a = getApp(db, id);
    a.status = "drafting";
    for (const kind of ["cv", "cover"] as const) {
      if (!db.drafts.some((d) => d.applicationId === id && d.kind === kind)) db.drafts.push({ id: `d${id}${kind}`, applicationId: id, kind, content: "", changes: [], status: "drafting", version: 1, updatedAt: now() });
    }
    db.agent.now = { task: "Drafting", target: j.company, startedAt: now() };
  });
  if (pending.length && pending.every((d) => d.userNote)) {
    for (const d of pending) {
      const other = db.drafts.find((o) => o.applicationId === id && o.kind !== d.kind)?.content;
      const r = await redraft(d.kind, d.content, d.userNote!, other, j, a.fit, db.profile);
      write(uid, (db) => { const x = db.drafts.find((y) => y.id === d.id)!; x.content = r.content; x.changes = r.changes; x.status = "ready"; x.userNote = undefined; x.updatedAt = now(); });
    }
  } else {
    const r = await draftDocuments(j, a.fit, db.profile, db.research, (t) => log(uid, t));
    write(uid, (db) => {
      if (r.research) db.research[companyKey(j.company)] = { summary: r.research, at: now() };
      for (const kind of ["cv", "cover"] as const) {
        const x = db.drafts.find((y) => y.applicationId === id && y.kind === kind)!;
        x.content = kind === "cv" ? r.cv : r.cover; x.changes = kind === "cv" ? r.cvChanges : r.coverChanges; x.status = "ready"; x.userNote = undefined; x.updatedAt = now();
      }
    });
  }
  write(uid, (db) => {
    const a = getApp(db, id);
    a.status = "review";
    a.error = undefined;
    timeline(a, "agent", "CV and cover letter ready for review");
    agentLog(db, `CV and cover letter ready for ${j.company}`);
    db.agent.now = undefined;
  });
}

async function applyApp(uid: string, id: string) {
  const db = read(uid);
  const a = getApp(db, id);
  const j = getJob(db, a);
  const drafts = db.drafts.filter((d) => d.applicationId === id);
  setNow(uid, "Filling form", j.company);
  const r = await assistedApply(uid, id, j, db.profile, drafts, a.submission?.note, (t) => log(uid, t));
  write(uid, (db) => {
    const a = getApp(db, id);
    a.submission = { method: "assisted", url: j.url, ...a.submission, step: "your_turn", note: r.note, answers: r.answers, error: undefined, updatedAt: now() };
    a.error = undefined;
    timeline(a, "agent", r.note.startsWith("Needs you") ? "Stopped at a step only you can do; the browser is open" : "Form filled. Your turn to review and submit in the browser");
    agentLog(db, `${j.company} form filled — waiting for you to review and submit`);
    db.agent.now = undefined;
  });
}

async function prepApp(uid: string, id: string) {
  const db = read(uid);
  const a = getApp(db, id);
  const j = getJob(db, a);
  setNow(uid, "Preparing interview", j.company);
  const cached = db.research[companyKey(j.company)];
  const p = await buildPrep(j, db.profile, db.drafts.filter((d) => d.applicationId === id), cached && Date.now() - new Date(cached.at).getTime() < 30 * 86_400_000 ? cached.summary : undefined);
  write(uid, (db) => {
    const a = getApp(db, id);
    a.prep = { ...p, mock: a.prep?.mock ?? [] };
    a.error = undefined;
    timeline(a, "agent", "Interview prep pack ready");
    agentLog(db, `Interview prep ready for ${j.company}`);
    db.agent.now = undefined;
  });
}

async function mockApp(uid: string, id: string) {
  const db = read(uid);
  const a = getApp(db, id);
  const j = getJob(db, a);
  if (!a.prep) return;
  setNow(uid, "Mock interview", j.company);
  const text = await mockReply(j, db.profile, a.prep);
  write(uid, (db) => { const a = getApp(db, id); a.prep!.mock.push({ role: "agent", text }); a.error = undefined; db.agent.now = undefined; });
}

const HANDLERS: Record<Task["kind"], (uid: string, id: string) => Promise<void>> = { evaluate: evaluateApp, draft: draftApp, apply: applyApp, prep: prepApp, mock: mockApp };
/** Test seam. */
export const __runTask = runTask;

// ---------- search ----------

const COUNTRY: Record<string, string> = { AU: "Australia", US: "United States", GB: "United Kingdom", UK: "United Kingdom", NZ: "New Zealand", IN: "India", CA: "Canada", DE: "Germany", SG: "Singapore" };
const city = (loc: string) => loc.split(",")[0].trim();
const country = (loc: string) => { const last = loc.split(",").at(-1)!.trim(); return COUNTRY[last.toUpperCase()] ?? last; };

export function nextRun(schedule: DB["profile"]["schedule"], from = new Date()): string {
  const d = new Date(from);
  if (schedule === "hourly") return new Date(d.getTime() + 3_600_000).toISOString();
  if (schedule === "manual") return "9999-12-31T00:00:00.000Z";
  d.setHours(9, 0, 0, 0);
  if (d <= from) d.setDate(d.getDate() + 1);
  if (schedule === "weekly") while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

async function pmap<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}

export async function runSearch(uid: string) {
  const blocked = notReady();
  if (blocked) throw new Error(blocked);
  const db0 = read(uid);
  if (!db0.profile.masterCv?.text || !db0.profile.targets.length) throw new Error("Finish your profile in Settings first: upload your CV and add what you are looking for.");
  const p = db0.profile;
  const enabled = new Set(p.sources.filter((s) => s.enabled).map((s) => s.id));
  write(uid, (db) => {
    db.agent.searchRequested = false;
    db.agent.search = { startedAt: now() };
    agentLog(db, `Search started (${enabled.size} sources, ${p.watchList.length} watched career pages)`);
  });
  const pool: Candidate[] = [];
  const attempt = async (label: string, f: () => Promise<Candidate[]>) => {
    try { const c = await f(); pool.push(...c); log(uid, `${label}: ${c.length} postings`); }
    catch (e) { log(uid, `${label}: failed (${errMsg(e)})`); }
  };
  const roles = searchQueries(p).slice(0, 6);
  const locs = p.locations.slice(0, 2);
  if (enabled.has("linkedin")) for (const role of roles) {
    for (const loc of locs) await attempt(`LinkedIn · ${role} · ${loc}`, () => sources.linkedin(role, loc));
    if (p.remote && locs[0]) await attempt(`LinkedIn · ${role} · remote`, () => sources.linkedin(role, country(locs[0]), 14, true));
  }
  if (enabled.has("seek")) for (const role of roles) for (const loc of locs) await attempt(`Seek · ${role} · ${city(loc)}`, () => sources.seek(role, city(loc)));
  if (enabled.has("careers")) for (const w of p.watchList.filter((x) => x.careersUrl)) await attempt(`Careers · ${w.company}`, async () => (await sources.careersPage(w, p)).filter((c) => sources.titleMatches(c.title, p) && sources.locationMatches(c.location, p)).slice(0, 40));
  if (enabled.has("websearch")) await attempt("Web search", () => sources.webSearch(p));

  const known = new Set(db0.jobs.map((j) => normUrl(j.url)));
  const knownKeys = new Set(db0.jobs.map((j) => jobKey(j.company, j.title)));
  const seen = new Set<string>();
  const cutoff = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
  const fresh = pool.filter((c) => {
    const u = normUrl(c.url), k = jobKey(c.company, c.title);
    if (!c.url || seen.has(u) || seen.has(k) || known.has(u) || knownKeys.has(k)) return false;
    if (c.postedAt && c.postedAt.slice(0, 10) < cutoff) return false;
    seen.add(u); seen.add(k);
    return true;
  });
  log(uid, `${pool.length} postings found, ${fresh.length} new after dedupe`);
  let keep = fresh;
  if (fresh.length) {
    const idx = await triage(fresh.map((c) => ({ title: c.title, company: c.company, location: c.location, snippet: c.snippet })), p);
    keep = idx.map((i) => fresh[i]).slice(0, 30);
    log(uid, `Triage kept ${keep.length} of ${fresh.length} to fetch and score`);
  }
  let created = 0, done = 0;
  write(uid, (db) => { if (db.agent.search) db.agent.search.progress = { done: 0, total: keep.length }; });
  await pmap(keep, 3, async (c) => {
    try {
      const text = c.text ?? (c.detail ? await c.detail() : (await fetchPage(c.url)).text);
      if (!text || text.length < 200) { log(uid, `${c.company} · ${c.title}: unreadable or closed, skipped`); return; }
      const { posting, fit } = await evaluate(text, { url: c.url, source: c.source, title: c.title, company: c.company, location: c.location, postedAt: c.postedAt }, p);
      if (!posting.isOpen) { log(uid, `${c.company} · ${c.title}: closed`); return; }
      write(uid, (db) => {
        if (db.jobs.some((j) => normUrl(j.url) === normUrl(c.url))) return;
        const id = `j${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const job: Job = {
          id, source: c.source, sourceLabel: c.sourceLabel, url: c.url, title: posting.title || c.title, company: posting.company || c.company, location: posting.location || c.location,
          remote: posting.remote || Boolean(c.remote), salary: posting.salary ?? undefined, language: posting.language || "English",
          postedAt: posting.postedAt ?? c.postedAt ?? now().slice(0, 10), deadline: posting.deadline ?? undefined, rawText: text.slice(0, 20_000), foundAt: now(),
        };
        db.jobs.push(job);
        const why = excludedReason(fit);
        db.applications.push({ id: `a${id}`, jobId: id, status: why ? "dismissed" : "found", fit, notes: "", timeline: [{ at: now(), actor: "agent", event: `Found on ${c.sourceLabel}` }, { at: now(), actor: "agent", event: why ? `Excluded: ${why}` : `Scored ${fit.score} · ${band(fit.score)}` }] });
        agentLog(db, why ? `Excluded ${job.company} · ${job.title}: ${why.slice(0, 140)}` : `Scored ${job.company} · ${fit.score} · ${band(fit.score)}`);
        if (!why) created++;
      });
    } catch (e) {
      log(uid, `${c.company} · ${c.title}: ${errMsg(e)}`);
    } finally {
      done++;
      write(uid, (db) => { if (db.agent.search?.progress) db.agent.search.progress.done = done; });
    }
  });
  write(uid, (db) => {
    db.agent.search = undefined;
    db.agent.lastRunAt = now();
    db.agent.nextRunAt = nextRun(db.profile.schedule);
    agentLog(db, `Search done: ${created} new posting${created === 1 ? "" : "s"} in your inbox (excluded ones are under Pipeline › Closed)`);
  });
}
