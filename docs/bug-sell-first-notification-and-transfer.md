# Bug Report: Thông báo và Phiếu điều chuyển Bán Trước Trừ Sau

**Ngày phát hiện:** 2026-08-19  
**Mã đơn hàng:** HVT-260819-006  
**Mã phiếu điều chuyển:** DC-20260819153251-40DF91

## Tóm tắt

Khi tạo đơn hàng bán trước trừ sau (POS-06 Scenario 2), Warehouse nhận được 2 thông báo:
1. "Đơn hàng HVT-260819-006 cần điều chuyển hàng từ Kho sang Kệ"
2. "Phiếu điều chuyển DC-20260819153251-40DF91 đã tạo, cần xác nhận"

**Vấn đề:**
- Thông báo 1 dẫn nhầm về `/inventory/stock-requests` thay vì `/orders/stock-deduct`
- Thông báo 2 không nên được gửi vì phiếu điều chuyển được tạo tự động với trạng thái `Completed`
- Phiếu điều chuyển hiển thị trạng thái "đã hoàn tất điều chuyển" trong trang `/inventory/stock-transfers`

## Bug 1: Link thông báo sai (ĐÃ SỬA, chưa build)

### Nguyên nhân
File `OrderService.Application/UseCases/OrderLogic.cs` đang dùng link sai:
```csharp
// Line 895-903, 905-912, 914-921
$"/inventory/stock-requests"  // ❌ SAI
```

### Đã sửa thành
```csharp
$"/orders/stock-deduct"  // ✅ ĐÚNG
```

### Files đã sửa
1. `backend/huongvantra_backend/Service/OrderService/OrderService.Application/UseCases/OrderLogic.cs` (3 chỗ)
2. `backend/huongvantra_backend/Service/InventoryService/InventoryService.Application/UseCases/InventoryLogic.cs` (3 chỗ)
3. `backend/huongvantra_backend/Service/OrderService/OrderService.Application.Tests/NotificationIntegrationTests.cs` (2 test cases)

### Hành động cần làm
- [ ] Commit các thay đổi
- [ ] Build lại OrderService và InventoryService
- [ ] Deploy lên Docker stack
- [ ] Test lại: tạo đơn POS bán trước trừ sau → kiểm tra link thông báo

---

## Bug 2: Phiếu điều chuyển tự động hoàn tất (NGHIÊM TRỌNG)

### Mô tả
Khi Thủ kho xác nhận queue POS-06, hệ thống tự động tạo phiếu điều chuyển với trạng thái `Completed` ngay lập tức, bỏ qua bước xác nhận của Thủ kho.

### Nguyên nhân
File `InventoryService.Application/UseCases/InventoryLogic.cs`, hàm `CreateCompletedStockTransferForQueueAsync`, line 2121:

```csharp
var transfer = new StockTransfer
{
    Id = transferId,
    TransferCode = $"DC-{now:yyyyMMddHHmmss}-{transferId.ToString("N")[..6].ToUpperInvariant()}",
    SourceLocation = LocationWarehouse,
    DestinationLocation = LocationShelf,
    Status = StockTransferStatus.Completed,  // ❌ BUG: Tạo với status Completed ngay
    Note = $"Tự động sinh khi Thủ kho xác nhận bán trước trừ sau cho đơn {queue.OrderCode}",
    ExportSlipId = exportSlipId,
    ImportSlipId = importSlipId,
    CreatedBy = effectiveConfirmedBy,
    CreatedByName = NormalizeSnapshotText(confirmer?.CreatedByName),
    CreatedByRoleName = NormalizeSnapshotText(confirmer?.CreatedByRoleName),
    CreatedAt = now,
    UpdatedAt = now,
    CompletedBy = effectiveConfirmedBy == Guid.Empty ? null : effectiveConfirmedBy,
    CompletedByName = NormalizeSnapshotText(confirmer?.CreatedByName),
    CompletedByRoleName = NormalizeSnapshotText(confirmer?.CreatedByRoleName),
    CompletedAt = now,  // ❌ BUG: CompletedAt được set ngay
};
```

### Nghiệp vụ đúng (theo CLAUDE.md POS-06 Scenario 2)

**Kịch bản 2 — Shelf insufficient, Warehouse finished goods covers the rest:**
- Sale confirms payment → order status: WaitingTransfer (Chờ điều chuyển), customer waits.
- **Thủ kho confirms once** → system auto-generates Transfer Slip (Kho → Kệ).
- Order → Completed, hand goods to customer.

**Vấn đề:** "Thủ kho confirms once" có nghĩa là:
1. Thủ kho bấm "Xác nhận" trên queue ở `/orders/stock-deduct` (bước 1)
2. Hệ thống tự động tạo Transfer Slip với status **Draft** hoặc **Pending**
3. Thủ kho xác nhận Transfer Slip (bước 2)
4. Transfer Slip chuyển sang **Completed**
5. Đơn hàng chuyển sang **Completed**

**Hiện tại:** Thủ kho chỉ cần xác nhận queue 1 lần, phiếu điều chuyển tự động Completed luôn.

### Giải pháp đề xuất

**Option 1: Giữ nguyên "confirm once" - tự động hoàn tất phiếu (KHUYÊN DÙNG)**

