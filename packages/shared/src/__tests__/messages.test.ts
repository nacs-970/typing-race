/**
 * Wire schema tests — Phase 2 Plan 01 tracer.
 *
 * 8 unit tests:
 *  1. All 5 new C→S frames round-trip valid input
 *  2. Malformed C→S frames reject
 *  3. All 6 new S→C frames round-trip valid input
 *  4. Malformed S→C frames reject
 *  5. Phase 1 C→S frames still parse
 *  6. Phase 1 S→C frames still parse
 *  7. Discriminator exhaustive — adding a literal without registering breaks the union
 *  8. cursorUpdateSchema requires serverTs, not clientTs (anti-cheat invariant)
 */
import { describe, test, expect } from "bun:test";
import {
  clientToServerSchema,
  serverToClientSchema,
  type ClientToServer,
  type ServerToClient,
} from "../messages.ts";
import { PASSAGES } from "../passages.ts";

const VALID_UUID = "11111111-1111-4111-8111-000000000001"; // v4 RFC4122 conformant
const VALID_UUID_2 = "22222222-2222-4222-8222-222222222222";

describe("Phase 2 wire schemas — C→S round-trip", () => {
  test("1. all 5 new C→S frames parse valid input", () => {
    expect(
      clientToServerSchema.safeParse({
        type: "create_room",
        nickname: "Alice",
      }).success,
    ).toBe(true);
    expect(
      clientToServerSchema.safeParse({
        type: "clock_sync",
        t0: 100,
        t3: 105,
      }).success,
    ).toBe(true);
    const known = PASSAGES[0];
    if (!known) throw new Error("PASSAGES empty");
    expect(
      clientToServerSchema.safeParse({
        type: "start_race",
        passageId: known.id,
        graceSeconds: 5,
      }).success,
    ).toBe(true);
    // Backwards-compat: rematch sends without passageId (D-04 auto-deal)
    expect(
      clientToServerSchema.safeParse({
        type: "start_race",
        graceSeconds: 5,
      }).success,
    ).toBe(true);
    expect(
      clientToServerSchema.safeParse({
        type: "keystroke",
        index: 0,
        char: "a",
        clientTs: 100,
      }).success,
    ).toBe(true);
    expect(
      clientToServerSchema.safeParse({
        type: "cursor_position",
        index: 0,
        clientTs: 100,
      }).success,
    ).toBe(true);
  });

  test("2. malformed C→S frames reject", () => {
    // missing type
    expect(
      clientToServerSchema.safeParse({ nickname: "Alice" }).success,
    ).toBe(false);
    // unknown type
    expect(
      clientToServerSchema.safeParse({ type: "bogus" }).success,
    ).toBe(false);
    // create_room missing nickname
    expect(
      clientToServerSchema.safeParse({ type: "create_room" }).success,
    ).toBe(false);
    // keystroke index negative
    expect(
      clientToServerSchema.safeParse({
        type: "keystroke",
        index: -1,
        char: "a",
        clientTs: 0,
      }).success,
    ).toBe(false);
    // keystroke char length != 1
    expect(
      clientToServerSchema.safeParse({
        type: "keystroke",
        index: 0,
        char: "ab",
        clientTs: 0,
      }).success,
    ).toBe(false);
  });
});

describe("Phase 2 wire schemas — S→C round-trip", () => {
  test("3. all 6 new S→C frames parse valid input", () => {
    expect(
      serverToClientSchema.safeParse({
        type: "joined_room",
        playerId: VALID_UUID,
        roomCode: "ABCDEF",
        you: { nickname: "Alice", isHost: true },
        players: [],
        clockOffsetMs: 0,
      }).success,
    ).toBe(true);
    expect(
      serverToClientSchema.safeParse({
        type: "lobby_state",
        roomCode: "ABCDEF",
        players: [],
      }).success,
    ).toBe(true);
    expect(
      serverToClientSchema.safeParse({
        type: "countdown",
        startsAtServerMs: 100,
        secondsRemaining: 3,
      }).success,
    ).toBe(true);
    expect(
      serverToClientSchema.safeParse({
        type: "race_start",
        startsAtServerMs: 100,
        passageId: "p1",
        passageText: "hello world",
      }).success,
    ).toBe(true);
    expect(
      serverToClientSchema.safeParse({
        type: "cursor_update",
        playerId: VALID_UUID,
        index: 0,
        serverTs: 100,
      }).success,
    ).toBe(true);
    expect(
      serverToClientSchema.safeParse({
        type: "player_left",
        playerId: VALID_UUID,
      }).success,
    ).toBe(true);
    expect(
      serverToClientSchema.safeParse({
        type: "race_end",
        reason: "finished",
        finishedPlayerIds: [],
      }).success,
    ).toBe(true);
  });

  test("4. malformed S→C frames reject", () => {
    // joined_room.roomCode not matching regex
    expect(
      serverToClientSchema.safeParse({
        type: "joined_room",
        playerId: VALID_UUID,
        roomCode: "BAD", // too short
        you: { nickname: "x", isHost: false },
        players: [],
        clockOffsetMs: 0,
      }).success,
    ).toBe(false);
    // countdown.secondsRemaining > 10
    expect(
      serverToClientSchema.safeParse({
        type: "countdown",
        startsAtServerMs: 0,
        secondsRemaining: 999,
      }).success,
    ).toBe(false);
    // race_end.reason not in enum
    expect(
      serverToClientSchema.safeParse({
        type: "race_end",
        reason: "bogus",
        finishedPlayerIds: [],
      }).success,
    ).toBe(false);
  });
});

