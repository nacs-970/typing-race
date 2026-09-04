/**
 * Clock-sync helpers — server-side.
 *
 * Pure: no side effects, no I/O. Returns the server's receive (t1)
 * and send (t2) timestamps. Caller (HTTP route or WS handler)
 * orchestrates the round-trip; client does the math.
 *
 * NTP algorithm (RFC 4330 §3 simplified):
 *   t0 = client send
 *   t1 = server receive   ← we return this
 *   t2 = server send      ← and this
 *   t3 = client receive
 *   offset = ((t1 - t0) + (t2 - t3)) / 2
 *   roundtrip = (t3 - t0) - (t2 - t1)
 */
export function recordSyncRequest(): { t1: number; t2: number } {
  const now = Date.now();
  return { t1: now, t2: now };
}
