import * as DB from "./_lib/db.js";

function getDbCompat() {
  if (typeof (DB as any).getDb === "function") return (DB as any).getDb();
  if (typeof (DB as any).getClient === "function") return (DB as any).getClient();
  if ((DB as any).default && typeof (DB as any).default.getDb === "function") return (DB as any).default.getDb();
  throw new Error("DB module does not export getDb or getClient");
}

function setCors(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET,OPTIONS");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  try {
  const db = getDbCompat();
    const url = new URL(req.url, `http://${req.headers.host}`);
    const verified = url.searchParams.get("verified");
    const q = url.searchParams.get("q");
    const limit = url.searchParams.get("limit");
    const offset = url.searchParams.get("offset");
    const params: any[] = [];
  let sql = `SELECT * FROM users`;
    const where: string[] = [];
    if (verified !== null) {
      if (verified === "true" || verified === "1") {
        where.push("is_verified = 1");
      } else if (verified === "false" || verified === "0") {
        where.push("is_verified = 0");
      }
    }
    if (q && q.trim()) {
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
    console.error("/api/users error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
}
