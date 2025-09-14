import { createClient } from "@libsql/client";

type Body = {
  user_id: string;
  app_username: string;
  leetcode_username: string;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  let body = "";
  await new Promise<void>((resolve) => {
    req.on("data", (chunk: any) => (body += chunk));
    req.on("end", () => resolve());
  });
  let data: Body;
  try {
    data = JSON.parse(body || "{}");
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const { user_id, app_username, leetcode_username } = data || ({} as Body);
  if (!user_id || !app_username || !leetcode_username) {
    return res.status(400).json({ error: "user_id, app_username and leetcode_username are required" });
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    return res.status(500).json({ error: "TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set" });
  }
  const client = createClient({ url, authToken });

  try {
    // Ensure table exists (idempotent)
    await client.execute(`CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      app_username TEXT UNIQUE NOT NULL,
      leetcode_username TEXT UNIQUE NOT NULL,
      is_verified INTEGER NOT NULL DEFAULT 0,
      easy_solved INTEGER NOT NULL DEFAULT 0,
      medium_solved INTEGER NOT NULL DEFAULT 0,
      hard_solved INTEGER NOT NULL DEFAULT 0,
      total_solved INTEGER NOT NULL DEFAULT 0,
      current_streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      last_solved_date NUMERIC
    )`);

    // Backfill new columns for existing tables if missing
    const pragma = await client.execute(`PRAGMA table_info(users)`);
    const cols = new Set((pragma.rows || []).map((r: any) => (r.name as string)?.toLowerCase()));
    const alters: string[] = [];
    if (!cols.has("current_streak")) alters.push(`ALTER TABLE users ADD COLUMN current_streak INTEGER NOT NULL DEFAULT 0`);
    if (!cols.has("longest_streak")) alters.push(`ALTER TABLE users ADD COLUMN longest_streak INTEGER NOT NULL DEFAULT 0`);
    if (!cols.has("last_solved_date")) alters.push(`ALTER TABLE users ADD COLUMN last_solved_date NUMERIC`);
    for (const sql of alters) {
      try { await client.execute(sql); } catch {}
    }

    // Uniqueness checks
    const conflicts = await client.execute({
      sql: `SELECT 
        SUM(CASE WHEN user_id <> ? AND app_username = ? THEN 1 ELSE 0 END) AS app_conflict,
        SUM(CASE WHEN user_id <> ? AND leetcode_username = ? THEN 1 ELSE 0 END) AS lc_conflict
      FROM users`,
      args: [user_id, app_username, user_id, leetcode_username],
    });
    const row = conflicts.rows[0] as any;
    if (Number(row?.app_conflict || 0) > 0) {
      return res.status(409).json({ error: "app_username already in use" });
    }
    if (Number(row?.lc_conflict || 0) > 0) {
      return res.status(409).json({ error: "leetcode_username already in use" });
    }

    // Upsert and mark verified
    await client.execute({
      sql: `INSERT INTO users (user_id, app_username, leetcode_username, is_verified, easy_solved, medium_solved, hard_solved, total_solved, current_streak, longest_streak)
            VALUES (?, ?, ?, 1, 0, 0, 0, 0, 0, 0)
            ON CONFLICT(user_id) DO UPDATE SET
              app_username = excluded.app_username,
              leetcode_username = excluded.leetcode_username,
              is_verified = 1` ,
      args: [user_id, app_username, leetcode_username],
    });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Database error" });
  }
}
