import { create } from "zustand";

export interface PlayerSettings {
  fontSize: number;
  colorCorrect: string;
  colorIncorrect: string;
  colorCursor: string;
  colorAccent: string;
  colorBackground: string;
  colorText: string;
}

/** Matches the current hardcoded look in styles.css — changing a setting overrides these. */
export const DEFAULT_SETTINGS: PlayerSettings = {
  fontSize: 16,
  colorCorrect: "#1d2114",
  colorIncorrect: "#b3261e",
  colorCursor: "#90a358",
  colorAccent: "#5f6f36",
  colorBackground: "#fdfbf3",
  colorText: "#1d2114",
};

export type ThemeColors = Omit<PlayerSettings, "fontSize">;

export interface ThemePreset {
  name: string;
  colors: ThemeColors;
}

/** fontSize is left untouched when a preset is applied — presets are color-only. */
export const THEME_PRESETS: ThemePreset[] = [
  {
    name: "Olive",
    colors: {
      colorCorrect: "#1d2114",
      colorIncorrect: "#b3261e",
      colorCursor: "#90a358",
      colorAccent: "#5f6f36",
      colorBackground: "#fdfbf3",
      colorText: "#1d2114",
    },
  },
  {
    name: "Dark",
    colors: {
      colorCorrect: "#4ade80",
      colorIncorrect: "#f87171",
      colorCursor: "#60a5fa",
      colorAccent: "#60a5fa",
      colorBackground: "#1a1a19",
      colorText: "#f0efec",
    },
  },
  {
    name: "High Contrast",
    colors: {
      colorCorrect: "#000000",
      colorIncorrect: "#b91c1c",
      colorCursor: "#BDBDBD",
      colorAccent: "#000000",
      colorBackground: "#ffffff",
      colorText: "#000000",
    },
  },
  {
    name: "Ocean",
    colors: {
      colorCorrect: "#0f766e",
      colorIncorrect: "#b91c1c",
      colorCursor: "#0ea5e9",
      colorAccent: "#0ea5e9",
      colorBackground: "#eaf6fb",
      colorText: "#072a3a",
    },
  },
];

const COOKIE_NAME = "typing_race_settings";

function readSettingsCookie(): PlayerSettings {
  if (typeof document === "undefined") return DEFAULT_SETTINGS;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match || !match[1]) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1]));
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeSettingsCookie(settings: PlayerSettings): void {
  if (typeof document === "undefined") return;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(settings))}; path=/; max-age=${oneYear}; SameSite=Lax`;
}

/**
 * Applies settings as inline CSS custom-property overrides on :root.
 * Inline style wins over the stylesheet's @theme-defined :root values, and
 * anything aliased to these tokens (e.g. --color-accent-clay: var(--color-accent-green))
 * re-resolves live, no extra JS needed.
 *
 * Scope note: only the primary surface/text tokens are overridden, not every
 * derived shade (hover/elevated backgrounds, muted/faint text) — changing
 * those too would need re-deriving a whole ramp per pick, not asked for here.
 */
export function applySettingsToDom(settings: PlayerSettings): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  root.setProperty("--app-font-size", `${settings.fontSize}px`);
  root.setProperty("--color-char-correct", settings.colorCorrect);
  root.setProperty("--color-status-danger", settings.colorIncorrect);
  root.setProperty("--color-cursor-own", settings.colorCursor);
  root.setProperty("--color-accent-green", settings.colorAccent);
  root.setProperty("--color-bg-base", settings.colorBackground);
  root.setProperty("--color-bg-surface", settings.colorBackground);
  root.setProperty("--color-bg-surface-elevated", settings.colorBackground);
  root.setProperty("--color-text-bright", settings.colorText);
}

interface SettingsState {
  settings: PlayerSettings;
}

export const useSettingsStore = create<SettingsState>(() => ({
  settings: readSettingsCookie(),
}));

export function setSettings(patch: Partial<PlayerSettings>): void {
  const next = { ...useSettingsStore.getState().settings, ...patch };
  useSettingsStore.setState({ settings: next });
  writeSettingsCookie(next);
  applySettingsToDom(next);
}

export function resetSettings(): void {
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS });
  writeSettingsCookie(DEFAULT_SETTINGS);
  applySettingsToDom(DEFAULT_SETTINGS);
}

/** Call once on app mount to apply whatever was loaded from the cookie (or defaults). */
export function hydrateSettings(): void {
  applySettingsToDom(useSettingsStore.getState().settings);
}
