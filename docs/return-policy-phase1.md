# Return / Exchange Policy

## Đã chốt (mặc định)

1. System auto-Accept khi Pass policy.
2. Custom-only: không cho trả.
3. Mốc ngày: `DeliveredAt` (COD) → `CompletedAt` → `CreatedAt`.
4. Đổi hàng dùng cùng policy với trả thuần.
5. Hoàn tiền chỉ sau Accept.

## Phase 1 — đọc policy (xong)

- Bảng `ReturnPolicies` + seed `DEFAULT` v1.
- API `GET /api/v1/returns/policy`, `.../for-order/{orderId}`.
- POS panel policy + lọc lý do.

## Phase 2/3 — evidence + evaluate (xong)

- `ReturnAsync` evaluate policy trước khi tạo Request.
- Fail → không tạo phiếu (trừ Manager override).
- Checklist + ảnh Cloudinary trên POS.

## Phase 4 — Request → Accept → inspection (xong)

Luồng:

1. `POST .../orders/{id}/return` tạo `ReturnOrder` **Pending**.
   - Chưa tăng `ReturnedQuantity`.
   - Chưa hoàn tiền / cash session.
   - Chưa publish `OrderReturned` (→ chưa `ReturnInspection`).
   - Lưu draft hàng đổi (`ExchangeDraftJson`) nếu có.
2. Nếu `AutoAcceptOnPolicyPass=true` (seed mặc định) hoặc Manager override → gọi Accept ngay trong cùng request.
3. `Accept` (`POST /api/v1/returns/{id}/accept`):
   - Tăng `ReturnedQuantity`.
   - Publish `OrderReturned` (Inventory tạo `ReturnInspection` Pending).
   - Hoàn tiền / tạo đơn đổi từ draft.
4. `Reject` (`POST /api/v1/returns/{id}/reject`) — Manager: huỷ Pending, không ảnh hưởng tồn/tiền.

Migration: `20260813190000_AddReturnAcceptanceStatus` (phiếu cũ backfill `Accepted`).

FE: badge trạng thái danh sách/chi tiết; Manager Accept/Từ chối trên trang chi tiết phiếu Pending.
