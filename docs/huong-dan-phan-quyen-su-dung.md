# Hướng dẫn sử dụng — Đăng nhập & phân quyền HVTPOSIMS

Tài liệu cho người dùng vận hành cửa hàng 1 điểm (Admin, Quản lý, Thủ kho, Thu ngân, Kế toán).

---

## 1. Đăng nhập

1. Mở web app → trang **Đăng nhập**.
2. Nhập tài khoản / mật khẩu (môi trường demo thường dùng mật khẩu `123456`).
3. Hệ thống cấp **token** (phiên làm việc ~8 giờ). Hết hạn sẽ tự làm mới; nếu thất bại phải đăng nhập lại.
4. **Đổi mật khẩu:** chỉ đổi được **của chính mình** (Hồ sơ / Đổi mật khẩu). Admin/Quản lý **reset** mật khẩu nhân viên qua luồng quản trị (không đoán mật khẩu cũ của người khác).

> Sau khi Admin cập nhật quyền trên hệ thống, nhân viên cần **đăng xuất rồi đăng nhập lại** để nhận quyền mới trong token.

> Nếu trang **Hàng hóa / Sản phẩm theo NCC** báo lỗi sau khi cập nhật phân quyền: **đăng xuất → đăng nhập lại**. Các API catalog nội bộ vừa được chỉnh để vừa phục vụ service, vừa phục vụ user đã login.

---

## 2. Ai làm việc gì? (tóm tắt)

| Vai trò | Việc chính | Không làm |
|---------|------------|-----------|
| **Admin** | Quản lý tài khoản/role; **xem** đơn & kho & báo cáo đã gửi; duyệt **đổi giá bán**; **từ chối** queue trừ kho; xem Outbox | Bán POS/COD; xác nhận trừ kho; nhập/SX/điều chuyển như Thủ kho; gửi báo cáo cuối ngày |
| **Quản lý (Manager)** | Bán (nếu cần); duyệt phiếu nhập / YC kệ / SX / kiểm kê; nhân sự Sale–Thủ kho–Kế toán; xem báo cáo đã gửi | Xác nhận trừ kho (việc Thủ kho) |
| **Thủ kho (Warehouse)** | Nhập NCC, SX, điều chuyển, xác nhận trừ kho, gửi báo cáo cuối ngày (1 lần/ngày) | Duyệt giá bán; phân quyền hệ thống |
| **Sale quầy (SalePos)** | Bán POS, YC bổ sung kệ | Kho tổng, COD verify |
| **Sale COD (SaleCod)** | Bán/thu COD | Quầy POS thuần |
| **Kế toán** | Nhà cung cấp (ghi), giá vốn/giá bán (tạo yêu cầu đổi giá), xem tồn | Vận hành kho / duyệt trừ kho |

Chi tiết kỹ thuật: [authz-role-matrix.md](./authz-role-matrix.md).

---

## 3. Hướng dẫn theo vai trò

### 3.1 Admin

**Menu thường dùng**

- Hệ thống: Tài khoản, Phân quyền, Nhật ký…
- Hàng hóa / Nhập hàng: **xem** phiếu, lô, lệnh SX
- **Báo cáo đã gửi** (snapshot Thủ kho đã gửi)
- Đồng bộ tồn (Outbox) — nếu được cấp quyền
- Duyệt **đổi giá bán** khi Kế toán gửi yêu cầu

**Cách làm việc chuẩn**

1. Không đứng bán / không làm phiếu kho thay Thủ kho.
2. Khi có thông báo “Báo cáo cuối ngày kho” → mở link → xem snapshot (số liệu **không đổi** sau khi gửi).
3. Queue trừ kho: có thể **Từ chối**; **không** bấm Xác nhận (Thủ kho làm).
4. Nhân sự: chỉ gán/quản lý **Manager**; Manager gán Sale/Thủ kho/Kế toán.

### 3.2 Quản lý

1. Duyệt phiếu nhập NCC, YC bổ sung kệ, lệnh SX, kiểm kê khi đến lượt.
2. Theo dõi **Báo cáo đã gửi** từ Thủ kho.
3. Quản lý ca/nhân sự Sale–Thủ kho–Kế toán.
4. Có thể vào POS nếu được phân quyền bán.

