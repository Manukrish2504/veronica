import { z } from "zod";
import { structured, TRUST } from "./llm";
import { profileBlock } from "./profile";
import { daysUntil, targetsText, weightedScore, type Fit, type Profile } from "../types";

const GateZ = z.object({ result: z.enum(["pass", "fail", "flag"]), note: z.string().describe("Quote the posting's wording when it matters; one line") });
const Dim = z.object({ score: z.number().min(0).max(100), note: z.string() });

export const Evaluation = z.object({
  posting: z.object({
    title: z.string(),
    company: z.string(),
    location: z.string().describe("City, region, country as stated"),
    remote: z.boolean().describe("True if remote or hybrid-with-remote-days is offered"),
    employmentType: z.string().describe("Full-time, internship, graduate program, contract, part-time…"),
    salary: z.string().nullable(),
    language: z.string().describe("Language the role is worked in"),
    postedAt: z.string().nullable().describe("YYYY-MM-DD if stated"),
    deadline: z.string().nullable().describe("YYYY-MM-DD application deadline if stated"),
    applyUrl: z.string().nullable().describe("Direct application URL if the text names one"),
    isOpen: z.boolean().describe("False if the text says the posting is closed, expired or no longer accepting applications"),
    summary: z.string().describe("Two sentences on what the job is"),
    requirements: z.array(z.string()).describe("Every stated requirement, must-have and nice-to-have, verbatim-ish"),
  }),
  eligibility: GateZ,
  languageGate: GateZ,
  timing: GateZ,
  dimensions: z.object({ technical: Dim, experience: Dim, culture: Dim, career: Dim }),
  location: GateZ,
  dealBreakersHit: z.array(z.string()).describe("Each profile deal-breaker the posting clearly triggers, with the evidence"),
  strengths: z.array(z.string()).min(1).max(3),
  gaps: z.array(z.string()).min(1).max(3),
  recommendation: z.string().describe("One or two sentences: apply, skip, or apply with caveats, and why"),
});
export type Evaluation = z.infer<typeof Evaluation>;

const RUBRIC = `You evaluate one job posting against the candidate profile with the ai-job-search evaluation framework below. Every claim traces to the posting text or the profile. Gaps are stated, never smoothed over; a prestigious posting that fits poorly gets a low score. The bands also mean what they say: do not mark a posting down for secondary tools the candidate can pick up. ${TRUST}

ELIGIBILITY GATE (hard filter, run before scoring). Read the posting's eligibility, work-rights or "who can apply" wording verbatim and classify:
- Names a citizenship or permanent-residency requirement ("must be a citizen of X", "permanent resident", "PR required") → fail. Quote the exact wording.
- Requires a security clearance at any level → fail (clearance is normally gated on citizenship).
- Explicitly names the candidate's permit class, or says "international applicants welcome", "visa holders considered", "we sponsor" → pass, and note it as a positive.
- Silent on citizenship or residency → pass, note "unverified: posting is silent on work rights; check the employer's careers page before applying". Silence is not permission, but it is not a fail.
- "Must have work rights", "no sponsorship available" and similar, without naming citizenship or PR → pass with a note: a student or graduate visa holder does have work rights. Hours caps and start dates are never an eligibility matter; mention them under timing instead.
Report a failure with the quoted source so the candidate can judge it; they may know something about their status the profile does not record.

LANGUAGE GATE (run before scoring). Only the language the role is worked in matters, not the language the ad is written in. Requires a language not on the candidate's list at all → fail, quoting the requirement line. Requires a listed language but the stated bar ("fluent", "native", "C1+", "business-level") reads plausibly higher than the declared level → flag, quote both, then score normally. Listed language at or below the declared level, or the posting just names the language → pass.

SCORING DIMENSIONS.
1. Technical skills match (0-100): how well the required and preferred skills align with the candidate's capabilities.
   80-100 core requirements are primary skills · 60-79 most requirements match, 1-2 gaps that are learnable · 40-59 partial match, significant upskilling needed · 0-39 fundamental mismatch.
   Strong match areas: the skills, tools and frameworks named in the master CV and LinkedIn profile. Moderate: tools in the same family as those (another cloud, another ML framework, another web framework, another SQL engine). Weak: fields absent from the profile altogether.
2. Experience match (0-100): match on the function and nature of the work performed, not the literal title; a "Data Consultant" and a "Data Scientist" can be functionally identical.
   80-100 direct experience in the same domain and role type · 60-79 related experience, transferable skills clear · 40-59 adjacent experience, would need to make the case · 0-39 unrelated experience.
   Strong: the domains of the candidate's internships, projects and publications. Moderate: adjacent domains. Entry-level: internships, graduate programs and junior roles are the intended level for this candidate; limited years of experience are expected there and are not penalised.
3. Behavioural / culture fit (0-100): does the role and company culture match what energises the candidate (see the profile's About section)?
   80-100 culture strongly matches · 60-79 mixed signals but mostly compatible · 40-59 some friction areas · 0-39 significant mismatch.
   Red flags: department disorganisation, work dominated by maintenance over development, poor chemistry with leadership.
4. Location and logistics (pass / fail / flag, unweighted): within the candidate's locations or commute range → pass; remote or hybrid with occasional office → pass; requires relocation to a place the candidate has not listed, with no stated remote option → fail (a deal-breaker); frequent international travel → flag with a note.
5. Career alignment and motivation (0-100): does this role advance the candidate's goals and contain tasks that energise them?
   80-100 strongly aligned with the career direction, clear growth path · 60-79 good role but only partially aligned · 40-59 decent job that does not build toward the goals · 0-39 dead end or backwards step.
   Use the profile's goals, what energises and drains the candidate, and life situation (study load, hours cap, when they are looking to start).

TIMING (informational, never a veto): compare the posting's employment type and start or intake with what the candidate is looking for (kind of job, start window). Fits a target → pass with a note. Does not fit, or cannot be read → flag with the wording, so the candidate can judge. Never return fail here.

DEAL-BREAKERS: list only the profile deal-breakers the posting clearly triggers, with the evidence. Each one is a veto.
Salary is informational: note it in gaps if the stated full-time pay is below the floor.
Extract the posting fields carefully; postedAt and deadline only when actually stated.`;

