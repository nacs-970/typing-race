import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { LobbyView } from "../components/LobbyView";
import { THEME_PRESETS } from "../store/settings";

afterEach(() => {
  cleanup();
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
