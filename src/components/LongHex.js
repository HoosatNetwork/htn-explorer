import { useState } from "react";
import CopyButton from "./CopyButton";

// Hex up to this many bytes is shown as it is.
export const LONG_HEX_MAX_BYTES = 256;
// A longer value shows this many characters from each end.
export const LONG_HEX_EDGE_CHARS = 64;

export const isLongHex = (hex) => typeof hex === "string" && hex.length > LONG_HEX_MAX_BYTES * 2;

// A hex string that may be very long: an ML-DSA-44 signature script is
// 3,739 bytes, i.e. 7,478 characters. Up to LONG_HEX_MAX_BYTES it renders as
// plain text; beyond that as head…tail (N bytes) with a Show full / Show less
// toggle and a copy button that always copies the whole value. Renders no
// wrapper of its own, so it takes the styling of the element it sits in.
// showCopy={false} leaves the copy button to a surrounding one.
const LongHex = ({ hex, showCopy = true }) => {
  const [expanded, setExpanded] = useState(false);
  const value = typeof hex === "string" ? hex : "";

  if (!isLongHex(value)) {
    return value;
  }

  const shown = expanded ? value : `${value.slice(0, LONG_HEX_EDGE_CHARS)}…${value.slice(-LONG_HEX_EDGE_CHARS)}`;
  const bytes = Math.floor(value.length / 2).toLocaleString("en-US");
  return (
    <>
      {shown}{" "}
      <span className="text-slate-500" style={{ whiteSpace: "nowrap" }}>
        ({bytes} bytes)
      </span>{" "}
      <span className="d-inline-flex align-items-center gap-1" style={{ whiteSpace: "nowrap" }}>
        <button
          type="button"
          className="bg-transparent border-0 p-0 text-hoosat-teal hover:text-teal-400 transition-colors"
          style={{ cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit" }}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : "Show full"}
        </button>
        {showCopy && <CopyButton text={value} />}
      </span>
    </>
  );
};

export default LongHex;
