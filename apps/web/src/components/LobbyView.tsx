import React, { useState } from "react";
import type { CorpusType, CorpusCategory } from "@typing-race/shared";
import { useRaceStore, type LobbyPlayer } from "../store/race.ts";
import { useConnectionStore } from "../store/connection.ts";
import { ws } from "../net/ws.ts";

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
  const [grace, setGrace] = useState<number>(5);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

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

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      const url = typeof window !== "undefined" ? window.location.href : roomCode;
      navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleStartRace = () => {
    if (guests.length > 0 && !allGuestsReady) {
      const confirmed =
        typeof window !== "undefined" && window.confirm
          ? window.confirm("Force Start Race: Not all players are ready. Start the race anyway?")
          : true;
      if (!confirmed) return;
    }
    onStartRace(undefined, grace, corpusType, corpusCategory);
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
    <div className="lobby-view max-w-[800px] mx-auto p-6 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] text-[var(--color-text-bright)] font-mono">
      <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold m-0">Room {roomCode} {isHost ? "(Host)" : ""}</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 mb-0">
            {isHost ? "Configure race corpus and start when racers are ready" : "Waiting for host to start the race…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Copy room invite link"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-surface-hover)] transition-colors text-[var(--color-text-bright)] cursor-pointer"
            onClick={handleCopyLink}
          >
            {copySuccess ? "✓ Copied Link" : "📋 Copy Room Link"}
          </button>
          {onLeaveRoom && (
            <button
              type="button"
              aria-label="Leave room"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] hover:bg-[var(--color-danger-hover)] transition-colors text-[var(--color-danger-text)] cursor-pointer"
              onClick={onLeaveRoom}>
              🚪 Leave Room
            </button>
          )}
        </div>
      </div>

      {/* Empty State when solo in room */}
      {players.length <= 1 && (
        <div className="lobby-empty-state text-center p-6 my-4 border border-dashed border-[var(--color-border-subtle)] rounded-lg bg-[var(--color-bg-base)]/50">
          <h3 className="text-lg font-bold text-[var(--color-text-bright)] mb-1">Waiting for Competitors</h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            Share the invite link or room code with friends to start racing.
          </p>
          <button
            type="button"
            aria-label="Copy room invite link"
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-accent-clay)] text-white hover:bg-[var(--color-accent-hover)] transition-opacity"
            onClick={handleCopyLink}
          >
            {copySuccess ? "✓ Copied Invite Link" : "Copy Room Link"}
          </button>
        </div>
      )}

      {/* Competitors List */}
      <div className="players-list mb-6">
        <h4 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] font-bold mb-2">
          Competitors ({players.length})
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {players.map((p) => {
            const isMe = p.playerId === myPlayerId;
            return (
              <div
                key={p.playerId}
                className={`flex items-center justify-between p-2.5 rounded-lg border ${
                  isMe ? "border-[var(--color-accent-clay)]/50 bg-[var(--color-bg-base)]" : "border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]/40"
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="font-medium text-sm truncate">{p.nickname}</span>
                  {p.isHost && (
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[var(--color-bg-surface-hover)] text-[var(--color-text-muted)]">
                      Host
                    </span>
                  )}
                  {isMe && <span className="text-[10px] text-[var(--color-accent-clay)] font-semibold">(You)</span>}
                </div>
                <div>
                  {p.isReady ? (
                    <span className="text-xs font-bold text-[var(--color-status-success)] bg-[var(--color-status-success)]/10 px-2 py-0.5 rounded">
                      ✓ Ready
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--color-text-faint)] bg-[var(--color-text-faint)]/10 px-2 py-0.5 rounded">
                      Waiting…
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Guest Ready Up Action */}
      {!isHost && (
        <div className="guest-controls mb-6">
          <button
            type="button"
            className={`w-full py-3 rounded-lg text-base font-bold transition-colors ${
              me?.isReady
                ? "bg-[var(--color-bg-surface-hover)] hover:bg-[var(--color-border-subtle)] text-[var(--color-text-bright)] border border-[var(--color-border-subtle)]"
                : "bg-[var(--color-accent-clay)] hover:bg-[var(--color-accent-hover)] text-white"
            }`}
            onClick={handleToggleReady}
          >
            {me?.isReady ? "Cancel Ready" : "Ready Up"}
          </button>

          <div className="mt-4 p-4 rounded-lg bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs uppercase font-bold text-[var(--color-text-muted)]">
                Selected Corpus
              </span>
              <span className="text-xs font-bold text-[var(--color-accent-clay)] uppercase">
                {storeCorpusType === "random_words" ? "Random Words" : "Passage"} • {storeCorpusCategory}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] m-0">
              {getCategoryDescription(storeCorpusType ?? "passage", storeCorpusCategory ?? "mid")}
            </p>
            <p className="text-[11px] text-[var(--color-text-faint)] mt-2 mb-0 italic">
              🎲 A random {storeCorpusType === "random_words" ? "word sequence" : "passage"} will be dealt when the host starts the race.
            </p>
          </div>

          {preview && (
            <div className="host-choice mt-3 text-sm text-[var(--color-text-muted)]">
              <span className="font-semibold text-[var(--color-text-bright)]">Host preview:</span>{" "}
              <span className="preview italic">{preview}</span>
            </div>
          )}
          {passageText && <p className="passage-preview text-xs text-[var(--color-text-muted)] mt-2 italic">{passageText}</p>}
        </div>
      )}

      {/* Host Controls */}
      {isHost && (
        <div className="host-controls space-y-4">
          {/* Corpus Type Selector */}
          <div className="corpus-type-controls bg-[var(--color-bg-base)] p-3 rounded-lg border border-[var(--color-border-subtle)]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs uppercase font-bold text-[var(--color-text-muted)]">Corpus Type:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-colors ${
                    corpusType === "passage"
                      ? "bg-[var(--color-accent-clay)] text-white"
                      : "bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-bright)] border border-[var(--color-border-subtle)]"
                  }`}
                  onClick={() => handleCorpusTypeChange("passage")}
                >
                  📖 Passage
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-colors ${
                    corpusType === "random_words"
                      ? "bg-[var(--color-accent-clay)] text-white"
                      : "bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-bright)] border border-[var(--color-border-subtle)]"
                  }`}
                  onClick={() => handleCorpusTypeChange("random_words")}
                >
                  🔤 Random Words
                </button>
              </div>
            </div>

            {/* Category / Length Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border-subtle)]/50 pt-3">
              <span className="text-xs uppercase font-bold text-[var(--color-text-muted)]">Length:</span>
              <div className="flex gap-2">
                {(["short", "mid", "long"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`px-3 py-1 text-xs rounded-lg font-bold transition-colors capitalize ${
                      corpusCategory === cat
                        ? "bg-[var(--color-accent-clay)] text-white"
                        : "bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-bright)] border border-[var(--color-border-subtle)]"
                    }`}
                    onClick={() => handleCorpusCategoryChange(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Description */}
            <div className="mt-3 pt-2 border-t border-[var(--color-border-subtle)]/30 text-xs text-[var(--color-text-muted)]">
              {getCategoryDescription(corpusType, corpusCategory)}
              <span className="block text-[11px] text-[var(--color-text-faint)] mt-0.5">
                🎲 Automatically dealt at race start.
              </span>
            </div>
          </div>

          {/* Grace Picker */}
          <div className="flex items-center justify-between bg-[var(--color-bg-base)] p-3 rounded-lg border border-[var(--color-border-subtle)]">
            <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase">Countdown Grace:</span>
            <div className="flex gap-2">
              {[3, 5, 10].map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`px-3 py-1 text-xs rounded font-bold transition-colors ${
                    grace === g
                      ? "bg-[var(--color-accent-clay)] text-white"
                      : "bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]"
                  }`}
                  onClick={() => setGrace(g)}
                >
                  {g}s
                </button>
              ))}
            </div>
          </div>

          {/* Start Race Button */}
          <button
            type="button"
            className={`w-full py-3.5 rounded-lg text-base font-bold transition-all shadow-md ${
              guests.length === 0 || allGuestsReady
                ? "bg-[var(--color-accent-clay)] hover:bg-[var(--color-accent-hover)] text-white cursor-pointer"
                : "bg-[var(--color-bg-surface-hover)] hover:bg-[var(--color-border-subtle)] text-[var(--color-text-bright)] border border-[var(--color-border-subtle)] cursor-pointer"
            }`}
            onClick={handleStartRace}
          >
            {guests.length === 0 || allGuestsReady
              ? "Start Race"
              : "Force Start Race"}
          </button>
        </div>
      )}
    </div>
  );
}
