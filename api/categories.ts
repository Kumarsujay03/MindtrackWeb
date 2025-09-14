import { createClient } from "@libsql/client";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) return res.status(500).json({ error: "TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set" });
  const client = createClient({ url, authToken });
  try {
    const rows = await client.execute(`SELECT category_id, name FROM categories ORDER BY name`);
    res.status(200).json({ ok: true, rows: rows.rows });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Database error" });
  }
}
