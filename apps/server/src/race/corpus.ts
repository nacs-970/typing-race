/**
 * No-repeat passage deck — D-04.
 *
 * Pure functions; caller manages Room state. Server is the validator of record;
 * the deck shuffles all passageIds on first start_race and reshuffles when
 * exhausted (excluding the just-served passageId per Pitfall 5).
 */

/** Fisher-Yates shuffle. Returns a NEW array; does not mutate input. */
export function shuffle<T>(arr: ReadonlyArray<T>): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export type DealArgs = {
  allPassageIds: ReadonlyArray<string>;
  deckOrder: ReadonlyArray<string>;
  deckCursor: number;
  lastPassageId: string | null;
};

export type DealResult = {
  passageId: string;
  deckOrder: ReadonlyArray<string>;
  deckCursor: number;
};

/**
 * Returns the next passageId from the deck. If the cursor has exhausted the
 * deck, reshuffle all-passage-ids excluding the just-served lastPassageId,
 * then return deckOrder[0] and reset cursor to 1.
 *
 * Pure: caller applies the returned state to Room.
 */
export function dealNextPassage(args: DealArgs): DealResult {
  const { allPassageIds, deckOrder, deckCursor, lastPassageId } = args;
  if (deckCursor >= deckOrder.length) {
    // Reshuffle excluding lastPassageId (Pitfall 5: prevents the just-served
    // passage from being the top of the new deck).
    const filtered = allPassageIds.filter((id) => id !== lastPassageId);
    const newDeck = shuffle(filtered);
    return {
      passageId: newDeck[0]!,
      deckOrder: newDeck,
      deckCursor: 1,
    };
  }
  return {
    passageId: deckOrder[deckCursor]!,
    deckOrder,
    deckCursor: deckCursor + 1,
  };
}