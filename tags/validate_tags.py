#!/usr/bin/env python3
"""Check a Hoosat explorer address-tags file (CSV, header "address,label").

Usage: validate_tags.py [--prefix PREFIX] FILE [FILE ...]

Exit status: 0 when every file passes, 1 when any rule fails, 2 when a file
cannot be read. Each problem is printed as "FILE:LINE: message" on stderr;
under GitHub Actions (GITHUB_ACTIONS=true) it is also printed as an ::error
annotation, so it shows on the pull request's diff.

Python 3.8+, standard library only. An explorer that syncs the list should
check it with its own copy of this file, never with one fetched together with
the list.

File rules:
  - UTF-8 without BOM, LF line endings, a newline after the last line,
    at most 256 KiB and 1000 rows, at least one row, no empty lines.
  - First line exactly "address,label", then one "address,label" per line,
    exactly one comma per line (labels may not contain commas or quotes, so
    the file is valid CSV with no quoting and also splits at the first comma,
    as the explorer UI does).
  - Rows sorted by address (byte order, as "sort" with LC_ALL=C), no address
    twice, no label twice (compared case-insensitively).

Address rules (HTND util/bech32 and util/address.go, v2.18.1):
  - lower case, prefix "hoosat" (mainnet; --prefix for another network),
    charset qpzry9x8gf2tvdw0s3jn54khce6mua7l, 8-character checksum over the
    prefix with HTND's generator, which must verify;
  - a known version byte with the payload length HTND accepts for it;
  - canonical: re-encoding the decoded bytes gives the same string (HTND
    drops non-zero padding bits silently, so a non-canonical spelling would
    decode but never match the address the explorer stores).

Label rules:
  - 1 to 40 characters (code points), Unicode NFC;
  - Latin letters (accented ones too), digits 0-9, space and . - _ ( ) & ' / + #;
  - starts with a letter or digit (no spreadsheet formula prefixes such as
    = + - @), no space at the end, no two spaces in a row.
"""

import argparse
import os
import sys
import unicodedata

CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
CHARSET_INDEX = {c: i for i, c in enumerate(CHARSET)}
GENERATOR = (0x98F2BC8E61, 0x79B76D99E2, 0xF33E5FB3C4, 0xAE2EABE2A8, 0x1E4F43E470)
CHECKSUM_LENGTH = 8
PREFIXES = ("hoosat", "hoosattest", "htndev", "hoosatsim")

# Address version byte -> payload length in bytes (None: any non-empty length).
PAYLOAD_LENGTHS = {
    0x00: 32,  # pay-to-pubkey, Schnorr
    0x01: 33,  # pay-to-pubkey, ECDSA
    0x02: 32,  # pay-to-pubkey-hash, Schnorr
    0x03: 32,  # pay-to-pubkey-hash, ECDSA
    0x04: 32,  # pay-to-pubkey-hash, ML-DSA-44
    0x08: 32,  # pay-to-script-hash
    0x09: None,  # pay-to-multisig, the raw script
    0x0A: 32,  # pay-to-multisig-hash
}

HEADER = "address,label"
MAX_FILE_BYTES = 256 * 1024
MAX_ROWS = 1000
MAX_LABEL_LENGTH = 40
LABEL_PUNCTUATION = frozenset(" .-_()&'/+#")
DIGITS = frozenset("0123456789")


def _polymod_step(checksum, value):
    top = checksum >> 35
    checksum = ((checksum & 0x07FFFFFFFF) << 5) ^ value
    for i in range(5):
        if (top >> i) & 1:
            checksum ^= GENERATOR[i]
    return checksum


def _polymod(prefix, values):
    checksum = 1
    for ch in prefix:
        checksum = _polymod_step(checksum, ord(ch) & 31)
    checksum = _polymod_step(checksum, 0)
    for value in values:
        checksum = _polymod_step(checksum, value)
    return checksum


