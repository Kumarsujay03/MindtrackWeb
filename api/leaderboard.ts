import { createClient } from "@libsql/client";

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
  const client = createClient({ url, authToken });

  try {
    const limit = Math.max(1, Math.min(200, parseInt(String(req.query?.limit ?? "100"), 10) || 100));
    const offset = Math.max(0, parseInt(String(req.query?.offset ?? "0"), 10) || 0);
    const user_id = String(req.query?.user_id || "").trim();

    const countRes = await client.execute({
      sql: `SELECT COUNT(*) AS cnt FROM users WHERE is_verified = 1 AND app_username IS NOT NULL`,
      args: [],
    });
    const total = Number((countRes.rows?.[0] as any)?.cnt || 0);

    const rowsRes = await client.execute({
      sql: `SELECT user_id, app_username AS username, current_streak AS streak, total_solved
            FROM users
            WHERE is_verified = 1 AND app_username IS NOT NULL
            ORDER BY streak DESC, total_solved DESC, username ASC
            LIMIT ? OFFSET ?`,
      args: [limit, offset],
    });

    // Optionally compute the requesting user's rank and info
    let my: any = null;
    if (user_id) {
      const meRes = await client.execute({
        sql: `SELECT user_id, app_username AS username, current_streak AS streak, total_solved, is_verified
              FROM users WHERE user_id = ? LIMIT 1`,
        args: [user_id],
      });
      const me = (meRes.rows?.[0] || null) as any;
      if (me && me.is_verified === 1 && me.username) {
        const rankRes = await client.execute({
          sql: `SELECT COUNT(*) AS higher
                FROM users u
                WHERE u.is_verified = 1 AND u.app_username IS NOT NULL AND (
                  u.current_streak > ? OR
                  (u.current_streak = ? AND u.total_solved > ?) OR
                  (u.current_streak = ? AND u.total_solved = ? AND u.app_username < ?)
                )`,
          args: [me.streak, me.streak, me.total_solved, me.streak, me.total_solved, me.username],
        });
        const higher = Number((rankRes.rows?.[0] as any)?.higher || 0);
        my = { user_id: me.user_id, username: me.username, streak: me.streak, total_solved: me.total_solved, rank: higher + 1 };
      }
    }

    return res.status(200).json({ ok: true, total, limit, offset, rows: rowsRes.rows, my });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Database error" });
  }
}
