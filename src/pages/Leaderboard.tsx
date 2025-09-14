import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/Auth/AuthContext";
import { db } from "@/lib/firebase";
import { doc, setDoc, updateDoc, serverTimestamp, getDoc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore";

export default function Leaderboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appUserName, setAppUserName] = useState("");
  const [leetcodeUsername, setLeetcodeUsername] = useState("");
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [isRejected, setIsRejected] = useState<boolean>(false);
  // derived from snapshot presence
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [adminBanner, setAdminBanner] = useState<{ type: string; reason?: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, async (snap) => {
      if (snap.exists()) {
        const d = snap.data() as any;
        setAppUserName(d?.appUserName ?? "");
        setLeetcodeUsername(d?.leetcodeUsername ?? "");
  // hasProfile implied by snapshot exists
        setIsVerified(!!d?.is_verified);
        setIsRejected(false);
        setSubmitted(!!(d?.appUserName && d?.leetcodeUsername) && !d?.is_verified);

        // Admin notices
        if (d?.adminLastAction) {
          setAdminBanner({ type: d.adminLastAction.type || "", reason: d.adminLastAction.reason ?? null });
        } else {
          setAdminBanner(null);
        }
      } else {
  // hasProfile false implied
        setSubmitted(false);
        setIsVerified(false);
        setAdminBanner(null);
      }
    });
    return () => unsub();
  }, [user]);

  const pending = useMemo(() => submitted && !isVerified, [submitted, isVerified]);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setError("Please sign in first.");
      return;
    }
    // If admin unverified the application, user cannot re-apply until admin deletes it
    if (adminBanner?.type === "unverify") {
      setError("You cannot re-apply. An admin unverified your application. Please wait until an admin deletes your application.");
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
      // Validate uniqueness against Firestore 'users' collection
      // Exclude current user's doc
      const usersCol = collection(db, "users");
      const q1 = query(usersCol, where("appUserName", "==", app));
      const q2 = query(usersCol, where("leetcodeUsername", "==", lc));
      const [r1, r2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const appTaken = r1.docs.some((d) => d.id !== user.uid);
      if (appTaken) throw new Error("App username is already taken.");
      const lcTaken = r2.docs.some((d) => d.id !== user.uid);
      if (lcTaken) throw new Error("LeetCode username is already taken.");

      // Save minimal info into Firestore users/{uid}
      const ref = doc(db, "users", user.uid);
      const payload = {
        appUserName: app,
        leetcodeUsername: lc,
        is_verified: false,
        name: user.displayName ?? null,
        email: user.email ?? null,
        activeProfileUrl: user.photoURL ?? null,
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
    } catch (err: any) {
      setError(err?.message || "Failed to apply. Try again.");
    } finally {
      setLoading(false);
  // hasProfile implied by saved doc
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
    <div className="max-w-4xl mx-auto w-150 px-4">
      <div className="glass-panel p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Leaderboard</h2>

        {!user ? (
          <p className="text-white/80">Please sign in to apply and view the leaderboard.</p>
        ) : (
          <>
            {adminBanner && (
              <div className="mb-4 p-3 rounded-md border border-white/15 bg-white/5 text-white/90">
                Admin action: <span className="font-medium capitalize">{adminBanner.type}</span>
                {adminBanner.reason ? <><span className="mx-1">—</span><span className="text-white/80">{adminBanner.reason}</span></> : null}
              </div>
            )}
            {isRejected && (
              <div className="mb-4 p-3 rounded-md border border-red-300/30 bg-red-600/10 text-red-200">
                Your application was rejected. You can resubmit with different usernames.
              </div>
            )}

            {!submitted ? (
            <form onSubmit={handleApply} className="space-y-3 mb-6">
              <div>
                <label className="block text-sm mb-1">LeetCode Username</label>
                <input
                  type="text"
                  value={leetcodeUsername}
                  onChange={(e) => setLeetcodeUsername(e.target.value)}
                  className="w-130 px-3 py-2 rounded-md bg-white/5 border border-white/15"
                  placeholder="e.g. johndoe123"
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
                />
              </div>
              {error && (
                <div className="text-red-300 text-sm">{error}</div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-md bg-primary/90 hover:bg-primary text-white disabled:opacity-60"
              >
                {loading ? "Applying…" : "Apply"}
              </button>
            </form>
            ) : (
              <div className="space-y-3 mb-6">
                {adminBanner?.type === "unverify" ? (
                  <div className="p-3 rounded-md border border-orange-300/30 bg-orange-600/10 text-orange-200">
                    Your application was unverified by an admin{adminBanner.reason ? `: ${adminBanner.reason}` : "."} You cannot re-apply until an admin allows you for reapplication. For clasrification, contact support.
                  </div>
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
            )}

            {isVerified ? (
              <div className="text-white/80">Verified users' leaderboard will appear here.</div>
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
