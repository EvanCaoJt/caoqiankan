// 曹前看投研的分类体系：类别、标签词表、公司（主体）名录，以及防止张冠李戴的身份词典。
// 类别的 key 会出现在网址里（/all?category=…），上线后就不要再改；标签和名录可以随时增减。

/**
 * 网页上的类别（筛选栏、卡片角标、RSS 分类订阅）。key 上线后不要改。
 * 没归上类的资料进入 key 为 industry 的类别所在的节。
 */
export const CATEGORIES = [
  { key: "ai-compute", label: "AI 算力", section: "AI 算力与芯片", guide: "GPU、ASIC/XPU、AI 服务器、HBM 与存储、CoWoS/EMIB/Chiplet 等先进封装、晶圆代工与相关设备材料" },
  { key: "optical-packaging", label: "光互连", section: "光互连与封装材料", guide: "CPO、光模块、硅光、InP 激光器与光芯片、交换机互连、ABF 基板与封装材料" },
  { key: "dc-power", label: "数据中心与电力", section: "数据中心与电力", guide: "AI 数据中心建设与 CapEx、液冷与供配电、燃气轮机、核电与 SMR、储能、电网与变压器、电力需求与电价" },
  { key: "space", label: "商业航天", section: "商业航天", guide: "SpaceX、Starlink、Starship、火箭发射、卫星互联网、卫星制造与航天供应链" },
  { key: "robotics", label: "机器人", section: "机器人与高端制造", guide: "人形机器人、工业机器人、核心零部件、精密测量与检测、机床与高端制造" },
  { key: "quantum", label: "量子计算", section: "量子计算", guide: "量子计算硬件与路线（超导、离子阱、光量子、中性原子）、量子纠错、量子软件与云、量子公司经营与融资" },
  { key: "industry", label: "综合", section: "宏观与综合", guide: "跨领域的政策与出口管制、资本市场与估值、宏观与利率、以及不属于以上方向的科技产业动态" },
] as const;

/**
 * 内容类型。暂时沿用原框架的类型，避免与 prompts/content-understanding.md、selection-score.md 的权重表脱节。
 * 第二轮再按“财报/订单/产能/技术/政策/研究”重设，并同步改这两份提示词。
 */
export const ITEM_TYPES = ["model_release", "product_launch", "tool_or_prompt", "research_paper", "industry_event", "opinion_analysis", "tutorial_explainer"] as const;

// ── 标签词表 ────────────────────────────────────────────────────────────────────────────

/** 每篇资料的第一个标签必须是这些“分类标签”之一。 */
export const CATEGORY_TAGS = [
  "财报/业绩", "订单/客户", "产能/CapEx", "技术/产品", "融资/并购", "政策/监管", "行业研究", "大佬观点", "市场/估值", "论文/研究", "其他",
] as const;

/** 可选的主题标签。 */
export const TOPIC_TAGS = [
  "GPU", "ASIC", "HBM", "先进封装", "Chiplet", "晶圆代工", "半导体设备",
  "CPO", "光模块", "光芯片", "ABF基板",
  "AI数据中心", "液冷", "燃气轮机", "核电", "储能", "电网",
  "卫星互联网", "火箭发射",
  "人形机器人", "精密测量",
  "量子硬件", "量子纠错",
  "出口管制",
] as const;

/** 可选的实体标签（公司、机构）。 */
export const ENTITY_TAGS = ["NVIDIA", "TSMC", "Broadcom", "AMD", "SK hynix", "Micron", "SpaceX", "Tesla", "IBM", "Google"] as const;

