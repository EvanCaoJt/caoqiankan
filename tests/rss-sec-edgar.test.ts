import assert from "node:assert/strict";
import http from "node:http";
import { after, test } from "node:test";
import { config } from "@aihot/backend/config";
import { fetchRss } from "@aihot/backend/sources/rss";
import { unsupportedConfig } from "@aihot/backend/sources/config-keys";

const entry = (id: string, title: string, summary: string) => `<entry><id>${id}</id><title>${title}</title><updated>2026-08-26T20:21:19Z</updated><link href="https://www.sec.gov/Archives/${id}-index.htm"/><summary>${summary}</summary></entry>`;
const pages = {
  "/nvidia": entry("earnings", "8-K - Current report", "Filed: 2026-08-26 AccNo: 0001045810-26-000073 Size: 802 KB Item 2.02: Results of Operations and Financial Condition Item 9.01: Financial Statements and Exhibits") + entry("other", "8-K/A - Current report", "Filed: 2026-09-03 AccNo: 0001045810-26-000078 Size: 146 KB Item 8.01: Other Events"),
  "/tsmc": entry("foreign", "6-K - Report of foreign issuer", "Filed: 2026-09-01 AccNo: 0000950170-26-001234 Size: 100 KB"),
  "/missing": entry("missing", "8-K - Current report", "") + entry("descriptive", "NVIDIA announces quarterly results", "Filed: 2026-08-26 AccNo: 0001045810-26-000073 Item 2.02: Results of Operations and Financial Condition"),
};
const server = http.createServer((req, res) => {
  res.setHeader("content-type", "application/atom+xml");
  res.end(`<feed xmlns="http://www.w3.org/2005/Atom"><title>Filings</title>${pages[req.url as keyof typeof pages]}</feed>`);
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const previousPrivateFetch = config.allowPrivateNetworkFetch;
config.allowPrivateNetworkFetch = true;
after(async () => {
  config.allowPrivateNetworkFetch = previousPrivateFetch;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
async function read(page: string, name: string, adapter?: string) {
  return (await fetchRss({ name, config: { feedUrl: base + page, ...(adapter ? { adapter } : {}) }, participation_mode: "editorial" } as never)).candidates;
}

test("SEC titles distinguish filing dates and items while preserving original identity and summary", async () => {
  const [earnings, other] = await read("/nvidia", "SEC 8-K · NVIDIA", "sec_edgar");
  assert.equal(earnings!.title, "SEC 8-K · NVIDIA · 2026-08-26 · Item 2.02: Results of Operations and Financial Condition · Item 9.01: Financial Statements and Exhibits");
  assert.match(other!.title, /2026-09-03 · Item 8\.01: Other Events/);
  assert.equal(earnings!.url, "https://www.sec.gov/Archives/earnings-index.htm");
  assert.deepEqual(earnings!.raw, { id: "earnings" });
  assert.equal(earnings!.publishedAt?.toISOString(), "2026-08-26T20:21:19.000Z");
  assert.match(earnings!.excerpt!, /AccNo: 0001045810-26-000073/);
  assert.equal(earnings!.bodyStatus, "pending", "metadata does not pretend to be the filing body");
});
test("foreign issuer filings without items keep their form and accession number", async () => {
  const [item] = await read("/tsmc", "SEC 6-K · TSMC", "sec_edgar");
  assert.equal(item!.title, "SEC 6-K · TSMC · 2026-09-01 · 6-K - Report of foreign issuer · 0000950170-26-001234");
});
test("missing filing metadata and already descriptive titles are not invented or rewritten", async () => {
  const items = await read("/missing", "SEC 8-K · NVIDIA", "sec_edgar");
  assert.equal(items[0]!.title, "8-K - Current report");
  assert.equal(items[1]!.title, "NVIDIA announces quarterly results");
});
test("ordinary RSS parsing stays unchanged and adapters are validated by source kind", async () => {
  const [item] = await read("/nvidia", "SEC 8-K · NVIDIA");
  assert.equal(item!.title, "8-K - Current report");
  assert.deepEqual(unsupportedConfig("rss", { feedUrl: base, adapter: "sec_edgar" }), []);
  assert.deepEqual(unsupportedConfig("web_list", { url: base, adapter: "mimo_home" }), []);
  assert.deepEqual(unsupportedConfig("rss", { feedUrl: base, adapter: "mimo_home" }), ["adapter=mimo_home"]);
  assert.deepEqual(unsupportedConfig("web_list", { url: base, adapter: "sec_edgar" }), ["adapter=sec_edgar"]);
});