def _convert_bits(data, from_bits, to_bits, pad):
    # Same regrouping as HTND's convertBits: without pad, leftover bits are dropped.
    result = []
    acc = 0
    filled = 0
    mask = (1 << to_bits) - 1
    for value in data:
        acc = (acc << from_bits) | value
        filled += from_bits
        while filled >= to_bits:
            filled -= to_bits
            result.append((acc >> filled) & mask)
        acc &= (1 << filled) - 1
    if pad and filled:
        result.append((acc << (to_bits - filled)) & mask)
    return result


def encode_address(prefix, version, payload):
    values = _convert_bits([version] + list(payload), 8, 5, True)
    checksum = _polymod(prefix, values + [0] * CHECKSUM_LENGTH) ^ 1
    values += [(checksum >> (5 * (CHECKSUM_LENGTH - 1 - i))) & 31 for i in range(CHECKSUM_LENGTH)]
    return prefix + ":" + "".join(CHARSET[v] for v in values)


def decode_address(address, expected_prefix):
    """Return (version, payload) or raise ValueError with the reason."""
    for ch in address:
        if not 33 <= ord(ch) <= 126:
            raise ValueError("address contains %r, outside printable ASCII" % ch)
    if address != address.lower():
        raise ValueError("address must be all lower case")
    prefix, colon, data = address.rpartition(":")
    if not colon:
        raise ValueError("address has no '%s:' prefix" % expected_prefix)
    if prefix != expected_prefix:
        raise ValueError("address prefix is '%s', expected '%s'" % (prefix, expected_prefix))
    bad = sorted(set(ch for ch in data if ch not in CHARSET_INDEX))
    if bad:
        raise ValueError("address contains characters outside the bech32 charset: %s" % " ".join(bad))
    if len(data) <= CHECKSUM_LENGTH:
        raise ValueError("address is too short")
    values = [CHARSET_INDEX[ch] for ch in data]
    if _polymod(prefix, values) != 1:
        raise ValueError("address checksum is wrong (typo, or a truncated address)")
    decoded = _convert_bits(values[:-CHECKSUM_LENGTH], 5, 8, False)
    if not decoded:
        raise ValueError("address has an empty payload")
    version, payload = decoded[0], decoded[1:]
    if version not in PAYLOAD_LENGTHS:
        raise ValueError("address version %d is not a known address type" % version)
    expected_length = PAYLOAD_LENGTHS[version]
    if expected_length is None:
        if not payload:
            raise ValueError("multisig address has an empty script")
    elif len(payload) != expected_length:
        raise ValueError(
            "address version %d needs a %d-byte payload, this one has %d bytes"
            % (version, expected_length, len(payload))
        )
    if encode_address(prefix, version, payload) != address:
        raise ValueError("address is not in canonical form (non-zero padding bits)")
    return version, bytes(payload)


def _label_char_ok(ch):
    if ch in LABEL_PUNCTUATION or ch in DIGITS:
        return True
    if not unicodedata.category(ch).startswith("L"):
        return False
    # Latin letters only, from the Latin blocks (no look-alikes such as
    # Cyrillic, small capitals or fullwidth forms).
    code = ord(ch)
    in_latin_block = code < 0x0250 or 0x1E00 <= code <= 0x1EFF
    return in_latin_block and unicodedata.name(ch, "").startswith("LATIN ")


def label_problems(label):
    if label == "":
        return ["label is empty"]
    problems = []
    if len(label) > MAX_LABEL_LENGTH:
        problems.append("label is %d characters long, at most %d allowed" % (len(label), MAX_LABEL_LENGTH))
    if unicodedata.normalize("NFC", label) != label:
        problems.append("label is not Unicode NFC (write an accented letter as one character, not letter + accent)")
    bad = sorted(set(ch for ch in label if not _label_char_ok(ch)))
    if bad:
        problems.append(
            "label contains characters that are not allowed: "
            + ", ".join("%r (U+%04X)" % (ch, ord(ch)) for ch in bad)
        )
    if not _label_char_ok(label[0]) or label[0] in LABEL_PUNCTUATION:
        problems.append("label must start with a letter or a digit")
    if label.endswith(" "):
        problems.append("label ends with a space")
    if "  " in label:
        problems.append("label contains two spaces in a row")
    return problems


