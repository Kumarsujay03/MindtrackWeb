import { NavLink } from "react-router-dom";
import { useAuth } from "@/features/Auth/AuthContext";

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (import.meta.env.VITE_ADMIN_EMAILS as string | undefined) || "";
  const admins = list
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

export default function DashboardNav() {
  const { user } = useAuth();
  const admin = isAdminEmail(user?.email);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 rounded-md text-base sm:text-lg font-semibold border transition-colors ${
      isActive
        ? "bg-white/15 border-white/30 text-white"
        : "bg-white/5 border-white/10 text-white/90 hover:bg-white/10"
    }`;

  return (
    <nav className="w-full mx-auto mt-2 mb-6 px-3 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between py-3">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-primary drop-shadow-[0_1px_4px_rgba(0,0,0,0.25)]">
            MindTrack
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
        <NavLink to="/" className={linkClass}>
          Home
        </NavLink>
        {admin && (
          <NavLink to="/dashboard" className={linkClass}>
            Dashboard
          </NavLink>
        )}
        <NavLink to="/questions" className={linkClass}>
          Questions
        </NavLink>
        <NavLink to="/leaderboard" className={linkClass}>
          Leaderboard
        </NavLink>
        <NavLink to="/profile" className={linkClass}>
          Profile
        </NavLink>
          </div>
        </div>
      </div>
    </nav>
  );
}
