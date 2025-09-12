import { getDb } from "../_lib/db";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ ok: false, error: "Method Not Allowed" });
    return;
  }
  try {
    const { question_id } = req.query || {};
    if (!question_id) {
      res.status(400).json({ ok: false, error: "Missing question_id" });
      return;
    }
    const db = getDb();
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
    res.status(500).json({ ok: false, error: err?.message ?? "Internal error" });
  }
}
