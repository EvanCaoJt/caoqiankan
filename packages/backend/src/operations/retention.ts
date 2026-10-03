// Daily housekeeping: expired leases, old run history, files past their life and derived caches.
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.ts";
import { sql } from "../db.ts";
import { pruneFeedbackAudit } from "../audit.ts";

/** Derived caches (proxied images, share cards and posters) are rebuilt on demand; drop ones older than a month. */
async function pruneCache(dir: string, maxAgeMs: number, now: number): Promise<number> {
  let removed = 0;
  const walk = async (d: string): Promise<void> => {
    const entries = await readdir(d, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        await walk(p);
        continue;
      }
      const info = await stat(p).catch(() => null);
      if (info && now - info.mtimeMs > maxAgeMs) {
        await unlink(p).catch(() => {});
        removed += 1;
      }
    }
  };
  await walk(dir);
  return removed;
}

export async function dailyRetention(now = new Date()) {
  const feedbackCutoff = new Date(now.getTime() - config.feedbackRetentionDays * 86400_000);
  const identifierCutoff = new Date(now.getTime() - config.rateLimitIdRetentionDays * 86400_000);
  const feedback = await sql.begin(async (tx) => {
    const removed = await tx<{ id: number; screenshot_key: string | null }[]>`
      DELETE FROM feedback WHERE status IN ('resolved', 'spam') AND completed_at < ${feedbackCutoff}
      RETURNING id, screenshot_key`;
    for (const row of removed) {
      if (row.screenshot_key?.startsWith("local:")) {
        await tx`INSERT INTO feedback_file_deletions (key) VALUES (${row.screenshot_key}) ON CONFLICT DO NOTHING`;
      }
    }
    // Preserve the API's string field, but discard the linkable identifier itself.
    const anonymized = await tx`UPDATE feedback SET source_hash = '' WHERE created_at < ${identifierCutoff} AND source_hash <> ''`;
    const bans = await tx`DELETE FROM feedback_bans WHERE created_at < ${identifierCutoff}`;
    await pruneFeedbackAudit(removed.map((row) => row.id), identifierCutoff, tx);
    return { deletedFeedback: removed.length, clearedRateLimitIds: anonymized.count, deletedFeedbackBans: bans.count };
  });
  let deletedFeedbackScreenshots = 0;
  let pendingFeedbackScreenshots = 0;
  const pending = await sql<{ key: string }[]>`SELECT key FROM feedback_file_deletions ORDER BY created_at`;
  for (const { key } of pending) {
    const [used] = await sql`SELECT 1 FROM feedback WHERE screenshot_key = ${key} LIMIT 1`;
    if (used) continue; // Older versions reused filenames for identical screenshots.
    const name = key.slice("local:".length);
    if (!key.startsWith("local:") || !/^[\w-]+\.(png|jpeg|webp|gif)$/.test(name)) {
      pendingFeedbackScreenshots += 1;
      continue;
    }
    try {
      await unlink(path.join(config.dataDir, "feedback-screenshots", name));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        pendingFeedbackScreenshots += 1;
        continue; // Retry on the next daily run; never lose the file's deletion record.
      }
    }
    await sql`DELETE FROM feedback_file_deletions WHERE key = ${key}`;
    deletedFeedbackScreenshots += 1;
  }
  const sessions = await sql`DELETE FROM admin_sessions WHERE expires_at < ${now}`;
  const leases = await sql`DELETE FROM delivery_leases WHERE expires_at < ${now}`;
  // Scheduled-task history: 30 days (failures 90) is enough for the runs view.
  const runs = await sql`DELETE FROM job_runs WHERE started_at < ${new Date(now.getTime() - 30 * 86400_000)} AND (status IS DISTINCT FROM 'failed' OR started_at < ${new Date(now.getTime() - 90 * 86400_000)})`;
  // Raw files with a bounded life.
  const files = await sql<{ key: string }[]>`DELETE FROM stored_files WHERE expires_at < ${now} RETURNING key`;
  for (const f of files) await unlink(path.join(config.dataDir, f.key)).catch(() => {});
  const monthMs = 30 * 86400_000;
  const prunedCache = (await pruneCache(path.join(config.dataDir, "imgcache"), monthMs, now.getTime())) + (await pruneCache(path.join(config.dataDir, "ogcache"), monthMs, now.getTime()));
  return { ...feedback, deletedFeedbackScreenshots, pendingFeedbackScreenshots, deletedAdminSessions: sessions.count, deletedLeases: leases.count, deletedJobRuns: runs.count, deletedFiles: files.length, prunedCache };
}
