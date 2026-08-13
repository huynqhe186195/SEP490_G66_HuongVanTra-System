# Custom Bundle Validation Issues

**Ngày phát hiện**: 2026-08-12  
**Người phát hiện**: HuyNQ  
**Độ ưu tiên**: HIGH

## Tóm tắt

Luồng custom bundle (cho khách tự chọn nguyên liệu) có **6 lỗi tiềm ẩn** liên quan đến validation, race condition, và transaction safety.

---

## 1. Thiếu validation số lượng tồn kho khi thêm vào giỏ (Frontend)

**File**: `frontend/huongvantra-web-client/src/features/pos/components/CustomBundlePanel.jsx`

**Vấn đề**:
- Người dùng có thể chọn nguyên liệu với số lượng vượt quá tồn kho hiện tại
- Dòng 305-307: Hiển thị tồn kho màu đỏ khi `stockOnHand <= 0`, nhưng vẫn cho phép chọn và nhập số lượng
- Không có validation ngăn chặn việc nhập số lượng > `m.stockOnHand`

**Kịch bản lỗi**:
1. Nguyên liệu X có tồn kho: 50
2. Khách chọn X với số lượng: 100
3. Frontend cho phép thêm vào giỏ → tạo đơn thành công
4. Khi Thủ kho pack → backend báo lỗi "Khong du ton Kho"
5. Đơn đã thanh toán nhưng không thể hoàn thành

**Hậu quả**: Khách hàng đã thanh toán nhưng không nhận được hàng, phải hoàn tiền hoặc chờ nhập thêm tồn.

**Fix cần thiết**:
```javascript
// Trong CustomBundlePanel.jsx, khi commitQty:
const commitQty = (skuId) => {
  const material = materials.find(m => m.skuId === skuId)
  if (!material) return
  
  const requested = qtyOf(skuId)
  if (requested > material.stockOnHand) {
    // Hiển thị cảnh báo hoặc tự động cap về stockOnHand
    toast.error(`Chỉ còn ${material.stockOnHand} trong kho, không đủ ${requested}`)
    setQtyMap(prev => ({ ...prev, [skuId]: material.stockOnHand }))
  }
}
```

---

## 2. Thiếu kiểm tra `canUseInCustom` và `productType` khi tạo đơn (Backend)

**File**: `backend/huongvantra_backend/Service/OrderService/OrderService.Application/UseCases/OrderLogic.cs`

**Vấn đề**:
- Khi tạo đơn hàng (dòng 536-558), backend **không validate** `canUseInCustom` và `productType` của nguyên liệu
- Frontend filter tại `CustomBundlePanel.jsx:31`, nhưng backend không có validation tương ứng
- Validation chỉ xảy ra khi pack (dòng 3148-3151), **không phải khi tạo đơn**

**Kịch bản lỗi**:
1. Frontend bị bypass (dev tools, API call trực tiếp)
2. Hoặc: SKU được chọn hợp lệ lúc thêm vào giỏ, nhưng admin disable `canUseInCustom` trước khi checkout
3. Đơn được tạo thành công với nguyên liệu không hợp lệ
4. Khi pack → lỗi "SKU không còn được phép dùng trong Custom"

**Hậu quả**: Đơn đã thanh toán nhưng không thể pack, phải hoàn tiền.

