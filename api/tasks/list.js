import { run } from "../_lib/db";
import { sendJson } from "../_lib/http";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return sendJson(res, 405, { error: "Method Not Allowed" });
  }

  try {
    const result = await run(
      "SELECT id, name, completed, created_at FROM tasks ORDER BY created_at DESC"
    );
    // libsql client returns rows in 'rows'
    return sendJson(res, 200, { rows: result.rows ?? [] });
  } catch (err) {
    console.error("/api/tasks/list error", err);
    return sendJson(res, 500, { error: "Internal Server Error" });
  }
}
