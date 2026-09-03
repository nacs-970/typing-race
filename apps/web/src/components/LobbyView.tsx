import React, { useState, useMemo } from "react";
import {
  PASSAGES,
  type Passage,
  filterPassages,
  type PassageLengthFilter,
} from "@typing-race/shared";
import { useRaceStore, type LobbyPlayer } from "../store/race.ts";
import { useConnectionStore } from "../store/connection.ts";
import { ws } from "../net/ws.ts";

export interface LobbyViewProps {
  roomCode: string;
  isHost: boolean;
  players?: LobbyPlayer[];
  onStartRace: (passageId: string, graceSeconds: number) => void;
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

  // Filters state
  const [lengthFilter, setLengthFilter] = useState<PassageLengthFilter>("all");
  const [punctuationFilter, setPunctuationFilter] = useState<boolean | null>(null);

  const filteredPassages = useMemo(() => {
    return filterPassages(PASSAGES, {
      length: lengthFilter,
      punctuation: punctuationFilter,
    });
  }, [lengthFilter, punctuationFilter]);

  const [pickedId, setPickedId] = useState<string>(
    filteredPassages[0]?.id ?? PASSAGES[0]?.id ?? "",
  );
  const [grace, setGrace] = useState<number>(5);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  const me = players.find((p) => p.playerId === myPlayerId);
  const guests = players.filter((p) => !p.isHost);
  const allGuestsReady = guests.length > 0 && guests.every((g) => g.isReady);

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
    const targetPassageId = pickedId || filteredPassages[0]?.id || PASSAGES[0]?.id || "";
    if (guests.length > 0 && !allGuestsReady) {
      const confirmed =
        typeof window !== "undefined" && window.confirm
          ? window.confirm("Force Start Race: Not all players are ready. Start the race anyway?")
          : true;
      if (!confirmed) return;
    }
    onStartRace(targetPassageId, grace);
  };

  return (
    <div className="lobby-view max-w-[800px] mx-auto p-6 rounded-xl border border-[#3c4626] bg-[#15180c] text-[#fefbe6] font-mono">
      <div className="flex items-center justify-between border-b border-[#3c4626] pb-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold m-0">Room {roomCode} {isHost ? "(Host)" : ""}</h2>
          <p className="text-sm text-[#b5c48b] mt-1 mb-0">
            {isHost ? "Configure passage and start when racers are ready" : "Waiting for host to start the race…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Copy room invite link"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#12190b] border border-[#3c4626] hover:bg-[#3c4626] transition-colors text-[#fefbe6] cursor-pointer"
            onClick={handleCopyLink}
          >
            {copySuccess ? "✓ Copied Link" : "📋 Copy Room Link"}
          </button>
          {onLeaveRoom && (
            <button
              type="button"
              aria-label="Leave room"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2a1315] border border-[#7f1d1d] hover:bg-[#7f1d1d] transition-colors text-[#fca5a5] cursor-pointer"
              onClick={onLeaveRoom}
            >
              🚪 Leave Room
            </button>
          )}
        </div>
      </div>

      {/* Empty State when solo in room */}
      {players.length <= 1 && (
        <div className="lobby-empty-state text-center p-6 my-4 border border-dashed border-[#3c4626] rounded-lg bg-[#12190b]/50">
          <h3 className="text-lg font-bold text-[#fefbe6] mb-1">Waiting for Competitors</h3>
          <p className="text-sm text-[#b5c48b] mb-4">
            Share the invite link or room code with friends to start racing.
          </p>
          <button
            type="button"
            aria-label="Copy room invite link"
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#cc6722] text-[#12190b] hover:opacity-90 transition-opacity"
            onClick={handleCopyLink}
          >
            {copySuccess ? "✓ Copied Invite Link" : "Copy Room Link"}
          </button>
        </div>
      )}

      {/* Competitors List */}
      <div className="players-list mb-6">
        <h4 className="text-xs uppercase tracking-wider text-[#b5c48b] font-bold mb-2">
          Competitors ({players.length})
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {players.map((p) => {
            const isMe = p.playerId === myPlayerId;
            return (
              <div
                key={p.playerId}
                className={`flex items-center justify-between p-2.5 rounded-lg border ${
                  isMe ? "border-[#cc6722]/50 bg-[#12190b]" : "border-[#3c4626] bg-[#12190b]/40"
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="font-medium text-sm truncate">{p.nickname}</span>
                  {p.isHost && (
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#3c4626] text-[#b5c48b]">
                      Host
                    </span>
                  )}
                  {isMe && <span className="text-[10px] text-[#cc6722] font-semibold">(You)</span>}
                </div>
                <div>
                  {p.isReady ? (
                    <span className="text-xs font-bold text-[#87c38f] bg-[#87c38f]/10 px-2 py-0.5 rounded">
                      ✓ Ready
                    </span>
                  ) : (
                    <span className="text-xs text-[#7d4d0f] bg-[#7d4d0f]/10 px-2 py-0.5 rounded">
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
                ? "bg-[#7e2a19] hover:bg-[#9d3117] text-[#fefbe6]"
                : "bg-[#7e914a] hover:bg-[#9bad67] text-[#12190b]"
            }`}
            onClick={handleToggleReady}
          >
            {me?.isReady ? "Cancel Ready" : "Ready Up"}
          </button>
          {preview && (
            <div className="host-choice mt-4 text-sm text-[#b5c48b]">
              <span className="font-semibold text-[#fefbe6]">Host chose:</span>{" "}
              <span className="preview italic">{preview}</span>
            </div>
          )}
          {passageText && <p className="passage-preview text-xs text-[#b5c48b] mt-2 italic">{passageText}</p>}
        </div>
      )}

      {/* Host Controls */}
      {isHost && (
        <div className="host-controls space-y-4">
          {/* Passage Filter Controls */}
          <div className="filter-controls bg-[#12190b] p-3 rounded-lg border border-[#3c4626]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs uppercase font-bold text-[#b5c48b]">Passage Length:</span>
              <div className="flex gap-1.5">
                {(["all", "short", "medium", "long"] as const).map((len) => (
                  <button
                    key={len}
                    type="button"
                    className={`px-2.5 py-1 text-xs rounded font-medium transition-colors capitalize ${
                      lengthFilter === len
                        ? "bg-[#cc6722] text-[#12190b] font-bold"
                        : "bg-[#15180c] text-[#b5c48b] hover:text-[#fefbe6] border border-[#3c4626]"
                    }`}
                    onClick={() => {
                      setLengthFilter(len);
                      const next = filterPassages(PASSAGES, {
                        length: len,
                        punctuation: punctuationFilter,
                      });
                      if (next[0]) setPickedId(next[0].id);
                    }}
                  >
                    {len}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#3c4626]/50 pt-2">
              <span className="text-xs uppercase font-bold text-[#b5c48b]">Punctuation:</span>
              <button
                type="button"
                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                  punctuationFilter === true
                    ? "bg-[#cc6722] text-[#12190b] font-bold"
                    : "bg-[#15180c] text-[#b5c48b] border border-[#3c4626]"
                }`}
                onClick={() => {
                  const nextPunc = punctuationFilter === true ? null : true;
                  setPunctuationFilter(nextPunc);
                  const next = filterPassages(PASSAGES, {
                    length: lengthFilter,
                    punctuation: nextPunc,
                  });
                  if (next[0]) setPickedId(next[0].id);
                }}
              >
                {punctuationFilter === true ? "✓ Complex Punctuation" : "Any Punctuation"}
              </button>
            </div>
          </div>

          {/* Passage Dropdown & Random */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#b5c48b] uppercase">
                Choose Passage ({filteredPassages.length} available)
              </label>
              <button
                type="button"
                className="text-xs text-[#cc6722] hover:underline font-semibold"
                onClick={() => {
                  if (filteredPassages.length > 0) {
                    const idx = Math.floor(Math.random() * filteredPassages.length);
                    const p = filteredPassages[idx];
                    if (p) setPickedId(p.id);
                  }
                }}
              >
                🎲 Pick Random
              </button>
            </div>
            <select
              className="passage-select w-full bg-[#12190b] border border-[#3c4626] rounded-lg p-2 text-sm text-[#fefbe6]"
              value={pickedId}
              onChange={(e) => setPickedId(e.target.value)}
              size={5}
            >
              {filteredPassages.map((p) => (
                <option key={p.id} value={p.id} className="py-1">
                  {p.text.slice(0, 60)}… ({p.source})
                </option>
              ))}
            </select>
          </div>

          {/* Grace Picker */}
          <div className="flex items-center justify-between bg-[#12190b] p-3 rounded-lg border border-[#3c4626]">
            <span className="text-xs font-bold text-[#b5c48b] uppercase">Grace Period:</span>
            <div className="flex gap-2">
              {[3, 5, 10].map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`px-3 py-1 text-xs rounded font-bold transition-colors ${
                    grace === g
                      ? "bg-[#cc6722] text-[#12190b]"
                      : "bg-[#15180c] text-[#b5c48b] border border-[#3c4626]"
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
                ? "bg-[#cc6722] hover:bg-[#d3813e] text-[#12190b]"
                : "bg-[#3c4626] hover:bg-[#4a572c] text-[#fefbe6]"
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