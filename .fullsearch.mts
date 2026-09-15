import { read, write } from "./lib/db";
import { runSearch } from "./lib/agent/runner";
const t0 = Date.now();
write("test", (db) => { db.agent.searchRequested = true; });
await runSearch("test");
const d = read("test");
console.log("elapsed s", Math.round((Date.now() - t0) / 1000));
console.log(d.agent.log.slice(-80).map((x) => x.at.slice(11, 19) + " " + x.text.slice(0, 140)).join("\n"));
console.log("inbox", d.applications.filter((a) => a.status === "found").length, "discovered", d.profile.discovered?.length ?? 0);
