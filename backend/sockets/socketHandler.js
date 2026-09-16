const { Server } = require('socket.io');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 [Socket.io] Web Client đã kết nối: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`❌ [Socket.io] Web Client ngắt kết nối: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io chưa được khởi tạo!');
  return io;
};

module.exports = { initSocket, getIO };
