// 站点身份和读者看得到的文案。
// 域名不在这里：部署时用环境变量 SITE_URL 设置。

export const SITE = {
  /** 站名：导航、页面标题、分享图、RSS、MCP、后台都用它。 */
  name: "曹前看投研",
  /** 行业词：页面上会变成“科技产业日报”“全部科技产业动态”。 */
  subject: "科技产业",
  /** 首页的完整标题（浏览器标签、搜索结果）。 */
  homeTitle: "曹前看投研 — AI·能源·太空·量子 产业与上市公司每日精选",
  /** 一句话介绍：搜索引擎、分享卡片、RSS、llms.txt 会用。 */
  description: "盯住公司公告、财报、官方技术资料与专业媒体，用模型筛选、归并、写摘要，每天一份科技产业日报：发生了什么、为什么重要、影响哪些上市公司。",
  /** 首页左上角和侧边栏下面的一行小字。 */
  tagline: "从科技变化里，看上市公司机会",
  locale: "zh-CN",
  defaultUrl: "http://localhost:3000",
  /** MCP 工具名前缀。已经有人接入后就不要再改。 */
  mcpPrefix: "caoqiankan",
  contactEmail: "caojiantaocn@163.com" as string | null,
  footerNote: "内容仅供研究参考，不构成投资建议 · 由 AIHOT 开源框架驱动",
  aiNotice: "AI 生成摘要 · 以原文为准",
  riskNotice: "内容由 AI 根据公开资料生成，仅供研究参考，不构成投资建议；请以原文为准。市场有风险，投资需谨慎。",
  reportRiskNotice: "本报告由 AI 根据公开资料生成，仅供研究参考，不构成投资建议。市场有风险，投资需谨慎。",
  icp: null as string | null,
  organization: {
    name: "曹前看投研",
    founder: { name: "Evan老曹", description: "科技财经内容创作者，关注 AI、能源、太空与上市公司研究" } as null | { name: string; url?: string; description?: string },
  },
  /** 抓取信源时报上的名字（User-Agent 里用）。 */
  crawlerName: "CaoQianKanBot",
} as const;

/** 关于页的文案。 */
export const ABOUT = {
  kicker: `关于 ${SITE.name}`,
  headline: ["科技产业每天都有新消息，", "真正影响公司利润的，只有几条。"] as [string, string],
  lead: `${SITE.name} 替你盯着 {sources} 个信源：公司公告、财报、官方技术资料和专业媒体。抓取、归并、打分、精选，每天早上 8 点出一份日报。免费，不用注册。`,
  steps: {
    collect: "公司官网与 IR、SEC 与交易所公告、官方技术博客、专业行业媒体、官方 X 账号和公众号都在看。",
    store: "抓到的都存下来，同一件事的多篇报道归到一起；只计入热度的账号也算在内，热点榜从这里算出来。",
    select: "模型先判断是不是 AI、能源、太空、量子等产业链上的事、有没有实质信息，再写中文标题、摘要和“对投资者意味着什么”；荐股、题材炒作和营销稿进不来。",
    publish: "每天 08:00 出日报，周一出周报，每月 1 日出月报。",
  },
  maker: null as null | {
    name: string;
    greeting: string[];
    avatarSourceId?: string | null;
    wechat?: { title: string; note: string };
    feishu?: { title: string; note: string };
  },
  copyright: `${SITE.name} 是聚合摘要和阅读索引，原文版权归各来源所有；站内内容仅供研究参考，不构成任何投资建议。如果你是来源方，希望更正、下架或调整展示方式，可以通过`,
} as const;

/** “AI 日报”这类说法：行业词和名词之间，英文词加空格，中文词不加。 */
export function withSubject(noun: string): string {
  return /[A-Za-z0-9]$/.test(SITE.subject) ? `${SITE.subject} ${noun}` : `${SITE.subject}${noun}`;
}

/** 行业词接在中文后面时，按需补英文词前的空格。 */
export function subjectAfter(text: string, noun?: string): string {
  const gap = /^[A-Za-z0-9]/.test(SITE.subject) ? " " : "";
  return `${text}${gap}${noun ? withSubject(noun) : SITE.subject}`;
}
