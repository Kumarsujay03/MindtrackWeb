import { getDb } from "./_lib/db";

function setCors(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ ok: false, error: "Method Not Allowed" });
    return;
  }
  try {
    const db = getDb();
    const url = new URL(req.url, `http://${req.headers.host}`);
    const limitParam = url.searchParams.get("limit");
    const category = url.searchParams.get("category");
    const company = url.searchParams.get("company");
    const difficulty = url.searchParams.get("difficulty"); // EASY|MEDIUM|HARD
    const limit = Math.max(1, Math.min(200, Number(limitParam) || 50));

    const args: any[] = [];
    const where: string[] = [];

    if (category) {
      where.push(`q.question_id IN (SELECT question_id FROM question_categories qc JOIN categories c ON c.category_id = qc.category_id WHERE c.name = ?)`);
      args.push(category);
    }
    if (company) {
      where.push(`q.question_id IN (SELECT question_id FROM question_companies qco JOIN companies co ON co.company_id = qco.company_id WHERE co.name = ?)`);
      args.push(company);
    }
    if (difficulty) {
      where.push(`q.difficulty = ?`);
      args.push(difficulty);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const result = await db.execute({
      sql: `SELECT q.question_id, q.title, q.url, q.source, q.difficulty,
                   q.is_premium, q.acceptance_rate, q.frequency, q.created_at
            FROM questions q
            ${whereSql}
            ORDER BY q.created_at DESC
            LIMIT ${limit}`,
      args,
    });

    res.status(200).json({ ok: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message ?? "Internal error" });
  }
}
