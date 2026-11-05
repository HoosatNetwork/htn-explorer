// Utilities for parsing and analyzing Hoosat/Kaspa (Bitcoin-like) scripts.
//
// Primary exported helpers:
// - disassembleScript(hex) -> { opcodes: Array<Op>, asm: string }
// - extractRedeemScript(sigScriptHex) -> redeemScriptHex | null
// - detectScriptPattern(scriptHex) -> { type, details, matchType, confidence }

import { blake2b } from "@noble/hashes/blake2b";

const HEX_RE = /^[0-9a-fA-F]*$/;

const normalizeHex = (hex) => {
  if (!hex) return "";
  const v = String(hex).trim().replace(/^0x/i, "").replace(/\s+/g, "");
  if (v.length % 2 !== 0) return "";
  if (!HEX_RE.test(v)) return "";
  return v.toLowerCase();
};

const hexToBytes = (hex) => {
  const v = normalizeHex(hex);
  if (!v) return new Uint8Array(0);
  const out = new Uint8Array(v.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(v.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const bytesToHex = (bytes) => {
  if (!bytes || bytes.length === 0) return "";
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const readUIntLE = (bytes, offset, size) => {
  if (offset + size > bytes.length) return null;
  let v = 0;
  for (let i = 0; i < size; i++) {
    v |= bytes[offset + i] << (8 * i);
  }
  return v >>> 0;
};

const OPCODE_NAMES = {
  0x00: "OP_0",
  0x4c: "OP_PUSHDATA1",
  0x4d: "OP_PUSHDATA2",
  0x4e: "OP_PUSHDATA4",
  0x4f: "OP_1NEGATE",
  0x50: "OP_RESERVED",

  // Control opcodes.
  0x61: "OP_NOP",
  0x62: "OP_VER",
  0x63: "OP_IF",
  0x64: "OP_NOTIF",
  0x65: "OP_VERIF",
  0x66: "OP_VERNOTIF",
  0x67: "OP_ELSE",
  0x68: "OP_ENDIF",
  0x69: "OP_VERIFY",
  0x6a: "OP_RETURN",
  0xb0: "OP_CHECKLOCKTIMEVERIFY",
  0xb1: "OP_CHECKSEQUENCEVERIFY",

  // Stack opcodes.
  0x6b: "OP_TOALTSTACK",
  0x6c: "OP_FROMALTSTACK",
  0x6d: "OP_2DROP",
  0x6e: "OP_2DUP",
  0x6f: "OP_3DUP",
  0x70: "OP_2OVER",
  0x71: "OP_2ROT",
  0x72: "OP_2SWAP",
  0x73: "OP_IFDUP",
  0x74: "OP_DEPTH",
  0x75: "OP_DROP",
  0x76: "OP_DUP",
  0x77: "OP_NIP",
  0x78: "OP_OVER",
  0x79: "OP_PICK",
  0x7a: "OP_ROLL",
  0x7b: "OP_ROT",
  0x7c: "OP_SWAP",
  0x7d: "OP_TUCK",

  // Splice opcodes.
  0x7e: "OP_CAT",
  0x7f: "OP_SUBSTR",
  0x80: "OP_LEFT",
  0x81: "OP_RIGHT",
  0x82: "OP_SIZE",

  // Bitwise logic / comparisons.
  0x83: "OP_INVERT",
  0x84: "OP_AND",
  0x85: "OP_OR",
  0x86: "OP_XOR",
  0x87: "OP_EQUAL",
  0x88: "OP_EQUALVERIFY",
  0x89: "OP_RESERVED1",
  0x8a: "OP_RESERVED2",

  // Numeric opcodes.
  0x8b: "OP_1ADD",
  0x8c: "OP_1SUB",
  0x8d: "OP_2MUL",
  0x8e: "OP_2DIV",
  0x8f: "OP_NEGATE",
  0x90: "OP_ABS",
  0x91: "OP_NOT",
  0x92: "OP_0NOTEQUAL",
  0x93: "OP_ADD",
  0x94: "OP_SUB",
  0x95: "OP_MUL",
  0x96: "OP_DIV",
  0x97: "OP_MOD",
  0x98: "OP_LSHIFT",
  0x99: "OP_RSHIFT",
  0x9a: "OP_BOOLAND",
  0x9b: "OP_BOOLOR",
  0x9c: "OP_NUMEQUAL",
  0x9d: "OP_NUMEQUALVERIFY",
  0x9e: "OP_NUMNOTEQUAL",
  0x9f: "OP_LESSTHAN",
  0xa0: "OP_GREATERTHAN",
  0xa1: "OP_LESSTHANOREQUAL",
  0xa2: "OP_GREATERTHANOREQUAL",
  0xa3: "OP_MIN",
  0xa4: "OP_MAX",
  0xa5: "OP_WITHIN",

  // Crypto opcodes (Hoosat/HTND).
  // OP_UNKNOWN166 before HTND's ML-DSA-44 fork; named as forked nodes name it.
  0xa6: "OP_CHECKSIGMLDSA44",
  0xa7: "OP_UNKNOWN167",
  0xa8: "OP_SHA256",
  0xa9: "OP_CHECKMULTISIGECDSA",
  0xaa: "OP_BLAKE2B",
  0xab: "OP_CHECKSIGECDSA",
  0xac: "OP_CHECKSIG",
  0xad: "OP_CHECKSIGVERIFY",
  0xae: "OP_CHECKMULTISIG",
  0xaf: "OP_CHECKMULTISIGVERIFY",

  // Special/invalid.
  0xfa: "OP_SMALLINTEGER",
  0xfb: "OP_PUBKEYS",
  0xfd: "OP_PUBKEYHASH",
  0xfe: "OP_PUBKEY",
  0xff: "OP_INVALIDOPCODE",
};

const opcodeName = (opcode) => {
  // Small push opcodes 0x01..0x4b are push-bytes.
  // HTND disassembly uses OP_DATA_n for these.
  if (opcode >= 0x01 && opcode <= 0x4b) return `OP_DATA_${opcode}`;
  // OP_1..OP_16
  if (opcode >= 0x51 && opcode <= 0x60) return `OP_${opcode - 0x50}`;
  // HTND uses OP_UNKNOWN### (decimal) for reserved/unknown opcode values.
  if ((opcode >= 0xb2 && opcode <= 0xf9) || opcode === 0xfc) return `OP_UNKNOWN${opcode}`;
  if (OPCODE_NAMES[opcode]) return OPCODE_NAMES[opcode];
  return `OP_${opcode.toString(16).padStart(2, "0")}`.toUpperCase();
};

const isPushOpcode = (opcode) => {
  return (opcode >= 0x01 && opcode <= 0x4b) || opcode === 0x4c || opcode === 0x4d || opcode === 0x4e;
};

/**
 * @typedef {Object} ScriptOp
 * @property {number} offset Byte offset within script
 * @property {number} opcode Raw opcode byte
 * @property {string} name Human-readable opcode name
 * @property {number|null} pushSize Size of pushed data (bytes) if push opcode
 * @property {string|null} dataHex Hex of pushed data if push opcode
 */

/**
 * Disassembles a script hex string into opcodes + an ASM string.
 * The ASM uses one opcode per line to match UI rendering requirements.
 */
export const disassembleScript = (scriptHex) => {
  const hex = normalizeHex(scriptHex);
  if (!hex) return { opcodes: [], asm: "", isMalformed: false, error: null };

  const bytes = hexToBytes(hex);
  /** @type {ScriptOp[]} */
  const ops = [];

  let i = 0;
  let isMalformed = false;
  let error = null;
  while (i < bytes.length) {
    const offset = i;
    const opcode = bytes[i];
    i += 1;

    let pushSize = null;
    let dataHex = null;

    if (opcode >= 0x01 && opcode <= 0x4b) {
      pushSize = opcode;
    } else if (opcode === 0x4c) {
      // PUSHDATA1
      pushSize = i < bytes.length ? bytes[i] : null;
      i += 1;
    } else if (opcode === 0x4d) {
      // PUSHDATA2
      pushSize = readUIntLE(bytes, i, 2);
      i += 2;
    } else if (opcode === 0x4e) {
      // PUSHDATA4
      pushSize = readUIntLE(bytes, i, 4);
      i += 4;
    }

    if (pushSize !== null) {
      if (pushSize < 0 || i + pushSize > bytes.length) {
        // Malformed push. Stop parsing to avoid misleading output.
        ops.push({ offset, opcode, name: opcodeName(opcode), pushSize, dataHex: null });
        isMalformed = true;
        error = `Malformed push at offset ${offset} (pushSize=${pushSize})`;
        break;
      }
      const data = bytes.slice(i, i + pushSize);
      dataHex = bytesToHex(data);
      i += pushSize;
    }

    ops.push({ offset, opcode, name: opcodeName(opcode), pushSize, dataHex });
  }

  const asm = ops.map((op) => (op.dataHex ? `${op.name} ${op.dataHex}` : op.name)).join("\n");

  return { opcodes: ops, asm, isMalformed, error };
};

/**
 * Compute BLAKE2b-256 digest of raw script bytes (hex -> hex).
 * Used for Hoosat P2SH script hash matching.
 */
export const blake2b256Hex = (dataHex) => {
  const hex = normalizeHex(dataHex);
  if (!hex) return "";
  const digest = blake2b(hexToBytes(hex), { dkLen: 32 });
  return bytesToHex(digest);
};

/**
 * Extract redeem script from a signatureScript (P2SH spending).
 * Convention (Bitcoin/Kaspa-like): redeem script is the last pushed data item.
 */
export const extractRedeemScript = (sigScriptHex) => {
  const { opcodes } = disassembleScript(sigScriptHex);
  const pushes = opcodes.filter((op) => isPushOpcode(op.opcode) && !!op.dataHex);
  if (pushes.length === 0) return null;
  return pushes[pushes.length - 1].dataHex;
};

const isOpN = (opName) => {
  // OP_1 .. OP_16
  return /^OP_([1-9]|1[0-6])$/.test(opName);
};

const opNToInt = (opName) => {
  if (!isOpN(opName)) return null;
  return parseInt(opName.replace("OP_", ""), 10);
};

// ML-DSA-44 (FIPS 204) sizes as HTND checks them: a 1312-byte public key and
// a 2420-byte signature, pushed with its sighash type byte (2421 bytes). These
// are the only two pushes HTND exempts from the 520-byte element limit.
export const MLDSA44_PUBLIC_KEY_SIZE = 1312;
export const MLDSA44_SIGNATURE_PUSH_SIZE = 2421;

// The public key sizes a locking script can carry: 32-byte keys (Schnorr),
// 33-byte ECDSA keys, and Bitcoin-like 65-byte keys.
const isScriptPubKeySize = (n) => n === 32 || n === 33 || n === 65;

// The public key sizes an unlocking script can carry: the above plus
// ML-DSA-44 keys, which a spend reveals next to its signature.
const isLikelyPubKeySize = (n) => isScriptPubKeySize(n) || n === MLDSA44_PUBLIC_KEY_SIZE;

const CHECKSIG_FORMATS = {
  OP_CHECKSIG: "blake2b-32",
  OP_CHECKSIGECDSA: "blake2b-32 (ecdsa)",
  OP_CHECKSIGMLDSA44: "blake2b-32 (ml-dsa-44)",
};

// HTND's ML-DSA-44 multisig redeem script (txscript mldsa44_multisig.go): for
// each of n key hashes
//   OP_IF OP_DUP OP_BLAKE2B <32-byte key hash> OP_EQUALVERIFY
//   OP_CHECKSIGMLDSA44 OP_ELSE OP_0 OP_ENDIF OP_TOALTSTACK
// then OP_FROMALTSTACK (OP_FROMALTSTACK OP_ADD)*(n-1) <m> OP_GREATERTHANOREQUAL,
// with 2 <= n <= 11 and 1 <= m <= min(2, n). Returns { m, n, pubKeyHashes } or
// null, as ExtractMultiSigMLDSA44RedeemScript accepts or refuses it.
const MLDSA44_MULTISIG_KEY_BLOCK = [
  "OP_IF",
  "OP_DUP",
  "OP_BLAKE2B",
  "OP_DATA_32",
  "OP_EQUALVERIFY",
  "OP_CHECKSIGMLDSA44",
  "OP_ELSE",
  "OP_0",
  "OP_ENDIF",
  "OP_TOALTSTACK",
];

const parseMldsa44MultiSig = (opcodes) => {
  const keyCount = Math.floor((opcodes.length - 1) / 12);
  if (keyCount < 2 || keyCount > 11 || opcodes.length !== keyCount * 12 + 1) return null;

  const blockLength = MLDSA44_MULTISIG_KEY_BLOCK.length;
  const pubKeyHashes = [];
  for (let i = 0; i < keyCount; i++) {
    for (let j = 0; j < blockLength; j++) {
      if (opcodes[i * blockLength + j].name !== MLDSA44_MULTISIG_KEY_BLOCK[j]) return null;
    }
    pubKeyHashes.push(opcodes[i * blockLength + 3].dataHex);
  }

  const tail = opcodes.slice(keyCount * blockLength).map((o) => o.name);
  if (tail[0] !== "OP_FROMALTSTACK") return null;
  for (let i = 1; i < keyCount; i++) {
    if (tail[2 * i - 1] !== "OP_FROMALTSTACK" || tail[2 * i] !== "OP_ADD") return null;
  }
  const m = opNToInt(tail[tail.length - 2]);
  if (m === null || m > 2 || m > keyCount || tail[tail.length - 1] !== "OP_GREATERTHANOREQUAL") return null;
  return { m, n: keyCount, pubKeyHashes };
};

const redeemLooksLikeScript = (redeemScriptHex) => {
  if (!redeemScriptHex) return false;
  const { opcodes } = disassembleScript(redeemScriptHex);
  if (!opcodes || opcodes.length === 0) return false;

  // If the redeemScript contains any non-push, non-trivial opcode, it is likely a real script.
  const names = opcodes.map((o) => o.name);
  return names.some(
    (n) =>
      n === "OP_CHECKSIG" ||
      n === "OP_CHECKSIGECDSA" ||
      n === "OP_CHECKSIGMLDSA44" ||
      n === "OP_CHECKMULTISIG" ||
      n === "OP_CHECKMULTISIGECDSA" ||
      n === "OP_IF" ||
      n === "OP_NOTIF" ||
      n === "OP_ELSE" ||
      n === "OP_ENDIF" ||
      n === "OP_VERIFY" ||
      n === "OP_RETURN",
  );
};

/**
 * Detect common script patterns. Returns a best-effort classification.
 *
 * matchType:
 * - exact: strict template match
 * - heuristic: likely match but not strict
 * - unknown: no confident match
 */
export const detectScriptPattern = (scriptHex) => {
  const _detect = (rawHex, depth = 0) => {
    const hex = normalizeHex(rawHex);
    if (!hex) {
      return { type: "Unknown", details: {}, matchType: "unknown", confidence: 0 };
    }

    const { opcodes } = disassembleScript(hex);
    const names = opcodes.map((o) => o.name);

    const sliceHexFromOpIndex = (startOpIndex) => {
      if (!opcodes[startOpIndex]) return "";
      const startByte = opcodes[startOpIndex].offset;
      return hex.slice(startByte * 2);
    };

    // Trivial scripts
    if (names.length === 1 && names[0] === "OP_1") {
      return { type: "Anyone Can Spend", details: {}, matchType: "exact", confidence: 1 };
    }
    if (names.length === 1 && names[0] === "OP_0") {
      return { type: "Provably Unspendable", details: {}, matchType: "exact", confidence: 1 };
    }

    // Witness program (Bitcoin-style). Not typical for Hoosat, but classify when present.
    // Pattern: OP_0|OP_1..OP_16 <2..40-byte program>
    if (
      names.length === 2 &&
      (names[0] === "OP_0" || isOpN(names[0])) &&
      opcodes[1]?.pushSize &&
      opcodes[1].pushSize >= 2 &&
      opcodes[1].pushSize <= 40 &&
      !!opcodes[1]?.dataHex
    ) {
      const witnessVersion = names[0] === "OP_0" ? 0 : opNToInt(names[0]);
      const programBytes = opcodes[1].pushSize;
      const program = opcodes[1].dataHex;

      if (witnessVersion === 0 && programBytes === 20) {
        return {
          type: "P2WPKH",
          details: { witnessVersion, programBytes, program },
          matchType: "exact",
          confidence: 1,
        };
      }
      if (witnessVersion === 0 && programBytes === 32) {
        return {
          type: "P2WSH",
          details: { witnessVersion, programBytes, program },
          matchType: "exact",
          confidence: 1,
        };
      }
      if (witnessVersion === 1 && programBytes === 32) {
        return {
          type: "P2TR",
          details: { witnessVersion, programBytes, program },
          matchType: "exact",
          confidence: 1,
        };
      }

      return {
        type: "Witness Program",
        details: { witnessVersion, programBytes, program },
        matchType: "exact",
        confidence: 0.95,
      };
    }

    // Wrapped templates (timelock/hashlock) - keep recursion shallow to avoid edge-cases.
    if (depth < 2 && opcodes.length >= 4 && isPushOpcode(opcodes[0].opcode) && !!opcodes[0].dataHex) {
      // <lock> OP_CHECKLOCKTIMEVERIFY OP_DROP <...script>
      if (names[1] === "OP_CHECKLOCKTIMEVERIFY" && names[2] === "OP_DROP") {
        const inner = _detect(sliceHexFromOpIndex(3), depth + 1);
        if (inner.type !== "Unknown") {
          return {
            type: `${inner.type} (CLTV)`,
            details: { ...inner.details, lockValueHex: opcodes[0].dataHex, lockValueBytes: opcodes[0].pushSize },
            matchType: "heuristic",
            confidence: Math.min(inner.confidence || 0.8, 0.85),
          };
        }
      }

      // <sequence> OP_CHECKSEQUENCEVERIFY OP_DROP <...script>
      if (names[1] === "OP_CHECKSEQUENCEVERIFY" && names[2] === "OP_DROP") {
        const inner = _detect(sliceHexFromOpIndex(3), depth + 1);
        if (inner.type !== "Unknown") {
          return {
            type: `${inner.type} (CSV)`,
            details: {
              ...inner.details,
              sequenceValueHex: opcodes[0].dataHex,
              sequenceValueBytes: opcodes[0].pushSize,
            },
            matchType: "heuristic",
            confidence: Math.min(inner.confidence || 0.8, 0.85),
          };
        }
      }
    }

    // Hashlock wrapper: OP_SHA256 <32-byte hash> OP_EQUALVERIFY <...script>
    if (
      depth < 2 &&
      opcodes.length >= 4 &&
      names[0] === "OP_SHA256" &&
      opcodes[1]?.pushSize === 32 &&
      !!opcodes[1]?.dataHex
    ) {
      if (names[2] === "OP_EQUALVERIFY") {
        const inner = _detect(sliceHexFromOpIndex(3), depth + 1);
        if (inner.type !== "Unknown") {
          return {
            type: `${inner.type} (Hashlock)`,
            details: { ...inner.details, hashAlgo: "sha256", hash: opcodes[1].dataHex },
            matchType: "heuristic",
            confidence: Math.min(inner.confidence || 0.8, 0.82),
          };
        }
      }
    }

    // OP_RETURN / data carrier
    if (names[0] === "OP_RETURN") {
      const pushed = opcodes.filter((o) => !!o.dataHex);
      if (pushed.length > 0) {
        return {
          type: "Data Carrier",
          details: { bytes: pushed.reduce((n, o) => n + (o.pushSize || 0), 0) },
          matchType: "exact",
          confidence: 1,
        };
      }
      return { type: "OP_RETURN", details: {}, matchType: "exact", confidence: 1 };
    }

    // Hoosat pubkeyhash (address): OP_DUP OP_BLAKE2B PUSH(32) <32-byte> OP_EQUALVERIFY OP_CHECKSIG,
    // OP_CHECKSIGECDSA for ECDSA keys and OP_CHECKSIGMLDSA44 for ML-DSA-44 keys (HTND standard.go).
    if (
      names.length === 5 &&
      names[0] === "OP_DUP" &&
      names[1] === "OP_BLAKE2B" &&
      opcodes[2]?.pushSize === 32 &&
      !!opcodes[2]?.dataHex &&
      names[3] === "OP_EQUALVERIFY" &&
      Object.prototype.hasOwnProperty.call(CHECKSIG_FORMATS, names[4])
    ) {
      return {
        type: "P2PKH",
        details: {
          pubKeyHash: opcodes[2].dataHex,
          hashAlgo: "blake2b-256",
          format: CHECKSIG_FORMATS[names[4]],
        },
        matchType: "exact",
        confidence: 1,
      };
    }

    // Legacy Bitcoin-like P2PKH: OP_DUP OP_HASH160 PUSH(20) <20-byte> OP_EQUALVERIFY OP_CHECKSIG
    if (
      names.length === 5 &&
      names[0] === "OP_DUP" &&
      names[1] === "OP_HASH160" &&
      opcodes[2]?.pushSize === 20 &&
      !!opcodes[2]?.dataHex &&
      names[3] === "OP_EQUALVERIFY" &&
      names[4] === "OP_CHECKSIG"
    ) {
      return {
        type: "P2PKH",
        details: { pubKeyHash: opcodes[2].dataHex },
        matchType: "exact",
        confidence: 1,
      };
    }

    // Hoosat P2SH (HTND): OP_BLAKE2B PUSH(32) <32-byte scriptHash> OP_EQUAL
    if (
      names.length === 3 &&
      names[0] === "OP_BLAKE2B" &&
      opcodes[1]?.pushSize === 32 &&
      !!opcodes[1]?.dataHex &&
      names[2] === "OP_EQUAL"
    ) {
      return {
        type: "P2SH",
        details: {
          scriptHash: opcodes[1].dataHex,
          hashAlgo: "blake2b-256",
          format: "blake2b-32",
          scriptHashBytes: 32,
        },
        matchType: "exact",
        confidence: 1,
      };
    }

    // Legacy P2SH (Bitcoin-like): OP_HASH160 PUSH(20) <20-byte> OP_EQUAL
    if (
      names.length === 3 &&
      names[0] === "OP_HASH160" &&
      opcodes[1]?.pushSize === 20 &&
      !!opcodes[1]?.dataHex &&
      names[2] === "OP_EQUAL"
    ) {
      return {
        type: "P2SH",
        details: {
          scriptHash: opcodes[1].dataHex,
          hashAlgo: "hash160",
          format: "hash160-20",
          scriptHashBytes: 20,
        },
        matchType: "exact",
        confidence: 1,
      };
    }

    // P2PK: PUSH(32|33|65) <pubkey> OP_CHECKSIG / OP_CHECKSIGECDSA
    if (
      names.length === 2 &&
      opcodes[0]?.pushSize &&
      isScriptPubKeySize(opcodes[0].pushSize) &&
      !!opcodes[0]?.dataHex &&
      (names[1] === "OP_CHECKSIG" || names[1] === "OP_CHECKSIGECDSA")
    ) {
      return {
        type: "P2PK",
        details: { pubKey: opcodes[0].dataHex },
        matchType: "exact",
        confidence: 1,
      };
    }

    // Bare multisig: OP_m <pubkeys...> OP_n OP_CHECKMULTISIG
    if (
      names.length >= 4 &&
      isOpN(names[0]) &&
      names[names.length - 1] === "OP_CHECKMULTISIG" &&
      isOpN(names[names.length - 2])
    ) {
      const m = opNToInt(names[0]);
      const n = opNToInt(names[names.length - 2]);

      const pubkeyOps = opcodes.slice(1, -2);
      const pubkeys = pubkeyOps.filter((o) => !!o.dataHex && isScriptPubKeySize(o.pushSize)).map((o) => o.dataHex);

      if (m !== null && n !== null && pubkeys.length === pubkeyOps.length && pubkeys.length === n) {
        return {
          type: "P2MS",
          details: { m, n, format: `${m}-of-${n}`, pubkeys },
          matchType: "exact",
          confidence: 1,
        };
      }

      // Looks multisig-ish but not strict.
      return {
        type: "P2MS",
        details: { m, n, format: m && n ? `${m}-of-${n}` : undefined },
        matchType: "heuristic",
        confidence: 0.7,
      };
    }

    // ML-DSA-44 multisig redeem script (paid to through P2SH).
    const mldsaMultiSig = parseMldsa44MultiSig(opcodes);
    if (mldsaMultiSig) {
      return {
        type: "P2MS",
        details: { ...mldsaMultiSig, format: `${mldsaMultiSig.m}-of-${mldsaMultiSig.n} (ml-dsa-44)` },
        matchType: "exact",
        confidence: 1,
      };
    }

    // Signature script heuristics (useful for Inputs tab)
    // Typical P2PK sigScript: <sig>, a Schnorr/ECDSA signature or a 2421-byte
    // ML-DSA-44 one (2420 bytes + sighash type).
    // (We keep this heuristic narrow; many scripts are just pushes.)
    const isMldsaSig = (op) => op?.pushSize === MLDSA44_SIGNATURE_PUSH_SIZE;
    if (
      opcodes.length === 1 &&
      opcodes[0]?.dataHex &&
      ((opcodes[0]?.pushSize >= 60 && opcodes[0]?.pushSize <= 80) || isMldsaSig(opcodes[0]))
    ) {
      return {
        type: "P2PK Unlock",
        details: { signatureBytes: opcodes[0].pushSize, ...(isMldsaSig(opcodes[0]) ? { format: "ml-dsa-44" } : {}) },
        matchType: "heuristic",
        confidence: 0.6,
      };
    }

    // Typical P2PKH sigScript: <sig> <pubkey>; for ML-DSA-44 a 2421-byte
    // signature and a 1312-byte public key, each pushed with OP_PUSHDATA2.
    if (opcodes.length === 2 && opcodes[0]?.dataHex && opcodes[1]?.dataHex && isLikelyPubKeySize(opcodes[1].pushSize)) {
      const mldsa = isMldsaSig(opcodes[0]) && opcodes[1].pushSize === MLDSA44_PUBLIC_KEY_SIZE;
      return {
        type: "P2PKH Unlock",
        details: mldsa ? { format: "ml-dsa-44", signatureBytes: opcodes[0].pushSize } : {},
        matchType: "heuristic",
        confidence: 0.7,
      };
    }

    // Typical multisig (P2MS) unlock in a P2SH sigScript: OP_0 <sig>... <redeemScript>
    // If the redeemScript decodes as a bare multisig script, label it explicitly.
    // An ML-DSA-44 multisig unlock has no leading OP_0: per key, last key
    // first, <sig> <pubkey> OP_1 for a signer and OP_0 for a non-signer.
    if (opcodes.length >= 2) {
      const redeem = extractRedeemScript(hex);
      if (redeem && redeemLooksLikeScript(redeem)) {
        const redeemPat = _detect(redeem, depth + 1);
        const isMldsaMultiSig = redeemPat?.type === "P2MS" && Array.isArray(redeemPat.details?.pubKeyHashes);
        if (redeemPat?.type === "P2MS" && ((names[0] === "OP_0" && opcodes.length >= 3) || isMldsaMultiSig)) {
          return {
            type: "P2MS Unlock",
            details: { ...redeemPat.details, redeemScriptBytes: redeem.length / 2 },
            matchType: "heuristic",
            confidence: 0.8,
          };
        }
      }
    }

    // Likely P2SH sigScript: multiple pushes and last push is a *script* (not just a pubkey/hash).
    // Important: keep this heuristic strict, otherwise it will mislabel most scripts.
    if (opcodes.length >= 2) {
      const redeem = extractRedeemScript(hex);
      if (redeem && redeem.length >= 2 && redeemLooksLikeScript(redeem)) {
        return {
          type: "P2SH Unlock",
          details: { redeemScriptBytes: redeem.length / 2 },
          matchType: "heuristic",
          confidence: 0.75,
        };
      }
    }

    // Custom contract heuristic: control flow present
    if (names.some((n) => n === "OP_IF" || n === "OP_NOTIF" || n === "OP_ELSE" || n === "OP_ENDIF")) {
      return { type: "Custom Contract", details: {}, matchType: "heuristic", confidence: 0.6 };
    }

    return { type: "Unknown", details: {}, matchType: "unknown", confidence: 0.1 };
  };

  return _detect(scriptHex, 0);
};

export const _internal = {
  normalizeHex,
  hexToBytes,
  bytesToHex,
  opcodeName,
};
