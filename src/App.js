import "bootstrap/dist/css/bootstrap.min.css";
import "font-awesome/css/font-awesome.min.css";
import { useEffect, useRef, useState } from "react";
import { Container, OverlayTrigger, Row, Col, Tooltip } from "react-bootstrap";
import { BiDonateHeart } from "react-icons/bi";
import { FaGithub } from "react-icons/fa";
import { SiFastapi } from "react-icons/si";
import { Link, Route, Routes } from "react-router-dom";
import "react-toggle/style.css";
import io from "socket.io-client";
import "./App.scss";
import AddressInfoPage from "./components/AddressInfo";
import BlockInfo from "./components/BlockInfo";
import BlocksPage from "./components/BlocksPage";
import BlueScoreContext from "./components/BlueScoreContext";
import LastBlocksContext from "./components/LastBlocksContext";
import NotFound from "./components/NotFound";
import PriceContext from "./components/PriceContext";
import TransactionInfo from "./components/TransactionInfo";
import TxPage from "./components/TxPage";
import Dashboard from "./Dashboard";
import AddressesPage from "./components/AddressesPage";
import Header from "./components/Header";
import { joinRoomsOnConnect } from "./socketRooms";

const buildVersion = process.env.REACT_APP_VERCEL_GIT_COMMIT_SHA || "0.1.0";

const socketAddress = process.env.REACT_APP_SOCKET;
const socket = io(socketAddress, {
  path: "/ws/socket.io",
});

function App() {
  const [price, setPrice] = useState("");
  const [marketData, setMarketData] = useState("");

  const [blocks, setBlocks] = useState([]);
  const [blueScore, setBlueScore] = useState(0);
  const [isConnected, setIsConnected] = useState();

  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const updatePrice = () => {
    fetch(`${process.env.REACT_APP_API}/info/market-data`, {
      headers: { "Cache-Control": "no-cache" },
    })
      .then((response) => response.json())
      .then((data) => {
        setPrice(data["current_price"]["usd"].toFixed(8));
        setMarketData(data);
      })
      .catch((r) => {});
  };

  useEffect(() => {
    updatePrice();

    const intervalPrice = setInterval(() => {
      updatePrice();
    }, 60000);

    // socketio
    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("last-blocks", (e) => {
      setBlocks(e);
      socket.emit("join-room", "blocks");
    });

    socket.on("bluescore", (e) => {
      setBlueScore(e.blueScore);
    });
    const leaveRooms = joinRoomsOnConnect(socket);

    socket.on("new-block", (d) => {
      setBlocks([...blocksRef.current, d].slice(-60));
    });

    return () => {
      clearInterval(intervalPrice);
      leaveRooms();
      socket.off("connect");
      socket.off("disconnect");
      socket.off("last-blocks");
      socket.off("bluescore");
      socket.off("new-block");
    };
  }, []);

  return (
    <LastBlocksContext.Provider value={{ blocks, isConnected }}>
      <PriceContext.Provider value={{ price, marketData }}>
        <BlueScoreContext.Provider value={{ blueScore }}>
          <div className="big-page">
            <Header price={price} isConnected={isConnected} />
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/blocks" element={<BlocksPage />} />
              <Route path="/blocks/:id" element={<BlockInfo />} />
              <Route path="/blocks/:id/:txview" element={<BlockInfo />} />
              <Route path="/addresses" element={<AddressesPage />} />
              <Route path="/addresses/:addr" element={<AddressInfoPage />} />
              <Route path="/txs" element={<TxPage />} />
              <Route path="/txs/:id" element={<TransactionInfo />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            {/* <div className="alpha">ALPHA VERSION</div> */}
          </div>
          <div className="text-light footerfull d-flex flex-row justify-content-center px-0" style={{
            backgroundColor: '#0F172A',
            borderTop: '1px solid #334155',
            backdropFilter: 'blur(12px)'
          }}>
            <Container className="footer webpage px-sm-5 py-4 text-center madewith" fluid>
              <Row className="d-none d-sm-block">
                <Col>
                  <div className="d-flex align-items-center justify-content-center gap-3 flex-wrap">
                    <span style={{ color: '#94a3b8' }}>
                      Made with{" "}
                      <font className="fs-5" style={{ color: '#14B8A6' }}>
                        ♥
                      </font>{" "}
                      by Kaspa developers & Hoosat Oy
                    </span>
                    <span className="d-flex align-items-center gap-2">
                      <OverlayTrigger placement="top" overlay={<Tooltip id="github">Source code</Tooltip>}>
                        <a
                          className="blockinfo-link"
                          href={process.env.REACT_APP_GITHUB}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: '#94a3b8',
                            transition: 'color 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.color = '#14B8A6'}
                          onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
                        >
                          <FaGithub size="1.3rem" />
                        </a>
                      </OverlayTrigger>
                      <OverlayTrigger placement="top" overlay={<Tooltip id="donate">Donation address</Tooltip>}>
                        <Link
                          className="blockinfo-link"
                          to="/addresses/hoosat:qq5gtjz7xhghcyauyhwmy9a696ym7nhaj857t32l25qqysyzz27lzy9esv046"
                          style={{
                            color: '#94a3b8',
                            transition: 'color 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.color = '#14B8A6'}
                          onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
                        >
                          <BiDonateHeart size="1.3rem" />
                        </Link>
                      </OverlayTrigger>
                      <OverlayTrigger placement="top" overlay={<Tooltip id="api">REST-API server</Tooltip>}>
                        <a
                          className="blockinfo-link"
                          href={process.env.REACT_APP_API}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: '#94a3b8',
                            transition: 'color 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.color = '#14B8A6'}
                          onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
                        >
                          <SiFastapi size="1.3rem" />
                        </a>
                      </OverlayTrigger>
                    </span>
                    <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                      Build: {buildVersion.substring(0, 8)}
                    </span>
                  </div>
                </Col>
              </Row>
              <Row className="d-sm-none px-0">
                <Col className="px-0">
                  <div style={{ color: '#94a3b8', marginBottom: '0.75rem' }}>
                    Made with{" "}
                    <font className="fs-5" style={{ color: '#14B8A6' }}>
                      ♥
                    </font>{" "}
                    by Kaspa developers & Hoosat Oy
                  </div>
                  <div className="d-flex justify-content-center gap-3 mb-2">
                    <a
                      className="blockinfo-link"
                      href={process.env.REACT_APP_GITHUB}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#94a3b8' }}
                    >
                      <FaGithub size="1.2rem" />
                    </a>
                    <Link
                      className="blockinfo-link"
                      to="/addresses/hoosat:qqkqkzjvr7zwxxmjxjkmxxdwju9kjs6e9u82uh59z07vgaks6gg62v8707g73"
                      style={{ color: '#94a3b8' }}
                    >
                      <BiDonateHeart size="1.2rem" />
                    </Link>
                    <a
                      className="blockinfo-link"
                      href={process.env.REACT_APP_API}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#94a3b8' }}
                    >
                      <SiFastapi size="1.2rem" />
                    </a>
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.875rem' }}>
                    Build: {buildVersion.substring(0, 8)}
                  </div>
                </Col>
              </Row>
            </Container>
          </div>
        </BlueScoreContext.Provider>
      </PriceContext.Provider>
    </LastBlocksContext.Provider>
  );
}

export default App;
