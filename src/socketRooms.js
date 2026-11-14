// socket.io gives a reconnected client a new session without rooms, so (re)join on every connect.
// Returns a function that removes the connect handler again.
export function joinRoomsOnConnect(socket) {
  const joinRooms = () => {
    socket.emit("last-blocks", ""); // the reply joins room "blocks"
    socket.emit("join-room", "bluescore");
  };
  socket.on("connect", joinRooms);
  if (socket.connected) joinRooms();
  return () => socket.off("connect", joinRooms);
}
