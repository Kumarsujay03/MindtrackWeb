import { getDb } from "../../_lib/db";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ ok: false, error: "Method Not Allowed" });
    return;
  }
  try {
    const { user_id } = req.query || {};
    if (!user_id || typeof user_id !== "string") {
      res.status(400).json({ ok: false, error: "Missing user_id" });
      return;
    }
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT user_id, leetcode_username, app_username, is_verified,
                   easy_solved, medium_solved, hard_solved, total_solved,
                   current_streak, longest_streak, last_solved_date
            FROM users WHERE user_id = ? LIMIT 1`,
      args: [user_id],
    });
    if (!result.rows || result.rows.length === 0) {
      res.status(404).json({ ok: false, error: "User not found" });
      return;
    }
    res.status(200).json({ ok: true, data: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message ?? "Internal error" });
  }
}
