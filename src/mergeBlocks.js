// The last-blocks reply holds only the server's short cache. After a reconnect the page already shows more
// blocks, so merge instead of replacing: one entry per block hash (blocks without a hash are kept as they are),
// ordered by blue score so that the limit drops the oldest blocks. A block without a usable blue score ranks
// lowest; equal scores are ordered by hash, so the kept set does not depend on the order events arrive in.
const score = (b) => {
  const n = b.blueScore === null || b.blueScore === "" ? NaN : Number(b.blueScore);
  return Number.isFinite(n) ? n : -Infinity;
};
const hash = (b) => String(b.block_hash || "");

export function mergeBlocks(current, incoming, limit = 60) {
  const seen = new Set();
  const merged = [...current, ...incoming].filter((b) => {
    if (!b.block_hash) return true;
    if (seen.has(b.block_hash)) return false;
    seen.add(b.block_hash);
    return true;
  });
  return merged
    .sort((a, b) => score(a) - score(b) || (hash(a) < hash(b) ? -1 : hash(a) > hash(b) ? 1 : 0))
    .slice(-limit);
}
