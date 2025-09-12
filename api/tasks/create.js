import { run } from "../_lib/db";
import { parseJson, sendJson } from "../_lib/http";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return sendJson(res, 405, { error: "Method Not Allowed" });
  }

  try {
    const body = await parseJson(req);
    const name = body?.name;
    if (!name || typeof name !== "string") {
      return sendJson(res, 400, { error: "Field 'name' is required" });
    }
    const result = await run(
      "INSERT INTO tasks (name, completed, created_at) VALUES (?, 0, strftime('%Y-%m-%dT%H:%M:%fZ','now')) RETURNING id",
      [name]
    );
    const id = result.rows?.[0]?.id ?? null;
    return sendJson(res, 201, { id });
  } catch (err) {
    console.error("/api/tasks/create error", err);
    return sendJson(res, 500, { error: "Internal Server Error" });
  }
}
