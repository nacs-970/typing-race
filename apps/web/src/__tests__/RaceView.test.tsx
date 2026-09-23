import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, fireEvent, cleanup, act } from "@testing-library/react";
import { afterEach } from "vitest";
import { RaceView } from "../components/RaceView.tsx";
import { ResultsBoard } from "../components/ResultsBoard.tsx";
import { useRaceStore, resetRaceUi } from "../store/race.ts";
import { useCursorStore } from "../store/cursor.ts";
import { TypingEngine } from "../core/typing-engine.ts";
import { CursorManager } from "../core/cursor-manager.ts";
import { PassageLayout } from "../core/layout.ts";
import { setSettings, DEFAULT_SETTINGS } from "../store/settings.ts";
import type { PlayerFinalStats } from "@typing-race/shared";

const PASSAGE = "the quick brown fox jumps over the lazy dog"; // 43 chars

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  resetRaceUi();
  const mockCtx = {
    font: "",
    measureText: (text: string) => ({
      width: text.length * 10,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2,
    }),
  };
  if (typeof OffscreenCanvas !== "undefined") {
    OffscreenCanvas.prototype.getContext = () => mockCtx as any;
  }
  HTMLCanvasElement.prototype.getContext = () => mockCtx as any;
});

describe("RaceView — char-state accents & zero-commit overlay", () => {
  test("1. char with no state in ownCharStates renders as data-state=pending", () => {
    const { container } = render(
      <RaceView passageText="hi" playerId="me" onKeystroke={() => {}} onCorrection={() => {}} />,
    );
    const spans = container.querySelectorAll(".char");
    expect(spans.length).toBe(2);
    expect(spans[0]?.classList.contains("char-pending")).toBe(true);
    expect(spans[0]?.getAttribute("data-state")).toBe("pending");
    expect(spans[1]?.classList.contains("char-pending")).toBe(true);
    expect(spans[1]?.getAttribute("data-state")).toBe("pending");
  });

  test("2. char at index 0 with state correct renders data-state=correct", () => {
    useRaceStore.setState({ ownCharStates: ["correct", "pending"] });
    const { container } = render(
      <RaceView passageText="hi" playerId="me" onKeystroke={() => {}} onCorrection={() => {}} />,
    );
    const spans = container.querySelectorAll(".char");
    expect(spans[0]?.classList.contains("char-correct")).toBe(true);
    expect(spans[0]?.getAttribute("data-state")).toBe("correct");
    expect(spans[1]?.classList.contains("char-pending")).toBe(true);
  });

  test("3. char at index 1 with state error renders data-state=error", () => {
    useRaceStore.setState({ ownCharStates: ["pending", "error"] });
    const { container } = render(
      <RaceView passageText="hi" playerId="me" onKeystroke={() => {}} onCorrection={() => {}} />,
    );
    const spans = container.querySelectorAll(".char");
    expect(spans[0]?.classList.contains("char-pending")).toBe(true);
    expect(spans[1]?.classList.contains("char-error")).toBe(true);
    expect(spans[1]?.getAttribute("data-state")).toBe("error");
  });

  test("4. passage text splits correctly per char (43-char passage → 43 spans)", () => {
    const { container } = render(
      <RaceView
        passageText={PASSAGE}
        playerId="me"
        onKeystroke={() => {}} onCorrection={() => {}}
      />,
    );
    const spans = container.querySelectorAll(".char");
    expect(spans.length).toBe(PASSAGE.length);
  });

  test("5. mounts isolated cursor overlay without inline opponent cursor children", () => {
    const { container, getByTestId } = render(
      <RaceView
        passageText={PASSAGE}
        playerId="me"
      />,
    );
    const overlay = container.querySelector('[data-testid="cursor-overlay"]');
    expect(overlay).not.toBeNull();
    expect(overlay?.classList.contains("cursor-overlay")).toBe(true);
    // React render tree does NOT render opponent cursor elements directly inside char spans
    expect(container.querySelectorAll(".opponent-cursor").length).toBe(0);
  });

  test("6. typing keys trigger TypingEngine keystrokes", () => {
    const onKeystroke = vi.fn();
    render(
      <RaceView
        passageText={PASSAGE}
        playerId="me"
        onKeystroke={onKeystroke}
      />,
    );

    fireEvent.keyDown(window, { key: "t" });
    expect(onKeystroke).toHaveBeenCalledWith(0, "t");
  });

  test("6. changing font size mid-race keeps typed progress", () => {
    const engine = new TypingEngine();
    render(
      <RaceView
        passageText="hi"
        playerId="me"
        typingEngine={engine}
        onKeystroke={() => {}}
        onCorrection={() => {}}
      />,
    );
    act(() => {
      fireEvent.keyDown(window, { key: "h" });
    });
    expect(engine.getOwnIndex()).toBe(1);
    expect(engine.getCharStates()[0]).toBe("correct");

    act(() => {
      setSettings({ fontSize: 20 });
    });
    expect(engine.getOwnIndex()).toBe(1);
    expect(engine.getCharStates()[0]).toBe("correct");

    act(() => {
      setSettings({ fontSize: DEFAULT_SETTINGS.fontSize });
    });
  });

  test("7. opponent caret colors follow lobby join order and don't change with cursor order", () => {
    useRaceStore.setState({
      lobbyPlayers: [
        { playerId: "me", nickname: "Me", isHost: true, isReady: true },
        { playerId: "a", nickname: "A", isHost: false, isReady: true },
        { playerId: "b", nickname: "B", isHost: false, isReady: true },
      ] as never,
    });
    const manager = new CursorManager();
    render(
      <RaceView
        passageText="hello world"
        playerId="me"
        cursorManager={manager}
        onKeystroke={() => {}}
        onCorrection={() => {}}
      />,
    );
    expect(manager.getPlayerColor("a")).toBe("var(--color-cursor-slot-2)");
    expect(manager.getPlayerColor("b")).toBe("var(--color-cursor-slot-3)");

    // Cursor frames arriving in a different order must not reshuffle colors.
    act(() => {
      useCursorStore.setState({
        cursors: new Map([
          ["b", { playerId: "b", index: 3, serverTs: 1 }],
          ["a", { playerId: "a", index: 1, serverTs: 1 }],
        ]),
      });
    });
    expect(manager.getPlayerColor("a")).toBe("var(--color-cursor-slot-2)");
    expect(manager.getPlayerColor("b")).toBe("var(--color-cursor-slot-3)");

    act(() => {
      useCursorStore.setState({ cursors: new Map() });
      useRaceStore.setState({ lobbyPlayers: [] });
    });
  });

  test("8. tapping the passage track focuses the hidden mobile input", () => {
    const { container, getByTestId } = render(
      <RaceView passageText={PASSAGE} playerId="me" onKeystroke={() => {}} onCorrection={() => {}} />,
    );
    const track = container.querySelector(".passage-track") as HTMLElement;
    const input = getByTestId("mobile-input") as HTMLInputElement;
    expect(document.activeElement).not.toBe(input);
    fireEvent.click(track);
    expect(document.activeElement).toBe(input);
  });

  test("9. an input event with one new character advances the engine by one", () => {
    const engine = new TypingEngine();
    const { getByTestId } = render(
      <RaceView
        passageText={PASSAGE}
        playerId="me"
        typingEngine={engine}
        onKeystroke={() => {}}
        onCorrection={() => {}}
      />,
    );
    const input = getByTestId("mobile-input") as HTMLInputElement;
    act(() => {
      fireEvent.input(input, { target: { value: input.value + "t" } });
    });
    expect(engine.getOwnIndex()).toBe(1);
    expect(engine.getCharStates()[0]).toBe("correct");
  });

  test("10. a shorter input value deletes through the engine", () => {
    const engine = new TypingEngine();
    const { getByTestId } = render(
      <RaceView
        passageText={PASSAGE}
        playerId="me"
        typingEngine={engine}
        onKeystroke={() => {}}
        onCorrection={() => {}}
      />,
    );
    const input = getByTestId("mobile-input") as HTMLInputElement;
    act(() => {
      fireEvent.input(input, { target: { value: input.value + "t" } });
    });
    expect(engine.getOwnIndex()).toBe(1);
    act(() => {
      fireEvent.input(input, { target: { value: "" } });
    });
    expect(engine.getOwnIndex()).toBe(0);
  });

  test("11. inserting several characters at once (autocomplete, paste, swipe) is rejected", () => {
    const engine = new TypingEngine();
    const { getByTestId } = render(
      <RaceView
        passageText={PASSAGE}
        playerId="me"
        typingEngine={engine}
        onKeystroke={() => {}}
        onCorrection={() => {}}
      />,
    );
    const input = getByTestId("mobile-input") as HTMLInputElement;
    act(() => {
      fireEvent.input(input, { target: { value: input.value + "hello" } });
    });
    expect(engine.getOwnIndex()).toBe(0);
  });

  test("12. a keydown followed by its own resulting input event is not double-counted", () => {
    const engine = new TypingEngine();
    const { getByTestId } = render(
      <RaceView
        passageText={PASSAGE}
        playerId="me"
        typingEngine={engine}
        onKeystroke={() => {}}
        onCorrection={() => {}}
      />,
    );
    const input = getByTestId("mobile-input") as HTMLInputElement;
    act(() => {
      fireEvent.keyDown(input, { key: "t" });
      fireEvent.input(input, { target: { value: input.value + "t" } });
    });
    expect(engine.getOwnIndex()).toBe(1);
  });

  test("13. a held-down key on the mobile input does not bypass the repeat guard", () => {
    const engine = new TypingEngine();
    const { getByTestId } = render(
      <RaceView
        passageText={PASSAGE}
        playerId="me"
        typingEngine={engine}
        onKeystroke={() => {}}
        onCorrection={() => {}}
      />,
    );
    const input = getByTestId("mobile-input") as HTMLInputElement;
    act(() => {
      fireEvent.keyDown(input, { key: "t", repeat: true });
      fireEvent.input(input, { target: { value: input.value + "t" } });
    });
    expect(engine.getOwnIndex()).toBe(0);
  });

  test("14. Android's Unidentified keydown does not block the following input event", () => {
    const engine = new TypingEngine();
    const { getByTestId } = render(
      <RaceView
        passageText={PASSAGE}
        playerId="me"
        typingEngine={engine}
        onKeystroke={() => {}}
        onCorrection={() => {}}
      />,
    );
    const input = getByTestId("mobile-input") as HTMLInputElement;
    act(() => {
      fireEvent.keyDown(input, { key: "Unidentified" });
      fireEvent.input(input, { target: { value: input.value + "t" } });
    });
    expect(engine.getOwnIndex()).toBe(1);
  });

  test("15. on a touch device the tap hint stays mounted but hides while the mobile input is focused", () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (q: string) => ({ matches: true, media: q }) as unknown as MediaQueryList,
    });
    try {
      const { getByTestId } = render(
        <RaceView passageText={PASSAGE} playerId="me" onKeystroke={() => {}} onCorrection={() => {}} />,
      );
      const hint = getByTestId("mobile-hint");
      const input = getByTestId("mobile-input") as HTMLInputElement;
      expect(hint.textContent).toBe("Tap the passage to type");
      expect(hint.classList.contains("invisible")).toBe(false);

      act(() => {
        input.focus();
      });
      expect(hint.classList.contains("invisible")).toBe(true);
    } finally {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    }
  });
});

