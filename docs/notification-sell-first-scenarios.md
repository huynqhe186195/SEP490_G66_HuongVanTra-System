# Rà soát Thông báo Luồng Bán Trước Trừ Sau (POS-06)

**Ngày kiểm tra:** 2026-08-19  
**Phiên bản:** sau khi sửa bug điều hướng

## Tóm tắt Bug đã sửa

**Vấn đề:** Tất cả thông báo cho luồng bán trước trừ sau (POS-06) đều dẫn nhầm về `/inventory/stock-requests` (trang Yêu cầu Điều chỉnh Tồn kho) thay vì `/orders/stock-deduct` (trang Chờ đóng gói / trừ Kho).

**Nguyên nhân:** 6 chỗ trong code backend đều dùng sai đường dẫn.

**Đã sửa:**
- OrderService/OrderLogic.cs: 3 thông báo (lines 902, 911, 920)
- InventoryService/InventoryLogic.cs: 3 thông báo (lines 1462, 2819, 3134)

## Tất cả các kịch bản thông báo trong luồng Bán Trước Trừ Sau

### 1. Kịch bản POS-06 Scenario 2: Kệ thiếu, Kho thành phẩm đủ

**Trigger:** Thu ngân xác nhận thanh toán → đơn chuyển sang `OrderStatus.WaitingTransfer`

**Thông báo gửi đến:** Warehouse (role Thủ kho)

**Chi tiết:**
```csharp
NotificationTypes.OrderWaitingTransfer
Title: "Đơn hàng {OrderCode} cần điều chuyển hàng từ Kho sang Kệ"
Link: "/orders/stock-deduct"
```

**Hành động tiếp theo:** Thủ kho bấm vào thông báo → trang `/orders/stock-deduct` → tìm đơn → bấm "Xác nhận" → hệ thống tự tạo Phiếu điều chuyển Kho → Kệ → đơn chuyển Completed

**File code:** `OrderService.Application/UseCases/OrderLogic.cs:895-903`

---

### 2. Kịch bản POS-06 Scenario 3: Kệ + Kho thành phẩm thiếu, nguyên liệu đủ

**Trigger:** Thu ngân xác nhận thanh toán → đơn chuyển sang `OrderStatus.WaitingProduction`

**Thông báo gửi đến:** Warehouse (role Thủ kho)

**Chi tiết:**
```csharp
NotificationTypes.OrderWaitingProduction
Title: "Đơn hàng {OrderCode} cần sản xuất và điều chuyển hàng"
Link: "/orders/stock-deduct"
```

**Hành động tiếp theo:** Thủ kho bấm vào thông báo → trang `/orders/stock-deduct` → tìm đơn → bấm "Xác nhận" → hệ thống tự tạo đồng thời:
1. Lệnh sản xuất (ghi nhận chuyển đổi nguyên liệu → thành phẩm)
2. Phiếu điều chuyển Kho → Kệ
→ đơn chuyển Completed

**File code:** `OrderService.Application/UseCases/OrderLogic.cs:905-912`

---

### 3. Kịch bản POS-06a Scenario 4: Backorder - tất cả nguồn đều thiếu

**Trigger:** Thu ngân xác nhận thanh toán với khách đồng ý backorder → đơn chuyển sang `OrderStatus.WaitingMaterials`

**Thông báo gửi đến:** Warehouse (role Thủ kho)

**Chi tiết:**
```csharp
NotificationTypes.OrderWaitingMaterials
Title: "Đơn hàng {OrderCode} đang chờ nhập nguyên liệu (backorder)"
Link: "/orders/stock-deduct"
```

**Hành động tiếp theo:** 
- Thủ kho nhập hàng về kho
- Sau khi nhập, Thủ kho bấm vào thông báo → trang `/orders/stock-deduct` → tìm đơn backorder → bấm "Xác nhận"
- Hệ thống xử lý tương tự Scenario 3 (tạo Lệnh sản xuất + Phiếu điều chuyển)

**File code:** `OrderService.Application/UseCases/OrderLogic.cs:914-921`

---

### 4. Queue trừ kho POS đang chờ xác nhận

**Trigger:** Hệ thống tạo `StockDeductQueue` với status `Waiting` cho đơn POS bán trước trừ sau

**Thông báo gửi đến:** Warehouse (role Thủ kho)

**Chi tiết:**
```csharp
NotificationTypes.StockQueuePendingConfirm
Title: "Lệnh trừ kho {OrderCode} đang chờ xác nhận"
Link: "/orders/stock-deduct"
```

