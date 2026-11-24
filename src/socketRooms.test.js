import { joinRoomsOnConnect } from "./socketRooms";

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

describe("joinRoomsOnConnect", () => {
  test("joins on the first connect and again on every reconnect", () => {
    const socket = fakeSocket(false); // effect ran before the first connect
    joinRoomsOnConnect(socket);
    expect(socket.emitted).toEqual([]);
    socket.fire("connect");
    expect(socket.emitted).toEqual(ROOMS);
    socket.fire("connect"); // reconnect after a server restart or network blip
    expect(socket.emitted).toEqual([...ROOMS, ...ROOMS]);
  });

  test("joins at once when the socket is already connected", () => {
    const socket = fakeSocket(true);
    joinRoomsOnConnect(socket);
    expect(socket.emitted).toEqual(ROOMS);
    socket.fire("connect");
    expect(socket.emitted).toEqual([...ROOMS, ...ROOMS]);
  });

  test("keeps one handler across remounts and removes it on cleanup", () => {
    const socket = fakeSocket(false);
    for (let mount = 0; mount < 3; mount++) {
      const stopRejoining = joinRoomsOnConnect(socket);
      expect(socket.listeners("connect")).toBe(1);
      for (let i = 0; i < 4; i++) socket.fire("connect");
      stopRejoining();
      expect(socket.listeners("connect")).toBe(0);
      socket.fire("connect");
    }
    expect(socket.emitted).toHaveLength(3 * 4 * ROOMS.length);
  });
});
