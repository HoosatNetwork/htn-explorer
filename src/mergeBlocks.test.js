import { mergeBlocks } from "./mergeBlocks";

const block = (n) => ({ block_hash: `h${n}`, blueScore: n });
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => block(from + i));
const hashes = (blocks) => blocks.map((b) => b.block_hash);

describe("mergeBlocks", () => {
  test("keeps all ten distinct blocks on first load", () => {
    expect(mergeBlocks([], range(1, 10))).toEqual(range(1, 10));
  });

  test("keeps the blocks already shown when a reconnect brings the short server cache", () => {
    const merged = mergeBlocks(range(1, 60), range(55, 64)); // server cache: last 10, 4 of them new
    expect(hashes(merged)).toEqual(hashes(range(5, 64)));
  });

  test("adds no duplicate, also not from repeats inside one input", () => {
    expect(mergeBlocks(range(1, 30), range(21, 30))).toEqual(range(1, 30));
    expect(hashes(mergeBlocks([block(1)], [block(2), block(2)]))).toEqual(["h1", "h2"]);
    expect(hashes(mergeBlocks([block(1), block(1)], []))).toEqual(["h1"]);
  });

  test("keeps blocks without a hash, each on its own", () => {
    const a = { block_hash: null, blueScore: 3 };
    const b = { blueScore: 4 };
    expect(mergeBlocks([a], [b, block(5)])).toEqual([a, b, block(5)]);
  });

  test("a block that fills a hole is dropped before newer ones when the limit is reached", () => {
    const shown = [...range(1, 10), ...range(12, 20)];
    let list = mergeBlocks(shown, range(11, 20)); // the cache brings the missing block 11
    for (let n = 21; n <= 71; n++) list = mergeBlocks(list, [block(n)]);
    expect(hashes(list)).toEqual(hashes(range(12, 71)));
  });

  test("sequential reply and live merges keep blocks 6-65 in either order", () => {
    // App passes both as functional updates, so each merge sees the result of the one before
    // (this checks the helper, not the React wiring).
    const shown = range(1, 60);
    const replyThenLive = mergeBlocks(mergeBlocks(shown, range(55, 64)), [block(65)]);
    const liveThenReply = mergeBlocks(mergeBlocks(shown, [block(65)]), range(55, 64));
    expect(hashes(replyThenLive)).toEqual(hashes(range(6, 65)));
    expect(hashes(liveThenReply)).toEqual(hashes(range(6, 65)));
  });

  test("ranks a block without a usable blue score lowest", () => {
    const missing = { block_hash: "hm" };
    const nul = { block_hash: "hn", blueScore: null };
    const text = { block_hash: "ht", blueScore: "bad" };
    expect(hashes(mergeBlocks([block(3)], [text, block(1)], 2))).toEqual(["h1", "h3"]);
    expect(hashes(mergeBlocks([block(3), missing, nul], [block(1)], 2))).toEqual(["h1", "h3"]);
    expect(hashes(mergeBlocks([], [{ block_hash: "hs", blueScore: "7" }, block(5)]))).toEqual(["h5", "hs"]);
  });

  test("keeps the same blocks for equal blue scores whatever the event order", () => {
    const a = { block_hash: "ha", blueScore: 9 };
    const b = { block_hash: "hb", blueScore: 9 };
    const shown = range(1, 3);
    expect(mergeBlocks(mergeBlocks(shown, [a]), [b], 3)).toEqual(mergeBlocks(mergeBlocks(shown, [b]), [a], 3));
    expect(hashes(mergeBlocks(shown, [b, a], 3))).toEqual(["h3", "ha", "hb"]);
    expect(hashes(mergeBlocks([a], [b], 1))).toEqual(["hb"]);
    expect(hashes(mergeBlocks([b], [a], 1))).toEqual(["hb"]);
  });

  test("keeps the newest blocks within the limit", () => {
    expect(hashes(mergeBlocks(range(1, 5), range(6, 10), 4))).toEqual(hashes(range(7, 10)));
  });
});
