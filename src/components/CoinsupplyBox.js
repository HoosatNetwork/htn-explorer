import { faCoins } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import moment from "moment";
import React, { useCallback, useEffect, useState } from "react";
import { minerShareAt } from "../devFee";
import { getBlockdagInfo, getCoinSupply, getHalving } from "../htn-api-client";
import { numberWithCommas } from "../helper";
import { CardSkeleton } from "./SkeletonLoader";

const formatDuration = (milliseconds) => {
  const duration = moment.duration(milliseconds);
  const days = Math.floor(duration.asDays());
  const hours = duration.hours();
  const minutes = duration.minutes();

  if (days > 0) {
    return `in ${days} days, ${hours} hours`;
  } else if (hours > 0) {
    return `in ${hours} hours, ${minutes} minutes`;
  } else {
    return `in ${minutes} minutes`;
  }
};

const CBox = () => {
  const [circCoins, setCircCoins] = useState("-");
  const [halvingDate, setHalvingDate] = useState("-");
  const [timeToHalving, setTimeToHalving] = useState("-");
  const [blockReward, setBlockReward] = useState("-");
  const [halvingAmount, setHalvingAmount] = useState("-");
  const [isLoading, setIsLoading] = useState(true);

  const initBox = useCallback(() => {
    const fetchCoinSupply = async () => {
      try {
        const coinSupplyResp = await getCoinSupply();
        const dag_info = await getBlockdagInfo();
        getBlockReward(dag_info);

        getHalving().then((d) => {
          const currentTimestamp = Date.now();
          const halvingTimestamp = d.nextHalvingTimestamp * 1000;
          const timeDifference = halvingTimestamp - currentTimestamp;
          const timeToHalving = formatDuration(timeDifference);

          setHalvingDate(moment(halvingTimestamp).format("YYYY-MM-DD HH:mm"));
          setTimeToHalving(timeToHalving);
          // /info/halving does not say at which DAA score the reduction
          // happens. The next one (DAA score 299,919,264) and every later one
          // come after the v12 hard fork that ends the dev fee, so the miner
          // gets the whole amount.
          setHalvingAmount(Number(d.nextHalvingAmount).toFixed(2));
        });

        setCircCoins(Math.round(coinSupplyResp.circulatingSupply / 100000000));
      } finally {
        setIsLoading(false);
      }
    };
    fetchCoinSupply();
  }, []);

  useEffect(() => {
    initBox();

    const updateCircCoins = setInterval(async () => {
      const coinSupplyResp = await getCoinSupply();
      setCircCoins(Math.round(coinSupplyResp.circulatingSupply / 100000000));
    }, 10000);

    return async () => {
      clearInterval(updateCircCoins);
    };
  }, [initBox]);

  async function getBlockReward(dag_info) {
    await fetch(`${process.env.REACT_APP_API}/info/blockreward`)
      .then((response) => response.json())
      .then((d) => {
        // The miner's part: the dev fee is paid only up to the v12 hard fork.
        setBlockReward((d.blockreward * minerShareAt(dag_info.virtualDaaScore)).toFixed(2));
      })
      .catch((err) => {});
  }

  useEffect(() => {
    const element = document.getElementById("coins");
    if (element) {
      element.animate(
        [
          // keyframes
          { opacity: "1" },
          { opacity: "0.6" },
          { opacity: "1" },
        ],
        {
          // timing options
          duration: 300,
        }
      );
    }
  }, [circCoins]);

  if (isLoading) {
    return <CardSkeleton />;
  }

  return (
    <div className="bg-hoosat-slate/50 backdrop-blur-lg p-8 rounded-2xl border border-slate-700 hover:border-hoosat-teal transition-all duration-300 hover:shadow-xl hover:shadow-hoosat-teal/20 h-full w-full">
      {/* Icon and Title */}
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-gradient-to-br from-hoosat-teal/20 to-cyan-400/20 w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0">
          <FontAwesomeIcon icon={faCoins} className="text-3xl text-hoosat-teal" />
        </div>
        <h3 className="text-2xl font-bold text-white">Coin Supply</h3>
      </div>

      {/* Content */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Total</span>
          <span className="text-white font-semibold" id="coins">{numberWithCommas(circCoins)} HTN</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Max <span className="text-xs">(approx.)</span></span>
          <span className="text-white font-semibold">17,100,000,000 HTN</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Mined</span>
          <span className="text-white font-semibold">{((circCoins / 17100000000) * 100).toFixed(2)} %</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Block reward</span>
          <span className="text-white font-semibold">{blockReward} HTN</span>
        </div>

        <div className="flex justify-between items-start">
          <span className="text-slate-400">Reward reduction</span>
          <div className="text-right">
            <div className="text-white font-semibold">{halvingDate}</div>
            <div className="text-slate-400 text-sm mt-1">{timeToHalving}</div>
            <div className="text-hoosat-teal text-sm mt-1">to {halvingAmount} HTN</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(CBox);
