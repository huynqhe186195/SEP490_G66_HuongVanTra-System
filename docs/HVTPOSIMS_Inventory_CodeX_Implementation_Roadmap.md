# HVTPOSIMS Inventory — CodeX Implementation Roadmap

- **Project:** Hương Vân Trà POS & Inventory Management System
- **Module:** Quản lý Kho và Hàng Hóa
- **Document type:** Roadmap triển khai dành riêng cho CodeX
- **Version:** 1.0
- **Status:** ACTIVE
- **Last updated:** 28/07/2026
- **Working branch:** `HuyTD`
- **Repository:** `D:\SEP490_G66_HuongVanTra-System`

---

## 1. Mục đích tài liệu

Tài liệu này là hướng dẫn triển khai kỹ thuật dành riêng cho CodeX.

CodeX phải dùng tài liệu này để:

- Xác định đúng batch đang được giao.
- Giới hạn phạm vi sửa đổi.
- Giữ đúng dependency giữa ProductService, InventoryService, OrderService và frontend.
- Không triển khai lại phần đã hoàn thành.
- Không tự mở rộng yêu cầu ngoài batch hiện tại.
- Báo cáo rõ file đã thay đổi, migration, rủi ro và bước tiếp theo.

Tài liệu này không thay thế tài liệu nghiệp vụ đã chốt.

---

## 2. Thứ tự ưu tiên nguồn

Khi có mâu thuẫn, áp dụng thứ tự sau:

1. `Nghiệp Vụ Quản Lý Kho Và Hàng Hóa (Đã Chốt).docx`
2. Roadmap CodeX này
3. Source code mới nhất trên branch `HuyTD`
4. Các tài liệu Inventory cũ hơn
5. Suy luận kỹ thuật

Nếu Roadmap mâu thuẫn với tài liệu nghiệp vụ đã chốt, dừng triển khai phần mâu thuẫn và báo lại.

---

## 3. Quy tắc làm việc bắt buộc với CodeX

### 3.1. Ngôn ngữ

- Giao tiếp và báo cáo bằng tiếng Việt.
- Giữ nguyên tiếng Anh cho class, API, field, enum, migration, service, command và tên file kỹ thuật.

### 3.2. Phạm vi

- Mỗi lần chỉ triển khai đúng một batch.
- Không tự chuyển sang batch tiếp theo.
- Không sửa ngoài phạm vi nếu chưa báo cáo.
- Không tự tái cấu trúc lớn chỉ để “làm sạch code”.
- Backend validation là lớp bảo vệ cuối cùng; không chỉ ẩn nút ở frontend.

### 3.3. Lệnh bị cấm

Không được sử dụng:

- `docker compose down -v`
- `docker system prune --volumes`
- `git reset --hard`
- `git clean -fd`
- force push
- xóa database hoặc volume
- truy cập trực tiếp database của microservice khác

### 3.4. Test, build, Docker, Git

Theo mặc định:

- Không tự chạy test toàn hệ thống.
- Không tự rebuild Docker toàn hệ thống.
- Không tự commit.
- Không tự push.

Chỉ thực hiện khi prompt của người dùng yêu cầu rõ.

### 3.5. Báo cáo cuối mỗi batch

Báo cáo phải gồm:

1. Tóm tắt thay đổi.
2. Danh sách file đã sửa.
3. Migration hoặc thay đổi schema.
4. Quy tắc nghiệp vụ đã áp dụng.
5. Điểm chưa làm hoặc cần PM xác nhận.
6. Rủi ro còn lại.
7. Mục `Bạn nên làm gì tiếp theo`.

---

## 4. Nguyên tắc kiến trúc đã chốt

### 4.1. Product type và vị trí tồn

- Technical code hiện tại có thể tiếp tục dùng `NGUYEN_LIEU`.
- UI phải hiển thị “Nguyên liệu/Vật tư”.
- `THANH_PHAM` là loại duy nhất được phép ở Kệ Hàng.
- `NGUYEN_LIEU` và `BAO_BI` chỉ ở Kho.
- Không thêm CRUD cho ProductType.

### 4.2. BOM

- BOM output chỉ được là `THANH_PHAM`.
- BOM component chỉ được là `NGUYEN_LIEU` hoặc `BAO_BI`.
- `THANH_PHAM` không được làm component.
- Validation phải tồn tại ở backend.

