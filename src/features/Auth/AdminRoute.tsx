import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/Auth/AuthContext";
import { useAdmin } from "@/features/Auth/useAdmin";

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  if (loading || adminLoading) return null;
  if (!user) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}
