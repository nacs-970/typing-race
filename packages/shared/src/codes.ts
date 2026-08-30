/**
 * Room-code generator — 6-char code from a 31-char alphabet
 * (excludes I, O, 0, 1 to avoid visual ambiguity).
 *
 * Uses `nanoid.customAlphabet` for crypto-strong random selection.
 * Collision space = 31^6 ≈ 887M; birthday paradox on 10k samples
 * expects ~56 dupes, well under the 3-retry budget used by
 * the Room Manager.
 */
import { customAlphabet } from "nanoid";

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_REGEX = /^[A-HJ-NP-Z2-9]{6}$/;

const genRaw = customAlphabet(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH);

export type RoomCode = string;

export function genRoomCode(): RoomCode {
  return genRaw();
}

export function isValidRoomCode(code: string): code is RoomCode {
  return ROOM_CODE_REGEX.test(code);
}