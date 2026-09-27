const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    console.warn('⚠️ [MongoDB] MONGODB_URI chưa được cấu hình.');
    return;
  }

  try {
    await mongoose.connect(mongoURI);
    console.log('✅ [MongoDB] Kết nối thành công.');

    mongoose.connection.on('error', (err) => {
      console.error('❌ [MongoDB Error]:', err.message);
    });
  } catch (error) {
    console.error('❌ [MongoDB] Kết nối thất bại:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
