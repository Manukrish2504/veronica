import { get } from "./fetch";

export interface RepoBrief {
  url: string;
  owner: string;
  repo: string;
  description: string;
  homepage: string;
  topics: string[];
  languages: string[];
  stars: number;
  createdAt: string;
  firstCommit?: string;
  lastCommit?: string;
  commits?: number;
  contributors: { login: string; contributions: number }[];
  readme: string;
}

const GH = /https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:[/#?)\s]|$)/g;

/** Unique GitHub repository URLs mentioned in a text. */
export function repoUrls(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(GH)) if (!/^(orgs|topics|features|about|pricing|login|explore)$/.test(m[1])) out.add(`https://github.com/${m[1]}/${m[2].replace(/\.git$/, "")}`);
  return [...out];
}

const headers = () => ({ Accept: "application/vnd.github+json", ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) });
async function api<T>(path: string): Promise<T | undefined> {
  const r = await get(`https://api.github.com${path}`, { headers: headers() });
  return r.ok ? ((await r.json()) as T) : undefined;
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const month = (iso?: string) => { if (!iso) return undefined; const d = new Date(iso); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

/** Facts about a public repository, from the GitHub API. Returns an error string when it cannot be read. */
export async function repoBrief(url: string): Promise<RepoBrief | { url: string; error: string }> {
  const m = url.match(/github\.com\/([\w.-]+)\/([\w.-]+)/);
  if (!m) return { url, error: "not a repository URL" };
  const [owner, repo] = [m[1], m[2].replace(/\.git$/, "")];
  const base = `/repos/${owner}/${repo}`;
  const info = await api<{ description?: string; homepage?: string; topics?: string[]; stargazers_count?: number; created_at: string; pushed_at?: string; private?: boolean }>(base);
  if (!info) return { url, error: "repository not found or not public" };
  const [langs, contributors, readmeRes, latest] = await Promise.all([
    api<Record<string, number>>(`${base}/languages`),
    api<{ login: string; contributions: number }[]>(`${base}/contributors?per_page=10`),
    get(`https://api.github.com${base}/readme`, { headers: { ...headers(), Accept: "application/vnd.github.raw+json" } }),
    get(`https://api.github.com${base}/commits?per_page=1`, { headers: headers() }),
  ]);
  let lastCommit: string | undefined, firstCommit: string | undefined, commits: number | undefined;
  if (latest.ok) {
    const [c] = (await latest.json()) as { commit: { committer?: { date?: string }; author?: { date?: string } } }[];
    lastCommit = c?.commit.committer?.date ?? c?.commit.author?.date;
    const last = latest.headers.get("link")?.match(/[?&]page=(\d+)>; rel="last"/)?.[1];
    commits = last ? Number(last) : 1;
    const first = last ? await api<{ commit: { committer?: { date?: string }; author?: { date?: string } } }[]>(`${base}/commits?per_page=1&page=${last}`) : undefined;
    firstCommit = first?.[0]?.commit.committer?.date ?? first?.[0]?.commit.author?.date ?? (last ? undefined : lastCommit);
  }
  const readme = readmeRes.ok ? (await readmeRes.text()).replace(/<[^>]+>/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 6000) : "";
  return {
    url: `https://github.com/${owner}/${repo}`, owner, repo,
    description: info.description ?? "", homepage: info.homepage ?? "", topics: info.topics ?? [],
    languages: Object.entries(langs ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k),
    stars: info.stargazers_count ?? 0, createdAt: info.created_at, firstCommit, lastCommit, commits,
    contributors: (contributors ?? []).map((c) => ({ login: c.login, contributions: c.contributions })),
    readme,
  };
}

/** The brief as prompt text. */
export function briefText(b: RepoBrief | { url: string; error: string }, githubLogin?: string): string {
  if ("error" in b) return `${b.url}: could not be read (${b.error}). Do not invent anything about it; leave it out or keep the master CV's wording.`;
  const mine = githubLogin ? b.contributors.find((c) => c.login.toLowerCase() === githubLogin.toLowerCase()) : undefined;
  const total = b.contributors.reduce((s, c) => s + c.contributions, 0);
  return [
    `${b.url} (${b.owner}/${b.repo})`,
    `Description: ${b.description || "(none)"}${b.homepage ? ` · Site: ${b.homepage}` : ""}`,
    `Stack (by code volume): ${b.languages.join(", ") || "unknown"}${b.topics.length ? ` · Topics: ${b.topics.join(", ")}` : ""}`,
    `Dates: ${month(b.firstCommit ?? b.createdAt)} – ${month(b.lastCommit)} (first to most recent commit${b.commits ? `, ${b.commits} commits` : ""})`,
    `Contributors: ${b.contributors.map((c) => `${c.login} (${c.contributions})`).join(", ") || "unknown"}${mine ? ` · the candidate (${mine.login}) made ${mine.contributions} of ${total} commits` : githubLogin ? ` · the candidate's login ${githubLogin} is NOT among the contributors: describe it as a project they worked on only if the master CV or notes say so` : ""}`,
    b.stars ? `Stars: ${b.stars}` : "",
    b.readme ? `README (truncated):\n${b.readme}` : "README: none",
  ].filter(Boolean).join("\n");
}

/** Briefs for every repository URL in the given texts plus the profile's project list. */
export async function repoFacts(texts: string[], githubLogin?: string): Promise<string> {
  const urls = repoUrls(texts.join("\n"));
  if (!urls.length) return "";
  const briefs = await Promise.all(urls.slice(0, 8).map((u) => repoBrief(u).catch((e: Error) => ({ url: u, error: e.message }))));
  return `GITHUB PROJECTS (fetched from the GitHub API; a valid source for project entries: what it does, the stack, and dates from first to most recent commit. Claim personal contribution only where the contributors list or the master CV supports it):\n\n${briefs.map((b) => briefText(b, githubLogin)).join("\n\n")}`;
}
