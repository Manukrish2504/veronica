"use server";

import { revalidatePath } from "next/cache";
import { agentLog, now, read, timeline, today, write } from "./db";
import { kick } from "./agent/runner";
import { showForm } from "./agent/apply";
import { requireUser } from "./auth";
import type { Application, DB, Draft, Profile, Source, Status, TargetKind } from "./types";
import { SOURCES, excludedReason } from "./types";

function app(db: DB, id: string): Application {
  const a = db.applications.find((x) => x.id === id);
  if (!a) throw new Error(`No application ${id}`);
  return a;
}
function draft(db: DB, id: string): Draft {
  const d = db.drafts.find((x) => x.id === id);
  if (!d) throw new Error(`No draft ${id}`);
  return d;
}
function company(db: DB, a: Application) {
  return db.jobs.find((j) => j.id === a.jobId)?.company ?? "job";
}
function done(wake = false) {
  if (wake) kick();
  revalidatePath("/", "layout");
}

export async function shortlist(id: string) {
  const { id: uid } = await requireUser();
  write(uid, (db) => {
    const a = app(db, id);
    a.status = "shortlisted";
    a.error = undefined;
    timeline(a, "you", "Shortlisted");
    agentLog(db, `Queued CV + cover letter tailoring for ${company(db, a)}`);
  });
  done(true);
}

export async function dismiss(id: string) {
  const { id: uid } = await requireUser();
  write(uid, (db) => {
    const a = app(db, id);
    a.status = "dismissed";
    timeline(a, "you", "Dismissed");
  });
  done();
}

export async function setStatus(id: string, status: Status) {
  const { id: uid } = await requireUser();
  write(uid, (db) => {
    const a = app(db, id);
    a.status = status;
    timeline(a, "you", `Status set to ${status}`);
    if (status === "interview" && !a.prep) agentLog(db, `Building interview prep for ${company(db, a)}`);
  });
  done(status === "interview");
}

export async function addJob(formData: FormData) {
  const { id: uid } = await requireUser();
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;
  const isUrl = /^https?:\/\/\S+$/.test(text);
  let title = "Pasted posting";
  let companyName = "Unknown company";
  if (isUrl) {
    try { companyName = new URL(text).hostname.replace(/^www\./, ""); } catch {}
  } else {
    title = text.split("\n")[0].slice(0, 80);
  }
  write(uid, (db) => {
    const id = `j${Date.now().toString(36)}`;
    db.jobs.push({
      id, source: "manual", sourceLabel: isUrl ? `Manual · ${companyName}` : "Manual", url: isUrl ? text : "", title, company: companyName,
      location: "—", remote: false, language: "English", postedAt: today(), rawText: isUrl ? "" : text, foundAt: now(),
    });
    db.applications.push({ id: `a${id}`, jobId: id, status: "found", notes: "", timeline: [{ at: now(), actor: "you", event: "Added manually" }] });
    agentLog(db, `Queued evaluation for ${isUrl ? text : title}`);
  });
  done(true);
}

export async function saveDraft(id: string, content: string) {
  const { id: uid } = await requireUser();
  write(uid, (db) => {
    const d = draft(db, id);
    if (d.status === "approved") return;
    d.content = content;
    d.status = "edited";
    d.updatedAt = now();
  });
  done();
}

export async function approveDraft(id: string) {
  const { id: uid } = await requireUser();
  write(uid, (db) => {
    const d = draft(db, id);
    d.status = "approved";
    d.version += 1;
    d.updatedAt = now();
    timeline(app(db, d.applicationId), "you", `Approved ${d.kind === "cv" ? "CV" : "cover letter"} v${d.version}`);
  });
  done();
}

