import { NavigationMenu } from "@/components/ui/navigation-menu";
import SettingsEditor, { type settingsType } from "@/features/SettingsEditor/SettingsEditor";
import LoginButton from "@/components/LoginButton";
import { useAuth } from "@/features/Auth/AuthContext";
import { FaBrain } from "react-icons/fa";

export function AppNavigation({ settings }: settingsType) {
  const { user, loading } = useAuth();
  return (
    <NavigationMenu className="w-full mb-2 max-w-none justify-between px-0 py-2">
      <div className="flex items-center space-x-3 select-none">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center border border-white/15">
          <FaBrain className="w-6 h-6 text-primary drop-shadow-[0_1px_4px_rgba(0,0,0,0.35)]" aria-hidden="true" />
        </div>
        <span className="text-2xl font-semibold tracking-tight text-primary drop-shadow-[0_1px_4px_rgba(0,0,0,0.25)]">MindTrack</span>
      </div>
      <div className={`space-x-2 flex`}>
        {/* Theme locked to dark; toggle hidden */}
        <SettingsEditor settings={settings} />
        {!loading && (user ? (
          <div className="relative group">
            <button className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/10 border border-white/15">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName ?? ""} className="w-6 h-6 rounded-full" />
              ) : (
                <span className="w-6 h-6 rounded-full bg-white/20 inline-block" />
              )}
              <span className="text-sm max-w-[10ch] truncate">{user.displayName ?? user.email}</span>
            </button>
            {/* Simple hover dropdown */}
            <div className="absolute right-0 mt-1 hidden group-hover:block bg-black/80 backdrop-blur rounded-md border border-white/15 min-w-[160px] p-2">
              <a href="/dashboard" className="block px-2 py-1.5 rounded hover:bg-white/10">Dashboard</a>
              <button
                className="w-full text-left px-2 py-1.5 rounded hover:bg-white/10"
                onClick={() => import("@/features/Auth/auth").then(m => m.signOutUser())}
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <LoginButton />
        ))}
      </div>
    </NavigationMenu>
  );
}
