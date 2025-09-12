import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/features/Auth/AuthContext";
import { useRegistrationStatus } from "@/features/Auth/useRegistrationStatus";

export default function VerifiedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { isVerified, loading: regLoading } = useRegistrationStatus();
  const location = useLocation();

  if (loading || regLoading) return null;
  if (!user) return <Navigate to="/" replace state={{ from: location }} />;
  if (!isVerified) return <Navigate to="/leaderboard" replace />;

  return <>{children}</>;
}
