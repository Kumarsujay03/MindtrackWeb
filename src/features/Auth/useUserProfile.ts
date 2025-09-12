import { useEffect, useState } from "react";
import { useAuth } from "@/features/Auth/AuthContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export type UserProfile = {
  activeProfileUrl: string | null;
  email: string | null;
  name: string | null;
  appUserName?: string;
  dob?: string;
  leetcodeUsername?: string;
  gender?: string;
  is_verified?: boolean;
};

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile>({
    activeProfileUrl: user?.photoURL ?? null,
    email: user?.email ?? null,
    name: user?.displayName ?? null,
  });
  const [loading, setLoading] = useState<boolean>(!!user);

  useEffect(() => {
    if (!user) {
      setProfile({ activeProfileUrl: null, email: null, name: null });
      setLoading(false);
      return;
    }
    // Seed with auth user, then subscribe to Firestore for live updates
    setProfile({
      activeProfileUrl: user.photoURL ?? null,
      email: user.email ?? null,
      name: user.displayName ?? null,
    });
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data() as any;
          setProfile({
            activeProfileUrl: d?.activeProfileUrl ?? user.photoURL ?? null,
            email: d?.email ?? user.email ?? null,
            name: d?.name ?? user.displayName ?? null,
            appUserName: d?.appUserName,
            dob: d?.dob,
            leetcodeUsername: d?.leetcodeUsername,
            gender: d?.gender,
            is_verified: d?.is_verified === true,
          });
        }
        setLoading(false);
      },
      () => {
        // On error keep auth values
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  return { profile, loading } as const;
}
