import { getDb } from "./_lib/db";

async function ensureSchema() {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS registrations (
      uid TEXT PRIMARY KEY,
      display_name TEXT,
      email TEXT,
      avatar_url TEXT,
      app_username TEXT,
      app_username_lower TEXT UNIQUE,
      leetcode_username TEXT,
      leetcode_username_lower TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export default async function handler(req: any, res: any) {
  const db = getDb();
  await ensureSchema();

  if (req.method === "GET") {
    try {
      const { status, q, limit, offset } = req.query || {};
      const params: any[] = [];
      let sql = `SELECT uid, display_name, email, avatar_url, app_username, leetcode_username, status, created_at, updated_at FROM registrations`;
      const where: string[] = [];
      if (status && typeof status === "string" && ["pending", "verified", "rejected"].includes(status)) {
        where.push(`status = ?`);
        params.push(status);
      }
      if (q && typeof q === "string" && q.trim()) {
        const term = `%${q.trim().toLowerCase()}%`;
        where.push(`(app_username_lower LIKE ? OR leetcode_username_lower LIKE ? OR LOWER(display_name) LIKE ? OR LOWER(email) LIKE ?)`);
        params.push(term, term, term, term);
      }
      if (where.length) sql += ` WHERE ` + where.join(" AND ");
      sql += ` ORDER BY updated_at DESC`;
      const lim = Number(limit) > 0 && Number(limit) <= 500 ? Number(limit) : 200;
      const off = Number(offset) > 0 ? Number(offset) : 0;
      sql += ` LIMIT ? OFFSET ?`;
      params.push(lim, off);
      const result = await db.execute({ sql, args: params });
      res.status(200).json({ ok: true, rows: result.rows ?? [] });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || "Failed to list registrations" });
    }
    return;
  }

  if (req.method === "POST") {
    try {
      const { uid, display_name, email, avatar_url, app_username, leetcode_username, status } = req.body || {};
      if (!uid || !app_username || !leetcode_username) {
        return res.status(400).json({ error: "uid, app_username, and leetcode_username are required" });
      }
      const appLower = String(app_username).trim().toLowerCase();
      const lcLower = String(leetcode_username).trim().toLowerCase();

      // Try insert first; on conflict uid update, on conflict uniques raise error
      try {
        await db.execute({
          sql: `INSERT INTO registrations (uid, display_name, email, avatar_url, app_username, app_username_lower, leetcode_username, leetcode_username_lower, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 'pending'))`,
          args: [uid, display_name ?? null, email ?? null, avatar_url ?? null, app_username, appLower, leetcode_username, lcLower, status ?? null],
        });
      } catch (e: any) {
        // If uid exists, update; if unique collision on app/lc lower, return friendly error
        const msg = String(e?.message || "");
        if (msg.includes("UNIQUE") || msg.toLowerCase().includes("unique")) {
          if (msg.includes("app_username_lower")) {
            return res.status(409).json({ error: "App username already taken. Please choose another." });
          }
          if (msg.includes("leetcode_username_lower")) {
            return res.status(409).json({ error: "LeetCode username already registered. Kindly add your LeetCode username." });
          }
        }
        // Attempt update on same uid
        await db.execute({
          sql: `UPDATE registrations
                SET display_name = COALESCE(?, display_name),
                    email = COALESCE(?, email),
                    avatar_url = COALESCE(?, avatar_url),
                    app_username = ?,
                    app_username_lower = ?,
                    leetcode_username = ?,
                    leetcode_username_lower = ?,
                    status = COALESCE(?, status),
                    updated_at = CURRENT_TIMESTAMP
                WHERE uid = ?`,
          args: [display_name ?? null, email ?? null, avatar_url ?? null, app_username, appLower, leetcode_username, lcLower, status ?? null, uid],
        });
      }

      // Reflect into users table (Turso) so leaderboard/questions have a canonical user.
      // Ensure the user row exists and carries current usernames and verification flag.
      try {
        const isVerified = status === 'verified' ? 1 : 0;
        // Update if exists
        await db.execute({
          sql: `UPDATE users
                SET app_username = ?,
                    leetcode_username = ?,
                    is_verified = ?
                WHERE user_id = ?`,
          args: [app_username, leetcode_username, isVerified, uid],
        });
        // Insert if missing
        await db.execute({
          sql: `INSERT OR IGNORE INTO users (
                  user_id, app_username, leetcode_username, is_verified,
                  easy_solved, medium_solved, hard_solved, total_solved,
                  current_streak, longest_streak
                ) VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0)`,
          args: [uid, app_username, leetcode_username, isVerified],
        });
      } catch (e) {
        // If the users table schema differs, we ignore this reflection to avoid breaking registration flow.
      }

      const row = await db.execute({ sql: `SELECT * FROM registrations WHERE uid = ?`, args: [uid] });
      return res.status(200).json(row.rows?.[0] ?? {});
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Failed to save registration" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