export async function requestChanges(id: string, note: string) {
  const { id: uid } = await requireUser();
  write(uid, (db) => {
    const d = draft(db, id);
    d.status = "drafting";
    d.userNote = note;
    d.updatedAt = now();
    const a = app(db, d.applicationId);
    a.status = "drafting";
    a.error = undefined;
    timeline(a, "you", `Requested changes to ${d.kind === "cv" ? "CV" : "cover letter"}: ${note}`);
    agentLog(db, `Redrafting ${d.kind} for ${company(db, a)}: "${note}"`);
  });
  done(true);
}

export async function rejectDraft(id: string) {
  const { id: uid } = await requireUser();
  write(uid, (db) => {
    const d = draft(db, id);
    d.status = "rejected";
    d.updatedAt = now();
    timeline(app(db, d.applicationId), "you", `Rejected ${d.kind === "cv" ? "CV" : "cover letter"} draft`);
  });
  done();
}

export async function startApply(id: string) {
  const { id: uid } = await requireUser();
  write(uid, (db) => {
    const a = app(db, id);
    const url = db.jobs.find((j) => j.id === a.jobId)?.url ?? "";
    a.status = "applying";
    a.error = undefined;
    a.submission = { method: "assisted", url, step: "filling", updatedAt: now() };
    timeline(a, "you", "Approved application. The agent is filling the form");
    agentLog(db, `Opening ${url} and filling the application form for ${company(db, a)}`);
  });
  done(true);
}

/** Bring the browser tab with the filled form to the front. */
export async function openForm(id: string) {
  const { id: uid } = await requireUser();
  const db = read(uid);
  const a = app(db, id);
  await showForm(uid, id, a.submission?.url || db.jobs.find((j) => j.id === a.jobId)?.url || "");
}

export async function markSubmitted(id: string, note?: string) {
  const { id: uid } = await requireUser();
  write(uid, (db) => {
    const a = app(db, id);
    a.status = "applied";
    a.appliedAt = now();
    a.followUpAt = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    if (a.submission) { a.submission.step = "submitted"; a.submission.updatedAt = now(); if (note) a.submission.note = note; }
    timeline(a, "you", note ? `Marked as applied (${note})` : "Submitted the application");
  });
  done();
}

export async function reportProblem(id: string, note: string) {
  const { id: uid } = await requireUser();
  write(uid, (db) => {
    const a = app(db, id);
    a.error = undefined;
    if (a.submission) { a.submission.step = "filling"; a.submission.note = note; a.submission.updatedAt = now(); }
    timeline(a, "you", `Flagged a problem with the filled form: ${note}`);
    agentLog(db, `Retrying form for ${company(db, a)}: "${note}"`);
  });
  done(true);
}

/** Pull an excluded or dismissed posting back into the inbox. */
export async function include(id: string) {
  const { id: uid } = await requireUser();
  write(uid, (db) => {
    const a = app(db, id);
    const why = a.fit ? excludedReason(a.fit) : undefined;
    a.included = true;
    a.status = "found";
    timeline(a, "you", why ? `Included despite: ${why}` : "Moved back to the inbox");
  });
  done();
}

/** Clear the last agent failure so the runner picks the application up again. */
export async function retry(id: string) {
  const { id: uid } = await requireUser();
  write(uid, (db) => {
    const a = app(db, id);
    a.error = undefined;
    if (a.status === "applying" && a.submission?.step === "failed") { a.submission.step = "filling"; a.submission.updatedAt = now(); }
    timeline(a, "you", "Asked the agent to retry");
  });
  done(true);
}

export async function addNote(id: string, formData: FormData) {
  const { id: uid } = await requireUser();
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return;
  write(uid, (db) => {
    const a = app(db, id);
    a.notes = a.notes ? `${a.notes}\n\n${note}` : note;
    timeline(a, "you", "Added a note");
  });
  done();
}

export async function setFollowUp(id: string, formData: FormData) {
  const { id: uid } = await requireUser();
  const date = String(formData.get("date") ?? "");
  write(uid, (db) => {
    const a = app(db, id);
    a.followUpAt = date || undefined;
    timeline(a, "you", date ? `Follow-up set for ${date}` : "Follow-up cleared");
  });
  done();
}

