Admin Users Table (Turso)
-------------------------

This project now exposes a serverless API endpoint to read users from the Turso (libSQL) database using env vars:

- TURSO_DATABASE_URL
- TURSO_AUTH_TOKEN

Endpoint

- GET /api/users
	- Query params:
		- q: optional search text (server-side LIKE across text columns)
		- limit: page size (default 50, max 200)
		- offset: offset (default 0)

Response

```
{
	ok: true,
	total: number,
	limit: number,
	offset: number,
	columns: string[],
	rows: Array<Record<string, any>>
}
```

UI

- The Admin Dashboard includes a "Users (Turso DB)" section which uses the endpoint above to render a simple table with pagination and search.

Security notes

- The API is read-only. Ensure this route is only visible to admins at the UI level (already behind AdminRoute), and avoid leaking the Turso token to clients; it stays on the server.

