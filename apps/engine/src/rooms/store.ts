import type { Room } from "../race/types.ts";

export interface RoomStore {
  get(code: string): Promise<Room | null> | Room | null;
  set(code: string, room: Room): Promise<void> | void;
  delete(code: string): Promise<boolean> | boolean;
  has(code: string): Promise<boolean> | boolean;
  list(): Promise<Room[]> | Room[];
}

export class InMemoryRoomStore implements RoomStore {
  private rooms = new Map<string, Room>();

  get(code: string): Room | null {
    return this.rooms.get(code) ?? null;
  }

  set(code: string, room: Room): void {
    this.rooms.set(code, room);
  }

  delete(code: string): boolean {
    return this.rooms.delete(code);
  }

  has(code: string): boolean {
    return this.rooms.has(code);
  }

  list(): Room[] {
    return Array.from(this.rooms.values());
  }
}
