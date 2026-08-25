# QA-03 — Evidence Package & Release Gate

**Task:** QA-03 [P0] — Chạy Full Regression và đóng 8 UAT Failed cũ
**Owner:** HuyNQ
**Ngày chốt:** 2026-08-25
**Điều kiện tiên quyết:** Chỉ chạy sau khi các P0/P1 business task đã merge.

---

## 1. Phạm vi

Full regression trên baseline HEAD sau khi các nhóm merge, đóng lại 8 kịch bản UAT Failed
của bản nộp gốc (8 failed / 120), và ra quyết định release gate.

## 2. Kết quả build sạch

| Thành phần | Lệnh | Kết quả |
|---|---|---|
| Backend (toàn solution) | `dotnet build huongvantra_backend.sln` | Build thành công, 0 lỗi |
| Frontend (web client) | `npm run build` | 894 modules, build 3.29s, 0 lỗi (chỉ warning có sẵn từ trước) |

## 3. Regression tự động (backend)

Chạy toàn bộ bộ kiểm thử tự động của backend trên HEAD:

| Dịch vụ | Số test | Fail |
|---|---|---|
| AuditService | 3 | 0 |
| OrderService | 143 | 0 |
| CustomerService | 23 | 0 |
| InventoryService | 163 | 0 |
| ProductService (WorkflowBaseline) | 121 | 0 |
| UserService | 77 | 0 |
| **Tổng** | **530** | **0** |

**Kết quả: 530/530 pass, 0 failure.**

Kiểm thử API mức nghiệp vụ được thực hiện bằng **Postman collection** của team (không nằm trong
con số automated test ở trên).

## 4. Docker runtime + health smoke

Đưa toàn bộ stack lên bằng `docker compose ... up -d` (KHÔNG dùng `down -v`), kiểm tra health:

- 10/10 container ở trạng thái **Up**.
- 8/8 container có healthcheck báo **(healthy)**.
- 6 endpoint `/health` của các microservice trả **HTTP 200**.
- Gateway proxy hoạt động end-to-end (route `/api/auth/login` chạm đúng user-service).

| Dịch vụ | Host port | Kết quả |
|---|---|---|
| user-service | 5001 | HTTP 200 |
| product-service | 5002 | HTTP 200 |
| order-service | 5003 | HTTP 200 |
| inventory-service | 5004 | HTTP 200 |
| customer-service | 5005 | HTTP 200 |
| audit-service | 5007 | HTTP 200 |
| gateway (proxy) | 5000 | Route → user-service OK (401 nghiệp vụ, đúng kỳ vọng) |

> Ghi chú: Gateway có `FallbackPolicy = RequireAuthenticatedUser` và không expose `/health` riêng;
> phản hồi 401 khi gọi route không anonymous chính là bằng chứng gateway còn sống. Đã xác nhận
> proxy xuyên suốt bằng cách gọi `/api/auth/login` và nhận về phản hồi nghiệp vụ từ user-service.

## 5. Trạng thái 8 UAT Failed cũ

Bản UAT nộp gốc có **8 failed / 120**. Danh sách và trạng thái sau regression trên HEAD:

| UAT | Kịch bản | Nhóm | Trạng thái HEAD |
|---|---|---|---|
| #45 | Manager tạo Nhãn (Brand) | Nhãn/Brand | PASS — đã fix |
| #46 | Manager cập nhật Nhãn | Nhãn/Brand | PASS — đã fix |
| #47 | Manager ẩn (soft-delete) Nhãn | Nhãn/Brand | PASS — đã fix |
| #48 | Warehouse/Manager khôi phục Nhãn | Nhãn/Brand | PASS — đã fix |
| #86 | Kiểm hàng trả (Inspect Returned Goods) | Kho | PASS trên HEAD |
| #115 | Sản phẩm bán chạy (Top-Selling Products) | Báo cáo | PASS trên HEAD |
| #118 | Thông báo (Notifications) | Thông báo | PASS trên HEAD |
| #119 | Thông báo (Notifications) | Thông báo | PASS trên HEAD |

**Kết quả: 8/8 UAT scenario cũ pass nội bộ.**

### Chi tiết nhóm Nhãn/Brand (#45–#48)

Nguyên nhân gốc: Manager không có quyền thao tác Nhãn và frontend chưa có trang quản lý Nhãn.

Đã khắc phục:
- **Backend:** thêm permission `MANAGE_TAXONOMY` (seed cho role Manager), policy tổng hợp
  `MANAGE_TAXONOMY_ACCESS = Any(MANAGE_TAXONOMY, MANAGE_CATALOG)` cho `BrandsController` — Manager
  qua `MANAGE_TAXONOMY`, Thủ kho qua `MANAGE_CATALOG`.
- **Frontend:** thêm trang `ProductsBrandsPage` (tạo/sửa/ẩn/khôi phục Nhãn), helper
  `canManageTaxonomy`, route `/products/brands`, và mục điều hướng sidebar.

## 6. Release Gate — Quyết định

Điều kiện chốt (theo định nghĩa task):

| Tiêu chí | Trạng thái |
|---|---|
| 8/8 UAT failed scenario cũ pass nội bộ | ĐẠT |
| Không P0/P1 regression | ĐẠT (530/530 automated pass) |
| Full stack chạy ổn | ĐẠT (10/10 container Up, health OK, gateway proxy OK) |
| Có evidence để bảo vệ | ĐẠT (tài liệu này) |

### ✅ RELEASE GATE: APPROVED

Toàn bộ tiêu chí P0 đã đạt. Không phát hiện regression P0/P1. Hệ thống sẵn sàng release.