### 3.3 Thủ kho

1. Làm việc kho trong ngày (nhập, SX, điều chuyển, trừ kho…).
2. Cuối ngày: **Báo cáo cuối ngày** → chọn ngày → **Gửi báo cáo** (mỗi ngày **một lần**).
3. Sau khi gửi: nút đổi thành trạng thái đã gửi; xem lại trong **Báo cáo đã gửi**.
4. Không spam gửi — hệ thống chặn lần 2 cùng ngày.

### 3.4 Thu ngân (SalePos / SaleCod)

1. Đăng nhập → POS / đơn theo kênh.
2. Có thể tạo **YC bổ sung kệ** khi thiếu hàng quầy.
3. Không vào Outbox / báo cáo kho vận hành.

### 3.5 Kế toán

1. Quản lý nhà cung cấp & sản phẩm theo NCC.
2. Tạo yêu cầu **đổi giá bán** → chờ Admin duyệt.
3. Xem tồn / giá vốn theo quyền được cấp.

---

## 4. Luồng báo cáo cuối ngày kho

```text
Thủ kho xem báo cáo live → Gửi (1 lần/ngày)
        ↓
Lưu snapshot + thông báo in-app tới Manager & Admin
        ↓
Manager/Admin mở thông báo hoặc menu "Báo cáo đã gửi"
        ↓
Xem chi tiết cố định + Xuất Excel từ snapshot
```

- **Live** = số liệu hiện tại (để Thủ kho làm việc).
- **Đã gửi** = bản chụp lúc gửi (để giám sát).

---

## 5. Bảo mật cần biết (ngắn)

| Mục | Ý nghĩa với người dùng |
|-----|-------------------------|
| Gateway bắt JWT | Mọi thao tác qua app đều cần đăng nhập (trừ login / webhook thanh toán). |
| Catalog nội bộ | Service gọi nhau bằng khóa bí mật — người dùng không gọi tay. |
| Outbox | Chỉ Admin / Quản lý / Thủ kho xem được màn đồng bộ tồn. |
| Đổi mật khẩu | Không đổi hộ người khác qua API; dùng reset đúng quyền. |

---

## 6. Tài khoản demo (nếu môi trường dev)

| User | Role | Gợi ý thử |
|------|------|-----------|
| `admin` | Admin | Menu Báo cáo đã gửi, phân quyền, duyệt giá |
| `manager01` | Manager | Duyệt phiếu, xem báo cáo đã gửi |
| `warehouse01` (nếu đã seed) | Warehouse | Gửi báo cáo cuối ngày |
| `sale01` | SalePos | POS |
| `sale_cod01` | SaleCod | COD |
| `accountant01` | Accountant | NCC / giá |

Mật khẩu demo thường: `123456` — **đổi ngay** trên môi trường thật.

---

## 7. Khi bị “Không có quyền”

1. Kiểm tra đúng vai trò (sidebar khác nhau theo role).
2. Đăng xuất / đăng nhập lại sau khi bị đổi quyền.
3. Admin: không thấy nút ghi kho là **đúng thiết kế** (giám sát, không vận hành).
4. Vẫn lỗi → gửi Admin: tài khoản, màn hình, thao tác, giờ lỗi.

---

## 8. Việc Admin cấu hình quyền (ngắn)

1. Vào **Phân quyền** / gán role cho user.
2. Permission quan trọng kho (tham khảo kỹ thuật):

| Permission | Ai thường có |
|------------|----------------|
| `VIEW_INVENTORY` | Admin, Manager, Warehouse, Accountant |
| `OPERATE_WAREHOUSE` | Warehouse |
| `APPROVE_INVENTORY` | Manager |
| `REJECT_STOCK_DEDUCT` | Manager, Admin |
| `SUBMIT_WAREHOUSE_REPORT` | Warehouse |
| `APPROVE_PRICE` | Admin |
| `MONITOR_OUTBOX` | Admin, Manager, Warehouse |
| `MANAGE_SUPPLIERS` / `MANAGE_COST` | Accountant |

Seed mặc định đã gán sẵn theo role; chỉ chỉnh khi nghiệp vụ cửa hàng đổi.
