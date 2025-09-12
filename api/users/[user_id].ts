import { getDb } from "../_lib/db";

export default async function handler(req: any, res: any) {
  const { user_id } = req.query || {};
  if (!user_id || typeof user_id !== "string") {
    return res.status(400).json({ ok: false, error: "Missing user_id" });
  }
  const db = getDb();
  try {
    if (req.method === "GET") {
      const result = await db.execute({ sql: `SELECT * FROM users WHERE user_id = ?`, args: [user_id] });
      if (!result.rows?.length) return res.status(404).json({ ok: false, error: "Not found" });
      return res.status(200).json({ ok: true, row: result.rows[0] });
    }
    if (req.method === "POST" || req.method === "PATCH") {
      const { is_verified, app_username, leetcode_username, clear_usernames } = req.body || {};
      if (clear_usernames === true) {
        // Explicitly clear usernames and set unverified
        await db.execute({
          sql: `UPDATE users
                SET app_username = NULL,
                    leetcode_username = NULL,
                    is_verified = 0
                WHERE user_id = ?`,
          args: [user_id],
        });
        // Ensure a row exists even if it was missing
        await db.execute({
          sql: `INSERT OR IGNORE INTO users (
                  user_id, app_username, leetcode_username, is_verified,
                  easy_solved, medium_solved, hard_solved, total_solved,
                  current_streak, longest_streak
                ) VALUES (?, NULL, NULL, 0, 0, 0, 0, 0, 0, 0)`,
          args: [user_id],
        });
        return res.status(200).json({ ok: true });
      }

      if (typeof is_verified !== "boolean" && app_username === undefined && leetcode_username === undefined) {
        return res.status(400).json({ ok: false, error: "Provide is_verified or a username to update" });
      }
      const iso = typeof is_verified === "boolean" ? (is_verified ? 1 : 0) : null;
      // Update existing with COALESCE for partial updates
      await db.execute({
        sql: `UPDATE users
              SET app_username = COALESCE(?, app_username),
                  leetcode_username = COALESCE(?, leetcode_username),
                  is_verified = COALESCE(?, is_verified)
              WHERE user_id = ?`,
        args: [app_username ?? null, leetcode_username ?? null, iso, user_id],
      });
      // Insert if missing
      await db.execute({
        sql: `INSERT OR IGNORE INTO users (
                user_id, app_username, leetcode_username, is_verified,
                easy_solved, medium_solved, hard_solved, total_solved,
                current_streak, longest_streak
              ) VALUES (?, ?, ?, COALESCE(?, 0), 0, 0, 0, 0, 0, 0)`,
        args: [user_id, app_username ?? null, leetcode_username ?? null, iso],
      });
      return res.status(200).json({ ok: true });
    }
    res.setHeader("Allow", "GET, POST, PATCH");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
}
