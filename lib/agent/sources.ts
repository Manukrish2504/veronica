import { z } from "zod";
import { decode, extractLinks, fetchPage, get, getJson, htmlToText, renderExtract, renderPage } from "./fetch";
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

export type Ats = { kind: "greenhouse" | "lever" | "ashby" | "workable" | "smartrecruiters" | "bamboohr" | "recruitee" | "rippling"; slug: string } | { kind: "workday"; host: string; tenant: string; site: string };

/** Recognise an ATS board from a URL. */
export function detectAts(url: string): Ats | undefined {
  const m = (re: RegExp) => url.match(re);
  let x: RegExpMatchArray | null;
  if ((x = m(/(?:boards|job-boards)\.greenhouse\.io\/([\w-]+)/))) return { kind: "greenhouse", slug: x[1] };
  if ((x = m(/jobs\.lever\.co\/([\w-]+)/))) return { kind: "lever", slug: x[1] };
  if ((x = m(/jobs\.ashbyhq\.com\/([\w-]+)/))) return { kind: "ashby", slug: x[1] };
  if ((x = m(/https?:\/\/(([\w-]+)\.wd\d+\.myworkdayjobs\.com)\/(?:[a-z]{2}-[A-Z]{2}\/)?([\w-]+)/))) return { kind: "workday", host: x[1], tenant: x[2], site: x[3] };
  if ((x = m(/apply\.workable\.com\/([\w-]+)/) ?? m(/https?:\/\/([\w-]+)\.workable\.com/))) return { kind: "workable", slug: x[1] };
  if ((x = m(/(?:jobs|careers)\.smartrecruiters\.com\/([\w-]+)/))) return { kind: "smartrecruiters", slug: x[1] };
  if ((x = m(/https?:\/\/([\w-]+)\.bamboohr\.com\/careers/))) return { kind: "bamboohr", slug: x[1] };
  if ((x = m(/https?:\/\/([\w-]+)\.recruitee\.com/))) return { kind: "recruitee", slug: x[1] };
  if ((x = m(/ats\.rippling\.com\/([\w-]+)/))) return { kind: "rippling", slug: x[1] };
  return undefined;
}

