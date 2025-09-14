import Stopwatch from "./features/Stopwatch/Stopwatch";
import { ThemeProvider } from "@/components/theme-provider";
import Tasks, { type TaskType } from "./features/Tasks/Tasks";
import useSettings from "./features/SettingsEditor/hooks/useSettings";
import { AppNavigation } from "./components/flowtime-nav";
import { FaRegEyeSlash, FaRegEye } from "react-icons/fa";
import { useState } from "react";
import { PiTarget } from "react-icons/pi";
import Starfield from "./components/Starfield";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/features/Auth/AuthContext";
import Dashboard from "@/pages/Dashboard";
import ProtectedRoute from "@/features/Auth/ProtectedRoute";
import AdminRoute from "@/features/Auth/AdminRoute";
import Questions from "@/pages/Questions";
import Leaderboard from "@/pages/Leaderboard";
import Profile from "@/pages/Profile";
import UserTasks from "@/pages/UserTasks";
import VerifiedRoute from "@/features/Auth/VerifiedRoute";

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
      <BrowserRouter>
        <AuthProvider>
          <Starfield intensity={settings.backgroundIntensity} />
          <div className="relative z-10 h-svh sm:h-screen flex flex-col">
            <div className="sticky top-0 z-40 px-3 sm:px-6 bg-black/20 supports-[backdrop-filter]:bg-black/30 backdrop-blur-md border-b border-white/10">
              <AppNavigation settings={settings} />
            </div>
            <main className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              <div className="px-4">
                  <Routes>
                    <Route
                      path="/"
                      element={
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
                          {/* Login is shown only in the header across all devices */}
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
                      }
                    />
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute>
                          <AdminRoute>
                            <Dashboard />
                          </AdminRoute>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/tasks"
                      element={
                        <ProtectedRoute>
                          <UserTasks />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/questions"
                      element={
                        <ProtectedRoute>
                          <VerifiedRoute>
                            <Questions />
                          </VerifiedRoute>
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/leaderboard" element={<Leaderboard />} />
                    <Route
                      path="/profile"
                      element={
                        <ProtectedRoute>
                          <Profile />
                        </ProtectedRoute>
                      }
                    />
                  </Routes>
              </div>
            </main>
            <div className="flex flex-col justify-center mb-8 space-x-4 items-center space-y-4">
              {/* Footer / social area */}
            </div>
          </div>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
