/**
 * Tiny bridge so non-React modules (WsConnection) can push state into the
 * Zustand store without importing the hook directly (keeps tree-shaking
 * clean and avoids the hook being called outside a component).
 */
import { useConnectionStore, type ConnectionState } from "./connection.ts";

export function setConnectionStore(patch: Partial<ConnectionState>): void {
  useConnectionStore.setState(patch);
}