import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup, act } from "@testing-library/react";
import { SoloView, FOCUS_MODE_ATTR, type SoloTextSource } from "../components/SoloView.tsx";
import { resetSoloPrefs, setSoloPrefs } from "../store/solo.ts";

/** Deterministic text: a queue of initial texts, and a fixed top-up. */
function makeSource(initials: string[], more = "zz zz zz"): SoloTextSource {
  let i = 0;
  return {
    initial: () => ({ text: initials[Math.min(i++, initials.length - 1)]! }),
    more: () => more,
  };
}

function typeText(chars: string) {
  for (const ch of chars) {
    act(() => {
      fireEvent.keyDown(window, { key: ch });
    });
  }
}

function visibleText(container: HTMLElement): string {
  return Array.from(container.querySelectorAll(".char"))
    .map((el) => el.textContent)
    .join("");
}

beforeEach(() => {
  resetSoloPrefs();
  // Same canvas stub as RaceView/layout tests: 10px per char, so pretext
  // produces deterministic line ranges.
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

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.documentElement.removeAttribute(FOCUS_MODE_ATTR);
});

describe("SoloView", () => {
  test("1. time mode counts down from the chosen duration, ends at 0 and shows WPM", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T10:00:00Z"));
    setSoloPrefs({ mode: "time", time: 15 });
    const { container, getByTestId, queryByTestId } = render(
      <SoloView textSource={makeSource(["the quick brown fox jumps over the lazy dog"])} />,
    );

    expect(getByTestId("solo-counter").textContent).toBe("15");

    typeText("the quick brown fox");
    // Focus mode starts with the first keystroke.
    expect(document.documentElement.hasAttribute(FOCUS_MODE_ATTR)).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(getByTestId("solo-counter").textContent).toBe("10");
    expect(queryByTestId("solo-results")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(10_100);
    });

    const results = getByTestId("solo-results");
    expect(results).toBeDefined();
    // 19 correct chars in exactly 15s: (19 / 5) / 0.25 min = 15.2 → 15.
    expect(getByTestId("solo-wpm").textContent).toBe("15");
    expect(results.textContent).toContain("time 15");
    expect(results.textContent).toContain("15s");
    expect(container.querySelector('[data-testid="solo-passage"]')).toBeNull();
    // Chrome comes back, and Next test is focused for Enter.
    expect(document.documentElement.hasAttribute(FOCUS_MODE_ATTR)).toBe(false);
    expect(document.activeElement?.textContent).toBe("Next test");

    // Keys after the end no longer reach the engine (no crash, results stay).
    typeText("abc");
    expect(getByTestId("solo-results")).toBeDefined();
  });

  test("2. words mode finishes on the last correct char and shows results", () => {
    setSoloPrefs({ mode: "words", words: 10 });
    const text = "one two three";
    const { getByTestId, queryByTestId } = render(<SoloView textSource={makeSource([text])} />);

    expect(getByTestId("solo-counter").textContent).toBe("0/3");
    typeText("one two ");
    expect(getByTestId("solo-counter").textContent).toBe("2/3");
    typeText("thre");
    expect(queryByTestId("solo-results")).toBeNull();
    typeText("e");

    const results = getByTestId("solo-results");
    expect(results.textContent).toContain("words 10");
    expect(results.textContent).toContain("100%");
    expect(getByTestId("solo-wpm").textContent).toMatch(/^\d+$/);
    // The always-mounted status region announces the result.
    expect(document.querySelector('[role="status"]')?.textContent).toContain("Test complete.");
  });

  test("2b. words mode: reaching the end with a wrong last char shows the finish-blocked note", () => {
    setSoloPrefs({ mode: "words", words: 10 });
    const { getByTestId, queryByTestId } = render(<SoloView textSource={makeSource(["ab"])} />);
    typeText("ax");
    expect(queryByTestId("solo-results")).toBeNull();
    expect(getByTestId("finish-blocked-banner").textContent).toContain("Finish blocked");
  });

  test("3. restart gives fresh text and resets the counter", () => {
    setSoloPrefs({ mode: "words", words: 10 });
    const { container, getByTestId } = render(
      <SoloView textSource={makeSource(["alpha beta", "gamma delta"])} />,
    );
    expect(visibleText(container)).toBe("alpha beta");
    typeText("alpha ");
    expect(getByTestId("solo-counter").textContent).toBe("1/2");
    expect(container.querySelectorAll(".char-correct").length).toBe(6);

    act(() => {
      fireEvent.click(getByTestId("solo-restart"));
    });

    expect(visibleText(container)).toBe("gamma delta");
    expect(getByTestId("solo-counter").textContent).toBe("0/2");
    expect(container.querySelectorAll(".char-correct").length).toBe(0);
    expect(document.documentElement.hasAttribute(FOCUS_MODE_ATTR)).toBe(false);
  });

  test("4. typing while a mode-bar button is focused does not advance the engine", () => {
    setSoloPrefs({ mode: "words", words: 10 });
    const { container, getByRole, getByTestId } = render(
      <SoloView textSource={makeSource(["alpha beta"])} />,
    );
    const wordsButton = getByRole("button", { name: "25 words" });
    act(() => {
      wordsButton.focus();
    });
    expect(document.activeElement).toBe(wordsButton);

    act(() => {
      fireEvent.keyDown(wordsButton, { key: "a" });
      fireEvent.keyDown(wordsButton, { key: " " });
    });

    expect(container.querySelectorAll(".char-correct").length).toBe(0);
    expect(container.querySelectorAll(".char-error").length).toBe(0);
    expect(getByTestId("solo-counter").textContent).toBe("0/2");
  });

  test("5. mode options use aria-pressed and toggles only show in time and words modes", () => {
    const { getByRole, queryByRole } = render(<SoloView textSource={makeSource(["a b"])} />);
    expect(getByRole("button", { name: "time" }).getAttribute("aria-pressed")).toBe("true");
    expect(getByRole("button", { name: "30 seconds" }).getAttribute("aria-pressed")).toBe("true");
    expect(getByRole("button", { name: "punctuation" }).getAttribute("aria-pressed")).toBe("false");

    act(() => {
      fireEvent.click(getByRole("button", { name: "passage" }));
    });
    expect(getByRole("button", { name: "passage" }).getAttribute("aria-pressed")).toBe("true");
    expect(queryByRole("button", { name: "punctuation" })).toBeNull();
    expect(getByRole("button", { name: "mid" }).getAttribute("aria-pressed")).toBe("true");
  });
});
