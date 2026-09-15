import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import { z } from "zod";
import { structured, TRUST } from "./llm";
import { profileBlock } from "./profile";
import { savePdf } from "./pdf";
import { UA } from "./fetch";
import { docsDir } from "../db";
import type { Draft, Job, Profile } from "../types";

declare global {
  var __vxHeaded: Map<string, Promise<BrowserContext>> | undefined;
  var __vxPages: Map<string, Page> | undefined;
}

const PROFILE_ROOT = process.env.VERONICA_BROWSER_DIR ?? path.join(os.homedir(), ".veronica", "chrome");

/** The visible Chrome window the user reviews and submits in, one profile per user so logins (LinkedIn, Seek, Workday…) persist. */
function headed(userId: string): Promise<BrowserContext> {
  const all = (globalThis.__vxHeaded ??= new Map());
  let ctx = all.get(userId);
  if (!ctx) {
    ctx = (async () => {
      const dir = path.join(PROFILE_ROOT, userId);
      mkdirSync(dir, { recursive: true });
      const c = await chromium.launchPersistentContext(dir, { channel: "chrome", headless: false, viewport: null, userAgent: UA, locale: "en-AU", args: ["--disable-blink-features=AutomationControlled"] });
      c.on("close", () => { all.delete(userId); for (const k of pages().keys()) if (k.startsWith(`${userId}:`)) pages().delete(k); });
      return c;
    })();
    all.set(userId, ctx);
  }
  return ctx;
}
const pages = () => (globalThis.__vxPages ??= new Map());

/** Bring the application's browser tab forward (reopen the URL if the tab is gone). */
export async function showForm(userId: string, appId: string, url: string) {
  const ctx = await headed(userId);
  const key = `${userId}:${appId}`;
  let page = pages().get(key);
  if (!page || page.isClosed()) { page = await ctx.newPage(); pages().set(key, page); await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {}); }
  await page.bringToFront();
}

interface El { i: number; type: string; name: string; label: string; ctx: string; placeholder: string; value: string; text: string; options?: string[]; required: boolean; checked: boolean }
interface Snap { url: string; title: string; text: string; elements: El[] }

// Runs inside the page: tag every visible control with data-vx and describe it.
// Kept as source text and invoked as an IIFE: page.evaluate() only calls real functions, and bundlers may rewrite one.
export const SNAPSHOT = `() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const labelOf = (el) => {
    let t = "";
    if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l) t = l.innerText; }
    if (!t) t = el.getAttribute("aria-label") || "";
    const by = el.getAttribute("aria-labelledby"); if (!t && by) t = by.split(" ").map((id) => document.getElementById(id)?.innerText || "").join(" ");
    if (!t) { const l = el.closest("label"); if (l) t = l.innerText; }
    if (!t) { const p = el.closest("div,fieldset,li,tr,section"); if (p) t = (p.innerText || "").split("\\n").find((s) => s.trim()) || ""; }
    return (t || "").replace(/\\s+/g, " ").trim().slice(0, 160);
  };
  const ctxOf = (el, label) => {
    let n = el.parentElement;
    for (let k = 0; k < 5 && n; k++, n = n.parentElement) {
      const head = n.querySelector("legend, label, h1, h2, h3, h4, [class*=label]");
      const first = ((head && head.innerText) || (n.innerText || "").split("\\n").find((s) => s.trim()) || "").trim();
      if (first && first !== label && first.length < 120) return first;
    }
    return "";
  };
  const out = []; let i = 0;
  document.querySelectorAll("[data-vx]").forEach((e) => e.removeAttribute("data-vx"));
  for (const el of document.querySelectorAll('input,select,textarea,button,a[role="button"],[role="button"],[role="combobox"],[contenteditable="true"],a[href]')) {
    const type = el.tagName === "INPUT" ? (el.type || "text") : el.tagName === "A" ? "link" : el.tagName.toLowerCase();
    if (type === "hidden") continue;
    if (type === "file") { /* file inputs are often hidden on purpose */ } else if (!vis(el)) continue;
    if (type === "link" && !/apply|submit|continue|next|start|login|sign/i.test(el.innerText || "")) continue;
    el.setAttribute("data-vx", String(i));
    const label = labelOf(el);
    out.push({ i, type, name: el.name || el.getAttribute("data-automation-id") || "", label, ctx: ctxOf(el, label), placeholder: el.placeholder || "", value: type === "password" ? "" : String(el.value || "").slice(0, 80), text: (el.innerText || el.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim().slice(0, 80), options: el.tagName === "SELECT" ? Array.from(el.options).map((o) => o.text.trim()).slice(0, 60) : undefined, required: !!el.required || el.getAttribute("aria-required") === "true", checked: !!el.checked });
    i++;
    if (i > 250) break;
  }
  return { url: location.href, title: document.title, text: (document.body.innerText || "").slice(0, 7000), elements: out };
}`;