**Fix cần thiết**: Thêm validation tại `CreateOrderAsync` line ~544:
```csharp
// Sau dòng 543 (tạo Ingredients list), trước dòng 558 (gán vào order.CustomBundles):
if (req.CustomBundles != null && req.CustomBundles.Count > 0)
{
    var bundleSkuIds = req.CustomBundles
        .SelectMany(b => b.Ingredients ?? [])
        .Select(i => i.MaterialSkuId)
        .Distinct()
        .ToList();

    if (bundleSkuIds.Count > 0)
    {
        var profiles = await GetRequiredSkuProfilesAsync(bundleSkuIds, ct);
        foreach (var bundle in req.CustomBundles)
        {
            foreach (var ing in bundle.Ingredients ?? [])
            {
                if (!profiles.TryGetValue(ing.MaterialSkuId, out var profile))
                    throw new OrderValidationException($"SKU {ing.MaterialSkuId} không tồn tại.");
                
                if (!profile.CanUseInCustom)
                    throw new OrderValidationException($"SKU {profile.SkuCode} không được phép dùng trong Custom Bundle.");
                
                var pType = (profile.ProductType ?? "").ToUpperInvariant();
                if (pType != "NGUYEN_LIEU" && pType != "BAO_BI")
                    throw new OrderValidationException($"SKU {profile.SkuCode} không phải là nguyên liệu hoặc bao bì.");
            }
        }
    }
}
```

---

## 3. Race condition: SKU bị ngừng bán giữa lúc checkout và pack

**File**: `OrderLogic.cs:3144-3152`

**Vấn đề**:
- Khoảng thời gian giữa **tạo đơn** và **pack** có thể kéo dài (vài phút đến vài giờ)
- Trong khoảng thời gian này, admin có thể disable `canUseInCustom` cho SKU
- Khi Thủ kho pack → validation fail → đơn không thể hoàn thành

**Kịch bản lỗi**:
1. 10:00 - Khách chọn nguyên liệu X (lúc này X.canUseInCustom = true)
2. 10:05 - Khách thanh toán → đơn tạo thành công
3. 10:10 - Admin nhận thấy X không còn dùng được, disable canUseInCustom
4. 10:30 - Thủ kho pack → lỗi "SKU không còn được phép dùng trong Custom"

