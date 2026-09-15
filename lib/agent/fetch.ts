import { chromium, type Browser } from "playwright-core";

export const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
export const HEADERS = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-AU,en;q=0.9",
};

/** fetch with browser headers, a 20s timeout and backoff on 429/5xx. */
export async function get(url: string, init: RequestInit = {}): Promise<Response> {
  let delay = 600;
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { redirect: "follow", ...init, headers: { ...HEADERS, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20_000) });
    if ((r.status === 429 || r.status >= 500) && attempt < 3) {
      await new Promise((res) => setTimeout(res, delay + Math.random() * 400));
      delay = Math.min(delay * 2, 6000);
      continue;
    }
    return r;
  }
}

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await get(url, { ...init, headers: { Accept: "application/json", ...(init?.headers ?? {}) } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
  return (await r.json()) as T;
}

export function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

/** Readable text from HTML: drops scripts/styles/chrome, keeps line breaks at block ends. */
export function htmlToText(html: string): string {
  return decode(
    html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<(script|style|noscript|svg|iframe|head|nav|footer)[\s\S]*?<\/\1>/gi, "\n")
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|ul|ol|div|h\d|tr|section|article|header|dd|dt|blockquote|pre)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractLinks(html: string, base: string): { text: string; href: string }[] {
  const out: { text: string; href: string }[] = [];
  const re = /<a\b[^>]*href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 600) {
    try {
      const href = new URL(decode(m[1]), base).toString();
      const text = htmlToText(m[2]).replace(/\s+/g, " ").trim();
      if (/^https?:/.test(href) && text) out.push({ text: text.slice(0, 120), href });
    } catch {}
  }
  return out;
}

export interface JobLd { title?: string; company?: string; location?: string; remote?: boolean; postedAt?: string; deadline?: string; description?: string; employmentType?: string }

/** schema.org JobPosting from a page's JSON-LD, if any. */
export function jobPostingLd(html: string): JobLd | undefined {
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let data: unknown;
    try { data = JSON.parse(decode(m[1]).replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, "")); } catch { continue; }
    const nodes: unknown[] = [];
    const walk = (x: unknown) => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object") { nodes.push(x); const g = (x as { "@graph"?: unknown })["@graph"]; if (g) walk(g); } };
    walk(data);
    const jp = nodes.find((n) => String((n as { "@type"?: unknown })["@type"] ?? "").includes("JobPosting")) as Record<string, unknown> | undefined;
    if (!jp) continue;
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    const org = jp.hiringOrganization as { name?: string } | undefined;
    const locs = ([] as unknown[]).concat(jp.jobLocation ?? []) as { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string | { name?: string } } }[];
    const location = locs.map((l) => [l.address?.addressLocality, l.address?.addressRegion, typeof l.address?.addressCountry === "object" ? l.address?.addressCountry?.name : l.address?.addressCountry].filter(Boolean).join(", ")).filter(Boolean).join(" / ") || undefined;
    return {
      title: str(jp.title), company: org?.name, location,
      remote: str(jp.jobLocationType) === "TELECOMMUTE" || undefined,
      postedAt: str(jp.datePosted)?.slice(0, 10), deadline: str(jp.validThrough)?.slice(0, 10),
      description: str(jp.description) ? htmlToText(str(jp.description)!) : undefined,
      employmentType: Array.isArray(jp.employmentType) ? jp.employmentType.join(", ") : str(jp.employmentType),
    };
  }
  return undefined;
}

export interface Page { url: string; html: string; text: string; ld?: JobLd }

function looksRendered(text: string) {
  return text.length > 600 && !/enable javascript|just a moment|verify you are human|access denied|are you a robot/i.test(text.slice(0, 3000));
}

const LI_VIEW = /linkedin\.com\/jobs\/view\/(?:.*-)?(\d{6,})/;

/** Fetch a page as readable text; falls back to a headless Chrome render when the plain fetch is blocked or JS-only. */
export async function fetchPage(url: string, opts: { render?: boolean } = {}): Promise<Page> {
  const li = url.match(LI_VIEW);
  if (li) url = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${li[1]}`;
  if (!opts.render) {
    try {
      const r = await get(url);
      if (r.ok) {
        const html = await r.text();
        const text = htmlToText(html);
        if (looksRendered(text)) return { url: r.url || url, html, text, ld: jobPostingLd(html) };
      }
    } catch {}
  }
  return renderPage(url);
}

declare global { var __vxHeadless: Promise<Browser> | undefined }

/** Shared headless Chrome (the installed Google Chrome, via Playwright). */
export function headless(): Promise<Browser> {
  globalThis.__vxHeadless ??= chromium.launch({ channel: "chrome", headless: true }).then((b) => { b.on("disconnected", () => { globalThis.__vxHeadless = undefined; }); return b; });
  return globalThis.__vxHeadless;
}

export async function renderPage(url: string, selector?: string): Promise<Page> {
  const browser = await headless();
  const page = await browser.newPage({ userAgent: UA, locale: "en-AU" });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(1500);
    const html = await page.content();
    // Prefer the main content block over the whole body so nav and footer chrome stay out of the prompt.
    const text = (await page.evaluate((sel) => {
      const main = (sel && document.querySelector(sel)) || document.querySelector("main, article, [role=main]");
      const t = main instanceof HTMLElement ? main.innerText : "";
      return t.length > 500 ? t : document.body?.innerText ?? "";
    }, selector ?? "")).replace(/\n{3,}/g, "\n\n").trim();
    return { url: page.url(), html, text: text || htmlToText(html), ld: jobPostingLd(html) };
  } finally {
    await page.close();
  }
}