### 4.3. Giá vốn

- Inventory không tính moving average cost.
- Inventory không tự cập nhật `ProductVariant.CostPrice`.
- FEFO chỉ dùng để chọn lô vật lý.
- Giá bán và giá vốn tham chiếu do Admin quản lý ở Product/Pricing.

### 4.4. Quyền vận hành

- Warehouse lập Supplier Receipt.
- Manager duyệt Supplier Receipt.
- Warehouse trực tiếp xác nhận Kho → Kệ.
- Warehouse trực tiếp xác nhận Stock Deduct Queue.
- Warehouse tạo và hoàn thành Production Order sau khi Manager duyệt.
- Sale kiểm kê Kệ.
- Warehouse kiểm kê Kho.
- Manager duyệt chênh lệch kiểm kê.
- Admin xử lý audit, ngoại lệ và escalation.

### 4.5. Tính nhất quán tồn kho

- Mọi stock effect nhiều dòng phải atomic.
- Không cho partial success.
- Request confirm lặp lại không được trừ lần hai.
- Queue và Custom phải có idempotency ở database.
- Không dùng frontend-only guard thay cho backend validation.

---

## 5. Trạng thái tổng thể

| Batch | Nội dung | Trạng thái | Phụ thuộc |
|---|---|---|---|
| 0 | Baseline và impact map | NOT_STARTED | Không |
| 1 | RBAC và navigation | NOT_STARTED | Batch 0 |
| 2 | ProductType, BOM, capability | NOT_STARTED | Batch 0 |
| 3 | Loại bỏ Inventory costing | NOT_STARTED | Batch 0 |
| 4 | Kho → Kệ | NOT_STARTED | Batch 2 |
| 5 | Production Order | NOT_STARTED | Batch 2, Batch 3 |
| 6 | Stock Deduct Queue | NOT_STARTED | Batch 2, Batch 4 |
| 7 | Custom Order | NOT_STARTED | Batch 2, Batch 6 |
| 8 | Stocktake, Supplier Return, Supplier traceability | NOT_STARTED | Batch 4 |
| 9 | UX, báo cáo và hiệu năng | NOT_STARTED | Các batch lõi |

Trạng thái hợp lệ:

`NOT_STARTED`, `ANALYZING`, `IMPLEMENTING`, `WAITING_REVIEW`, `NEEDS_FIX`, `READY_FOR_TEST`, `TESTING`, `COMPLETED`, `DEFERRED`, `BLOCKED`

---

# 6. Batch 0 — Baseline và Impact Map

## Mục tiêu

Khóa phạm vi trước khi sửa code.

## Công việc

- Xác nhận branch hiện tại là `HuyTD`.
- Ghi nhận working tree hiện tại.
- Lập danh sách controller, service, use case, DTO, entity, migration và frontend page liên quan tới:
  - Supplier Receipt
  - Supplier Return
  - Stock Deduct Queue
  - Stocktake
  - Stock Transfer
  - Production Order
  - BOM
  - Custom Bundle
  - Inventory costing
- Xác định endpoint hiện tại và role hiện tại.
- Xác định stock effect của từng luồng.
- Xác định dữ liệu lịch sử cần backward compatibility.

## Không làm

- Không sửa schema.
- Không sửa business logic.
- Không đổi role.
- Không chạy migration.

## Definition of Done

- Có impact map đầy đủ.
- Không sửa source.
- Báo cáo rõ các decision gate cần PM xác nhận.

---

# 7. Batch 1 — RBAC và Navigation

## Mục tiêu

Sửa lỗi 403, sai menu và sai actor.

## Phạm vi backend

### Supplier Receipt

- Warehouse: create, edit draft, submit, cancel draft.
- Manager: approve, reject.
- Admin: view, audit, escalation.
- Người lập không tự duyệt.

### Stock Deduct Queue

- Warehouse: list, detail, preview, confirm.
- Manager/Admin: view và xử lý ngoại lệ qua endpoint riêng.
- Sale: không confirm.

### Production Order

- Tách role theo từng action.
- Không dùng một class-level role cho toàn lifecycle.

### Stocktake

- Warehouse: tạo/submit kiểm kê Kho.
- Sale/Cashier: tạo/submit kiểm kê Kệ.
- Manager: approve/reject.
- Admin: escalation.

### Supplier Return

