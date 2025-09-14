import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { createClient } from "@libsql/client";

function devApiUsersPlugin(env: Record<string, string>): Plugin {
  return {
    name: "dev-api-users",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/users", async (req, res) => {
        try {
          if (req.method !== "GET") {
            res.statusCode = 405;
            res.setHeader("Allow", "GET");
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Method Not Allowed" }));
            return;
          }

          const url = env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
          const authToken = env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
          if (!url || !authToken) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set" }));
            return;
          }

          const client = createClient({ url, authToken });

          const full = new URL(req.url || "/api/users", "http://localhost");
          const limit = Math.max(1, Math.min(200, parseInt(full.searchParams.get("limit") || "50", 10)));
          const offset = Math.max(0, parseInt(full.searchParams.get("offset") || "0", 10));
          const q = (full.searchParams.get("q") || "").trim();

          const pragma = await client.execute(`PRAGMA table_info(users)`);
          const columns: { name: string; type: string }[] = pragma.rows.map((r: any) => ({ name: r.name as string, type: (r.type as string) || "" }));
          if (!columns.length) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Table 'users' not found" }));
            return;
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

          const countSql = `SELECT COUNT(*) as cnt FROM users ${where}`;
          const countRes = await client.execute({ sql: countSql, args: params });
          const total = Number((countRes.rows?.[0] as any)?.cnt || 0);

          const selectSql = `SELECT * FROM users ${where} ORDER BY ROWID DESC LIMIT ? OFFSET ?`;
          const rowsRes = await client.execute({ sql: selectSql, args: [...params, limit, offset] });

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: true,
              total,
              limit,
              offset,
              columns: columns.map((c) => c.name),
              rows: rowsRes.rows,
            })
          );
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err?.message || "Database error" }));
        }
      });
      server.middlewares.use("/api/verify-user", async (req, res) => {
        try {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.setHeader("Allow", "POST");
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Method Not Allowed" }));
            return;
          }

          const url = env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
          const authToken = env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
          if (!url || !authToken) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set" }));
            return;
          }
          const client = createClient({ url, authToken });

          const body = await readBody(req);
          const { user_id, app_username, leetcode_username } = body as any;
          if (!user_id || !app_username || !leetcode_username) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "user_id, app_username and leetcode_username are required" }));
            return;
          }

          await client.execute(`CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            app_username TEXT UNIQUE NOT NULL,
            leetcode_username TEXT UNIQUE NOT NULL,
            is_verified INTEGER NOT NULL DEFAULT 0,
            easy_solved INTEGER NOT NULL DEFAULT 0,
            medium_solved INTEGER NOT NULL DEFAULT 0,
            hard_solved INTEGER NOT NULL DEFAULT 0,
            total_solved INTEGER NOT NULL DEFAULT 0
          )`);

          const conflicts = await client.execute({
            sql: `SELECT 
              SUM(CASE WHEN user_id <> ? AND app_username = ? THEN 1 ELSE 0 END) AS app_conflict,
              SUM(CASE WHEN user_id <> ? AND leetcode_username = ? THEN 1 ELSE 0 END) AS lc_conflict
            FROM users`,
            args: [user_id, app_username, user_id, leetcode_username],
          });
          const row = conflicts.rows[0] as any;
          if (Number(row?.app_conflict || 0) > 0) {
            res.statusCode = 409;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "app_username already in use" }));
            return;
          }
          if (Number(row?.lc_conflict || 0) > 0) {
            res.statusCode = 409;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "leetcode_username already in use" }));
            return;
          }

          await client.execute({
            sql: `INSERT INTO users (user_id, app_username, leetcode_username, is_verified, easy_solved, medium_solved, hard_solved, total_solved)
                  VALUES (?, ?, ?, 1, 0, 0, 0, 0)
                  ON CONFLICT(user_id) DO UPDATE SET
                    app_username = excluded.app_username,
                    leetcode_username = excluded.leetcode_username,
                    is_verified = 1` ,
            args: [user_id, app_username, leetcode_username],
          });

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err?.message || "Database error" }));
        }
      });
      server.middlewares.use("/api/delete-user", async (req, res) => {
        try {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.setHeader("Allow", "POST");
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Method Not Allowed" }));
            return;
          }

          const url = env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
          const authToken = env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
          if (!url || !authToken) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set" }));
            return;
          }
          const client = createClient({ url, authToken });

          const body = await readBody(req);
          const user_id = (body?.user_id || "").trim();
          if (!user_id) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "user_id is required" }));
            return;
          }

          const pragma = await client.execute(`PRAGMA table_info(users)`);
          if (!Array.isArray(pragma.rows) || pragma.rows.length === 0) {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, deleted: 0 }));
            return;
          }

          await client.execute({ sql: `DELETE FROM users WHERE user_id = ?`, args: [user_id] });
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err?.message || "Database error" }));
        }
      });
    },
  };
}

function escapeIdent(name: string): string {
  if (!/^\w+$/.test(name)) throw new Error("Unsafe identifier");
  return `"${name}"`;
}

async function readBody(req: any): Promise<any> {
  return await new Promise((resolve) => {
    let buf = "";
    req.on("data", (c: any) => (buf += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(buf || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ""); // load all env vars from .env files
  return {
    plugins: [react(), tailwindcss(), devApiUsersPlugin(env)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
