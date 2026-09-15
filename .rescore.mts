import { read } from "./lib/db";
import { nextWork, __runTask } from "./lib/agent/runner";
const t0 = Date.now();
// three at a time, like the search lane
const inflight = new Set<string>();
async function worker() {
  for (;;) {
    const db = read("test");
    const t = db.applications.filter((a) => a.status === "found" && !a.fit && !a.error && !inflight.has(a.id))[0];
    if (!t) return;
    inflight.add(t.id);
    await __runTask("test", { kind: "evaluate", id: t.id });
    const d = read("test"); const a = d.applications.find((x) => x.id === t.id)!; const j = d.jobs.find((x) => x.id === a.jobId)!;
    console.log(`${Math.round((Date.now() - t0) / 1000)}s ${j.company} · ${j.title.slice(0, 40)} → ${a.status}${a.fit ? ` ${a.fit.score} elig=${a.fit.gates.eligibility.result} timing=${a.fit.gates.timing?.result}` : ""} ${a.error ?? ""}`);
  }
}
void nextWork;
await Promise.all([worker(), worker(), worker()]);
const d = read("test");
console.log("inbox", d.applications.filter((a) => a.status === "found").length, "excluded", d.applications.filter((a) => a.status === "dismissed").length);
