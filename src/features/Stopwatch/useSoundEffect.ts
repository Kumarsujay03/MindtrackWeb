import { useEffect, useState } from "react";

export type SoundEffect = "simple_chime" | "digital_watch_alarm" | "egg_timer";

export default function useSoundEffect(soundEffectPreference: SoundEffect) {
  const [soundEffect, setSoundEffect] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    import(`../../assets/${soundEffectPreference}.mp3`)
      .then((audioFile) => {
        const audio = new Audio(audioFile.default);
        setSoundEffect(audio);
      })
      .catch((error) => {
        console.error(error);
      });
  }, [soundEffectPreference]);

  return soundEffect;
}
