// The dev fee: 5 % of every block reward, paid in a second coinbase output.
//
// HTND pays it from DAA score 17,500,000 on (BlockVersionForDAAScore, which
// compares with >=). The mainnet hard fork of block version 12 at DAA score
// 258,000,000 removes the dev-fee output, so from then on the miner gets the
// whole merge-set reward. A build for another network or a moved fork date
// sets REACT_APP_DEV_FEE_END_DAA_SCORE.

export const DEV_FEE_FROM_DAA_SCORE = 17500000;
export const DEFAULT_DEV_FEE_END_DAA_SCORE = 258000000;

// The end score from a build variable: a positive integer, else the default.
export const parseDevFeeEndDaaScore = (value) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^[0-9]+$/.test(text)) {
    return DEFAULT_DEV_FEE_END_DAA_SCORE;
  }
  const score = Number(text);
  return Number.isSafeInteger(score) && score > 0 ? score : DEFAULT_DEV_FEE_END_DAA_SCORE;
};

export const DEV_FEE_END_DAA_SCORE = parseDevFeeEndDaaScore(process.env.REACT_APP_DEV_FEE_END_DAA_SCORE);

// The miner's share of the block reward at a DAA score: 0.95 while the dev
// fee is paid (FROM <= score < END), 1 before and after.
export const minerShareAt = (daaScore, endDaaScore = DEV_FEE_END_DAA_SCORE) => {
  const score = Number(daaScore);
  return score >= DEV_FEE_FROM_DAA_SCORE && score < endDaaScore ? 0.95 : 1;
};
