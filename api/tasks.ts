import { getDb } from "./_lib/db";

async function ensureSchema() {
  const db = getDb();
  await db.execute(`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
}

export default async function handler(req: any, res: any) {
  try {
    await ensureSchema();
    const db = getDb();

    if (req.method === "GET") {
      const rows = (await db.execute("SELECT id, title, completed, created_at FROM tasks ORDER BY created_at DESC LIMIT 50")).rows;
      res.status(200).json({ ok: true, data: rows });
      return;
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const title = (body?.title ?? "").toString().trim();
      if (!title) {
        res.status(400).json({ ok: false, error: "Title is required" });
        return;
      }
      const id = crypto.randomUUID();
      await db.execute({
        sql: "INSERT INTO tasks (id, title, completed) VALUES (?, ?, 0)",
        args: [id, title],
      });
      res.status(201).json({ ok: true, data: { id, title, completed: 0 } });
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ ok: false, error: "Method Not Allowed" });
  } catch (err: any) {
    const message = err?.message ?? "Internal error";
    res.status(500).json({ ok: false, error: message });
  }
}
