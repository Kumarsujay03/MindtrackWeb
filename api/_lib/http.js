export async function parseJson(req) {
  try {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }
    if (!body) return null;
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}
