import LoginButton from "@/components/LoginButton";
import { useAuth } from "@/features/Auth/AuthContext";
import { signOutUser } from "@/features/Auth/auth";

export default function Dashboard() {
  const { user, loading } = useAuth();
  return (
    <div className="container max-w-4xl mx-auto">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-2xl font-semibold mt-4">Dashboard</h1>
        {loading ? (
          <p className="opacity-80">Loading…</p>
        ) : user ? (
          <div className="glass-panel p-4 rounded-lg w-full">
            <p className="mb-2">Signed in as</p>
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName ?? ""} className="w-10 h-10 rounded-full" />
              ) : null}
              <div>
                <p className="font-medium">{user.displayName ?? user.email}</p>
                <p className="text-sm opacity-70">{user.email}</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium bg-white/10 hover:bg-white/15 active:bg-white/20 text-white border border-white/15 transition-colors"
                onClick={async () => {
                  await signOutUser();
                  window.location.href = "/";
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <div className="glass-panel p-4 rounded-lg w-full text-center">
            <p className="mb-3">You’re not signed in.</p>
            <LoginButton />
          </div>
        )}
      </div>
    </div>
  );
}