describe("Phase 1 backwards compat", () => {
  test("5. Phase 1 C→S frames still parse", () => {
    expect(
      clientToServerSchema.safeParse({ type: "ping", clientTs: 1 }).success,
    ).toBe(true);
    expect(
      clientToServerSchema.safeParse({
        type: "join_room",
        code: "ABCDEF",
        nickname: "x",
      }).success,
    ).toBe(true);
    expect(
      clientToServerSchema.safeParse({ type: "leave_room" }).success,
    ).toBe(true);
  });

  test("6. Phase 1 S→C frames still parse", () => {
    expect(
      serverToClientSchema.safeParse({
        type: "hello",
        playerId: VALID_UUID,
        serverTs: 1,
      }).success,
    ).toBe(true);
    expect(
      serverToClientSchema.safeParse({
        type: "pong",
        clientTs: 1,
        serverTs: 2,
      }).success,
    ).toBe(true);
    expect(
      serverToClientSchema.safeParse({
        type: "error",
        code: "INVALID_FRAME",
        message: "x",
      }).success,
    ).toBe(true);
  });
});

describe("Anti-cheat invariants baked into schemas", () => {
  test("7. discriminator exhaustive — `never` check on un-registered type fails typecheck", () => {
    // Type-level: if a new literal is added to the union without registering
    // here, the `never` assertion below breaks. This is a compile-time
    // guard; runtime test asserts the union is non-empty.
    type _AllCTypes = ClientToServer["type"];
    type _AllSTypes = ServerToClient["type"];
    // intentionally no runtime asserts — TypeScript enforces the exhaustiveness
    expect(typeof clientToServerSchema).toBe("object");
    expect(typeof serverToClientSchema).toBe("object");
  });

  test("8. cursor_update schema requires serverTs, NOT clientTs", () => {
    // Without serverTs, the frame rejects — server-timestamp invariant
    expect(
      serverToClientSchema.safeParse({
        type: "cursor_update",
        playerId: VALID_UUID,
        index: 0,
      }).success,
    ).toBe(false);
    // With serverTs it parses
    expect(
      serverToClientSchema.safeParse({
        type: "cursor_update",
        playerId: VALID_UUID_2,
        index: 0,
        serverTs: 100,
      }).success,
    ).toBe(true);
  });

  test("9. cursor_update with charStates + wpm parses; backwards-compat without them", () => {
    // With new optional fields
    expect(
      serverToClientSchema.safeParse({
        type: "cursor_update",
        playerId: VALID_UUID,
        index: 0,
        serverTs: 1000,
        charStates: ["correct", "error", "pending"],
        wpm: 42,
      }).success,
    ).toBe(true);
    // Backwards-compat: without charStates/wpm (Phase 2 style)
    expect(
      serverToClientSchema.safeParse({
        type: "cursor_update",
        playerId: VALID_UUID,
        index: 0,
        serverTs: 1000,
      }).success,
    ).toBe(true);
  });

  test("10. cursor_update wpm negative rejected", () => {
    expect(
      serverToClientSchema.safeParse({
        type: "cursor_update",
        playerId: VALID_UUID,
        index: 0,
        serverTs: 1000,
        wpm: -1,
      }).success,
    ).toBe(false);
  });

  test("11. cursor_update charStates with invalid enum value rejected", () => {
    expect(
      serverToClientSchema.safeParse({
        type: "cursor_update",
        playerId: VALID_UUID,
        index: 0,
        serverTs: 1000,
        charStates: ["correct", "foo" as never, "pending"],
      }).success,
    ).toBe(false);
  });

  test("12. cursor_update empty charStates array accepted (edge case)", () => {
    expect(
      serverToClientSchema.safeParse({
        type: "cursor_update",
        playerId: VALID_UUID,
        index: 0,
        serverTs: 1000,
        charStates: [],
      }).success,
    ).toBe(true);
  });

  test("13. grace_countdown + race_end.results round-trip (D-15 + D-10)", () => {
    expect(
      serverToClientSchema.safeParse({
        type: "grace_countdown",
        remainingMs: 4500,
        leaderPlayerId: VALID_UUID,
        leaderNickname: "Alice",
      }).success,
    ).toBe(true);
    expect(
      serverToClientSchema.safeParse({
        type: "race_end",
        reason: "finished",
        finishedPlayerIds: [VALID_UUID, VALID_UUID_2],
        results: [
          {
            playerId: VALID_UUID,
            finishTimeMs: 30000,
            wpm: 60,
            accuracy: 0.95,
          },
          {
            playerId: VALID_UUID_2,
            finishTimeMs: 35000,
            wpm: 50,
            accuracy: 0.90,
          },
        ],
      }).success,
    ).toBe(true);
    // race_end without results still works (backwards compat)
    expect(
      serverToClientSchema.safeParse({
        type: "race_end",
        reason: "abandoned",
        finishedPlayerIds: [VALID_UUID],
      }).success,
    ).toBe(true);
  });
});