import React from 'react';
import { Link } from 'react-router-dom';
import { numberWithCommas } from '../helper';
import LongHex from './LongHex';
import './UtxoItem.scss';

const InputItem = ({
  txInput,
  additionalTxInfo,
  getOutputFromIndex
}) => {
  const cachedTx = additionalTxInfo && additionalTxInfo[txInput.previous_outpoint_hash];
  const amount = cachedTx
    ? getOutputFromIndex(cachedTx.outputs, txInput?.previous_outpoint_index)?.amount / 100000000
    : null;
  const address = cachedTx
    ? getOutputFromIndex(cachedTx.outputs, txInput?.previous_outpoint_index)?.script_public_key_address
    : null;

  return (
    <div className="utxo-item bg-hoosat-slate/50 backdrop-blur-lg border border-slate-700 hover:border-hoosat-teal transition-all duration-300 p-4 mb-3">
      {/* Header */}
      <div className="utxo-header-section">
        {/* Main Info Row */}
        <div className="mb-0">
          <div className="row align-items-center g-3 text-left">
            {/* Address */}
            {address && (
              <div className="col-12 col-lg-6">
                <div className="text-slate-400 text-xs mb-1">ADDRESS</div>
                <Link
                  to={`/addresses/${address}`}
                  className="text-hoosat-teal hover:text-teal-400 transition-colors font-mono text-sm"
                  style={{ textDecoration: 'none', wordBreak: 'break-all' }}
                >
                  {address}
                </Link>
              </div>
            )}

            {/* Amount */}
            {amount && (
              <div className="col-6 col-lg-3">
                <div className="text-slate-400 text-xs mb-1">AMOUNT</div>
                <span className="amount-negative font-semibold">
                  -{numberWithCommas(amount)} HTN
                </span>
              </div>
            )}

            {/* Index */}
            <div className="col-6 col-lg-3">
              <div className="text-slate-400 text-xs mb-1">INDEX</div>
              <span className="text-slate-300 text-sm">
                {txInput.previous_outpoint_index}
              </span>
            </div>

            {/* Previous Outpoint Hash */}
            <div className="col-12 col-lg-9 mt-3">
              <div className="text-slate-400 text-xs mb-1">PREVIOUS OUTPOINT HASH</div>
              <div className="text-slate-300 font-mono" style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>
                {txInput.previous_outpoint_hash}
              </div>
            </div>

            {/* Sig Op Count */}
            <div className="col-6 col-lg-3 mt-3">
              <div className="text-slate-400 text-xs mb-1">SIG OP COUNT</div>
              <span className="text-slate-300 text-sm">
                {txInput.sig_op_count}
              </span>
            </div>

            {/* Signature Script */}
            <div className="col-12 col-lg-12 mt-3">
              <div className="text-slate-400 text-xs mb-1">SIGNATURE SCRIPT</div>
              <div className="text-slate-300 font-mono" style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>
                <LongHex hex={txInput.signature_script} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(InputItem);
