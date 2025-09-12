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
    if (!user) {
      setRecord(null);
      setLoading(false);
      return;
    }
    // Use Firestore profile only in this minimal setup
    setLoading(false);
    setError(null);
    setRecord(profile?.is_verified ? { uid: user.uid, status: "verified" } as any : null);
  }, [user, profile?.is_verified]);

  const isVerified = !!profile?.is_verified;
  return { loading, record, isVerified, error } as const;
}