- Chỉ triển khai quyền khi prompt ghi rõ quyết định PM.
- Phương án mặc định được đề xuất: Warehouse lập, Manager duyệt.

## Phạm vi frontend

- Thêm Warehouse vào menu và module guard của Supplier Receipt.
- Warehouse truy cập được Queue.
- Ẩn action không đúng quyền.
- Đổi wording:
  - “Chờ trừ tồn quầy” → “Chờ đóng gói/Chờ trừ Kho”
  - Không ghi “Manager/Admin xác nhận” trong luồng thường.

## Definition of Done

- Warehouse không bị redirect hoặc 403 sai tại Supplier Receipt và Queue.
- Warehouse không tự duyệt Supplier Receipt.
- Manager không là actor confirm Queue mặc định.
- Sale không thấy hoặc gọi được confirm Queue.
- Backend vẫn từ chối request sai role dù frontend bị bypass.

---

# 8. Batch 2 — ProductType, BOM và SKU Capability

## Mục tiêu

Tạo nền dữ liệu đúng cho Production, Queue và Custom.

## Thay đổi schema

Bổ sung capability ở cấp SKU/ProductVariant:

- `IsPurchasable`
- `CanBeBomComponent`
- `CanUseInCustom`
- `CanHaveBom`

## Quy tắc bắt buộc

### `THANH_PHAM`

- Có thể `CanHaveBom`.
- Luôn `CanBeBomComponent = false`.
- Không tự động được dùng trong Custom.

### `NGUYEN_LIEU` và `BAO_BI`

- Luôn `CanHaveBom = false`.
- Có thể bật `CanBeBomComponent`.
- Có thể bật `CanUseInCustom`.

## Phạm vi validation

- Product create/edit.
- Product Approval.
- Excel import.
- BOM create/update.
- Production Order.
- Queue BOM resolution.
- Custom component lookup.
- Order validation.

## Migration

- Additive migration.
- Không xóa field cũ.
- Có script/report phát hiện BOM hiện tại đang chứa Thành phẩm.
- Không tự động sửa dữ liệu cũ âm thầm.

## Definition of Done

- API không thể tạo BOM chứa `THANH_PHAM`.
- Output BOM chỉ là `THANH_PHAM`.
- Custom chỉ nhận SKU có `CanUseInCustom = true`.
- Kệ chỉ nhận `THANH_PHAM`.
- DTO/event/catalog sync mang theo capability cần thiết.

---

# 9. Batch 3 — Loại bỏ Inventory Costing

## Mục tiêu

Loại Inventory khỏi nghiệp vụ tính giá vốn tự động.

## Phạm vi

- Bỏ trường giá bắt buộc khỏi Supplier Receipt UI.
- Không yêu cầu `UnitCost` khi tạo hoặc duyệt Supplier Receipt.
- Ngừng moving average cost.
- Ngừng phát `CostPriceUpdatedEvent` từ Inventory.
- Ngừng consumer tự ghi đè `ProductVariant.CostPrice`.
- Bỏ cảnh báo “giá vốn bằng 0” trong nghiệp vụ kho.
- Tách report giá trị tồn khỏi Inventory.

## Migration strategy

- Không drop cột `UnitCost` ngay.
- Đổi optional/deprecated nếu cần.
- Ngừng ghi dữ liệu mới.
- Ngừng dùng cho calculation và event.
- Giữ dữ liệu cũ để audit cho tới release sau.

## Definition of Done

- Supplier Receipt không nhập giá vẫn approve được.
- Kho tăng bình thường.
- Không có moving average.
- Không có auto-update Product cost từ Inventory.
- FEFO không phụ thuộc giá.

---

# 10. Batch 4 — Kho → Kệ

## Mục tiêu

Thay Stock Adjustment giả lập bằng nghiệp vụ điều chuyển nội bộ đúng nghĩa.

## Domain đề xuất

Tạo domain:

- `ShelfReplenishment` hoặc `StockTransfer`
- `StockTransferLine`
- `Status`: `Draft`, `Completed`, `Cancelled`

## Actor

- Warehouse tạo.
- Warehouse trực tiếp complete.
- `CreatedBy` và `CompletedBy` có thể là cùng người.
- Không cần Manager approval.

## Validation

- Chỉ SKU `THANH_PHAM`.
- Kho phải đủ toàn bộ số lượng.
- Không cho partial transfer.
- Backend phải kiểm tra ProductType.

