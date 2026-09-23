import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { LobbyView } from "../components/LobbyView";
import { THEME_PRESETS } from "../store/settings";
import { useRaceStore, resetRaceUi } from "../store/race";

afterEach(() => {
  cleanup();
  useRaceStore.setState({ graceSeconds: 5 });
});

describe("Step F — small follow-ups (D4, a11y)", () => {
  it("D4: the High Contrast preset's cursor is black", () => {
    const highContrast = THEME_PRESETS.find((p) => p.name === "High Contrast");
    expect(highContrast?.colors.colorCursor).toBe("#000000");
  });

  it("hides the decorative lobby empty-state line from assistive tech", () => {
    const { container } = render(
      <LobbyView roomCode="ABC123" isHost={true} players={[]} onStartRace={() => {}} />,
    );

    const decorative = Array.from(container.querySelectorAll("p")).find((p) =>
      p.textContent?.includes("⊹"),
    );

    expect(decorative).toBeDefined();
    expect(decorative?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("Step E — grace picker syncs with the store", () => {
  it("clicking a grace option writes it to the race store", () => {
    const { getByText } = render(
      <LobbyView roomCode="ABC123" isHost={true} players={[]} onStartRace={() => {}} />,
    );

    fireEvent.click(getByText("10s"));

    expect(useRaceStore.getState().graceSeconds).toBe(10);
  });

  it("initializes the picker's selection from the store's current grace", () => {
    useRaceStore.setState({ graceSeconds: 10 });

    const { getByText } = render(
      <LobbyView roomCode="ABC123" isHost={true} players={[]} onStartRace={() => {}} />,
    );

    expect(getByText("10s").getAttribute("aria-pressed")).toBe("true");
    expect(getByText("5s").getAttribute("aria-pressed")).toBe("false");
  });

  it("survives resetRaceUi(), because it is a room setting, not per-race UI", () => {
    useRaceStore.setState({ graceSeconds: 10 });

    resetRaceUi();

    expect(useRaceStore.getState().graceSeconds).toBe(10);
  });
});
