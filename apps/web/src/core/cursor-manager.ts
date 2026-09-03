import type { PassageLayout } from "./layout";

export const BUFFER_MS = 100;
export const MAX_EXTRAPOLATE_MS = 150;

export const PASTEL_RAINBOW_COLORS = [
  "#DA2C38", // Slot 1: Red
  "#DF6873", // Slot 2: Coral / Rose
  "#EE7B30", // Slot 3: Orange
  "#FBD24B", // Slot 4: Amber
  "#F8F862", // Slot 5: Bright Yellow
  "#87C38F", // Slot 6: Pastel Green
  "#99FFFC", // Slot 7: Cyan
  "#BE98D7", // Slot 8: Lavender / Purple
] as const;

export interface CursorSnapshot {
  index: number;
  receivedAt: number;
}

export interface OpponentCursorDom {
  root: HTMLElement;
  tag: HTMLElement;
  caret: HTMLElement;
}

export class CursorManager {
  public static readonly MAX_DISTANCE_WORDS = 5;
  public static readonly MAX_AHEAD_WORDS = 5; // alias for backwards compatibility

  private buffers: Map<string, CursorSnapshot[]> = new Map();
  private playerColors: Map<string, string> = new Map();
  private playerNicknames: Map<string, string> = new Map();
  private localProgress: number = 0;
  private passageText: string = "";

  // DOM overlay properties
  private container: HTMLElement | null = null;
  private layout: PassageLayout | null = null;
  private elements: Map<string, OpponentCursorDom> = new Map();
  private leaderId: string | null = null;
  private rafId: number | null = null;

  public registerPlayer(playerId: string, nickname: string, colorOrSlot: string | number): void {
    if (!this.buffers.has(playerId)) {
      this.buffers.set(playerId, []);
    }
    this.playerNicknames.set(playerId, nickname);

    let color: string;
    if (typeof colorOrSlot === "number") {
      color = PASTEL_RAINBOW_COLORS[colorOrSlot % PASTEL_RAINBOW_COLORS.length] ?? "#87C38F";
    } else {
      color = colorOrSlot;
    }
    this.playerColors.set(playerId, color);

    if (this.container && !this.elements.has(playerId)) {
      this.createPlayerElement(playerId, nickname, color);
    } else {
      const existing = this.elements.get(playerId);
      if (existing) {
        existing.tag.textContent = nickname.slice(0, 16);
        existing.tag.style.backgroundColor = color;
        existing.caret.style.backgroundColor = color;
        existing.caret.style.boxShadow = `0 0 8px ${color}`;
      }
    }
  }

  public removePlayer(playerId: string): void {
    const dom = this.elements.get(playerId);
    if (dom) {
      dom.root.remove();
      this.elements.delete(playerId);
    }
    this.buffers.delete(playerId);
    this.playerColors.delete(playerId);
    this.playerNicknames.delete(playerId);
    if (this.leaderId === playerId) {
      this.leaderId = null;
    }
  }

  public onCursorUpdate(playerId: string, index: number, localTime?: number): void {
    const buf = this.buffers.get(playerId);
    if (!buf) return;

    const receivedAt = localTime ?? (typeof performance !== "undefined" ? performance.now() : Date.now());

    // Detect backspace / rewind
    const lastSnapshot = buf[buf.length - 1];
    if (lastSnapshot && index < lastSnapshot.index) {
      buf.length = 0;
    }

    buf.push({ index, receivedAt });
    if (buf.length > 10) {
      buf.shift();
    }
  }

  public calculateInterpolatedIndex(playerId: string, now: number): number {
    const buf = this.buffers.get(playerId);
    if (!buf || buf.length === 0) {
      return 0;
    }

    const first = buf[0];
    if (!first) {
      return 0;
    }

    if (buf.length === 1) {
      return first.index;
    }

    const targetTime = now - BUFFER_MS;
    const last = buf[buf.length - 1];
    if (!last) {
      return first.index;
    }

    if (targetTime <= first.receivedAt) {
      return first.index;
    }

    if (targetTime >= last.receivedAt) {
      const dt = targetTime - last.receivedAt;
      if (dt <= MAX_EXTRAPOLATE_MS && buf.length >= 2) {
        const prev = buf[buf.length - 2];
        if (prev) {
          const timeDelta = Math.max(1, last.receivedAt - prev.receivedAt);
          const rate = (last.index - prev.index) / timeDelta;
          return last.index + rate * dt;
        }
      }
      return last.index;
    }

    // Between snapshots: find s0 and s1
    for (let i = 0; i < buf.length - 1; i++) {
      const s0 = buf[i];
      const s1 = buf[i + 1];
      if (s0 && s1 && targetTime >= s0.receivedAt && targetTime <= s1.receivedAt) {
        const span = s1.receivedAt - s0.receivedAt;
        if (span <= 0) return s1.index;
        const alpha = (targetTime - s0.receivedAt) / span;
        return s0.index + alpha * (s1.index - s0.index);
      }
    }

    return last.index;
  }

  public mount(container: HTMLElement, layout: PassageLayout): void {
    this.container = container;
    this.layout = layout;

    // Create DOM elements for players already registered
    for (const [playerId, nickname] of this.playerNicknames.entries()) {
      if (!this.elements.has(playerId)) {
        const color = this.playerColors.get(playerId) ?? "#87C38F";
        this.createPlayerElement(playerId, nickname, color);
      }
    }

    this.startLoop();
  }

