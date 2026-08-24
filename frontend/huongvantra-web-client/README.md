# Cách chạy frontend
1) Mở Terminal (PowerShell) rồi vào thư mục dự án. Ví dụ:

```bash
cd C:\path\to\SEP490_G66_HuongVanTra-System\frontend\huongvantra-web-client
```

2) Kiểm tra máy đã có Node chưa:

```bash
node -v
npm -v
```

Nếu chưa có, tải và cài Node từ https://nodejs.org (chọn bản LTS).

3) Cài thư viện cần thiết:

```bash
npm install
```

4) Chạy ứng dụng (mở trình duyệt tới địa chỉ hiển thị, thường http://localhost:5173):

```bash
npm run dev
```

# Chạy E2E test (Playwright)

Bộ test E2E chặn toàn bộ request `/api/**` ở tầng network, nên **không cần bật backend/Docker**.
Playwright tự khởi động Vite dev server, tự tắt khi xong.

```bash
npm ci
npm run test:e2e
```

Lần đầu chạy sẽ tự tải browser Chromium (script `pretest:e2e`).

Xem report sau khi chạy (khi test fail sẽ có kèm screenshot, video và trace):

```bash
npm run test:e2e:report
```

Chạy ở chế độ giao diện để debug từng bước:

```bash
npm run test:e2e:ui
```

Các flow đang được phủ (`e2e/`):

| File | Flow |
| --- | --- |
| `login.spec.js` | Đăng nhập: chưa có phiên, validate form, sai mật khẩu, đăng nhập thành công |
| `product-rbac.spec.js` | Phân quyền trang Sản phẩm và trang phân quyền Admin |
| `sc05-shelf-replenishment.spec.js` | SC-05 Yêu cầu bổ sung Kệ Hàng: danh sách, empty state, quyền tạo, quyền xem |
| `pos.spec.js` | POS: mở màn hình, nút thanh toán, chặn tài khoản không có quyền |
| `notification.spec.js` | Thông báo: badge, dropdown, đánh dấu đã đọc hết, điều hướng theo link |



