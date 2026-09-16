export type Source =
  | "linkedin" | "seek" | "jora" | "employmenthero" | "gradconnection" | "remotive" | "adzuna" | "websearch" | "careers" | "discover"
  | "greenhouse" | "lever" | "ashby" | "workday" | "workable" | "smartrecruiters" | "bamboohr" | "recruitee" | "rippling" | "manual";

export type Status =
  | "found" | "shortlisted" | "drafting" | "review" | "applying"
  | "applied" | "interview" | "offer" | "rejected" | "withdrawn" | "dismissed";

export const ACTIVE: Status[] = ["shortlisted", "drafting", "review", "applying", "applied", "interview", "offer"];
export const CLOSED: Status[] = ["rejected", "withdrawn", "dismissed"];

export const STATUS_LABEL: Record<Status, string> = {
  found: "Found", shortlisted: "Shortlisted", drafting: "Drafting", review: "Ready for review",
  applying: "Applying", applied: "Applied", interview: "Interview", offer: "Offer",
  rejected: "Rejected", withdrawn: "Withdrawn", dismissed: "Dismissed",
};

export type Band = "Strong" | "Good" | "Moderate" | "Weak" | "Poor";
export function band(score: number): Band {
  if (score >= 75) return "Strong";
  if (score >= 60) return "Good";
  if (score >= 45) return "Moderate";
  if (score >= 30) return "Weak";
  return "Poor";
}

export const WEIGHTS = { technical: 0.3, experience: 0.25, culture: 0.15, career: 0.3 } as const;
export type Dimension = keyof typeof WEIGHTS;
export const DIMENSION_LABEL: Record<Dimension, string> = {
  technical: "Technical skills", experience: "Experience", culture: "Culture", career: "Career alignment",
};
export function weightedScore(d: Record<Dimension, number>): number {
  return Math.round((Object.keys(WEIGHTS) as Dimension[]).reduce((s, k) => s + WEIGHTS[k] * Math.max(0, Math.min(100, d[k])), 0));
}

export type Gate = "pass" | "fail" | "flag";

export type TargetKind = "internship" | "graduate" | "fulltime" | "parttime";
export const TARGET_LABEL: Record<TargetKind, string> = { internship: "Internship", graduate: "Graduate role or program", fulltime: "Full-time role", parttime: "Part-time role" };
/** One kind of job the candidate wants, and when it should start (YYYY-MM). Postings matching no target are excluded. */
export interface Target { kind: TargetKind; roles: string[]; startFrom: string; startTo: string; note: string }

export interface Job {
  id: string;
  source: Source;
  sourceLabel: string;
  url: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  salary?: string;
  language: string;
  postedAt: string;
  deadline?: string;
  rawText: string;
  foundAt: string;
}

export interface Fit {
  score: number;
  gates: { eligibility: { result: Gate; note: string }; language: { result: Gate; note: string }; timing?: { result: Gate; note: string } };
  dimensions: Record<Dimension, number>;
  notes?: Record<Dimension, string>;
  locationPass: boolean;
  locationNote: string;
  dealBreakersHit: string[];
  strengths: string[];
  gaps: string[];
  urgency: string;
  recommendation?: string;
}

export interface Submission {
  method: "assisted";
  url: string;
  step: "filling" | "your_turn" | "submitted" | "failed";
  note?: string;
  confirmation?: string;
  error?: string;
  answers?: { question: string; answer: string }[];
  updatedAt: string;
}

export interface Prep {
  research: string;
  starStories: { requirement: string; story: string }[];
  questions: string[];
  ask?: string[];
  mock: { role: "agent" | "you"; text: string }[];
}

export interface TimelineEvent { at: string; actor: "agent" | "you"; event: string }

export interface Application {
  id: string;
  jobId: string;
  status: Status;
  fit?: Fit;
  followUpAt?: string;
  appliedAt?: string;
  submission?: Submission;
  prep?: Prep;
  notes: string;
  /** Last agent failure on this application; cleared on success or Retry. */
  error?: string;
  /** The user pulled it back into the inbox despite an exclusion reason. */
  included?: boolean;
  timeline: TimelineEvent[];
}

