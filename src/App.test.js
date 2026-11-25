import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

// App calls io() when it is imported, so the fake socket is built inside the mock factory.
jest.mock("socket.io-client", () => {
  const socket = {
    connected: false,
    handlers: {},
    on(event, fn) { (this.handlers[event] = this.handlers[event] || []).push(fn); },
    off(event, fn) { this.handlers[event] = fn ? (this.handlers[event] || []).filter((h) => h !== fn) : []; },
    emit() {},
    fire(event, data) { (this.handlers[event] || []).slice().forEach((fn) => fn(data)); },
  };
  const io = () => socket;
  io.socket = socket;
  return io;
});
const mockSocket = require("socket.io-client").socket;

// The catch-all route renders this probe, which shows the blocks App keeps in LastBlocksContext.
jest.mock("./components/NotFound", () => () => {
  const { blocks } = require("react").useContext(require("./components/LastBlocksContext").default);
  return <div data-testid="blocks">{blocks.map((b) => b.block_hash).join(",")}</div>;
});

const block = (n) => ({ block_hash: `h${n}`, blueScore: n });
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => block(from + i));
const shown = () => screen.getByTestId("blocks").textContent.split(",").filter(Boolean);

const realFetch = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn(() => Promise.reject(new Error("offline")));
});
afterEach(() => {
  global.fetch = realFetch;
});

test("a reconnect reply and a live block in one batch keep the blocks already shown", () => {
  render(
    <MemoryRouter initialEntries={["/probe"]}>
      <App />
    </MemoryRouter>
  );
  act(() => mockSocket.fire("last-blocks", range(1, 10))); // first connect: server cache of 10
  for (let n = 11; n <= 20; n++) act(() => mockSocket.fire("new-block", block(n)));
  expect(shown()).toHaveLength(20);

  // Reconnect: the cache (12-21, block 21 was missed while offline) and a new block arrive in the same render batch.
  act(() => {
    mockSocket.fire("last-blocks", range(12, 21));
    mockSocket.fire("new-block", block(22));
  });
  expect(shown()).toEqual(range(1, 22).map((b) => b.block_hash));

  act(() => mockSocket.fire("last-blocks", [])); // server restarted with an empty cache
  expect(shown()).toHaveLength(22);
});
