import { faDiagramProject } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useEffect, useState, useCallback } from "react";
import { getBlockdagInfo, getInfo } from "../htn-api-client";
import { CardSkeleton } from "./SkeletonLoader";

const BPS = 5;

const BlockDAGBox = () => {
  const [nextHFDAAScore] = useState(123956218);
  const [showHF, setShowHF] = useState(false);
  const [blockCount, setBlockCount] = useState();
  const [difficulty, setDifficulty] = useState();
  const [headerCount, setHeaderCount] = useState("");
  const [virtualDaaScore, setVirtualDaaScore] = useState("");
  const [hashrate, setHashrate] = useState(0);
  const [nextHardForkTime, setNextHardForkTime] = useState("");
  const [nextHardForkTimeTo, setNextHardForkTimeTo] = useState("");
  const [mempoolSize, setMempoolSize] = useState();
  const [serverVersion, setServerVersion] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const updateBox = useCallback(async () => {
    try {
      const dag_info = await getBlockdagInfo();
      setBlockCount(dag_info.blockCount);
      setHeaderCount(dag_info.headerCount);
      setVirtualDaaScore(dag_info.virtualDaaScore);
      // Difficulty comes from node through the rest server.
      // We can estimate hashrate is two times difficulty.
      // We can also multiply the difficulty and hashrate with Block Per Second constant.
      // 1 Block per second does not even matter to the calculations, but 10 BPS would.
      // Kaspa has hidden difficulty from explorer frontend.
      // Kaspa API reports difficulty and it is 1:2 to estimated hashrate.
      setDifficulty(dag_info.difficulty * BPS);
      setHashrate(dag_info.difficulty * 2 * BPS);
      const info = await getInfo();
      setMempoolSize(info.mempoolSize);

      // Fetch server version from htnd endpoint
      try {
        const htndInfo = await fetch(`${process.env.REACT_APP_API}/info/htnd`);
        const htndData = await htndInfo.json();
        setServerVersion(htndData.serverVersion);
      } catch (err) {
        // Error handling
      }
      const unixTimestamp = Math.floor(Date.now() / 1000);
      const timeToFork = Math.trunc((nextHFDAAScore - dag_info.virtualDaaScore) / 5);
      // 2528964 = (123956218 - 111311398) / 5
      const hardForkTime = new Date((unixTimestamp + timeToFork) * 1000).toUTCString();
      if (timeToFork > 0) {
        const hours = Math.floor(timeToFork / 3600);
        const minutes = Math.floor((timeToFork % 3600) / 60);
        const seconds = timeToFork % 60;
        const formattedTimeToFork = `${hours}h ${minutes}m ${seconds}s`;
        setShowHF(true);
        setNextHardForkTime(hardForkTime);
        setNextHardForkTimeTo(formattedTimeToFork);
      } else {
        setShowHF(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [nextHFDAAScore]);

  useEffect(() => {
    updateBox();
    const updateInterval = setInterval(() => {
      updateBox();
    }, 30000);
    return () => {
      clearInterval(updateInterval);
    };
  }, [updateBox]);

  useEffect(() => {
    const updateInterval = setInterval(async () => {
      const info = await getInfo();
      setMempoolSize(info.mempoolSize);
    }, 1000);
    return async () => {
      clearInterval(updateInterval);
    };
  }, []);

  useEffect(
    (e) => {
      const element = document.getElementById("blockCount");
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
    },
    [blockCount]
  );

  useEffect(
    (e) => {
      const element = document.getElementById("headerCount");
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
    },
    [headerCount]
  );

  useEffect(
    (e) => {
      if (showHF === true) {
        const element = document.getElementById("virtualDaaScore");
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
      }
    },
    [virtualDaaScore, showHF]
  );

  useEffect(
    (e) => {
      const element = document.getElementById("hashrate");
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
    },
    [hashrate]
  );

  useEffect(
    (e) => {
      if (showHF === true) {
        const element = document.getElementById("nextHardForkTime");
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
      }
    },
    [nextHardForkTime, showHF]
  );

  const formatHashrate = (hashrate) => {
    if (typeof hashrate !== "number" || hashrate < 0) {
      return;
    }

    const units = ["H/s", "kH/s", "MH/s", "GH/s", "TH/s", "PH/s", "EH/s"];
    let index = 0;

    // Scale the hashrate to the appropriate unit
    while (hashrate >= 1000 && index < units.length - 1) {
      hashrate /= 1000;
      index++;
    }

    return `${hashrate.toFixed(2)} ${units[index]}`;
  };

  if (isLoading) {
    return <CardSkeleton />;
  }

  return (
    <div className="bg-hoosat-slate/50 backdrop-blur-lg p-8 rounded-2xl border border-slate-700 hover:border-hoosat-teal transition-all duration-300 hover:shadow-xl hover:shadow-hoosat-teal/20 h-full w-full">
      {/* Icon and Title */}
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-gradient-to-br from-hoosat-teal/20 to-cyan-400/20 w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0">
          <FontAwesomeIcon icon={faDiagramProject} className="text-3xl text-hoosat-teal" />
        </div>
        <h3 className="text-2xl font-bold text-white">Network Info</h3>
      </div>

      {/* Content */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Network name</span>
          <span className="text-white font-semibold">hoosat mainnet</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Virtual DAA Score</span>
          <span className="text-white font-semibold" id="virtualDaaScore">
            {Number(virtualDaaScore).toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Block height</span>
          <span className="text-white font-semibold" id="blockCount">
            {Number(blockCount).toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Difficulty</span>
          <span className="text-white font-semibold">{(Number(difficulty) / 1e9).toFixed(3)} G</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Hashrate</span>
          <span className="text-white font-semibold" id="hashrate">
            {formatHashrate(hashrate)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Mempool size</span>
          <span className="text-white font-semibold" id="headerCount">
            {Number(mempoolSize).toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Server version</span>
          <span className="text-white font-semibold">{serverVersion}</span>
        </div>

        {showHF === true && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 whitespace-nowrap">Hard Fork Date</span>
              <span className="text-white font-semibold text-right" id="nextHardForkTime">
                {nextHardForkTime}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Time to Fork</span>
              <span className="text-white font-semibold">{nextHardForkTimeTo}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(BlockDAGBox);