export function atsBoard(ats: Ats, company: string, searchText: string): Promise<Candidate[]> {
  switch (ats.kind) {
    case "greenhouse": return greenhouse(ats.slug, company);
    case "lever": return lever(ats.slug, company);
    case "ashby": return ashby(ats.slug, company);
    case "workday": return workday(ats.host, ats.tenant, ats.site, company, searchText);
    case "workable": return workable(ats.slug, company);
    case "smartrecruiters": return smartrecruiters(ats.slug, company);
    case "bamboohr": return bamboohr(ats.slug, company);
    case "recruitee": return recruitee(ats.slug, company);
    case "rippling": return rippling(ats.slug, company);
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

const SWEEPS = [
  "the big aggregators: Indeed, Glassdoor, CareerOne, Jobs.com.au, Adzuna, Jora, Workforce Australia",
  "student and graduate boards: GradConnection, Prosple, GradAustralia, university career hubs, the Australian Computer Society and industry association boards",
  "applicant tracking boards on any company's site: boards.greenhouse.io and job-boards.greenhouse.io, jobs.lever.co, jobs.ashbyhq.com, myworkdayjobs.com, apply.workable.com, jobs.smartrecruiters.com, bamboohr.com/careers, recruitee.com, ats.rippling.com, teamtailor, jobvite, icims, taleo, successfactors",
  "large employers and Fortune 500 companies with offices in the candidate's area, on their own careers sites: consultancies, banks, telcos, retailers, tech companies, government agencies",
  "startups and scale-ups: Wellfound (AngelList), Y Combinator's Work at a Startup, Startmate, venture-portfolio job boards (Blackbird, Square Peg, AirTree, Cut Through Venture), Hatch, and startup career pages",
];

/** Five targeted Claude web-search sweeps, three at a time. */
export async function webSearch(profile: Profile): Promise<Candidate[]> {
  const out: Candidate[] = [];
  let i = 0;
  await Promise.all(Array.from({ length: 3 }, async () => { while (i < SWEEPS.length) { const s = SWEEPS[i++]; try { out.push(...(await webSweep(profile, s))); } catch {} } }));
  const seen = new Set<string>();
  return out.filter((c) => { const k = c.url.split("?")[0]; if (seen.has(k)) return false; seen.add(k); return true; });
}

async function webSweep(profile: Profile, family: string): Promise<Candidate[]> {
  const where = [...profile.locations, ...(profile.remote ? ["remote within Australia"] : [])].join(" or ");
  const { postings } = await structured(
    WebPostings,
    `You find current job postings for a candidate. ${TRUST} Use web search. Only return postings whose URL you actually saw in search results and that point at one specific job (never a search or listing page). This sweep covers ${family}. Skip LinkedIn and Seek (covered elsewhere). Posted within the last 14 days where the result shows a date.`,
    `Looking for (only these kinds of jobs):\n${targetsText(profile)}\nKeywords: ${profile.keywords.join(", ")}\nLocation: ${where}\n\nReturn up to 15 postings.`,
    { webSearches: 6, near: profile.locations[0]?.split(",")[0], maxTokens: 3000 },
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

// ---------- GradConnection (server-rendered listings by kind, field and city) ----------

const GC_FIELDS = ["computer-science", "engineering-software", "data-science-and-analytics", "information-technology"];

export function parseGradconnection(html: string, kind: string, city: string): Candidate[] {
  const out: Candidate[] = [];
  const re = /class="box-header-title"[^>]*title="View ([^"]+)"[^>]*href="([^"]+)"[\s\S]*?class="box-header-para">([^<]*)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const url = new URL(decode(m[2]), "https://au.gradconnection.com").toString();
    out.push({ source: "gradconnection", sourceLabel: "GradConnection", url, title: decode(m[1]).trim(), company: decode(m[3]).trim() || "Unknown", location: city, snippet: kind, detail: async () => { const pg = await fetchPage(url); return pg.text.length > 300 ? pg.text : undefined; } });
  }
  return out;
}

export async function gradconnection(profile: Profile): Promise<Candidate[]> {
  const kinds = new Set(profile.targets.map((t) => (t.kind === "internship" ? "internships" : "graduate-jobs")));
  const cities = profile.locations.map((l) => l.split(",")[0].trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean);
  const out: Candidate[] = [];
  for (const kind of kinds) for (const city of cities) for (const field of GC_FIELDS) {
    const r = await get(`https://au.gradconnection.com/${kind}/${field}/${city}/`);
    if (!r.ok) continue;
    out.push(...parseGradconnection(await r.text(), kind, city.replace(/-/g, " ")));
  }
  return out;
}

// ---------- Jora (rendered search page) ----------

export async function jora(query: string, where: string): Promise<Candidate[]> {
  const p = new URLSearchParams({ q: query, l: where, sp: "search", st: "date" });
  const pg = await renderPage(`https://au.jora.com/j?${p}`);
  const out: Candidate[] = [];
  for (const chunk of pg.html.split(/class="job-card/).slice(1)) {
    const link = chunk.match(/<a[^>]*class="[^"]*job-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const url = new URL(decode(link[1]).split("?")[0], "https://au.jora.com").toString();
    const company = clean(chunk.match(/class="[^"]*job-company[^"]*"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "");
    const location = clean(chunk.match(/class="[^"]*job-location[^"]*"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "");
    out.push({ source: "jora", sourceLabel: "Jora", url, title: clean(link[2]), company: company || "Unknown", location: location || where, detail: async () => { const j = await renderPage(url); return j.text.length > 300 ? j.text : undefined; } });
  }
  return out;
}

// ---------- Employment Hero Jobs (results render client-side) ----------

const EH_CARDS = `() => Array.from(document.querySelectorAll('a[href*="/jobs/position/"]')).map((a) => ({ href: a.href, lines: (a.innerText || "").split("\\n").map((s) => s.trim()).filter(Boolean) }))`;

export async function employmentHero(query: string, where: string): Promise<Candidate[]> {
  const p = new URLSearchParams({ query, location: where });
  const cards = await renderExtract<{ href: string; lines: string[] }[]>(`https://employmenthero.com/jobs/?${p}`, EH_CARDS, 4500);
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const c of cards) {
    const url = c.href.split("?")[0];
    if (seen.has(url) || c.lines.length < 2) continue;
    seen.add(url);
    out.push({ source: "employmenthero", sourceLabel: "Employment Hero", url, title: c.lines[0], company: c.lines[1] ?? "Unknown", location: c.lines[2] ?? where, snippet: c.lines.slice(3).join(" · "), detail: async () => { const pg = await fetchPage(url); return pg.ld?.description ?? (pg.text.length > 300 ? pg.text : undefined); } });
  }
  return out;
}

// ---------- Remotive (remote software roles) ----------

export async function remotive(query: string): Promise<Candidate[]> {
  const j = await getJson<{ jobs: { title: string; company_name: string; url: string; candidate_required_location?: string; publication_date?: string; description?: string }[] }>(`https://remotive.com/api/remote-jobs?category=software-dev&search=${encodeURIComponent(query)}&limit=60`);
  return j.jobs
    .filter((x) => /australia|worldwide|anywhere|apac|oceania|asia/i.test(x.candidate_required_location ?? ""))
    .map((x) => ({ source: "remotive" as const, sourceLabel: "Remotive", url: x.url, title: x.title, company: x.company_name, location: `Remote (${x.candidate_required_location})`, remote: true, postedAt: x.publication_date?.slice(0, 10), text: x.description ? htmlToText(x.description) : undefined }));
}

// ---------- Adzuna (needs free API keys) ----------

export const adzunaConfigured = () => Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);

export async function adzuna(what: string, where: string): Promise<Candidate[]> {
  const p = new URLSearchParams({ app_id: process.env.ADZUNA_APP_ID ?? "", app_key: process.env.ADZUNA_APP_KEY ?? "", results_per_page: "30", what, where, max_days_old: "14", sort_by: "date", "content-type": "application/json" });
  const j = await getJson<{ results: { title: string; redirect_url: string; company?: { display_name?: string }; location?: { display_name?: string }; created?: string; description?: string }[] }>(`https://api.adzuna.com/v1/api/jobs/au/search/1?${p}`);
  return j.results.map((x) => ({ source: "adzuna" as const, sourceLabel: "Adzuna", url: x.redirect_url, title: x.title, company: x.company?.display_name ?? "Unknown", location: x.location?.display_name ?? where, postedAt: x.created?.slice(0, 10), snippet: x.description, detail: async () => { const pg = await fetchPage(x.redirect_url); return pg.ld?.description ?? (pg.text.length > 300 ? pg.text : undefined); } }));
}

// ---------- More ATS boards for the company index ----------

export async function workable(slug: string, company: string): Promise<Candidate[]> {
  const r = await get(`https://apply.workable.com/api/v3/accounts/${slug}/jobs`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query: "", location: [], department: [], worktype: [], remote: [] }) });
  if (!r.ok) throw new Error(`${r.status} for workable/${slug}`);
  const j = (await r.json()) as { results?: { title: string; shortcode: string; published?: string; location?: { city?: string; country?: string; workplaceType?: string } }[] };
  return (j.results ?? []).map((x) => ({
    source: "workable" as const, sourceLabel: `Workable · ${company}`, url: `https://apply.workable.com/${slug}/j/${x.shortcode}/`, title: x.title, company, location: [x.location?.city, x.location?.country].filter(Boolean).join(", "), remote: x.location?.workplaceType === "remote", postedAt: x.published?.slice(0, 10),
    detail: async () => { const d = await getJson<{ description?: string; requirements?: string; benefits?: string }>(`https://apply.workable.com/api/v2/accounts/${slug}/jobs/${x.shortcode}`); const t = [d.description, d.requirements, d.benefits].filter(Boolean).map((h) => htmlToText(h!)).join("\n\n"); return t.length > 200 ? `Title: ${x.title}\nCompany: ${company}\n\n${t}` : undefined; },
  }));
}

export async function smartrecruiters(slug: string, company: string): Promise<Candidate[]> {
  const j = await getJson<{ content: { id: string; name: string; releasedDate?: string; location?: { city?: string; region?: string; country?: string; remote?: boolean } }[] }>(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100`);
  return j.content.map((x) => ({
    source: "smartrecruiters" as const, sourceLabel: `SmartRecruiters · ${company}`, url: `https://jobs.smartrecruiters.com/${slug}/${x.id}`, title: x.name, company, location: [x.location?.city, x.location?.region, x.location?.country].filter(Boolean).join(", "), remote: x.location?.remote, postedAt: x.releasedDate?.slice(0, 10),
    detail: async () => { const d = await getJson<{ jobAd?: { sections?: Record<string, { text?: string }> } }>(`https://api.smartrecruiters.com/v1/companies/${slug}/postings/${x.id}`); const t = Object.values(d.jobAd?.sections ?? {}).map((s) => s.text).filter(Boolean).map((h) => htmlToText(h!)).join("\n\n"); return t.length > 200 ? `Title: ${x.name}\nCompany: ${company}\n\n${t}` : undefined; },
  }));
}

