// Plain-node check (no npm install; Node 24 like docker/Dockerfile): node --no-warnings scripts/check-socket-rooms.mjs
import assert from "node:assert/strict";
import { joinRoomsOnConnect } from "../src/socketRooms.js";

function fakeSocket(connected) {
  const handlers = {};
  return {
    connected,
    emitted: [],
    on(event, fn) { (handlers[event] = handlers[event] || []).push(fn); },
    off(event, fn) { handlers[event] = (handlers[event] || []).filter((h) => h !== fn); },
    emit(...args) { this.emitted.push(args.join(":")); },
    fire(event) { (handlers[event] || []).slice().forEach((fn) => fn()); },
    listeners(event) { return (handlers[event] || []).length; },
  };
}
const ROOMS = ["last-blocks:", "join-room:bluescore"];

const late = fakeSocket(false); // effect ran before the first connect
joinRoomsOnConnect(late);
assert.deepEqual(late.emitted, []);
late.fire("connect");
assert.deepEqual(late.emitted, ROOMS);
late.fire("connect"); // reconnect after a server restart or network blip
assert.deepEqual(late.emitted, [...ROOMS, ...ROOMS]);

const early = fakeSocket(true); // already connected when the effect ran
joinRoomsOnConnect(early);
assert.deepEqual(early.emitted, ROOMS);
early.fire("connect");
assert.deepEqual(early.emitted, [...ROOMS, ...ROOMS]);

// Mount, several reconnects, unmount, remount: always one handler, one join per connect, none after cleanup.
const tab = fakeSocket(false);
for (let mount = 0; mount < 3; mount++) {
  const leave = joinRoomsOnConnect(tab);
  assert.equal(tab.listeners("connect"), 1);
  for (let i = 0; i < 4; i++) tab.fire("connect");
  leave();
  assert.equal(tab.listeners("connect"), 0);
  tab.fire("connect");
}
assert.equal(tab.emitted.length, 3 * 4 * ROOMS.length);

console.log("ok: rooms joined on first connect, on reconnect, and when already connected; one handler across remounts, removed on cleanup");
