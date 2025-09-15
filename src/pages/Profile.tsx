import { useEffect, useState } from "react";
import { useAuth } from "@/features/Auth/AuthContext";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, query, where, getDocs, updateDoc, serverTimestamp, runTransaction } from "firebase/firestore";
import { formatDateDMY } from "@/lib/utils";

type ProfileData = {
  activeProfileUrl: string | null;
  email: string | null;
  name: string | null;
  appUserName: string;
  dob: string;
  leetcodeUsername: string;
  gender: string;
};

export default function Profile() {
  const { user } = useAuth();
  const AVATAR_ASSETS_DOC_ID = "K3q66kXbP0iVZNBn2ujn";
  const [profile, setProfile] = useState<ProfileData>({
    activeProfileUrl: null,
    email: null,
    name: null,
    appUserName: "~",
    dob: "",
    leetcodeUsername: "",
    gender: "",
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [avatars, setAvatars] = useState<Array<{ name: string; url: string }>>([]);
  const [avatarsLoading, setAvatarsLoading] = useState(false);
  const [avatarsError, setAvatarsError] = useState<string | null>(null);
  const [dobInput, setDobInput] = useState("");
  const [genderInput, setGenderInput] = useState("");
  const [savingProfileInfo, setSavingProfileInfo] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user?.email) {
        setProfile((p) => ({ ...p, activeProfileUrl: user?.photoURL ?? null, email: user?.email ?? null, name: user?.displayName ?? null }));
        return;
      }
      try {
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

  async function openAvatarPicker() {
    setPickerOpen(true);
    if (avatars.length > 0 || avatarsLoading) return;
    setAvatarsLoading(true);
    setAvatarsError(null);
    try {
      const ref = doc(db, "assests", AVATAR_ASSETS_DOC_ID);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error("Avatar catalog not found");
      const list: Array<{ name: string; url: string }> = [];
      const data = snap.data() || {} as Record<string, unknown>;
      Object.entries(data).forEach(([k, v]) => {
        if (typeof v === "string" && /^(https?:)?\/\//i.test(v)) {
          list.push({ name: k, url: v });
        }
      });
      const seen = new Set<string>();
      const dedup = list.filter((a) => (seen.has(a.name) ? false : (seen.add(a.name), true)));
      setAvatars(dedup);
    } catch (e: any) {
      setAvatarsError(e?.message || "Failed to load avatars");
    } finally {
      setAvatarsLoading(false);
    }
  }

  async function chooseAvatar(a: { name: string; url: string }) {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        activeProfileUrl: a.url,
        avatarName: a.name,
        updatedAt: serverTimestamp(),
      });
      setProfile((p) => ({ ...p, activeProfileUrl: a.url }));
      setPickerOpen(false);
    } catch (e) {
    }
  }

  async function saveProfileInfoOnce() {
    if (!user) return;
    setSavingProfileInfo(true);
    try {
      const ref = doc(db, "users", user.uid);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists() ? (snap.data() as any) : {};
        const hasDob = !!data?.dob;
        const hasGender = !!data?.gender;

        if (hasDob && hasGender) {
          throw new Error("Profile already completed.");
        }

        const payload: any = { updatedAt: serverTimestamp() };
        if (!hasDob) {
          if (!dobInput) throw new Error("Please select your Date of Birth.");
          payload.dob = dobInput; // stored as YYYY-MM-DD
        }
        if (!hasGender) {
          if (!genderInput) throw new Error("Please select your Gender.");
          payload.gender = genderInput;
        }

        if (snap.exists()) {
          tx.update(ref, payload);
        } else {
          tx.set(ref, payload, { merge: true });
        }
      });

      setProfile((p) => ({
        ...p,
        dob: p.dob || dobInput,
        gender: p.gender || genderInput,
      }));
      setDobInput("");
      setGenderInput("");
    } catch (e: any) {
      alert(e?.message || "Failed to save. You can set DOB and Gender only once.");
    } finally {
      setSavingProfileInfo(false);
    }
  }

  return (
  <div className="max-w-4xl mx-auto w-full px-4 mt-6">
      <div className="glass-panel p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Profile</h2>

        <div className="flex items-center gap-5 mb-6">
          <div className="relative">
            {profile.activeProfileUrl ? (
              <img
                src={profile.activeProfileUrl}
                alt={profile.name ?? profile.email ?? "User avatar"}
                className="w-20 h-20 rounded-full border border-white/15 object-cover block"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xl text-white/70">
                {initials(profile.name || profile.email)}
              </div>
            )}
            <button
              type="button"
              onClick={openAvatarPicker}
              className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-primary text-black shadow border border-white/20 hover:opacity-90"
              title="Change avatar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="currentColor"/>
                <path d="M20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" fill="currentColor"/>
              </svg>
            </button>
          </div>
          <div>
            <div className="text-lg font-medium">{profile.name ?? "Unnamed"}</div>
            <div className="text-white/70 text-sm">{profile.email ?? "No email"}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="App Username" value={profile.appUserName} />
          <Field label="DOB (DD-MM-YYYY)" value={formatDateDMY(profile.dob)} />
          <Field label="LeetCode Username" value={profile.leetcodeUsername} />
          <Field label="Gender" value={profile.gender} />
        </div>

        {/* One-time completion form for missing DOB/Gender */}
        {(!profile.dob || !profile.gender) && (
          <div className="mt-5 rounded-md border border-white/15 bg-white/5 p-3">
            <div className="text-sm font-medium mb-2">Complete your profile</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!profile.dob && (
                <div>
                  <label className="block text-xs uppercase tracking-wide text-white/60 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={dobInput}
                    onChange={(e) => setDobInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/15 text-white"
                  />
                </div>
              )}
              {!profile.gender && (
                <div>
                  <label className="block text-xs uppercase tracking-wide text-white/60 mb-1">Gender</label>
                  <select
                    value={genderInput}
                    onChange={(e) => setGenderInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/15 text-white"
                  >
                    <option value="">Select…</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              )}
            </div>
            <div className="mt-3">
              <button
                type="button"
                onClick={saveProfileInfoOnce}
                disabled={savingProfileInfo}
                className="px-4 py-2 rounded-md bg-primary/90 hover:bg-primary text-black disabled:opacity-60"
              >
                {savingProfileInfo ? "Saving…" : "Save"}
              </button>
              <span className="ml-3 text-xs text-white/60">You can set these only once.</span>
            </div>
          </div>
        )}
        <div className="mt-6 rounded-md border border-white/15 bg-white/5 overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/10"
            aria-expanded={aboutOpen}
            aria-controls="about-us-panel"
            onClick={() => setAboutOpen((v) => !v)}
          >
            <span className="font-medium">About Us</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`transition-transform ${aboutOpen ? 'rotate-180' : ''}`}
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {aboutOpen && (
            <div id="about-us-panel" className="px-3 pb-3 pt-1 text-sm text-white/85">
              <p>
                MindTrack helps you stay focused, track your progress, and build better study and work habits. We combine simple tools with
                thoughtful design to make consistency feel rewarding.
              </p>
              <p className="mt-2">
                Questions or feedback? Reach us at
                {' '}
                <a href="mailto:reachus.mindtrack@gmail.com" className="text-primary hover:underline">reachus.mindtrack@gmail.com</a>.
              </p>
            </div>
          )}
        </div>
        <div className="mt-6 flex items-center gap-3">
          <a
            href="/PrivacyPolicy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
            aria-label="Open Privacy Policy in a new tab"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V7z" stroke="currentColor" strokeWidth="2"/>
              <path d="M9 7V6a2 2 0 0 1 2-2h6" stroke="currentColor" strokeWidth="2" opacity=".6"/>
              <path d="M9 11h6M9 15h4" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Privacy Policy
          </a>
          <span className="text-white/60 text-xs">Opens in a new tab</span>
        </div>
      </div>
      <div className="mt-4 text-center text-xs text-white/60">
        Made with <span role="img" aria-label="love">♥</span>
      </div>
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPickerOpen(false)} />
          <div className="relative glass-panel rounded-lg p-4 max-w-2xl w-[90%] max-h-[80vh] overflow-auto border border-white/15">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Choose your avatar</h3>
              <button onClick={() => setPickerOpen(false)} className="p-2 rounded-md bg-white/10 hover:bg-white/15" aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            {avatarsLoading ? (
              <div className="text-white/70">Loading avatars…</div>
            ) : avatarsError ? (
              <div className="text-red-300">{avatarsError}</div>
            ) : avatars.length === 0 ? (
              <div className="text-white/70">No avatars available.</div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                {avatars.map((a) => {
                  const isActive = a.url === profile.activeProfileUrl;
                  return (
                    <button
                      key={a.name}
                      onClick={() => chooseAvatar(a)}
                      className="group"
                      title={a.name}
                      aria-label={a.name}
                    >
                      <img
                        src={a.url}
                        alt={a.name}
                        className={`w-16 h-16 rounded-full object-cover border group-hover:scale-105 transition ${isActive ? 'border-primary ring-2 ring-primary/60' : 'border-white/15'}`}
                        referrerPolicy="no-referrer"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
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