export async function saveProfile(formData: FormData) {
  const { id: uid } = await requireUser();
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const list = (k: string) => str(k).split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  const all = (k: string) => formData.getAll(k).map(String);
  const pdfText = async (key: string): Promise<Profile["masterCv"] | undefined> => {
    const file = formData.get(key);
    if (!(file instanceof File) || file.size === 0) return undefined;
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    return { fileName: file.name, text: text.replace(/[ \t]+\n/g, "\n").trim(), uploadedAt: now() };
  };
  const uploaded = await pdfText("masterCvFile");
  const uploadedLinkedin = await pdfText("linkedinFile");
  write(uid, (db) => {
    const pasted = str("masterCvText");
    const prev = db.profile.masterCv;
    const pastedLi = str("linkedinText");
    const prevLi = db.profile.linkedinProfile;
    db.profile = {
      ...db.profile,
      name: str("name"),
      email: str("email"),
      phone: str("phone"),
      linkedin: str("linkedin"),
      website: str("website"),
      workRights: str("workRights"),
      availability: str("availability"),
      notes: str("notes"),
      targets: all("target_kind").map((kind, i) => ({
        kind: kind as TargetKind,
        roles: (all("target_roles")[i] ?? "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
        startFrom: all("target_from")[i] ?? "",
        startTo: all("target_to")[i] ?? "",
        note: (all("target_note")[i] ?? "").trim(),
      })).filter((t) => t.roles.length),
      keywords: list("keywords"),
      locations: list("locations"),
      remote: formData.get("remote") === "on",
      salaryFloor: { amount: Number(str("salaryAmount")) || 0, currency: str("salaryCurrency") || "AUD" },
      sectors: list("sectors"),
      dealBreakers: list("dealBreakers"),
      languages: all("lang_name").map((name, i) => ({ name, level: all("lang_level")[i] ?? "" })).filter((l) => l.name),
      sources: SOURCES.map((s) => ({ id: s.id as Source, enabled: formData.get(`source_${s.id}`) === "on" })),
      watchList: all("watch_company").map((c, i) => ({ company: c, careersUrl: all("watch_url")[i] ?? "" })).filter((w) => w.company),
      schedule: (str("schedule") as Profile["schedule"]) || "daily",
      masterCv: uploaded ?? (pasted ? { fileName: prev?.fileName ?? "pasted", text: pasted, uploadedAt: prev?.text === pasted ? prev.uploadedAt : now() } : undefined),
      linkedinProfile: uploadedLinkedin ?? (pastedLi ? { fileName: prevLi?.fileName ?? "pasted", text: pastedLi, uploadedAt: prevLi?.text === pastedLi ? prevLi.uploadedAt : now() } : undefined),
    };
    if (uploaded) agentLog(db, `Master CV replaced with ${uploaded.fileName}`);
    if (uploadedLinkedin) agentLog(db, `LinkedIn profile replaced with ${uploadedLinkedin.fileName}`);
  });
  done();
}

export async function addMock(id: string, formData: FormData) {
  const { id: uid } = await requireUser();
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;
  write(uid, (db) => {
    const a = app(db, id);
    a.prep ??= { research: "", starStories: [], questions: [], mock: [] };
    a.prep.mock.push({ role: "you", text });
    a.error = undefined;
  });
  done(true);
}

export async function runSearchNow() {
  const { id: uid } = await requireUser();
  write(uid, (db) => {
    db.agent.paused = false;
    db.agent.searchRequested = true;
    agentLog(db, "Search requested");
  });
  done(true);
}

export async function togglePause() {
  const { id: uid } = await requireUser();
  write(uid, (db) => {
    db.agent.paused = !db.agent.paused;
    if (db.agent.paused) db.agent.searchRequested = false;
    agentLog(db, db.agent.paused ? "Paused scheduled searches" : "Resumed scheduled searches");
  });
  done(!read(uid).agent.paused);
}