describe("ResultsBoard — ranking", () => {
  test("7. renders ranked list — wpm * accuracy score desc (finish bonus equal, ignores finish time)", () => {
    // Score = wpm * accuracy (all finished, so the finish bonus is a wash):
    // a: 50 * 0.9 = 45, b: 60 * 0.95 = 57, c: 40 * 0.85 = 34 -> b, a, c.
    // Note finishTimeMs (30000/20000/25000) deliberately does NOT match this
    // order, proving ranking no longer sorts by finish time.
    const results: PlayerFinalStats[] = [
      { playerId: "a", finishTimeMs: 30000, wpm: 50, accuracy: 0.9 },
      { playerId: "b", finishTimeMs: 20000, wpm: 60, accuracy: 0.95 },
      { playerId: "c", finishTimeMs: 25000, wpm: 40, accuracy: 0.85 },
    ];
    const { container } = render(
      <ResultsBoard
        results={results}
        isHost={false}
        onRematch={() => {}}
      />,
    );
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(3);
    expect(rows[0]?.textContent).toContain("b");
    expect(rows[1]?.textContent).toContain("a");
    expect(rows[2]?.textContent).toContain("c");
  });

  test("8. a player who did not finish always ranks below one who did, regardless of score", () => {
    const results: PlayerFinalStats[] = [
      // DNF: high wpm/accuracy (partial progress at grace-timeout) but never finished.
      { playerId: "dnf-fast", finishTimeMs: 30000, wpm: 90, accuracy: 0.99 },
      // Finisher: much lower wpm/accuracy, but actually completed the passage.
      { playerId: "finisher-slow", finishTimeMs: 28000, wpm: 20, accuracy: 0.7 },
    ];
    const { container } = render(
      <ResultsBoard
        results={results}
        finishedPlayerIds={["finisher-slow"]}
        isHost={false}
        onRematch={() => {}}
      />,
    );
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(2);
    expect(rows[0]?.getAttribute("data-player-id")).toBe("finisher-slow");
    expect(rows[1]?.getAttribute("data-player-id")).toBe("dnf-fast");
  });
});