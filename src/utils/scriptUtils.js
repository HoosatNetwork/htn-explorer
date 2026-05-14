// Utilities for parsing and analyzing Hoosat/Kaspa (Bitcoin-like) scripts.
//
// Primary exported helpers:
// - disassembleScript(hex) -> { opcodes: Array<Op>, asm: string }
// - extractRedeemScript(sigScriptHex) -> redeemScriptHex | null
// - detectScriptPattern(scriptHex) -> { type, details, matchType, confidence }

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

  // Flow
  0x61: "OP_NOP",
  0x63: "OP_IF",
  0x64: "OP_NOTIF",
  0x67: "OP_ELSE",
  0x68: "OP_ENDIF",
  0x69: "OP_VERIFY",
  0x6a: "OP_RETURN",

  // Stack
  0x75: "OP_DROP",
  0x76: "OP_DUP",

  // Crypto
  0xa6: "OP_RIPEMD160",
  0xa7: "OP_SHA1",
  0xa8: "OP_SHA256",
  0xa9: "OP_HASH160",
  0xaa: "OP_HASH256",
  0xac: "OP_CHECKSIG",
  0xad: "OP_CHECKSIGVERIFY",
  0xae: "OP_CHECKMULTISIG",
  0xaf: "OP_CHECKMULTISIGVERIFY",

  // Bit logic / comparisons
  0x87: "OP_EQUAL",
  0x88: "OP_EQUALVERIFY",
};

const opcodeName = (opcode) => {
  // Small push opcodes 0x01..0x4b are push-bytes.
  if (opcode >= 0x01 && opcode <= 0x4b) return `OP_PUSHBYTES_${opcode}`;
  // OP_1..OP_16
  if (opcode >= 0x51 && opcode <= 0x60) return `OP_${opcode - 0x50}`;
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
  if (!hex) return { opcodes: [], asm: "" };

  const bytes = hexToBytes(hex);
  /** @type {ScriptOp[]} */
  const ops = [];

  let i = 0;
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
        break;
      }
      const data = bytes.slice(i, i + pushSize);
      dataHex = bytesToHex(data);
      i += pushSize;
    }

    ops.push({ offset, opcode, name: opcodeName(opcode), pushSize, dataHex });
  }

  const asm = ops.map((op) => (op.dataHex ? `${op.name} ${op.dataHex}` : op.name)).join("\n");

  return { opcodes: ops, asm };
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

/**
 * Detect common script patterns. Returns a best-effort classification.
 *
 * matchType:
 * - exact: strict template match
 * - heuristic: likely match but not strict
 * - unknown: no confident match
 */
export const detectScriptPattern = (scriptHex) => {
  const hex = normalizeHex(scriptHex);
  if (!hex) {
    return { type: "Unknown", details: {}, matchType: "unknown", confidence: 0 };
  }

  const { opcodes } = disassembleScript(hex);
  const names = opcodes.map((o) => o.name);

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

  // P2PKH: OP_DUP OP_HASH160 PUSH(20) <20-byte> OP_EQUALVERIFY OP_CHECKSIG
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

  // P2SH: OP_HASH160 PUSH(20) <20-byte> OP_EQUAL
  if (
    names.length === 3 &&
    names[0] === "OP_HASH160" &&
    opcodes[1]?.pushSize === 20 &&
    !!opcodes[1]?.dataHex &&
    names[2] === "OP_EQUAL"
  ) {
    return {
      type: "P2SH",
      details: { scriptHash: opcodes[1].dataHex },
      matchType: "exact",
      confidence: 1,
    };
  }

  // P2PK: PUSH(33|65) <pubkey> OP_CHECKSIG
  if (
    names.length === 2 &&
    opcodes[0]?.pushSize &&
    (opcodes[0].pushSize === 33 || opcodes[0].pushSize === 65) &&
    !!opcodes[0]?.dataHex &&
    names[1] === "OP_CHECKSIG"
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
    const pubkeys = pubkeyOps
      .filter((o) => !!o.dataHex && (o.pushSize === 33 || o.pushSize === 65))
      .map((o) => o.dataHex);

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

  // Signature script heuristics (useful for Inputs tab)
  // Typical P2PKH sigScript: <sig> <pubkey>
  if (
    opcodes.length === 2 &&
    opcodes[0]?.dataHex &&
    opcodes[1]?.dataHex &&
    (opcodes[1].pushSize === 33 || opcodes[1].pushSize === 65)
  ) {
    return { type: "P2PKH Unlock", details: {}, matchType: "heuristic", confidence: 0.7 };
  }

  // Likely P2SH sigScript: multiple pushes and last push is redeem script
  if (opcodes.length >= 2) {
    const redeem = extractRedeemScript(hex);
    if (redeem && redeem.length >= 2) {
      return {
        type: "P2SH Unlock",
        details: { redeemScriptBytes: redeem.length / 2 },
        matchType: "heuristic",
        confidence: 0.6,
      };
    }
  }

  // Custom contract heuristic: control flow present
  if (names.some((n) => n === "OP_IF" || n === "OP_NOTIF" || n === "OP_ELSE" || n === "OP_ENDIF")) {
    return { type: "Custom Contract", details: {}, matchType: "heuristic", confidence: 0.6 };
  }

  return { type: "Unknown", details: {}, matchType: "unknown", confidence: 0.1 };
};

export const _internal = {
  normalizeHex,
  hexToBytes,
  bytesToHex,
  opcodeName,
};
