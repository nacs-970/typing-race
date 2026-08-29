import { create } from "zustand";

/**
 * Single source of truth for the WS connection state from the React side.
 * Updated by `WsConnection` on every event; read by `App.tsx` for rendering.
 */
export type ConnectionStatus = "connecting" | "open" | "closed";

export type ConnectionState = {
  status: ConnectionStatus;
  playerId: string | null;
  serverTs: number | null;
};

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: "connecting",
  playerId: null,
  serverTs: null,
}));

/** Allow non-React code (WsConnection) to push updates in. */
export const setConnectionState = (patch: Partial<ConnectionState>): void => {
  useConnectionStore.setState(patch);
};