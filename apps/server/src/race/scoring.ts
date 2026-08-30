/**
 * Word correctness aggregation helpers — pure functions.
 *
 * Used by validate-keystroke to update player.uncorrectedErrors on each accept,
 * by results boards to compute per-word correctness (D-13), and by Plan 03 to
 * compute net WPM / accuracy. No Date.now / no I/O — all input-driven.
 *
 * ──────────────────────────────────────────────────────────────────────
 * WPM FORMULA — ROADMAP vs D-05 DISCREPANCY
 * ──────────────────────────────────────────────────────────────────────
 * ROADMAP §Phase 3 criterion 2 (2026-08-30) reads: "Server-computed WPM =
 * correctChars / 5 / minutesElapsed matches a known fixture (e.g., 30 correct
 * chars in 30s → 2 WPM) verified by unit test."
 *
 * D-05 (CONTEXT.md, locked 2026-08-30) reads: "netWPM = max(0, (correctChars / 5)
 * − (uncorrectedErrors / 5)) / minutesElapsed. Industry standard (Monkeytype,
 * typeracer). Fixture: 30 correct chars in 30s = 12 WPM (the ROADMAP's '2 WPM'
 * claim was a math error — 30/5/0.5 = 12)."
 *
 * For 30 correct chars in 30 seconds with 0 errors:
 *   - ROADMAP text: 2 WPM (mathematically wrong — the formula gives 12)
 *   - D-05 + standard typing-test sites (Monkeytype, typeracer): 12 WPM
 *
 * We follow D-05 because it matches the standard formula and the resolved fixture
 * (12 WPM) was committed to ROADMAP.md and CONTEXT.md in commit b17c739.
 * If the user later decides ROADMAP is the source of truth, both D-05 and
 * ROADMAP would need to be updated to use a different formula (e.g., a 5-min
 * normalization). The discrepancy is documented here for the audit trail.
 * ──────────────────────────────────────────────────────────────────────
 */

import type { CharState } from "./types.ts";

/** Counts positions where state === "correct". */
export function countCorrectChars(states: ReadonlyArray<CharState>): number {
  let n = 0;
  for (const s of states) if (s === "correct") n++;
  return n;
}

/**
 * Counts positions where state === "error" (still wrong — uncorrected).
 * A position that was typed wrong then retyped correctly transitions
 * to "correct" (D-11: 2-tone, no intermediate); this counter does NOT
 * accumulate history.
 */
export function countUncorrectedErrors(states: ReadonlyArray<CharState>): number {
  let n = 0;
  for (const s of states) if (s === "error") n++;
  return n;
}

/**
 * Word is "complete" iff EVERY char in [start, end) is "correct".
 * Empty range → true (vacuously complete; caller should not query empty words).
 */
export function isWordCorrect(
  states: ReadonlyArray<CharState>,
  start: number,
  end: number,
): boolean {
  for (let i = start; i < end; i++) {
    if (states[i] !== "correct") return false;
  }
  return true;
}

export type WordEntry = {
  word: string;
  start: number;
  end: number;
  correct: boolean;
};

/**
 * Splits passageText into word entries with [start, end) ranges.
 * Uses /\S+/g so whitespace alone is the separator; contractions and
 * hyphens stay inside one word (Pitfall 7 — "don't" = 1 word, "ice-cream" = 1).
 * Each entry's `correct` flag is computed from states[start..end).
 */
export function aggregateWordCorrectness(
  passageText: string,
  states: ReadonlyArray<CharState>,
): WordEntry[] {
  const out: WordEntry[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(passageText)) !== null) {
    const word = m[0];
    const start = m.index;
    const end = start + word.length;
    out.push({ word, start, end, correct: isWordCorrect(states, start, end) });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// Phase 3 Plan 03 — D-05 net WPM + D-06 accuracy
// ──────────────────────────────────────────────────────────────────────

export type ComputeNetWpmArgs = {
  correctChars: number;
  uncorrectedErrors: number;
  elapsedMs: number;
};

/**
 * Net WPM per D-05 verbatim:
 *   netWpm = max(0, (correctChars / 5 − uncorrectedErrors / 5)) / minutesElapsed
 *
 * - 1 word = 5 chars (industry standard — Monkeytype, typeracer).
 * - Subtracts uncorrectedErrors (still-wrong positions) from correct count.
 * - Clamped at zero so a heavy-correction phase never shows negative WPM.
 * - Returns 0 for elapsedMs <= 0 (defensive — never divides by zero; never
 *   produces NaN/Infinity even if clock skew makes startsAtServerMs == now).
 */
export function computeNetWpm(args: ComputeNetWpmArgs): number {
  const { correctChars, uncorrectedErrors, elapsedMs } = args;
  const minutes = elapsedMs / 60_000;
  if (minutes <= 0) return 0;
  const raw = (correctChars / 5 - uncorrectedErrors / 5) / minutes;
  return Math.max(0, raw);
}

export type ComputeAccuracyArgs = {
  correctChars: number;
  totalKeystrokes: number;
};

/**
 * Char accuracy per D-06 verbatim:
 *   accuracy = correctChars / totalKeystrokes
 *
 * - totalKeystrokes counts ALL accepted keystrokes (including wrong ones) — D-06
 *   is the user's accuracy measured against the volume of their typing.
 * - Returns 0 for totalKeystrokes === 0 (defensive — never divides by zero).
 * - Naturally in [0, 1]; no clamping needed.
 */
export function computeAccuracy(args: ComputeAccuracyArgs): number {
  const { correctChars, totalKeystrokes } = args;
  if (totalKeystrokes === 0) return 0;
  return correctChars / totalKeystrokes;
}