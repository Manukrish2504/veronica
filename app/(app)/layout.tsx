import { AppShell, type Need, type ShellData } from "@/components/shell/app-shell";
import { read } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { join, needsYou } from "@/lib/types";
import { nextWork, searchDue } from "@/lib/agent/runner";

export const dynamic = "force-dynamic";

function kindOf(label: string): Need["kind"] {
  if (label.startsWith("Your turn")) return "your_turn";
  if (label.startsWith("Follow-up")) return "followup";
  if (label.startsWith("Ready to apply")) return "apply";
  return "drafts";
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const db = read(user.id);
  const apps = join(db);
  const needs: Need[] = apps.flatMap((a) => needsYou(a).map((label) => ({ id: a.id, company: a.job.company, label, kind: kindOf(label) })));
  const recent = [...apps]
    .filter((a) => a.status !== "found" && a.status !== "dismissed")
    .sort((a, b) => (b.timeline.at(-1)?.at ?? "").localeCompare(a.timeline.at(-1)?.at ?? ""))
    .slice(0, 6)
    .map((a) => ({ id: a.id, title: a.job.title, company: a.job.company }));
  const initials = db.profile.name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "V";
  const data: ShellData = {
    profile: { name: db.profile.name, email: db.profile.email, initials },
    counts: { inbox: apps.filter((a) => a.status === "found").length, needsYou: new Set(needs.map((n) => n.id)).size },
    needs,
    recent,
    agent: db.agent,
    busy: Boolean(db.agent.now) || Boolean(db.agent.search) || searchDue(db) || Boolean(nextWork(db)),
    jobs: apps.filter((a) => a.status !== "dismissed").map((a) => ({ id: a.id, title: a.job.title, company: a.job.company })),
  };
  return <AppShell data={data}>{children}</AppShell>;
}
