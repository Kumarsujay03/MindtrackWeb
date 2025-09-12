import { getDb } from "../_lib/db";

export default async function handler(req: any, res: any) {
  const db = getDb();
  const { user_id } = req.query as { user_id?: string };
  if (!user_id || typeof user_id !== "string") return res.status(400).json({ error: "user_id required" });

  if (req.method === "GET") {
    try {
      const result = await db.execute({ sql: `SELECT * FROM registrations WHERE uid = ?`, args: [user_id] });
      if (!result.rows || result.rows.length === 0) return res.status(404).json({ error: "not found" });
      return res.status(200).json(result.rows[0]);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Failed to fetch" });
    }
  }

  if (req.method === "DELETE") {
    try {
      await db.execute({ sql: `DELETE FROM registrations WHERE uid = ?`, args: [user_id] });
      return res.status(204).end();
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Failed to delete" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
