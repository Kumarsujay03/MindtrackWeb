import { useEffect, useState } from "react";
import { useAuth } from "@/features/Auth/AuthContext";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, query, where, getDocs } from "firebase/firestore";

type ProfileData = {
  activeProfileUrl: string | null;
  email: string | null;
  name: string | null;
  appUserName: string; // default '~'
  dob: string; // YYYY-MM-DD or ''
  leetcodeUsername: string;
  gender: string;
};

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData>({
    activeProfileUrl: null,
    email: null,
    name: null,
    appUserName: "~",
    dob: "",
    leetcodeUsername: "",
    gender: "",
  });

  useEffect(() => {
    async function load() {
      if (!user?.email) {
        setProfile((p) => ({ ...p, activeProfileUrl: user?.photoURL ?? null, email: user?.email ?? null, name: user?.displayName ?? null }));
        return;
      }
      try {
        // Try user doc by UID first, then fallback to email.
        const byUidRef = user.uid ? doc(db, "users", user.uid) : null;
        const snap = byUidRef ? await getDoc(byUidRef) : null;
        let data: any | null = null;
        if (snap && snap.exists()) {
          data = snap.data();
        } else {
          const q = query(collection(db, "users"), where("email", "==", user.email));
          const qs = await getDocs(q);
          data = qs.docs[0]?.data() ?? null;
        }

        setProfile({
          activeProfileUrl: data?.activeProfileUrl ?? (user.photoURL ?? null),
          email: data?.email ?? user.email ?? null,
          name: data?.name ?? user.displayName ?? null,
          appUserName: data?.appUserName ?? "~",
          dob: data?.dob ?? "",
          leetcodeUsername: data?.leetcodeUsername ?? "",
          gender: data?.gender ?? "",
        });
      } catch (e) {
        // Fallback to auth user only
        setProfile({
          activeProfileUrl: user?.photoURL ?? null,
          email: user?.email ?? null,
          name: user?.displayName ?? null,
          appUserName: "~",
          dob: "",
          leetcodeUsername: "",
          gender: "",
        });
      }
    }
    load();
  }, [user]);

  return (
    <div className="max-w-4xl mx-auto w-full px-4">
      <div className="glass-panel p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Profile</h2>

        <div className="flex items-center gap-5 mb-6">
          {profile.activeProfileUrl ? (
            <img
              src={profile.activeProfileUrl}
              alt={profile.name ?? profile.email ?? "User avatar"}
              className="w-20 h-20 rounded-full border border-white/15 object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xl text-white/70">
              {initials(profile.name || profile.email)}
            </div>
          )}
          <div>
            <div className="text-lg font-medium">{profile.name ?? "Unnamed"}</div>
            <div className="text-white/70 text-sm">{profile.email ?? "No email"}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="App Username" value={profile.appUserName} />
          <Field label="DOB (YYYY-MM-DD)" value={profile.dob} />
          <Field label="LeetCode Username" value={profile.leetcodeUsername} />
          <Field label="Gender" value={profile.gender} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/15 bg-white/5 p-3">
      <div className="text-xs uppercase tracking-wide text-white/60">{label}</div>
      <div className="mt-1 text-white/90">{value || <span className="text-white/40">(blank)</span>}</div>
    </div>
  );
}

function initials(text: string | null | undefined) {
  if (!text) return "?";
  const parts = text.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || text[0]?.toUpperCase() || "?";
}
