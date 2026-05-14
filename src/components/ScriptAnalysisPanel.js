import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BiChevronDown, BiChevronUp } from "react-icons/bi";
import CopyButton from "./CopyButton";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

import { detectScriptPattern, disassembleScript, extractRedeemScript } from "../utils/scriptUtils";

const findOutputByIndex = (outputs, index) => {
  if (!Array.isArray(outputs)) return null;
  const direct = outputs[index];
  if (direct && direct.index === index) return direct;
  return outputs.find((o) => o && o.index === index) || null;
};

const PatternBadge = ({ pattern, role }) => {
  if (!pattern) return null;

  const label = `${pattern.type}${pattern.details?.format ? ` (${pattern.details.format})` : ""}`;
  const subtitle = pattern.matchType ? `${pattern.matchType} • ${Math.round((pattern.confidence || 0) * 100)}%` : null;

  const truncateHex = (hex, max = 18) => {
    if (!hex || typeof hex !== "string") return null;
    if (hex.length <= max) return hex;
    return `${hex.slice(0, Math.floor(max / 2))}…${hex.slice(-Math.floor(max / 2))}`;
  };

  const detailParts = [];
  if (pattern.details?.pubKeyHash) detailParts.push(`hash160=${truncateHex(pattern.details.pubKeyHash)}`);
  if (pattern.details?.scriptHash) detailParts.push(`hash160=${truncateHex(pattern.details.scriptHash)}`);
  if (pattern.details?.pubKey)
    detailParts.push(`pubkey(${(pattern.details.pubKey.length || 0) / 2}b)=${truncateHex(pattern.details.pubKey)}`);
  if (pattern.details?.bytes) detailParts.push(`${pattern.details.bytes} bytes`);
  if (pattern.details?.redeemScriptBytes) detailParts.push(`redeem=${pattern.details.redeemScriptBytes} bytes`);
  if (pattern.details?.signatureBytes) detailParts.push(`sig=${pattern.details.signatureBytes} bytes`);
  if (pattern.details?.m && pattern.details?.n) detailParts.push(`${pattern.details.m}-of-${pattern.details.n}`);

  return (
    <div className="d-flex flex-wrap align-items-center gap-2">
      {role && (
        <span className="badge rounded-pill bg-hoosat-slate/50 border border-slate-700 text-slate-400">{role}</span>
      )}
      <span className="badge rounded-pill bg-hoosat-slate/50 border border-slate-700 text-slate-200">{label}</span>
      {subtitle && (
        <span className="text-slate-400" style={{ fontSize: "0.8rem" }}>
          {subtitle}
        </span>
      )}
      {detailParts.length > 0 && (
        <span className="text-slate-500 font-mono" style={{ fontSize: "0.78rem", wordBreak: "break-all" }}>
          {detailParts.join(" • ")}
        </span>
      )}
    </div>
  );
};