const Plan = z.object({
  status: z.enum(["fill", "blocked", "done"]).describe("fill: perform actions then continue; blocked: a login, account creation, CAPTCHA or something only the candidate can do stands in the way; done: every field the form shows is filled and only the final submit remains"),
  note: z.string().describe("One or two lines for the candidate: what you filled, what they must check or do themselves"),
  actions: z.array(z.object({
    el: z.number(),
    do: z.enum(["fill", "select", "check", "upload", "click"]),
    value: z.string().nullable().describe("Text to type or option to choose; null for check/upload/click"),
    file: z.enum(["cv", "cover"]).nullable().describe("For upload: which approved document"),
  })),
  next: z.number().nullable().describe("Element to click after the actions to reveal the form or go to the next step (Apply, Continue, Next). Never a final Submit/Send application button."),
  answers: z.array(z.object({ question: z.string(), answer: z.string() })).describe("Free-text answers you wrote into the form, so the candidate can review them"),
});

const APPLY_RULES = `You drive a job application form on behalf of the candidate, one page at a time. You see the page text and its controls (numbered elements). Fill everything you can truthfully from the profile and the approved documents:
- Names, email, phone, LinkedIn, website, location, work rights, availability, salary expectations (use the floor or "negotiable"), education, experience.
- Resume/CV upload → upload cv. Cover letter upload → upload cover. If the form wants the cover letter as text, paste the approved cover letter.
- Free-text questions ("why us", "tell us about a project", character-limited pitches): write grounded answers in the candidate's voice using only facts from the master CV, the LinkedIn profile and the approved documents; respect stated limits; no cliches, no em-dashes. Put every such answer in answers.
- Yes/no and consent boxes: answer truthfully from the profile; tick privacy consents needed to apply; do not tick marketing opt-ins.
- Demographic or diversity questions: choose "prefer not to say" when offered, otherwise leave blank.
- Custom dropdowns: use select with the option text; for a radio group, check the specific option element.
- If the page is a job description with an Apply button, set next to that button and no actions. If it is a multi-step form, fill this step and set next to the Continue/Next button. When the remaining button is the final submit, set status done and next null.
- Never click Submit, Send, or anything that would send the application. Never create accounts, never enter passwords, never solve CAPTCHAs: report blocked with what the candidate has to do, and the browser stays open for them.
${TRUST}`;

export interface ApplyResult { ok: boolean; note: string; answers: { question: string; answer: string }[]; error?: string }

