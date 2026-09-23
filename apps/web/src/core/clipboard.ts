/**
 * Copies `text` and reports whether it worked.
 *
 * `navigator.clipboard` exists only in a secure context (HTTPS or
 * localhost). Opening the dev server from a phone over the LAN
 * (`http://192.168.x.x`) is not one, so there we fall back to selecting a
 * temporary textarea and running `document.execCommand("copy")`. When the
 * Clipboard API is missing, the fallback runs synchronously inside the
 * click, which iOS Safari needs to allow the copy.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or unsupported: try the fallback below.
    }
  }
  return copyWithTextarea(text);
}

function copyWithTextarea(text: string): boolean {
  if (typeof document === "undefined" || typeof document.execCommand !== "function") {
    return false;
  }
  const previousFocus = document.activeElement as HTMLElement | null;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  // 16px stops iOS Safari from zooming when the textarea takes focus.
  textarea.style.cssText =
    "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;";
  document.body.appendChild(textarea);
  let ok = false;
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  } finally {
    document.body.removeChild(textarea);
    previousFocus?.focus?.();
  }
  return ok;
}
