/**
 * Solo typing test choices (mode bar), saved in this browser.
 *
 * Kept apart from the settings cookie on purpose: the settings cookie holds
 * appearance (colors, font size), this store holds what kind of test to run.
 * Backed by localStorage key `typing_race_solo`. Every read/write is wrapped
 * in try/catch (private mode, disabled storage, happy-dom without a bare
 * global) and every parsed value is validated, falling back to defaults.
 */
import { create } from "zustand";
import type { CorpusCategory } from "@typing-race/shared";

export type SoloMode = "time" | "words" | "passage";

export const TIME_OPTIONS = [15, 30, 60, 120] as const;
export const WORD_OPTIONS = [10, 25, 50, 100] as const;
export const PASSAGE_OPTIONS = ["short", "mid", "long"] as const;

export type TimeOption = (typeof TIME_OPTIONS)[number];
export type WordOption = (typeof WORD_OPTIONS)[number];

export interface SoloPrefs {
  mode: SoloMode;
  time: TimeOption;
  words: WordOption;
  passage: CorpusCategory;
  punctuation: boolean;
  numbers: boolean;
}

export const DEFAULT_SOLO_PREFS: SoloPrefs = {
  mode: "time",
  time: 30,
  words: 25,
  passage: "mid",
  punctuation: false,
  numbers: false,
};

export const SOLO_STORAGE_KEY = "typing_race_solo";

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Validates an unknown parsed value field by field; bad fields get defaults. */
export function parseSoloPrefs(raw: unknown): SoloPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SOLO_PREFS };
  const r = raw as Record<string, unknown>;
  return {
    mode: pick(r.mode, ["time", "words", "passage"] as const, DEFAULT_SOLO_PREFS.mode),
    time: pick(r.time, TIME_OPTIONS, DEFAULT_SOLO_PREFS.time),
    words: pick(r.words, WORD_OPTIONS, DEFAULT_SOLO_PREFS.words),
    passage: pick(r.passage, PASSAGE_OPTIONS, DEFAULT_SOLO_PREFS.passage),
    punctuation: typeof r.punctuation === "boolean" ? r.punctuation : DEFAULT_SOLO_PREFS.punctuation,
    numbers: typeof r.numbers === "boolean" ? r.numbers : DEFAULT_SOLO_PREFS.numbers,
  };
}

function readSoloPrefs(): SoloPrefs {
  try {
    const stored = getStorage()?.getItem(SOLO_STORAGE_KEY);
    if (!stored) return { ...DEFAULT_SOLO_PREFS };
    return parseSoloPrefs(JSON.parse(stored));
  } catch {
    return { ...DEFAULT_SOLO_PREFS };
  }
}

function writeSoloPrefs(prefs: SoloPrefs): void {
  try {
    getStorage()?.setItem(SOLO_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or disabled: the choice still applies for this visit.
  }
}

interface SoloState {
  prefs: SoloPrefs;
}

export const useSoloStore = create<SoloState>(() => ({
  prefs: readSoloPrefs(),
}));

export function setSoloPrefs(patch: Partial<SoloPrefs>): void {
  const next = { ...useSoloStore.getState().prefs, ...patch };
  useSoloStore.setState({ prefs: next });
  writeSoloPrefs(next);
}

/** Test helper: reset to defaults without touching storage. */
export function resetSoloPrefs(): void {
  useSoloStore.setState({ prefs: { ...DEFAULT_SOLO_PREFS } });
}
