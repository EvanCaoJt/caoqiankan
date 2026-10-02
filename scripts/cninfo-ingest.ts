// 巨潮资讯 A 股公告 → 本站外部推送接口（docs/sources.md「外部推送接口」）。
// 用法：
//   node --env-file=.env scripts/cninfo-ingest.ts --dry-run   # 只打印，不推送
//   node --env-file=.env scripts/cninfo-ingest.ts             # 推送
// 环境变量：INGEST_TOKEN（必填，≥16 位）、INGEST_BASE（默认 http://localhost:3000）。
// 名单在 industry/cninfo-watchlist.json；已推送的公告 ID 记在 .data/cninfo-state.json。
// 建议每 15–30 分钟跑一次（cron）。首次推送后，到后台把信源 cninfo-ashare 的参与方式改成 editorial、分级改成 T1。

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

type Stock = { code: string; name: string; orgId: string };
type Announcement = {
  secCode: string;
  secName: string;
  orgId: string;
  announcementId: string;
  announcementTitle: string;
  announcementTime: number;
  adjunctUrl: string;
};
type Item = { title: string; url: string; publishedAt: string; author: string; raw: Record<string, unknown> };

const ROOT = resolve(import.meta.dirname, "..");
const WATCHLIST = resolve(ROOT, "industry/cninfo-watchlist.json");
const STATE = resolve(ROOT, ".data/cninfo-state.json");
const SOURCE_ID = "cninfo-ashare";
const SOURCE_NAME = "巨潮资讯 · A 股公告";
const PAGE_SIZE = 30;
const KEEP_SEEN = 5000;
const DRY_RUN = process.argv.includes("--dry-run");
// 首次运行（还没有状态文件）只记录现有公告、不推送，避免一次性导入几百条旧公告；加 --backfill 可强制推送。
const BACKFILL = process.argv.includes("--backfill");

// 例行、程序性公告：对投资判断几乎没有新信息，直接不推。其余交给评分模型判断。
const DENY = new RegExp(
  [
    "英文版", "摘要", "更正", "补充公告", "修订稿", "取消", "延期",
    "法律意见书", "核查意见", "鉴证报告", "审计报告", "保荐", "持续督导", "独立董事", "监事会", "专项说明", "自查报告",
    "会议决议", "股东大会", "股东会", "会议通知", "提示性公告", "章程", "制度", "议事规则", "工作细则",
    "质押", "解除质押", "冻结", "担保", "理财", "闲置募集资金", "募集资金存放", "可转债付息", "转股价格", "转股结果",
    "权益分派", "回购.*(进展|结果)", "限售股", "上市流通", "减持.*(进展|结果|期限届满)", "股份变动",
    "激励计划", "激励对象", "授信", "现金管理", "会计师事务所", "资金占用", "转债", "跟踪评级", "持有比例", "风险提示",
    "业绩说明会", "接待日", "提质增效", "回购", "前十名", "流动资金", "受托管理", "权益变动", "资产减值", "财务资助",
    "港股公告", "审计机构", "会计政策", "多元化政策", "董事会授权", "会议日期", "异常波动",
    "翌日披露", "月报表", "H股公告", "证券变动", "授予登记", "归属", "注销", "工商变更",
  ].join("|"),
);

function loadJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
}

function column(code: string): string {
  return code.startsWith("6") ? "sse" : "szse";
}

async function fetchAnnouncements(s: Stock): Promise<Announcement[]> {
  const body = new URLSearchParams({
    stock: `${s.code},${s.orgId}`, tabName: "fulltext", pageSize: String(PAGE_SIZE), pageNum: "1",
    column: column(s.code), category: "", plate: "", seDate: "", searchkey: "", secid: "", sortName: "", sortType: "", isHLtitle: "true",
  });
  const res = await fetch("https://www.cninfo.com.cn/new/hisAnnouncement/query", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "User-Agent": "Mozilla/5.0 (compatible; CaoQianKanBot)" },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`cninfo ${s.code} HTTP ${res.status}`);
  const data = (await res.json()) as { announcements: Announcement[] | null };
  return data.announcements ?? [];
}

function toItem(a: Announcement, s: Stock): Item {
  const title = a.announcementTitle.replace(/<[^>]+>/g, "").trim();
  const clean = title.startsWith("关于") ? title : title.replace(/^[^\s，、：]{2,24}?股份有限公司/, "");
  return {
    title: `${a.secName || s.name}（${s.code}）：${clean}`,
    // PDF 原文。后端正文抽取只读 HTML；要让模型读到 PDF 正文需配置 Jina（JINA_API_KEY），否则只按标题判断。
    url: `https://static.cninfo.com.cn/${a.adjunctUrl}`,
    publishedAt: new Date(a.announcementTime).toISOString(),
    author: a.secName || s.name,
    raw: { cninfo: { secCode: s.code, announcementId: a.announcementId, orgId: a.orgId } },
  };
}

async function push(items: Item[]): Promise<void> {
  const token = process.env.INGEST_TOKEN ?? "";
  if (token.length < 16) throw new Error("INGEST_TOKEN 未设置或少于 16 位");
  const base = (process.env.INGEST_BASE ?? "http://localhost:3000").replace(/\/$/, "");
  for (let i = 0; i < items.length; i += 50) {
    const batch = items.slice(i, i + 50);
    const res = await fetch(`${base}/api/ingest/items`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId: SOURCE_ID, sourceName: SOURCE_NAME, items: batch }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`ingest HTTP ${res.status}: ${text}`);
    console.log(`pushed ${batch.length}: ${text}`);
    if (i + 50 < items.length) await new Promise((r) => setTimeout(r, 7_000)); // 每分钟最多 10 次
  }
}

async function main(): Promise<void> {
  const { stocks } = loadJson<{ stocks: Stock[] }>(WATCHLIST, { stocks: [] });
  const state = loadJson<{ seen: string[] }>(STATE, { seen: [] });
  const seen = new Set(state.seen);
  const fresh: Item[] = [];
  const newIds: string[] = [];
  let skipped = 0;

  for (const s of stocks) {
    try {
      for (const a of await fetchAnnouncements(s)) {
        if (seen.has(a.announcementId)) continue;
        newIds.push(a.announcementId);
        if (DENY.test(a.announcementTitle)) { skipped += 1; continue; }
        fresh.push(toItem(a, s));
      }
    } catch (error) {
      console.error(String(error));
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }

  console.log(`new ${newIds.length}, routine skipped ${skipped}, to push ${fresh.length}`);
  if (DRY_RUN) {
    for (const it of fresh) console.log(`${it.publishedAt.slice(0, 10)}  ${it.title}`);
    return;
  }
  const firstRun = !existsSync(STATE);
  if (firstRun && !BACKFILL) console.log("首次运行：只记录现有公告，不推送。之后每次运行只推新公告。");
  else if (fresh.length) await push(fresh);
  mkdirSync(dirname(STATE), { recursive: true });
  writeFileSync(STATE, JSON.stringify({ seen: [...newIds, ...state.seen].slice(0, KEEP_SEEN) }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
