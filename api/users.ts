import { getDb } from "./_lib/db";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  try {
    const db = getDb();
  const { verified, q, limit, offset } = req.query || {};
    const params: any[] = [];
  let sql = `SELECT * FROM users`;
    const where: string[] = [];
    if (typeof verified === "string") {
      if (verified === "true" || verified === "1") {
        where.push("is_verified = 1");
      } else if (verified === "false" || verified === "0") {
        where.push("is_verified = 0");
      }
    }
    if (q && typeof q === "string" && q.trim()) {
      const term = `%${q.trim().toLowerCase()}%`;
      where.push("(LOWER(app_username) LIKE ? OR LOWER(leetcode_username) LIKE ? OR LOWER(user_id) LIKE ?)");
      params.push(term, term, term);
    }
    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY total_solved DESC, longest_streak DESC";
    const lim = Number(limit) > 0 && Number(limit) <= 500 ? Number(limit) : 200;
    const off = Number(offset) > 0 ? Number(offset) : 0;
    sql += " LIMIT ? OFFSET ?";
    params.push(lim, off);
    const result = await db.execute({ sql, args: params });
    return res.status(200).json({ ok: true, rows: result.rows ?? [] });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
}
