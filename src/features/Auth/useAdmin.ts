import { useEffect, useState } from "react";
import { getIdTokenResult } from "firebase/auth";
import { useAuth } from "@/features/Auth/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

function envAdminFallback(email: string | null | undefined) {
  if (!email) return false;
  const list = (import.meta.env.VITE_ADMIN_EMAILS as string | undefined) || "";
  const admins = list
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(!!user);

  useEffect(() => {
    let mounted = true;
    async function check() {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      // Start with env fallback
      let value = envAdminFallback(user.email);
      // Try to read token claims (non-fatal)
      try {
        const res = await getIdTokenResult(user);
        const claim = (res?.claims as any)?.is_admin;
        if (typeof claim === "boolean") value = claim;
      } catch {
        // ignore token errors; we'll still consult Firestore
      }
      // Always consult Firestore users/{uid}.is_admin to override
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data() as any;
          if (typeof d?.is_admin === "boolean") value = d.is_admin;
        }
      } catch {
        // ignore Firestore errors
      }
      if (mounted) setIsAdmin(!!value);
      if (mounted) setLoading(false);
    }
    check();
    return () => {
      mounted = false;
    };
  }, [user]);

  return { isAdmin, loading } as const;
}