Nếu nghiệp vụ thực sự chỉ cần 1 lần confirm:
- Giữ nguyên logic tạo phiếu Completed
- **KHÔNG gửi thông báo** `TransferSlipPendingConfirm` cho phiếu tự động
- Chỉ gửi thông báo `OrderWaitingTransfer` dẫn về `/orders/stock-deduct`
- Phiếu điều chuyển tự động chỉ để trace/audit, không cần Thủ kho xác nhận lại

**Option 2: Tách thành 2 bước confirm - phiếu cần xác nhận thủ công**

Nếu muốn Thủ kho xác nhận phiếu điều chuyển riêng:
1. Sửa line 2121: `Status = StockTransferStatus.Draft`
2. Bỏ `CompletedBy`, `CompletedByName`, `CompletedByRoleName`, `CompletedAt` = null
3. Gửi thông báo `TransferSlipPendingConfirm` khi tạo phiếu
4. Thêm API xác nhận phiếu điều chuyển
5. Khi Thủ kho xác nhận phiếu → chuyển status sang Completed → Order chuyển Completed

**Nhược điểm Option 2:**
- Tăng số bước thao tác (Thủ kho phải confirm 2 lần)
- UX phức tạp hơn
- Trái với requirement "Thủ kho confirms once" trong CLAUDE.md

### Khuyến nghị

**Chọn Option 1** vì:
1. Đúng với requirement "confirm once"
2. UX đơn giản hơn
3. Phiếu điều chuyển tự động chỉ để audit trail
4. Giảm friction cho Thủ kho

**Cần làm:**
- Xác nhận với PM/mentor về nghiệp vụ: "confirm once" có nghĩa là 1 lần hay 2 lần?
- Nếu 1 lần: không sửa gì, chỉ bỏ thông báo phiếu điều chuyển (nếu có)
- Nếu 2 lần: implement Option 2

---

## Bug 3: Thông báo phiếu điều chuyển không nên có (CẦN ĐIỀU TRA)

### Hiện trạng
Người dùng báo nhận được thông báo:
> "Phiếu điều chuyển DC-20260819153251-40DF91 đã tạo, cần xác nhận"

### Phân tích
Thông báo `TransferSlipPendingConfirm` chỉ được gửi ở 1 chỗ:
- `StockTransferLogic.cs:134-138` - khi tạo phiếu **Draft** thủ công qua API

Hàm `CreateCompletedStockTransferForQueueAsync` **KHÔNG gửi** thông báo này.

### Nguyên nhân có thể

**Giả thuyết 1: Code đang chạy khác với code hiện tại**
- Service chưa được build lại sau khi merge commit notification
- Hoặc có một nhánh code khác đang deploy

**Giả thuyết 2: Có logic tạo phiếu khác**
- Có một luồng code khác cũng tạo phiếu điều chuyển Draft khi xác nhận queue
- Hoặc có event listener đang bắt sự kiện tạo phiếu và gửi thông báo

**Giả thuyết 3: Người dùng nhầm lẫn**
- Thông báo đến từ một phiếu điều chuyển khác được tạo thủ công
- Timing trùng ngẫu nhiên

### Hành động cần làm
- [ ] Kiểm tra version code đang chạy trên Docker
- [ ] Kiểm tra log InventoryService để xem thông báo được gửi từ đâu
- [ ] Reproduce lại: tạo đơn POS bán trước trừ sau → xác nhận → đếm số thông báo
- [ ] Nếu xác nhận có bug: tìm và bỏ logic gửi thông báo phiếu điều chuyển tự động

---

## Tóm tắt hành động

### Ngay lập tức (đã sửa code, chưa deploy)
- [x] Sửa link thông báo từ `/inventory/stock-requests` → `/orders/stock-deduct` (6 chỗ)
- [x] Cập nhật test cases (2 test)
- [ ] Commit và push

### Trước khi deploy
- [ ] Xác nhận nghiệp vụ với PM: "confirm once" = 1 lần hay 2 lần?
- [ ] Nếu 1 lần: giữ nguyên phiếu Completed, chỉ sửa link thông báo
- [ ] Nếu 2 lần: implement Option 2 (tách thành 2 bước confirm)

### Sau khi deploy
- [ ] Test thủ công toàn bộ luồng POS-06 Scenario 2
- [ ] Verify link thông báo đúng
- [ ] Verify số lượng thông báo (chỉ 1, không phải 2)
- [ ] Verify trạng thái phiếu điều chuyển

### Điều tra thêm
- [ ] Tìm hiểu tại sao có thông báo phiếu điều chuyển (nếu còn tái diễn)
- [ ] Review toàn bộ flow notification trong POS-06

---

## Files liên quan

- `OrderService.Application/UseCases/OrderLogic.cs` - Gửi thông báo OrderWaitingTransfer/Production/Materials
- `InventoryService.Application/UseCases/InventoryLogic.cs` - Tạo queue, xác nhận queue, tạo phiếu điều chuyển tự động
- `InventoryService.Application/UseCases/StockTransferLogic.cs` - Tạo phiếu điều chuyển thủ công, gửi thông báo
- `Shared_Libraries/HuongVanTra.Shared/Notifications/NotificationTypes.cs` - Định nghĩa các loại thông báo
- `frontend/huongvantra-web-client/src/app/App.jsx` - Route `/orders/stock-deduct` và `/inventory/stock-transfers`
