import { createClient } from "@libsql/client";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  let body = "";
  await new Promise<void>((resolve) => {
    req.on("data", (chunk: any) => (body += chunk));
    req.on("end", () => resolve());
  });
  let data: any;
  try {
    data = JSON.parse(body || "{}");
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const user_id = (data?.user_id || "").trim();
  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    return res.status(500).json({ error: "TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set" });
  }
  const client = createClient({ url, authToken });

  try {
    // If table doesn't exist, treat as already deleted
    const pragma = await client.execute(`PRAGMA table_info(users)`);
    if (!Array.isArray(pragma.rows) || pragma.rows.length === 0) {
      return res.status(200).json({ ok: true, deleted: 0 });
    }

    await client.execute({ sql: `DELETE FROM users WHERE user_id = ?`, args: [user_id] });
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Database error" });
  }
}
