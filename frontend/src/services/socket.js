import { io } from 'socket.io-client';

const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || `http://${hostname}:5000`;

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  // Thử kết nối lại vô hạn: máy chủ bật lại lúc nào thì đèn "Máy Chủ" tự chuyển Online.
  reconnectionAttempts: Infinity,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 5000
});