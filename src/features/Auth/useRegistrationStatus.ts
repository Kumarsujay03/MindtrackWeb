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
  const { profile, loading: profileLoading } = useUserProfile();

  // Drive loading off the Firestore profile subscription to avoid premature redirects
  const loading = !!user && profileLoading;
  const isVerified = !!profile?.is_verified;
  const record: RegistrationRecord | null = isVerified && user
    ? { uid: user.uid, status: "verified" }
    : null;
  const error: string | null = null;

  return { loading, record, isVerified, error } as const;
}
