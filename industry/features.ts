// 可选模块。它们只对 AI 资讯站有意义，本站两项都关闭。

export const FEATURES = {
  /** 模型榜（/leaderboard）。 */
  leaderboard: false,
  /** Codex 重置监控（/codex-reset）。 */
  codexResetMonitor: false,
} as const;
