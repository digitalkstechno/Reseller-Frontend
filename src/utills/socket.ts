import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = (userId: string): Socket => {
  if (!socket) {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || (typeof window !== "undefined" ? window.location.origin : "");
    socket = io(socketUrl, {
      transports: ["websocket"],
    });
  }
  socket.emit("joinRoom", userId);
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};