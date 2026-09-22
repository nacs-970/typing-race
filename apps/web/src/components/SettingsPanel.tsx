import { useState } from "react";
import { useSettingsStore, setSettings, resetSettings, DEFAULT_SETTINGS } from "../store/settings.ts";

const COLOR_FIELDS = [
  { key: "colorCorrect", label: "Correct" },
  { key: "colorIncorrect", label: "Incorrect" },
  { key: "colorCursor", label: "Cursor" },
  { key: "colorAccent", label: "Accent" },
  { key: "colorBackground", label: "Background" },
  { key: "colorText", label: "Text" },
] as const;

export function SettingsPanel(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const settings = useSettingsStore((s) => s.settings);

  return (
    <div className="fixed top-3 right-3 z-50" data-testid="settings-panel">
      <button
        type="button"
        aria-label="Settings"
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-bright)] shadow-md hover:bg-[var(--color-bg-surface-hover)] transition-colors"
      >
        ⚙️
      </button>

      {open && (
        <div className="mt-2 w-64 p-4 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] text-[var(--color-text-bright)] font-mono shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-sm">Settings</span>
            <button
              type="button"
              onClick={resetSettings}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-bright)] underline"
            >
              Reset
            </button>
          </div>

          <label className="block text-xs text-[var(--color-text-muted)] mb-1">
            Font size ({settings.fontSize}px)
          </label>
          <input
            type="range"
            min={12}
            max={24}
            step={1}
            value={settings.fontSize}
            onChange={(e) => setSettings({ fontSize: Number(e.target.value) })}
            className="w-full mb-3"
          />

          <div className="grid grid-cols-2 gap-2">
            {COLOR_FIELDS.map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between text-xs gap-2">
                {label}
                <input
                  type="color"
                  value={settings[key]}
                  onChange={(e) => setSettings({ [key]: e.target.value })}
                  className="w-7 h-7 p-0 border border-[var(--color-border-subtle)] rounded cursor-pointer bg-transparent"
                />
              </label>
            ))}
          </div>

          <p className="text-[10px] text-[var(--color-text-muted)] mt-3 mb-0">
            Saved to this browser (default: {DEFAULT_SETTINGS.fontSize}px, olive theme).
          </p>
        </div>
      )}
    </div>
  );
}
