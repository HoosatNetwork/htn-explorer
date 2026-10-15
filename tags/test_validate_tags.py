#!/usr/bin/env python3
"""Tests for validate_tags.py: python3 tags/test_validate_tags.py

Address vectors are HTND's own (util/address_test.go), so the checksum and
decoding are checked against the node's implementation, not against ourselves.
"""

import os
import sys
import unicodedata
import unittest

sys.dont_write_bytecode = True  # no __pycache__ next to the list
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import validate_tags as v  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))

# util/address_test.go: mainnet p2pk, mainnet ecdsa p2pk, mainnet p2sh 2.
P2PK = "hoosat:qr35ennsep3hxfe7lnz5ee7j5jgmkjswsn35ennsep3hxfe7ln35cta93d2lg"
P2PK_KEY = bytes.fromhex("e34cce70c86373273efcc54ce7d2a491bb4a0e84e34cce70c86373273efce34c")
P2PK_ECDSA = "hoosat:qyp0r5mcq4rd5grj3652ra09u5dcgwqq9ntuswp247nama5quyj40eq0f28wqsx"
P2PK_ECDSA_KEY = bytes.fromhex("02f1d3780546da20728ea8a1f5e5e51b8438002cd7c8382aafa7ddf680e12557e4")
P2SH = "hoosat:pr5vxqxg0xrwl2zvxlq9rxffqx00sm44kn5vxqxg0xrwl2zvxl5vxzxxv5dhk"
P2SH_HASH = bytes.fromhex("e8c300c87986efa84c37c0519929019ef86eb5b4e8c300c87986efa84c37e8c3")
TESTNET = "hoosattest:qputx94qseratdmjs0j395mq8u03er0x3l35ennsep3hxfe7ln35c67gazt36"
TRUNCATED = "hoosat:qr35ennsep3hxfe7lnz5ee7j5jgmkjswss74as46gx"  # "p2pk bad checksum"

# Two of the real list, sorted.
A1 = "hoosat:qp4ad2eh72xc8dtjjyz4llxzq9utn6k26uyl644xxw70wskdfl85zsqj9k4vz"
A2 = "hoosat:qzm5vg7uv66ze6mv8d32xhv50sxwhthkz9ly7049e87hr2rm7wr6zjxytztv7"


def csv(*rows, header="address,label"):
    return ("\n".join([header] + list(rows)) + "\n").encode("utf-8")


def messages(raw):
    return [m for _, m in v.validate_text(raw)[1]]


class Addresses(unittest.TestCase):
    def test_htnd_vectors_decode_to_htnd_bytes(self):
        self.assertEqual(v.decode_address(P2PK, "hoosat"), (0, P2PK_KEY))
        self.assertEqual(v.decode_address(P2PK_ECDSA, "hoosat"), (1, P2PK_ECDSA_KEY))
        self.assertEqual(v.decode_address(P2SH, "hoosat"), (8, P2SH_HASH))
        self.assertEqual(v.decode_address(TESTNET, "hoosattest")[0], 0)

    def test_encode_round_trip(self):
        self.assertEqual(v.encode_address("hoosat", 0, P2PK_KEY), P2PK)
        self.assertEqual(v.encode_address("hoosat", 8, P2SH_HASH), P2SH)

    def assertRejected(self, address, reason):
        with self.assertRaises(ValueError) as cm:
            v.decode_address(address, "hoosat")
        self.assertIn(reason, str(cm.exception))

    def test_rejects(self):
        self.assertRejected(A1[:-1] + "q", "checksum is wrong")
        self.assertRejected(TRUNCATED, "checksum is wrong")
        self.assertRejected(A1.upper(), "lower case")
        self.assertRejected(TESTNET, "prefix is 'hoosattest'")
        self.assertRejected(A1.split(":")[1], "no 'hoosat:' prefix")
        self.assertRejected(A1.replace("q", "b", 2), "outside the bech32 charset")
        self.assertRejected("hoosat:qqqq", "too short")
        self.assertRejected(A1 + " ", "outside printable ASCII")
        self.assertRejected(v.encode_address("hoosat", 5, P2PK_KEY), "version 5 is not a known")
        self.assertRejected(v.encode_address("hoosat", 0, P2PK_KEY[:20]), "needs a 32-byte payload")
        self.assertRejected(v.encode_address("hoosat", 1, P2PK_KEY), "needs a 33-byte payload")

    def test_rejects_non_canonical_padding(self):
        # Same bytes as P2PK, but the one padding bit set: HTND decodes it,
        # the explorer would never match it.
        values = [v.CHARSET_INDEX[c] for c in P2PK.split(":")[1][: -v.CHECKSUM_LENGTH]]
        values[-1] |= 1
        checksum = v._polymod("hoosat", values + [0] * 8) ^ 1
        values += [(checksum >> (5 * (7 - i))) & 31 for i in range(8)]
        odd = "hoosat:" + "".join(v.CHARSET[x] for x in values)
        self.assertNotEqual(odd, P2PK)
        self.assertRejected(odd, "not in canonical form")


