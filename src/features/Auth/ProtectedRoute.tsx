import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/features/Auth/AuthContext";
import type { ReactNode } from "react";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return null; // or a small spinner if desired
  }
  if (!user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
