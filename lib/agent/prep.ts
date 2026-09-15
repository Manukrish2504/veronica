import { z } from "zod";
import { structured, TRUST } from "./llm";
import { profileBlock } from "./profile";
import type { Draft, Job, Prep, Profile } from "../types";

const PrepOut = z.object({
  research: z.string().describe("Interview-focused company research, verified facts only with source URLs, up to 200 words"),
  starStories: z.array(z.object({ requirement: z.string(), story: z.string().describe("S/T/A/R in 4-6 sentences, grounded in the master CV or LinkedIn profile; for a gap, an honest bridge answer instead") })).min(3).max(6),
  questions: z.array(z.string()).min(6).max(12).describe("Likely interview questions for this posting, including the hard ones about gaps and consistency with the submitted documents"),
  ask: z.array(z.string()).min(4).max(6).describe("Questions the candidate should ask, none answerable from public info"),
});

export async function buildPrep(job: Job, profile: Profile, drafts: Draft[], cachedResearch: string | undefined): Promise<Omit<Prep, "mock">> {
  const cv = drafts.find((d) => d.kind === "cv")?.content;
  const cover = drafts.find((d) => d.kind === "cover")?.content;
  const out = await structured(
    PrepOut,
    `You prepare a candidate for a real interview. The interviewer has read the submitted CV and cover letter, so every talking point must be consistent with them: no claim in the room that is not on the paper, and every claim on the paper defensible in depth. Gaps get honest bridge answers (acknowledge, connect adjacent experience, show the learning path), never invented experience. ${cachedResearch ? "Start from the cached research and verify what you use." : "Research the company with web search from its name and official site only."} ${TRUST}`,
    `${profileBlock(profile)}\n\nROLE: ${job.title} at ${job.company}\n\nJOB POSTING:\n<posting>\n${job.rawText.slice(0, 10_000)}\n</posting>\n\n${cachedResearch ? `CACHED RESEARCH:\n${cachedResearch}\n\n` : ""}${cv ? `SUBMITTED CV:\n${cv}\n\n` : ""}${cover ? `SUBMITTED COVER LETTER:\n${cover}` : ""}`,
    { webSearches: cachedResearch ? 2 : 5, near: profile.locations[0]?.split(",")[0], maxTokens: 6000 },
  );
  return out;
}

const Mock = z.object({ feedback: z.string().describe("Two or three sentences on the last answer: what worked, what to sharpen, which STAR story fits better; empty if there was no answer yet"), question: z.string().describe("The next interview question") });

/** Next turn of the mock interview: feedback on the last answer plus the next question. */
export async function mockReply(job: Job, profile: Profile, prep: Prep): Promise<string> {
  const transcript = prep.mock.map((m) => `${m.role === "agent" ? "INTERVIEWER" : "CANDIDATE"}: ${m.text}`).join("\n\n");
  const r = await structured(
    Mock,
    `You are running a mock interview for the role below. Warm up first, then role-specific technical questions, then 1-2 behavioural questions tied to the posting's competencies, then one tough question or curveball. Coach toward the candidate's natural voice. Keep feedback brief and specific. ${TRUST}`,
    `${profileBlock(profile)}\n\nROLE: ${job.title} at ${job.company}\nPOSTING SUMMARY:\n${job.rawText.slice(0, 4000)}\n\nPREP PACK STAR STORIES:\n${prep.starStories.map((s) => `- ${s.requirement}: ${s.story}`).join("\n")}\n\nTRANSCRIPT SO FAR:\n${transcript || "(none yet; the candidate asked to start)"}`,
    { maxTokens: 1500 },
  );
  return r.feedback ? `${r.feedback}\n\n${r.question}` : r.question;
}