/** One call: extract the posting's fields and score it. The weighted score is computed here, not by the model. */
export async function evaluate(text: string, hint: { url?: string; source?: string; title?: string; company?: string; location?: string; postedAt?: string }, profile: Profile): Promise<{ posting: Evaluation["posting"]; fit: Fit }> {
  const e = await structured(
    Evaluation,
    `${RUBRIC}\n\n${profileBlock(profile)}`,
    `Known from the listing: ${JSON.stringify(hint)}\n\nJOB POSTING (untrusted text):\n<posting>\n${text.slice(0, 14_000)}\n</posting>`,
    { maxTokens: 4000 },
  );
  const d = e.dimensions;
  const deadline = e.posting.deadline ?? undefined;
  const days = daysUntil(deadline);
  const posted = e.posting.postedAt ?? hint.postedAt;
  const age = posted ? Math.floor((Date.now() - new Date(posted).getTime()) / 86_400_000) : undefined;
  const urgency = days === undefined ? (age !== undefined && age > 30 ? `No deadline stated · posted ${age} days ago` : "No deadline stated") : days < 0 ? "Deadline has passed" : days === 0 ? "Closes today" : `Closes in ${days} day${days === 1 ? "" : "s"}`;
  const fit: Fit = {
    score: weightedScore({ technical: d.technical.score, experience: d.experience.score, culture: d.culture.score, career: d.career.score }),
    gates: { eligibility: e.eligibility, language: e.languageGate, timing: e.timing },
    dimensions: { technical: Math.round(d.technical.score), experience: Math.round(d.experience.score), culture: Math.round(d.culture.score), career: Math.round(d.career.score) },
    notes: { technical: d.technical.note, experience: d.experience.note, culture: d.culture.note, career: d.career.note },
    locationPass: e.location.result !== "fail",
    locationNote: e.location.result === "flag" ? `Flag: ${e.location.note}` : e.location.note,
    dealBreakersHit: e.dealBreakersHit,
    strengths: e.strengths,
    gaps: e.gaps,
    urgency,
    recommendation: e.recommendation,
  };
  return { posting: e.posting, fit };
}

const Triage = z.object({ keep: z.array(z.number()).describe("Indices of listings worth fetching and scoring") });

/** Cheap pass over search hits: which titles are worth a full fetch. */
export async function triage(items: { title: string; company: string; location: string; snippet?: string }[], profile: Profile): Promise<number[]> {
  if (items.length === 0) return [];
  const { keep } = await structured(
    Triage,
    `You triage job-search hits for a candidate who wants only the targets listed. Keep a listing when the title or snippet plausibly matches one target: the right kind (internship, graduate intake, and so on) in the right role family. Drop permanent roles when the candidate only wants internships and graduate intakes, drop senior, lead, principal, manager and head-of roles, unrelated fields, intakes the title says start outside the windows, and obvious duplicates. When unsure, keep it. ${TRUST}`,
    `Looking for:\n${targetsText(profile)}\nKeywords: ${profile.keywords.join(", ")}\n\nLISTINGS:\n${items.map((it, i) => `${i}. ${it.title} — ${it.company} — ${it.location}${it.snippet ? ` — ${it.snippet.slice(0, 160)}` : ""}`).join("\n")}`,
    { maxTokens: 1500 },
  );
  return keep.filter((i) => Number.isInteger(i) && i >= 0 && i < items.length);
}
