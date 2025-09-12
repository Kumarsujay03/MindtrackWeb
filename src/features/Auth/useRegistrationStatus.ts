import { useEffect, useState } from "react";
import { useAuth } from "@/features/Auth/AuthContext";
import { useUserProfile } from "@/features/Auth/useUserProfile";

export type RegistrationRecord = {
  uid: string;
  status: "pending" | "verified" | string;
  app_username?: string;
  leetcode_username?: string;
};

export function useRegistrationStatus() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [loading, setLoading] = useState<boolean>(!!user);
  const [record, setRecord] = useState<RegistrationRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!user) {
        setRecord(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(`/api/registrations/${user.uid}`);
        if (resp.status === 404) {
          setRecord(null);
        } else if (resp.ok) {
          const data = await resp.json();
          setRecord({
            uid: data.uid,
            status: data.status,
            app_username: data.app_username,
            leetcode_username: data.leetcode_username,
          });
        } else {
          setError(`Failed to load registration: ${resp.status}`);
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load registration");
      } finally {
        setLoading(false);
      }

      // Mirror Firestore verification into SQL if needed
      try {
        if (mounted && profile?.is_verified && user) {
          if (!record || record.status !== "verified") {
            await fetch(`/api/registrations`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                uid: user.uid,
                display_name: user.displayName ?? null,
                email: user.email ?? null,
                avatar_url: user.photoURL ?? null,
                app_username: (profile as any)?.appUserName ?? record?.app_username ?? "",
                leetcode_username: (profile as any)?.leetcodeUsername ?? record?.leetcode_username ?? "",
                status: "verified",
              }),
            });
          }
        }
      } catch {
        // ignore mirroring errors
      }
    }
    run();
    return () => { mounted = false };
  }, [user, profile?.is_verified]);

  const isVerified = !!record && record.status === "verified";
  return { loading, record, isVerified, error } as const;
}
