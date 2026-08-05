# Ma trận phân quyền HVTPOSIMS

> Backend là nguồn quyết định cuối. Hướng dẫn người dùng: [huong-dan-phan-quyen-su-dung.md](./huong-dan-phan-quyen-su-dung.md).

## Vai trò

| Vai trò | Việc chính |
|---------|------------|
| **Admin** | Giám sát + IAM + duyệt nhẹ. Không bán / không vận hành kho. |
| **Manager** | Vận hành cửa hàng + duyệt kho/SP + nhân sự. |
| **Warehouse** | Vận hành kho + gửi báo cáo cuối ngày. |
| **SalePos / SaleCod / Sale** | Bán theo kênh. |
| **Accountant** | NCC + giá/cost. |

## Permission (JWT claim `permission`)

| Permission | Seed | Mục đích |
|------------|------|----------|
| `VIEW_INVENTORY` | Admin, Manager, Warehouse, Accountant | Đọc kho / thống kê / báo cáo |
| `OPERATE_WAREHOUSE` | Warehouse | Ghi vận hành kho |
| `APPROVE_INVENTORY` | Manager | Duyệt phiếu nhập / SX / kiểm kê / trả… |
| `REJECT_STOCK_DEDUCT` | Manager, Admin | Từ chối queue trừ kho |
| `SUBMIT_WAREHOUSE_REPORT` | Warehouse | Gửi báo cáo cuối ngày |
| `BROADCAST_NOTIFICATION` | Warehouse | Broadcast thông báo báo cáo |
| `MANAGE_CATALOG` | Warehouse | Ghi catalog SP |
| `VIEW_PRODUCT_REQUEST` | Admin, Manager, Warehouse | Xem YC tạo/xóa SP |
| `APPROVE_PRODUCT_REQUEST` | Manager | Duyệt YC tạo/xóa SP |
| `MANAGE_SUPPLIERS` | Accountant | Ghi NCC |
| `MANAGE_COST` / `VIEW_COST` | Acc (+ xem Admin/Manager/WH) | Giá vốn / yêu cầu đổi giá |
| `APPROVE_PRICE` | Admin | Duyệt đổi giá bán |
| `MONITOR_OUTBOX` | Admin, Manager, Warehouse | Outbox đồng bộ tồn |
| `MANAGE_BUSINESS_POLICY` | Admin | Doanh thu đầy đủ trên báo cáo |

### Policy ghép (không seed DB)

| Policy | Gồm |
|--------|-----|
| `STOCK_ADJUSTMENT_READ_ACCESS` | VIEW_INVENTORY \| CREATE_POS_ORDER |
| `STOCK_ADJUSTMENT_CREATE_ACCESS` | CREATE_POS_ORDER \| MANAGE_EMPLOYEE |
| `STOCKTAKE_CREATE_ACCESS` | CREATE_POS_ORDER \| MANAGE_EMPLOYEE \| OPERATE_WAREHOUSE |
| `VIEW_CATALOG_ACCESS` | VIEW_INVENTORY \| MANAGE_CATALOG \| VIEW_COST |
| `WAREHOUSE_OR_MANAGER_OPS` | OPERATE_WAREHOUSE \| APPROVE_INVENTORY |
| `MATERIALS_DEDUCT_ACCESS` | OPERATE_WAREHOUSE \| APPROVE_INVENTORY \| REJECT_STOCK_DEDUCT \| MANAGE_ROLE |
| `CANCEL_RETAIL_PRICE_ACCESS` | APPROVE_PRICE \| MANAGE_COST |

## Gateway

- Mặc định cần JWT.
- Anonymous: `POST /api/auth/login`, `POST /api/auth/refresh-token`, SePay webhook (+ simulate).
- Catalog S2S: gọi thẳng ProductService + `X-Internal-Api-Key`.

## Đã hoàn tất

- P0: Admin lai + vá bảo mật + FE menu.
- P1: Gateway JWT + seed permission giám sát.
- P2/P3: Inventory + Product authorize bằng Policy (không còn Roles trên controller nghiệp vụ).
