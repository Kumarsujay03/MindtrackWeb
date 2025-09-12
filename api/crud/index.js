import { run } from "../_lib/db";
import { schema } from "../_lib/schema";
import { parseJson, sendJson } from "../_lib/http";

function getTable(req) {
  const url = new URL(req.url, "http://localhost");
  const table = url.searchParams.get("table");
  return table;
}

export default async function handler(req, res) {
  const table = getTable(req);
  if (!table || !schema[table]) {
    return sendJson(res, 400, { error: "Invalid or missing 'table'" });
  }

  switch (req.method) {
    case "GET":
      return listHandler(table, req, res);
    case "POST":
      return createHandler(table, req, res);
    case "PATCH":
    case "PUT":
      return updateHandler(table, req, res);
    case "DELETE":
      return deleteHandler(table, req, res);
    default:
      res.setHeader("Allow", ["GET", "POST", "PATCH", "PUT", "DELETE"]);
      return sendJson(res, 405, { error: "Method Not Allowed" });
  }
}

async function listHandler(table, req, res) {
  try {
    const { columns } = schema[table];
    const sql = `SELECT ${columns.join(", ")} FROM ${table}`;
    const result = await run(sql);
    return sendJson(res, 200, { rows: result.rows ?? [] });
  } catch (e) {
    console.error("CRUD LIST error", e);
    return sendJson(res, 500, { error: "Internal Server Error" });
  }
}

async function createHandler(table, req, res) {
  try {
    const body = await parseJson(req);
    const { insertable } = schema[table];
    const data = pick(body || {}, insertable);
    if (!Object.keys(data).length) {
      return sendJson(res, 400, { error: "No valid fields to insert" });
    }
    const cols = Object.keys(data);
    const placeholders = cols.map(() => "?").join(", ");
    const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders}) RETURNING *`;
    const result = await run(sql, Object.values(data));
    return sendJson(res, 201, { row: result.rows?.[0] ?? null });
  } catch (e) {
    console.error("CRUD CREATE error", e);
    return sendJson(res, 500, { error: "Internal Server Error" });
  }
}

async function updateHandler(table, req, res) {
  try {
    const body = await parseJson(req);
    const { updatable, primaryKey } = schema[table];
    if (!body || body[primaryKey] == null) {
      return sendJson(res, 400, { error: `Field '${primaryKey}' is required` });
    }
    const id = body[primaryKey];
    const updates = pick(body, updatable);
    if (!Object.keys(updates).length) {
      return sendJson(res, 400, { error: "No valid fields to update" });
    }
    const sets = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
    const sql = `UPDATE ${table} SET ${sets} WHERE ${primaryKey} = ? RETURNING *`;
    const args = [...Object.values(updates), id];
    const result = await run(sql, args);
    return sendJson(res, 200, { row: result.rows?.[0] ?? null });
  } catch (e) {
    console.error("CRUD UPDATE error", e);
    return sendJson(res, 500, { error: "Internal Server Error" });
  }
}

async function deleteHandler(table, req, res) {
  try {
    const body = await parseJson(req);
    const { primaryKey } = schema[table];
    if (!body || body[primaryKey] == null) {
      return sendJson(res, 400, { error: `Field '${primaryKey}' is required` });
    }
    const id = body[primaryKey];
    const sql = `DELETE FROM ${table} WHERE ${primaryKey} = ?`;
    await run(sql, [id]);
    return sendJson(res, 200, { success: true });
  } catch (e) {
    console.error("CRUD DELETE error", e);
    return sendJson(res, 500, { error: "Internal Server Error" });
  }
}

function pick(obj, fields) {
  return Object.fromEntries(
    Object.entries(obj || {}).filter(([k, v]) => fields.includes(k))
  );
}
