const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');

const connectDB = require('./config/db');
const { initSocket } = require('./sockets/socketHandler');
const { connectMQTT } = require('./config/mqtt');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app); 

// Middleware
app.use(cors());
app.use(express.json());

// 1. Kết nối MongoDB
connectDB();

// 2. Khởi tạo Socket.io
initSocket(server);

// 3. Kết nối HiveMQ Broker
connectMQTT();

// 4. Định tuyến REST API
app.use('/api/v1', apiRoutes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 [Node.js Server] Đang chạy tại http://localhost:${PORT}`);
});