**Hành động tiếp theo:** Thủ kho xem danh sách queue → xác nhận trừ kho

**File code:** `InventoryService.Application/UseCases/InventoryLogic.cs:1455-1463`

---

### 5. Queue giữ chỗ COD đã tạo

**Trigger:** Hệ thống tạo giữ chỗ COD thành công (POS-04)

**Thông báo gửi đến:** Warehouse (role Thủ kho)

**Chi tiết:**
```csharp
NotificationTypes.StockQueuePendingConfirm
Title: "Lệnh giữ chỗ COD {OrderCode} đã tạo, chờ xác nhận"
Link: "/orders/stock-deduct"
```

**Hành động tiếp theo:** Thủ kho xem danh sách queue → chuẩn bị hàng cho đơn COD

**File code:** `InventoryService.Application/UseCases/InventoryLogic.cs:2814-2819`

**Lưu ý:** Đây là thông báo giữ chỗ COD (chưa thanh toán), khác với trừ kho POS (đã thanh toán).

---

### 6. Queue giữ chỗ COD đã cập nhật (thay đổi SKU)

**Trigger:** Khách sửa đơn COD → hệ thống nhả giữ chỗ cũ và tạo giữ chỗ mới (POS-04)

**Thông báo gửi đến:** Warehouse (role Thủ kho)

**Chi tiết:**
```csharp
NotificationTypes.StockQueuePendingConfirm
Title: "Lệnh giữ chỗ COD {OrderCode} đã cập nhật, chờ xác nhận"
Link: "/orders/stock-deduct"
```

**Hành động tiếp theo:** Thủ kho kiểm tra lại danh sách SKU mới → chuẩn bị lại hàng

**File code:** `InventoryService.Application/UseCases/InventoryLogic.cs:3130-3134`

---

### 7. Kho đã xác nhận trừ tồn (feedback cho Thu ngân)

**Trigger:** Thủ kho bấm "Xác nhận" trên trang `/orders/stock-deduct` → queue chuyển sang Deducted

**Thông báo gửi đến:** Thu ngân đã tạo đơn (Sale role, gửi trực tiếp cho EmployeeId)

**Chi tiết:**
```csharp
NotificationTypes.StockQueueConfirmed
Title: "Kho đã xác nhận trừ tồn cho đơn {OrderCode}"
Link: "/orders/{orderId}"
```

**Hành động tiếp theo:** Thu ngân biết đơn đã trừ kho thành công

**File code:** `OrderService.Application/UseCases/OrderLogic.cs:3026-3031`

**Lưu ý:** Link dẫn về `/orders/{orderId}` (trang chi tiết đơn hàng), không phải trang danh sách queue.

---

### 8. Đơn đã đủ hàng, chờ khách đến lấy

**Trigger:** Thủ kho xác nhận trừ kho → đơn chuyển sang `ReadyToDeliver`

**Thông báo gửi đến:** Thu ngân đã tạo đơn (Sale role, gửi trực tiếp cho EmployeeId)

**Chi tiết:**
```csharp
NotificationTypes.OrderReadyForPickup
Title: "Đơn {OrderCode} đã đủ hàng, chờ khách đến lấy"
Link: "/orders/{orderId}"
```

**Hành động tiếp theo:** Thu ngân gọi khách đến lấy hàng → bấm "Giao hàng" → đơn chuyển Completed

**File code:** `OrderService.Application/UseCases/OrderLogic.cs:3020-3025`

**Lưu ý:** Link dẫn về `/orders/{orderId}` (trang chi tiết đơn hàng), không phải trang danh sách queue.

---

## Mapping giữa Thông báo và Trang đích

| Loại thông báo | Người nhận | Trang đích | Trang đúng? |
|---|---|---|---|
| OrderWaitingTransfer | Warehouse | `/orders/stock-deduct` | ✅ Đã sửa |
| OrderWaitingProduction | Warehouse | `/orders/stock-deduct` | ✅ Đã sửa |
| OrderWaitingMaterials | Warehouse | `/orders/stock-deduct` | ✅ Đã sửa |
| StockQueuePendingConfirm (POS) | Warehouse | `/orders/stock-deduct` | ✅ Đã sửa |
| StockQueuePendingConfirm (COD tạo) | Warehouse | `/orders/stock-deduct` | ✅ Đã sửa |
| StockQueuePendingConfirm (COD sửa) | Warehouse | `/orders/stock-deduct` | ✅ Đã sửa |
| StockQueueConfirmed | Sale (EmployeeId) | `/orders/{orderId}` | ✅ Đúng từ đầu |
| OrderReadyForPickup | Sale (EmployeeId) | `/orders/{orderId}` | ✅ Đúng từ đầu |

