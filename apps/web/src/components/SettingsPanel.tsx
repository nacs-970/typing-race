import { useState } from "react";
import {
  useSettingsStore,
  setSettings,
  resetSettings,
  DEFAULT_SETTINGS,
  THEME_PRESETS,
} from "../store/settings.ts";

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
    <div
      className="fixed bottom-14 right-6 z-50 flex flex-col-reverse items-end"
      data-testid="settings-panel"
    >
      <button
        type="button"
        aria-label="Settings"
        onClick={() => setOpen((v) => !v)}
        className="w-11 h-11 rounded-none bg-[var(--color-bg-surface)] border border-[var(--color-border-muted)] text-[var(--color-text-bright)] font-mono text-[15px] cursor-pointer hover:bg-[var(--color-bg-surface-hover)] transition-colors flex items-center justify-center"
      >
        Aa
      </button>

      {open && (
        <div className="mb-2 w-64 p-4 rounded-none border border-[var(--color-border-muted)] bg-[var(--color-bg-surface)] text-[var(--color-text-bright)] font-mono shadow-none">
          <div className="flex items-center justify-between mb-3">
            <span className="label font-bold text-[var(--color-text-bright)]">Settings</span>
            <button
              type="button"
              onClick={resetSettings}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-bright)] underline cursor-pointer"
            >
              Reset
            </button>
          </div>

          <label className="label block mb-1.5">Theme</label>
          <div className="flex gap-2 mb-3">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                title={preset.name}
                aria-label={preset.name}
                onClick={() => setSettings(preset.colors)}
                className="w-7 h-7 rounded-none border border-[var(--color-border-muted)] shrink-0 cursor-pointer"
                style={{ background: preset.colors.colorBackground }}
              >
                <span
                  className="block w-3 h-3 mx-auto rounded-none"
                  style={{ background: preset.colors.colorAccent }}
                />
              </button>
            ))}
          </div>

          <label className="label block mb-1.5">
            Font size ({settings.fontSize}px)
          </label>
          <input
            type="range"
            min={12}
            max={24}
            step={1}
            value={settings.fontSize}
            onChange={(e) => setSettings({ fontSize: Number(e.target.value) })}
            className="w-full mb-3 cursor-pointer"
          />

          <div className="grid grid-cols-2 gap-2">
            {COLOR_FIELDS.map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between text-xs gap-2">
                {label}
                <input
                  type="color"
                  value={settings[key]}
                  onChange={(e) => setSettings({ [key]: e.target.value })}
                  className="w-7 h-7 p-0 border border-[var(--color-border-muted)] rounded-none cursor-pointer bg-transparent"
                />
              </label>
            ))}
          </div>

          <p className="text-[10px] text-[var(--color-text-muted)] mt-3 mb-0">
            Saved to this browser. Default: {DEFAULT_SETTINGS.fontSize}px, Olive.
          </p>
        </div>
      )}
    </div>
  );
}