## Stock effect

Trong một transaction:

1. Trừ Kho theo FEFO.
2. Tăng Kệ.
3. Ghi batch lineage.
4. Sinh Export Slip.
5. Sinh Import Slip.
6. Ghi Inventory Ledger.
7. Ghi Audit Log.

## Backward compatibility

- StockAdjustmentRequest cũ vẫn đọc được.
- Không dùng flow cũ để tạo transfer mới.
- Không đổi lịch sử đã hoàn tất.

## Definition of Done

- Warehouse tự complete.
- Kho giảm và Kệ tăng atomic.
- Tổng tồn không đổi.
- Request lặp không tạo stock effect lần hai.
- Nguyên liệu/Bao bì không lên Kệ.

---

# 11. Batch 5 — Production Order

## Mục tiêu

Căn chỉnh actor, approval và location output.

## Actor

- Warehouse: create, edit draft, submit, complete sau Approved.
- Manager: approve, reject.
- Admin: view, audit, escalation.

## Quy tắc

- Output luôn vào Warehouse.
- Frontend không cho chọn Shelf.
- Backend từ chối output location khác Warehouse.
- Chỉ `Approved` mới được complete.
- BOM dùng capability từ Batch 2.
- Không phụ thuộc `UnitCost`.
- Stock movement atomic.

## Definition of Done

- Manager không tạo/complete luồng thường.
- Warehouse không tự approve.
- Production output mới luôn vào Kho.
- Thiếu component thì rollback toàn bộ.
- Có đầy đủ Export, Import, Allocation, Ledger và audit.

---

# 12. Batch 6 — Stock Deduct Queue

## Mục tiêu

Hoàn thiện Quy trình bán trước, đóng gói sau nhưng không làm sai tồn.

## Checkout

- Chỉ tính BOM cho số Thành phẩm thiếu tại Kệ.
- Kiểm tra đủ toàn bộ component ở Kho.
- Thiếu một component:
  - Không tạo Order.
  - Không trừ Kệ.
  - Không tạo Queue.
- Đủ component:
  - Trừ hoặc reserve phần Kệ có sẵn.
  - Reserve component cho phần thiếu.
  - Tạo Queue snapshot.

## Queue snapshot

Phải lưu:

- OrderId
- SKU Thành phẩm
- Số lượng thiếu
- BOM snapshot
- Component quantity
- Reservation reference
- CreatedAt
- Status
- Audit identity

## Confirm

Warehouse confirm:

- Commit reservation.
- Trừ component theo FEFO.
- Sinh Export Slip.
- Sinh Batch Allocation.
- Ghi Ledger.
- Cập nhật Queue atomically.

## Idempotency

Dùng database uniqueness cho:

`OperationType + ReferenceType + ReferenceId`

Không chỉ kiểm tra status ở application memory.

## Definition of Done

- Kệ đủ: không Queue.
- Kệ thiếu, Kho thiếu: chặn toàn bộ.
- Kệ thiếu, Kho đủ: Order thành công và Queue đúng phần thiếu.
- Confirm lặp hoặc đồng thời không trừ lần hai.
- Manager/Admin chỉ xử lý ngoại lệ.

---

# 13. Batch 7 — Custom Order

## Mục tiêu

Reserve trước checkout và chống trừ hai lần giữa OrderService và InventoryService.

## Component catalog

- Hỗ trợ cả `NGUYEN_LIEU` và `BAO_BI`.
- Chỉ trả SKU `CanUseInCustom = true`.
- Frontend dùng nhãn “Thành phần”.

## Checkout

- Backend validate capability.
- Reserve toàn bộ component trước khi Order hoàn tất.
- Thiếu một component thì rollback toàn bộ.
- Không tạo Order đã thanh toán nhưng thiếu nguyên liệu.

## Pack

Warehouse confirm:

- Commit reservation.
- Không chạy một phép deduct mới không có reference.
- Dùng `CustomBundleId` làm reference idempotency.
- Order phải còn trạng thái hợp lệ.
- Order đã cancel/refund thì không pack.

## Cross-service consistency

Ưu tiên:

- Outbox/Inbox
- Hoặc operation record + retry idempotent

Không dựa vào transaction cục bộ giữa hai database.

## Cancel

- Trước pack: release reservation.
- Sau pack: tạo reverse transaction có chứng từ.
- Không xóa stock effect cũ.