def validate_text(raw, prefix=PREFIXES[0]):
    """Return (rows, problems): rows as [(address, label)], problems as [(line or None, message)]."""
    problems = []
    if len(raw) > MAX_FILE_BYTES:
        return [], [(None, "file is %d bytes, at most %d allowed" % (len(raw), MAX_FILE_BYTES))]
    if raw.startswith(b"\xef\xbb\xbf"):
        return [], [(1, "file starts with a UTF-8 byte order mark; save it without BOM")]
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as e:
        line = raw[: e.start].count(b"\n") + 1
        return [], [(line, "file is not valid UTF-8 (byte 0x%02x)" % raw[e.start])]
    if "\r" in text:
        line = text[: text.index("\r")].count("\n") + 1
        return [], [(line, "file has CR or CRLF line endings; save it with LF only")]
    if text == "":
        return [], [(None, "file is empty")]
    lines = text.split("\n")
    if lines[-1] == "":
        lines.pop()
    else:
        problems.append((len(lines), "last line has no newline at the end"))
    if lines[0] != HEADER:
        problems.append((1, "first line must be exactly %r, found %r" % (HEADER, lines[0])))

    rows = []
    seen_addresses = {}
    seen_labels = {}
    previous = None
    for number, line in enumerate(lines[1:], start=2):
        if line == "":
            problems.append((number, "empty line"))
            continue
        if line.count(",") != 1:
            problems.append(
                (number, "line must be address,label with exactly one comma; labels may not contain commas")
            )
            continue
        address, label = line.split(",")
        try:
            decode_address(address, prefix)
        except ValueError as e:
            problems.append((number, str(e)))
        for message in label_problems(label):
            problems.append((number, message))
        if address in seen_addresses:
            problems.append((number, "address already tagged on line %d" % seen_addresses[address]))
        else:
            seen_addresses[address] = number
        folded = label.casefold()
        if folded in seen_labels:
            problems.append((number, "label already used on line %d" % seen_labels[folded]))
        elif label:
            seen_labels[folded] = number
        if previous is not None and address.encode("utf-8") < previous[1].encode("utf-8"):
            problems.append((number, "rows are not sorted by address: this one belongs before line %d" % previous[0]))
        previous = (number, address)
        rows.append((address, label))

    if not rows and not problems:
        problems.append((None, "file has no rows"))
    if len(rows) > MAX_ROWS:
        problems.append((None, "file has %d rows, at most %d allowed" % (len(rows), MAX_ROWS)))
    return rows, problems


def _annotation_escape(value, is_property=False):
    value = value.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
    if is_property:
        value = value.replace(":", "%3A").replace(",", "%2C")
    return value


def main(argv=None):
    parser = argparse.ArgumentParser(description="Check a Hoosat explorer address-tags file.")
    parser.add_argument("--prefix", default=PREFIXES[0], choices=PREFIXES, help="address prefix (default: hoosat)")
    parser.add_argument("files", nargs="+", metavar="FILE")
    args = parser.parse_args(argv)

    github = os.environ.get("GITHUB_ACTIONS") == "true"
    status = 0
    for path in args.files:
        try:
            with open(path, "rb") as f:
                raw = f.read(MAX_FILE_BYTES + 1)
        except OSError as e:
            print("%s: cannot read: %s" % (path, e.strerror), file=sys.stderr)
            status = 2
            continue
        rows, problems = validate_text(raw, args.prefix)
        for line, message in problems:
            where = "%s:%d" % (path, line) if line else path
            print("%s: %s" % (where, message), file=sys.stderr)
            if github:
                props = "file=" + _annotation_escape(path, True)
                if line:
                    props += ",line=%d" % line
                print("::error %s::%s" % (props, _annotation_escape(message)))
        if problems:
            print("%s: FAILED, %d problem(s)" % (path, len(problems)), file=sys.stderr)
            status = max(status, 1)
        else:
            print("%s: OK, %d rows" % (path, len(rows)))
    return status


if __name__ == "__main__":
    sys.exit(main())
