import React, { useCallback, useEffect, useRef, useState } from "react";
import { generateWords, getRandomPassage } from "@typing-race/shared";
import { TypingEngine, type TypingEngineStats } from "../core/typing-engine.ts";
import { PassageLayout, type LineRange } from "../core/layout.ts";
import { diffInput, createSyntheticKeyboardEvent, SR_INPUT_SENTINEL } from "../core/mobile-input.ts";
import { useSettingsStore } from "../store/settings.ts";
import { ResultSummary } from "./ResultSummary.tsx";
import {
  useSoloStore,
  setSoloPrefs,
  TIME_OPTIONS,
  WORD_OPTIONS,
  PASSAGE_OPTIONS,
  type SoloMode,
  type SoloPrefs,
} from "../store/solo.ts";

/**
 * Solo typing test (the landing view). Monkeytype-style: the caret is ready
 * on load, the first accepted keystroke starts the test, and the chrome fades
 * out while you type (focus mode).
 *
 * All state is local. This view never touches the race or cursor stores —
 * RaceView does, which is why it isn't reused here.
 */

/** Rows of text shown at once; the caret sits on row 2 once you pass row 2. */
const VISIBLE_LINES = 3;
/** Time mode: words generated up front, and per top-up. */
const TIME_INITIAL_WORDS = 60;
const TIME_APPEND_WORDS = 40;
/** Time mode: top up when fewer than this many characters are left. Generous
 * on purpose: once the engine reaches the end it finishes for good. */
const TIME_LOOKAHEAD_CHARS = 200;
/** Attribute on <html> that fades the chrome (see `.focus-fade` in styles.css). */
export const FOCUS_MODE_ATTR = "data-focus-mode";

type Phase = "ready" | "running" | "done";

export interface SoloText {
  text: string;
  /** Passage id, so the next passage-mode test can skip it. */
  id?: string;
}

/** Where test text comes from. Injectable so tests get deterministic text. */
export interface SoloTextSource {
  initial(prefs: SoloPrefs, previousId?: string): SoloText;
  /** Time mode top-up, appended after a single space. */
  more(prefs: SoloPrefs): string;
}

export const defaultTextSource: SoloTextSource = {
  initial(prefs, previousId) {
    const opts = { punctuation: prefs.punctuation, numbers: prefs.numbers };
    if (prefs.mode === "time") return { text: generateWords(TIME_INITIAL_WORDS, opts) };
    if (prefs.mode === "words") return { text: generateWords(prefs.words, opts) };
    const p = getRandomPassage(prefs.passage, previousId);
    return { text: p.text, id: p.id };
  },
  more(prefs) {
    return generateWords(TIME_APPEND_WORDS, {
      punctuation: prefs.punctuation,
      numbers: prefs.numbers,
    });
  },
};

interface SoloResult {
  wpm: number;
  raw: number;
  acc: number;
  correct: number;
  errors: number;
  elapsedMs: number;
  mode: SoloMode;
  label: string;
}

function modeLabel(p: SoloPrefs): string {
  if (p.mode === "passage") return `passage · ${p.passage}`;
  const parts = [p.mode === "time" ? `time ${p.time}` : `words ${p.words}`];
  if (p.punctuation) parts.push("punctuation");
  if (p.numbers) parts.push("numbers");
  return parts.join(" · ");
}

function formatSeconds(ms: number, mode: SoloMode): string {
  return mode === "time" ? `${Math.round(ms / 1000)}s` : `${(ms / 1000).toFixed(1)}s`;
}

/** Same guard as RaceView: happy-dom has no `window.matchMedia`. */
function detectCoarsePointer(): boolean {
  try {
    return window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  } catch {
    return false;
  }
}

function setFocusMode(on: boolean): void {
  if (typeof document === "undefined") return;
  if (on) document.documentElement.setAttribute(FOCUS_MODE_ATTR, "");
  else document.documentElement.removeAttribute(FOCUS_MODE_ATTR);
}