/** 模型常写的近义词，统一成词表里的写法。 */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  财报: "财报/业绩", 业绩: "财报/业绩", 指引: "财报/业绩", 业绩预告: "财报/业绩", earnings: "财报/业绩",
  订单: "订单/客户", 客户: "订单/客户", 合作: "订单/客户", 认证: "订单/客户", 中标: "订单/客户",
  产能: "产能/CapEx", 扩产: "产能/CapEx", capex: "产能/CapEx", 资本开支: "产能/CapEx", 投产: "产能/CapEx",
  产品: "技术/产品", 技术: "技术/产品", 发布: "技术/产品", 量产: "技术/产品", 新品: "技术/产品",
  融资: "融资/并购", 收购: "融资/并购", 并购: "融资/并购", 投资: "融资/并购", IPO: "融资/并购", 上市: "融资/并购",
  政策: "政策/监管", 监管: "政策/监管", 法规: "政策/监管", 关税: "政策/监管",
  研报: "行业研究", 分析: "行业研究", 行业动态: "行业研究", 趋势: "行业研究",
  观点: "大佬观点", 访谈: "大佬观点", 估值: "市场/估值", 股价: "市场/估值", 市场: "市场/估值",
  论文: "论文/研究", 研究: "论文/研究", paper: "论文/研究",
  共封装光学: "CPO", 硅光: "光模块", 光通信: "光模块", 封装: "先进封装", CoWoS: "先进封装", EMIB: "先进封装",
  SMR: "核电", 变压器: "电网", 星链: "卫星互联网", Starlink: "卫星互联网", 机器人: "人形机器人",
};

/** 模型漏了分类标签时，按内容类型补一个。 */
export const CATEGORY_BY_ITEM_TYPE: Readonly<Record<string, string>> = {
  model_release: "技术/产品", product_launch: "技术/产品", tool_or_prompt: "其他", research_paper: "论文/研究",
  industry_event: "行业研究", opinion_analysis: "大佬观点", tutorial_explainer: "行业研究",
};

// ── 公司与主体 ──────────────────────────────────────────────────────────────────────────

export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[] }> = {
  nvidia: { name: "NVIDIA 英伟达", displayTag: "NVIDIA", aliases: ["NVIDIA", "英伟达", "Blackwell", "Rubin"] },
  tsmc: { name: "TSMC 台积电", displayTag: "TSMC", aliases: ["TSMC", "台积电", "CoWoS"] },
  broadcom: { name: "Broadcom 博通", displayTag: "Broadcom", aliases: ["Broadcom", "博通"] },
  amd: { name: "AMD", displayTag: "AMD", aliases: ["AMD", "超威"] },
  intel: { name: "Intel 英特尔", displayTag: null, aliases: ["Intel", "英特尔", "EMIB"] },
  marvell: { name: "Marvell 美满", displayTag: null, aliases: ["Marvell", "美满电子"] },
  skhynix: { name: "SK hynix 海力士", displayTag: "SK hynix", aliases: ["SK hynix", "SK海力士", "海力士"] },
  micron: { name: "Micron 美光", displayTag: "Micron", aliases: ["Micron", "美光"] },
  samsung: { name: "Samsung 三星", displayTag: null, aliases: ["Samsung", "三星"] },
  coherent: { name: "Coherent 高意", displayTag: null, aliases: ["Coherent", "高意"] },
  lumentum: { name: "Lumentum", displayTag: null, aliases: ["Lumentum"] },
  innolight: { name: "中际旭创", displayTag: null, aliases: ["中际旭创", "Innolight"] },
  eoptolink: { name: "新易盛", displayTag: null, aliases: ["新易盛", "Eoptolink"] },
  tfc: { name: "天孚通信", displayTag: null, aliases: ["天孚通信", "TFC"] },
  "ge-vernova": { name: "GE Vernova", displayTag: null, aliases: ["GE Vernova", "GE维诺瓦"] },
  "siemens-energy": { name: "Siemens Energy 西门子能源", displayTag: null, aliases: ["Siemens Energy", "西门子能源"] },
  vertiv: { name: "Vertiv 维谛", displayTag: null, aliases: ["Vertiv", "维谛"] },
  spacex: { name: "SpaceX / Starlink", displayTag: "SpaceX", aliases: ["SpaceX", "Starlink", "星链", "Starship"] },
  tesla: { name: "Tesla 特斯拉", displayTag: "Tesla", aliases: ["Tesla", "特斯拉", "Optimus"] },
  ibm: { name: "IBM", displayTag: "IBM", aliases: ["IBM"] },
  google: { name: "Google 谷歌", displayTag: "Google", aliases: ["Google", "谷歌", "TPU", "Willow"] },
  ionq: { name: "IonQ", displayTag: null, aliases: ["IonQ"] },
  "d-wave": { name: "D-Wave", displayTag: null, aliases: ["D-Wave"] },
  rigetti: { name: "Rigetti", displayTag: null, aliases: ["Rigetti"] },
};

