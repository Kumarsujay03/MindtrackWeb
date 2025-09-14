import { createClient } from "@libsql/client";

type Row = {
  question_id?: number;
  title?: string;
  url?: string;
  source?: string;
  difficulty?: string;
  is_premium?: any;
  acceptance_rate?: number;
  frequency?: number;
  categories?: string;
  companies?: string;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    return res.status(500).json({ error: "TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set" });
  }
  const client = createClient({ url, authToken });

  const limit = Math.max(1, Math.min(50, parseInt((req.query.limit as string) || "50", 10)));
  const offset = Math.max(0, parseInt((req.query.offset as string) || "0", 10));
  const q = (req.query.q as string)?.trim() || ""; // title search
  // Parse single or multiple values for filters; allow comma-separated or repeated params
  function getAll(name: string): string[] {
    const v = (req.query as any)[name];
    const list: string[] = Array.isArray(v) ? v : (typeof v === "string" ? [v] : []);
    const out: string[] = [];
    list.forEach((s) => {
      if (typeof s === "string") s.split(",").forEach((p) => { const t = p.trim(); if (t) out.push(t); });
    });
    return out;
  }
  const categories = getAll("category"); // names or ids
  const sheets = getAll("sheet");
  const companies = getAll("company");
  const difficulties = getAll("difficulty"); // textual

  const desiredBase = [
    "question_id",
    "title",
    "url",
    "source",
    "difficulty",
    "is_premium",
    "acceptance_rate",
    "frequency",
  ];

  try {
    const pragma = await client.execute(`PRAGMA table_info(questions)`);
    const cols = new Set((pragma.rows || []).map((r: any) => String(r.name)));
    if (!cols.size) {
      return res.status(404).json({ error: "Table 'questions' not found" });
    }
    const present = desiredBase.filter((c) => cols.has(c));

    // Build WHERE clauses for filters
    const where: string[] = [];
    const args: any[] = [];
    if (q) {
      where.push(`q.title LIKE ?`);
      args.push(`%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`);
    }
    function splitIdsNames(arr: string[]): { ids: number[]; names: string[] } {
      const ids: number[] = [];
      const names: string[] = [];
      arr.forEach((s) => { const n = Number(s); if (Number.isFinite(n) && String(n) === s) ids.push(n); else names.push(s); });
      return { ids, names };
    }
    if (categories.length) {
      const { ids, names } = splitIdsNames(categories);
      const parts: string[] = [];
      if (names.length) { parts.push(`c.name IN (${names.map(() => "?").join(",")})`); args.push(...names); }
      if (ids.length) { parts.push(`c.category_id IN (${ids.map(() => "?").join(",")})`); args.push(...ids); }
      if (parts.length) where.push(`EXISTS (SELECT 1 FROM question_categories qc JOIN categories c ON c.category_id = qc.category_id WHERE qc.question_id = q.question_id AND (${parts.join(" OR ")}))`);
    }
    if (sheets.length) {
      const { ids, names } = splitIdsNames(sheets);
      const parts: string[] = [];
      if (names.length) { parts.push(`s.name IN (${names.map(() => "?").join(",")})`); args.push(...names); }
      if (ids.length) { parts.push(`s.sheet_id IN (${ids.map(() => "?").join(",")})`); args.push(...ids); }
      if (parts.length) where.push(`EXISTS (SELECT 1 FROM question_sheets qs JOIN sheets s ON s.sheet_id = qs.sheet_id WHERE qs.question_id = q.question_id AND (${parts.join(" OR ")}))`);
    }
    if (companies.length) {
      const { ids, names } = splitIdsNames(companies);
      const parts: string[] = [];
      if (names.length) { parts.push(`co.name IN (${names.map(() => "?").join(",")})`); args.push(...names); }
      if (ids.length) { parts.push(`co.company_id IN (${ids.map(() => "?").join(",")})`); args.push(...ids); }
      if (parts.length) where.push(`EXISTS (SELECT 1 FROM question_companies qco JOIN companies co ON co.company_id = qco.company_id WHERE qco.question_id = q.question_id AND (${parts.join(" OR ")}))`);
    }
    if (difficulties.length) {
      where.push(`q.difficulty IN (${difficulties.map(() => "?").join(",")})`);
      args.push(...difficulties);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // Count with filters (distinct by question)
    const countSql = `SELECT COUNT(DISTINCT q.question_id) AS cnt FROM questions q ${whereSql}`;
    const countRes = await client.execute({ sql: countSql, args });
    const total = Number((countRes.rows?.[0] as any)?.cnt || 0);

    // Select page with aggregated categories and companies
    const baseCols = present.map((c) => `q."${c}"`).join(", ");
    const selectList = [
      baseCols,
      `COALESCE((SELECT GROUP_CONCAT(DISTINCT c.name) FROM question_categories qc JOIN categories c ON c.category_id = qc.category_id WHERE qc.question_id = q.question_id), '') AS categories`,
      `COALESCE((SELECT GROUP_CONCAT(DISTINCT co.name) FROM question_companies qco JOIN companies co ON co.company_id = qco.company_id WHERE qco.question_id = q.question_id), '') AS companies`,
    ].join(", ");

    const dataSql = `SELECT ${selectList} FROM questions q ${whereSql} ORDER BY q.question_id LIMIT ? OFFSET ?`;
    const rowsRes = await client.execute({ sql: dataSql, args: [...args, limit, offset] });

    const columns = [...present, "categories", "companies"];
    return res.status(200).json({ ok: true, total, limit, offset, columns, rows: rowsRes.rows as Row[] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Database error" });
  }
}
