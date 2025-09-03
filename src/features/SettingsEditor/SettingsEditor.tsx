import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { FaCog } from "react-icons/fa";
import type useSettings from "./hooks/useSettings";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { SoundEffect } from "../Stopwatch/useSoundEffect";

export type Settings = ReturnType<typeof useSettings>;

export type settingsType = {
  settings: Settings;
};

export default function SettingsEditor({ settings }: settingsType) {
  const [open, setOpen] = useState(false);

  const saveSettings = () => {
    const draftSettings = {
      sessionMinutes: settings.draftSessionMinutes,
      breakMinutes: settings.draftBreakMinutes,
      soundEffect: settings.draftSoundEffect,
      taskSectionVisible: settings.taskSectionVisible,
      backgroundIntensity: settings.draftBackgroundIntensity,
    };
  localStorage.setItem("mindtrack_promodo_settings", JSON.stringify(draftSettings));
    settings.setSessionMinutes(settings.draftSessionMinutes);
    settings.setBreakMinutes(settings.draftBreakMinutes);
    settings.setSoundEffect(settings.draftSoundEffect);
    settings.setBackgroundIntensity(settings.draftBackgroundIntensity);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button aria-label="Open settings">
          <FaCog />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form action={saveSettings}>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription className="mb-4"></DialogDescription>
          </DialogHeader>
          <Label className="font-semibold">Timing</Label>
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="sessionMinutes" className="w-40">Session (min)</Label>
              <Input
                id="sessionMinutes"
                name="sessionMinutes"
                value={settings.draftSessionMinutes}
                min={1}
                onChange={(e) =>
                  settings.setDraftSessionMinutes(
                    Number.isFinite(e.target.valueAsNumber) && e.target.value !== ""
                      ? Math.max(1, e.target.valueAsNumber)
                      : 1
                  )
                }
                type="number"
                className="w-28"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="breakMinutes" className="w-40">Break (min)</Label>
              <Input
                id="breakMinutes"
                name="breakMinutes"
                value={settings.draftBreakMinutes}
                min={1}
                onChange={(e) =>
                  settings.setDraftBreakMinutes(
                    Number.isFinite(e.target.valueAsNumber) && e.target.value !== ""
                      ? Math.max(1, e.target.valueAsNumber)
                      : 1
                  )
                }
                type="number"
                className="w-28"
              />
            </div>
          </div>
          <Label className="font-semibold mb-4">Sound effect</Label>
          <div className="mb-4">
            <RadioGroup
              defaultValue={settings.draftSoundEffect}
              onValueChange={(value) =>
                settings.setDraftSoundEffect(value as SoundEffect)
              }
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="simple_chime" id="r1" />
                <Label htmlFor="r1">Simple chime</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="digital_watch_alarm" id="r2" />
                <Label htmlFor="r2">Digital watch alarm</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="egg_timer" id="r3" />
                <Label htmlFor="r3">Egg timer</Label>
              </div>
            </RadioGroup>
          </div>
          <Label className="font-semibold mb-2">Background intensity</Label>
          <div className="mb-4">
            <RadioGroup
              defaultValue={settings.draftBackgroundIntensity}
              onValueChange={(value) =>
                settings.setDraftBackgroundIntensity(
                  value as "off" | "low" | "normal" | "high"
                )
              }
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="off" id="bg0" />
                <Label htmlFor="bg0">Off</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="low" id="bg1" />
                <Label htmlFor="bg1">Low</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="normal" id="bg2" />
                <Label htmlFor="bg2">Normal</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="high" id="bg3" />
                <Label htmlFor="bg3">High</Label>
              </div>
            </RadioGroup>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
