import React, { useEffect, useRef, useState, useMemo } from "react";
import { useRaceStore, setRaceState, type CharState } from "../store/race.ts";
import { useCursorStore, setCursorState } from "../store/cursor.ts";
import { CursorManager } from "../core/cursor-manager.ts";
import { PassageLayout } from "../core/layout.ts";
import { TypingEngine } from "../core/typing-engine.ts";
import { RaceHud } from "./RaceHud.tsx";
import { useSettingsStore } from "../store/settings.ts";
import { diffInput, createSyntheticKeyboardEvent, SR_INPUT_SENTINEL } from "../core/mobile-input.ts";

/** Detects a touch device without ever throwing in happy-dom, where
 * `window.matchMedia` is undefined. */
function detectCoarsePointer(): boolean {
  try {
    return window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  } catch {
    return false;
  }
}

export interface RaceViewProps {
  passageText: string;
  playerId?: string;
  typingEngine?: TypingEngine;
  cursorManager?: CursorManager;
  passageLayout?: PassageLayout;
  onKeystroke?: (index: number, char: string) => void;
  onCorrection?: (count: number) => void;
  onLeaveRoom?: () => void;
}

export function RaceView({
  passageText,
  playerId = "me",
  typingEngine,
  cursorManager,
  passageLayout,
  onKeystroke,
  onCorrection,
  onLeaveRoom,
}: RaceViewProps): React.ReactElement {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const localCursorElRef = useRef<HTMLDivElement | null>(null);
  const srInputRef = useRef<HTMLInputElement | null>(null);
  // The hidden input's own buffer, mirrored outside React state so the
  // native `input` event (which fires outside React's render cycle) always
  // diffs against the value we last set, not a stale render.
  const mobileBufferRef = useRef<string>(SR_INPUT_SENTINEL);
  // Set on every keydown aimed at the hidden input, cleared on every
  // keydown that isn't. A real keyboard (desktop, iOS) fires keydown before
  // the browser updates the input's value and fires `input`; this flag lets
  // the input handler recognize "I already gave this keystroke to the
  // engine" and skip it, so it isn't counted twice. It also closes an
  // anti-cheat gap: a held-down key or a Ctrl/Cmd+Backspace still reaches
  // the engine's own repeat/modifier checks (which reject it), and the flag
  // then makes the input handler treat the browser's own edit as already
  // handled instead of replaying it.
  const handledByKeydownRef = useRef<boolean>(false);

  // Fallback engine, manager, layout instances if not provided via props
  const localEngine = useMemo(() => typingEngine ?? new TypingEngine(), [typingEngine]);
  const localManager = useMemo(() => cursorManager ?? new CursorManager(), [cursorManager]);
  const localLayout = useMemo(() => passageLayout ?? new PassageLayout(), [passageLayout]);

  const fontSize = useSettingsStore((s) => s.settings.fontSize);
  const ownCharStates = useRaceStore((s) => s.ownCharStates);
  const [charStates, setCharStates] = useState<readonly CharState[]>(() => localEngine.getCharStates());
  const ownIndex = useCursorStore((s) => s.ownIndex);
  const [localCoords, setLocalCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isTouch] = useState(detectCoarsePointer);
  const [mobileInputFocused, setMobileInputFocused] = useState(false);

  // Initialize the engine only when the passage changes. Keeping fontSize out
  // of these deps matters: re-running init() mid-race wipes typed progress.
  useEffect(() => {
    localEngine.init(passageText);
    setCharStates([...localEngine.getCharStates()]);
  }, [passageText, localEngine]);

  // (Re)measure layout when the passage or font size changes
  useEffect(() => {
    localLayout.init(
      passageText,
      `${fontSize}px "Courier Prime", ui-monospace, monospace`,
      fontSize * 2,
    );
    localLayout.updateLayout(trackRef.current?.clientWidth || 800);
    localManager.setPassageText(passageText);
    localManager.setFontSize(fontSize);
    setLocalCoords(localLayout.getCoordinates(useCursorStore.getState().ownIndex));
  }, [passageText, fontSize, localLayout, localManager]);

  // Mount cursor overlay outside React tree
  useEffect(() => {
    if (!overlayRef.current) return;
    localManager.mount(overlayRef.current, localLayout);
    return () => localManager.unmount();
  }, [localManager, localLayout]);

  // Register lobby players with their entered nicknames
  useEffect(() => {
    const syncOpponents = () => {
      const lobbyPlayers = useRaceStore.getState().lobbyPlayers;
      // Slot = lobby join index, so colors match the lobby list and every viewer.
      lobbyPlayers.forEach((p, slot) => {
        if (p.playerId !== playerId) {
          localManager.registerPlayer(p.playerId, p.nickname, slot);
        }
      });
    };
    syncOpponents();
    const unsub = useRaceStore.subscribe(syncOpponents);
    return unsub;
  }, [localManager, playerId]);

  // Synchronize opponent cursors from cursor store into CursorManager
  useEffect(() => {
    const unsub = useCursorStore.subscribe((s) => {
      const lobbyPlayers = useRaceStore.getState().lobbyPlayers;
      let unknown = 0;
      for (const [pid, cursor] of s.cursors.entries()) {
        if (pid !== playerId) {
          const lobbyIndex = lobbyPlayers.findIndex((p) => p.playerId === pid);
          // Players missing from the lobby list get slots after everyone in it.
          const slot = lobbyIndex >= 0 ? lobbyIndex : lobbyPlayers.length + unknown++;
          const nickname =
            lobbyPlayers[lobbyIndex]?.nickname || localManager.getPlayerNickname(pid) || `Player ${slot + 1}`;
          localManager.registerPlayer(pid, nickname, slot);
          localManager.onCursorUpdate(pid, cursor.index);
        }
      }
    });
    return unsub;
  }, [localManager, playerId]);

  // Track layout resize
  useEffect(() => {
    if (!trackRef.current) return;
    if (typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          localLayout.updateLayout(entry.contentRect.width);
          setLocalCoords(localLayout.getCoordinates(useCursorStore.getState().ownIndex));
        }
      }
    });
    ro.observe(trackRef.current);
    return () => ro.disconnect();
  }, [localLayout]);

  // Update local cursor coordinates when ownIndex changes
  useEffect(() => {
    const coords = localLayout.getCoordinates(ownIndex);
    setLocalCoords(coords);
    localManager.setLocalProgress(ownIndex);
  }, [ownIndex, localLayout, localManager]);

  // Handle keyboard events via TypingEngine
  useEffect(() => {
    const unsubKey = localEngine.subscribe("keystroke", (idx, ch) => {
      onKeystroke?.(idx, ch);
      const nextIndex = idx + 1;
      setCursorState({ ownIndex: nextIndex });
      localManager.setLocalProgress(nextIndex);
      const current = [...localEngine.getCharStates()];
      setCharStates(current);
      setRaceState({ ownCharStates: current });
    });

    const unsubCorr = localEngine.subscribe("correction", (count) => {
      onCorrection?.(count);
      const nextIndex = Math.max(0, localEngine.getOwnIndex());
      setCursorState((s) => ({ ownIndex: nextIndex }));
      localManager.setLocalProgress(nextIndex);
      const current = [...localEngine.getCharStates()];
      setCharStates(current);
      setRaceState({ ownCharStates: current });
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
      }
      // Reassigned (not just set to true) on every keydown, so it never goes
      // stale: a key aimed elsewhere, or an Android "Unidentified" keydown,
      // clears it again. Deliberately ignores repeat/modifiers so a held key
      // or Ctrl/Cmd+Backspace on the hidden input is also treated as
      // "already handled" — see the ref's comment above.
      handledByKeydownRef.current =
        e.target === srInputRef.current &&
        (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete");
      localEngine.handleKeyDown(e);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      unsubKey();
      unsubCorr();
    };
  }, [localEngine, onKeystroke, onCorrection]);

  // Keep the local caret in view on the hidden input's virtual keyboard.
  // Keyed on localCoords (not on the keystroke/correction events) so it
  // runs after the caret's real new position has committed — otherwise a
  // line wrap would scroll to where the caret used to be.
  // On desktop, focus the typing input when the race mounts, so screen
  // readers switch to focus mode and pass keys through instead of using them
  // for browse-mode navigation. Touch devices wait for a tap: iOS only opens
  // the keyboard from a user gesture. The keydown-handled flag above keeps
  // each keystroke from counting twice.
  useEffect(() => {
    if (isTouch) return;
    srInputRef.current?.focus({ preventScroll: true });
  }, [isTouch]);

  useEffect(() => {
    // Touch only: on desktop the caret is already in view, and scrolling on
    // every keystroke would make the page jump.
    if (!isTouch || document.activeElement !== srInputRef.current) return;
    try {
      localCursorElRef.current?.scrollIntoView?.({ block: "center" });
    } catch {
      // scrollIntoView may be unimplemented (happy-dom) or unsupported.
    }
  }, [localCoords, isTouch]);

  const handleTrackActivate = () => {
    // iOS only allows focusing an input from inside a user gesture, so this
    // has to run from the click handler, not an effect. The hidden input
    // stays reachable by keyboard (Tab) for a11y even without this handler.
    srInputRef.current?.focus();
  };

  const handleMobileFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    el.value = SR_INPUT_SENTINEL;
    mobileBufferRef.current = SR_INPUT_SENTINEL;
    try {
      // Put the caret after the sentinel, so the next typed character is
      // appended, not inserted before it (which diffInput would reject).
      el.setSelectionRange(SR_INPUT_SENTINEL.length, SR_INPUT_SENTINEL.length);
    } catch {
      // Some environments don't support setSelectionRange on this input type.
    }
    setMobileInputFocused(true);
  };

  const handleMobileBlur = () => {
    setMobileInputFocused(false);
  };

  const handleMobileInput = (e: React.FormEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    if (handledByKeydownRef.current) {
      // A real keydown (hardware keyboard, or iOS) already drove the
      // engine for this keystroke; this input event is its side effect.
      handledByKeydownRef.current = false;
      el.value = SR_INPUT_SENTINEL;
      mobileBufferRef.current = SR_INPUT_SENTINEL;
      return;
    }
    const diff = diffInput(mobileBufferRef.current, el.value);
    if (diff.type === "char") {
      localEngine.handleKeyDown(createSyntheticKeyboardEvent(diff.ch));
    } else if (diff.type === "backspace") {
      for (let i = 0; i < diff.count; i++) {
        localEngine.handleKeyDown(createSyntheticKeyboardEvent("Backspace"));
      }
    }
    // Reset regardless of diff type (including "ignore"), which both
    // restores the previous value and keeps the buffer from growing.
    el.value = SR_INPUT_SENTINEL;
    mobileBufferRef.current = SR_INPUT_SENTINEL;
  };

  return (
    <div className="race-view relative w-full select-none font-mono">
      <RaceHud
        typingEngine={localEngine}
        passageLength={passageText.length}
        onLeaveRoom={onLeaveRoom}
      />
      {isTouch && (
        <div
          className={`label mb-2${mobileInputFocused ? " invisible" : ""}`}
          data-testid="mobile-hint"
        >
          Tap the passage to type
        </div>
      )}
      <div
        ref={trackRef}
        className="passage-track relative font-mono select-none mt-12"
        onClick={handleTrackActivate}
      >
        {passageText.split("").map((ch, i) => {
          const storeState = ownCharStates[i];
          const localState = charStates[i];
          const state: CharState =
            storeState && storeState !== "pending"
              ? storeState
              : (localState ?? storeState ?? "pending");
          return (
            <span
              key={i}
              className={`char char-${state}`}
              data-state={state}
            >
              {ch}
            </span>
          );
        })}

        {/* Local player priority cursor (z-index 20, Sunlit Clay) */}
        <div
          ref={localCursorElRef}
          className="local-cursor"
          data-testid="local-cursor"
          style={{
            transform: `translate3d(${localCoords.x.toFixed(2)}px, ${localCoords.y.toFixed(2)}px, 0)`,
          }}
        />

        {/* Isolated DOM overlay container mutated exclusively by CursorManager (0 React commits) */}
        <div
          ref={overlayRef}
          className="cursor-overlay absolute inset-0 pointer-events-none"
          data-testid="cursor-overlay"
        />

        {/* Visually hidden but focusable input: the only way a touch
            keyboard opens. Desktop is unaffected — the window keydown
            listener keeps driving the engine, and this is only focused
            when the passage track is tapped or clicked. Positioned over
            the caret line so iOS doesn't scroll the page to the input. */}
        <input
          ref={srInputRef}
          className="sr-input"
          data-testid="mobile-input"
          aria-label="Type the passage"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="done"
          defaultValue={SR_INPUT_SENTINEL}
          style={{
            transform: `translate3d(${localCoords.x.toFixed(2)}px, ${localCoords.y.toFixed(2)}px, 0)`,
          }}
          onFocus={handleMobileFocus}
          onBlur={handleMobileBlur}
          onInput={handleMobileInput}
        />
      </div>

      {/* Always mounted, so screen readers announce the note when it appears. */}
      <div role="status">
        {ownIndex >= passageText.length && !localEngine.getIsFinished() && (
          <div
            data-testid="finish-blocked-banner"
            className="mt-5 pt-2.5 border-t border-[var(--color-status-danger)] text-[var(--color-status-danger)] text-sm"
          >
            — Finish blocked. Backspace to fix errors first.
          </div>
        )}
      </div>
    </div>
  );
}