export async function bamboohr(slug: string, company: string): Promise<Candidate[]> {
  const j = await getJson<{ result: { id: string | number; jobOpeningName: string; location?: { city?: string; state?: string }; employmentStatusLabel?: string }[] }>(`https://${slug}.bamboohr.com/careers/list`);
  return j.result.map((x) => ({
    source: "bamboohr" as const, sourceLabel: `BambooHR · ${company}`, url: `https://${slug}.bamboohr.com/careers/${x.id}`, title: x.jobOpeningName, company, location: [x.location?.city, x.location?.state].filter(Boolean).join(", "), snippet: x.employmentStatusLabel,
    detail: async () => { const d = await getJson<{ result?: { jobOpening?: { description?: string } } }>(`https://${slug}.bamboohr.com/careers/${x.id}/detail`); const t = d.result?.jobOpening?.description ? htmlToText(d.result.jobOpening.description) : ""; return t.length > 200 ? `Title: ${x.jobOpeningName}\nCompany: ${company}\n\n${t}` : undefined; },
  }));
}

export async function recruitee(slug: string, company: string): Promise<Candidate[]> {
  const j = await getJson<{ offers: { title: string; careers_url: string; location?: string; description?: string; requirements?: string; published_at?: string; status?: string }[] }>(`https://${slug}.recruitee.com/api/offers/`);
  return j.offers.filter((x) => !x.status || x.status === "published").map((x) => ({ source: "recruitee" as const, sourceLabel: `Recruitee · ${company}`, url: x.careers_url, title: x.title, company, location: x.location ?? "", postedAt: x.published_at?.slice(0, 10), text: [x.description, x.requirements].filter(Boolean).map((h) => htmlToText(h!)).join("\n\n") || undefined }));
}

