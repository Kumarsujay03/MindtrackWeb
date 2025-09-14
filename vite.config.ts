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
      server.middlewares.use("/api/questions", async (req, res) => {
        try {
          if (req.method !== "GET") {
            res.statusCode = 405;
            res.setHeader("Allow", "GET");
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Method Not Allowed" }));
            return;
          }

          const dbUrl = env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
          const dbToken = env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
          if (!dbUrl || !dbToken) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set" }));
            return;
          }
          const client = createClient({ url: dbUrl, authToken: dbToken });

          const full = new URL(req.url || "/api/questions", "http://localhost");
          const limit = Math.max(1, Math.min(50, parseInt(full.searchParams.get("limit") || "50", 10)));
          const offset = Math.max(0, parseInt(full.searchParams.get("offset") || "0", 10));
          const q = (full.searchParams.get("q") || "").trim();
          const user_id = (full.searchParams.get("user_id") || "").trim();
          const startedOnly = (full.searchParams.get("started") || "") === "1";
          function getAll(name: string): string[] {
            const vs = full.searchParams.getAll(name);
            const out: string[] = [];
            vs.forEach((s) => s.split(",").forEach((p) => { const t = p.trim(); if (t) out.push(t); }));
            return out;
          }
          const categories = getAll("category");
          const sheets = getAll("sheet");
          const companies = getAll("company");
          const difficulties = getAll("difficulty");

          const desired = [
            "question_id",
            "title",
            "url",
            "source",
            "difficulty",
            "is_premium",
            "acceptance_rate",
            "frequency",
          ];

          const pragma = await client.execute(`PRAGMA table_info(questions)`);
          const cols = new Set((pragma.rows || []).map((r: any) => String(r.name)));
          if (!cols.size) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Table 'questions' not found" }));
            return;
          }
          const present = desired.filter((c) => cols.has(c));

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
          if (startedOnly && user_id) {
            where.push(`EXISTS (SELECT 1 FROM user_question_progress u WHERE u.user_id = ? AND u.question_id = q.question_id AND u.is_starred = 1)`);
            args.push(user_id);
          }
          const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

          const countSql = `SELECT COUNT(DISTINCT q.question_id) AS cnt FROM questions q ${whereSql}`;
          const countRes = await client.execute({ sql: countSql, args });
          const total = Number((countRes.rows?.[0] as any)?.cnt || 0);

          const baseCols = present.map((c) => `q."${c}"`).join(", ");
          const extraUserCols = user_id ? ", COALESCE(uqp.is_starred, 0) AS is_starred, COALESCE(uqp.is_solved, 0) AS is_solved" : "";
          const selectList = [
            baseCols + extraUserCols,
            `COALESCE((SELECT GROUP_CONCAT(DISTINCT c.name) FROM question_categories qc JOIN categories c ON c.category_id = qc.category_id WHERE qc.question_id = q.question_id), '') AS categories`,
            `COALESCE((SELECT GROUP_CONCAT(DISTINCT co.name) FROM question_companies qco JOIN companies co ON co.company_id = qco.company_id WHERE qco.question_id = q.question_id), '') AS companies`,
          ].join(", ");

          const fromSql = `FROM questions q` + (user_id ? ` LEFT JOIN user_question_progress uqp ON uqp.question_id = q.question_id AND uqp.user_id = ?` : ``);
          const dataSql = `SELECT ${selectList} ${fromSql} ${whereSql} ORDER BY q.question_id LIMIT ? OFFSET ?`;
          const dataArgs = user_id ? [user_id, ...args, limit, offset] : [...args, limit, offset];
          const rowsRes = await client.execute({ sql: dataSql, args: dataArgs });

          const colsOut = user_id ? [...present, "is_starred", "is_solved", "categories", "companies"] : [...present, "categories", "companies"];
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, total, limit, offset, columns: colsOut, rows: rowsRes.rows }));
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
      server.middlewares.use("/api/categories", async (req, res) => {
        try {
          if (req.method !== "GET") {
            res.statusCode = 405;
            res.setHeader("Allow", "GET");
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Method Not Allowed" }));
            return;
          }
          const dbUrl = env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
          const dbToken = env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
          if (!dbUrl || !dbToken) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set" }));
            return;
          }
          const client = createClient({ url: dbUrl, authToken: dbToken });
          const rows = await client.execute(`SELECT category_id, name FROM categories ORDER BY name`);
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, rows: rows.rows }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err?.message || "Database error" }));
        }
      });
      server.middlewares.use("/api/sheets", async (req, res) => {
        try {
          if (req.method !== "GET") {
            res.statusCode = 405;
            res.setHeader("Allow", "GET");
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Method Not Allowed" }));
            return;
          }
          const dbUrl = env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
          const dbToken = env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
          if (!dbUrl || !dbToken) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set" }));
            return;
          }
          const client = createClient({ url: dbUrl, authToken: dbToken });
          const rows = await client.execute(`SELECT sheet_id, name, source FROM sheets ORDER BY name`);
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, rows: rows.rows }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err?.message || "Database error" }));
        }
      });
      server.middlewares.use("/api/companies", async (req, res) => {
        try {
          if (req.method !== "GET") {
            res.statusCode = 405;
            res.setHeader("Allow", "GET");
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Method Not Allowed" }));
            return;
          }
          const dbUrl = env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
          const dbToken = env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
          if (!dbUrl || !dbToken) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set" }));
            return;
          }
          const client = createClient({ url: dbUrl, authToken: dbToken });
          const rows = await client.execute(`SELECT company_id, name FROM companies ORDER BY name`);
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, rows: rows.rows }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err?.message || "Database error" }));
        }
      });
      // Per-user stats (for app dashboard)
      server.middlewares.use("/api/user-stats", async (req, res) => {
        try {
          if (req.method !== "GET") {
            res.statusCode = 405;
            res.setHeader("Allow", "GET");
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Method Not Allowed" }));
            return;
          }
          const dbUrl = env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
          const dbToken = env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
          if (!dbUrl || !dbToken) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set" }));
            return;
          }
          const full = new URL(req.url || "/api/user-stats", "http://localhost");
          const user_id = (full.searchParams.get("user_id") || "").trim();
          const username = (full.searchParams.get("username") || full.searchParams.get("app_username") || "").trim();
          if (!user_id && !username) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "user_id or username is required" }));
            return;
          }
          const client = createClient({ url: dbUrl, authToken: dbToken });
          const where = user_id ? `user_id = ?` : `app_username = ?`;
          const arg = user_id ? user_id : username;
          const q = await client.execute({
            sql: `SELECT 
                    user_id,
                    app_username AS username,
                    is_verified,
                    easy_solved,
                    medium_solved,
                    hard_solved,
                    total_solved,
                    current_streak,
                    longest_streak,
                    last_solved_date
                  FROM users
                  WHERE ${where}
                  LIMIT 1`,
            args: [arg],
          });
          const row = (q.rows?.[0] as any) || null;
          if (!row) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "User not found" }));
            return;
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, user: row }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err?.message || "Database error" }));
        }
      });
      server.middlewares.use("/api/leaderboard", async (req, res) => {
        try {
          if (req.method !== "GET") {
            res.statusCode = 405;
            res.setHeader("Allow", "GET");
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Method Not Allowed" }));
            return;
          }
          const dbUrl = env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
          const dbToken = env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
          if (!dbUrl || !dbToken) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set" }));
            return;
          }
          const full = new URL(req.url || "/api/leaderboard", "http://localhost");
          const limit = Math.max(1, Math.min(200, parseInt(full.searchParams.get("limit") || "100", 10)));
          const offset = Math.max(0, parseInt(full.searchParams.get("offset") || "0", 10));
          const user_id = (full.searchParams.get("user_id") || "").trim();
          const client = createClient({ url: dbUrl, authToken: dbToken });
          const countRes = await client.execute({ sql: `SELECT COUNT(*) AS cnt FROM users WHERE is_verified = 1 AND app_username IS NOT NULL`, args: [] });
          const total = Number((countRes.rows?.[0] as any)?.cnt || 0);
          const rowsRes = await client.execute({
            sql: `SELECT user_id, app_username AS username, current_streak AS streak, total_solved
                  FROM users
                  WHERE is_verified = 1 AND app_username IS NOT NULL
                  ORDER BY streak DESC, total_solved DESC, username ASC
                  LIMIT ? OFFSET ?`,
            args: [limit, offset],
          });
          // Compute my rank if user_id provided
          let my: any = null;
          if (user_id) {
            const meRes = await client.execute({
              sql: `SELECT user_id, app_username AS username, current_streak AS streak, total_solved, is_verified
                    FROM users WHERE user_id = ? LIMIT 1`,
              args: [user_id],
            });
            const me = (meRes.rows?.[0] || null) as any;
            if (me && me.is_verified === 1 && me.username) {
              const rankRes = await client.execute({
                sql: `SELECT COUNT(*) AS higher
                      FROM users u
                      WHERE u.is_verified = 1 AND u.app_username IS NOT NULL AND (
                        u.current_streak > ? OR
                        (u.current_streak = ? AND u.total_solved > ?) OR
                        (u.current_streak = ? AND u.total_solved = ? AND u.app_username < ?)
                      )`,
                args: [me.streak, me.streak, me.total_solved, me.streak, me.total_solved, me.username],
              });
              const higher = Number((rankRes.rows?.[0] as any)?.higher || 0);
              my = { user_id: me.user_id, username: me.username, streak: me.streak, total_solved: me.total_solved, rank: higher + 1 };
            }
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, total, limit, offset, rows: rowsRes.rows, my }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err?.message || "Database error" }));
        }
      });
      server.middlewares.use("/api/progress", async (req, res) => {
        try {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.setHeader("Allow", "POST");
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Method Not Allowed" }));
            return;
          }
          const dbUrl = env.TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL;
          const dbToken = env.TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
          if (!dbUrl || !dbToken) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set" }));
            return;
          }
          const client = createClient({ url: dbUrl, authToken: dbToken });
          const body = await readBody(req);
          const { user_id, question_id, action } = body || {};
          if (!user_id || !question_id || !action) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "user_id, question_id, action are required" }));
            return;
          }
          // Ensure daily stats table exists
          await client.execute(`CREATE TABLE IF NOT EXISTS user_daily_stats (
            user_id TEXT NOT NULL,
            date NUMERIC NOT NULL,
            solved_count INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, date)
          )`);
          await client.execute({
            sql: `INSERT INTO user_question_progress (user_id, question_id) VALUES (?, ?)
                  ON CONFLICT(user_id, question_id) DO NOTHING`,
            args: [user_id, question_id],
          });
          const curRes = await client.execute({
            sql: `SELECT uqp.is_solved, uqp.is_starred, uqp.solved_at, q.difficulty
                  FROM user_question_progress uqp
                  JOIN questions q ON q.question_id = uqp.question_id
                  WHERE uqp.user_id = ? AND uqp.question_id = ?`,
            args: [user_id, question_id],
          });
          const cur = (curRes.rows?.[0] || {}) as any;
          const wasSolved = Number(cur?.is_solved || 0) ? 1 : 0;
          const wasStarred = Number(cur?.is_starred || 0) ? 1 : 0;
          const prevSolvedAt = cur?.solved_at as string | null | undefined;
          const difficulty: string = (cur?.difficulty || "");
          let nowSolved = wasSolved;
          let nowStarred = wasStarred;
          if (action === "star") nowStarred = 1;
          else if (action === "unstar") nowStarred = 0;
          else if (action === "solve") nowSolved = 1;
          else if (action === "unsolve") nowSolved = 0;
          else {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Invalid action" }));
            return;
          }
          await client.execute({
            sql: `UPDATE user_question_progress
                  SET is_starred = ?, is_solved = ?, solved_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END
                  WHERE user_id = ? AND question_id = ?`,
            args: [nowStarred, nowSolved, nowSolved, user_id, question_id],
          });
          if (nowSolved !== wasSolved) {
            // Ensure streak columns exist for dev environment
            try {
              const pragma = await client.execute(`PRAGMA table_info(users)`);
              const has = new Set((pragma.rows || []).map((r: any) => String(r.name).toLowerCase()));
              if (!has.has("current_streak")) await client.execute(`ALTER TABLE users ADD COLUMN current_streak INTEGER NOT NULL DEFAULT 0`);
              if (!has.has("longest_streak")) await client.execute(`ALTER TABLE users ADD COLUMN longest_streak INTEGER NOT NULL DEFAULT 0`);
              if (!has.has("last_solved_date")) await client.execute(`ALTER TABLE users ADD COLUMN last_solved_date NUMERIC`);
            } catch {}
            // Ensure a users row exists for this user
            await client.execute({
              sql: `INSERT OR IGNORE INTO users (
                      user_id, app_username, leetcode_username, is_verified,
                      easy_solved, medium_solved, hard_solved, total_solved,
                      current_streak, longest_streak, last_solved_date
                    ) VALUES (?, NULL, NULL, 0, 0, 0, 0, 0, 0, 0, NULL)`,
              args: [user_id],
            });
            const diffCol = difficulty?.toLowerCase() === "easy" ? "easy_solved"
              : difficulty?.toLowerCase() === "medium" ? "medium_solved"
              : difficulty?.toLowerCase() === "hard" ? "hard_solved" : null;
            if (nowSolved === 1) {
              await client.execute({
                sql: `INSERT INTO user_daily_stats (user_id, date, solved_count)
                      VALUES (?, DATE('now'), 1)
                      ON CONFLICT(user_id, date) DO UPDATE SET solved_count = solved_count + 1`,
                args: [user_id],
              });
              const newCurrentExpr = `CASE
                  WHEN last_solved_date IS NULL THEN 1
                  WHEN DATE(last_solved_date) = DATE('now') THEN CASE WHEN current_streak > 0 THEN current_streak ELSE 1 END
                  WHEN DATE(last_solved_date) = DATE('now','-1 day') THEN current_streak + 1
                  ELSE 1
                END`;
              await client.execute({
                sql: `UPDATE users SET 
                        total_solved = total_solved + 1,
                        current_streak = ${newCurrentExpr},
                        longest_streak = CASE WHEN (${newCurrentExpr}) > longest_streak THEN (${newCurrentExpr}) ELSE longest_streak END,
                        last_solved_date = DATE('now')
                      WHERE user_id = ?`,
                args: [user_id],
              });
              if (diffCol) {
                await client.execute({
                  sql: `UPDATE users SET ${diffCol} = ${diffCol} + 1 WHERE user_id = ?`,
                  args: [user_id],
                });
              }
            } else {
              if (prevSolvedAt) {
                await client.execute({
                  sql: `INSERT OR IGNORE INTO user_daily_stats (user_id, date, solved_count) VALUES (?, DATE(?), 0)`,
                  args: [user_id, prevSolvedAt],
                });
                await client.execute({
                  sql: `UPDATE user_daily_stats SET solved_count = CASE WHEN solved_count > 0 THEN solved_count - 1 ELSE 0 END
                        WHERE user_id = ? AND date = DATE(?)`,
                  args: [user_id, prevSolvedAt],
                });
              }
              await client.execute({
                sql: `UPDATE users SET 
                        total_solved = CASE WHEN total_solved > 0 THEN total_solved - 1 ELSE 0 END
                      WHERE user_id = ?`,
                args: [user_id],
              });
              if (diffCol) {
                await client.execute({
                  sql: `UPDATE users SET ${diffCol} = CASE WHEN ${diffCol} > 0 THEN ${diffCol} - 1 ELSE 0 END
                        WHERE user_id = ?`,
                  args: [user_id],
                });
              }
            }

            // Recompute accurate current_streak and last_solved_date
            const streakRes = await client.execute({
              sql: `WITH RECURSIVE streak(n, d) AS (
                      SELECT 1, DATE('now')
                      WHERE EXISTS(SELECT 1 FROM user_daily_stats WHERE user_id = ? AND date = DATE('now') AND solved_count > 0)
                      UNION ALL
                      SELECT n + 1, DATE(d, '-1 day')
                      FROM streak
                      WHERE EXISTS(SELECT 1 FROM user_daily_stats WHERE user_id = ? AND date = DATE(d, '-1 day') AND solved_count > 0)
                    )
                    SELECT COALESCE(MAX(n), 0) AS cnt`,
              args: [user_id, user_id],
            });
            const currentStreak = Number((streakRes.rows?.[0] as any)?.cnt || 0);
            const lastDateRes = await client.execute({
              sql: `SELECT MAX(date) AS last_date FROM user_daily_stats WHERE user_id = ? AND solved_count > 0`,
              args: [user_id],
            });
            const lastDate = (lastDateRes.rows?.[0] as any)?.last_date ?? null;
            await client.execute({
              sql: `UPDATE users SET 
                      current_streak = ?,
                      longest_streak = CASE WHEN ? > longest_streak THEN ? ELSE longest_streak END,
                      last_solved_date = COALESCE(?, last_solved_date)
                    WHERE user_id = ?`,
              args: [currentStreak, currentStreak, currentStreak, lastDate, user_id],
            });
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, is_starred: nowStarred, is_solved: nowSolved }));
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
