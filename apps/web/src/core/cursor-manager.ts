export const BUFFER_MS = 100;
export const MAX_EXTRAPOLATE_MS = 150;

export interface CursorSnapshot {
  index: number;
  receivedAt: number;
}

export class CursorManager {
  private buffers: Map<string, CursorSnapshot[]> = new Map();
  private playerColors: Map<string, string> = new Map();
  private playerNicknames: Map<string, string> = new Map();
  private localProgress: number = 0;

  public registerPlayer(playerId: string, nickname: string, color: string): void {
    if (!this.buffers.has(playerId)) {
      this.buffers.set(playerId, []);
    }
    this.playerNicknames.set(playerId, nickname);
    this.playerColors.set(playerId, color);
  }

  public removePlayer(playerId: string): void {
    this.buffers.delete(playerId);
    this.playerColors.delete(playerId);
    this.playerNicknames.delete(playerId);
  }

  public onCursorUpdate(playerId: string, index: number, localTime?: number): void {
    const buf = this.buffers.get(playerId);
    if (!buf) return;

    const receivedAt = localTime ?? (typeof performance !== "undefined" ? performance.now() : Date.now());

    // Detect backspace / rewind
    if (buf.length > 0 && index < buf[buf.length - 1].index) {
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

    if (buf.length === 1) {
      return buf[0].index;
    }

    const targetTime = now - BUFFER_MS;
    const first = buf[0];
    const last = buf[buf.length - 1];

    if (targetTime <= first.receivedAt) {
      return first.index;
    }

    if (targetTime >= last.receivedAt) {
      const dt = targetTime - last.receivedAt;
      if (dt <= MAX_EXTRAPOLATE_MS && buf.length >= 2) {
        const prev = buf[buf.length - 2];
        const timeDelta = Math.max(1, last.receivedAt - prev.receivedAt);
        const rate = (last.index - prev.index) / timeDelta;
        return last.index + rate * dt;
      }
      return last.index;
    }

    // Between snapshots: find s0 and s1
    for (let i = 0; i < buf.length - 1; i++) {
      const s0 = buf[i];
      const s1 = buf[i + 1];
      if (targetTime >= s0.receivedAt && targetTime <= s1.receivedAt) {
        const span = s1.receivedAt - s0.receivedAt;
        if (span <= 0) return s1.index;
        const alpha = (targetTime - s0.receivedAt) / span;
        return s0.index + alpha * (s1.index - s0.index);
      }
    }

    return last.index;
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
}
