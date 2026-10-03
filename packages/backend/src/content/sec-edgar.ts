// EDGAR feeds link to a filing directory, not to the disclosure itself. Never use the directory as a body.
import { parseHTML } from "linkedom";
import { SITE } from "@aihot/industry/site";
import { guardedFetch, type GuardedResponse } from "../lib/http-fetch.ts";
import { stripTags } from "../lib/text.ts";
import { sanitizeBody } from "./sanitize.ts";
import type { ExtractedBody } from "./extract.ts";

export function isSecFilingIndex(input: string): boolean {
  try {
    const url = new URL(input);
    return url.protocol === "https:" && /^(www\.)?sec\.gov$/i.test(url.hostname)
      && /^\/Archives\/edgar\/data\/\d+\/\d+\/[\d-]+-index\.html?$/i.test(url.pathname);
  } catch { return false; }
}

/** Only HTML disclosures and EX-99 attachments in the same accession directory; ignore viewer wrappers and data files. */
export function secDocuments(html: string, indexUrl: string): Array<{ type: string; url: string }> {
  const index = new URL(indexUrl);
  const directory = index.pathname.slice(0, index.pathname.lastIndexOf("/") + 1);
  const { document } = parseHTML(html);
  const out: Array<{ type: string; url: string }> = [];
  for (const row of document.querySelectorAll('table[summary="Document Format Files"] tr')) {
    const cells = row.querySelectorAll("td");
    const type = cells[3]?.textContent?.trim().toUpperCase() ?? "";
    if (!/^(?:8-K|6-K)(?:\/A)?$|^EX-99(?:\.\d+)?$/.test(type)) continue;
    const href = cells[2]?.querySelector("a")?.getAttribute("href");
    if (!href) continue;
    try {
      let url = new URL(href, index);
      if (url.origin === index.origin && /^\/ix(?:viewer\/doc\/action)?\/?$/i.test(url.pathname) && url.searchParams.has("doc")) {
        url = new URL(url.searchParams.get("doc")!, index);
      }
      if (url.origin !== index.origin || !url.pathname.startsWith(directory) || !/\.html?$/i.test(url.pathname)) continue;
      if (!out.some(x => x.url === url.href)) out.push({ type, url: url.href });
    } catch { /* malformed links are not disclosure material */ }
  }
  const main = out.find(x => /^(8-K|6-K)/.test(x.type));
  return main ? [main, ...out.filter(x => x.type.startsWith("EX-99")).slice(0, 2)] : [];
}

type FetchPage = (url: string) => Promise<GuardedResponse>;
/** A missing/blocked attachment leaves the body unconfirmed; do not fall back to summarizing the directory. */
export async function extractSecFiling(indexUrl: string, fetchPage: FetchPage = url => guardedFetch(url, {
  timeoutMs: 20_000, maxBytes: 6 * 1024 * 1024,
  headers: { "user-agent": `${SITE.crawlerName}/1.0 ${SITE.contactEmail ?? SITE.defaultUrl}`, accept: "text/html" },
})): Promise<ExtractedBody | null> {
  const index = await fetchPage(indexUrl);
  if (index.status !== 200 || !isSecFilingIndex(index.url)) return null;
  const documents = secDocuments(index.text(), index.url);
  if (!documents.length) return null;
  const sections: string[] = [];
  for (const doc of documents) {
    const page = await fetchPage(doc.url);
    // Validate the final destination as well; guardedFetch separately guards every redirect against SSRF.
    if (page.status !== 200 || page.url !== doc.url || !/html/i.test(page.headers.get("content-type") ?? "")) return null;
    const { document } = parseHTML(page.text());
    // Hidden inline-XBRL facts are not human-readable disclosure text.
    for (const el of document.querySelectorAll('script, style, ix\\:header, ix\\:hidden, [hidden], [style*="display:none"], [style*="display: none"]')) el.remove();
    const clean = sanitizeBody(document.body?.innerHTML || document.documentElement.innerHTML, doc.url);
    if (stripTags(clean).length < 200) return null;
    sections.push(`<h2>${doc.type}</h2><p>${doc.url}</p>${clean}`);
  }
  const html = sanitizeBody(`<p>已抓取正式披露文件及最多两份 EX-99 附件。未抓取的其他附件不能据此视为不存在。</p>${sections.join("\n")}`, indexUrl);
  return { html, text: stripTags(html), images: [], via: "sec_edgar" };
}
