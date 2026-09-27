// CORS_ORIGIN: danh sách domain được phép, cách nhau bằng dấu phẩy.
// Ví dụ: https://iot.example.com,https://www.example.com
// Bỏ trống hoặc "*" = cho phép mọi nguồn (phù hợp lúc phát triển).
const getAllowedOrigins = () => {
  const raw = (process.env.CORS_ORIGIN || '*').trim();
  if (raw === '*') return '*';
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
};

module.exports = { getAllowedOrigins };