const CodeBlock = ({ title, value, language = "text" }) => {
  if (!value) return null;
  return (
    <div className="mt-3">
      <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
        <div className="text-slate-400 text-xs" style={{ fontWeight: 600 }}>
          {title}
        </div>
        <CopyButton text={value} />
      </div>
      <div className="bg-hoosat-slate/50 border border-slate-700 rounded p-3" style={{ overflowX: "auto" }}>
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          customStyle={{ margin: 0, background: "transparent", fontSize: "0.85rem" }}
          wrapLongLines
          showLineNumbers={false}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

const DisassemblyView = ({ title, scriptHex }) => {
  const dis = useMemo(() => disassembleScript(scriptHex), [scriptHex]);
  if (!scriptHex) return null;

  return (
    <div className="mt-3">
      <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
        <div className="text-slate-400 text-xs" style={{ fontWeight: 600 }}>
          {title}
        </div>
        <CopyButton text={dis.asm || ""} />
      </div>

      {dis.isMalformed && (
        <div className="text-warning mb-2" style={{ fontSize: "0.82rem" }}>
          Warning: script parsing stopped early ({dis.error || "malformed push"}).
        </div>
      )}

      <div className="bg-hoosat-slate/50 border border-slate-700 rounded p-3" style={{ overflowX: "auto" }}>
        {dis.opcodes.length === 0 ? (
          <div className="text-slate-400" style={{ fontSize: "0.85rem" }}>
            No script data
          </div>
        ) : (
          <div className="d-flex flex-column gap-1">
            {dis.opcodes.map((op, idx) => (
              <div
                key={`${op.offset}-${idx}`}
                className="d-flex gap-3 font-mono"
                style={{ fontSize: "0.85rem", wordBreak: "break-all" }}
              >
                <span className="text-slate-500" style={{ minWidth: 64 }}>
                  {op.offset.toString(16).padStart(4, "0")}
                </span>
                <span className="text-hoosat-teal" style={{ minWidth: 160 }}>
                  {op.name}
                </span>
                {op.dataHex ? (
                  <span className="text-slate-300">{op.dataHex}</span>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const classifyPush = (pushOp, pushIndex, totalPushes) => {
  // Best-effort guess about what the pushed data represents.
  const size = pushOp.pushSize || 0;
  const hex = pushOp.dataHex || "";

  // Redeem script tends to be the last push in a P2SH unlock.
  if (pushIndex === totalPushes - 1) {
    const redeemDis = disassembleScript(hex);
    if (
      redeemDis.opcodes.some((o) => o.name === "OP_CHECKSIG" || o.name === "OP_CHECKMULTISIG" || o.name === "OP_IF")
    ) {
      return "redeemScript";
    }
  }

  if (size === 20) return "hash160";
  if (size === 32) return "pubkey/sha256";
  if (size === 33 || size === 65) return "pubkey";
  if (size >= 60 && size <= 80) return "signature";
  if (size === 0) return "empty";

  return "data";
};

const PushesView = ({ title, scriptHex }) => {
  const dis = useMemo(() => disassembleScript(scriptHex), [scriptHex]);
  const pushes = useMemo(() => dis.opcodes.filter((op) => !!op.dataHex), [dis.opcodes]);

  if (!scriptHex) return null;

  return (
    <div className="mt-3">
      <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
        <div className="text-slate-400 text-xs" style={{ fontWeight: 600 }}>
          {title}
        </div>
        <CopyButton
          text={pushes
            .map((p, idx) => `#${idx} ${classifyPush(p, idx, pushes.length)} (${p.pushSize || 0}b) ${p.dataHex}`)
            .join("\n")}
        />
      </div>

      {pushes.length === 0 ? (
        <div className="text-slate-400" style={{ fontSize: "0.85rem" }}>
          No pushed data items
        </div>
      ) : (
        <div className="bg-hoosat-slate/50 border border-slate-700 rounded p-3" style={{ overflowX: "auto" }}>
          <div className="d-flex flex-column gap-2">
            {pushes.map((p, idx) => {
              const kind = classifyPush(p, idx, pushes.length);
              return (
                <div key={`${p.offset}-${idx}`} className="d-flex justify-content-between gap-3 flex-wrap">
                  <div className="font-mono" style={{ fontSize: "0.85rem", wordBreak: "break-all" }}>
                    <span className="text-slate-500">#{idx}</span> <span className="text-hoosat-teal">{kind}</span>{" "}
                    <span className="text-slate-500">({p.pushSize || 0}b)</span>{" "}
                    <span className="text-slate-300">{p.dataHex}</span>
                  </div>
                  <div className="d-flex align-items-center">
                    <CopyButton text={p.dataHex || ""} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryStrip = ({ analysis }) => {
  if (!analysis) return null;
  const p2shInputs = analysis.inputs.filter(
    (i) => i.prevPattern?.type === "P2SH" || i.sigPattern?.type?.includes("P2SH"),
  ).length;
  const opReturnOutputs = analysis.outputs.filter(
    (o) => o.pattern?.type === "Data Carrier" || o.pattern?.type === "OP_RETURN",
  ).length;
  const multisig = analysis.outputs.filter((o) => o.pattern?.type === "P2MS").length;

  const pill = (text) => (
    <span className="badge rounded-pill bg-hoosat-slate/50 border border-slate-700 text-slate-200">{text}</span>
  );

  return (
    <div className="d-flex flex-wrap gap-2 mb-3">
      {pill(`Inputs: ${analysis.inputs.length}`)}
      {pill(`Outputs: ${analysis.outputs.length}`)}
      {pill(`Redeem Scripts: ${analysis.redeemScripts.length}`)}
      {pill(`P2SH Inputs: ${p2shInputs}`)}
      {pill(`OP_RETURN: ${opReturnOutputs}`)}
      {pill(`Multisig: ${multisig}`)}
    </div>
  );
};

const ScriptAnalysisPanel = ({ txInfo, additionalTxInfo, autoAnalyze = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("inputs");
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const canAnalyze = !!txInfo && txInfo?.detail !== "Transaction not found";

  const analyzeScripts = useCallback(() => {
    if (!canAnalyze) return;

    setIsAnalyzing(true);
    try {
      const inputs = (txInfo.inputs || []).map((inp, idx) => {
        const prevTx = additionalTxInfo && additionalTxInfo[inp.previous_outpoint_hash];
        const prevOut = prevTx ? findOutputByIndex(prevTx.outputs, inp.previous_outpoint_index) : null;

        const signatureScript = inp.signature_script || "";
        const prevScriptPubKey = prevOut?.script_public_key || "";

        const prevPattern = prevScriptPubKey ? detectScriptPattern(prevScriptPubKey) : null;
        const sigPattern = signatureScript ? detectScriptPattern(signatureScript) : null;

        const isP2sh = prevPattern?.type === "P2SH" || sigPattern?.type === "P2SH Unlock";
        const redeemScriptHex = isP2sh ? extractRedeemScript(signatureScript) : null;
        const redeemPattern = redeemScriptHex ? detectScriptPattern(redeemScriptHex) : null;

        return {
          idx,
          previousOutpointHash: inp.previous_outpoint_hash,
          previousOutpointIndex: inp.previous_outpoint_index,
          sigOpCount: inp.sig_op_count,
          signatureScript,
          prevScriptPubKey,
          prevPattern,
          sigPattern,
          redeemScriptHex,
          redeemPattern,
        };
      });

      const outputs = (txInfo.outputs || []).map((out) => {
        const scriptPubKey = out.script_public_key || "";
        return {
          index: out.index,
          address: out.script_public_key_address,
          typeFromApi: out.script_public_key_type,
          scriptPubKey,
          pattern: scriptPubKey ? detectScriptPattern(scriptPubKey) : null,
        };
      });

      const redeemScripts = inputs
        .filter((i) => !!i.redeemScriptHex)
        .map((i) => ({
          inputIndex: i.idx,
          redeemScriptHex: i.redeemScriptHex,
          pattern: i.redeemPattern,
        }));

      setAnalysis({ txid: txInfo.transaction_id, inputs, outputs, redeemScripts });
    } finally {
      setIsAnalyzing(false);
    }
  }, [additionalTxInfo, canAnalyze, txInfo]);

  const handleAnalyzeClick = useCallback(() => {
    analyzeScripts();
    setIsOpen(true);
  }, [analyzeScripts]);

  useEffect(() => {
    if (!autoAnalyze) return;
    if (!canAnalyze) return;

    // Auto-run once when txInfo arrives.
    // If analysis already computed for this tx id, keep it.
    if (analysis?.txid === txInfo.transaction_id) return;

    setAnalysis(null);
    // Defer slightly to keep UI responsive on initial render.
    setTimeout(() => analyzeScripts(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAnalyze, canAnalyze, txInfo?.transaction_id]);

  const tabButtonClass = (tab) =>
    `px-3 py-2 rounded transition-all ${
      activeTab === tab ? "bg-hoosat-teal text-white" : "bg-transparent text-slate-400 hover:text-hoosat-teal"
    }`;

  const renderInputs = () => {
    if (!analysis) return null;
    if (analysis.inputs.length === 0) {
      return <div className="text-slate-400">No inputs</div>;
    }

    return (
      <div className="d-flex flex-column gap-3">
        {analysis.inputs.map((inp) => (
          <div
            key={`${inp.previousOutpointHash}-${inp.previousOutpointIndex}`}
            className="bg-hoosat-slate/50 backdrop-blur-lg border border-slate-700 rounded p-4 text-start"
          >
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 text-start">
              <div>
                <div className="text-slate-200" style={{ fontWeight: 600 }}>
                  Input #{inp.idx}
                </div>
                <div className="text-slate-400 font-mono" style={{ fontSize: "0.85rem", wordBreak: "break-all" }}>
                  {inp.previousOutpointHash}:{inp.previousOutpointIndex}
                </div>
              </div>
              <div className="text-slate-400" style={{ fontSize: "0.85rem" }}>
                SigOps: {inp.sigOpCount}
              </div>
            </div>

            <div className="mt-3">
              <div className="text-slate-400 text-xs mb-2" style={{ fontWeight: 600 }}>
                Previous Output Script (spends)
              </div>
              <PatternBadge pattern={inp.prevPattern} role="Locking" />
              <CodeBlock title="scriptPubKey (hex)" value={inp.prevScriptPubKey} />
              <DisassemblyView title="scriptPubKey (disassembled)" scriptHex={inp.prevScriptPubKey} />
            </div>

            <div className="mt-3">
              <div className="text-slate-400 text-xs mb-2" style={{ fontWeight: 600 }}>
                signatureScript
              </div>
              <PatternBadge pattern={inp.sigPattern} role="Unlocking" />
              <CodeBlock title="signatureScript (hex)" value={inp.signatureScript} />
              <PushesView title="signatureScript (pushed data)" scriptHex={inp.signatureScript} />
              <DisassemblyView title="signatureScript (disassembled)" scriptHex={inp.signatureScript} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderOutputs = () => {
    if (!analysis) return null;
    if (analysis.outputs.length === 0) {
      return <div className="text-slate-400">No outputs</div>;
    }

    return (
      <div className="d-flex flex-column gap-3">
        {analysis.outputs.map((out) => (
          <div
            key={`out-${out.index}`}
            className="bg-hoosat-slate/50 backdrop-blur-lg border border-slate-700 rounded p-4 text-start"
          >
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 text-start">
              <div>
                <div className="text-slate-200" style={{ fontWeight: 600 }}>
                  Output #{out.index}
                </div>
                <div className="text-slate-400 font-mono" style={{ fontSize: "0.85rem", wordBreak: "break-all" }}>
                  {out.address}
                </div>
              </div>
              <div className="text-slate-400" style={{ fontSize: "0.85rem" }}>
                {out.typeFromApi}
              </div>
            </div>

            <div className="mt-3">
              <PatternBadge pattern={out.pattern} role="Locking" />
              <CodeBlock title="scriptPubKey (hex)" value={out.scriptPubKey} />
              <PushesView title="scriptPubKey (pushed data)" scriptHex={out.scriptPubKey} />
              <DisassemblyView title="scriptPubKey (disassembled)" scriptHex={out.scriptPubKey} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderRedeemScripts = () => {
    if (!analysis) return null;
    if (analysis.redeemScripts.length === 0) {
      return <div className="text-slate-400">No redeem scripts detected (no P2SH inputs found)</div>;
    }

    return (
      <div className="d-flex flex-column gap-3">
        {analysis.redeemScripts.map((rs) => (
          <div
            key={`redeem-${rs.inputIndex}`}
            className="bg-hoosat-slate/50 backdrop-blur-lg border border-slate-700 rounded p-4 text-start"
          >
            <div className="d-flex flex-column align-items-start gap-2 text-start">
              <div className="text-slate-200" style={{ fontWeight: 600 }}>
                Input #{rs.inputIndex}
              </div>
              <PatternBadge pattern={rs.pattern} role="Locking" />
            </div>

            <CodeBlock title="redeemScript (hex)" value={rs.redeemScriptHex} />
            <PushesView title="redeemScript (pushed data)" scriptHex={rs.redeemScriptHex} />
            <DisassemblyView title="redeemScript (decoded/disassembled)" scriptHex={rs.redeemScriptHex} />
          </div>
        ))}
      </div>
    );
  };

  const renderDisassembled = () => {
    if (!analysis) return null;

    // Provide a compact, copy-friendly ASM dump.
    const asmDump = [
      "# Inputs",
      ...analysis.inputs.flatMap((i) => {
        const sigAsm = disassembleScript(i.signatureScript).asm;
        const prevAsm = disassembleScript(i.prevScriptPubKey).asm;
        const redeemAsm = i.redeemScriptHex ? disassembleScript(i.redeemScriptHex).asm : "";

        return [
          `\n## Input ${i.idx}`,
          "\n- previousOutpointScriptPubKey:",
          prevAsm || "(empty)",
          "\n- signatureScript:",
          sigAsm || "(empty)",
          ...(redeemAsm ? ["\n- redeemScript:", redeemAsm] : []),
        ];
      }),
      "\n# Outputs",
      ...analysis.outputs.flatMap((o) => {
        const outAsm = disassembleScript(o.scriptPubKey).asm;
        return [`\n## Output ${o.index}`, outAsm || "(empty)"];
      }),
    ].join("\n");

    return (
      <div>
        <CodeBlock title="ASM Dump" value={asmDump} language="text" />
      </div>
    );
  };

  return (
    <div className="bg-hoosat-slate/50 backdrop-blur-lg p-6 rounded-2xl border border-slate-700 h-full w-full">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="d-flex align-items-center gap-2 bg-transparent border-0 text-slate-200"
          style={{ cursor: "pointer", fontWeight: 700 }}
        >
          {isOpen ? <BiChevronUp size={20} /> : <BiChevronDown size={20} />}
          <span>Script Analysis</span>
        </button>

        <button
          onClick={handleAnalyzeClick}
          disabled={!canAnalyze || isAnalyzing}
          className="btn btn-sm btn-outline-info"
        >
          {isAnalyzing ? "Analyzing…" : "Analyze Scripts"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="script-analysis-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div className="mt-4">
              <SummaryStrip analysis={analysis} />
              <div
                className="d-flex gap-2 p-1 rounded"
                style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", border: "1px solid #334155" }}
              >
                <button
                  onClick={() => setActiveTab("inputs")}
                  className={tabButtonClass("inputs")}
                  style={{ border: "none" }}
                >
                  Inputs
                </button>
                <button
                  onClick={() => setActiveTab("outputs")}
                  className={tabButtonClass("outputs")}
                  style={{ border: "none" }}
                >
                  Outputs
                </button>
                <button
                  onClick={() => setActiveTab("redeem")}
                  className={tabButtonClass("redeem")}
                  style={{ border: "none" }}
                >
                  Redeem Scripts
                </button>
                <button
                  onClick={() => setActiveTab("disassembled")}
                  className={tabButtonClass("disassembled")}
                  style={{ border: "none" }}
                >
                  Disassembled
                </button>
              </div>

              <div className="mt-4">
                {!analysis ? (
                  <div className="text-slate-400" style={{ fontSize: "0.95rem" }}>
                    Click "Analyze Scripts" to compute patterns and disassembly.
                  </div>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                    >
                      {activeTab === "inputs" && renderInputs()}
                      {activeTab === "outputs" && renderOutputs()}
                      {activeTab === "redeem" && renderRedeemScripts()}
                      {activeTab === "disassembled" && renderDisassembled()}
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ScriptAnalysisPanel;
