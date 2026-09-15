import Link from "next/link";
import { Greeting } from "@/components/home/greeting";
import { Composer } from "@/components/home/composer";
import { Ambient } from "@/components/home/ambient";
import { Icon } from "@/components/mt/icon";
import { read } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { deadlineLabel } from "@/lib/format";
import { daysUntil, join, needsYou } from "@/lib/types";

const KIND_ICON: Record<string, string> = { drafts: "rate_review", your_turn: "send", followup: "schedule", apply: "task_alt" };

export default async function Home() {
  const user = await requireUser();
  const db = read(user.id);
  const apps = join(db);
  const firstName = db.profile.name.split(/\s+/)[0] || "there";
  const cards = apps.flatMap((a) => needsYou(a).map((label) => ({ a, label })));
  const counts = {
    drafts: apps.filter((a) => a.status === "review").length,
    yourTurn: apps.filter((a) => a.submission?.step === "your_turn").length,
    followUps: cards.filter((c) => c.label.startsWith("Follow-up")).length,
    interviews: apps.filter((a) => a.status === "interview").length,
  };
  const strong = apps.filter((a) => a.status === "found" && (a.fit?.score ?? 0) >= 75).length;

  return (
    <div className="landing-hero relative min-h-full flex flex-col">
      <div className="landing-band relative flex-1 flex flex-col justify-center px-8 md:px-16">
        <Ambient />
        <div className="landing-enter relative max-w-5xl w-full mx-auto py-16">
          <div className="text-center mb-12">
            <Greeting firstName={firstName} />
            <p className="mt-3 text-[0.9375rem] text-muted-foreground">
              {strong > 0 ? `${strong} strong ${strong === 1 ? "fit" : "fits"} waiting in your inbox.` : "What are we applying to today?"}
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <Composer pending={counts} />
          </div>

          {cards.length > 0 && (
            <section className="mt-12 max-w-3xl mx-auto">
              <div className="mb-3 flex items-center gap-2">
                <Icon name="bolt" size={18} filled className="text-primary" />
                <h2 className="text-[0.9375rem] font-medium">For you, today</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {cards.slice(0, 3).map(({ a, label }, i) => {
                  const kind = label.startsWith("Your turn") ? "your_turn" : label.startsWith("Follow-up") ? "followup" : label.startsWith("Ready") ? "apply" : "drafts";
                  const days = daysUntil(a.job.deadline);
                  return (
                    <Link key={i} href={`/jobs/${a.id}`} className="group rounded-2xl border border-outline-variant bg-card/90 p-4 flex flex-col gap-2 hover:border-primary/40 transition no-underline">
                      <div className="flex items-center justify-between">
                        <span className="px-2 h-5 inline-flex items-center rounded-full bg-surface-2 text-[0.625rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</span>
                        <Icon name={KIND_ICON[kind]} size={18} className="text-primary" />
                      </div>
                      <div className="text-[0.9375rem] font-medium leading-snug">{a.job.company}</div>
                      <div className="text-[0.8125rem] text-muted-foreground leading-snug">{a.job.title}</div>
                      {days !== undefined && <div className="mt-auto pt-1 font-mono text-[0.6875rem] text-muted-foreground">closes {deadlineLabel(days)}</div>}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
      <div className="relative shrink-0 px-8 md:px-16 pb-5 text-center text-[0.6875rem] text-muted-foreground">
        Veronica drafts, you approve. Nothing is sent to an employer without you.
      </div>
    </div>
  );
}