function Kbd({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <kbd className="font-mono not-italic border border-[var(--color-border-muted)] px-1.5 py-px">
      {children}
    </kbd>
  );
}

function Divider(): React.ReactElement {
  return <span aria-hidden="true" className="hidden sm:block w-px h-4 bg-[var(--color-border-muted)]" />;
}

export interface SoloViewProps {
  textSource?: SoloTextSource;
}

export function SoloView({ textSource = defaultTextSource }: SoloViewProps): React.ReactElement {
  const prefs = useSoloStore((s) => s.prefs);
  const fontSize = useSettingsStore((s) => s.settings.fontSize);

  const [initial] = useState(() => {
    const p = useSoloStore.getState().prefs;
    const t = textSource.initial(p, undefined);
    const engine = new TypingEngine();
    engine.init(t.text);
    return { engine, layout: new PassageLayout(), prefs: p, id: t.id };
  });
  const engine = initial.engine;
  const layout = initial.layout;

  const [phase, setPhase] = useState<Phase>("ready");
  const [result, setResult] = useState<SoloResult | null>(null);
  const [remaining, setRemaining] = useState<number>(initial.prefs.time);
  // Re-render trigger: chars and caret are read straight from the engine.
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  // Bumped on every restart so the focus effect below re-runs.
  const [restartSeq, setRestartSeq] = useState(0);

  const [isTouch] = useState(detectCoarsePointer);
  const [inputFocused, setInputFocused] = useState(false);

  const phaseRef = useRef<Phase>("ready");
  const testPrefsRef = useRef<SoloPrefs>(initial.prefs);
  const passageIdRef = useRef<string | undefined>(initial.id);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wantFocusRef = useRef<boolean>(true);
  const textSourceRef = useRef(textSource);
  textSourceRef.current = textSource;
  const fontSizeRef = useRef(fontSize);
  fontSizeRef.current = fontSize;

  const windowRef = useRef<HTMLDivElement | null>(null);
  const srInputRef = useRef<HTMLInputElement | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);

  // Mobile hidden-input path, copied from RaceView.tsx (see the comments
  // there): the input's own buffer, and the keydown-already-handled flag
  // that stops a keystroke from counting twice.
  const mobileBufferRef = useRef<string>(SR_INPUT_SENTINEL);
  const handledByKeydownRef = useRef<boolean>(false);

  const relayout = useCallback(() => {
    const size = fontSizeRef.current;
    try {
      layout.init(
        engine.getPassageText(),
        `${size}px "Courier Prime", ui-monospace, monospace`,
        size * 2,
      );
      layout.updateLayout(windowRef.current?.clientWidth || 800);
    } catch {
      // pretext needs a canvas; without one there are no line ranges and the
      // passage renders as one wrapped block with the caret at the origin.
    }
    bump();
  }, [engine, layout, bump]);

  const stopTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const finish = useCallback(
    (elapsedMs: number) => {
      if (phaseRef.current === "done") return;
      phaseRef.current = "done";
      stopTimer();
      setFocusMode(false);
      const p = testPrefsRef.current;
      const start = engine.getStartTimeMs() ?? Date.now();
      const holder: { stats?: TypingEngineStats } = {};
      const unsub = engine.subscribe("stats_updated", (s) => {
        holder.stats = s;
      });
      // WPM over exactly the elapsed time (the chosen duration in time mode).
      engine.updateStats(start + elapsedMs);
      unsub();
      const s = holder.stats ?? { rawWpm: 0, netWpm: 0, accuracy: 1, uncorrectedErrors: 0 };
      setResult({
        wpm: Math.round(s.netWpm),
        raw: Math.round(s.rawWpm),
        acc: Math.round(s.accuracy * 100),
        correct: engine.getCorrectChars(),
        errors: engine.getUncorrectedErrors(),
        elapsedMs,
        mode: p.mode,
        label: modeLabel(p),
      });
      setPhase("done");
    },
    [engine, stopTimer],
  );

  /** True once the time-mode clock has run out (checked on every key too, so
   * a key pressed between two interval ticks never counts past zero). */
  const timeIsUp = useCallback((): boolean => {
    const p = testPrefsRef.current;
    const start = engine.getStartTimeMs();
    if (p.mode !== "time" || start === null) return false;
    return Date.now() - start >= p.time * 1000;
  }, [engine]);

  const startTimer = useCallback(() => {
    stopTimer();
    const p = testPrefsRef.current;
    if (p.mode !== "time") return;
    const durationMs = p.time * 1000;
    intervalRef.current = setInterval(() => {
      const start = engine.getStartTimeMs();
      if (start === null) return;
      const left = durationMs - (Date.now() - start);
      if (left <= 0) {
        finish(durationMs);
        return;
      }
      setRemaining(Math.ceil(left / 1000));
    }, 100);
  }, [engine, finish, stopTimer]);

  /** New text, reset engine, timer, scroll window. `focus` moves the caret
   * into the test: right away when the input is mounted (inside the click,
   * so iOS opens the keyboard), otherwise after the next render (desktop). */
  const restart = useCallback(
    (focus: boolean) => {
      stopTimer();
      setFocusMode(false);
      const p = useSoloStore.getState().prefs;
      testPrefsRef.current = p;
      const next = textSourceRef.current.initial(p, passageIdRef.current);
      passageIdRef.current = next.id;
      engine.init(next.text);
      phaseRef.current = "ready";
      setPhase("ready");
      setResult(null);
      setRemaining(p.time);
      relayout();
      wantFocusRef.current = focus;
      if (focus && srInputRef.current) {
        srInputRef.current.focus({ preventScroll: true });
        wantFocusRef.current = false;
      }
      setRestartSeq((n) => n + 1);
    },
    [engine, relayout, stopTimer],
  );

  // Layout: on mount and when the font size changes.
  useEffect(() => {
    relayout();
  }, [fontSize, relayout]);

  // Re-measure once web fonts land (the first measure may use a fallback font).
  useEffect(() => {
    let cancelled = false;
    try {
      document.fonts?.ready?.then(() => {
        if (!cancelled) relayout();
      });
    } catch {
      // document.fonts unsupported
    }
    return () => {
      cancelled = true;
    };
  }, [relayout]);

  // Track container width.
  useEffect(() => {
    const el = windowRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          try {
            layout.updateLayout(entry.contentRect.width);
          } catch {
            // see relayout
          }
          bump();
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout, bump, phase]);

  // Engine events.
  useEffect(() => {
    const unsubKey = engine.subscribe("keystroke", (idx) => {
      if (phaseRef.current === "ready") {
        phaseRef.current = "running";
        setPhase("running");
        startTimer();
      }
      if (phaseRef.current === "running") setFocusMode(true);
      const p = testPrefsRef.current;
      // Runs before the engine's end-of-text check, so the finish line moves
      // before the caret can reach it.
      if (p.mode === "time" && engine.getPassageText().length - (idx + 1) < TIME_LOOKAHEAD_CHARS) {
        engine.append(" " + textSourceRef.current.more(p));
        relayout();
      }
      bump();
    });
    const unsubCorr = engine.subscribe("correction", () => bump());
    const unsubFin = engine.subscribe("finished", (finishTimeMs) => finish(finishTimeMs));
    return () => {
      unsubKey();
      unsubCorr();
      unsubFin();
    };
  }, [engine, startTimer, finish, relayout, bump]);

  // Keyboard: drives the engine only while focus is on the typing input or
  // nowhere (body). Buttons and the settings panel keep their keys.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const input = srInputRef.current;
      // Reassigned on every keydown, as in RaceView.
      handledByKeydownRef.current =
        input !== null &&
        e.target === input &&
        (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete");
      const active = document.activeElement;
      const drivesEngine =
        active === null || active === document.body || (input !== null && active === input);
      if (!drivesEngine || phaseRef.current === "done") return;
      if (phaseRef.current === "running" && timeIsUp()) {
        finish(testPrefsRef.current.time * 1000);
        return;
      }
      if (e.key === " " || e.key === "Spacebar") e.preventDefault();
      engine.handleKeyDown(e);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [engine, finish, timeIsUp]);

  // Focus mode ends on real pointer movement. Chrome also fires mousemove
  // after layout/transform changes with an unchanged position; ignore those,
  // or the line shift itself would cancel focus mode.
  useEffect(() => {
    let lastX: number | null = null;
    let lastY: number | null = null;
    const onMove = (e: MouseEvent) => {
      if (e.clientX === lastX && e.clientY === lastY) return;
      const noDelta = e.movementX === 0 && e.movementY === 0;
      if (noDelta && lastX === null) {
        // First event since mount with no movement: a synthetic one.
        lastX = e.clientX;
        lastY = e.clientY;
        return;
      }
      lastX = e.clientX;
      lastY = e.clientY;
      setFocusMode(false);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Unmount: stop the clock, restore the chrome.
  useEffect(() => {
    return () => {
      stopTimer();
      setFocusMode(false);
    };
  }, [stopTimer]);

  // Desktop: focus the typing input on mount and after every restart, so the
  // first keystroke starts the test. Touch waits for a tap (iOS only opens
  // the keyboard from a user gesture).
  useEffect(() => {
    if (isTouch || !wantFocusRef.current || phase === "done") return;
    srInputRef.current?.focus({ preventScroll: true });
    wantFocusRef.current = false;
  }, [isTouch, restartSeq, phase]);

  // Results: focus "Next test" so Enter starts the next one.
  useEffect(() => {
    if (phase === "done") nextButtonRef.current?.focus();
  }, [phase]);

  const choose = (patch: Partial<SoloPrefs>, e: React.MouseEvent<HTMLButtonElement>) => {
    setSoloPrefs(patch);
    // Pointer click (detail > 0): back to typing. Keyboard activation
    // (detail 0): stay on the button so the mode bar stays navigable.
    restart(e.detail > 0);
  };

  // --- mobile hidden input (copied from RaceView.tsx) ---
  const handleTrackActivate = () => {
    srInputRef.current?.focus();
  };

  const handleMobileFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    el.value = SR_INPUT_SENTINEL;
    mobileBufferRef.current = SR_INPUT_SENTINEL;
    try {
      el.setSelectionRange(SR_INPUT_SENTINEL.length, SR_INPUT_SENTINEL.length);
    } catch {
      // setSelectionRange unsupported on this input type
    }
    setInputFocused(true);
  };

  const handleMobileInput = (e: React.FormEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    if (handledByKeydownRef.current) {
      handledByKeydownRef.current = false;
      el.value = SR_INPUT_SENTINEL;
      mobileBufferRef.current = SR_INPUT_SENTINEL;
      return;
    }
    if (phaseRef.current !== "done" && !(phaseRef.current === "running" && timeIsUp())) {
      const diff = diffInput(mobileBufferRef.current, el.value);
      if (diff.type === "char") {
        engine.handleKeyDown(createSyntheticKeyboardEvent(diff.ch));
      } else if (diff.type === "backspace") {
        for (let i = 0; i < diff.count; i++) {
          engine.handleKeyDown(createSyntheticKeyboardEvent("Backspace"));
        }
      }
    } else if (phaseRef.current === "running") {
      finish(testPrefsRef.current.time * 1000);
    }
    el.value = SR_INPUT_SENTINEL;
    mobileBufferRef.current = SR_INPUT_SENTINEL;
  };

  // --- render ---
  const text = engine.getPassageText();
  const states = engine.getCharStates();
  const ownIndex = engine.getOwnIndex();
  const lineHeight = fontSize * 2;
  const lines = layout.getLineRanges();
  const coords = layout.getCoordinates(ownIndex);
  const caretLine = lines.length > 0 ? Math.round(coords.y / lineHeight) : 0;
  const topLine = Math.max(0, caretLine - 1);
  const visibleLines: readonly LineRange[] =
    lines.length > 0 ? lines.slice(topLine, topLine + VISIBLE_LINES) : [];

  const renderChars = (start: number, end: number) => {
    const out: React.ReactElement[] = [];
    for (let i = start; i < end; i++) {
      const state = states[i] ?? "pending";
      out.push(
        <span key={i} className={`char char-${state}`} data-state={state}>
          {text[i]}
        </span>,
      );
    }
    return out;
  };

  const totalWords = text.length > 0 ? text.split(" ").length : 0;
  let typedWords = 0;
  if (ownIndex >= text.length) {
    typedWords = totalWords;
  } else {
    for (let i = 0; i < ownIndex; i++) if (text[i] === " ") typedWords++;
  }
  const testPrefs = testPrefsRef.current;
  const counter =
    testPrefs.mode === "time"
      ? String(phase === "ready" ? testPrefs.time : remaining)
      : `${typedWords}/${totalWords}`;

  const finishBlocked = phase !== "done" && ownIndex >= text.length && !engine.getIsFinished();
  const caretTransform = `translate3d(${coords.x.toFixed(2)}px, ${coords.y.toFixed(2)}px, 0)`;

  const amountGroup = (() => {
    if (prefs.mode === "time") {
      return {
        label: "Duration",
        items: TIME_OPTIONS.map((n) => ({
          key: String(n),
          text: String(n),
          aria: `${n} seconds`,
          active: prefs.time === n,
          patch: { time: n } as Partial<SoloPrefs>,
        })),
      };
    }
    if (prefs.mode === "words") {
      return {
        label: "Word count",
        items: WORD_OPTIONS.map((n) => ({
          key: String(n),
          text: String(n),
          aria: `${n} words`,
          active: prefs.words === n,
          patch: { words: n } as Partial<SoloPrefs>,
        })),
      };
    }
    return {
      label: "Passage length",
      items: PASSAGE_OPTIONS.map((c) => ({
        key: c,
        text: c,
        aria: undefined,
        active: prefs.passage === c,
        patch: { passage: c } as Partial<SoloPrefs>,
      })),
    };
  })();

  const choiceClass = "choice text-sm min-h-11 sm:min-h-8 inline-flex items-center";

  return (
    <div className="solo-view w-full text-left" data-testid="solo-view">
      <h1 className="sr-only">Typing test</h1>

      <div className="focus-fade mt-8">
        <div className="mode-bar flex flex-wrap items-center gap-x-4 gap-y-1">
          <div role="group" aria-label="Test type" className="flex flex-wrap gap-x-1">
            {(["time", "words", "passage"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={choiceClass}
                aria-pressed={prefs.mode === m}
                onClick={(e) => choose({ mode: m }, e)}
              >
                {m}
              </button>
            ))}
          </div>
          <Divider />
          <div role="group" aria-label={amountGroup.label} className="flex flex-wrap gap-x-1">
            {amountGroup.items.map((item) => (
              <button
                key={item.key}
                type="button"
                className={choiceClass}
                aria-pressed={item.active}
                aria-label={item.aria}
                onClick={(e) => choose(item.patch, e)}
              >
                {item.text}
              </button>
            ))}
          </div>
          {prefs.mode !== "passage" && (
            <>
              <Divider />
              <div role="group" aria-label="Extras" className="flex flex-wrap gap-x-1">
                <button
                  type="button"
                  className={choiceClass}
                  aria-pressed={prefs.punctuation}
                  onClick={(e) => choose({ punctuation: !prefs.punctuation }, e)}
                >
                  punctuation
                </button>
                <button
                  type="button"
                  className={choiceClass}
                  aria-pressed={prefs.numbers}
                  onClick={(e) => choose({ numbers: !prefs.numbers }, e)}
                >
                  numbers
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {phase !== "done" ? (
        <div className="mt-14">
          <div
            role="timer"
            aria-label={testPrefs.mode === "time" ? "Seconds left" : "Words typed"}
            className="font-mono text-2xl leading-none tabular-nums text-[var(--color-accent-green)]"
            data-testid="solo-counter"
          >
            {counter}
          </div>

          {isTouch && (
            <div className={`label mt-3${inputFocused ? " invisible" : ""}`} data-testid="mobile-hint">
              Tap the passage to type
            </div>
          )}

          <div
            ref={windowRef}
            className="solo-window mt-4"
            style={{ height: `${lineHeight * VISIBLE_LINES}px` }}
            onClick={handleTrackActivate}
            data-testid="solo-passage"
          >
            <div
              className="solo-track"
              style={{ transform: `translate3d(0, ${-topLine * lineHeight}px, 0)` }}
            >
              {visibleLines.length > 0 ? (
                visibleLines.map((line) => (
                  <div
                    key={line.start}
                    className="solo-line"
                    style={{ top: `${line.y}px`, height: `${lineHeight}px` }}
                  >
                    {renderChars(line.start, line.end)}
                  </div>
                ))
              ) : (
                <div className="solo-flow">{renderChars(0, text.length)}</div>
              )}

              <div
                className="local-cursor"
                data-testid="local-cursor"
                aria-hidden="true"
                style={{ transform: caretTransform }}
              />

              <input
                ref={srInputRef}
                className="sr-input"
                data-testid="mobile-input"
                aria-label="Type the test text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                inputMode="text"
                enterKeyHint="done"
                defaultValue={SR_INPUT_SENTINEL}
                style={{ transform: caretTransform }}
                onFocus={handleMobileFocus}
                onBlur={() => setInputFocused(false)}
                onInput={handleMobileInput}
              />
            </div>
          </div>

          {/* Directly after the typing input in DOM order, so Tab then Enter
              restarts natively. */}
          <div className="focus-fade mt-8">
            <button
              type="button"
              className="label bg-transparent border-0 p-0 min-h-11 inline-flex items-center gap-1.5 cursor-pointer hover:text-[var(--color-text-bright)] transition-colors"
              onClick={() => restart(true)}
              data-testid="solo-restart"
            >
              <Kbd>tab</Kbd> + <Kbd>enter</Kbd> — restart
            </button>
          </div>
        </div>
      ) : (
        result && (
          <section aria-label="Test result" className="mt-14" data-testid="solo-results">
            <ResultSummary
              label={result.label}
              wpm={result.wpm}
              wpmTestId="solo-wpm"
              stats={[
                { label: "acc", value: `${result.acc}%` },
                { label: "raw", value: result.raw },
                {
                  label: "chars",
                  value: (
                    <>
                      <span aria-hidden="true">
                        {result.correct}/{result.errors}
                      </span>
                      <span className="sr-only">
                        {result.correct} correct, {result.errors} errors
                      </span>
                    </>
                  ),
                },
                { label: "time", value: formatSeconds(result.elapsedMs, result.mode) },
              ]}
            />
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
              <button
                ref={nextButtonRef}
                type="button"
                className="font-mono text-base font-bold tracking-[0.04em] bg-[var(--color-accent-green)] hover:bg-[var(--color-accent-green-hover)] text-[var(--color-bg-base)] border border-[var(--color-accent-green)] rounded-none py-3.5 px-8 cursor-pointer transition-colors"
                onClick={() => restart(true)}
              >
                Next test
              </button>
              <span className="label inline-flex items-center gap-1.5" aria-hidden="true">
                <Kbd>enter</Kbd> — next test
              </span>
            </div>
          </section>
        )
      )}

      {/* Always mounted, so screen readers announce what appears in it. */}
      <div role="status" aria-live="polite">
        {finishBlocked && (
          <div
            data-testid="finish-blocked-banner"
            className="mt-5 pt-2.5 border-t border-[var(--color-status-danger)] text-[var(--color-status-danger)] text-sm"
          >
            — Finish blocked. Backspace to fix errors first.
          </div>
        )}
        {phase === "done" && result && (
          <span className="sr-only">
            Test complete. {result.wpm} wpm, {result.acc}% accuracy.
          </span>
        )}
      </div>
    </div>
  );
}
