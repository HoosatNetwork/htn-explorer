import {
  DEFAULT_DEV_FEE_END_DAA_SCORE,
  DEV_FEE_FROM_DAA_SCORE,
  minerShareAt,
  parseDevFeeEndDaaScore,
} from "./devFee";

describe("minerShareAt", () => {
  test("pays the miner everything before the dev fee starts", () => {
    expect(minerShareAt(0)).toBe(1);
    expect(minerShareAt(17499999)).toBe(1);
  });

  // The mainnet end is passed explicitly, so these cases hold whatever
  // REACT_APP_DEV_FEE_END_DAA_SCORE the shell running the tests has set.
  test("takes the dev fee from DAA score 17,500,000 on, as HTND does (>=)", () => {
    expect(DEV_FEE_FROM_DAA_SCORE).toBe(17500000);
    expect(minerShareAt(17500000, DEFAULT_DEV_FEE_END_DAA_SCORE)).toBe(0.95);
    expect(minerShareAt(240000000, DEFAULT_DEV_FEE_END_DAA_SCORE)).toBe(0.95);
    expect(minerShareAt(257999999, DEFAULT_DEV_FEE_END_DAA_SCORE)).toBe(0.95);
  });

  test("pays the miner everything again from the v12 fork at DAA score 258,000,000", () => {
    expect(DEFAULT_DEV_FEE_END_DAA_SCORE).toBe(258000000);
    expect(minerShareAt(258000000, DEFAULT_DEV_FEE_END_DAA_SCORE)).toBe(1);
    expect(minerShareAt(299919264, DEFAULT_DEV_FEE_END_DAA_SCORE)).toBe(1);
  });

  test("accepts the score as a string, as the API sends it", () => {
    expect(minerShareAt("17500000", DEFAULT_DEV_FEE_END_DAA_SCORE)).toBe(0.95);
    expect(minerShareAt("258000000", DEFAULT_DEV_FEE_END_DAA_SCORE)).toBe(1);
  });

  test("uses a given end score", () => {
    expect(minerShareAt(258000000, 260000000)).toBe(0.95);
    expect(minerShareAt(260000000, 260000000)).toBe(1);
  });
});

describe("parseDevFeeEndDaaScore", () => {
  test("takes a positive integer", () => {
    expect(parseDevFeeEndDaaScore("260000000")).toBe(260000000);
    expect(parseDevFeeEndDaaScore(" 10000000 ")).toBe(10000000);
  });

  test("falls back to 258,000,000 for a missing or bad value", () => {
    for (const value of [undefined, "", "0", "-5", "1.5", "2.58e8", "abc", "258000000x", "99999999999999999999"]) {
      expect(parseDevFeeEndDaaScore(value)).toBe(DEFAULT_DEV_FEE_END_DAA_SCORE);
    }
  });
});

describe("REACT_APP_DEV_FEE_END_DAA_SCORE", () => {
  const original = process.env.REACT_APP_DEV_FEE_END_DAA_SCORE;
  afterEach(() => {
    if (original === undefined) {
      delete process.env.REACT_APP_DEV_FEE_END_DAA_SCORE;
    } else {
      process.env.REACT_APP_DEV_FEE_END_DAA_SCORE = original;
    }
  });

  const loadWith = (value) => {
    if (value === undefined) {
      delete process.env.REACT_APP_DEV_FEE_END_DAA_SCORE;
    } else {
      process.env.REACT_APP_DEV_FEE_END_DAA_SCORE = value;
    }
    let devFee;
    jest.isolateModules(() => {
      devFee = require("./devFee");
    });
    return devFee;
  };

  test("ends the dev fee at the v12 fork when it is not set", () => {
    const devFee = loadWith(undefined);
    expect(devFee.DEV_FEE_END_DAA_SCORE).toBe(258000000);
    expect(devFee.minerShareAt(257999999)).toBe(0.95);
    expect(devFee.minerShareAt(258000000)).toBe(1);
  });

  test("moves the end of the dev fee", () => {
    const devFee = loadWith("30000000");
    expect(devFee.DEV_FEE_END_DAA_SCORE).toBe(30000000);
    expect(devFee.minerShareAt(29999999)).toBe(0.95);
    expect(devFee.minerShareAt(30000000)).toBe(1);
  });

  test("is ignored when it is not a positive integer", () => {
    const devFee = loadWith("soon");
    expect(devFee.DEV_FEE_END_DAA_SCORE).toBe(258000000);
    expect(devFee.minerShareAt(257999999)).toBe(0.95);
    expect(devFee.minerShareAt(258000000)).toBe(1);
  });
});
