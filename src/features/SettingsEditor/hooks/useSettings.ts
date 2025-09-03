import type { SoundEffect } from "@/features/Stopwatch/useSoundEffect";
import { useEffect, useState } from "react";

type localStorageSettings = {
  // legacy: breakTimeDivisor kept for backward compatibility but unused now
  breakTimeDivisor?: number;
  // new manual durations (in minutes)
  sessionMinutes?: number;
  breakMinutes?: number;
  soundEffect?: SoundEffect;
  taskSectionVisible?: boolean;
  backgroundIntensity?: "off" | "low" | "normal" | "high";
};

export default function useSettings() {
  // Manual session/break durations (minutes)
  const [sessionMinutes, setSessionMinutes] = useState<number>(25);
  const [draftSessionMinutes, setDraftSessionMinutes] =
    useState<number>(sessionMinutes);

  const [breakMinutes, setBreakMinutes] = useState<number>(5);
  const [draftBreakMinutes, setDraftBreakMinutes] =
    useState<number>(breakMinutes);

  const [soundEffect, setSoundEffect] = useState<SoundEffect>("simple_chime");
  const [draftSoundEffect, setDraftSoundEffect] =
    useState<SoundEffect>("simple_chime");

  const [taskSectionVisible, setTaskSectionVisible] = useState(true);
  const [backgroundIntensity, setBackgroundIntensity] = useState<
    "off" | "low" | "normal" | "high"
  >("normal");
  const [draftBackgroundIntensity, setDraftBackgroundIntensity] = useState<
    "off" | "low" | "normal" | "high"
  >(backgroundIntensity);

  useEffect(() => {
  const storedSettings = localStorage.getItem("mindtrack_promodo_settings");
    if (storedSettings) {
      const parsedSettings = JSON.parse(storedSettings);
      // Read new keys with sane fallbacks
      const parsedSessionMinutes =
        parsedSettings["sessionMinutes"] ?? 25;
      const parsedBreakMinutes = parsedSettings["breakMinutes"] ?? 5;

      setSessionMinutes(parsedSessionMinutes);
      setDraftSessionMinutes(parsedSessionMinutes);
      setBreakMinutes(parsedBreakMinutes);
      setDraftBreakMinutes(parsedBreakMinutes);

      const parsedSoundEffect = parsedSettings["soundEffect"];
      setSoundEffect(parsedSoundEffect);
      setDraftSoundEffect(parsedSoundEffect);

      const parsedTaskVisibility = parsedSettings["taskSectionVisible"];
      setTaskSectionVisible(parsedTaskVisibility);

      const parsedIntensity =
        (parsedSettings["backgroundIntensity"] as
          | "off"
          | "low"
          | "normal"
          | "high") ?? "normal";
      setBackgroundIntensity(parsedIntensity);
      setDraftBackgroundIntensity(parsedIntensity);
    }
  }, []);

  function updateTaskVisibility() {
    const currentSettings: localStorageSettings = {
      sessionMinutes: sessionMinutes,
      breakMinutes: breakMinutes,
      soundEffect: soundEffect,
      taskSectionVisible: !taskSectionVisible,
  backgroundIntensity: backgroundIntensity,
    };
  localStorage.setItem("mindtrack_promodo_settings", JSON.stringify(currentSettings));
  }

  return {
    sessionMinutes,
    setSessionMinutes,
    draftSessionMinutes,
    setDraftSessionMinutes,
    breakMinutes,
    setBreakMinutes,
    draftBreakMinutes,
    setDraftBreakMinutes,
    soundEffect,
    setSoundEffect,
    draftSoundEffect,
    setDraftSoundEffect,
    taskSectionVisible,
    setTaskSectionVisible,
    updateTaskVisibility,
  backgroundIntensity,
  setBackgroundIntensity,
  draftBackgroundIntensity,
  setDraftBackgroundIntensity,
  };
}
