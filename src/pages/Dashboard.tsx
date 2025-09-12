import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, updateDoc, doc } from "firebase/firestore";

type UserRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  appUserName?: string | null;
  leetcodeUsername?: string | null;
  is_verified?: boolean;
  dob?: string | null;
};

export default function Dashboard() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [queryText, setQueryText] = useState("");
  // Removed Turso registrations section in favor of direct users table management

  // Turso Users (users table) state
  const [tursoUsersRows, setTursoUsersRows] = useState<any[]>([]);
  const [tursoUsersLoading, setTursoUsersLoading] = useState<boolean>(false);
  const [tursoUsersFilter, setTursoUsersFilter] = useState<"all" | "verified" | "unverified">("all");
  const [tursoUsersQuery, setTursoUsersQuery] = useState<string>("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // NOTE: This requires Firestore rules to allow admins to list users.
      // If your rules block list reads, we will show a message below.
      const q = query(collection(db, "users"));
      const snap = await getDocs(q);
      const rows: UserRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      rows.sort((a, b) => {
        const av = a.is_verified ? 1 : 0;
        const bv = b.is_verified ? 1 : 0;
        if (av !== bv) return bv - av; // verified first
        return (a.appUserName || "").localeCompare(b.appUserName || "");
      });
      setUsers(rows);
    } catch (e: any) {
      setError(e?.message || "Failed to load users. Your Firestore rules may be blocking admin list reads.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Registrations endpoints removed; no loadSql needed

  // Removed registrations verify flow; we only manage users table directly now.

  // Load Turso users (users table)
  async function loadTursoUsers() {
    setTursoUsersLoading(true);
    try {
      const params = new URLSearchParams();
      if (tursoUsersFilter === "verified") params.set("verified", "true");
      if (tursoUsersFilter === "unverified") params.set("verified", "false");
      if (tursoUsersQuery.trim()) params.set("q", tursoUsersQuery.trim());
      params.set("limit", "500");
      const resp = await fetch(`/api/users?${params.toString()}`);
      const data = await resp.json();
      if (resp.ok && data?.rows) setTursoUsersRows(data.rows);
    } catch {}
    setTursoUsersLoading(false);
  }

  useEffect(() => {
    loadTursoUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tursoUsersFilter]);

  async function setTursoUserVerified(row: any, isVerified: boolean) {
    try {
      const user_id = (row as any)?.user_id ?? String(row?.uid ?? "");
      await fetch(`/api/users/${encodeURIComponent(user_id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_verified: isVerified,
          app_username: (row as any)?.app_username,
          leetcode_username: (row as any)?.leetcode_username,
        }),
      });
      await loadTursoUsers();
    } catch {}
  }

  // Removed registrations reject; not applicable.

  // Removed registrations delete; not applicable.

  async function toggleVerify(u: UserRow) {
    try {
      // Update Firestore and ensure usernames are present when verifying
      if (!u.is_verified) {
        await updateDoc(doc(db, "users", u.id), {
          is_verified: true,
          appUserName: u.appUserName ?? null,
          leetcodeUsername: u.leetcodeUsername ?? null,
        });
      } else {
        await updateDoc(doc(db, "users", u.id), { is_verified: false });
      }
      // Mirror to Turso users table (authoritative)
      try {
        await fetch(`/api/users/${encodeURIComponent(u.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            is_verified: !u.is_verified,
            app_username: u.appUserName,
            leetcode_username: u.leetcodeUsername,
          }),
        });
      } catch {}
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_verified: !u.is_verified } : x)));
    } catch (e: any) {
      alert(e?.message || "Failed to update");
    }
  }

  async function setUnverified(u: UserRow) {
    try {
      await updateDoc(doc(db, "users", u.id), { is_verified: false });
      try {
        await fetch(`/api/users/${encodeURIComponent(u.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_verified: false }),
        });
      } catch {}
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_verified: false } : x)));
    } catch (e: any) {
      alert(e?.message || "Failed to unverify user");
    }
  }

  async function deleteApplication(u: UserRow) {
    const confirmDelete = window.confirm("Delete this application? This clears usernames and keeps user unverified.");
    if (!confirmDelete) return;
    try {
      // Clear in Turso and set unverified
      try {
        await fetch(`/api/users/${encodeURIComponent(u.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clear_usernames: true }),
        });
      } catch {}
      // Clear in Firestore
      await updateDoc(doc(db, "users", u.id), { appUserName: null, leetcodeUsername: null, is_verified: false });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_verified: false, appUserName: null, leetcodeUsername: null } : x)));
    } catch (e: any) {
      alert(e?.message || "Failed to delete application");
    }
  }

  // reject/delete application flows removed

  const verified = useMemo(() => users.filter((u) => u.is_verified), [users]);
  const pending = useMemo(() => users.filter((u) => !u.is_verified), [users]);
  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const buf = [u.name, u.email, u.appUserName, u.leetcodeUsername, u.dob]
        .map((x) => (x || "").toString().toLowerCase())
        .join(" ");
      return buf.includes(q);
    });
  }, [users, queryText]);

  return (
    <div className="container max-w-5xl mx-auto">
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold mt-4">Admin Dashboard</h1>
        {error && (
          <div className="text-red-300">
            {error}
            <div className="text-white/70 text-sm mt-2">
              If you are an admin and still see this, adjust Firestore rules to allow admins to list users.
            </div>
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-4">
          <section className="glass-panel p-4 rounded-lg">
            <h2 className="font-semibold mb-3">Pending Applications ({pending.length})</h2>
            {loading ? (
              <div className="text-white/70">Loading…</div>
            ) : pending.length === 0 ? (
              <div className="text-white/70">No pending users.</div>
            ) : (
              <ul className="space-y-2">
                {pending.map((u) => (
                  <li key={u.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-md px-3 py-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{u.appUserName || "~"}</div>
                      <div className="text-xs text-white/70 truncate">{u.leetcodeUsername || "(no LC)"} • {u.email || "(no email)"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleVerify(u)} className="px-3 py-1.5 rounded-md bg-green-600/90 hover:bg-green-600 text-white text-sm">Verify</button>
                      <button onClick={() => setUnverified(u)} className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm">Unverify</button>
                      <button onClick={() => deleteApplication(u)} className="px-3 py-1.5 rounded-md bg-red-700/90 hover:bg-red-700 text-white text-sm">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="glass-panel p-4 rounded-lg">
            <h2 className="font-semibold mb-3">Verified Users ({verified.length})</h2>
            {loading ? (
              <div className="text-white/70">Loading…</div>
            ) : verified.length === 0 ? (
              <div className="text-white/70">No verified users.</div>
            ) : (
              <ul className="space-y-2">
                {verified.map((u) => (
                  <li key={u.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-md px-3 py-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{u.appUserName || "~"}</div>
                      <div className="text-xs text-white/70 truncate">{u.leetcodeUsername || "(no LC)"} • {u.email || "(no email)"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleVerify(u)} className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm">Unverify</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <section className="glass-panel p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h2 className="font-semibold">All Registered Users ({users.length})</h2>
            <div className="flex items-center gap-2">
              <input
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Search name, email, app or LC username"
                className="px-3 py-2 rounded-md bg-white/5 border border-white/10 min-w-[260px]"
              />
              <button onClick={load} className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 border border-white/15">Refresh</button>
            </div>
          </div>
          {loading ? (
            <div className="text-white/70">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-white/10">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">App Username</th>
                    <th className="py-2 pr-3">LeetCode</th>
                    <th className="py-2 pr-3">DOB</th>
                    <th className="py-2 pr-3">Verified</th>
                    <th className="py-2 pr-3">Admin</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td className="py-3 text-white/70" colSpan={8}>No users match your search.</td>
                    </tr>
                  ) : (
                    filtered.map((u) => (
                      <tr key={u.id} className="border-b border-white/5">
                        <td className="py-2 pr-3 max-w-[240px] truncate">{u.name || "~"}</td>
                        <td className="py-2 pr-3 max-w-[260px] truncate text-white/80">{u.email || ""}</td>
                        <td className="py-2 pr-3">{u.appUserName || ""}</td>
                        <td className="py-2 pr-3">{u.leetcodeUsername || ""}</td>
                        <td className="py-2 pr-3">{u.dob || "-"}</td>
                        <td className="py-2 pr-3">{u.is_verified ? <span className="text-green-400">Yes</span> : <span className="text-white/70">No</span>}</td>
                        <td className="py-2 pr-3">{(u as any).is_admin ? <span className="text-primary">Yes</span> : <span className="text-white/70">No</span>}</td>
                        <td className="py-2 pr-3">
                          <button
                            onClick={() => toggleVerify(u)}
                            className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white"
                          >
                            {u.is_verified ? "Unverify" : "Verify"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Turso Registrations section removed */}

        {/* Turso Users table (all columns) */}
        <section className="glass-panel p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h2 className="font-semibold">Turso Users ({tursoUsersRows.length})</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                value={tursoUsersQuery}
                onChange={(e) => setTursoUsersQuery(e.target.value)}
                placeholder="Search user_id, app or LC username"
                className="px-3 py-2 rounded-md bg-white/5 border border-white/10 min-w-[260px]"
              />
              <select
                value={tursoUsersFilter}
                onChange={(e) => setTursoUsersFilter(e.target.value as any)}
                className="px-2 py-2 rounded-md bg-white/5 border border-white/10"
              >
                <option value="all">All</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
              </select>
              <button onClick={loadTursoUsers} className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 border border-white/15">Refresh</button>
            </div>
          </div>
          {tursoUsersLoading ? (
            <div className="text-white/70">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-white/10">
                    {(() => {
                      const allKeysSet = new Set<string>();
                      tursoUsersRows.forEach((r) => Object.keys(r || {}).forEach((k) => allKeysSet.add(k)));
                      const preferred = ["user_id", "app_username", "leetcode_username", "is_verified"]; // show these first if present
                      const allKeys = [
                        ...preferred.filter((k) => allKeysSet.has(k)),
                        ...Array.from(allKeysSet).filter((k) => !preferred.includes(k)),
                      ];
                      return (
                        <>
                          {allKeys.map((k) => (
                            <th key={k} className="py-2 pr-3 capitalize">{k.replace(/_/g, " ")}</th>
                          ))}
                          <th className="py-2 pr-3">Actions</th>
                        </>
                      );
                    })()}
                  </tr>
                </thead>
                <tbody>
                  {tursoUsersRows.length === 0 ? (
                    <tr>
                      <td className="py-3 text-white/70" colSpan={99}>No users found.</td>
                    </tr>
                  ) : (
                    tursoUsersRows.map((r, idx) => {
                      const allKeysSet = new Set<string>();
                      tursoUsersRows.forEach((row) => Object.keys(row || {}).forEach((k) => allKeysSet.add(k)));
                      const preferred = ["user_id", "app_username", "leetcode_username", "is_verified"];
                      const allKeys = [
                        ...preferred.filter((k) => allKeysSet.has(k)),
                        ...Array.from(allKeysSet).filter((k) => !preferred.includes(k)),
                      ];
                      return (
                        <tr key={(r as any).user_id ?? idx} className="border-b border-white/5">
                          {allKeys.map((k) => {
                            const v = (r as any)[k];
                            let text: string = "";
                            if (v === null || v === undefined) text = "-";
                            else if (typeof v === "object") text = JSON.stringify(v);
                            else text = String(v);
                            return (
                              <td key={k} className="py-2 pr-3 max-w-[260px] truncate text-white/80">{text}</td>
                            );
                          })}
                          <td className="py-2 pr-3">
                            {((r as any).is_verified === 1 || (r as any).is_verified === true) ? (
                              <button
                                onClick={() => setTursoUserVerified(r, false)}
                                className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white"
                              >
                                Unverify
                              </button>
                            ) : (
                              <button
                                onClick={() => setTursoUserVerified(r, true)}
                                className="px-3 py-1.5 rounded-md bg-green-600/90 hover:bg-green-600 text-white"
                              >
                                Verify
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
