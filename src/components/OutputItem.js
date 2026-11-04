import React from 'react';
import { Link } from 'react-router-dom';
import { numberWithCommas } from '../helper';
import LongHex from './LongHex';
import './UtxoItem.scss';

const OutputItem = ({ txOutput }) => {
  const amount = txOutput.amount / 100000000;

  return (
    <div className="utxo-item bg-hoosat-slate/50 backdrop-blur-lg border border-slate-700 hover:border-hoosat-teal transition-all duration-300 p-4 mb-3">
      {/* Header */}
      <div className="utxo-header-section">
        {/* Main Info Row */}
        <div className="mb-0">
          <div className="row align-items-center g-3 text-left">
            {/* Address */}
            <div className="col-12 col-lg-6">
              <div className="text-slate-400 text-xs mb-1">ADDRESS</div>
              <Link
                to={`/addresses/${txOutput.script_public_key_address}`}
                className="text-hoosat-teal hover:text-teal-400 transition-colors font-mono text-sm"
                style={{ textDecoration: 'none', wordBreak: 'break-all' }}
              >
                {txOutput.script_public_key_address}
              </Link>
            </div>

            {/* Amount */}
            <div className="col-6 col-lg-3">
              <div className="text-slate-400 text-xs mb-1">AMOUNT</div>
              <span className="amount-positive font-semibold">
                +{numberWithCommas(amount)} HTN
              </span>
            </div>

            {/* Index */}
            <div className="col-6 col-lg-3">
              <div className="text-slate-400 text-xs mb-1">INDEX</div>
              <span className="text-slate-300 text-sm">
                {txOutput.index}
              </span>
            </div>

            {/* Script Public Key */}
            <div className="col-12 col-lg-9 mt-3">
              <div className="text-slate-400 text-xs mb-1">SCRIPT PUBLIC KEY</div>
              <div className="text-slate-300 font-mono" style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>
                <LongHex hex={txOutput.script_public_key} />
              </div>
            </div>

            {/* Script Public Key Type */}
            <div className="col-6 col-lg-3 mt-3">
              <div className="text-slate-400 text-xs mb-1">TYPE</div>
              <span className="text-slate-300 text-sm">
                {txOutput.script_public_key_type}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(OutputItem);
