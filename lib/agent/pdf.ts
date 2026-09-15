import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { headless } from "./fetch";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>").replace(/\[(.+?)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>');

/** The small Markdown subset the drafter emits: headings, paragraphs, bullets, bold, italic, links, rules. */
export function markdownToHtml(md: string): string {
  const out: string[] = [];
  let list = false, para: string[] = [];
  const flush = () => { if (para.length) { out.push(`<p>${para.map(inline).join("<br>")}</p>`); para = []; } };
  const closeList = () => { if (list) { out.push("</ul>"); list = false; } };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const li = line.match(/^\s*[-*•]\s+(.*)$/);
    if (h) { flush(); closeList(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); }
    else if (li) { flush(); if (!list) { out.push("<ul>"); list = true; } out.push(`<li>${inline(li[1])}</li>`); }
    else if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flush(); closeList(); out.push("<hr>"); }
    else if (!line.trim()) { flush(); closeList(); }
    else { closeList(); para.push(line.trim()); }
  }
  flush(); closeList();
  return out.join("\n");
}

const CSS = `@page { size: A4; margin: 16mm 18mm; }
body { font: 10.5pt/1.42 "Helvetica Neue", Helvetica, Arial, sans-serif; color: #111; margin: 0; }
h1 { font-size: 19pt; margin: 0 0 2pt; letter-spacing: -0.01em; text-align: center; }
h1 + p { color: #333; font-size: 9.5pt; margin: 0 0 10pt; text-align: center; }
h2 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #222; padding-bottom: 1.5pt; margin: 11pt 0 4pt; }
p > strong:first-child { font-size: 10.5pt; }
h3 { font-size: 10.5pt; margin: 8pt 0 2pt; }
p { margin: 0 0 6pt; } ul { margin: 0 0 6pt; padding-left: 16pt; } li { margin: 0 0 2pt; }
a { color: #111; text-decoration: none; } hr { border: 0; border-top: 1px solid #ccc; margin: 8pt 0; }`;

export async function renderPdf(markdown: string, title: string): Promise<Buffer> {
  const browser = await headless();
  const page = await browser.newPage();
  try {
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${markdownToHtml(markdown)}</body></html>`, { waitUntil: "load" });
    return await page.pdf({ format: "A4", printBackground: true });
  } finally {
    await page.close();
  }
}

/** Write the PDF to data/documents and return its path (used for uploads during assisted apply). */
export async function savePdf(markdown: string, fileName: string, dir: string): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, fileName);
  writeFileSync(file, await renderPdf(markdown, fileName));
  return file;
}