  public unmount(): void {
    if (this.rafId !== null && typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    for (const { root } of this.elements.values()) {
      root.remove();
    }
    this.elements.clear();
    this.container = null;
    this.layout = null;
  }

  public renderFrame(now: number): void {
    if (!this.layout || !this.container) return;

    let maxIndex = -1;
    let leaderPlayerId: string | null = null;

    // First pass: find leader
    for (const playerId of this.buffers.keys()) {
      const index = this.calculateInterpolatedIndex(playerId, now);
      if (index > maxIndex && index > 0) {
        maxIndex = index;
        leaderPlayerId = playerId;
      }
    }
    this.leaderId = leaderPlayerId;

    // Second pass: position cursors with translate3d
    for (const playerId of this.buffers.keys()) {
      let dom = this.elements.get(playerId);
      if (!dom) {
        const nickname = this.playerNicknames.get(playerId) ?? "Player";
        const color = this.playerColors.get(playerId) ?? "#87C38F";
        dom = this.createPlayerElement(playerId, nickname, color);
      }

      const renderIndex = this.calculateInterpolatedIndex(playerId, now);
      const { x, y } = this.layout.getCoordinates(renderIndex);

      // Hardware-accelerated 0 React commit DOM transform
      dom.root.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;

      // Leader glow effect
      if (playerId === this.leaderId) {
        dom.caret.classList.add("leader-glow");
      } else {
        dom.caret.classList.remove("leader-glow");
      }

      // Distance-based fading: slowly fade away as opponent distance (ahead or behind) approaches 5 words
      const wordDistance = this.calculateWordDistance(this.localProgress, renderIndex);
      let opacity = 1.0;
      if (wordDistance > 0) {
        opacity = Math.max(0, 1 - wordDistance / CursorManager.MAX_DISTANCE_WORDS);
      }
      dom.root.style.opacity = opacity.toFixed(2);
      dom.root.style.visibility = opacity <= 0 ? "hidden" : "visible";
    }
  }

  public calculateWordDistance(fromIndex: number, toIndex: number): number {
    const min = Math.min(fromIndex, toIndex);
    const max = Math.max(fromIndex, toIndex);
    if (min === max) return 0;

    if (!this.passageText || this.passageText.length === 0) {
      return (max - min) / 5;
    }

    const start = Math.max(0, Math.min(this.passageText.length, Math.floor(min)));
    const end = Math.max(0, Math.min(this.passageText.length, max));
    if (end <= start) return 0;

    let spaces = 0;
    let lastSpaceIndex = start;
    for (let i = start; i < Math.floor(end); i++) {
      if (this.passageText[i] === " ") {
        spaces++;
        lastSpaceIndex = i;
      }
    }

    // Measure fractional progress in the destination word
    let nextSpaceIndex = this.passageText.indexOf(" ", Math.floor(end));
    if (nextSpaceIndex === -1) nextSpaceIndex = this.passageText.length;
    const wordLength = Math.max(1, nextSpaceIndex - lastSpaceIndex);
    const fraction = (end - lastSpaceIndex) / wordLength;

    return spaces + Math.min(0.99, Math.max(0, fraction));
  }

  public calculateWordsAhead(localIndex: number, targetIndex: number): number {
    return this.calculateWordDistance(localIndex, targetIndex);
  }

  public setPassageText(text: string): void {
    this.passageText = text;
  }

  public getPassageText(): string {
    return this.passageText;
  }

  private startLoop(): void {
    if (typeof requestAnimationFrame === "undefined") return;

    const frame = (now: number) => {
      this.renderFrame(now);
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  private createPlayerElement(playerId: string, nickname: string, color: string): OpponentCursorDom {
    const root = document.createElement("div");
    root.className =
      "opponent-cursor-root pointer-events-none absolute top-0 left-0 will-change-transform transition-opacity duration-200 ease-out";
    root.style.zIndex = "10";
    root.dataset.player = playerId;

    const tag = document.createElement("div");
    tag.className =
      "cursor-micro-tag absolute bottom-full left-0 mb-1 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-md whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]";
    tag.textContent = nickname.slice(0, 16);
    tag.style.backgroundColor = color;
    tag.style.color = "#12190b";

    const caret = document.createElement("div");
    caret.className = "cursor-caret w-[2px] h-[22px] rounded-full transition-shadow duration-300";
    caret.style.marginTop = "5px";
    caret.style.backgroundColor = color;
    caret.style.boxShadow = `0 0 8px ${color}`;

    root.appendChild(tag);
    root.appendChild(caret);

    if (this.container) {
      this.container.appendChild(root);
    }

    const dom: OpponentCursorDom = { root, tag, caret };
    this.elements.set(playerId, dom);
    return dom;
  }

  public setLocalProgress(index: number): void {
    this.localProgress = index;
  }

  public getLocalProgress(): number {
    return this.localProgress;
  }

  public getPlayerBuffer(playerId: string): readonly CursorSnapshot[] | undefined {
    return this.buffers.get(playerId);
  }

  public getPlayerColor(playerId: string): string | undefined {
    return this.playerColors.get(playerId);
  }

  public getPlayerNickname(playerId: string): string | undefined {
    return this.playerNicknames.get(playerId);
  }

  public getLeaderId(): string | null {
    return this.leaderId;
  }

  public getElements(): ReadonlyMap<string, OpponentCursorDom> {
    return this.elements;
  }
}
