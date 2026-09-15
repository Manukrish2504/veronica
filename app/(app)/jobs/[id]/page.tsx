import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/mt/icon";
import { Button } from "@/components/mt/button";
import { Panel } from "@/components/mt/panel";
import { ScorePill, StatusPill } from "@/components/mt/pills";
import { StatusSelect } from "@/components/job/status-select";
import { ErrorLine, ExcludedLine, PrimaryAction, SubmissionCard } from "@/components/job/apply-dialog";
import { FitPanel } from "@/components/job/fit-panel";
import { DraftPanel } from "@/components/job/draft-panel";
import { ActivityPanel } from "@/components/job/activity-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { read } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { addMock } from "@/lib/actions";
import { deadlineLabel } from "@/lib/format";
import { daysUntil, join } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS = [
  { v: "fit", label: "Fit", icon: "fact_check" },
  { v: "cv", label: "CV", icon: "description" },
  { v: "cover", label: "Cover letter", icon: "mail" },
  { v: "prep", label: "Prep", icon: "school" },
  { v: "activity", label: "Activity", icon: "history" },
] as const;

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const user = await requireUser();
  const app = join(read(user.id)).find((a) => a.id === id);
  if (!app) notFound();

  const cv = app.drafts.find((d) => d.kind === "cv");
  const cover = app.drafts.find((d) => d.kind === "cover");
  const approved = app.drafts.filter((d) => d.status === "approved").length;
  const days = daysUntil(app.job.deadline);
  const initial = TABS.some((t) => t.v === tab) ? (tab as string) : app.status === "review" ? "cv" : "fit";

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-10 py-8 space-y-6">
      <Link href="/pipeline" className="inline-flex items-center gap-1 text-[0.8125rem] text-muted-foreground hover:text-foreground no-underline"><Icon name="arrow_back" size={16} />Pipeline</Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="truncate" style={{ fontSize: "var(--text-headline-md)" }}>{app.job.title}</h1>
            <StatusPill status={app.status} />
          </div>
          <p className="text-sm text-muted-foreground">{app.job.company} · {app.job.location}{app.job.salary ? ` · ${app.job.salary}` : ""}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <ScorePill fit={app.fit} included={app.included} />
            <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-surface-1 text-[0.75rem] text-muted-foreground"><Icon name="public" size={14} />{app.job.sourceLabel}</span>
            <span className={cn("inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-surface-1 font-mono text-[0.75rem]", days !== undefined && days < 7 ? "text-destructive" : "text-muted-foreground")}><Icon name="date_range" size={14} />{days === undefined ? "no deadline" : `closes ${deadlineLabel(days)}`}</span>
            {app.drafts.length > 0 && <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-surface-1 font-mono text-[0.75rem] text-muted-foreground"><Icon name="task_alt" size={14} />{approved}/{app.drafts.length} approved</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusSelect id={app.id} status={app.status} />
          <Sheet>
            <SheetTrigger asChild><Button size="sm" variant="outlined" icon="description">View posting</Button></SheetTrigger>
            <SheetContent side="right" className="w-[540px] sm:max-w-[540px] border-outline-variant">
              <SheetHeader>
                <SheetTitle className="font-display font-medium">{app.job.title}</SheetTitle>
                <SheetDescription>{app.job.company} · {app.job.location}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6 overflow-y-auto">
                {app.job.url && <a href={app.job.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[0.8125rem] text-primary"><Icon name="open_in_new" size={15} />Open original</a>}
                <pre className="whitespace-pre-wrap rounded-2xl bg-surface-1 p-4 font-sans text-[0.8125rem] leading-relaxed">{app.job.rawText || "No text captured."}</pre>
              </div>
            </SheetContent>
          </Sheet>
          <PrimaryAction app={app} />
        </div>
      </header>

      <ErrorLine app={app} />
      <ExcludedLine app={app} />
      {app.status === "applying" && <SubmissionCard app={app} />}

      <Tabs defaultValue={initial} className="gap-5">
        <TabsList className="h-9 w-fit gap-0 rounded-full bg-surface-2 p-0.5">
          {TABS.map((t) => (
            <TabsTrigger key={t.v} value={t.v} className="h-8 flex-none rounded-full border-0 px-3 text-[0.8125rem] font-medium text-muted-foreground shadow-none data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <Icon name={t.icon} size={16} />{t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="fit"><FitPanel fit={app.fit} /></TabsContent>
        <TabsContent value="cv"><DraftPanel key={cv ? `${cv.id}-${cv.updatedAt}` : "none"} draft={cv} /></TabsContent>
        <TabsContent value="cover"><DraftPanel key={cover ? `${cover.id}-${cover.updatedAt}` : "none"} draft={cover} /></TabsContent>
        <TabsContent value="prep">
          {app.prep ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel title="Company research"><p className="text-[0.8125rem] leading-relaxed">{app.prep.research}</p></Panel>
              <Panel title="Likely questions"><ol className="list-decimal space-y-1.5 pl-5 text-[0.8125rem]">{app.prep.questions.map((q) => <li key={q}>{q}</li>)}</ol>
                {app.prep.ask && app.prep.ask.length > 0 && <><div className="pt-2 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Ask them</div><ul className="list-disc space-y-1.5 pl-5 text-[0.8125rem]">{app.prep.ask.map((q) => <li key={q}>{q}</li>)}</ul></>}
              </Panel>
              <Panel title="STAR stories">
                <ul className="space-y-4">
                  {app.prep.starStories.map((s, i) => (
                    <li key={i} className="text-[0.8125rem]">
                      <div className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{s.requirement}</div>
                      <p className="mt-1 leading-relaxed">{s.story}</p>
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title="Mock interview">
                <ul className="space-y-2.5">
                  {app.prep.mock.length === 0 && <li className="text-sm text-muted-foreground">Ask for a question to start.</li>}
                  {app.prep.mock.map((m, i) => (
                    <li key={i} className={cn("max-w-[90%] rounded-2xl px-4 py-2.5 text-[0.8125rem] leading-relaxed", m.role === "agent" ? "bg-surface-1" : "ml-auto bg-primary-container text-primary-container-foreground")}>{m.text}</li>
                  ))}
                </ul>
                <form action={addMock.bind(null, app.id)} className="flex gap-2 pt-1">
                  <input name="text" placeholder={app.prep.mock.length ? "Your answer…" : "Ask the agent to start a mock interview"} className="h-9 flex-1 rounded-full border border-outline-variant bg-card px-4 text-sm outline-none focus:border-primary/40" />
                  <Button size="sm" type="submit" icon="send">Send</Button>
                </form>
              </Panel>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-outline-variant bg-card py-14 px-6 text-center space-y-2">
              <Icon name={app.status === "interview" && !app.error ? "progress_activity" : "school"} size={28} className={app.status === "interview" && !app.error ? "text-primary animate-spin" : "text-muted-foreground"} />
              <p className="text-[0.9375rem] font-medium">{app.status === "interview" && !app.error ? "Building your prep pack" : "No prep pack yet"}</p>
              <p className="text-sm text-muted-foreground">{app.status === "interview" && !app.error ? "Company research, STAR stories and likely questions are on their way." : "Set the status to Interview and the agent builds company research, STAR stories and likely questions."}</p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="activity"><ActivityPanel app={app} /></TabsContent>
      </Tabs>
    </div>
  );
}
