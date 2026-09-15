import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";

// Point the store at a scratch file before any module reads it.
const dir = mkdtempSync(path.join(tmpdir(), "veronica-"));
process.env.VERONICA_DATA = path.join(dir, "db.json");
process.env.ANTHROPIC_API_KEY = "test";

const profile = {
  name: "Test Person", email: "t@example.com", phone: "", linkedin: "", website: "", workRights: "Student visa", availability: "now", notes: "",
  masterCv: { fileName: "cv.pdf", text: "Test Person. AI/ML intern at Algoleap 2024-2025. Python, LangGraph.", uploadedAt: "2026-01-01T00:00:00.000Z" },
  targets: [{ kind: "graduate" as const, roles: ["AI Engineer"], startFrom: "2027-11", startTo: "2028-03", note: "" }], keywords: ["Python"], locations: ["Melbourne, AU"], remote: true, salaryFloor: { amount: 0, currency: "AUD" }, sectors: [], languages: [{ name: "English", level: "Fluent" }],
  dealBreakers: [], sources: [], watchList: [], schedule: "manual" as const,
};
function seed() {
  writeFileSync(process.env.VERONICA_DATA!, JSON.stringify({
    profile, research: {}, agent: { log: [], paused: true, nextRunAt: "9999-12-31T00:00:00.000Z" },
    jobs: [{ id: "j1", source: "manual", sourceLabel: "Manual", url: "", title: "Pasted posting", company: "Unknown company", location: "—", remote: false, language: "English", postedAt: "2026-09-15", foundAt: "2026-09-15T00:00:00.000Z", rawText: "Acme Robotics is hiring a Graduate AI Engineer in Melbourne. Python and LangGraph required. Applications close 2026-09-30. ".repeat(3) }],
    applications: [{ id: "aj1", jobId: "j1", status: "found", notes: "", timeline: [] }],
    drafts: [],
  }));
}

let gate: "pass" | "fail" = "pass";
// A fake model that answers by schema shape, so the pipeline runs without the API.
const fake = async <T extends z.ZodType>(schema: T): Promise<z.infer<T>> => {
  const keys = Object.keys((schema as unknown as z.ZodObject).shape);
  const dim = (score: number) => ({ score, note: "n" });
  if (keys.includes("keep")) return { keep: [0] } as z.infer<T>;
  if (keys.includes("posting")) return {
    posting: { title: "Graduate AI Engineer", company: "Acme Robotics", location: "Melbourne, AU", remote: false, employmentType: "Full-time", salary: null, language: "English", postedAt: null, deadline: "2026-09-30", applyUrl: null, isOpen: true, summary: "s", requirements: ["Python"] },
    eligibility: { result: gate, note: gate === "fail" ? "Citizens only" : "silent" }, languageGate: { result: "pass", note: "English" }, timing: { result: "pass", note: "2028 intake" },
    dimensions: { technical: dim(90), experience: dim(70), culture: dim(60), career: dim(80) }, location: { pass: true, note: "Melbourne" }, dealBreakersHit: [], strengths: ["LangGraph"], gaps: ["No robotics"], recommendation: "apply",
  } as z.infer<T>;
  if (keys.includes("cvChanges")) return { cv: "# Test Person\n\n## Summary\nGraduate AI engineer.", cover: "Dear Hiring Manager,\n\nI built agents.", cvChanges: [{ section: "Summary", before: "", after: "Graduate AI engineer.", reason: "role" }], coverChanges: [], stretch: [{ text: "built agents", why: "internship work" }] } as z.infer<T>;
  if (keys.includes("edits")) return { companyResearch: "Acme builds robots (https://acme.example)", edits: [{ doc: "cv", old: "Graduate AI engineer.", new: "Graduate AI engineer with LangGraph experience.", reason: "keyword" }], ungrounded: [], notes: [] } as z.infer<T>;
  if (keys.includes("applied")) throw new Error("revise should not run when every edit applied cleanly");
  if (keys.includes("starStories")) return { research: "r", starStories: [{ requirement: "Python", story: "S/T/A/R" }, { requirement: "Agents", story: "S/T/A/R" }, { requirement: "Teamwork", story: "S/T/A/R" }], questions: ["q1", "q2", "q3", "q4", "q5", "q6"], ask: ["a1", "a2", "a3", "a4"] } as z.infer<T>;
  if (keys.includes("question")) return { feedback: "Good.", question: "Tell me about LangGraph." } as z.infer<T>;
  throw new Error(`fake llm: unknown schema ${keys.join(",")}`);
};

let runner: typeof import("./runner.ts");
let db: typeof import("../db.ts");
before(async () => {
  seed();
  (await import("./llm.ts")).__setLlm(fake);
  runner = await import("./runner.ts");
  db = await import("../db.ts");
});

test("evaluate scores a found job with the reference weights and fills in the posting", async () => {
  assert.deepEqual(runner.nextWork(db.read()), { kind: "evaluate", id: "aj1" });
  await runner.__runTask("test", { kind: "evaluate", id: "aj1" });
  const d = db.read();
  const a = d.applications[0];
  assert.equal(a.fit?.score, Math.round(0.3 * 90 + 0.25 * 70 + 0.15 * 60 + 0.3 * 80));
  assert.equal(a.fit?.urgency.startsWith("Closes in"), true);
  assert.equal(d.jobs[0].company, "Acme Robotics");
  assert.equal(d.jobs[0].deadline, "2026-09-30");
  assert.equal(a.error, undefined);
  assert.equal(runner.nextWork(db.read()), undefined);
});

