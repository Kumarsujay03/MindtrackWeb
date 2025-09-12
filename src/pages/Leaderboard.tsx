import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/Auth/AuthContext";
import { db } from "@/lib/firebase";
import { doc, setDoc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";

export default function Leaderboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appUserName, setAppUserName] = useState("");
  const [leetcodeUsername, setLeetcodeUsername] = useState("");
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [isRejected, setIsRejected] = useState<boolean>(false);
  const [hasProfile, setHasProfile] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    async function fetchProfile() {
      if (!user) return;
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (!mounted) return;
      if (snap.exists()) {
        const d = snap.data() as any;
        setAppUserName(d?.appUserName ?? "");
        setLeetcodeUsername(d?.leetcodeUsername ?? "");
        setHasProfile(true);
        // Fetch SQL registration status
        try {
          const resp = await fetch(`/api/registrations/${user.uid}`);
          if (resp.ok) {
            const data = await resp.json();
            setIsVerified(data?.status === "verified");
            setIsRejected(data?.status === "rejected");
          } else {
            setIsVerified(!!d?.is_verified);
            setIsRejected(false);
          }
        } catch {
          setIsVerified(!!d?.is_verified);
          setIsRejected(false);
        }
      } else {
        setHasProfile(false);
      }
    }
    fetchProfile();
    return () => {
      mounted = false;
    };
  }, [user]);

  const pending = useMemo(() => hasProfile && !isVerified, [hasProfile, isVerified]);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setError("Please sign in first.");
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
      // Call SQL-backed registrations API to create/update
      const resp = await fetch(`/api/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user.uid,
          display_name: user.displayName ?? null,
          email: user.email ?? null,
          avatar_url: user.photoURL ?? null,
          app_username: app,
          leetcode_username: lc,
          status: "pending",
        }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j?.error || `Failed to apply (${resp.status})`);
      }

      // Also mirror minimal info into Firestore users/{uid}
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
    } catch (err: any) {
      setError(err?.message || "Failed to apply. Try again.");
    } finally {
      setLoading(false);
      // Refresh SQL registration status
      try {
        const r = await fetch(`/api/registrations/${user.uid}`);
        if (r.ok) {
          const d = await r.json();
          setIsVerified(d?.status === "verified");
          setHasProfile(true);
        }
      } catch {}
    }
  }

  return (
    <div className="max-w-4xl mx-auto w-full px-4">
      <div className="glass-panel p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Leaderboard</h2>

        {!user ? (
          <p className="text-white/80">Please sign in to apply and view the leaderboard.</p>
        ) : (
          <>
            {pending && (
              <div className="mb-4 p-3 rounded-md border border-yellow-300/30 bg-yellow-500/10 text-yellow-200">
                Your application is pending admin approval. Please wait.
              </div>
            )}
            {isRejected && (
              <div className="mb-4 p-3 rounded-md border border-red-300/30 bg-red-600/10 text-red-200">
                Your application was rejected. You can resubmit with different usernames.
              </div>
            )}

            <form onSubmit={handleApply} className="space-y-3 mb-6">
              <div>
                <label className="block text-sm mb-1">LeetCode Username</label>
                <input
                  type="text"
                  value={leetcodeUsername}
                  onChange={(e) => setLeetcodeUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/15"
                  placeholder="e.g. johndoe123"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">App Username</label>
                <input
                  type="text"
                  value={appUserName}
                  onChange={(e) => setAppUserName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/15"
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
