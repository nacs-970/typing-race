import {
  RaceClient,
  getSessionCookie,
  setSessionCookie,
  clearSessionCookie,
  getRaceClient,
  initRaceClient,
} from "./race-client.ts";

export {
  RaceClient,
  getSessionCookie,
  setSessionCookie,
  clearSessionCookie,
  getRaceClient,
  initRaceClient,
};

/**
 * Backward-compatible WsConnection wrapping/extending RaceClient.
 * Preserves 100% API compatibility with existing Phase 1-4 components and tests.
 */
export class WsConnection extends RaceClient {}

const envWsUrl = typeof import.meta !== "undefined" ? import.meta.env?.VITE_WS_URL : undefined;
const dynamicWsUrl =
  typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
    : "ws://localhost:5173/ws";

const wsUrl = envWsUrl ?? dynamicWsUrl;

export const ws = new WsConnection(wsUrl);
ws.connect();