test("shortlist → draft → review with reviewer edits and stretch flags", async () => {
  db.write("test", (x) => { x.applications[0].status = "shortlisted"; });
  assert.deepEqual(runner.nextWork(db.read()), { kind: "draft", id: "aj1" });
  await runner.__runTask("test", { kind: "draft", id: "aj1" });
  const d = db.read();
  assert.equal(d.applications[0].status, "review");
  const cv = d.drafts.find((x) => x.kind === "cv")!;
  assert.equal(cv.status, "ready");
  assert.match(cv.content, /LangGraph experience/);
  assert.ok(cv.changes.some((c) => c.section.startsWith("Stretch")));
  assert.ok(cv.changes.some((c) => c.section.startsWith("Reviewer")));
  assert.equal(d.research["acme-robotics"]?.summary.includes("Acme"), true);
});

test("interview status builds a prep pack, mock turns get a reply, failures park the app", async () => {
  db.write("test", (x) => { x.applications[0].status = "interview"; });
  assert.deepEqual(runner.nextWork(db.read()), { kind: "prep", id: "aj1" });
  await runner.__runTask("test", { kind: "prep", id: "aj1" });
  assert.equal(db.read().applications[0].prep?.starStories.length, 3);
  db.write("test", (x) => { x.applications[0].prep!.mock.push({ role: "you", text: "start" }); });
  assert.deepEqual(runner.nextWork(db.read()), { kind: "mock", id: "aj1" });
  await runner.__runTask("test", { kind: "mock", id: "aj1" });
  assert.match(db.read().applications[0].prep!.mock.at(-1)!.text, /LangGraph/);
  // An LLM failure records the error and takes the app out of the queue until Retry.
  (await import("./llm.ts")).__setLlm(async () => { throw new Error("boom"); });
  db.write("test", (x) => { x.applications[0].prep!.mock.push({ role: "you", text: "again" }); });
  await runner.__runTask("test", { kind: "mock", id: "aj1" });
  assert.equal(db.read().applications[0].error, "boom");
  assert.equal(runner.nextWork(db.read()), undefined);
});

test("a gate failure excludes the job from the inbox with the reason on record", async () => {
  db.write("test", (x) => {
    x.jobs.push({ ...x.jobs[0], id: "j2", rawText: "Acme Defence hires a Graduate AI Engineer. Australian citizens only. ".repeat(3) });
    x.applications.push({ id: "aj2", jobId: "j2", status: "found", notes: "", timeline: [] });
  });
  (await import("./llm.ts")).__setLlm(fake);
  gate = "fail";
  await runner.__runTask("test", { kind: "evaluate", id: "aj2" });
  gate = "pass";
  const a = db.read().applications.find((x) => x.id === "aj2")!;
  assert.equal(a.status, "dismissed");
  assert.match(a.timeline.at(-1)!.event, /^Excluded: Not eligible: Citizens only/);
  assert.equal(runner.nextWork(db.read()), undefined);
  const { isExcluded } = await import("../types.ts");
  assert.equal(isExcluded(a), true);
  assert.equal(isExcluded({ ...a, included: true }), false);
});

test("target helpers build search phrases and prompt text", async () => {
  const { searchQueries, targetsText } = await import("../types.ts");
  const p = { ...profile, targets: [{ kind: "internship" as const, roles: ["AI Engineer", "Software Engineer"], startFrom: "2026-11", startTo: "2027-02", note: "summer" }, { kind: "graduate" as const, roles: ["AI Engineer"], startFrom: "2027-11", startTo: "2028-03", note: "" }] };
  assert.deepEqual(searchQueries(p), ["AI Engineer intern", "Software Engineer intern", "graduate AI Engineer"]);
  assert.match(targetsText(p), /1\. Internship: AI Engineer, Software Engineer — starting Nov 2026 to Feb 2027 \(summer\)/);
});

test("schedule and dedupe helpers", async () => {
  const { normUrl, jobKey } = await import("../types.ts");
  assert.equal(normUrl("https://www.linkedin.com/jobs/view/graduate-ai-engineer-at-acme-4455645312?refId=x"), "linkedin.com/jobs/view/4455645312");
  assert.equal(normUrl("https://au.linkedin.com/jobs/view/4455645312/"), "linkedin.com/jobs/view/4455645312");
  assert.equal(jobKey("Acme, Inc.", "Graduate AI Engineer"), jobKey("acme inc", "graduate ai engineer"));
  const from = new Date("2026-09-15T10:00:00");
  assert.equal(new Date(runner.nextRun("daily", from)).getHours(), 9);
  assert.ok(new Date(runner.nextRun("daily", from)) > from);
  assert.equal(new Date(runner.nextRun("weekly", from)).getDay(), 1);
  assert.equal(runner.nextRun("manual"), "9999-12-31T00:00:00.000Z");
});