class Labels(unittest.TestCase):
    def test_accepted(self):
        for label in ("Burn Address", "S.I.G", "Gate-S01-Reserve", "Gran Búho Verde", "M4P PPLNSBF5",
                      "O'Neil & Co (old)", "Pool #2 / main", "Łódź+Kraków", "x" * 40, "1st"):
            self.assertEqual(v.label_problems(label), [], label)

    def assertLabelRejected(self, label, reason):
        problems = v.label_problems(label)
        self.assertTrue(any(reason in p for p in problems), "%r: %s" % (label, problems))

    def test_rejected(self):
        self.assertLabelRejected("", "empty")
        self.assertLabelRejected("x" * 41, "41 characters long")
        self.assertLabelRejected("S.I.G ", "ends with a space")
        self.assertLabelRejected("M4P   ", "ends with a space")
        self.assertLabelRejected(" M4P", "start with a letter or a digit")
        self.assertLabelRejected("OWL  DICK", "two spaces")
        self.assertLabelRejected(unicodedata.normalize("NFD", "Gran Búho Verde"), "not Unicode NFC")
        self.assertLabelRejected("Сhargn", "U+0421")  # Cyrillic Es, looks like C
        self.assertLabelRejected("Xeggex \"Exit\"", "not allowed")
        self.assertLabelRejected("<b>bold</b>", "not allowed")
        self.assertLabelRejected("=HYPERLINK(1)", "start with a letter or a digit")
        self.assertLabelRejected("-1", "start with a letter or a digit")
        self.assertLabelRejected("Tab\there", "not allowed")
        self.assertLabelRejected("ｆｕｌｌ", "not allowed")


class Files(unittest.TestCase):
    def test_real_list_passes(self):
        with open(os.path.join(HERE, "address-tags.csv"), "rb") as f:
            rows, problems = v.validate_text(f.read())
        self.assertEqual(problems, [])
        self.assertEqual(len(rows), 16)

    def test_minimal_file_passes(self):
        self.assertEqual(messages(csv(A1 + ",Developer fee", A2 + ",Burn Address")), [])

    def assertFileRejected(self, raw, reason, line=None):
        problems = v.validate_text(raw)[1]
        hits = [(n, m) for n, m in problems if reason in m]
        self.assertTrue(hits, "%r not in %s" % (reason, problems))
        if line is not None:
            self.assertEqual(hits[0][0], line)

    def test_rejected(self):
        self.assertFileRejected(csv(A1 + ",A", A1 + ",B"), "already tagged on line 2", 3)
        self.assertFileRejected(csv(A1 + ",Burn address", A2 + ",Burn Address"), "label already used on line 2", 3)
        self.assertFileRejected(csv(A2 + ",B", A1 + ",A"), "not sorted", 3)
        self.assertFileRejected(csv(A1 + ",Xeggex, Exit"), "exactly one comma", 2)
        self.assertFileRejected(csv(A1 + ",A", header="addr,label"), "first line must be exactly", 1)
        self.assertFileRejected(csv(A1 + ",A", "", A2 + ",B"), "empty line", 3)
        self.assertFileRejected(csv(A1 + ",A").replace(b"\n", b"\r\n"), "CRLF", 1)
        self.assertFileRejected(b"\xef\xbb\xbf" + csv(A1 + ",A"), "byte order mark")
        self.assertFileRejected(csv(A1 + ",A")[:-1], "no newline at the end", 2)
        latin1 = csv(A1 + ",Gran Búho").replace("ú".encode("utf-8"), b"\xfa")
        self.assertFileRejected(latin1, "not valid UTF-8", 2)
        self.assertFileRejected(csv(), "no rows")
        self.assertFileRejected(b"", "empty")
        self.assertFileRejected(b"x" * (v.MAX_FILE_BYTES + 1), "at most")
        self.assertFileRejected(csv(A1 + ",S.I.G "), "ends with a space", 2)
        self.assertFileRejected(csv(A1[:-1] + "q,A"), "checksum is wrong", 2)


if __name__ == "__main__":
    unittest.main()
