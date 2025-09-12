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
      sql: `SELECT u.user_id, u.app_username, u.leetcode_username,
                   u.easy_solved, u.medium_solved, u.hard_solved, u.total_solved,
                   u.current_streak, u.longest_streak,
                   COUNT(CASE WHEN p.is_solved THEN 1 END) AS solved_count,
                   COUNT(CASE WHEN p.is_starred THEN 1 END) AS starred_count
            FROM users u
            LEFT JOIN user_question_progress p ON p.user_id = u.user_id
            WHERE u.user_id = ?
            GROUP BY u.user_id` ,
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
