# Hướng Dẫn Cài Đặt & Chạy Backend Node.js + MongoDB Atlas

Dự án Backend phục vụ Hệ thống Giám sát & Điều hòa Vi khí hậu (1 Phòng: Trong Nhà & Ngoài Trời).

---

## 1. Yêu cầu môi trường
- Máy tính đã cài đặt **Node.js** (Phiên bản v18 hoặc v20+). Tải tại: https://nodejs.org

---

## 2. Các bước khởi chạy Backend

### Bước 1: Cài đặt thư viện dependencies
Mở Terminal / Command Prompt tại thư mục `iot_backend_nodejs` và chạy:
```bash
npm install
```

### Bước 2: Cấu hình MongoDB Atlas
1. Truy cập [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) và đăng nhập (hoặc tạo tài khoản miễn phí).
2. Tạo 1 Cluster miễn phí (**M0 Free Tier**).
3. Vào mục **Database Access** -> Tạo 1 User (ví dụ: username `admin`, password `123456`).
4. Vào mục **Network Access** -> Chọn **Add IP Address** -> Chọn **Allow Access from Anywhere** (`0.0.0.0/0`) để có thể kết nối từ máy tính hoặc khi demo trên trường.
5. Vào Cluster -> Bấm **Connect** -> Chọn **Drivers (Node.js)** -> Sao chép chuỗi kết nối (Connection String).
6. Mở file `.env` (nếu chưa có thì đổi tên file `.env.example` thành `.env`), dán chuỗi kết nối vào biến `MONGODB_URI`:
```env
MONGODB_URI=mongodb+srv://admin:123456@cluster0.abcde.mongodb.net/iot_climate_db?retryWrites=true&w=majority
```

### Bước 3: Khởi động Server
Chạy lệnh:
```bash
npm start
```
(Hoặc chạy `npm run dev` nếu có cài nodemon).

Khi màn hình in ra:
```text
🚀 [Node.js Server] Đang chạy tại cổng http://localhost:5000
✅ [MongoDB Atlas] Kết nối Database thành công!
✅ [MQTT Broker] Đã kết nối thành công tới mqtt://broker.emqx.io:1883
📡 [MQTT Subscribe] Đã lắng nghe topic: hcmute/iot/climate/telemetry
```
Nghĩa là hệ thống Backend của bạn đã hoạt động hoàn hảo 100%!

---

## 3. Danh sách các cổng REST API cung cấp cho Web

| Phương thức | Đường dẫn API | Chức năng |
| :--- | :--- | :--- |
| **GET** | `/api/v1/health` | Kiểm tra tình trạng hoạt động của Server, MongoDB và MQTT |
| **GET** | `/api/v1/telemetry/latest` | Lấy bản ghi vi khí hậu (Trong/Ngoài) mới nhất |
| **GET** | `/api/v1/telemetry/history?limit=60` | Lấy 60 mốc dữ liệu lịch sử gần nhất phục vụ vẽ biểu đồ 1 giờ |
| **GET** | `/api/v1/telemetry/stats` | Thống kê giá trị Trung bình, Số lần có người trong 1 giờ qua |
| **POST** | `/api/v1/control` | Gửi lệnh điều khiển bật/tắt quạt, đèn từ Web qua Backend |
