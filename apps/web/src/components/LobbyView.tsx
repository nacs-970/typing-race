import React, { useCallback, useState } from "react";
import type { CorpusType, CorpusCategory } from "@typing-race/shared";
import { useRaceStore, type LobbyPlayer } from "../store/race.ts";
import { useConnectionStore } from "../store/connection.ts";
import { ws } from "../net/ws.ts";
import { cursorSlotColor } from "../core/cursor-manager.ts";
import { useConfirmClick } from "./useConfirmClick.ts";
import { copyText } from "../core/clipboard.ts";

export interface LobbyViewProps {
  roomCode: string;
  isHost: boolean;
  players?: LobbyPlayer[];
  onStartRace: (
    passageId?: string,
    graceSeconds?: number,
    corpusType?: CorpusType,
    corpusCategory?: CorpusCategory,
  ) => void;
  onToggleReady?: (ready: boolean) => void;
  onLeaveRoom?: () => void;
}

export function LobbyView({
  roomCode,
  isHost,
  players: propPlayers,
  onStartRace,
  onToggleReady,
  onLeaveRoom,
}: LobbyViewProps): React.ReactElement {
  const storePlayers = useRaceStore((s) => s.lobbyPlayers);
  const players = propPlayers ?? storePlayers;
  const myPlayerId = useConnectionStore((s) => s.playerId);

  const preview = useRaceStore((s) => s.hostPickedPassagePreview);
  const passageText = useRaceStore((s) => s.passageText);
  const storeCorpusType = useRaceStore((s) => s.corpusType);
  const storeCorpusCategory = useRaceStore((s) => s.corpusCategory);

  const [corpusType, setCorpusType] = useState<CorpusType>(storeCorpusType ?? "passage");
  const [corpusCategory, setCorpusCategory] = useState<CorpusCategory>(storeCorpusCategory ?? "mid");
  const [grace, setGrace] = useState<number>(() => useRaceStore.getState().graceSeconds);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [codeCopied, setCodeCopied] = useState<boolean>(false);

  const me = players.find((p) => p.playerId === myPlayerId);
  const guests = players.filter((p) => !p.isHost);
  const allGuestsReady = guests.length > 0 && guests.every((g) => g.isReady);

  const handleCorpusTypeChange = (newType: CorpusType) => {
    setCorpusType(newType);
    useRaceStore.setState({ corpusType: newType });
    ws.send({
      type: "set_corpus_config",
      corpusType: newType,
      corpusCategory,
    });
  };

  const handleCorpusCategoryChange = (newCategory: CorpusCategory) => {
    setCorpusCategory(newCategory);
    useRaceStore.setState({ corpusCategory: newCategory });
    ws.send({
      type: "set_corpus_config",
      corpusType,
      corpusCategory: newCategory,
    });
  };

  const handleToggleReady = () => {
    const nextReady = !me?.isReady;
    if (onToggleReady) {
      onToggleReady(nextReady);
    } else {
      ws.send({ type: "set_ready", ready: nextReady });
    }
  };

  const handleCopyLink = async () => {
    const url = typeof window !== "undefined" ? window.location.href : roomCode;
    if (await copyText(url)) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleCopyCode = async () => {
    if (await copyText(roomCode)) {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 900);
    }
  };

  const startRaceAction = useCallback(() => {
    onStartRace(undefined, grace, corpusType, corpusCategory);
  }, [onStartRace, grace, corpusType, corpusCategory]);

  const { armed: forceStartArmed, onClick: onForceStartClick } = useConfirmClick(startRaceAction);

  const handleLeaveConfirmed = useCallback(() => {
    onLeaveRoom?.();
  }, [onLeaveRoom]);
  const { armed: leaveArmed, onClick: onLeaveClick } = useConfirmClick(handleLeaveConfirmed);

  const handleStartRace = () => {
    if (guests.length > 0 && !allGuestsReady) {
      onForceStartClick();
      return;
    }
    startRaceAction();
  };

  const getCategoryDescription = (type: CorpusType, cat: CorpusCategory): string => {
    if (type === "random_words") {
      switch (cat) {
        case "short":
          return "~20–30 random common words — rapid sprint.";
        case "mid":
          return "~40–55 random common words — standard competition.";
        case "long":
          return "~70–90 random common words — endurance test.";
      }
    }
    switch (cat) {
      case "short":
        return "~30–42 words of classic literature or quotes.";
      case "mid":
        return "~43–49 words of rich storytelling.";
      case "long":
        return "~50–60 words of classic narrative prose.";
    }
  };

  return (
    <div className="lobby-view w-full max-w-[860px] mx-auto text-left font-mono">
      {/* Header */}
      <div className="flex justify-between items-baseline pb-2.5 border-b border-[var(--color-border-muted)] label">
        <span>Room · {isHost ? "Host" : "Player"}</span>
        <div className="flex gap-6 normal-case tracking-normal text-sm font-mono">
          <button
            type="button"
            className="bg-transparent border-0 p-0 text-[var(--color-text-bright)] underline underline-offset-4 cursor-pointer font-mono text-sm"
            onClick={handleCopyLink}
          >
            <span aria-live="polite">{copySuccess ? "copied" : "room link"}</span>
          </button>
          {onLeaveRoom && (
            <button
              type="button"
              aria-label="leave"
              className={`bg-transparent border-0 p-0 text-[var(--color-status-danger)] underline underline-offset-4 cursor-pointer font-mono text-sm ${
                leaveArmed ? "font-bold" : ""
              }`}
              onClick={onLeaveClick}
            >
              <span aria-live="polite">{leaveArmed ? "leave?" : "leave."}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-between items-end pt-9 pb-7">
        <div>
          <h1 className="m-0">
            <button
              type="button"
              aria-label={`Copy room code ${roomCode}`}
              title="Click to copy the room code"
              className={`font-serif-display text-[clamp(3.5rem,10vw,88px)] leading-none tracking-[0.04em] bg-transparent border-0 p-0 cursor-copy transition-colors duration-300 ${
                codeCopied
                  ? "text-[color-mix(in_srgb,var(--color-accent-green)_45%,var(--color-bg-base))]"
                  : "text-[var(--color-text-bright)] hover:text-[var(--color-accent-green)]"
              }`}
              onClick={handleCopyCode}
            >
              {roomCode}
            </button>
          </h1>
          <span className="label block mt-2" aria-live="polite">
            {codeCopied ? "Code copied" : "Code"}
          </span>
          <p className="m-0 mt-3 italic text-[15px] text-[var(--color-text-muted)]">
            {isHost
              ? "Configure the race, then start when everyone is ready."
              : "Waiting for host to start…"}
          </p>
        </div>
        <span className="label"><b>{players.length}</b> of 8 seats</span>
      </div>

      {/* Empty State when solo in room */}
      {players.length <= 1 && (
        <div className="lobby-empty-state my-6 py-6 border-y border-[var(--color-border-muted)]">
          <h2 className="text-base font-bold text-[var(--color-text-bright)] m-0 mb-1">
            Waiting for Competitors
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] m-0 mb-4">
            Share the invite link or room code with friends to start racing.
          </p>
            {/* }
          <button
            type="button"
            aria-label="Copy room invite link"
            className="inline-block py-2.5 px-4 bg-[var(--color-accent-green)] hover:bg-[var(--color-accent-green-hover)] text-[var(--color-bg-base)] font-mono font-bold text-sm cursor-pointer border border-[var(--color-accent-green)] rounded-none"
            onClick={handleCopyLink}
          >
            {copySuccess ? "copied" : "room link"}
          </button> */}
         <p aria-hidden="true">⊹ ࣪ ﹏𓊝﹏𓂁﹏⊹ ࣪ ˖</p>
        </div>
      )}

      {/* Competitors List */}
      <div className="players-list mb-7">
        <div className="label py-2.5 border-t border-[var(--color-text-bright)]">
          Competitors ({players.length})
        </div>
        <ul className="flex flex-col text-base list-none m-0 p-0">
          {players.map((p, idx) => {
            const isMe = p.playerId === myPlayerId;
            return (
              <li
                key={p.playerId}
                className="flex items-baseline gap-4 py-2.5 border-b border-[var(--color-border-subtle)]"
              >
                <span
                  className="px-1.5 font-mono tabular-nums text-[var(--color-on-cursor)]"
                  style={{ backgroundColor: isMe ? "var(--color-cursor-own)" : cursorSlotColor(idx) }}
                  data-player-color={p.playerId}
                  title={isMe ? "Your cursor color" : `${p.nickname}'s cursor color`}
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className={isMe ? "font-bold text-[var(--color-text-bright)]" : "text-[var(--color-text-bright)]"}>
                  {p.nickname}
                </span>
                {isMe && (
                  <span className="italic text-[var(--color-text-muted)] text-sm">
                    (you)
                  </span>
                )}
                <span className="flex-grow border-b border-dotted border-[var(--color-border-muted)] -translate-y-1" />
                {p.isHost ? (
                  <span className="italic text-[var(--color-text-muted)]">host</span>
                ) : p.isReady ? (
                  <span className="text-[var(--color-accent-green)]">Ready</span>
                ) : (
                  <span className="italic text-[var(--color-text-muted)]">Waiting…</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Guest Ready Up Action */}
      {!isHost && (
        <div className="guest-controls mb-7">
          <button
            type="button"
            className={`w-full py-3.5 px-4 font-mono font-bold tracking-[0.04em] text-base cursor-pointer rounded-none transition-colors ${
              me?.isReady
                ? "bg-transparent text-[var(--color-text-bright)] border border-[var(--color-text-bright)] hover:bg-[var(--color-bg-surface-hover)]"
                : "bg-[var(--color-accent-green)] hover:bg-[var(--color-accent-green-hover)] text-[var(--color-bg-base)] border border-[var(--color-accent-green)]"
            }`}
            onClick={handleToggleReady}
          >
            {me?.isReady ? "Cancel Ready" : "Ready Up"}
          </button>

          <div className="mt-7 border-t border-[var(--color-text-bright)]">
            <div className="flex items-center justify-between py-3 border-b border-[var(--color-border-subtle)]">
              <span className="label">Selected Corpus</span>
              <span className="font-mono text-base font-bold text-[var(--color-text-bright)]">
                {storeCorpusType === "random_words" ? "Random Words" : "Passage"} • {storeCorpusCategory}
              </span>
            </div>
            <p className="m-0 mt-3 italic text-sm text-[var(--color-text-muted)]">
              {getCategoryDescription(storeCorpusType ?? "passage", storeCorpusCategory ?? "mid")}
            </p>
            <p className="m-0 mt-1 italic text-xs text-[var(--color-text-muted)]">
              A random {storeCorpusType === "random_words" ? "word sequence" : "passage"} will be dealt when the host starts the race.
            </p>
          </div>

          {preview && (
            <div className="host-choice mt-3 text-sm text-[var(--color-text-muted)]">
              <span className="font-bold text-[var(--color-text-bright)]">Host preview:</span>{" "}
              <span className="preview italic">{preview}</span>
            </div>
          )}
          {passageText && (
            <p className="passage-preview text-xs text-[var(--color-text-muted)] mt-2 italic">
              {passageText}
            </p>
          )}
        </div>
      )}

      {/* Host Controls */}
      {isHost && (
        <div className="host-controls flex flex-col mt-7 border-t border-[var(--color-text-bright)]">
          {/* Corpus Type Selector */}
          <div className="flex items-center justify-between py-3 border-b border-[var(--color-border-subtle)]">
            <span className="label">Corpus</span>
            <div className="flex gap-5 text-base">
              <button
                type="button"
                className="choice"
                aria-pressed={corpusType === "passage"}
                onClick={() => handleCorpusTypeChange("passage")}
              >
                Passage
              </button>
              <button
                type="button"
                className="choice"
                aria-pressed={corpusType === "random_words"}
                onClick={() => handleCorpusTypeChange("random_words")}
              >
                Random words
              </button>
            </div>
          </div>

          {/* Category / Length Buttons */}
          <div className="flex items-center justify-between py-3 border-b border-[var(--color-border-subtle)]">
            <span className="label">Length</span>
            <div className="flex gap-5 text-base">
              {(["short", "mid", "long"] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className="choice"
                  aria-pressed={corpusCategory === cat}
                  onClick={() => handleCorpusCategoryChange(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Countdown Grace */}
          <div className="flex items-center justify-between py-3 border-b border-[var(--color-border-subtle)]">
            <span className="label">Countdown grace</span>
            <div className="flex gap-5 text-base">
              {[3, 5, 10].map((g) => (
                <button
                  key={g}
                  type="button"
                  className="choice"
                  aria-pressed={grace === g}
                  onClick={() => {
                    setGrace(g);
                    useRaceStore.setState({ graceSeconds: g });
                  }}
                >
                  {g}s
                </button>
              ))}
            </div>
          </div>

          {/* Category Description */}
          <p className="m-0 mt-3 italic text-sm text-[var(--color-text-muted)]">
            {getCategoryDescription(corpusType, corpusCategory)} Dealt at random when the race starts.
          </p>

          {/* Start Race Button */}
          <button
            type="button"
            className={`w-full mt-7 font-mono text-base font-bold tracking-[0.04em] py-3.5 px-4 cursor-pointer rounded-none transition-colors ${
              guests.length === 0 || allGuestsReady
                ? "bg-[var(--color-accent-green)] hover:bg-[var(--color-accent-green-hover)] text-[var(--color-bg-base)] border border-[var(--color-accent-green)]"
                : "bg-transparent text-[var(--color-text-bright)] border border-[var(--color-text-bright)] hover:bg-[var(--color-bg-surface-hover)]"
            }`}
            onClick={handleStartRace}
          >
            <span aria-live="polite">
              {guests.length === 0 || allGuestsReady
                ? "Start Race"
                : forceStartArmed
                  ? "Start anyway?"
                  : "Force Start Race"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
