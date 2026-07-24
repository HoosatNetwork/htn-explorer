import React, { useState, useEffect, useCallback } from "react";
import { Container, Pagination } from "react-bootstrap";
import { PieChart, pieChartDefaultProps } from "react-minimal-pie-chart";
import { useWindowSize } from "react-use";
import { useSearchParams } from "react-router-dom";
import { getCoinSupply } from "../htn-api-client";
import { TableSkeleton } from "./SkeletonLoader";
import AddressBalanceItem from "./AddressBalanceItem";
import EmptyTablePlaceholder from "./EmptyTablePlaceholder";

const shiftSize = 7;

const tags = new Map([
  ["hoosat:qzm5vg7uv66ze6mv8d32xhv50sxwhthkz9ly7049e87hr2rm7wr6zjxytztv7", "Burn Address"],
  ["hoosat:qp4ad2eh72xc8dtjjyz4llxzq9utn6k26uyl644xxw70wskdfl85zsqj9k4vz", "Developer fee"],
  ["hoosat:qpkcfshjeazmwex3t7x7qlctmhhratqauhkd5j254vfnmnuec7k6q4yzppn5q", "Xeggex Exit Scam Freezed"],
  ["hoosat:qzs4g22nvzl66lnt74wcy9lvu4kk4ka0w9hdhxyt5aem24r7q5v45wlqzxkwv", "Kenz"],
  ["hoosat:qqfyxz4lrve2y2wzr6zr4qusrtryln24fzd0hpqkwqrlx9qj2sedq92k4my7k", "Gran Búho Verde"],
  ["hoosat:qq96y2ew87phurzktjmttsmeh6eaymgndaatnsw7ze6pxf7xga3tuhzt9t8jv", "S.I.G "],
  ["hoosat:qr97kz9ujwylwxd8jkh9zs0nexlkkuu0v3aj0a6htvapan0a0arjugmlqf5ur", "Mutiq"],
  ["hoosat:qqdythqca8axcrvl7k0ep62yyzprcv8qw4xvlyvwnq7srx3angqrk92n74kut", "OWL DICK"],
  ["hoosat:qrhed37kge64z6agkq82l7xce423ugdf308ehtsh72y2nee7x2kvzxv6xqwd4", "M4P PPLNSBF5"],
  ["hoosat:qpuvlmta9s07znc3hf0j4jvuwkgxzus5aen7echhr4mg5y4naxcxyuhetmvq9", "M4P   "],
  ["hoosat:qrk3xclt5m27hw3w3hp7mvawg9pnvxskk8x5xt9jugg7alm09ltkvf4uueqgl", "Klein"],
  ["hoosat:qrkuugzna7jfm23cqsjd2ttmv9e07mvvn2luvrntswr5n7qthl7hccm7vkyh8", "Chargn"],
]);

const AddressesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [circCoins, setCircCoins] = useState(0);
  const [addresses, setAddresses] = useState([]);
  const [yAddresses, setYAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const [rowsPerPage] = useState(25); // You can change this number to set rows per page
  const [chartData, setChartData] = useState([]);
  const [holdingData, setHoldingData] = useState([]);
  const [totalPages, setTotalPages] = useState([]);
  const [startPage, setStartPage] = useState([]);
  const [endPage, setEndPage] = useState([]);
  const { width } = useWindowSize();

  // Set initial page parameter if not present
  useEffect(() => {
    if (!searchParams.has('page')) {
      setSearchParams({ page: '1' }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const calculateCharts = useCallback(
    (addresses) => {
      const holdingRanges = {
        "Top 10": 0,
        "Top 100": 0,
        "Top 1000": 0,
        "Top 10000": 0,
      };
      const balanceRanges = {
        "More than 10,000,000": 0,
        "More than 1,000,000": 0,
        "More than 100,000": 0,
        "More than 10,000": 0,
        "More than 1,000": 0,
        "Less than 1,000": 0,
      };
      addresses.forEach((address, index) => {
        const balance = parseFloat(address.balance);
        if (index <= 10) {
          holdingRanges["Top 10"] += balance;
        } else if (index > 10 && index <= 100) {
          holdingRanges["Top 100"] += balance;
        } else if (index > 100 && index <= 1000) {
          holdingRanges["Top 1000"] += balance;
        } else if (index > 1000 && index <= 10000) {
          holdingRanges["Top 10000"] += balance;
        }
      });
      const holdingPercentage = {
        "Top 10": (holdingRanges["Top 10"] / parseFloat(circCoins)) * 100,
        "Top 100": (holdingRanges["Top 100"] / parseFloat(circCoins)) * 100,
        "Top 1000": (holdingRanges["Top 1000"] / parseFloat(circCoins)) * 100,
        "Top 10000": (holdingRanges["Top 10000"] / parseFloat(circCoins)) * 100,
      };

      addresses.forEach((address) => {
        const balance = parseInt(address.balance);
        if (balance >= 10000000) {
          balanceRanges["More than 10,000,000"]++;
        } else if (balance >= 1000000 && balance < 10000000) {
          balanceRanges["More than 1,000,000"]++;
        } else if (balance >= 100000 && balance < 1000000) {
          balanceRanges["More than 100,000"]++;
        } else if (balance >= 10000 && balance < 100000) {
          balanceRanges["More than 10,000"]++;
        } else if (balance >= 1000 && balance < 10000) {
          balanceRanges["More than 1,000"]++;
        } else if (balance >= 1 && balance < 1000) {
          balanceRanges["Less than 1,000"]++;
        }
      });
      const colors = ["#FF5733", "#FFC300", "#33FF57", "#33AFFF", "#B233FF", "#FF3399"];
      const holdingData = [
        {
          title: "Top 10",
          value: holdingPercentage["Top 10"],
          color: colors[0],
        },
        {
          title: "Top 100",
          value: holdingPercentage["Top 100"],
          color: colors[1],
        },
        {
          title: "Top 1000",
          value: holdingPercentage["Top 1000"],
          color: colors[2],
        },
        {
          title: "Top 10000",
          value: holdingPercentage["Top 10000"],
          color: colors[3],
        },
      ];
      setHoldingData(holdingData);

      const chartData = [
        {
          title: "More than 10,000,000",
          value: balanceRanges["More than 10,000,000"],
          color: colors[0],
        },
        {
          title: "More than 1,000,000",
          value: balanceRanges["More than 1,000,000"],
          color: colors[1],
        },
        {
          title: "More than 100,000",
          value: balanceRanges["More than 100,000"],
          color: colors[2],
        },
        {
          title: "More than 10,000",
          value: balanceRanges["More than 10,000"],
          color: colors[3],
        },
        {
          title: "More than 1,000",
          value: balanceRanges["More than 1,000"],
          color: colors[4],
        },
        {
          title: "Less than 1,000",
          value: balanceRanges["Less than 1,000"],
          color: colors[5],
        },
      ];
      setChartData(chartData);
    },
    [circCoins]
  );

  useEffect(() => {
    if (yAddresses.length > 0) {
      calculateCharts(yAddresses);
    }
  }, [yAddresses, calculateCharts]);

  useEffect(() => {
    const fetchCircCoins = async () => {
      const coinSupplyResp = await getCoinSupply();
      setCircCoins(Math.round(coinSupplyResp.circulatingSupply / 100000000));
    };
    fetchCircCoins();
  }, []);

  useEffect(() => {
    const fetchAddressBalancesForPage = async () => {
      try {
        const response = await fetch(
          `https://api.network.hoosat.fi/addresses/balances/csv/paged?page=${currentPage}&items_per_page=${rowsPerPage}`
        );
        const data = await response.text();
        const rows = data.trim().split("\n").slice(1);
        const parsedAddresses = rows.map((row, index) => {
          const [address, balance] = row.split(",");
          return {
            index: index * currentPage,
            address,
            balance: parseFloat(balance) / 100000000,
          };
        });
        const yesterdayBalancesMap = new Map(yAddresses.map((item) => [item.address, item.balance]));
        const balanceChanges = parsedAddresses.map((address, index) => {
          const yesterdayBalance = yesterdayBalancesMap.get(address.address);
          const tag = tags.get(address.address);
          let change = yesterdayBalance !== undefined ? address.balance - yesterdayBalance : 0;
          return {
            index: (currentPage - 1) * rowsPerPage + index,
            address: address.address,
            balance: address.balance,
            change: change,
            tag: tag,
          };
        });
        setAddresses(balanceChanges);
        setLoading(false);
      } catch (error) {
        setLoading(false);
      }
    };
    fetchAddressBalancesForPage();
    const interval = setInterval(() => {
      fetchAddressBalancesForPage();
    }, 60000);
    return () => clearInterval(interval);
  }, [yAddresses, currentPage, rowsPerPage]);

  useEffect(() => {
    const addTagAddressesFromFile = async (tag) => {
      try {
        const response = await fetch(`https://network.hoosat.fi/downloads/tags/tags.csv`);
        const addressesResponse = await response.text();
        const addressesRows = addressesResponse.trim().split("\n");
        const parsedAddresses = addressesRows.map((row, _) => {
          return row.split(",");
        });
        parsedAddresses.forEach((address) => {
          tags.set(address[0].trim(), address[1].trim());
        });
      } catch (error) {
        // Error handling
      }
    };
    const fetchYesterdaysCSV = async () => {
      try {
        const responseYesterdays = await fetch("https://shitlist.hoosat.fi/balances-yesterday.csv");
        const dataYesterdays = await responseYesterdays.text();
        const rowsYesterdays = dataYesterdays.trim().split("\n").slice(1);
        const parsedYesterdays = rowsYesterdays.map((row, index) => {
          const [address, balance] = row.split(",");
          return { index, address, balance: parseFloat(balance) / 100000000 };
        });
        setYAddresses(parsedYesterdays);
        setTotalPages(Math.ceil(parsedYesterdays.length));
      } catch (error) {
        setLoading(false);
      }
    };
    addTagAddressesFromFile();
    fetchYesterdaysCSV();
  }, []);

  const handlePageChange = (pageNumber) => {
    setSearchParams({ page: pageNumber.toString() }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    let startPage = Math.max(1, currentPage - 4);
    let endPage = Math.min(startPage + 9, totalPages);
    if (endPage === totalPages) {
      startPage = Math.max(1, endPage - 9);
    }
    setStartPage(startPage);
    setEndPage(endPage);
  }, [totalPages, currentPage]);

  return (
    <div className="blocks-page">
      <Container className="webpage px-md-5 blocks-page-overview" fluid>
        <div className="block-overview mb-4">
          <div className="d-flex flex-row align-items-center justify-content-between w-100 mb-3 mt-3">
            <h4 className="block-overview-header mb-0 pb-0 d-flex align-items-center gap-2">
              Addresses and Balances
            </h4>
            {!loading && (
              <Pagination size="sm">
                <Pagination.First onClick={() => handlePageChange(1)} disabled={currentPage === 1} />
                <Pagination.Prev onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} />
                {[...Array(Math.min(5, endPage - startPage + 1))].map((_, i) => {
                  const pageNum = startPage + Math.floor((endPage - startPage) / 4) * i;
                  return (
                    <Pagination.Item
                      key={pageNum}
                      active={pageNum === currentPage}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </Pagination.Item>
                  );
                })}
                <Pagination.Next
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                />
                <Pagination.Last
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                />
              </Pagination>
            )}
          </div>
          {loading ? (
            <TableSkeleton lines={25} />
          ) : (
            <div className="w-100">
              {/* Table Header */}
              <div className="address-table-header d-flex align-items-center gap-3 px-3 py-2 mb-2">
                <div style={{ width: '80px', flexShrink: 0 }}>
                  <span className="text-slate-400 text-xs font-semibold">RANK</span>
                </div>
                <div style={{ width: '180px', flexShrink: 0 }}>
                  <span className="text-slate-400 text-xs font-semibold">BALANCE</span>
                </div>
                <div style={{ width: '140px', flexShrink: 0, textAlign: 'center' }}>
                  <span className="text-slate-400 text-xs font-semibold">24H CHANGE</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="text-slate-400 text-xs font-semibold">ADDRESS</span>
                </div>
                <div style={{ width: '180px', flexShrink: 0, textAlign: 'right' }}>
                  <span className="text-slate-400 text-xs font-semibold">LABEL</span>
                </div>
              </div>

              {/* Address Items or Empty State */}
              {addresses.length === 0 ? (
                <EmptyTablePlaceholder message="No addresses found" />
              ) : (
                addresses.map((address, index) => (
                  <AddressBalanceItem
                    key={index}
                    address={address.address}
                    rank={address.index}
                    balance={address.balance}
                    change={address.change}
                    tag={address.tag}
                  />
                ))
              )}
              <div className="d-flex justify-content-center mt-4">
                <Pagination>
                  <Pagination.First onClick={() => handlePageChange(1)} disabled={currentPage === 1} />
                  <Pagination.Prev onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} />
                  {[...Array(endPage - startPage + 1)].map((_, i) => (
                    <Pagination.Item
                      key={startPage + i}
                      active={startPage + i === currentPage}
                      onClick={() => handlePageChange(startPage + i)}
                    >
                      {startPage + i}
                    </Pagination.Item>
                  ))}
                  <Pagination.Next
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  />
                  <Pagination.Last
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                  />
                </Pagination>
              </div>
              <h4 className="block-overview-header text-center w-100 mt-4">Top addresses own HTN.</h4>
              <div className="d-flex justify-content-center mt-4">
                <PieChart
                  data={holdingData}
                  label={({ dataEntry }) => parseFloat(dataEntry.value).toFixed(2) + "% " + dataEntry.title}
                  lineWidth={10}
                  rounded
                  paddingAngle={15}
                  radius={pieChartDefaultProps.radius - shiftSize * 4}
                  segmentsShift={(index) => (index === 0 ? shiftSize : 0.5)}
                  labelStyle={(index) => ({
                    fill: holdingData[index].color,
                    fontSize: "5px",
                    fontFamily: "sans-serif",
                  })}
                  labelPosition={112}
                  style={{
                    maxHeight: width < 768 ? "150px" : "250px",
                    width: "100%",
                  }}
                  lengthAngle={-360}
                />
              </div>
              <h4 className="block-overview-header text-center w-100 mt-4">Addresses own more than HTN.</h4>
              <div className="d-flex justify-content-center mt-4">
                <PieChart
                  data={chartData}
                  label={({ dataEntry }) => parseFloat(dataEntry.percentage).toFixed(2) + "% " + dataEntry.title}
                  lineWidth={10}
                  rounded
                  paddingAngle={15}
                  radius={pieChartDefaultProps.radius - shiftSize * 4}
                  segmentsShift={(index) => (index === 0 ? shiftSize : 0.5)}
                  labelStyle={(index) => ({
                    fill: chartData[index].color,
                    fontSize: "5px",
                    fontFamily: "sans-serif",
                  })}
                  labelPosition={112}
                  style={{
                    maxHeight: width < 768 ? "150px" : "250px",
                    width: "100%",
                  }}
                  lengthAngle={-360}
                />
              </div>
              <div className="d-flex justify-content-center mt-4">
                <p style={{ fontSize: "8pt" }}>
                  The HTN pie chart above illustrates the distribution of addresses based on their balance thresholds.
                  For instance, addresses holding 15,000,000 HTN are categorized only under 'More than 10,000,000
                  HTN'. Conversely, the category 'Less than 1,000 HTN' excludes addresses with zero balance.
                </p>
                <p style={{ fontSize: "8pt" }}>
                  If you want to tag your address please feel free to open a ticket in discord or do a pull request in
                  Github.
                </p>
              </div>
              <div className="d-flex justify-content-center mt-4">
                <img src="/HTN-holder-rankings.webp" className="img-fluid" alt="Holder Rankings" />
              </div>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
};

export default AddressesPage;
