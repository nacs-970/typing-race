/**
 * Room-code alphabet — excludes ambiguous chars (I, O, 0, 1).
 * Phase 2 adds the `nanoid`-style helper that produces codes from this alphabet.
 */

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

export type RoomCode = string;