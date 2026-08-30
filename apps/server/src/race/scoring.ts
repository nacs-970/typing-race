/**
 * Scoring helpers — pure aggregation functions over CharState arrays.
 *
 * Used by validate-keystroke to update player.uncorrectedErrors on each accept,
 * by results boards to compute per-word correctness (D-13), and by Plan 03 to
 * compute net WPM / accuracy. No Date.now / no I/O — all input-driven.
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