import * as DB from "../_lib/db.js";

function getDbCompat() {
  if (typeof (DB as any).getDb === "function") return (DB as any).getDb();
  if (typeof (DB as any).getClient === "function") return (DB as any).getClient();
  if ((DB as any).default && typeof (DB as any).default.getDb === "function") return (DB as any).default.getDb();
  throw new Error("DB module does not export getDb or getClient");
}

function setCors(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET,OPTIONS");
    res.status(405).json({ ok: false, error: "Method Not Allowed" });
    return;
  }
  try {
    const qFromReq = (req as any).query?.question_id;
    let question_id: string | null = typeof qFromReq === "string" ? qFromReq : null;
    if (!question_id) {
      try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const parts = url.pathname.split("/").filter(Boolean);
        question_id = parts[parts.length - 1] || null;
      } catch {
        // ignore
      }
    }
    if (!question_id) {
      res.status(400).json({ ok: false, error: "Missing question_id" });
      return;
    }
  const db = getDbCompat();
    const result = await db.execute({
      sql: `SELECT q.question_id, q.title, q.url, q.source, q.difficulty,
                   q.is_premium, q.acceptance_rate, q.frequency, q.description,
                   q.created_at,
                   GROUP_CONCAT(DISTINCT c.name) AS categories,
                   GROUP_CONCAT(DISTINCT co.name) AS companies
            FROM questions q
            LEFT JOIN question_categories qc ON qc.question_id = q.question_id
            LEFT JOIN categories c ON c.category_id = qc.category_id
            LEFT JOIN question_companies qco ON qco.question_id = q.question_id
            LEFT JOIN companies co ON co.company_id = qco.company_id
            WHERE q.question_id = ?
            GROUP BY q.question_id
            LIMIT 1` ,
      args: [question_id],
    });
    if (!result.rows || result.rows.length === 0) {
      res.status(404).json({ ok: false, error: "Question not found" });
      return;
    }
    res.status(200).json({ ok: true, data: result.rows[0] });
  } catch (err: any) {
    console.error("/api/questions/[question_id] error:", err);
    res.status(500).json({ ok: false, error: err?.message ?? "Internal error" });
  }
}
