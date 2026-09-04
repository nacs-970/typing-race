/**
 * Per-IP rate limiter for room creation.
 * Default: maximum 10 room creations per 1 hour (3600_000 ms) window.
 */
export class IpRateLimiter {
  private windowMs: number;
  private maxCreations: number;
  private records = new Map<string, number[]>();

  constructor(maxCreations: number = 10, windowMs: number = 3600_000) {
    this.maxCreations = maxCreations;
    this.windowMs = windowMs;
  }

  checkAndConsume(ip: string, now: number = Date.now()): boolean {
    const timestamps = this.records.get(ip) ?? [];
    // prune expired
    const valid = timestamps.filter((t) => now - t < this.windowMs);
    if (valid.length >= this.maxCreations) {
      this.records.set(ip, valid);
      return false;
    }
    valid.push(now);
    this.records.set(ip, valid);
    return true;
  }

  check(ip: string, now: number = Date.now()): boolean {
    return this.checkAndConsume(ip, now);
  }

  reset(): void {
    this.records.clear();
  }
}

export const ipRateLimiter = new IpRateLimiter(10, 3600_000);
