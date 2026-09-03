import React, { useEffect, useRef, useState, useMemo } from "react";
import { useRaceStore, setRaceState, type CharState } from "../store/race.ts";
import { useCursorStore, setCursorState } from "../store/cursor.ts";
import { CursorManager } from "../core/cursor-manager.ts";
import { PassageLayout } from "../core/layout.ts";
import { TypingEngine } from "../core/typing-engine.ts";
import { RaceHud } from "./RaceHud.tsx";

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

  // Fallback engine, manager, layout instances if not provided via props
  const localEngine = useMemo(() => typingEngine ?? new TypingEngine(), [typingEngine]);
  const localManager = useMemo(() => cursorManager ?? new CursorManager(), [cursorManager]);
  const localLayout = useMemo(() => passageLayout ?? new PassageLayout(), [passageLayout]);

  const ownCharStates = useRaceStore((s) => s.ownCharStates);
  const [charStates, setCharStates] = useState<readonly CharState[]>(() => localEngine.getCharStates());
  const ownIndex = useCursorStore((s) => s.ownIndex);
  const [localCoords, setLocalCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Initialize engine and layout with passage text
  useEffect(() => {
    localEngine.init(passageText);
    setCharStates([...localEngine.getCharStates()]);
    localLayout.init(passageText, '16px "JetBrains Mono", monospace', 32);
    localLayout.updateLayout(trackRef.current?.clientWidth || 800);
    localManager.setPassageText(passageText);
  }, [passageText, localEngine, localLayout, localManager]);

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
      let slot = 0;
      for (const p of lobbyPlayers) {
        if (p.playerId !== playerId) {
          localManager.registerPlayer(p.playerId, p.nickname, slot);
          slot++;
        }
      }
    };
    syncOpponents();
    const unsub = useRaceStore.subscribe(syncOpponents);
    return unsub;
  }, [localManager, playerId]);

  // Synchronize opponent cursors from cursor store into CursorManager
  useEffect(() => {
    const unsub = useCursorStore.subscribe((s) => {
      const lobbyPlayers = useRaceStore.getState().lobbyPlayers;
      let slot = 0;
      for (const [pid, cursor] of s.cursors.entries()) {
        if (pid !== playerId) {
          const found = lobbyPlayers.find((p) => p.playerId === pid);
          const nickname = found?.nickname || localManager.getPlayerNickname(pid) || `Player ${slot + 1}`;
          localManager.registerPlayer(pid, nickname, slot);
          localManager.onCursorUpdate(pid, cursor.index);
          slot++;
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
      localEngine.handleKeyDown(e);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      unsubKey();
      unsubCorr();
    };
  }, [localEngine, onKeystroke, onCorrection]);

  return (
    <div className="race-view relative mx-auto w-full max-w-[800px] select-none font-mono">
      <RaceHud
        typingEngine={localEngine}
        passageLength={passageText.length}
        onLeaveRoom={onLeaveRoom}
      />
      <div ref={trackRef} className="passage-track relative text-[16px] leading-[32px] font-mono select-none">
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
      </div>

      {ownIndex >= passageText.length && !localEngine.getIsFinished() && (
        <div
          data-testid="finish-blocked-banner"
          className="mt-4 p-3 bg-amber-950/60 border border-amber-500/60 rounded-lg text-amber-200 text-sm flex items-center justify-between gap-3 animate-pulse shadow-lg"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span>
              <strong>Finish blocked:</strong> Passage contains uncorrected errors or low accuracy (&lt;50%). Hold <strong>Backspace</strong> to delete mistakes and correct them.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