export async function rippling(slug: string, company: string): Promise<Candidate[]> {
  const j = await getJson<{ uuid: string; name: string; url: string; workLocation?: { label?: string } }[]>(`https://api.rippling.com/platform/api/ats/v1/board/${slug}/jobs`);
  return j.map((x) => ({ source: "rippling" as const, sourceLabel: `Rippling · ${company}`, url: x.url, title: x.name, company, location: x.workLocation?.label ?? "", detail: async () => { try { const d = await getJson<{ description?: string }>(`https://api.rippling.com/platform/api/ats/v1/board/${slug}/jobs/${x.uuid}`); if (d.description) return `Title: ${x.name}\nCompany: ${company}\n\n${htmlToText(d.description)}`; } catch {} const pg = await fetchPage(x.url); return pg.text.length > 300 ? pg.text : undefined; } }));
}

// ---------- Company discovery: grow the index every run ----------

const Companies = z.object({ companies: z.array(z.object({ company: z.string(), careersUrl: z.string().describe("The company's own careers page or its ATS board URL"), why: z.string() })) });

export async function discoverCompanies(profile: Profile, known: string[]): Promise<{ company: string; careersUrl: string }[]> {
  const where = [...profile.locations, ...(profile.remote ? ["remote within Australia"] : [])].join(" or ");
  const { companies } = await structured(
    Companies,
    `You build a list of employers worth watching for a candidate. ${TRUST} Use web search. Mix startups, scale-ups, mid-size firms and large or Fortune 500 companies with offices where the candidate is. Only return companies you found evidence are hiring, or regularly hire, for the candidate's targets, and give each one's real careers page or ATS board URL (Greenhouse, Lever, Ashby, Workday, Workable, SmartRecruiters and the like are ideal). Skip companies in the already-known list.`,
    `Looking for:\n${targetsText(profile)}\nKeywords: ${profile.keywords.join(", ")}\nSectors: ${profile.sectors.join(", ") || "any"}\nLocation: ${where}\n\nAlready known (skip): ${known.slice(0, 200).join("; ") || "none"}\n\nReturn up to 25 companies.`,
    { webSearches: 8, near: profile.locations[0]?.split(",")[0], maxTokens: 3000 },
  );
  const seen = new Set(known.map((k) => k.toLowerCase()));
  return companies.filter((c) => /^https?:\/\//.test(c.careersUrl) && !seen.has(c.company.toLowerCase())).map((c) => ({ company: c.company.trim(), careersUrl: c.careersUrl.trim() }));
}
