import { detectScriptPattern, disassembleScript, extractRedeemScript } from "./scriptUtils";

// The key hash of the testnet ML-DSA-44 address
// hoosattest:q3sgdxhmdupvrkl2wadns4ve8m52a48vx2agmvchj2yg6ed02l0ts9tjldglp
// (address version 0x04), and the script HTND pays it with:
// OP_DUP OP_BLAKE2B OP_DATA_32 <hash> OP_EQUALVERIFY OP_CHECKSIGMLDSA44.
const MLDSA_KEY_HASH = "60869afb6f02c1dbea775b3855993ee8aed4ec32ba8db31792888d65af57deb8";
const MLDSA_P2PKH = `76aa20${MLDSA_KEY_HASH}88a6`;

// A Schnorr P2PKH script of the same hash, for the regression cases.
const SCHNORR_P2PKH = `76aa20${MLDSA_KEY_HASH}88ac`;

// n bytes of hex with a recognisable start and end.
const fill = (bytes, byte) => `${"01"}${byte.repeat(bytes - 2)}${"ff"}`;

// OP_PUSHDATA2 <2-byte little-endian length> <data>
const pushData2 = (hex) => {
  const size = hex.length / 2;
  return `4d${(size & 0xff).toString(16).padStart(2, "0")}${(size >> 8).toString(16).padStart(2, "0")}${hex}`;
};

const pushData1 = (hex) => `4c${(hex.length / 2).toString(16).padStart(2, "0")}${hex}`;

const MLDSA_SIGNATURE = fill(2421, "5a"); // 2420-byte signature + sighash type
const MLDSA_PUBLIC_KEY = fill(1312, "3c");

describe("ML-DSA-44 output scripts", () => {
  test("names opcode 0xa6 OP_CHECKSIGMLDSA44, as HTND does from the fork on", () => {
    const { opcodes, asm, isMalformed } = disassembleScript(MLDSA_P2PKH);
    expect(isMalformed).toBe(false);
    expect(opcodes.map((o) => o.name)).toEqual([
      "OP_DUP",
      "OP_BLAKE2B",
      "OP_DATA_32",
      "OP_EQUALVERIFY",
      "OP_CHECKSIGMLDSA44",
    ]);
    expect(asm.split("\n")[2]).toBe(`OP_DATA_32 ${MLDSA_KEY_HASH}`);
  });

  test("classifies the key-hash script as P2PKH (ml-dsa-44)", () => {
    expect(detectScriptPattern(MLDSA_P2PKH)).toEqual({
      type: "P2PKH",
      details: { pubKeyHash: MLDSA_KEY_HASH, hashAlgo: "blake2b-256", format: "blake2b-32 (ml-dsa-44)" },
      matchType: "exact",
      confidence: 1,
    });
  });

  test("still classifies Schnorr and ECDSA key-hash scripts as before", () => {
    expect(detectScriptPattern(SCHNORR_P2PKH).details.format).toBe("blake2b-32");
    expect(detectScriptPattern(`76aa20${MLDSA_KEY_HASH}88ab`).details.format).toBe("blake2b-32 (ecdsa)");
    // 0xa7 is still undefined.
    expect(detectScriptPattern(`76aa20${MLDSA_KEY_HASH}88a7`).type).toBe("Unknown");
  });

  test("recognises HTND's ML-DSA-44 multisig redeem script", () => {
    const keyBlock = (hash) => `6376aa20${hash}88a66700686b`;
    const hashB = "ab".repeat(32);
    const hashC = "cd".repeat(32);
    // 2-of-3: three key blocks, OP_FROMALTSTACK (OP_FROMALTSTACK OP_ADD) x2, OP_2 OP_GREATERTHANOREQUAL
    const redeem = keyBlock(MLDSA_KEY_HASH) + keyBlock(hashB) + keyBlock(hashC) + "6c6c936c93" + "52a2";
    const pattern = detectScriptPattern(redeem);
    expect(pattern.type).toBe("P2MS");
    expect(pattern.matchType).toBe("exact");
    expect(pattern.details).toEqual({
      m: 2,
      n: 3,
      pubKeyHashes: [MLDSA_KEY_HASH, hashB, hashC],
      format: "2-of-3 (ml-dsa-44)",
    });
    // m above 2 is not one HTND builds.
    expect(detectScriptPattern(redeem.slice(0, -4) + "53a2").type).not.toBe("P2MS");

    // An unlock where the last key signs and the other two do not:
    // <sig> <key> OP_1 OP_0 OP_0 <redeem>
    const unlock = pushData2(MLDSA_SIGNATURE) + pushData2(MLDSA_PUBLIC_KEY) + "510000" + pushData1(redeem);
    expect(extractRedeemScript(unlock)).toBe(redeem);
    const unlockPattern = detectScriptPattern(unlock);
    expect(unlockPattern.type).toBe("P2MS Unlock");
    expect(unlockPattern.details.format).toBe("2-of-3 (ml-dsa-44)");
    expect(unlockPattern.details.redeemScriptBytes).toBe(redeem.length / 2);
  });
});