**Giải pháp**:
- **Option A (khuyến nghị)**: Validation tại thời điểm tạo đơn (fix #2) + snapshot `canUseInCustom` vào `CustomBundleIngredient`
- **Option B**: Khi pack, nếu validation fail do canUseInCustom thay đổi → cho phép override với lý do (ghi audit log)

---

## 4. Thiếu idempotency check khi pack bundle

**File**: `OrderLogic.cs:3136-3175`

**Vấn đề**:
- Chỉ check `PackingStatus == Packed` (dòng 3141-3142)
- Không có idempotency key để ngăn chặn retry request

**Kịch bản lỗi**:
1. Thủ kho click "Pack" → request gửi đến backend
2. Backend gọi `DeductMaterialsAsync` thành công → tồn kho đã trừ
3. Network timeout trước khi response trả về
4. Frontend tự động retry hoặc user click lại
5. Request thứ 2 vào, lúc này `PackingStatus` vẫn là `Pending` (chưa commit transaction đầu tiên)
6. Backend gọi `DeductMaterialsAsync` lần 2 → **trừ tồn 2 lần**

**Hậu quả**: Tồn kho bị trừ nhiều hơn thực tế, gây sai lệch số liệu.

**Fix cần thiết**: Thêm idempotency pattern tương tự `PaymentIdempotencyService`:
```csharp
public async Task<CustomBundleResponse> PackCustomBundleAsync(Guid bundleId, string? idempotencyKey, CancellationToken ct = default)
{
    // Nếu có idempotencyKey, check trước:
    if (!string.IsNullOrWhiteSpace(idempotencyKey))
    {
        var existing = await _customBundleIdempotencyRepo.GetByKeyAsync(idempotencyKey, ct);
        if (existing != null)
            return JsonSerializer.Deserialize<CustomBundleResponse>(existing.ResultJson)!;
    }

    // Logic pack hiện tại...
    var result = MapBundle(bundle);

    // Lưu idempotency record:
    if (!string.IsNullOrWhiteSpace(idempotencyKey))
    {
        await _customBundleIdempotencyRepo.AddAsync(new CustomBundlePackIdempotency {
            IdempotencyKey = idempotencyKey,
            BundleId = bundleId,
            ResultJson = JsonSerializer.Serialize(result),
            CreatedAt = DateTime.UtcNow
        }, ct);
    }

    return result;
}
```

---

## 5. Thiếu transaction rollback khi deduct materials thất bại

**File**: `OrderLogic.cs:3164-3175`

**Vấn đề**:
- Gọi `_inventoryCatalogClient.DeductMaterialsAsync` (HTTP call) **trước** khi update `PackingStatus`
- HTTP call thành công → tồn kho ở InventoryService đã trừ
- Nếu sau đó xảy ra lỗi (network, database) → transaction OrderService rollback
- Nhưng tồn kho ở InventoryService **không được hoàn lại**

**Kịch bản lỗi**:
1. Backend gọi InventoryService → trừ tồn thành công
2. Lưu `PackingStatus = Packed` → lỗi database (connection lost, constraint violation)
3. OrderService transaction rollback → bundle vẫn là `Pending`
4. Tồn kho đã trừ nhưng bundle chưa packed → **mất đồng bộ**

**Hậu quả**: Tồn kho bị trừ nhưng bundle không được đánh dấu packed, user có thể pack lại → trừ tồn 2 lần.

**Giải pháp**:
- **Option A (Saga pattern)**: Thêm compensation transaction
  - Gọi InventoryService trước
  - Nếu fail ở bước sau → gọi `CompensateDeductMaterials` để hoàn lại tồn
- **Option B (Two-phase commit)**: Reserve tồn trước, deduct sau khi pack status committed
- **Option C (Event-driven)**: Emit `CustomBundlePackRequested` event → InventoryService consume và deduct

---

## 6. Frontend tính tổng tiền có bao gồm custom bundle (ĐÃ XỬ LÝ ĐÚNG)

**File**: `PosPage.jsx:203-220`

**Trạng thái**: ✅ **KHÔNG CÓ LỖI**

**Đã kiểm tra**:
- Dòng 206-209: Tính `bundlesTotal` từ `customBundles`
- Dòng 210: `grossSubtotal` bao gồm `+ bundlesTotal`
- Dòng 212: `subtotalAfterItemDiscount` bao gồm `+ bundlesTotal`
- Dòng 220: `total` được tính từ chuỗi calculation có bao gồm `bundlesTotal`

**Kết luận**: Logic tính tổng tiền đã xử lý đúng custom bundle.

---

## Độ ưu tiên sửa

| # | Vấn đề | Độ ưu tiên | Ảnh hưởng |
|---|--------|-----------|-----------|
| 1 | Thiếu validation tồn kho frontend | **HIGH** | Khách thanh toán nhưng không nhận được hàng |
| 2 | Thiếu validation canUseInCustom backend | **HIGH** | Đơn hợp lệ bị block khi pack |
| 4 | Thiếu idempotency check | **MEDIUM** | Trừ tồn nhiều lần (hiếm gặp) |
| 5 | Thiếu transaction rollback | **MEDIUM** | Mất đồng bộ tồn kho (hiếm gặp) |
| 3 | Race condition SKU bị disable | **LOW** | Chỉ xảy ra khi admin thay đổi config giữa checkout và pack |

---

## Khuyến nghị

**Ưu tiên sửa ngay (trong sprint này)**:
1. Fix #1: Validation tồn kho frontend
2. Fix #2: Validation canUseInCustom backend tại CreateOrderAsync

**Sửa trong sprint kế tiếp**:
3. Fix #4: Idempotency cho PackCustomBundleAsync
4. Fix #5: Saga compensation pattern cho cross-service deduct

**Chấp nhận rủi ro (defer)**:
5. Fix #3: Race condition canUseInCustom (xác suất thấp, có thể xử lý manual)

---

## Người liên hệ

- **Phát hiện**: HuyNQ
- **Review**: [Chờ assign]
- **Implementation**: [Chờ assign]
