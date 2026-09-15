import { Icon } from "@/components/mt/icon";
import { ThemePicker } from "@/components/theme-picker";
import { SaveButton } from "@/components/save-button";
import { Switch } from "@/components/ui/switch";
import { read } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { saveProfile } from "@/lib/actions";
import { SOURCES, TARGET_LABEL, type Target, type TargetKind } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { DRAFT_MODEL, MODEL, PROVIDER, authStatus, hasKey } from "@/lib/agent/llm";

const LEVELS = ["Native", "Fluent", "Professional", "Conversational", "Basic"];
const SCHEDULES = [["hourly", "Every hour"], ["daily", "Daily at 09:00"], ["weekly", "Weekly"], ["manual", "Only when I ask"]] as const;
const KINDS = Object.entries(TARGET_LABEL) as [TargetKind, string][];
const SOURCE_ICON: Record<string, string> = { linkedin: "group", seek: "search", jora: "manage_search", employmenthero: "storefront", gradconnection: "school", remotive: "public", adzuna: "api", websearch: "language", careers: "corporate_fare", discover: "travel_explore" };

const input = "h-9 w-full rounded-full border border-outline-variant bg-card px-4 text-[0.8125rem] outline-none focus:border-primary/40 placeholder:text-muted-foreground";
const area = "w-full rounded-xl border border-outline-variant bg-card px-3 py-2 text-[0.8125rem] outline-none focus:border-primary/40 placeholder:text-muted-foreground";
const select = "h-9 rounded-full border border-outline-variant bg-card px-3 text-[0.8125rem] outline-none focus:border-primary/40";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[0.9375rem] font-semibold" style={{ fontFamily: "var(--font-sans)", letterSpacing: 0 }}>{title}</h2>
        {description && <p className="text-[0.8125rem] text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  );
}
function Field({ label, name, defaultValue, hint, type = "text" }: { label: string; name: string; defaultValue?: string | number; hint?: string; type?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[0.75rem] font-medium text-muted-foreground">{label}</span>
      <input name={name} type={type} defaultValue={defaultValue} className={input} />
      {hint && <span className="block text-[0.6875rem] text-muted-foreground">{hint}</span>}
    </label>
  );
}
function Area({ label, name, defaultValue, hint, rows = 3 }: { label: string; name: string; defaultValue?: string; hint?: string; rows?: number }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[0.75rem] font-medium text-muted-foreground">{label}</span>
      <textarea name={name} defaultValue={defaultValue} rows={rows} className={area} />
      {hint && <span className="block text-[0.6875rem] text-muted-foreground">{hint}</span>}
    </label>
  );
}
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <div className={`rounded-2xl border border-outline-variant bg-card p-4 ${className}`}>{children}</div>;