describe("ML-DSA-44 unlocking scripts", () => {
  const unlock = pushData2(MLDSA_SIGNATURE) + pushData2(MLDSA_PUBLIC_KEY);

  test("disassembles the OP_PUSHDATA2 pushes of a 2421-byte signature and a 1312-byte key", () => {
    // 3 + 2421 + 3 + 1312 = 3,739 bytes.
    expect(unlock.length / 2).toBe(3739);
    expect(unlock.slice(0, 6)).toBe("4d7509");
    const { opcodes, isMalformed } = disassembleScript(unlock);
    expect(isMalformed).toBe(false);
    expect(opcodes).toHaveLength(2);
    expect(opcodes[0]).toMatchObject({ offset: 0, name: "OP_PUSHDATA2", pushSize: 2421, dataHex: MLDSA_SIGNATURE });
    expect(opcodes[1]).toMatchObject({ offset: 2424, name: "OP_PUSHDATA2", pushSize: 1312, dataHex: MLDSA_PUBLIC_KEY });
  });

  test("classifies <signature> <key> as a P2PKH unlock (ml-dsa-44)", () => {
    expect(detectScriptPattern(unlock)).toEqual({
      type: "P2PKH Unlock",
      details: { format: "ml-dsa-44", signatureBytes: 2421 },
      matchType: "heuristic",
      confidence: 0.7,
    });
  });

  test("classifies a lone 2421-byte signature as a P2PK unlock", () => {
    const pattern = detectScriptPattern(pushData2(MLDSA_SIGNATURE));
    expect(pattern.type).toBe("P2PK Unlock");
    expect(pattern.details).toEqual({ signatureBytes: 2421, format: "ml-dsa-44" });
  });

  test("classifies a single-sig ML-DSA-44 P2SH spend by its redeem script", () => {
    // The wallet's P2SH form wraps the P2PKH script (MLDSA44SingleSigRedeemScript).
    const p2sh = unlock + `25${MLDSA_P2PKH}`;
    expect(extractRedeemScript(p2sh)).toBe(MLDSA_P2PKH);
    expect(detectScriptPattern(p2sh)).toMatchObject({ type: "P2SH Unlock", details: { redeemScriptBytes: 37 } });
  });

  test("flags a truncated OP_PUSHDATA2 push as malformed", () => {
    const { isMalformed, error } = disassembleScript(unlock.slice(0, 200));
    expect(isMalformed).toBe(true);
    expect(error).toMatch(/pushSize=2421/);
  });
});

describe("Schnorr unlocking scripts (regression)", () => {
  const schnorrSig = fill(65, "11"); // 64-byte signature + sighash type
  const schnorrKey = fill(32, "22");

  test("<signature> <32-byte key> is still a plain P2PKH unlock", () => {
    expect(detectScriptPattern(`41${schnorrSig}20${schnorrKey}`)).toEqual({
      type: "P2PKH Unlock",
      details: {},
      matchType: "heuristic",
      confidence: 0.7,
    });
  });

  test("a lone 65-byte signature is still a P2PK unlock without a format", () => {
    expect(detectScriptPattern(`41${schnorrSig}`).details).toEqual({ signatureBytes: 65 });
  });

  test("a 1312-byte key is not a P2PK locking script", () => {
    expect(detectScriptPattern(`${pushData2(MLDSA_PUBLIC_KEY)}ac`).type).not.toBe("P2PK");
  });
});