## Definition of Done

- Chọn được Nguyên liệu/Vật tư và Bao bì hợp lệ.
- Không chọn được SKU `CanUseInCustom = false`.
- Checkout thiếu component bị chặn.
- Pack retry không trừ lần hai.
- Kệ không thay đổi.

---

# 14. Batch 8 — Stocktake, Supplier Return và Traceability

## Stocktake

### Kho

- Warehouse lập.
- Manager duyệt.
- Chỉ tồn Kho thay đổi.

### Kệ

- Sale/Cashier lập.
- Manager duyệt.
- Chỉ tồn Kệ thay đổi.

### Adjustment

- Chỉ dùng cho chênh lệch kiểm kê hoặc sai lệch đã xác minh.
- Không dùng thay Receipt, Transfer, Production, Queue hoặc Return.

## Supplier Return

Phương án đề xuất:

- Warehouse lập.
- Manager duyệt.
- Admin xử lý ngoại lệ.

Stock effect:

- Chỉ Kho giảm.
- Tham chiếu Supplier Receipt và batch gốc khi có.
- Sinh Export Slip, Allocation, Ledger, audit.

## Supplier traceability

- Tách `InternalBatchCode` và `SupplierLotCode`.
- Không dùng mã lô NCC làm khóa duy nhất toàn hệ thống.
- Normalize `SupplierDocumentNumber`.
- Recheck duplicate trong transaction.
- Thêm unique constraint phù hợp.

## Definition of Done

- Người lập không tự duyệt.
- Stocktake chỉ tác động location tương ứng.
- Supplier Return chỉ giảm Kho.
- Có trace từ Supplier Receipt → Batch → Return → Ledger.

---

# 15. Batch 9 — UX, Báo cáo và Hiệu năng

## UX tồn kho

Hiển thị:

- `On Hand`
- `Reserved`
- `Available`

## Queue

- Waiting duration.
- SLA.
- Badge quá hạn.
- Lọc theo tuổi queue và tình trạng thiếu hàng.

## Supplier

KPI đề xuất:

- On-time delivery rate.
- Fill rate.
- Rejection rate.
- Số lần trả hàng.
- Lead time trung bình.
- Lần nhập gần nhất.

## Performance

- Loại N+1 khi đếm Supplier Receipt.
- Dùng projection/GroupBy.
- Tránh tải toàn bộ dữ liệu chỉ để đếm.

## Traceability UX

- Cho phép mở Ledger → Slip → Batch → Order/Receipt/Transfer.
- Hỗ trợ barcode/QR cho SKU, batch và chứng từ.

## Error handling

- 400/403/409 hiển thị tiếng Việt rõ ràng.
- Không white-screen.
- Không toast chung chung “Có lỗi xảy ra”.

---

# 16. UAT bắt buộc khi đóng Roadmap

| UAT | Kết quả mong đợi |
|---|---|
| Nhập NCC | Manager duyệt, chỉ Kho tăng, không cần giá |
| Chuyển Nguyên liệu lên Kệ | Bị chặn frontend và backend |
| Kho → Kệ Thành phẩm | Warehouse tự complete, Kho giảm, Kệ tăng atomic |
| POS Kệ đủ | Chỉ Kệ giảm, không Queue |
| POS Kệ thiếu, Kho thiếu component | Không Order, không trừ Kệ, không Queue |
| POS Kệ thiếu, Kho đủ | Order thành công, Queue đúng phần thiếu |
| Confirm Queue | Warehouse trừ đúng component |
| Confirm Queue lặp | Không trừ lần hai |
| Custom | Reserve trước checkout, pack idempotent |
| Production | Warehouse lập, Manager duyệt, output vào Kho |
| Stocktake Kho | Chỉ Kho thay đổi sau Manager duyệt |
| Stocktake Kệ | Chỉ Kệ thay đổi sau Manager duyệt |
| Supplier Return | Chỉ Kho giảm, có traceability |
| FEFO | Lô gần hết hạn được xuất trước |
| Giá vốn | Không ảnh hưởng thứ tự FEFO hoặc stock movement |

---

# 17. Changelog

## Version 1.0 — 28/07/2026

- Khởi tạo Roadmap CodeX.
- Chia 10 batch từ baseline đến UX.
- Khóa các nguyên tắc RBAC, BOM, costing, transfer, Queue và Custom.
