import * as DB from "./_lib/db.js";

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
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const dbCheck = url.searchParams.get("db");
    const details = url.searchParams.get("details");

    const hasUrl = !!process.env.TURSO_DATABASE_URL;
    const hasToken = !!process.env.TURSO_AUTH_TOKEN;

    const result: any = {
      ok: true,
      time: new Date().toISOString(),
      env: {
        hasTursoUrl: hasUrl,
        hasTursoToken: hasToken,
      },
    };

    if (dbCheck === "1" || details === "1") {
      try {
  const db = getDbCompat();
        const ping = await db.execute({ sql: "SELECT 1 as ok", args: [] });
        let usersInfo: any[] | null = null;
        let usersCount: number | null = null;
        try {
          const info = await db.execute({ sql: `PRAGMA table_info(users)`, args: [] });
          usersInfo = info.rows || null;
          const countRes = await db.execute({ sql: `SELECT COUNT(*) as cnt FROM users`, args: [] });
          const row = countRes.rows?.[0] as any;
          usersCount = row ? Number(row.cnt) : 0;
        } catch (innerErr: any) {
          usersInfo = null;
          usersCount = null;
          result.usersTableError = innerErr?.message || String(innerErr);
        }
        result.db = {
          ok: true,
          ping: ping.rows?.[0] ?? null,
          usersInfo,
          usersCount,
        };
      } catch (dbErr: any) {
        console.error("/api/health db error:", dbErr);
        result.db = { ok: false, error: dbErr?.message || String(dbErr) };
        result.ok = false;
      }
    }

    res.status(200).json(result);
  } catch (err: any) {
    console.error("/api/health error:", err);
    res.status(500).json({ ok: false, error: err?.message || "Internal error" });
  }
}
