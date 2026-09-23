import { describe, it, expect, vi, afterEach } from "vitest";
import { copyText } from "../core/clipboard";

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { value, configurable: true });
}

function setExecCommand(fn: ((cmd: string) => boolean) | undefined) {
  Object.defineProperty(document, "execCommand", { value: fn, configurable: true, writable: true });
}

afterEach(() => {
  setClipboard(undefined);
  setExecCommand(undefined);
});

describe("copyText", () => {
  it("uses the Clipboard API when it is available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    const execCommand = vi.fn(() => true);
    setExecCommand(execCommand);

    await expect(copyText("K7QX2M")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("K7QX2M");
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("falls back to execCommand when the Clipboard API is missing (plain http)", async () => {
    setClipboard(undefined);
    let copied = "";
    setExecCommand((cmd) => {
      const el = document.activeElement as HTMLTextAreaElement | null;
      copied = el?.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0) ?? "";
      return cmd === "copy";
    });

    await expect(copyText("K7QX2M")).resolves.toBe(true);
    expect(copied).toBe("K7QX2M");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("falls back to execCommand when the Clipboard API rejects", async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("NotAllowedError")) });
    const execCommand = vi.fn(() => true);
    setExecCommand(execCommand);

    await expect(copyText("K7QX2M")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("reports failure when neither way can copy", async () => {
    setClipboard(undefined);
    setExecCommand(() => false);

    await expect(copyText("K7QX2M")).resolves.toBe(false);
    expect(document.querySelector("textarea")).toBeNull();
  });
});
