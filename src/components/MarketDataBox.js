import React, { useContext, useEffect, useState, useCallback } from "react";
import { HiCurrencyDollar } from "react-icons/hi";
import { IoMdTrendingDown, IoMdTrendingUp } from "react-icons/io";
import { numberWithCommas } from "../helper";
import { getCoinSupply, getBlockdagInfo } from "../htn-api-client";
import { minerShareAt } from "../devFee";
import PriceContext from "./PriceContext";
import { CardSkeleton } from "./SkeletonLoader";

const MarketDataBox = () => {
  const [circCoinsMData, setCircCoinsMData] = useState("-");
  const { price, marketData } = useContext(PriceContext);
  const [dailyYield, setDailyYield] = useState(0);
  const [dailyEmissions, setDailyEmissions] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const initBox = useCallback(async () => {
    try {
      const coin_supply = await getCoinSupply();
      const dag_info = await getBlockdagInfo();
      setCircCoinsMData(Math.round(parseFloat(coin_supply.circulatingSupply) / 100000000));
      // daily yield = (your hashrate / network hashrate) * block reward * (86400 / blocks per second)
      const blockReward = await getBlockReward();
      // The miner's part: the dev fee is paid only up to the v12 hard fork.
      const minerReward = blockReward * minerShareAt(dag_info.virtualDaaScore);
      setDailyYield((1 / ((dag_info.difficulty * 2) / 1000)) * minerReward * (86400 / 1));
      // Every coin the blocks mint, the dev fee's included.
      setDailyEmissions(blockReward * 86400 * 5);
    } finally {
      setIsLoading(false);
    }
  }, []);

  async function getBlockReward() {
    try {
      const response = await fetch(`${process.env.REACT_APP_API}/info/blockreward`);
      const data = await response.json();
      return data.blockreward;
    } catch (err) {
      return null;
    }
  }

  useEffect(() => {
    initBox();
  }, [initBox]);

  if (isLoading) {
    return <CardSkeleton />;
  }

  return (
      <div className="bg-hoosat-slate/50 backdrop-blur-lg p-8 rounded-2xl border border-slate-700 hover:border-hoosat-teal transition-all duration-300 hover:shadow-xl hover:shadow-hoosat-teal/20 h-full w-full">
        {/* Icon and Title */}
        <div className="flex items-center gap-4 mb-6">
          <div className="bg-gradient-to-br from-hoosat-teal/20 to-cyan-400/20 w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0">
            <HiCurrencyDollar className="text-3xl text-hoosat-teal" />
          </div>
          <h3 className="text-2xl font-bold text-white">Market Data</h3>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">MCAP</span>
            <span className="text-white font-semibold">$ {(circCoinsMData * price).toFixed(2)}</span>
          </div>

          <div className="flex justify-between items-start">
            <span className="text-slate-400">Price</span>
            <div className="text-right">
              <div className="text-white font-semibold">$ {price} / HTN</div>
              <div className="flex gap-3 mt-2 text-xs">
                <span className="flex items-center gap-1">
                  {marketData?.price_change_percentage_24h > 0 ? (
                    <IoMdTrendingUp color="#398851" size={12} />
                  ) : (
                    <IoMdTrendingDown color="#d63328" size={12} />
                  )}
                  <span className={marketData?.price_change_percentage_24h > 0 ? "text-green-500" : "text-red-500"}>
                    {marketData?.price_change_percentage_24h?.toFixed(1)}% 24h
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  {marketData?.price_change_percentage_7d > 0 ? (
                    <IoMdTrendingUp color="#398851" size={12} />
                  ) : (
                    <IoMdTrendingDown color="#d63328" size={12} />
                  )}
                  <span className={marketData?.price_change_percentage_7d > 0 ? "text-green-500" : "text-red-500"}>
                    {marketData?.price_change_percentage_7d?.toFixed(1)}% 7d
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  {marketData?.price_change_percentage_30d > 0 ? (
                    <IoMdTrendingUp color="#398851" size={12} />
                  ) : (
                    <IoMdTrendingDown color="#d63328" size={12} />
                  )}
                  <span className={marketData?.price_change_percentage_30d > 0 ? "text-green-500" : "text-red-500"}>
                    {marketData?.price_change_percentage_30d?.toFixed(1)}% 30d
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400">Trade Volume</span>
            <span className="text-white font-semibold">$ {numberWithCommas(marketData?.total_volume?.usd.toFixed(2))}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400">Emissions</span>
            <span className="text-white font-semibold">$ {(dailyEmissions * price).toFixed(2)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400">Daily Yield (Kh)</span>
            <span className="text-white font-semibold">{dailyYield.toFixed(2)} HTN</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400">Daily Revenue (Kh)</span>
            <span className="text-white font-semibold">$ {(dailyYield * price).toFixed(6)}</span>
          </div>
        </div>
      </div>
  );
};

export default React.memo(MarketDataBox);
