import { createClient } from "@libsql/client";

// GET /api/user-stats?user_id=... | /api/user-stats?username=...
// Returns per-user counters useful for the app dashboard
export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    return res.status(500).json({ error: "TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set" });
  }

  const user_id = String(req.query?.user_id || "").trim();
  const username = String(req.query?.username || req.query?.app_username || "").trim();
  if (!user_id && !username) {
    return res.status(400).json({ error: "user_id or username is required" });
  }

  const client = createClient({ url, authToken });
  try {
    const where = user_id ? `user_id = ?` : `app_username = ?`;
    const arg = user_id ? user_id : username;
    const q = await client.execute({
      sql: `SELECT 
              user_id,
              app_username AS username,
              is_verified,
              easy_solved,
              medium_solved,
              hard_solved,
              total_solved,
              current_streak,
              longest_streak,
              last_solved_date
            FROM users
            WHERE ${where}
            LIMIT 1`,
      args: [arg],
    });
    const row = (q.rows?.[0] as any) || null;
    if (!row) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(200).json({ ok: true, user: row });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Database error" });
  }
}