/** Fill the posting's application form in the visible browser, stopping before the final submit. */
export async function assistedApply(userId: string, appId: string, job: Job, profile: Profile, drafts: Draft[], userNote: string | undefined, log: (s: string) => void): Promise<ApplyResult> {
  const cvDraft = drafts.find((d) => d.kind === "cv" && d.status === "approved");
  const coverDraft = drafts.find((d) => d.kind === "cover" && d.status === "approved");
  const files = {
    cv: cvDraft ? await savePdf(cvDraft.content, `${appId}-cv-v${cvDraft.version}.pdf`, docsDir(userId)) : undefined,
    cover: coverDraft ? await savePdf(coverDraft.content, `${appId}-cover-v${coverDraft.version}.pdf`, docsDir(userId)) : undefined,
  };
  const ctx = await headed(userId);
  const key = `${userId}:${appId}`;
  let page = pages().get(key);
  if (!page || page.isClosed()) { page = await ctx.newPage(); pages().set(key, page); }
  await page.bringToFront();
  await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(2000);

  const system = `${APPLY_RULES}\n\n${profileBlock(profile)}\n\nAPPROVED CV:\n${cvDraft?.content ?? "(none)"}\n\nAPPROVED COVER LETTER:\n${coverDraft?.content ?? "(none)"}`;
  const answers: { question: string; answer: string }[] = [];
  const notes: string[] = [];
  const seen = new Set<string>();
  for (let step = 0; step < 8; step++) {
    const snap = (await page.evaluate(`(${SNAPSHOT})()`)) as Snap;
    const sig = `${snap.url}|${snap.elements.map((e) => `${e.type}:${e.label}`).join(",")}`;
    if (seen.has(sig)) { notes.push("The page did not change after the last step; please continue from here."); break; }
    seen.add(sig);
    const plan = await structured(Plan, system, `ROLE: ${job.title} at ${job.company}\nSTEP ${step + 1}\n${userNote ? `CANDIDATE'S NOTE FROM THE LAST ATTEMPT: ${userNote}\n` : ""}\nPAGE: ${snap.title} — ${snap.url}\n\nPAGE TEXT:\n${snap.text}\n\nCONTROLS:\n${snap.elements.map((e) => `[${e.i}] ${e.type}${e.required ? "*" : ""} ${e.label ? `label="${e.label}"` : ""}${e.name ? ` name="${e.name}"` : ""}${e.placeholder ? ` placeholder="${e.placeholder}"` : ""}${e.text ? ` text="${e.text}"` : ""}${e.value ? ` value="${e.value}"` : ""}${e.checked ? " checked" : ""}${e.options ? ` options=${JSON.stringify(e.options)}` : ""}`).join("\n")}`, { maxTokens: 6000 });
    log(`Form step ${step + 1} at ${snap.url.slice(0, 80)}: ${plan.actions.length} actions, ${plan.status}`);
    answers.push(...plan.answers);
    if (plan.note) notes.push(plan.note);
    for (const a of plan.actions) {
      const loc = page.locator(`[data-vx="${a.el}"]`).first();
      try {
        if (a.do === "fill") { await loc.click({ timeout: 4000 }).catch(() => {}); await loc.fill(a.value ?? "", { timeout: 6000 }); }
        else if (a.do === "select") {
          const tag = await loc.evaluate((el: Element) => el.tagName).catch(() => "");
          if (tag === "SELECT") await loc.selectOption({ label: a.value ?? "" }, { timeout: 6000 }).catch(() => loc.selectOption(a.value ?? "", { timeout: 6000 }));
          else { await loc.click({ timeout: 4000 }); await page.keyboard.type(a.value ?? "", { delay: 20 }); await page.waitForTimeout(600); await page.keyboard.press("Enter"); }
        }
        else if (a.do === "check") { await loc.check({ timeout: 6000, force: true }).catch(() => loc.click({ timeout: 4000 })); }
        else if (a.do === "click") { await loc.click({ timeout: 6000 }); await page.waitForTimeout(800); }
        else if (a.do === "upload") {
          const file = a.file ? files[a.file] : undefined;
          if (!file) throw new Error(`no approved ${a.file} to upload`);
          const type = await loc.evaluate((el: Element) => (el as HTMLInputElement).type).catch(() => "");
          if (type === "file") await loc.setInputFiles(file, { timeout: 6000 });
          else { const input = page.locator('input[type="file"]').first(); if (await input.count()) await input.setInputFiles(file, { timeout: 6000 }); else { const [chooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 6000 }), loc.click()]); await chooser.setFiles(file); } }
          await page.waitForTimeout(1500);
        }
      } catch (e) {
        notes.push(`Could not ${a.do} [${a.el}] ${a.value ?? a.file ?? ""}: ${(e as Error).message.split("\n")[0]}`);
      }
    }
    if (plan.status === "blocked") return { ok: true, note: `Needs you: ${notes.join(" ")}`.slice(0, 900), answers };
    if (plan.status === "done" || plan.next === null || plan.next === undefined) break;
    await page.locator(`[data-vx="${plan.next}"]`).first().click({ timeout: 8000 });
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await page.waitForTimeout(2500);
  }
  return { ok: true, note: notes.join(" ").slice(0, 900), answers };
}
