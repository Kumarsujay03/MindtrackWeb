import { createClient } from "@libsql/client";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

type ColumnInfo = {
  name: string;
  type: string;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  let url: string;
  let authToken: string;
  try {
    url = getEnv("TURSO_DATABASE_URL");
    authToken = getEnv("TURSO_AUTH_TOKEN");
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Missing database configuration" });
  }

  const client = createClient({ url, authToken });

  const limit = Math.max(1, Math.min(200, parseInt((req.query.limit as string) || "50", 10)));
  const offset = Math.max(0, parseInt((req.query.offset as string) || "0", 10));
  const q = ((req.query.q as string) || "").trim();

  try {
    // Discover columns of users table to build a generic search over TEXT-like columns
    const pragma = await client.execute(`PRAGMA table_info(users)`);
    const columns: ColumnInfo[] = pragma.rows.map((r: any) => ({ name: r.name as string, type: (r.type as string) || "" }));
    if (!columns.length) {
      return res.status(404).json({ error: "Table 'users' not found" });
    }

    const searchable = columns
      .filter((c) => /CHAR|CLOB|TEXT/i.test(c.type || "") || c.type === "")
      .map((c) => c.name)
      .filter((n) => n && typeof n === "string");

    let where = "";
    const params: any[] = [];
    if (q && searchable.length) {
      where = `WHERE ` + searchable.map((c) => `${escapeIdent(c)} LIKE ?`).join(" OR ");
      params.push(`%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`);
    }

    // Count for pagination
    const countSql = `SELECT COUNT(*) as cnt FROM users ${where}`;
    const countRes = await client.execute({ sql: countSql, args: params });
    const total = Number((countRes.rows?.[0] as any)?.cnt || 0);

    // Fetch page
    const selectSql = `SELECT * FROM users ${where} ORDER BY ROWID DESC LIMIT ? OFFSET ?`;
    const rowsRes = await client.execute({ sql: selectSql, args: [...params, limit, offset] });

    // rowsRes.rows is an array of objects with column names as keys
    return res.status(200).json({
      ok: true,
      total,
      limit,
      offset,
      columns: columns.map((c) => c.name),
      rows: rowsRes.rows,
    });
  } catch (err: any) {
    // Avoid leaking internals in error messages
    return res.status(500).json({ error: err?.message || "Database error" });
  }
}

// VERY small identifier escape for column names (only allow alnum and underscore), not for values
function escapeIdent(name: string): string {
  if (!/^\w+$/.test(name)) throw new Error("Unsafe identifier");
  return `\"${name}\"`;
}
