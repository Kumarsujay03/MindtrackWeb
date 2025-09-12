import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithGoogle } from "@/features/Auth/auth";
import { useAuth } from "@/features/Auth/AuthContext";

export default function LoginButton() {
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (loading || user) return null;

  return (
    <button
      onClick={async () => {
        try {
          setBusy(true);
          await signInWithGoogle();
          navigate("/dashboard");
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium bg-white/10 hover:bg-white/15 active:bg-white/20 text-white border border-white/15 transition-colors"
      title="Login with Google"
      aria-label="Login with Google"
      disabled={busy}
    >
      {busy ? "Signing in..." : "Login"}
    </button>
  );
}
