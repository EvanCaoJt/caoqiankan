import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { config } from "@aihot/backend/config";
import { sql, closeDb } from "@aihot/backend/db";
import { dailyRetention } from "@aihot/backend/operations/retention";
import { updateFeedback } from "@aihot/backend/admin/feedback";

const T = tag();
const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * 86400_000);
config.dataDir = await mkdtemp(path.join(tmpdir(), "feedback-retention-"));
await mkdir(path.join(config.dataDir, "feedback-screenshots"));
after(closeDb);

async function feedback(status: string, age: number, completed: number | null, shot: string | null = null) {
  const [row] = await sql<{ id: number; updated_at: Date }[]>`
    INSERT INTO feedback (content, email, source_hash, status, created_at, completed_at, screenshot_key)
    VALUES (${T}, 'sender@example.com', ${T}, ${status}, ${daysAgo(age)}, ${completed === null ? null : daysAgo(completed)}, ${shot})
    RETURNING id, updated_at`;
  return row!;
}
const exists = (file: string) => access(file).then(() => true, () => false);

test("completed feedback expires from completion; open feedback and recent completions survive", async () => {
  const shot = `${T}-expired.png`;
  const file = path.join(config.dataDir, "feedback-screenshots", shot);
  await writeFile(file, "test screenshot");
  const expired = await feedback("resolved", 300, 181, `local:${shot}`);
  const spam = await feedback("spam", 200, 181);
  const fresh = await feedback("resolved", 300, 179);
  const unfinished = await feedback("new", 300, null);
  const replied = await feedback("replied", 300, 200);
  await sql`INSERT INTO audit_log (actor, action, subject, "before") VALUES ('test', 'feedback.update', ${`feedback:${expired.id}`}, ${sql.json({ note: "private note" })})`;
  await dailyRetention(now);
  assert.equal((await sql`SELECT id FROM feedback WHERE id IN (${expired.id}, ${spam.id})`).length, 0);
  assert.equal((await sql`SELECT id FROM feedback WHERE id IN (${fresh.id}, ${unfinished.id}, ${replied.id})`).length, 3);
  assert.equal(await exists(file), false);
  assert.equal((await sql`SELECT id FROM audit_log WHERE subject = ${`feedback:${expired.id}`}`).length, 0);
});

test("30-day identifiers and bans expire independently of unfinished feedback", async () => {
  const old = await feedback("triaged", 31, null);
  const fresh = await feedback("new", 29, null);
  await sql`INSERT INTO feedback_bans (source_hash, created_at) VALUES (${`${T}-old`}, ${daysAgo(31)}), (${`${T}-fresh`}, ${daysAgo(29)})`;
  await sql`INSERT INTO audit_log (actor, action, subject, created_at) VALUES ('test', 'feedback.ban', ${`feedback-source:${T}-old`}, ${daysAgo(31)})`;
  await dailyRetention(now);
  const [a] = await sql`SELECT source_hash, content FROM feedback WHERE id = ${old.id}`;
  const [b] = await sql`SELECT source_hash FROM feedback WHERE id = ${fresh.id}`;
  assert.equal(a!.source_hash, "");
  assert.equal(a!.content, T);
  assert.equal(b!.source_hash, T);
  assert.equal((await sql`SELECT 1 FROM feedback_bans WHERE source_hash = ${`${T}-old`}`).length, 0);
  assert.equal((await sql`SELECT 1 FROM feedback_bans WHERE source_hash = ${`${T}-fresh`}`).length, 1);
  assert.equal((await sql`SELECT 1 FROM audit_log WHERE subject = ${`feedback-source:${T}-old`}`).length, 0);
});

test("editing a completed note does not restart retention, reopening clears completion", async () => {
  const row = await feedback("resolved", 300, 181);
  await updateFeedback(row.id, { version: row.updated_at.toISOString(), note: "new note" }, "test");
  const [edited] = await sql`SELECT completed_at, updated_at FROM feedback WHERE id = ${row.id}`;
  assert.equal(edited!.completed_at.toISOString(), daysAgo(181).toISOString());
  await updateFeedback(row.id, { version: edited!.updated_at.toISOString(), status: "triaged" }, "test");
  const [reopened] = await sql`SELECT completed_at, updated_at FROM feedback WHERE id = ${row.id}`;
  assert.equal(reopened!.completed_at, null);
  await dailyRetention(now);
  assert.equal((await sql`SELECT 1 FROM feedback WHERE id = ${row.id}`).length, 1);
  await updateFeedback(row.id, { version: reopened!.updated_at.toISOString(), status: "resolved" }, "test");
  const [completed] = await sql`SELECT completed_at FROM feedback WHERE id = ${row.id}`;
  assert.ok(completed!.completed_at.getTime() >= now.getTime());
});

test("shared old screenshots remain until the last feedback expires; failed deletion is retried", async () => {
  const shot = `${T}-shared.png`;
  const file = path.join(config.dataDir, "feedback-screenshots", shot);
  await writeFile(file, "shared screenshot");
  await feedback("resolved", 300, 181, `local:${shot}`);
  const open = await feedback("new", 300, null, `local:${shot}`);
  await dailyRetention(now);
  assert.equal(await exists(file), true);
  await sql`UPDATE feedback SET status = 'resolved', completed_at = ${daysAgo(181)} WHERE id = ${open.id}`;
  await dailyRetention(now);
  assert.equal(await exists(file), false);

  const retry = `${T}-retry.png`;
  const blocked = path.join(config.dataDir, "feedback-screenshots", retry);
  await mkdir(blocked); // unlink must fail, without depending on OS permissions.
  await feedback("resolved", 300, 181, `local:${retry}`);
  const result = await dailyRetention(now);
  assert.ok(result.pendingFeedbackScreenshots >= 1);
  assert.equal((await sql`SELECT 1 FROM feedback_file_deletions WHERE key = ${`local:${retry}`}`).length, 1);
  const { rmdir } = await import("node:fs/promises");
  await rmdir(blocked);
  await writeFile(blocked, "retry screenshot");
  await dailyRetention(now);
  assert.equal(await exists(blocked), false);
  assert.equal((await sql`SELECT 1 FROM feedback_file_deletions WHERE key = ${`local:${retry}`}`).length, 0);
});

test("expired admin sessions are removed without changing valid sessions", async () => {
  const [user] = await sql`INSERT INTO admin_users (display_name) VALUES (${T}) RETURNING id`;
  await sql`INSERT INTO admin_sessions (id_hash, user_id, csrf_token, expires_at)
    VALUES (${`${T}-expired`}, ${user!.id}, 'test', ${daysAgo(1)}), (${`${T}-valid`}, ${user!.id}, 'test', ${daysAgo(-1)})`;
  await dailyRetention(now);
  assert.equal((await sql`SELECT 1 FROM admin_sessions WHERE id_hash = ${`${T}-expired`}`).length, 0);
  assert.equal((await sql`SELECT 1 FROM admin_sessions WHERE id_hash = ${`${T}-valid`}`).length, 1);
});
