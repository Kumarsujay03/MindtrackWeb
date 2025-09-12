import { createClient } from "@libsql/client";

let client;

export function getClient() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL || process.env.TURSO_DB_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN || process.env.TURSO_DB_AUTH_TOKEN;

    if (!url || !authToken) {
      throw new Error(
        "Missing Turso credentials: set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in your environment (Vercel Project Settings)."
      );
    }

    client = createClient({ url, authToken });
  }
  return client;
}

// Provide a getDb alias to match TypeScript imports used across API routes.
export function getDb() {
  return getClient();
}

export async function run(sql, args = []) {
  const c = getClient();
  // Supports positional args (array) or named args (object)
  return c.execute({ sql, args });
}
