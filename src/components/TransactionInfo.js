import moment from "moment";
import { useContext, useEffect, useRef, useState, useCallback } from "react";
import { Col, Container, Row, Spinner } from "react-bootstrap";
import { useParams } from "react-router";
import { Link } from "react-router-dom";
import { BiChevronDown, BiChevronUp } from "react-icons/bi";
import { getTransaction, getTransactions } from "../htn-api-client.js";
import BlueScoreContext from "./BlueScoreContext.js";
import CopyButton from "./CopyButton.js";
import { Tooltip } from "react-tooltip";
import InputItem from "./InputItem.js";
import OutputItem from "./OutputItem.js";
import EmptyTablePlaceholder from "./EmptyTablePlaceholder.js";

const getOutputFromIndex = (outputs, index) => {
  return outputs[index];
};

const TransactionInfo = () => {
  const { id } = useParams();
  const [txInfo, setTxInfo] = useState();
  const [additionalTxInfo, setAdditionalTxInfo] = useState();
  const [showTxFee, setShowTxFee] = useState(false);
  const [, setError] = useState(false);
  const [view, setView] = useState('outputs');
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);

  const retryCnt = useRef(0);
  const retryNotAccepted = useRef(6);
  const { blueScore } = useContext(BlueScoreContext);

  const handleViewSwitch = (newView) => {
    setView(newView);
  };

  const getTx = useCallback(
    () =>
      getTransaction(id)
        .then((res) => {
          setTxInfo(res);
        })
        .catch((err) => {
          setError(true);
          setTxInfo(undefined);
          throw err;
        }),
    [id]
  );
  useEffect(() => {
    setError(false);
    getTx();
  }, [id, getTx]);

  useEffect(() => {
    // request TX input addresses
    if (!!txInfo && txInfo?.detail !== "Transaction not found") {
      const txToQuery = txInfo.inputs?.flatMap((txInput) => txInput.previous_outpoint_hash).filter((x) => x);
      if (!!txToQuery) {
        getTransactions(txToQuery, true, true)
          .then((resp) => {
            setShowTxFee(txToQuery.length === resp.length);
            const respAsObj = resp.reduce((obj, cur) => {
              obj[cur["transaction_id"]] = cur;
              return obj;
            }, {});
            setAdditionalTxInfo(respAsObj);
          })
          .catch((err) => {});
      }
    }
    if (txInfo?.detail === "Transaction not found") {
      retryCnt.current += 1;
      if (retryCnt.current < 100) {
        setTimeout(getTx, 1000);
      }
    }

    const timeDiff = (Date.now() - (txInfo?.block_time || Date.now())) / 1000;

    if (txInfo?.is_accepted === false && timeDiff < 60 && retryNotAccepted.current > 0) {
      retryNotAccepted.current -= 1;
      setTimeout(getTx, 2000);
    }
  }, [txInfo, getTx]);

  return (
    <div className="blockinfo-page">
      <Container className="webpage" fluid >
        <Row>
          <Col xs={12}>
            <h2 className="text-white mb-4" style={{ fontSize: '2rem', fontWeight: '700' }}>Transaction Details</h2>
          </Col>
        </Row>

        <Row>
          <Col className="mx-0">
            {!!txInfo && txInfo?.detail !== "Transaction not found" ? (
              <>
                {/* Transaction Info Card */}
                <Row className="mb-4">
                  <Col xs={12}>
                    <div className="bg-hoosat-slate/50 backdrop-blur-lg p-8 rounded-2xl border border-slate-700 h-full w-full">
                      {/* Transaction ID and Subnetwork ID */}
                      <div className="mb-4">
                        <div className="d-flex align-items-start justify-content-between flex-wrap gap-3 mb-2">
                          <div className="flex-grow-1" style={{ minWidth: '0' }}>
                            {/* Tx ID */}
                            <div className="d-flex align-items-center gap-2 mb-2" style={{ fontSize: '0.95rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                              <span className="text-slate-200">Tx ID: {txInfo.transaction_id}</span>
                              <CopyButton text={txInfo.transaction_id} />
                            </div>

                            {/* Subnetwork ID */}
                            <div className="d-flex align-items-center gap-2" style={{ fontSize: '0.95rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                              <span className="text-slate-200">Subnetwork ID: {txInfo.subnetwork_id}</span>
                            </div>
                          </div>

                          {/* Badges - Desktop only */}
                          <div className="d-none d-md-flex align-items-center gap-2 flex-wrap">
                            {txInfo.is_accepted ? (
                              <div className="accepted-true">
                                <span data-tooltip-id="accepted-tooltip">accepted</span>
                                <Tooltip
                                  id="accepted-tooltip"
                                  place="top"
                                  style={{ zIndex: 1000, maxWidth: "250px", whiteSpace: "normal", wordWrap: "break-word" }}
                                  content="A transaction may appear as unaccepted for several reasons. First the transaction may be so new that it has not been accepted yet. Second, the explorer's database filler might have missed it while processing the virtual chain. Additionally, when parallel blocks with identical blue scores are created, only one reward transaction is accepted. In rare cases, a double-spend transaction may also be rejected."
                                />
                              </div>
                            ) : (
                              <div className="accepted-false">
                                <span data-tooltip-id="accepted-tooltip">not accepted</span>
                                <Tooltip
                                  id="accepted-tooltip"
                                  place="top"
                                  style={{ zIndex: 1000, maxWidth: "250px", whiteSpace: "normal", wordWrap: "break-word" }}
                                  content="A transaction may appear as unaccepted for several reasons. First the transaction may be so new that it has not been accepted yet. Second, the explorer's database filler might have missed it while processing the virtual chain. Additionally, when parallel blocks with identical blue scores are created, only one reward transaction is accepted. In rare cases, a double-spend transaction may also be rejected."
                                />
                              </div>
                            )}
                            {txInfo.is_accepted &&
                              blueScore !== 0 &&
                              blueScore - txInfo.accepting_block_blue_score < 86400 && (
                                <div className="confirmations">
                                  <span data-tooltip-id="confirmations-tooltip">
                                    {Math.max(blueScore - txInfo.accepting_block_blue_score, 0)}&nbsp;confirmations
                                  </span>
                                  <Tooltip
                                    id="confirmations-tooltip"
                                    place="top"
                                    style={{ zIndex: 1000, maxWidth: "250px", whiteSpace: "normal", wordWrap: "break-word" }}
                                    content="Confirmations indicate how many blocks have been added after the transaction was accepted. A higher number of confirmations increases the security of the transaction. Once the confirmation count reaches 86,400, the transaction is considered finalized and cannot be reversed. Confirmations are not required for HTN wallets, exchanges require confirmations for crediting deposits."
                                  />
                                </div>
                              )}
                            {txInfo.is_accepted &&
                              blueScore !== 0 &&
                              blueScore - txInfo.accepting_block_blue_score >= 86400 && (
                                <div className="confirmations">
                                  <span data-tooltip-id="confirmations-tooltip">confirmed</span>
                                  <Tooltip
                                    id="confirmations-tooltip"
                                    place="top"
                                    style={{ zIndex: 1000, maxWidth: "250px", whiteSpace: "normal", wordWrap: "break-word" }}
                                    content="Confirmations indicate how many blocks have been added after the transaction was accepted. A higher number of confirmations increases the security of the transaction. Once the confirmation count reaches 86,400, the transaction is considered finalized and cannot be reversed. Confirmations are not required for HTN wallets, exchanges require confirmations for crediting deposits."
                                  />
                                </div>
                              )}
                          </div>
                        </div>

                        {/* Badges - Mobile only */}
                        <div className="d-flex d-md-none align-items-center gap-2 flex-wrap mt-3">
                          {txInfo.is_accepted ? (
                            <div className="accepted-true">
                              <span data-tooltip-id="accepted-tooltip-mobile">accepted</span>
                              <Tooltip
                                id="accepted-tooltip-mobile"
                                place="top"
                                style={{ zIndex: 1000, maxWidth: "250px", whiteSpace: "normal", wordWrap: "break-word" }}
                                content="A transaction may appear as unaccepted for several reasons. First the transaction may be so new that it has not been accepted yet. Second, the explorer's database filler might have missed it while processing the virtual chain. Additionally, when parallel blocks with identical blue scores are created, only one reward transaction is accepted. In rare cases, a double-spend transaction may also be rejected."
                              />
                            </div>
                          ) : (
                            <div className="accepted-false">
                              <span data-tooltip-id="accepted-tooltip-mobile">not accepted</span>
                              <Tooltip
                                id="accepted-tooltip-mobile"
                                place="top"
                                style={{ zIndex: 1000, maxWidth: "250px", whiteSpace: "normal", wordWrap: "break-word" }}
                                content="A transaction may appear as unaccepted for several reasons. First the transaction may be so new that it has not been accepted yet. Second, the explorer's database filler might have missed it while processing the virtual chain. Additionally, when parallel blocks with identical blue scores are created, only one reward transaction is accepted. In rare cases, a double-spend transaction may also be rejected."
                              />
                            </div>
                          )}
                          {txInfo.is_accepted &&
                            blueScore !== 0 &&
                            blueScore - txInfo.accepting_block_blue_score < 86400 && (
                              <div className="confirmations">
                                <span data-tooltip-id="confirmations-tooltip-mobile">
                                  {Math.max(blueScore - txInfo.accepting_block_blue_score, 0)}&nbsp;confirmations
                                </span>
                                <Tooltip
                                  id="confirmations-tooltip-mobile"
                                  place="top"
                                  style={{ zIndex: 1000, maxWidth: "250px", whiteSpace: "normal", wordWrap: "break-word" }}
                                  content="Confirmations indicate how many blocks have been added after the transaction was accepted. A higher number of confirmations increases the security of the transaction. Once the confirmation count reaches 86,400, the transaction is considered finalized and cannot be reversed. Confirmations are not required for HTN wallets, exchanges require confirmations for crediting deposits."
                                />
                              </div>
                            )}
                          {txInfo.is_accepted &&
                            blueScore !== 0 &&
                            blueScore - txInfo.accepting_block_blue_score >= 86400 && (
                              <div className="confirmations">
                                <span data-tooltip-id="confirmations-tooltip-mobile">confirmed</span>
                                <Tooltip
                                  id="confirmations-tooltip-mobile"
                                  place="top"
                                  style={{ zIndex: 1000, maxWidth: "250px", whiteSpace: "normal", wordWrap: "break-word" }}
                                  content="Confirmations indicate how many blocks have been added after the transaction was accepted. A higher number of confirmations increases the security of the transaction. Once the confirmation count reaches 86,400, the transaction is considered finalized and cannot be reversed. Confirmations are not required for HTN wallets, exchanges require confirmations for crediting deposits."
                                />
                              </div>
                            )}
                        </div>
                      </div>

                      {/* Stats Cards */}
                      <Row className="g-3 mt-3 pt-3" style={{ borderTop: '1px solid #334155' }}>
                        <Col xs={12} sm={6} lg={4}>
                          <div className="bg-hoosat-slate/50 backdrop-blur-lg p-6 border border-slate-700 hover:border-hoosat-teal transition-all duration-300 hover:shadow-xl hover:shadow-hoosat-teal/20 h-100">
                            <div className="text-slate-400 mb-2" style={{ fontSize: '0.875rem' }}>Block Time</div>
                            <div className="text-white" style={{ fontSize: '1.15rem', fontWeight: '600' }}>
                              {moment(parseInt(txInfo.block_time)).format("YYYY-MM-DD HH:mm:ss")}
                            </div>
                          </div>
                        </Col>

                        <Col xs={12} sm={6} lg={4}>
                          <div className="bg-hoosat-slate/50 backdrop-blur-lg p-6 border border-slate-700 hover:border-hoosat-teal transition-all duration-300 hover:shadow-xl hover:shadow-hoosat-teal/20 h-100">
                            <div className="text-slate-400 mb-2" style={{ fontSize: '0.875rem' }}>Mass</div>
                            <div className="text-white" style={{ fontSize: '1.15rem', fontWeight: '600' }}>
                              {txInfo.mass ? txInfo.mass : "-"}
                            </div>
                          </div>
                        </Col>

                        {showTxFee && (
                          <Col xs={12} sm={6} lg={4}>
                            <div className="bg-hoosat-slate/50 backdrop-blur-lg p-6 border border-slate-700 hover:border-hoosat-teal transition-all duration-300 hover:shadow-xl hover:shadow-hoosat-teal/20 h-100">
                              <div className="text-slate-400 mb-2" style={{ fontSize: '0.875rem' }}>Transaction Fee</div>
                              <div className="text-white" style={{ fontSize: '1.15rem', fontWeight: '600' }}>
                                {txInfo && additionalTxInfo && (
                                  <>
                                    {(txInfo.inputs
                                      .map(
                                        (tx_input) =>
                                          getOutputFromIndex(
                                            additionalTxInfo[tx_input.previous_outpoint_hash]?.outputs || [],
                                            tx_input?.previous_outpoint_index
                                          )?.amount || 0
                                      )
                                      .reduce((a, b) => a + b) -
                                      (txInfo.outputs?.map((v) => v?.amount) || [0]).reduce((a, b) => a + b)) /
                                      100000000}{" "}
                                    HTN
                                  </>
                                )}
                              </div>
                            </div>
                          </Col>
                        )}
                      </Row>

                      {/* Show Additional Details Button */}
                      <div className="mt-4 pt-3" style={{ borderTop: '1px solid #334155' }}>
                        <button
                          onClick={() => setShowAdditionalDetails(!showAdditionalDetails)}
                          className="d-flex align-items-center gap-2 bg-transparent border-0 text-slate-400 hover:text-hoosat-teal transition-colors"
                          style={{ cursor: 'pointer', fontSize: '0.95rem', fontWeight: '500' }}
                        >
                          {showAdditionalDetails ? <BiChevronUp size={20} /> : <BiChevronDown size={20} />}
                          <span>{showAdditionalDetails ? 'Hide Additional Details' : 'Show Additional Details'}</span>
                        </button>

                        {/* Additional Details - Expandable */}
                        <div
                          style={{
                            maxHeight: showAdditionalDetails ? '5000px' : '0',
                            overflow: 'hidden',
                            transition: 'max-height 0.4s ease-in-out, opacity 0.3s ease-in-out',
                            opacity: showAdditionalDetails ? 1 : 0
                          }}
                        >
                          <div className="mt-4">
                            {/* Hash */}
                            <div className="row py-3" style={{ borderBottom: '1px solid #334155' }}>
                              <div className="col-12 col-md-3">
                                <div className="text-slate-400" style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                                  Hash
                                </div>
                              </div>
                              <div className="col-12 col-md-9">
                                <div className="text-slate-300 font-mono" style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>
                                  {txInfo.hash}
                                </div>
                              </div>
                            </div>

                            {/* Accepting Block Hash */}
                            <div className="row py-3" style={{ borderBottom: '1px solid #334155' }}>
                              <div className="col-12 col-md-3">
                                <div className="text-slate-400" style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                                  Accepting Block Hash
                                </div>
                              </div>
                              <div className="col-12 col-md-9">
                                <Link
                                  to={`/blocks/${txInfo.accepting_block_hash}`}
                                  className="text-hoosat-teal hover:text-teal-400 font-mono"
                                  style={{ fontSize: '0.85rem', wordBreak: 'break-all', textDecoration: 'none' }}
                                >
                                  {txInfo.accepting_block_hash || "-"}
                                </Link>
                              </div>
                            </div>

                            {/* Block Hashes */}
                            <div className="row py-3">
                              <div className="col-12 col-md-3">
                                <div className="text-slate-400" style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                                  Block Hashes ({txInfo.block_hash?.length || 0})
                                </div>
                              </div>
                              <div className="col-12 col-md-9">
                                <div className="d-flex flex-column gap-2">
                                  {txInfo.block_hash?.map((hash, idx) => (
                                    <Link
                                      key={idx}
                                      to={`/blocks/${hash}`}
                                      className="text-hoosat-teal hover:text-teal-400 font-mono"
                                      style={{ fontSize: '0.85rem', wordBreak: 'break-all', textDecoration: 'none' }}
                                    >
                                      {hash}
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Col>
                </Row>
              </>
            ) : (
              <Row className="mb-4">
                <Col xs={12}>
                  <div className="bg-hoosat-slate/50 backdrop-blur-lg p-8 rounded-2xl border border-slate-700 h-full w-full">
                    <div className="d-flex flex-column align-items-center justify-content-center text-center py-4">
                      <Spinner animation="border" variant="primary" className="mb-4" style={{ width: '3rem', height: '3rem' }} />
                      <h3 className="text-white mb-3" style={{ fontSize: '1.5rem', fontWeight: '600' }}>
                        Loading Transaction {retryCnt.current}/100
                      </h3>
                      <p className="text-slate-400 mb-0" style={{ fontSize: '1rem', maxWidth: '500px' }}>
                        Sometimes transactions need a few minutes to be added into the database. Please wait...
                      </p>
                    </div>
                  </div>
                </Col>
              </Row>
            )}
          </Col>
        </Row>

        {/* Tab Switcher */}
        {!!txInfo && txInfo?.detail !== "Transaction not found" && (
          <Container className="webpage" fluid>
            <Row>
              <Col className="d-flex flex-row justify-content-center">
                <div className="d-flex gap-2 p-1 rounded" style={{ backgroundColor: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155' }}>
                  <button
                    onClick={() => handleViewSwitch('outputs')}
                    className={`px-4 py-2 rounded transition-all ${
                      view === 'outputs'
                        ? 'bg-hoosat-teal text-white'
                        : 'bg-transparent text-slate-400 hover:text-hoosat-teal'
                    }`}
                    style={{
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: view === 'outputs' ? '600' : '400',
                      backgroundColor: view === 'outputs' ? '#14B8A6' : 'transparent',
                      color: view === 'outputs' ? 'white' : '#94a3b8',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (view !== 'outputs') {
                        e.target.style.color = '#14B8A6';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (view !== 'outputs') {
                        e.target.style.color = '#94a3b8';
                      }
                    }}
                  >
                    Outputs
                  </button>
                  <button
                    onClick={() => handleViewSwitch('inputs')}
                    className={`px-4 py-2 rounded transition-all ${
                      view === 'inputs'
                        ? 'bg-hoosat-teal text-white'
                        : 'bg-transparent text-slate-400 hover:text-hoosat-teal'
                    }`}
                    style={{
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: view === 'inputs' ? '600' : '400',
                      backgroundColor: view === 'inputs' ? '#14B8A6' : 'transparent',
                      color: view === 'inputs' ? 'white' : '#94a3b8',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (view !== 'inputs') {
                        e.target.style.color = '#14B8A6';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (view !== 'inputs') {
                        e.target.style.color = '#94a3b8';
                      }
                    }}
                  >
                    Inputs
                  </button>
                </div>
              </Col>
            </Row>
          </Container>
        )}

        {/* Inputs View */}
        {view === "inputs" && !!txInfo && txInfo?.detail !== "Transaction not found" && (
          <Row className="mt-4">
            <Col>
              <div className="bg-hoosat-slate/50 backdrop-blur-lg p-8 rounded-2xl border border-slate-700 h-full w-full">
                <Row className="mb-3 pb-3 align-items-center" style={{ borderBottom: '1px solid #334155' }}>
                  <Col xs={12} md={6} className="d-flex flex-row align-items-center mb-3 mb-md-0">
                    <h4 className="mb-0" style={{ color: '#14B8A6', fontWeight: '600' }}>Inputs ({txInfo.inputs?.length || 0})</h4>
                  </Col>
                </Row>
                {txInfo.inputs?.length > 0 ? (
                  (txInfo.inputs || []).map((tx_input, idx) => (
                    <InputItem
                      key={`${tx_input.previous_outpoint_hash}-${tx_input.previous_outpoint_index}`}
                      txInput={tx_input}
                      additionalTxInfo={additionalTxInfo}
                      getOutputFromIndex={getOutputFromIndex}
                    />
                  ))
                ) : (
                  <EmptyTablePlaceholder message="No inputs at this transaction" />
                )}
              </div>
            </Col>
          </Row>
        )}

        {/* Outputs View */}
        {view === "outputs" && !!txInfo && txInfo?.detail !== "Transaction not found" && (
          <Row className="mt-4">
            <Col>
              <div className="bg-hoosat-slate/50 backdrop-blur-lg p-8 rounded-2xl border border-slate-700 h-full w-full">
                <Row className="mb-3 pb-3 align-items-center" style={{ borderBottom: '1px solid #334155' }}>
                  <Col xs={12} md={6} className="d-flex flex-row align-items-center mb-3 mb-md-0">
                    <h4 className="mb-0" style={{ color: '#14B8A6', fontWeight: '600' }}>Outputs ({txInfo.outputs?.length || 0})</h4>
                  </Col>
                </Row>
                {(txInfo.outputs || []).map((tx_output, idx) => (
                  <OutputItem
                    key={`${tx_output.index}`}
                    txOutput={tx_output}
                  />
                ))}
              </div>
            </Col>
          </Row>
        )}
      </Container>
    </div>
  );
};

export default TransactionInfo;