export type DraftKind = "cv" | "cover";
export type DraftStatus = "drafting" | "ready" | "edited" | "approved" | "rejected";

export interface Change { section: string; before: string; after: string; reason: string }

export interface Draft {
  id: string;
  applicationId: string;
  kind: DraftKind;
  content: string;
  changes: Change[];
  status: DraftStatus;
  userNote?: string;
  version: number;
  updatedAt: string;
}

export const SOURCES: { id: Source; label: string; hint: string }[] = [
  { id: "linkedin", label: "LinkedIn", hint: "Public job search, no login needed" },
  { id: "seek", label: "Seek", hint: "seek.com.au search" },
  { id: "jora", label: "Jora", hint: "au.jora.com aggregator (many employer sites and boards)" },
  { id: "employmenthero", label: "Employment Hero Jobs", hint: "employmenthero.com/jobs, mostly Australian SMEs and startups" },
  { id: "gradconnection", label: "GradConnection", hint: "Graduate programs and internships by field and city" },
  { id: "remotive", label: "Remotive", hint: "Remote software roles open to Australia or worldwide (only when remote is fine)" },
  { id: "adzuna", label: "Adzuna", hint: "Aggregator API; needs ADZUNA_APP_ID and ADZUNA_APP_KEY in .env.local (free at developer.adzuna.com)" },
  { id: "websearch", label: "Web search", hint: "Five Claude web-search sweeps every run: Indeed, Glassdoor, CareerOne and the like; GradConnection and Prosple; every major ATS board; large employers and Fortune 500 with Australian offices; startups and scale-ups" },
  { id: "careers", label: "Company watch list", hint: "Career pages below, read directly through their Greenhouse, Lever, Ashby, Workday, Workable, SmartRecruiters, BambooHR, Recruitee or Rippling boards" },
  { id: "discover", label: "Discover companies", hint: "Each run asks Claude for more companies hiring for your targets and adds their career pages to a growing index that is read on later runs" },
];

export interface Profile {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  website: string;
  /** GitHub login, used to tell the candidate's own commits apart in repository facts. */
  github?: string;
  /** Repository URLs of projects to draw on when drafting. */
  repos?: string[];
  masterCv?: { fileName: string; text: string; uploadedAt: string };
  /** LinkedIn profile export: a second source for skills, certifications, languages and awards (never for roles or employers). */
  linkedinProfile?: { fileName: string; text: string; uploadedAt: string };
  /** Visa / work-rights situation, quoted to the eligibility gate. */
  workRights: string;
  availability: string;
  /** Free text: goals, what energises or drains you, constraints. Feeds culture and career scoring. */
  notes: string;
  targets: Target[];
  keywords: string[];
  locations: string[];
  remote: boolean;
  salaryFloor: { amount: number; currency: string };
  sectors: string[];
  languages: { name: string; level: string }[];
  dealBreakers: string[];
  sources: { id: Source; enabled: boolean }[];
  watchList: { company: string; careersUrl: string }[];
  /** Companies found by the discovery sweep; read round-robin, stalest first. */
  discovered?: { company: string; careersUrl: string; at: string; checkedAt?: string }[];
  schedule: "hourly" | "daily" | "weekly" | "manual";
}

export interface AgentState {
  /** Work lane: evaluating, drafting, filling a form, preparing. */
  now?: { task: string; target: string; startedAt: string; progress?: { done: number; total: number } };
  /** Search lane, which runs alongside the work lane. */
  search?: { startedAt: string; progress?: { done: number; total: number } };
  log: { at: string; text: string }[];
  paused: boolean;
  nextRunAt: string;
  lastRunAt?: string;
  searchRequested?: boolean;
}

export interface DB {
  profile: Profile;
  jobs: Job[];
  applications: Application[];
  drafts: Draft[];
  agent: AgentState;
  /** Company research cache keyed by normalised company name (30-day TTL). */
  research: Record<string, { summary: string; at: string }>;
}