## Các loại thông báo khác trong hệ thống (không liên quan POS-06)

### Phase 2A: Manager feedback → Sale
- `OrderCancellationApproved` / `OrderCancellationRejected` → `/orders/{orderId}`
- `ReturnRequestApproved` / `ReturnRequestRejected` → `/orders/{orderId}`

### Phase 2C: Stock adjustment flow
- `StockAdjustmentRequestCreated` → `/inventory/stock-requests` ✅ Đúng (đây mới là trang thực sự cho yêu cầu điều chỉnh tồn)
- `StockAdjustmentRequestReviewed` → `/inventory/stock-requests`
- `StockAdjustmentRequestRejected` → `/inventory/stock-requests`
- `StockAdjustmentRequestClosed` → `/inventory/stock-requests`

### Thông báo khác
- `TransferSlipPendingConfirm` → `/inventory/stock-transfers`
- `ProductionOrderPendingApproval` → `/inventory/production-orders`
- `ReturnRequestPendingApproval` → `/orders/returns`
- `LowStockAlert` → `/inventory/statistics` hoặc `/inventory`

## Test Coverage

### OrderService.Application.Tests/NotificationIntegrationTests.cs
- ✅ `CreateOrderWithStockReconciliation_WaitingTransfer_SendsNotificationToWarehouse` - Đã cập nhật link
- ✅ `CreateOrderWithStockReconciliation_WaitingProduction_SendsNotificationToWarehouse` - Đã cập nhật link
- ✅ `BackorderCancellationRequest_SendsNotificationToManager` - Không ảnh hưởng (Manager notification)

### InventoryService.Application.Tests/InventoryNotificationIntegrationTests.cs
- ✅ `ReplaceCodReservationAsync_WhenStockSufficient_SendsQueuePendingNotification` - Không cần sửa (dùng It.IsAny)
- ✅ `PreparePosStockDeduction_WhenStockBelowThreshold_SendsLowStockAlert` - Không liên quan

## Checklist Verification

- [x] Bug điều hướng nhầm trang đã được sửa (6 chỗ)
- [x] Test cases đã được cập nhật (2 test cases)
- [x] Tất cả 8 kịch bản thông báo đã được rà soát và ghi nhận
- [x] Mapping giữa thông báo và trang đích đã được xác minh
- [ ] Chạy lại test suite để verify không có regression
- [ ] Test thủ công trên Docker stack: tạo đơn POS bán trước trừ sau → kiểm tra thông báo → bấm vào thông báo → verify điều hướng đúng trang
- [ ] Test thủ công với COD reservation: tạo đơn COD → sửa đơn → kiểm tra thông báo

## Files thay đổi

1. `backend/huongvantra_backend/Service/OrderService/OrderService.Application/UseCases/OrderLogic.cs`
   - Line 902: `/inventory/stock-requests` → `/orders/stock-deduct`
   - Line 911: `/inventory/stock-requests` → `/orders/stock-deduct`
   - Line 920: `/inventory/stock-requests` → `/orders/stock-deduct`

2. `backend/huongvantra_backend/Service/InventoryService/InventoryService.Application/UseCases/InventoryLogic.cs`
   - Line 1462: `/inventory/stock-requests` → `/orders/stock-deduct`
   - Line 2819: `/inventory/stock-requests` → `/orders/stock-deduct`
   - Line 3134: `/inventory/stock-requests` → `/orders/stock-deduct`

3. `backend/huongvantra_backend/Service/OrderService/OrderService.Application.Tests/NotificationIntegrationTests.cs`
   - Test `CreateOrderWithStockReconciliation_WaitingTransfer_SendsNotificationToWarehouse`: cập nhật expected link
   - Test `CreateOrderWithStockReconciliation_WaitingProduction_SendsNotificationToWarehouse`: cập nhật expected link

## Ghi chú

- Trang `/orders/stock-deduct` (StockDeductQueuePage) là trang "Chờ đóng gói / trừ Kho" - đúng trang cho Warehouse xử lý queue POS và COD
- Trang `/inventory/stock-requests` (StockAdjustmentRequestsPage) là trang "Yêu cầu Điều chỉnh Tồn kho" - chỉ dùng cho Phase 2C stock adjustment flow
- Frontend route đã đúng từ đầu (`App.jsx:99` và `navigation.js:79`), chỉ backend notification link bị sai
