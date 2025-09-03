import Stopwatch from "./features/Stopwatch/Stopwatch";
import { ThemeProvider } from "@/components/theme-provider";
import Tasks, { type TaskType } from "./features/Tasks/Tasks";
import useSettings from "./features/SettingsEditor/hooks/useSettings";
import { AppNavigation } from "./components/flowtime-nav";
import { FaRegEyeSlash, FaRegEye } from "react-icons/fa";
import { useState } from "react";
import { PiTarget } from "react-icons/pi";
import Starfield from "./components/Starfield";

function App() {
  const focusedTaskState = useState<TaskType | null>(null);
  const [focusedTask] = focusedTaskState;
  const settings = useSettings();

  function handleHideTaskSection() {
    settings.setTaskSectionVisible(!settings.taskSectionVisible);
    settings.updateTaskVisibility();
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Starfield intensity={settings.backgroundIntensity} />
      {/* Edge-to-edge fixed header */}
  <div className="fixed top-0 left-0 right-0 z-20 px-3 sm:px-6">
        <AppNavigation settings={settings} />
      </div>
      <div className="relative z-10 min-h-svh sm:min-h-screen flex flex-col pt-16">
        <div className="flex-1 flex flex-col items-center px-4">
          <div className="max-w-4xl w-full">
            <div className="container max-w-4xl mx-auto">
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center container p-4 bg-cerulean-50 dark:bg-cerulean-200 rounded-lg max-w-lg mb-2 text-cerulean-950 ${
                    !focusedTask && "invisible"
                  }`}
                >
                  <PiTarget
                    className="mr-2 text-cerulean-400 dark:text-cerulean-600"
                    size={22}
                  />
                  {focusedTask?.name}
                </div>
                <div className="flex flex-col container p-4 rounded-lg max-w-lg mb-8 glass-panel">
                  <Stopwatch settings={settings} />
                  <div className="flex justify-center">
                    {settings.taskSectionVisible ? (
                      <FaRegEyeSlash onClick={() => handleHideTaskSection()} />
                    ) : (
                      <FaRegEye onClick={() => handleHideTaskSection()} />
                    )}
                  </div>
                  <Tasks
                    focusedTaskState={focusedTaskState}
                    settings={settings}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-center mb-8 space-x-4 items-center space-y-4">
          {/* Footer / social area */}
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
