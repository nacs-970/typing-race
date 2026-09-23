// Pure helpers for reading typed input from the hidden mobile <input> in
// RaceView. The engine never trusts `key` on Android (it sends
// `key: "Unidentified"`), so RaceView diffs the input's *value* instead and
// turns the diff into the same minimal event shape the engine already reads
// from `window`'s keydown listener.

/** A single, harmless character that always keeps the hidden input's value
 * non-empty, so Backspace always has something to delete and the value
 * never grows across handled events. Zero-width, so it never becomes
 * visible even if the `.sr-input` CSS fails to load. */
export const SR_INPUT_SENTINEL = "\u200B";

export type InputDiff =
  | { type: "char"; ch: string }
  | { type: "backspace"; count: number }
  | { type: "ignore" };

/**
 * Compares the hidden input's previous and next value and classifies the
 * change. Never trusts `key` — only the value matters.
 *
 * - Exactly one character appended → `{ type: "char", ch }`.
 * - The value got shorter (Backspace, or deleting a selection) →
 *   `{ type: "backspace", count }` with how many characters disappeared.
 * - Anything else (more than one character inserted at once — autocomplete,
 *   paste, swipe typing — or a same-length replacement) → `{ type: "ignore" }`,
 *   so the caller restores the previous value.
 */
export function diffInput(prev: string, next: string): InputDiff {
  if (next.length === prev.length + 1 && next.startsWith(prev)) {
    return { type: "char", ch: next.slice(prev.length) };
  }
  if (next.length < prev.length) {
    return { type: "backspace", count: prev.length - next.length };
  }
  return { type: "ignore" };
}

/**
 * Builds the minimal event-shaped object `TypingEngine.handleKeyDown` reads
 * (`key`, `repeat`, the modifier keys, and a no-op `preventDefault`), so a
 * value diffed from the hidden input drives the engine exactly like a real
 * `KeyboardEvent` would. Cast through `unknown` because this object
 * intentionally implements only the subset of `KeyboardEvent` the engine
 * touches, not the whole DOM interface.
 */
export function createSyntheticKeyboardEvent(key: string): KeyboardEvent {
  return {
    key,
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    preventDefault() {
      // Synthetic event — nothing to prevent.
    },
  } as unknown as KeyboardEvent;
}
