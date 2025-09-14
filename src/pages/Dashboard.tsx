import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/features/Auth/AuthContext";

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
  useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [queryText, setQueryText] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  // Turso Users table state
  const [tursoLoading, setTursoLoading] = useState<boolean>(false);
  const [tursoError, setTursoError] = useState<string | null>(null);
  const [tursoRows, setTursoRows] = useState<any[]>([]);
  const [tursoColumns, setTursoColumns] = useState<string[]>([]);
  const [tursoTotal, setTursoTotal] = useState<number>(0);
  const [tursoLimit, setTursoLimit] = useState<number>(50);
  const [tursoOffset, setTursoOffset] = useState<number>(0);
  const [tursoQuery, setTursoQuery] = useState<string>("");
  // Removed Turso registrations section in favor of direct users table management

  // Turso section removed

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

  async function loadTurso(opts?: { offset?: number; query?: string; limit?: number }) {
    setTursoLoading(true);
    setTursoError(null);
    try {
      const p = new URLSearchParams();
      const q = opts?.query ?? tursoQuery;
      const limit = opts?.limit ?? tursoLimit;
      const offset = opts?.offset ?? tursoOffset;
      if (q) p.set("q", q);
      p.set("limit", String(limit));
      p.set("offset", String(offset));
      const res = await fetch(`/api/users?${p.toString()}`);
      const raw = await res.text();
      if (!res.ok) throw new Error(raw || `API error ${res.status}`);
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(raw?.slice(0, 300) || "Invalid JSON from /api/users");
      }
      if (!data?.ok && !Array.isArray(data?.rows)) throw new Error(data?.error || "Unexpected response");
      setTursoColumns(Array.isArray(data.columns) ? data.columns : []);
      setTursoRows(Array.isArray(data.rows) ? data.rows : []);
      setTursoTotal(typeof data.total === "number" ? data.total : 0);
      setTursoLimit(typeof data.limit === "number" ? data.limit : 50);
      setTursoOffset(typeof data.offset === "number" ? data.offset : 0);
    } catch (e: any) {
      setTursoError(e?.message || "Failed to load Turso users");
    } finally {
      setTursoLoading(false);
    }
  }

  useEffect(() => {
    // initial load of turso table
    loadTurso({ offset: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleVerify(u: UserRow) {
    try {
      setBusyId(u.id);
      if (!u.is_verified) {
        // Verifying: require both usernames
        const app = (u.appUserName || "").trim();
        const lc = (u.leetcodeUsername || "").trim();
        if (!app || !lc) {
          throw new Error("App username and LeetCode username are required to verify");
        }
        // 1) Call API to upsert Turso user and enforce uniqueness
        const resp = await fetch("/api/verify-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: u.id, app_username: app, leetcode_username: lc }),
        });
        const raw = await resp.text();
        if (!resp.ok) throw new Error(raw || `API error ${resp.status}`);
        let payload: any = {};
        try { payload = JSON.parse(raw || "{}"); } catch {}
        if (!payload?.ok) throw new Error(payload?.error || "Failed to verify user in Turso");

        // 2) Update Firestore (save usernames and verified flag)
        await updateDoc(doc(db, "users", u.id), {
          is_verified: true,
          appUserName: app,
          leetcodeUsername: lc,
          adminNotice: null,
          adminLastAction: {
            type: "verify",
            reason: null,
            at: serverTimestamp(),
          },
        });
      } else {
        // Unverify only affects Firestore per current requirement
        const reason = window.prompt("Reason for un-verifying this user?", "Violation of rules / incorrect usernames");
        await updateDoc(doc(db, "users", u.id), {
          is_verified: false,
          adminNotice: {
            type: "unverify",
            reason: (reason || "").trim() || null,
            at: serverTimestamp(),
          },
          adminLastAction: {
            type: "unverify",
            reason: (reason || "").trim() || null,
            at: serverTimestamp(),
          },
        });
      }
      // Reload to ensure lists and counts are accurate
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to update");
    }
    finally {
      setBusyId(null);
    }
  }

  async function setUnverified(u: UserRow) {
    try {
      setBusyId(u.id);
      const reason = window.prompt("Reason for un-verifying this user?", "Violation of rules / incorrect usernames");
      await updateDoc(doc(db, "users", u.id), {
        is_verified: false,
        adminNotice: {
          type: "unverify",
          reason: (reason || "").trim() || null,
          at: serverTimestamp(),
        },
        adminLastAction: {
          type: "unverify",
          reason: (reason || "").trim() || null,
          at: serverTimestamp(),
        },
      });
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to unverify user");
    }
    finally {
      setBusyId(null);
    }
  }

  async function deleteApplication(u: UserRow) {
    const confirmDelete = window.confirm("Delete this application? This clears usernames and keeps user unverified.");
    if (!confirmDelete) return;
    try {
      setBusyId(u.id);
      const reason = window.prompt("Reason for deleting this application?", "Invalid or duplicate usernames / other");
      // Also delete from Turso users table
      try {
        const resp = await fetch("/api/delete-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: u.id }),
        });
        // read text then ignore errors (not blocking Firestore cleanup)
        await resp.text();
      } catch {}
      // Clear in Firestore so the user must apply again
      await updateDoc(doc(db, "users", u.id), {
        appUserName: null,
        leetcodeUsername: null,
        is_verified: false,
        adminNotice: {
          type: "delete",
          reason: (reason || "").trim() || null,
          at: serverTimestamp(),
        },
        adminLastAction: {
          type: "delete",
          reason: (reason || "").trim() || null,
          at: serverTimestamp(),
        },
      });
      // Optimistic update: clear immediately
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, appUserName: null, leetcodeUsername: null, is_verified: false } : x)));
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to delete application");
    }
    finally {
      setBusyId(null);
    }
  }

  // reject/delete application flows removed

  function nonEmpty(s: string | null | undefined) {
    return typeof s === "string" && s.trim().length > 0;
  }
  const verified = useMemo(() => users.filter((u) => u.is_verified), [users]);
  const pending = useMemo(
    () => users.filter((u) => !u.is_verified && nonEmpty(u.appUserName) && nonEmpty(u.leetcodeUsername)),
    [users]
  );
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
                      <button disabled={busyId===u.id} onClick={() => toggleVerify(u)} className="px-3 py-1.5 rounded-md bg-green-600/90 hover:bg-green-600 text-white text-sm disabled:opacity-60">Verify</button>
                      <button disabled={busyId===u.id} onClick={() => setUnverified(u)} className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm disabled:opacity-60">Unverify</button>
                      <button disabled={busyId===u.id} onClick={() => deleteApplication(u)} className="px-3 py-1.5 rounded-md bg-red-700/90 hover:bg-red-700 text-white text-sm disabled:opacity-60">Delete</button>
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
                      <button disabled={busyId===u.id} onClick={() => toggleVerify(u)} className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white text-sm disabled:opacity-60">Unverify</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Turso DB Users table */}
        <section className="glass-panel p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h2 className="font-semibold">Users (Turso DB){tursoTotal ? ` — ${tursoTotal}` : ""}</h2>
            <div className="flex items-center gap-2">
              <input
                value={tursoQuery}
                onChange={(e) => setTursoQuery(e.target.value)}
                placeholder="Search (server-side)"
                className="px-3 py-2 rounded-md bg-white/5 border border-white/10 min-w-[220px]"
              />
              <button
                onClick={() => {
                  setTursoOffset(0);
                  loadTurso({ offset: 0, query: tursoQuery });
                }}
                className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 border border-white/15"
              >
                Search
              </button>
              <button
                onClick={() => loadTurso()}
                className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 border border-white/15"
              >
                Refresh
              </button>
            </div>
          </div>
          {tursoError && <div className="text-red-300 mb-2">{tursoError}</div>}
          {tursoLoading ? (
            <div className="text-white/70">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-white/10">
                    {(tursoColumns.length ? tursoColumns : Object.keys(tursoRows[0] || {})).slice(0, 8).map((c) => (
                      <th key={c} className="py-2 pr-3 capitalize">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tursoRows.length === 0 ? (
                    <tr>
                      <td className="py-3 text-white/70" colSpan={Math.max(1, (tursoColumns.length || Object.keys(tursoRows[0] || {}).length))}>
                        No rows.
                      </td>
                    </tr>
                  ) : (
                    tursoRows.map((row, idx) => {
                      const keys = (tursoColumns.length ? tursoColumns : Object.keys(row)).slice(0, 8);
                      return (
                        <tr key={idx} className="border-b border-white/5">
                          {keys.map((k) => (
                            <td key={k} className="py-2 pr-3 max-w-[240px] truncate text-white/90">
                              {formatCell(row[k])}
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              <div className="flex items-center justify-between mt-3">
                <div className="text-white/70 text-sm">
                  Showing {tursoRows.length ? tursoOffset + 1 : 0}–{tursoOffset + tursoRows.length} of {tursoTotal}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={tursoOffset <= 0}
                    onClick={() => {
                      const next = Math.max(0, tursoOffset - tursoLimit);
                      setTursoOffset(next);
                      loadTurso({ offset: next });
                    }}
                    className="px-3 py-1.5 rounded-md bg-white/10 enabled:hover:bg-white/15 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    disabled={tursoOffset + tursoLimit >= tursoTotal}
                    onClick={() => {
                      const next = tursoOffset + tursoLimit;
                      setTursoOffset(next);
                      loadTurso({ offset: next });
                    }}
                    className="px-3 py-1.5 rounded-md bg-white/10 enabled:hover:bg-white/15 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
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
                            disabled={busyId===u.id}
                            onClick={() => toggleVerify(u)}
                            className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white disabled:opacity-60"
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

        {/* Turso section removed */}
      </div>
    </div>
  );
}

function formatCell(v: any) {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return v.toISOString();
  try {
    // stringify objects/arrays safely but compact
    if (typeof v === "object") return JSON.stringify(v);
  } catch {}
  return String(v);
}
