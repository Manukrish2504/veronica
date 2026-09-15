import { z } from "zod";
import { decode, extractLinks, fetchPage, get, getJson, htmlToText, renderPage } from "./fetch";
import { structured, TRUST } from "./llm";
import { targetRoles, targetsText, type Profile, type Source } from "../types";

/** A posting seen in a search, before it is fetched and scored. */
export interface Candidate {
  source: Source;
  sourceLabel: string;
  url: string;
  title: string;
  company: string;
  location: string;
  postedAt?: string;
  snippet?: string;
  remote?: boolean;
  /** Full posting text when the listing already carried it. */
  text?: string;
  /** Loads the full posting text; undefined means closed or unreadable. */
  detail?: () => Promise<string | undefined>;
}

const clean = (h: string) => htmlToText(h).replace(/\s+/g, " ").trim();

// ---------- LinkedIn (public jobs-guest endpoints, ported from the reference CLI) ----------

const LI_SEARCH = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";
const LI_DETAIL = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting";

export function parseLinkedinCards(html: string): Candidate[] {
  const out: Candidate[] = [];
  for (const chunk of html.split(/data-entity-urn="urn:li:jobPosting:/).slice(1)) {
    const id = chunk.match(/^(\d+)/)?.[1];
    if (!id) continue;
    const title = clean(chunk.match(/class="base-search-card__title"[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? chunk.match(/class="sr-only"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
    if (!title) continue;
    const company = clean(chunk.match(/class="base-search-card__subtitle"[^>]*>([\s\S]*?)<\/h4>/i)?.[1] ?? "") || "Unknown";
    const location = clean(chunk.match(/class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const postedAt = chunk.match(/class="job-search-card__listdate[^"]*"[^>]*datetime="([^"]+)"/i)?.[1];
    const url = `https://www.linkedin.com/jobs/view/${id}`;
    out.push({ source: "linkedin", sourceLabel: "LinkedIn", url, title, company, location, postedAt, detail: () => linkedinDetail(id) });
  }
  return out;
}

export async function linkedinDetail(id: string): Promise<string | undefined> {
  const r = await get(`${LI_DETAIL}/${id}`);
  if (!r.ok) return undefined;
  const html = await r.text();
  const descStart = html.search(/class="(?:show-more-less-html__markup|description__text)/i);
  const top = descStart === -1 ? html : html.slice(0, descStart);
  if (/closed-job__flavor|no longer accepting applications/i.test(top)) return undefined;
  const desc = descStart === -1 ? "" : htmlToText(html.slice(descStart));
  const criteria: string[] = [];
  const re = /class="description__job-criteria-subheader"[^>]*>([\s\S]*?)<\/h3>[\s\S]*?class="description__job-criteria-text[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) criteria.push(`${clean(m[1])}: ${clean(m[2])}`);
  const title = clean(html.match(/class="(?:top-card-layout__title|topcard__title)[^"]*"[^>]*>([\s\S]*?)<\/h[12]>/i)?.[1] ?? "");
  const company = clean(html.match(/class="topcard__org-name-link[^"]*"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
  const location = clean(html.match(/class="topcard__flavor topcard__flavor--bullet"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
  const text = [title && `Title: ${title}`, company && `Company: ${company}`, location && `Location: ${location}`, ...criteria, "", desc].filter((x) => x !== undefined).join("\n").trim();
  return text.length > 200 ? text : undefined;
}

export async function linkedin(keywords: string, location: string, days = 14, remote = false): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (const start of [0, 10]) {
    const p = new URLSearchParams({ keywords, location, f_TPR: `r${days * 86400}`, start: String(start) });
    if (remote) p.set("f_WT", "2");
    const r = await get(`${LI_SEARCH}?${p}`);
    if (!r.ok) break;
    const cards = parseLinkedinCards(await r.text());
    out.push(...cards);
    if (cards.length < 10) break;
  }
  return out;
}

// ---------- Seek (seek.com.au search API; job pages need a browser render) ----------

interface SeekJob { id: string | number; title: string; companyName?: string; advertiser?: { description?: string }; locations?: { label: string }[]; listingDate?: string; salaryLabel?: string; teaser?: string; bulletPoints?: string[]; workTypes?: string[]; workArrangements?: { label?: string }[] }

export async function seek(keywords: string, where: string, days = 14): Promise<Candidate[]> {
  const p = new URLSearchParams({ siteKey: "AU-Main", sourcesystem: "houston", where, keywords, daterange: String(days), pageSize: "22", sortmode: "ListedDate", locale: "en-AU" });
  const j = await getJson<{ data?: SeekJob[] }>(`https://www.seek.com.au/api/jobsearch/v5/search?${p}`);
  return (j.data ?? []).map((d) => {
    const url = `https://www.seek.com.au/job/${d.id}`;
    return {
      source: "seek" as const, sourceLabel: "Seek", url, title: d.title,
      company: d.companyName || d.advertiser?.description || "Unknown",
      location: d.locations?.[0]?.label ?? where, postedAt: d.listingDate?.slice(0, 10),
      snippet: [d.teaser, ...(d.bulletPoints ?? []), d.salaryLabel, ...(d.workTypes ?? [])].filter(Boolean).join(" · "),
      detail: async () => { const pg = await renderPage(url, '[data-automation="jobAdDetails"]'); const t = pg.ld?.description ?? pg.text; return t && t.length > 200 && !/no longer advertised|job has expired/i.test(t.slice(0, 2000)) ? `Title: ${d.title}\nCompany: ${d.companyName ?? ""}\nLocation: ${d.locations?.[0]?.label ?? ""}\n${d.salaryLabel ? `Salary: ${d.salaryLabel}\n` : ""}\n${t}` : undefined; },
    };
  });
}

// ---------- ATS boards ----------

export async function greenhouse(slug: string, company: string): Promise<Candidate[]> {
  const j = await getJson<{ jobs: { title: string; absolute_url: string; location?: { name: string }; first_published?: string; updated_at?: string; content?: string }[] }>(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
  return j.jobs.map((x) => ({ source: "greenhouse" as const, sourceLabel: `Greenhouse · ${company}`, url: x.absolute_url, title: x.title, company, location: x.location?.name ?? "", postedAt: (x.first_published ?? x.updated_at)?.slice(0, 10), text: x.content ? htmlToText(decode(x.content)) : undefined }));
}

export async function lever(slug: string, company: string): Promise<Candidate[]> {
  const j = await getJson<{ text: string; hostedUrl: string; createdAt?: number; categories?: { location?: string; commitment?: string }; descriptionPlain?: string; lists?: { text: string; content: string }[] }[]>(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  return j.map((x) => ({ source: "lever" as const, sourceLabel: `Lever · ${company}`, url: x.hostedUrl, title: x.text, company, location: x.categories?.location ?? "", postedAt: x.createdAt ? new Date(x.createdAt).toISOString().slice(0, 10) : undefined, text: [x.descriptionPlain, ...(x.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`)].filter(Boolean).join("\n\n") || undefined }));
}

export async function ashby(slug: string, company: string): Promise<Candidate[]> {
  const j = await getJson<{ jobs: { title: string; jobUrl: string; location?: string; publishedAt?: string; isRemote?: boolean; descriptionPlain?: string; isListed?: boolean }[] }>(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
  return j.jobs.filter((x) => x.isListed !== false).map((x) => ({ source: "ashby" as const, sourceLabel: `Ashby · ${company}`, url: x.jobUrl, title: x.title, company, location: x.location ?? "", remote: x.isRemote, postedAt: x.publishedAt?.slice(0, 10), text: x.descriptionPlain }));
}

export async function workday(host: string, tenant: string, site: string, company: string, searchText: string): Promise<Candidate[]> {
  const base = `https://${host}/wday/cxs/${tenant}/${site}`;
  const j = await getJson<{ jobPostings?: { title: string; externalPath: string; locationsText?: string; postedOn?: string }[] }>(`${base}/jobs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText }) });
  return (j.jobPostings ?? []).map((x) => ({
    source: "workday" as const, sourceLabel: `Workday · ${company}`, url: `https://${host}/${site}${x.externalPath}`, title: x.title, company, location: x.locationsText ?? "", snippet: x.postedOn,
    detail: async () => { const d = await getJson<{ jobPostingInfo?: { jobDescription?: string; location?: string; startDate?: string } }>(`${base}${x.externalPath}`); const t = d.jobPostingInfo?.jobDescription; return t ? `Title: ${x.title}\nCompany: ${company}\nLocation: ${d.jobPostingInfo?.location ?? x.locationsText ?? ""}\nPosted: ${d.jobPostingInfo?.startDate ?? ""}\n\n${htmlToText(t)}` : undefined; },
  }));
}

export type Ats = { kind: "greenhouse" | "lever" | "ashby"; slug: string } | { kind: "workday"; host: string; tenant: string; site: string };

/** Recognise an ATS board from a URL. */
export function detectAts(url: string): Ats | undefined {
  const m = (re: RegExp) => url.match(re);
  let x: RegExpMatchArray | null;
  if ((x = m(/(?:boards|job-boards)\.greenhouse\.io\/([\w-]+)/))) return { kind: "greenhouse", slug: x[1] };
  if ((x = m(/jobs\.lever\.co\/([\w-]+)/))) return { kind: "lever", slug: x[1] };
  if ((x = m(/jobs\.ashbyhq\.com\/([\w-]+)/))) return { kind: "ashby", slug: x[1] };
  if ((x = m(/https?:\/\/(([\w-]+)\.wd\d+\.myworkdayjobs\.com)\/(?:[a-z]{2}-[A-Z]{2}\/)?([\w-]+)/))) return { kind: "workday", host: x[1], tenant: x[2], site: x[3] };
  return undefined;
}

export function atsBoard(ats: Ats, company: string, searchText: string): Promise<Candidate[]> {
  switch (ats.kind) {
    case "greenhouse": return greenhouse(ats.slug, company);
    case "lever": return lever(ats.slug, company);
    case "ashby": return ashby(ats.slug, company);
    case "workday": return workday(ats.host, ats.tenant, ats.site, company, searchText);
  }
}

const Postings = z.object({ postings: z.array(z.object({ title: z.string(), url: z.string() })) });

/** Postings on a watched company's careers page: its ATS board if it has one, else the links Claude picks out. */
export async function careersPage(entry: { company: string; careersUrl: string }, profile: Profile): Promise<Candidate[]> {
  const searchText = targetRoles(profile)[0] ?? "engineer";
  const direct = detectAts(entry.careersUrl);
  if (direct) return atsBoard(direct, entry.company, searchText);
  const page = await fetchPage(entry.careersUrl);
  const links = extractLinks(page.html, page.url);
  const found = links.map((l) => detectAts(l.href)).find(Boolean);
  if (found) return atsBoard(found, entry.company, searchText);
  const { postings } = await structured(
    Postings,
    `You extract job postings from a company careers page. ${TRUST} Return only links that point at an individual job posting (not category, search or listing pages). Titles verbatim.`,
    `Company: ${entry.company}\nPage: ${page.url}\n\nPAGE TEXT (truncated):\n${page.text.slice(0, 8000)}\n\nLINKS:\n${links.slice(0, 300).map((l) => `${l.text} -> ${l.href}`).join("\n")}`,
    { maxTokens: 3000 },
  );
  return postings.slice(0, 40).map((p) => ({ source: "careers" as const, sourceLabel: `Careers · ${entry.company}`, url: p.url, title: p.title, company: entry.company, location: "", detail: async () => { const pg = await fetchPage(p.url); return pg.ld?.description ?? (pg.text.length > 300 ? pg.text : undefined); } }));
}

// ---------- Web search (Claude's server-side search for boards without an open API) ----------

const WebPostings = z.object({ postings: z.array(z.object({ title: z.string(), company: z.string(), url: z.string(), location: z.string(), site: z.string() })) });

export async function webSearch(profile: Profile): Promise<Candidate[]> {
  const where = [...profile.locations, ...(profile.remote ? ["remote within Australia"] : [])].join(" or ");
  const { postings } = await structured(
    WebPostings,
    `You find current job postings for a candidate. ${TRUST} Use web search. Only return postings whose URL you actually saw in search results and that point at one specific job (never a search or listing page). Prefer Indeed, Glassdoor, GradConnection, Prosple, Jora, employer career sites and ATS boards (Greenhouse, Lever, Ashby, Workday). Skip LinkedIn and Seek (covered elsewhere). Posted within the last 14 days where the result shows a date.`,
    `Looking for (only these kinds of jobs):\n${targetsText(profile)}\nKeywords: ${profile.keywords.join(", ")}\nLocation: ${where}\n\nReturn up to 15 postings.`,
    { webSearches: 8, near: profile.locations[0]?.split(",")[0], maxTokens: 3000 },
  );
  return postings.map((p) => {
    let site = p.site;
    try { site = new URL(p.url).hostname.replace(/^www\./, ""); } catch {}
    return { source: "websearch" as const, sourceLabel: `Web · ${site}`, url: p.url, title: p.title, company: p.company, location: p.location, detail: async () => { const pg = await fetchPage(p.url); return pg.ld?.description ? `${pg.ld.title ?? p.title}\n${pg.ld.company ?? p.company}\n${pg.ld.location ?? ""}\n${pg.ld.deadline ? `Closes: ${pg.ld.deadline}\n` : ""}\n${pg.ld.description}` : pg.text.length > 300 ? pg.text : undefined; } };
  });
}

/** Cheap local pre-filter so big ATS boards don't flood triage. */
export function titleMatches(title: string, profile: Profile): boolean {
  const t = title.toLowerCase();
  if (/\b(senior|staff|principal|lead|head of|director|manager|vp|chief|architect)\b/.test(t)) return false;
  const terms = new Set<string>();
  for (const s of [...targetRoles(profile), ...profile.keywords]) for (const w of s.toLowerCase().split(/[^a-z0-9+#]+/)) if (w.length > 2 && !STOP.has(w)) terms.add(w);
  return [...terms].some((w) => t.includes(w));
}
/** Cheap location pre-filter for boards that list every office worldwide. */
export function locationMatches(location: string | undefined, profile: Profile): boolean {
  if (!location) return true;
  const l = location.toLowerCase();
  if (/remote|anywhere/.test(l)) return true;
  const terms = profile.locations.flatMap((loc) => loc.split(",").map((x) => x.trim().toLowerCase())).flatMap((x) => [x, COUNTRY_NAME[x] ?? x]);
  return terms.some((t) => t.length > 1 && l.includes(t));
}
const COUNTRY_NAME: Record<string, string> = { au: "australia", us: "united states", gb: "united kingdom", uk: "united kingdom", nz: "new zealand", in: "india", ca: "canada", de: "germany", sg: "singapore" };
const STOP = new Set(["and", "the", "for", "with", "junior", "graduate", "intern", "internship", "entry", "level"]);
