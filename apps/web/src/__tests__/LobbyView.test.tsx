import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { LobbyView } from "../components/LobbyView";
import { useConnectionStore } from "../store/connection";
import { useRaceStore } from "../store/race";
import { filterPassages, PASSAGES } from "@typing-race/shared";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useConnectionStore.setState({ playerId: "host-1" });
  useRaceStore.setState({ lobbyPlayers: [] });
});

describe("LobbyView", () => {
  it("colors each player's number with their race cursor color", () => {
    const { container } = render(
      <LobbyView
        roomCode="ABCDEF"
        isHost={true}
        players={[
          { playerId: "host-1", nickname: "Host", isHost: true, progress: 0 },
          { playerId: "p2", nickname: "Mira", isHost: false, progress: 0 },
          { playerId: "p3", nickname: "Tomas", isHost: false, progress: 0 },
        ]}
        onStartRace={() => {}}
      />,
    );
    const chip = (id: string) =>
      container.querySelector<HTMLElement>(`[data-player-color="${id}"]`)?.style.backgroundColor;

    expect(chip("host-1")).toBe("var(--color-cursor-own)"); // you: your own caret color
    expect(chip("p2")).toBe("var(--color-cursor-slot-2)");
    expect(chip("p3")).toBe("var(--color-cursor-slot-3)");
  });

  it("copies just the room code when the code is clicked", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const { getByLabelText, getByText } = render(
      <LobbyView roomCode="K7QX2M" isHost={true} onStartRace={() => {}} />,
    );

    fireEvent.click(getByLabelText("Copy room code K7QX2M"));

    expect(writeText).toHaveBeenCalledWith("K7QX2M");
    expect(getByText("Code copied")).toBeDefined();
    expect(getByLabelText("Copy room code K7QX2M").className).toContain("color-mix");
  });

  it("renders empty state when solo in lobby", () => {
    const { getByText } = render(
      <LobbyView
        roomCode="ABCDEF"
        isHost={true}
        players={[{ playerId: "host-1", nickname: "Host", isHost: true, progress: 0 }]}
        onStartRace={() => {}}
      />,
    );

    expect(getByText("Waiting for Competitors")).toBeDefined();
    expect(getByText("Share the invite link or room code with friends to start racing.")).toBeDefined();
  });

  it("renders competitor list with ready and waiting indicators", () => {
    const players = [
      { playerId: "host-1", nickname: "Host", isHost: true, progress: 0 },
      { playerId: "guest-1", nickname: "Alice", isHost: false, progress: 0, isReady: true },
      { playerId: "guest-2", nickname: "Bob", isHost: false, progress: 0, isReady: false },
    ];

    const { getByText, getAllByText } = render(
      <LobbyView
        roomCode="ABCDEF"
        isHost={true}
        players={players}
        onStartRace={() => {}}
      />,
    );

    expect(getByText("Alice")).toBeDefined();
    expect(getByText("Bob")).toBeDefined();
    expect(getByText("Ready")).toBeDefined();
    expect(getAllByText("Waiting…").length).toBeGreaterThanOrEqual(1);
  });

  it("allows guest to toggle ready state", () => {
    useConnectionStore.setState({ playerId: "guest-1" });
    const onToggleReady = vi.fn();

    const players = [
      { playerId: "host-1", nickname: "Host", isHost: true, progress: 0 },
      { playerId: "guest-1", nickname: "Alice", isHost: false, progress: 0, isReady: false },
    ];

    const { getByText, rerender } = render(
      <LobbyView
        roomCode="ABCDEF"
        isHost={false}
        players={players}
        onStartRace={() => {}}
        onToggleReady={onToggleReady}
      />,
    );

    const readyBtn = getByText("Ready Up");
    fireEvent.click(readyBtn);
    expect(onToggleReady).toHaveBeenCalledWith(true);

    // Now re-render with isReady: true
    players[1]!.isReady = true;
    rerender(
      <LobbyView
        roomCode="ABCDEF"
        isHost={false}
        players={players}
        onStartRace={() => {}}
        onToggleReady={onToggleReady}
      />,
    );

    const cancelBtn = getByText("Cancel Ready");
    fireEvent.click(cancelBtn);
    expect(onToggleReady).toHaveBeenCalledWith(false);
  });

  it("displays Force Start Race when guests are not ready and Start Race when all ready", () => {
    const onStartRace = vi.fn();
    const players = [
      { playerId: "host-1", nickname: "Host", isHost: true, progress: 0 },
      { playerId: "guest-1", nickname: "Alice", isHost: false, progress: 0, isReady: false },
    ];

    const { getByText, rerender } = render(
      <LobbyView
        roomCode="ABCDEF"
        isHost={true}
        players={players}
        onStartRace={onStartRace}
      />,
    );

    const forceBtn = getByText("Force Start Race");
    expect(forceBtn).toBeDefined();

    fireEvent.click(forceBtn);
    expect(onStartRace).not.toHaveBeenCalled();
    expect(getByText("Start anyway?")).toBeDefined();

    fireEvent.click(getByText("Start anyway?"));
    expect(onStartRace).toHaveBeenCalled();

    // Now make Alice ready
    players[1]!.isReady = true;
    rerender(
      <LobbyView
        roomCode="ABCDEF"
        isHost={true}
        players={players}
        onStartRace={onStartRace}
      />,
    );

    expect(getByText("Start Race")).toBeDefined();
  });

  it("filters passages correctly by length and punctuation", () => {
    const shortPassages = filterPassages(PASSAGES, { length: "short" });
    expect(shortPassages.length).toBeGreaterThan(0);
    expect(shortPassages.every((p) => p.text.trim().length <= 240)).toBe(true);

    const mediumPassages = filterPassages(PASSAGES, { length: "medium" });
    expect(mediumPassages.length).toBeGreaterThan(0);
    expect(
      mediumPassages.every((p) => {
        const len = p.text.trim().length;
        return len > 240 && len < 281;
      }),
    ).toBe(true);

    const longPassages = filterPassages(PASSAGES, { length: "long" });
    expect(longPassages.length).toBeGreaterThan(0);
    expect(longPassages.every((p) => p.text.trim().length >= 281)).toBe(true);

    const puncPassages = filterPassages(PASSAGES, { punctuation: true });
    expect(puncPassages.length).toBeGreaterThan(0);
    expect(puncPassages.every((p) => /[.,'"!?;:-]/.test(p.text))).toBe(true);
  });

  it("renders Leave Room button and triggers onLeaveRoom when clicked", () => {
    const onLeaveRoom = vi.fn();
    const { getByText } = render(
      <LobbyView
        roomCode="ABCDEF"
        isHost={false}
        players={[{ playerId: "p1", nickname: "Racer", isHost: false, progress: 0 }]}
        onStartRace={() => {}}
        onLeaveRoom={onLeaveRoom}
      />,
    );

    const leaveBtn = getByText("leave");
    expect(leaveBtn).toBeDefined();
    fireEvent.click(leaveBtn);
    expect(onLeaveRoom).not.toHaveBeenCalled();
    expect(getByText("Sure? leave")).toBeDefined();

    fireEvent.click(getByText("Sure? leave"));
    expect(onLeaveRoom).toHaveBeenCalledTimes(1);
  });

  it("allows host to switch corpus type and category", () => {
    const onStartRace = vi.fn();
    const { getByText } = render(
      <LobbyView
        roomCode="ABCDEF"
        isHost={true}
        players={[{ playerId: "p1", nickname: "HostRacer", isHost: true, progress: 0 }]}
        onStartRace={onStartRace}
      />,
    );

    expect(getByText("Passage")).toBeDefined();
    expect(getByText("Random words")).toBeDefined();

    // Switch to Random Words
    fireEvent.click(getByText("Random words"));
    // Switch to Short
    fireEvent.click(getByText("short"));

    // Start race
    fireEvent.click(getByText("Start Race"));
    expect(onStartRace).toHaveBeenCalledWith(undefined, 5, "random_words", "short");
  });

  it("displays selected corpus config for guest", () => {
    useRaceStore.setState({
      corpusType: "random_words",
      corpusCategory: "long",
    });

    const { getByText } = render(
      <LobbyView
        roomCode="ABCDEF"
        isHost={false}
        players={[{ playerId: "p2", nickname: "GuestRacer", isHost: false, progress: 0 }]}
        onStartRace={() => {}}
      />,
    );

    expect(getByText(/Random Words • long/i)).toBeDefined();
    expect(getByText("~70–90 random common words — endurance test.")).toBeDefined();
  });
});
