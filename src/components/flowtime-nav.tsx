import { NavigationMenu } from "@/components/ui/navigation-menu";
import SettingsEditor, { type settingsType } from "@/features/SettingsEditor/SettingsEditor";
import LoginButton from "@/components/LoginButton";
import { useAuth } from "@/features/Auth/AuthContext";
import { FaBrain } from "react-icons/fa";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAdmin } from "@/features/Auth/useAdmin";
import { useUserProfile } from "@/features/Auth/useUserProfile";

export function AppNavigation({ settings }: settingsType) {
  const { user, loading } = useAuth();
  const { isAdmin } = useAdmin();
  const { profile } = useUserProfile();
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";
  const isVerified = !!user?.emailVerified;
  return (
    <NavigationMenu className="w-full mb-2 max-w-none px-0 py-2">
      <div className="flex items-center w-full justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center space-x-3 select-none">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center border border-white/15">
            <FaBrain className="w-6 h-6 text-primary drop-shadow-[0_1px_4px_rgba(0,0,0,0.35)]" aria-hidden="true" />
          </div>
          <span className="text-2xl font-semibold tracking-tight text-primary drop-shadow-[0_1px_4px_rgba(0,0,0,0.25)]">MindTrack</span>
        </div>

        {/* Nav links inline in the same header row */}
        {user && (
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <HeaderLink to="/">Home</HeaderLink>
            {isAdmin && <HeaderLink to="/dashboard">Dashboard</HeaderLink>}
            <HeaderLink to="/tasks">Tasks</HeaderLink>
            {isVerified && <HeaderLink to="/questions">Questions</HeaderLink>}
            <HeaderLink to="/leaderboard">Leaderboard</HeaderLink>
            <HeaderLink to="/profile">Profile</HeaderLink>
          </div>
        )}

        {/* Right controls: settings + user/login */}
        <div className="flex items-center gap-2">
          <div className={isHome ? "" : "invisible"} aria-hidden={!isHome}>
            <SettingsEditor settings={settings} />
          </div>
          {!loading && (user ? (
            <div className="relative group">
              <button className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/10 border border-white/15">
                {profile.activeProfileUrl ? (
                  <img src={profile.activeProfileUrl} alt={profile.name ?? profile.email ?? ""} className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-white/20 inline-block" />
                )}
                <span className="text-sm max-w-[10ch] truncate">{profile.name ?? profile.email ?? ""}</span>
              </button>
              {/* Dropdown with only Sign out as requested */}
              <div className="absolute right-0 mt-1 hidden group-hover:block bg-black/80 backdrop-blur rounded-md border border-white/15 min-w-[160px] p-2">
                <button
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10"
                  onClick={() =>
                    import("@/features/Auth/auth").then(m => m.signOutUser()).finally(() => navigate("/"))
                  }
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <LoginButton />
          ))}
        </div>
      </div>
    </NavigationMenu>
  );
}

function HeaderLink({ to, children }: { to: string; children: React.ReactNode }) {
  const base = "px-3 py-1.5 rounded-md text-sm sm:text-base font-medium border transition-colors";
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `${base} ${isActive ? "bg-white/15 border-white/30 text-white" : "bg-white/5 border-white/10 text-white/90 hover:bg-white/10"}`
      }
    >
      {children}
    </NavLink>
  );
}