/** 身份词典：摘要和标题里出现的公司，必须在原文里也出现过，否则退回原标题、丢掉摘要。 */
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "nvidia", name: "NVIDIA", patterns: [/nvidia|英伟达|\bblackwell\b|\brubin(?:\s+ultra)?\b|\bcuda\b|\bnvlink\b/i] },
  { id: "tsmc", name: "TSMC", patterns: [/\btsmc\b|台积电|\bcowos\b/i] },
  { id: "broadcom", name: "Broadcom", patterns: [/broadcom|博通/i] },
  { id: "amd", name: "AMD", patterns: [/\bAMD\b|\binstinct\s?mi\d+/i] },
  { id: "intel", name: "Intel", patterns: [/\bintel\b|英特尔|\bemib\b/i] },
  { id: "marvell", name: "Marvell", patterns: [/marvell|美满电子/i] },
  { id: "skhynix", name: "SK hynix", patterns: [/sk\s?hynix|海力士/i] },
  { id: "micron", name: "Micron", patterns: [/\bmicron\b|美光/i] },
  { id: "samsung", name: "Samsung", patterns: [/samsung|三星/i] },
  { id: "coherent", name: "Coherent", patterns: [/\bCoherent\b|高意/] },
  { id: "lumentum", name: "Lumentum", patterns: [/lumentum/i] },
  { id: "innolight", name: "中际旭创", patterns: [/中际旭创|innolight/i] },
  { id: "eoptolink", name: "新易盛", patterns: [/新易盛|eoptolink/i] },
  { id: "tfc", name: "天孚通信", patterns: [/天孚通信/] },
  { id: "ge-vernova", name: "GE Vernova", patterns: [/ge\s?vernova/i] },
  { id: "siemens-energy", name: "Siemens Energy", patterns: [/siemens\s?energy|西门子能源/i] },
  { id: "vertiv", name: "Vertiv", patterns: [/vertiv|维谛/i] },
  { id: "spacex", name: "SpaceX / Starlink", patterns: [/spacex|starlink|星链|\bstarship\b|\bfalcon\s?9\b/i] },
  { id: "tesla", name: "Tesla", patterns: [/tesla|特斯拉|\boptimus\b/i] },
  { id: "ibm", name: "IBM", patterns: [/\bIBM\b/] },
  { id: "google", name: "Google", patterns: [/google|谷歌|deepmind|\btpu\b|\bwillow\b/i] },
  { id: "ionq", name: "IonQ", patterns: [/\bionq\b/i] },
  { id: "d-wave", name: "D-Wave", patterns: [/d-wave/i] },
  { id: "rigetti", name: "Rigetti", patterns: [/rigetti/i] },
];

/** 这些域名上的文章，发布方就是对应的公司。 */
export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "nvidia", domains: ["nvidia.com"] },
  { entityId: "tsmc", domains: ["tsmc.com"] },
  { entityId: "broadcom", domains: ["broadcom.com"] },
  { entityId: "amd", domains: ["amd.com"] },
  { entityId: "intel", domains: ["intel.com"] },
  { entityId: "marvell", domains: ["marvell.com"] },
  { entityId: "skhynix", domains: ["skhynix.com"] },
  { entityId: "micron", domains: ["micron.com"] },
  { entityId: "coherent", domains: ["coherent.com"] },
  { entityId: "lumentum", domains: ["lumentum.com"] },
  { entityId: "ge-vernova", domains: ["gevernova.com"] },
  { entityId: "vertiv", domains: ["vertiv.com"] },
  { entityId: "spacex", domains: ["spacex.com", "starlink.com"] },
  { entityId: "tesla", domains: ["tesla.com"] },
  { entityId: "ibm", domains: ["ibm.com"] },
  { entityId: "ionq", domains: ["ionq.com"] },
];

/** 原文里的这些写法也算提到了对应公司。 */
export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [
  { entityId: "spacex", pattern: /@SpaceX\b|@Starlink\b/i },
  { entityId: "nvidia", pattern: /@nvidia\b/i },
];
