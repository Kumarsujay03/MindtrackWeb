import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/Auth/AuthContext";
import { db } from "@/lib/firebase";
import { doc, setDoc, updateDoc, serverTimestamp, getDoc, collection, query, where, getDocs, onSnapshot, documentId } from "firebase/firestore";

export default function Leaderboard() {
  const { user } = useAuth();
  const MAX_VIOLATIONS = 2;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appUserName, setAppUserName] = useState("");
  const [leetcodeUsername, setLeetcodeUsername] = useState("");
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [isRejected, setIsRejected] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [adminBanner, setAdminBanner] = useState<{ type: string; reason?: string | null } | null>(null);
  const [violationCount, setViolationCount] = useState<number>(0);
  const [reapplyMode, setReapplyMode] = useState<boolean>(false);
  const [lbRows, setLbRows] = useState<Array<{ user_id: string; username: string; streak: number; total_solved?: number }>>([]);
  const [lbTotal, setLbTotal] = useState<number>(0);
  const [lbLimit, setLbLimit] = useState<number>(50);
  const [lbOffset, setLbOffset] = useState<number>(0);
  const [myRank, setMyRank] = useState<{ user_id: string; username: string; streak: number; total_solved?: number; rank: number } | null>(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [avatarMap, setAvatarMap] = useState<Record<string, string | null>>({});

  function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  function colorFrom(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360} 70% 40%)`;
  }
  const myPageOffset = useMemo(() => {
    if (!myRank) return 0;
    return Math.floor((myRank.rank - 1) / lbLimit) * lbLimit;
  }, [myRank, lbLimit]);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const d = snap.data() as any;
        setAppUserName(d?.appUserName ?? "");
        setLeetcodeUsername(d?.leetcodeUsername ?? "");
        setIsVerified(!!d?.is_verified);
        setMyAvatarUrl(d?.activeProfileUrl ?? (user?.photoURL ?? null));
        setIsRejected(false);
        setSubmitted(!!(d?.appUserName && d?.leetcodeUsername) && !d?.is_verified);
        if (d?.adminLastAction) {
          setAdminBanner({ type: d.adminLastAction.type || "", reason: d.adminLastAction.reason ?? null });
        } else {
          setAdminBanner(null);
        }
        setViolationCount(Number(d?.violationCount || 0));
      } else {
        setSubmitted(false);
        setIsVerified(false);
        setAdminBanner(null);
        setViolationCount(0);
        setMyAvatarUrl(user?.photoURL ?? null);
      }
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isVerified) return;
      try {
        const p = new URLSearchParams();
        p.set("limit", String(lbLimit));
        p.set("offset", String(lbOffset));
        if (user?.uid) p.set("user_id", user.uid);
        const res = await fetch(`/api/leaderboard?${p.toString()}`);
        const raw = await res.text();
        if (!res.ok) throw new Error(raw || `API error ${res.status}`);
        let data: any = {};
        try { data = JSON.parse(raw); } catch { throw new Error("Invalid JSON from /api/leaderboard"); }
        if (!data?.ok) throw new Error(data?.error || "Unexpected response");
        if (!cancelled) {
          setLbRows(Array.isArray(data.rows) ? data.rows : []);
          setLbTotal(typeof data.total === "number" ? data.total : 0);
          setLbLimit(typeof data.limit === "number" ? data.limit : 50);
          setLbOffset(typeof data.offset === "number" ? data.offset : 0);
          setMyRank(data.my ?? null);
        }
      } catch (e: any) {
        if (!cancelled) console.error(e);
      }
    })();
    return () => { cancelled = true; };
  }, [isVerified, lbLimit, lbOffset, user?.uid]);

  useEffect(() => {
    if (!lbRows.length) return;
    const ids = Array.from(new Set(lbRows.map((r) => r.user_id)));
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
    let cancelled = false;
    (async () => {
      const newMap: Record<string, string | null> = {};
      for (const chunk of chunks) {
        try {
          const q = query(collection(db, "users"), where(documentId(), "in", chunk));
          const snap = await getDocs(q);
          snap.forEach((d) => {
            const data = d.data() as any;
            newMap[d.id] = (data?.activeProfileUrl ?? null) as string | null;
          });
        } catch {}
      }
      if (!cancelled) {
        setAvatarMap((prev) => ({ ...prev, ...newMap }));
      }
    })();
    return () => { cancelled = true; };
  }, [db, lbRows]);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setError("Please sign in first.");
      return;
    }
    if (violationCount >= MAX_VIOLATIONS) {
      setError("You have exceeded the maximum number of violations and cannot apply again. Please contact support.");
      return;
    }
    const app = appUserName.trim();
    const lc = leetcodeUsername.trim();
    if (!app || !lc) {
      setError("Both usernames are required.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const usersCol = collection(db, "users");
      const q1 = query(usersCol, where("appUserName", "==", app));
      const q2 = query(usersCol, where("leetcodeUsername", "==", lc));
      const [r1, r2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const appTaken = r1.docs.some((d) => d.id !== user.uid);
      if (appTaken) throw new Error("App username is already taken.");
      const lcTaken = r2.docs.some((d) => d.id !== user.uid);
      if (lcTaken) throw new Error("LeetCode username is already taken.");

      const ref = doc(db, "users", user.uid);
      const payload = {
        appUserName: app,
        leetcodeUsername: lc,
        is_verified: false,
        name: user.displayName ?? null,
        email: user.email ?? null,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      } as any;
      const existing = await getDoc(ref);
      if (existing.exists()) {
        await updateDoc(ref, payload);
      } else {
        await setDoc(ref, payload);
      }
      setSubmitted(true);
      setReapplyMode(false);
    } catch (err: any) {
      setError(err?.message || "Failed to apply. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleWithdraw() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, { appUserName: null, leetcodeUsername: null, is_verified: false, updatedAt: serverTimestamp() });
      }
      setAppUserName("");
      setLeetcodeUsername("");
      setSubmitted(false);
      setIsVerified(false);
    } catch (e: any) {
      setError(e?.message || "Failed to withdraw application");
    } finally {
      setLoading(false);
    }
  }

  return (
  <div className="max-w-4xl mx-auto w-150 px-4 mt-6">
      <div className="glass-panel p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Leaderboard</h2>

        {!user ? (
          <p className="text-white/80">Please sign in to apply and view the leaderboard.</p>
        ) : (
          <>
            {!isVerified && adminBanner && (
              <div className="mb-4 p-3 rounded-md border border-white/15 bg-white/5 text-white/90">
                Admin action: <span className="font-medium capitalize">{adminBanner.type}</span>
                {adminBanner.reason ? (
                  <>
                    <span className="mx-1">—</span>
                    <span className="text-white/80">{adminBanner.reason}</span>
                  </>
                ) : null}
                {violationCount > 0 && (
                  <div className="text-xs text-white/70 mt-1">Violations: {violationCount} / {MAX_VIOLATIONS}</div>
                )}
              </div>
            )}

            {isRejected && (
              <div className="mb-4 p-3 rounded-md border border-red-300/30 bg-red-600/10 text-red-200">
                Your application was rejected. You can resubmit with different usernames.
              </div>
            )}

            {!isVerified && (!submitted || reapplyMode) ? (
              <form onSubmit={handleApply} className="space-y-3 mb-6">
                {violationCount >= MAX_VIOLATIONS ? (
                  <div className="p-3 rounded-md border border-red-300/30 bg-red-600/10 text-red-200">
                    You cannot apply again due to repeated violations. Please contact support.
                  </div>
                ) : adminBanner?.type === "unverify" ? (
                  <div className="p-3 rounded-md border border-orange-300/30 bg-orange-600/10 text-orange-200">
                    You were unverified by an admin{adminBanner.reason ? `: ${adminBanner.reason}` : "."} You may re-apply now, but if this happens again you will be blocked from re-applying.
                  </div>
                ) : null}

                <div>
                  <label className="block text-sm mb-1">LeetCode Username</label>
                  <input
                    type="text"
                    value={leetcodeUsername}
                    onChange={(e) => setLeetcodeUsername(e.target.value)}
                    className="w-130 px-3 py-2 rounded-md bg-white/5 border border-white/15"
                    placeholder="e.g. johndoe123"
                    disabled={violationCount >= MAX_VIOLATIONS}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">App Username</label>
                  <input
                    type="text"
                    value={appUserName}
                    onChange={(e) => setAppUserName(e.target.value)}
                    className="w-130 px-3 py-2 rounded-md bg-white/5 border border-white/15"
                    placeholder="Choose a unique handle"
                    disabled={violationCount >= MAX_VIOLATIONS}
                  />
                </div>
                {error && <div className="text-red-300 text-sm">{error}</div>}
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={loading || violationCount >= MAX_VIOLATIONS}
                    className="px-4 py-2 rounded-md bg-primary/90 hover:bg-primary text-black disabled:opacity-60"
                  >
                    {loading ? "Applying…" : reapplyMode ? "Submit Re-application" : "Apply"}
                  </button>
                  {submitted && adminBanner?.type === "unverify" && violationCount < MAX_VIOLATIONS && !reapplyMode && (
                    <button
                      type="button"
                      onClick={() => setReapplyMode(true)}
                      className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/15 text-black"
                    >
                      Edit & Re-apply
                    </button>
                  )}
                  {reapplyMode && (
                    <button
                      type="button"
                      onClick={() => setReapplyMode(false)}
                      className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/15 text-white"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            ) : !isVerified ? (
              <div className="space-y-3 mb-6">
                {adminBanner?.type === "unverify" ? (
                  violationCount >= MAX_VIOLATIONS ? (
                    <div className="p-3 rounded-md border border-red-300/30 bg-red-600/10 text-red-200">
                      You were unverified by an admin{adminBanner.reason ? `: ${adminBanner.reason}` : "."} Due to repeated violations, you can no longer re-apply. Please contact support.
                    </div>
                  ) : (
                    <div className="p-3 rounded-md border border-orange-300/30 bg-orange-600/10 text-orange-200">
                      You were unverified by an admin{adminBanner.reason ? `: ${adminBanner.reason}` : "."} You may re-apply now, but if this happens again you will be blocked from re-applying.
                    </div>
                  )
                ) : (
                  <div className="p-3 rounded-md border border-blue-300/30 bg-blue-600/10 text-blue-200">
                    Your application has been submitted. Waiting for admin verification.
                  </div>
                )}
                {adminBanner?.type !== "unverify" && (
                  <button
                    onClick={handleWithdraw}
                    disabled={loading}
                    className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/15 text-white disabled:opacity-60"
                  >
                    Withdraw Application
                  </button>
                )}
              </div>
            ) : null}

            {isVerified ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Top Streaks</h3>
                  <div className="text-white/70 text-sm">Showing {lbRows.length ? lbOffset + 1 : 0}–{lbOffset + lbRows.length} of {lbTotal}</div>
                </div>
                {myRank && (myRank.rank <= lbOffset || myRank.rank > lbOffset + lbRows.length) && (
                  <div className="p-3 rounded-md border border-primary/30 bg-primary/10 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold overflow-hidden shrink-0 -translate-y-0.5" style={{ background: myAvatarUrl ? undefined : colorFrom(myRank.username) }}>
                        {myAvatarUrl ? (
                          <img src={myAvatarUrl} alt="me" className="w-full h-full object-cover rounded-full block" referrerPolicy="no-referrer" />
                        ) : (
                          <span>{initials(myRank.username)}</span>
                        )}
                      </div>
                      <div>
                        <div className="text-sm">Your Rank: <span className="font-semibold">#{myRank.rank}</span></div>
                        <div className="text-xs text-white/80">{myRank.username} — Streak {myRank.streak}</div>
                      </div>
                    </div>
                    <button
                      className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15"
                      onClick={() => setLbOffset(myPageOffset)}
                    >
                      Jump to my rank
                    </button>
                  </div>
                )}
                {lbRows.length === 0 ? (
                  <div className="text-white/70">No verified users yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b border-white/10">
                          <th className="py-2 pr-3">Rank</th>
                          <th className="py-2 pr-3">Username</th>
                          <th className="py-2 pr-3">Streak</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lbRows.map((r, i) => {
                          const isMe = !!user && r.user_id === user.uid;
                          return (
                            <tr key={r.user_id} className={`border-b border-white/5 ${isMe ? "bg-primary/10" : ""}`}>
                              <td className="py-2 pr-3 font-medium">{lbOffset + i + 1}</td>
                              <td className="py-2 pr-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold overflow-hidden shrink-0 -translate-y-0.5"
                                       style={{ background: (isMe ? myAvatarUrl : avatarMap[r.user_id]) ? undefined : colorFrom(r.username) }}>
                                    {(isMe ? myAvatarUrl : avatarMap[r.user_id]) ? (
                                      <img src={(isMe ? myAvatarUrl : avatarMap[r.user_id]) as string} alt={r.username} className="w-full h-full object-cover rounded-full block" referrerPolicy="no-referrer" />
                                    ) : (
                                      <span>{initials(r.username)}</span>
                                    )}
                                  </div>
                                  <span className={isMe ? "font-semibold" : ""}>{r.username}</span>
                                </div>
                              </td>
                              <td className="py-2 pr-3">{r.streak ?? 0}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {lbTotal > lbLimit && (
                      <div className="flex items-center justify-end gap-2 mt-3">
                        <button
                          className="px-3 py-1.5 rounded-md bg-white/10 enabled:hover:bg-white/15 disabled:opacity-50"
                          disabled={lbOffset <= 0}
                          onClick={() => setLbOffset(Math.max(0, lbOffset - lbLimit))}
                        >
                          Prev
                        </button>
                        <button
                          className="px-3 py-1.5 rounded-md bg-white/10 enabled:hover:bg-white/15 disabled:opacity-50"
                          disabled={lbOffset + lbLimit >= lbTotal}
                          onClick={() => setLbOffset(lbOffset + lbLimit)}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-white/70 text-sm">
                After verification, you'll be able to view and compete on the leaderboard.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
