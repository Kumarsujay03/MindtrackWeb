import { getDb } from "./_lib/db";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ ok: false, error: "Method Not Allowed" });
    return;
  }
  try {
    const db = getDb();
    const url = new URL(req.url, `http://${req.headers.host}`);
    const limitParam = url.searchParams.get("limit");
    const sort = url.searchParams.get("sort") || "total_solved"; // total_solved | current_streak | longest_streak
    const limit = Math.max(1, Math.min(200, Number(limitParam) || 50));

    let orderBy = "total_solved DESC, current_streak DESC, longest_streak DESC";
    if (sort === "current_streak") orderBy = "current_streak DESC, total_solved DESC, longest_streak DESC";
    if (sort === "longest_streak") orderBy = "longest_streak DESC, total_solved DESC, current_streak DESC";

    const result = await db.execute(`
      SELECT user_id, app_username, leetcode_username, is_verified,
             easy_solved, medium_solved, hard_solved, total_solved,
             current_streak, longest_streak
      FROM users
      ORDER BY ${orderBy}
      LIMIT ${limit}
    `);

    res.status(200).json({ ok: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message ?? "Internal error" });
  }
}
