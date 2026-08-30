/**
 * NTP-style clock sync over HTTP.
 *
 *   t0 = client send time
 *   t1 = server receive time  (from response)
 *   t2 = server send time     (from response)
 *   t3 = client receive time
 *   offsetMs    = ((t1 - t0) + (t2 - t3)) / 2
 *   roundtripMs = (t3 - t0) - (t2 - t1)
 *
 * If roundtrip > 500ms, retry once. If still > 500ms, throw.
 *
 * `fetchImpl` is injectable for testability.
 */

export type ClockSyncResult = {
  offsetMs: number;
  roundtripMs: number;
};

const MAX_ROUNDTRIP_MS = 500;

export async function syncClock(
  fetchImpl: typeof fetch = fetch,
  url = "/api/clock-sync",
): Promise<ClockSyncResult> {
  const attempt = async (): Promise<ClockSyncResult> => {
    const t0 = Date.now();
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`clock-sync HTTP ${res.status}`);
    const body = (await res.json()) as { t1: number; t2: number };
    const t3 = Date.now();
    const roundtripMs = t3 - t0 - (body.t2 - body.t1);
    const offsetMs = (body.t1 - t0 + (body.t2 - t3)) / 2;
    return { offsetMs, roundtripMs };
  };

  const first = await attempt();
  if (first.roundtripMs <= MAX_ROUNDTRIP_MS) return first;
  const second = await attempt();
  if (second.roundtripMs <= MAX_ROUNDTRIP_MS) return second;
  throw new Error(`clock-sync roundtrip too high: ${second.roundtripMs}ms`);
}