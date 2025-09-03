import { NavigationMenu } from "@/components/ui/navigation-menu";
import SettingsEditor, { type settingsType } from "@/features/SettingsEditor/SettingsEditor";
import { FaBrain } from "react-icons/fa";

export function AppNavigation({ settings }: settingsType) {
  return (
    <NavigationMenu className="w-full mb-2 max-w-none justify-between px-0 py-2">
      <div className="flex items-center space-x-3 select-none">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center border border-white/15">
          <FaBrain className="w-6 h-6 text-primary drop-shadow-[0_1px_4px_rgba(0,0,0,0.35)]" aria-hidden="true" />
        </div>
        <span className="text-2xl font-semibold tracking-tight text-primary drop-shadow-[0_1px_4px_rgba(0,0,0,0.25)]">MindTrack</span>
      </div>
      <div className="space-x-2">
        {/* Theme locked to dark; toggle hidden */}
        <SettingsEditor settings={settings} />
        {/* Hidden login button for future use */}
        <button
          type="button"
          aria-label="Login"
          title="Login"
          className="hidden"
          onClick={() => { /* hook up auth here later */ }}
        >
          Login
        </button>
      </div>
    </NavigationMenu>
  );
}