export default async function SettingsPage() {
  const user = await requireUser();
  const p = read(user.id).profile;
  const auth = PROVIDER === "claude" ? await authStatus() : undefined;
  const authOk = PROVIDER === "api" ? hasKey() : auth?.loggedIn !== false;
  const langs = [...p.languages, { name: "", level: "Professional" }];
  const targets: Target[] = [...p.targets, { kind: "internship", roles: [], startFrom: "", startTo: "", note: "" }];
  const watch = [...p.watchList, { company: "", careersUrl: "" }, { company: "", careersUrl: "" }];
  const src = (id: string) => p.sources.find((s) => s.id === id)?.enabled ?? true;

  return (
    <form action={saveProfile} className="max-w-3xl mx-auto px-6 md:px-10 py-8 space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 style={{ fontSize: "var(--text-headline-md)" }}>Settings</h1>
          <p className="text-sm text-muted-foreground">Your profile, what you want, where the agent looks, and how it looks.</p>
        </div>
        <SaveButton />
      </header>

      <Section title="Appearance" description="Pick your theme. Applies instantly.">
        <ThemePicker />
      </Section>

      <Section title="Master CV" description={p.masterCv ? `${p.masterCv.fileName} · uploaded ${fmtDate(p.masterCv.uploadedAt)}. Every tailored CV starts from this and nothing outside it is ever claimed.` : "Upload your CV. Every tailored CV starts from this."}>
        <Card className="space-y-3">
          <label className="flex flex-wrap items-center gap-3 text-[0.8125rem]">
            <span className="inline-flex size-8 items-center justify-center rounded-xl bg-surface-2 text-muted-foreground"><Icon name="upload_file" size={16} /></span>
            <span className="font-medium">Replace with a PDF</span>
            <input type="file" name="masterCvFile" accept="application/pdf" className="text-[0.75rem] text-muted-foreground file:mr-3 file:rounded-full file:border file:border-outline-variant file:bg-card file:px-3 file:py-1 file:text-[0.75rem] file:font-medium" />
          </label>
          <textarea name="masterCvText" defaultValue={p.masterCv?.text ?? ""} rows={12} className={`${area} font-mono leading-6`} placeholder="Or paste your CV text" />
        </Card>
      </Section>

      <Section title="LinkedIn profile" description={p.linkedinProfile ? `${p.linkedinProfile.fileName} · uploaded ${fmtDate(p.linkedinProfile.uploadedAt)}. A second source for skills, certifications, languages and awards. Roles and employers still come only from the master CV.` : "Optional. Export your profile as PDF (LinkedIn › More › Save to PDF). Adds skills, certifications, languages and awards the CV leaves out; roles and employers still come only from the master CV."}>
        <Card className="space-y-3">
          <label className="flex flex-wrap items-center gap-3 text-[0.8125rem]">
            <span className="inline-flex size-8 items-center justify-center rounded-xl bg-surface-2 text-muted-foreground"><Icon name="upload_file" size={16} /></span>
            <span className="font-medium">Replace with a PDF</span>
            <input type="file" name="linkedinFile" accept="application/pdf" className="text-[0.75rem] text-muted-foreground file:mr-3 file:rounded-full file:border file:border-outline-variant file:bg-card file:px-3 file:py-1 file:text-[0.75rem] file:font-medium" />
          </label>
          <textarea name="linkedinText" defaultValue={p.linkedinProfile?.text ?? ""} rows={8} className={`${area} font-mono leading-6`} placeholder="Or paste the profile text" />
        </Card>
      </Section>

      <Section title="You">
        <Card className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" name="name" defaultValue={p.name} />
          <Field label="Email" name="email" defaultValue={p.email} type="email" />
          <Field label="Phone" name="phone" defaultValue={p.phone} />
          <Field label="LinkedIn" name="linkedin" defaultValue={p.linkedin} />
          <Field label="Website" name="website" defaultValue={p.website} />
          <div className="sm:col-span-2"><Area label="Work rights" name="workRights" defaultValue={p.workRights} hint="Quoted to the eligibility gate. Visa class, hours cap, sponsorship needs." /></div>
          <div className="sm:col-span-2"><Area label="Availability" name="availability" defaultValue={p.availability} rows={2} hint="Start dates, hours, semester constraints. Goes into cover letters and forms." /></div>
          <div className="sm:col-span-2"><Area label="About you" name="notes" defaultValue={p.notes} rows={4} hint="Goals, what energises or drains you, constraints. Feeds the culture and career scores." /></div>
        </Card>
      </Section>

      <Section title="What you want" description="The agent searches for exactly these and excludes everything else. Lists are comma-separated.">
        <Card className="grid gap-4">
          <div className="space-y-2">
            <span className="text-[0.75rem] font-medium text-muted-foreground">Looking for</span>
            {targets.map((t, i) => (
              <div key={i} className="grid gap-2 rounded-xl bg-surface-1 p-2">
                <div className="grid gap-2 sm:grid-cols-[210px_1fr]">
                  <select name="target_kind" defaultValue={t.kind} className={select}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  <input name="target_roles" defaultValue={t.roles.join(", ")} placeholder="Roles, e.g. AI Engineer, Software Engineer" className={input} />
                </div>
                <div className="grid gap-2 sm:grid-cols-[auto_auto_1fr] items-center">
                  <label className="flex items-center gap-2 text-[0.6875rem] text-muted-foreground">starts<input name="target_from" type="month" defaultValue={t.startFrom} className={`${input} w-[170px]`} /></label>
                  <label className="flex items-center gap-2 text-[0.6875rem] text-muted-foreground">to<input name="target_to" type="month" defaultValue={t.startTo} className={`${input} w-[170px]`} /></label>
                  <input name="target_note" defaultValue={t.note} placeholder="Note for the agent (optional), e.g. summer break, full-time hours allowed" className={input} />
                </div>
              </div>
            ))}
            <span className="block text-[0.6875rem] text-muted-foreground">One row per kind of job and when it should start. Clear the roles to remove a row. A posting that matches none of these fails the timing gate and goes to Pipeline › Closed instead of your inbox.</span>
          </div>
          <Field label="Keywords" name="keywords" defaultValue={p.keywords.join(", ")} />
          <Field label="Sectors" name="sectors" defaultValue={p.sectors.join(", ")} />
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-end">
            <Field label="Locations" name="locations" defaultValue={p.locations.join("; ")} hint="City, country; separate several with semicolons, e.g. Melbourne, AU; Sydney, AU" />
            <label className="flex h-9 items-center gap-3 text-[0.8125rem]"><Switch name="remote" defaultChecked={p.remote} />Remote is fine</label>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <Field label="Salary floor" name="salaryAmount" defaultValue={p.salaryFloor.amount} type="number" />
            <Field label="Currency" name="salaryCurrency" defaultValue={p.salaryFloor.currency} />
          </div>
          <label className="block space-y-1.5">
            <span className="text-[0.75rem] font-medium text-muted-foreground">Deal-breakers</span>
            <textarea name="dealBreakers" defaultValue={p.dealBreakers.join("\n")} rows={4} className={area} />
            <span className="block text-[0.6875rem] text-muted-foreground">One per line. Any hit vetoes the posting.</span>
          </label>
          <div className="space-y-1.5">
            <span className="text-[0.75rem] font-medium text-muted-foreground">Languages</span>
            {langs.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_180px] gap-2">
                <input name="lang_name" defaultValue={l.name} placeholder="Add a language" className={input} />
                <select name="lang_level" defaultValue={l.level} className={select}>{LEVELS.map((lv) => <option key={lv}>{lv}</option>)}</select>
              </div>
            ))}
            <span className="block text-[0.6875rem] text-muted-foreground">Clear a name to remove it. Postings in a language you have not listed fail the language gate.</span>
          </div>
        </Card>
      </Section>

      <Section title="Sources" description="Where the agent looks. Applications go through whichever site hosts the posting.">
        <Card className="space-y-5">
          <ul className="divide-y divide-outline-variant/60">
            {SOURCES.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5 text-[0.8125rem]">
                <span className="inline-flex size-8 items-center justify-center rounded-xl bg-surface-2 text-muted-foreground"><Icon name={SOURCE_ICON[s.id] ?? "public"} size={16} /></span>
                <label htmlFor={`source_${s.id}`} className="flex-1"><span className="font-medium">{s.label}</span><span className="block text-[0.6875rem] text-muted-foreground">{s.hint}</span></label>
                <Switch id={`source_${s.id}`} name={`source_${s.id}`} defaultChecked={src(s.id)} />
              </li>
            ))}
          </ul>
          <div className="space-y-1.5">
            <span className="text-[0.75rem] font-medium text-muted-foreground">Company watch list</span>
            {watch.map((w, i) => (
              <div key={i} className="grid grid-cols-[200px_1fr] gap-2">
                <input name="watch_company" defaultValue={w.company} placeholder="Company" className={input} />
                <input name="watch_url" defaultValue={w.careersUrl} placeholder="https://company.com/careers" className={`${input} font-mono`} />
              </div>
            ))}
            <span className="block text-[0.6875rem] text-muted-foreground">The agent checks these career pages (and their Greenhouse, Lever, Ashby, Workday, Workable, SmartRecruiters, BambooHR, Recruitee or Rippling boards) every run.{p.discovered?.length ? ` Discovery has added ${p.discovered.length} more companies to the index; 15 are read each run.` : ""}</span>
          </div>
          <label className="block space-y-1.5">
            <span className="text-[0.75rem] font-medium text-muted-foreground">Schedule</span>
            <select name="schedule" defaultValue={p.schedule} className={`${select} w-full sm:w-64`}>{SCHEDULES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
        </Card>
      </Section>

      <Section title="Agent" description="How the agent runs. Provider and keys live in .env.local, not here.">
        <Card>
          <ul className="divide-y divide-outline-variant/60 text-[0.8125rem]">
            <li className="flex items-center gap-3 py-2.5">
              <Icon name={authOk ? "check_circle" : "error"} size={18} filled className={authOk ? "text-[var(--domain-opportunity)]" : "text-destructive"} />
              <span className="flex-1">
                <span className="font-medium">{PROVIDER === "claude" ? "Claude subscription (Claude Code login)" : "Anthropic API key"}</span>
                <span className="block text-[0.6875rem] text-muted-foreground">
                  {PROVIDER === "claude"
                    ? auth === undefined ? "Uses the account you are logged into with the claude CLI. Could not probe it (claude not on PATH); errors will show on the job if the login is missing." : auth.loggedIn ? `Logged in via ${auth.method ?? "claude.ai"}. Set VERONICA_LLM=api in .env.local to use an API key instead.` : "Not logged in. Run `claude` in a terminal and sign in, then restart the server."
                    : hasKey() ? "Found in the environment. Remove VERONICA_LLM=api to use your Claude login instead." : "Missing. Add ANTHROPIC_API_KEY=… to .env.local and restart the server, or remove VERONICA_LLM=api to use your Claude login."}
                </span>
              </span>
            </li>
            <li className="flex items-center gap-3 py-2.5"><Icon name="smart_toy" size={18} className="text-muted-foreground" /><span className="flex-1"><span className="font-medium">Models</span><span className="block font-mono text-[0.6875rem] text-muted-foreground">{MODEL} for search, scoring, review and prep · {DRAFT_MODEL} for drafting</span></span></li>
            <li className="flex items-center gap-3 py-2.5"><Icon name="web" size={18} className="text-muted-foreground" /><span className="flex-1"><span className="font-medium">Browser</span><span className="block text-[0.6875rem] text-muted-foreground">Applications are filled in a separate Google Chrome window with its own profile (~/.veronica/chrome). Log in to LinkedIn, Seek or an employer portal there once and it stays logged in.</span></span></li>
          </ul>
        </Card>
      </Section>
    </form>
  );
}
