"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import React, { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { handleNotificationForm } from "./actions";
import type { AlertPreferences } from "./types";

interface Props {
  initialPrefs: AlertPreferences;
}

// Form state is managed locally so the Switch components (controlled by
// our Switch UI primitive) stay in sync with a hidden checkbox input
// used for form submission. When the user clicks Save, we submit as a
// plain FormData POST to the server action.
export default function AlertPreferencesForm({ initialPrefs }: Props) {
  const [prefs, setPrefs] = useState<AlertPreferences>(initialPrefs);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await handleNotificationForm(formData);
      if (res.ok) {
        toast.success("Notification preferences saved");
      } else {
        toast.error(res.error ?? "Failed to save");
      }
    });
  };

  const handleReset = () => {
    setPrefs(initialPrefs);
  };

  return (
    <div>
      <div className="card rounded-xl border border-border bg-background shadow-sm p-6">
        <div className="card-body p-0">
          <form onSubmit={handleSubmit}>
            <NotificationSection
              title="Mail Notification Messages"
              label="Email alerts to this address"
              placeholder="Short message to include in the subject line or preview"
              channel="mail"
              prefs={prefs}
              setPrefs={setPrefs}
            />

            <NotificationSection
              title="SMS Notification Messages"
              label="Text alerts to my phone number"
              placeholder="Short message for SMS previews"
              channel="sms"
              prefs={prefs}
              setPrefs={setPrefs}
            />

            <NotificationSection
              title="Push Notification Messages"
              label="In-browser push alerts"
              placeholder="Short message for push notifications"
              channel="push"
              prefs={prefs}
              setPrefs={setPrefs}
            />

            <div className="flex items-center flex-wrap justify-center gap-4 mt-8">
              <Button
                type="button"
                onClick={handleReset}
                disabled={isPending}
                className="h-[48px] border border-red-600 bg-transparent hover:bg-red-600/20 text-red-600 text-base px-14 py-[11px] rounded-lg"
              >
                Reset
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-[48px] text-base px-14 py-3 rounded-lg"
              >
                {isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  label: string;
  placeholder: string;
  channel: keyof AlertPreferences;
  prefs: AlertPreferences;
  setPrefs: React.Dispatch<React.SetStateAction<AlertPreferences>>;
}

function NotificationSection({
  title,
  label,
  placeholder,
  channel,
  prefs,
  setPrefs,
}: SectionProps) {
  const switchId = `${channel}-switch`;
  const state = prefs[channel];

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <Label className="text-base font-medium">{label}</Label>
        <div className="flex items-center flex-wrap space-x-2">
          {/* Hidden input carries the switch state into FormData so the
              server action receives it — Switch alone doesn't submit. */}
          <input
            type="hidden"
            name={`${channel}_switch`}
            value={state.enabled ? "on" : ""}
          />
          <Switch
            id={switchId}
            checked={state.enabled}
            onCheckedChange={(next) =>
              setPrefs((p) => ({
                ...p,
                [channel]: { ...p[channel], enabled: next },
              }))
            }
          />
          <Label htmlFor={switchId} className="text-sm">
            {state.enabled ? "On" : "Off"}
          </Label>
        </div>
      </div>
      <Textarea
        name={`${channel}_message`}
        placeholder={placeholder}
        value={state.message}
        onChange={(e) =>
          setPrefs((p) => ({
            ...p,
            [channel]: { ...p[channel], message: e.target.value },
          }))
        }
        className="border border-neutral-300 px-5 dark:border-slate-500 focus:border-primary dark:focus:border-primary focus-visible:border-primary h-12 !rounded-lg !shadow-none !ring-0 !h-[80px] !w-full"
      />
    </div>
  );
}
