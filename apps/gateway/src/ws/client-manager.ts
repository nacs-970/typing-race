import type { ServerWebSocket } from "bun";
import type { WsData } from "./handlers.ts";

export class ClientManager {
  public sockets = new Map<string, ServerWebSocket<WsData>>();
  public roomMembers = new Map<string, Set<string>>();

  addSocket(playerId: string, ws: ServerWebSocket<WsData>): void {
    this.sockets.set(playerId, ws);
  }

  removeSocket(playerId: string): void {
    const ws = this.sockets.get(playerId);
    if (ws?.data.roomCode) {
      this.clearRoom(playerId, ws.data.roomCode);
    }
    this.sockets.delete(playerId);
  }

  assignRoom(playerId: string, roomCode: string): void {
    let members = this.roomMembers.get(roomCode);
    if (!members) {
      members = new Set();
      this.roomMembers.set(roomCode, members);
    }
    members.add(playerId);

    const ws = this.sockets.get(playerId);
    if (ws) {
      ws.data.roomCode = roomCode;
    }
  }

  clearRoom(playerId: string, roomCode: string): void {
    const members = this.roomMembers.get(roomCode);
    if (members) {
      members.delete(playerId);
      if (members.size === 0) {
        this.roomMembers.delete(roomCode);
      }
    }

    const ws = this.sockets.get(playerId);
    if (ws && ws.data.roomCode === roomCode) {
      ws.data.roomCode = null;
    }
  }

  getSocket(playerId: string): ServerWebSocket<WsData> | undefined {
    return this.sockets.get(playerId);
  }

  getRoomSockets(roomCode: string, excludePlayerId?: string): ServerWebSocket<WsData>[] {
    const members = this.roomMembers.get(roomCode);
    if (!members) return [];

    const list: ServerWebSocket<WsData>[] = [];
    for (const pid of members) {
      if (excludePlayerId && pid === excludePlayerId) continue;
      const s = this.sockets.get(pid);
      if (s) {
        list.push(s);
      }
    }
    return list;
  }

  clear(): void {
    this.sockets.clear();
    this.roomMembers.clear();
  }
}

export const clientManager = new ClientManager();