/** Joined view used by every screen. */
export interface AppView extends Application { job: Job; drafts: Draft[] }

export function join(db: DB): AppView[] {
  return db.applications.flatMap((a) => {
    const job = db.jobs.find((j) => j.id === a.jobId);
    return job ? [{ ...a, job, drafts: db.drafts.filter((d) => d.applicationId === a.id) }] : [];
  });
}

/** What the user has to do on this application right now (empty = nothing). */
export function needsYou(a: AppView, today = new Date().toISOString().slice(0, 10)): string[] {
  const out: string[] = [];
  const pending = a.drafts.filter((d) => d.status === "ready" || d.status === "edited").length;
  if (a.status === "review" && pending) out.push(`${pending} draft${pending > 1 ? "s" : ""} to review`);
  if (a.status === "review" && !pending && a.drafts.length && a.drafts.every((d) => d.status === "approved")) out.push("Ready to apply");
  if (a.status === "applying" && a.submission?.step === "your_turn") out.push("Your turn to submit");
  if (a.status === "applying" && a.submission?.step === "failed") out.push("Apply failed");
  if (a.status === "applied" && a.followUpAt && a.followUpAt <= today) out.push("Follow-up due");
  return out;
}

const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
export const targetRoles = (p: Profile) => uniq(p.targets.flatMap((t) => t.roles));
/** Search phrases, one per target kind × role: "AI Engineer intern", "graduate Software Engineer"… */
export function searchQueries(p: Profile): string[] {
  return uniq(p.targets.flatMap((t) => t.roles.map((r) => (t.kind === "internship" ? `${r} intern` : t.kind === "graduate" ? `graduate ${r}` : t.kind === "parttime" ? `${r} part time` : r))));
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const month = (ym: string) => { const [y, m] = ym.split("-").map(Number); return y && m && m >= 1 && m <= 12 ? `${MONTHS[m - 1]} ${y}` : ym || "?"; };
/** The targets as prompt text. */
export function targetsText(p: Profile): string {
  return p.targets.map((t, i) => `${i + 1}. ${TARGET_LABEL[t.kind]}: ${t.roles.join(", ")} — starting ${month(t.startFrom)} to ${month(t.startTo)}${t.note ? ` (${t.note})` : ""}`).join("\n") || "(no targets set)";
}
/** Why a scored posting is vetoed, as in the reference framework: a failed eligibility or language gate, a relocation, or a deal-breaker. Timing only flags. */
export function excludedReason(fit: Fit): string | undefined {
  if (fit.gates.eligibility.result === "fail") return `Not eligible: ${fit.gates.eligibility.note}`;
  if (fit.gates.language.result === "fail") return `Language: ${fit.gates.language.note}`;
  if (!fit.locationPass) return `Location: ${fit.locationNote}`;
  if (fit.dealBreakersHit.length) return `Deal-breaker: ${fit.dealBreakersHit[0]}`;
  return undefined;
}

/** Excluded by the agent and not overridden by the user. */
export const isExcluded = (a: Application) => Boolean(a.fit && !a.included && excludedReason(a.fit));

export function daysUntil(date: string | undefined, today = new Date()): number | undefined {
  if (!date) return undefined;
  return Math.ceil((new Date(date).getTime() - today.getTime()) / 86_400_000);
}

/** Canonical key for a posting URL so the same job found twice dedupes. */
export function normUrl(u: string): string {
  try {
    const x = new URL(u);
    const p = x.pathname.replace(/\/+$/, "");
    const li = p.match(/\/jobs\/view\/(?:.*-)?(\d{6,})/);
    if (li && /linkedin\.com$/.test(x.hostname)) return `linkedin.com/jobs/view/${li[1]}`;
    return `${x.hostname.replace(/^www\./, "").toLowerCase()}${p.toLowerCase()}`;
  } catch {
    return u.trim().toLowerCase();
  }
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const jobKey = (company: string, title: string) => `${slug(company)}::${slug(title)}`;
