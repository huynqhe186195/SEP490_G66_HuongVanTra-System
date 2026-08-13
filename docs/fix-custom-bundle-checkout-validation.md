# Fix Custom Bundle Validation - Implementation Summary

**Ngày**: 2026-08-12  
**Người thực hiện**: HuyNQ  
**Trạng thái**: ✅ HOÀN THÀNH (2/4 fixes ưu tiên cao)

## Tổng quan

Đã implement fix cho 2 vấn đề ưu tiên cao trong luồng custom bundle:

1. ✅ Frontend: Validation tồn kho khi thêm nguyên liệu
2. ✅ Backend: Validation `canUseInCustom` và `productType` khi tạo đơn

## Chi tiết thay đổi

### 1. Frontend - CustomBundlePanel.jsx

**File**: `frontend/huongvantra-web-client/src/features/pos/components/CustomBundlePanel.jsx`

#### A. Sửa hàm `commitQty` (dòng ~146-164)

**Trước**:
```javascript
const commitQty = (skuId) => {
  setQtyMap((prev) => {
    const n = Math.floor(Number(prev[skuId]))
    return { ...prev, [skuId]: Number.isFinite(n) && n >= 1 ? n : 1 }
  })
}
```

**Sau**:
```javascript
const commitQty = (skuId) => {
  const material = materials.find((m) => m.skuId === skuId)
  if (!material) return

  setQtyMap((prev) => {
    const requested = Math.floor(Number(prev[skuId]))
    const validated = Number.isFinite(requested) && requested >= 1 ? requested : 1

    // Kiểm tra tồn kho: không cho phép đặt số lượng > stockOnHand
    if (validated > material.stockOnHand) {
      toast.error(
        `${material.name}: chỉ còn ${material.stockOnHand} trong kho, không đủ ${validated}`,
        { duration: 4000 }
      )
      return { ...prev, [skuId]: Math.max(1, material.stockOnHand) }
    }

    return { ...prev, [skuId]: validated }
  })
}
```

**Tác dụng**:
- Khi user nhập số lượng và blur ra khỏi input, hệ thống tự động kiểm tra tồn kho
- Nếu số lượng vượt quá tồn kho → hiển thị toast error và tự động cap về `stockOnHand`
- Ngăn chặn user nhập số lượng không hợp lệ ngay từ UI

#### B. Sửa hàm `confirmBundle` (dòng ~161-193)

**Trước**:
```javascript
const confirmBundle = () => {
  if (selectedMaterials.length === 0) return
  const newBundle = {
    label: label.trim() || null,
    note: null,
    ingredients: selectedMaterials.map((m) => {
      const quantity = qtyOf(m.skuId)
      return {
        materialSkuId: m.skuId,
        materialSkuCode: m.skuCode,
        materialSnapshotName: m.name,
        quantity,
        unitPrice: m.unitPrice,
        subTotal: m.unitPrice * quantity,
      }
    }),
  }
  onChange([newBundle])
  setSelected({})
  setQtyMap({})
  setLabel('')
}
```

**Sau**:
```javascript
const confirmBundle = () => {
  if (selectedMaterials.length === 0) return

  // Validation cuối cùng: kiểm tra tồn kho trước khi confirm
  const insufficientItems = selectedMaterials.filter((m) => {
    const requested = qtyOf(m.skuId)
    return requested > m.stockOnHand
  })

  if (insufficientItems.length > 0) {
    const names = insufficientItems.map((m) => 
      `${m.name} (cần ${qtyOf(m.skuId)}, còn ${m.stockOnHand})`
    ).join(', ')
    toast.error(`Không đủ tồn kho: ${names}`, { duration: 5000 })
    return
  }

  const newBundle = {
    label: label.trim() || null,
    note: null,
    ingredients: selectedMaterials.map((m) => {
      const quantity = qtyOf(m.skuId)
      return {
        materialSkuId: m.skuId,
        materialSkuCode: m.skuCode,
        materialSnapshotName: m.name,
        quantity,
        unitPrice: m.unitPrice,
        subTotal: m.unitPrice * quantity,
      }
    }),
  }
  onChange([newBundle])
  setSelected({})
  setQtyMap({})
  setLabel('')
}
```

**Tác dụng**:
- Validation cuối cùng trước khi thêm bundle vào giỏ
- Kiểm tra tất cả nguyên liệu đã chọn có đủ tồn kho không
- Nếu bất kỳ nguyên liệu nào thiếu tồn → hiển thị chi tiết và block việc thêm vào giỏ
- Đây là lớp validation backup phòng trường hợp user thay đổi số lượng nhưng không blur (không trigger `commitQty`)

---

### 2. Backend - OrderLogic.cs

**File**: `backend/huongvantra_backend/Service/OrderService/OrderService.Application/UseCases/OrderLogic.cs`

#### A. Thêm validation khi tạo đơn (dòng ~535-597)

**Vị trí**: Ngay sau dòng `var now = DateTime.UtcNow;` và trước khi gán `order.CustomBundles`

**Code thêm vào**:
```csharp
// Validate custom bundle ingredients trước khi tạo đơn
if (req.CustomBundles != null && req.CustomBundles.Count > 0)
{
    var bundleSkuIds = req.CustomBundles
        .SelectMany(b => b.Ingredients ?? [])
        .Select(i => i.MaterialSkuId)
        .Where(id => id != Guid.Empty)
        .Distinct()
        .ToList();

    if (bundleSkuIds.Count > 0)
    {
        var profiles = await GetRequiredSkuProfilesAsync(bundleSkuIds, ct);
        foreach (var bundle in req.CustomBundles)
        {
            foreach (var ing in bundle.Ingredients ?? [])
            {
                if (ing.MaterialSkuId == Guid.Empty)
                    throw new OrderValidationException("Custom bundle chứa SKU không hợp lệ.");

                if (!profiles.TryGetValue(ing.MaterialSkuId, out var profile))
                    throw new OrderValidationException($"SKU {ing.MaterialSkuId} không tồn tại.");

                if (!profile.CanUseInCustom)
                    throw new OrderValidationException(
                        $"SKU {profile.SkuCode ?? ing.MaterialSkuCode} không được phép dùng trong Custom Bundle.");

                var pType = (profile.ProductType ?? "").ToUpperInvariant();
                if (pType != "NGUYEN_LIEU" && pType != "BAO_BI")
                    throw new OrderValidationException(
                        $"SKU {profile.SkuCode ?? ing.MaterialSkuCode} không phải là nguyên liệu hoặc bao bì.");

                if (ing.Quantity <= 0)
                    throw new OrderValidationException(
                        $"SKU {profile.SkuCode ?? ing.MaterialSkuCode} có số lượng không hợp lệ.");
            }
        }
    }
}
```

**Tác dụng**:
- Kiểm tra tất cả SKU trong custom bundle có tồn tại không
- Kiểm tra `canUseInCustom` flag → chỉ cho phép SKU được đánh dấu
- Kiểm tra `productType` phải là `NGUYEN_LIEU` hoặc `BAO_BI`
- Kiểm tra số lượng phải > 0
- **Ngăn chặn frontend bypass**: Ngay cả khi request từ Postman/curl, backend vẫn validate đầy đủ
- **Fail-fast**: Lỗi phát hiện ngay khi tạo đơn, không phải đợi đến lúc pack

#### B. Cải thiện comment tại PackCustomBundleAsync (dòng ~3177-3187)

**Thêm comment**:
```csharp
// Validation tăng cường: kiểm tra lại canUseInCustom và productType tại thời điểm pack
// để phát hiện trường hợp SKU bị disable sau khi đơn được tạo
```

**Tác dụng**:
- Làm rõ mục đích của validation tại `PackCustomBundleAsync`
- Giải thích tại sao cần validate 2 lần (tại create và tại pack)
- Giúp maintainer hiểu business logic

---

## Kịch bản đã được fix

### Kịch bản 1: User nhập số lượng > tồn kho

**Trước**:
1. Nguyên liệu X có tồn: 50
2. User nhập số lượng: 100
3. Thêm vào giỏ thành công
4. Checkout thành công
5. Pack thất bại → khách đã thanh toán nhưng không nhận được hàng

**Sau**:
1. Nguyên liệu X có tồn: 50
2. User nhập số lượng: 100
3. Blur khỏi input → toast error "X: chỉ còn 50 trong kho, không đủ 100"
4. Số lượng tự động giảm về 50
5. User biết ngay tồn kho không đủ, có thể điều chỉnh hoặc chọn nguyên liệu khác

### Kịch bản 2: Frontend bị bypass

**Trước**:
1. Hacker gọi API trực tiếp với SKU không phải nguyên liệu (VD: thành phẩm)
2. Đơn tạo thành công
3. Pack thất bại → đơn stuck ở trạng thái Pending

**Sau**:
1. Hacker gọi API với SKU không hợp lệ
2. Backend validation fail ngay: "SKU ABC không phải là nguyên liệu hoặc bao bì"
3. Đơn không được tạo
4. Hệ thống an toàn

### Kịch bản 3: Admin disable SKU sau khi user chọn

**Trước**:
1. 10:00 - User chọn nguyên liệu X (X.canUseInCustom = true)
2. 10:05 - User checkout thành công
3. 10:10 - Admin disable X.canUseInCustom
4. 10:30 - Thủ kho pack → fail "SKU không còn được phép"

**Sau** (với fix hiện tại):
1. 10:00 - User chọn X (X.canUseInCustom = true)
2. 10:05 - User checkout → backend validate ngay → thành công
3. 10:10 - Admin disable X.canUseInCustom
4. 10:30 - Thủ kho pack → vẫn fail (race condition vẫn tồn tại)

**Lưu ý**: Race condition này cần fix riêng (defer sang sprint sau - xem phần "Công việc còn lại")

---

## Testing checklist

### Frontend testing:
- [ ] Chọn nguyên liệu có tồn đủ → số lượng bình thường → confirm thành công
- [ ] Nhập số lượng > tồn kho → blur ra → toast error hiện + số lượng cap về max
- [ ] Chọn nhiều nguyên liệu, 1 cái không đủ tồn → click "Thêm vào đơn" → toast error chi tiết
- [ ] Chọn nguyên liệu tồn = 0 → vẫn hiển thị màu đỏ nhưng không thể thêm số lượng > 0

### Backend testing:
- [ ] Tạo đơn với custom bundle hợp lệ → thành công
- [ ] Gọi API với SKU không tồn tại → 400 "SKU xxx không tồn tại"
- [ ] Gọi API với SKU có canUseInCustom = false → 400 "không được phép dùng trong Custom Bundle"
- [ ] Gọi API với SKU không phải NGUYEN_LIEU/BAO_BI → 400 "không phải là nguyên liệu"
- [ ] Gọi API với quantity = 0 hoặc âm → 400 "số lượng không hợp lệ"
- [ ] Gọi API với MaterialSkuId = Guid.Empty → 400 "SKU không hợp lệ"

---

## Công việc còn lại (defer)

### Ưu tiên MEDIUM (sprint kế tiếp):

**3. Idempotency cho PackCustomBundleAsync**
- Tạo table `CustomBundlePackIdempotency` (pattern giống `PaymentIdempotency`)
- Schema:
  ```sql
  CREATE TABLE CustomBundlePackIdempotencies (
    Id CHAR(36) PRIMARY KEY,
    IdempotencyKey VARCHAR(255) NOT NULL UNIQUE,
    BundleId CHAR(36) NOT NULL,
    ResultJson TEXT NOT NULL,
    CreatedAt DATETIME(6) NOT NULL,
    INDEX idx_bundleId (BundleId)
  );
  ```
- Sửa `PackCustomBundleAsync` signature: thêm param `string? idempotencyKey`
- Frontend gửi idempotency key (VD: `{bundleId}-{timestamp}-{randomUuid}`)
- Backend check key trước khi pack, trả về cached result nếu đã pack

**4. Saga compensation cho cross-service deduct**
- Option A: Thêm endpoint `POST /api/v1/inventory/compensate-deduct-materials`
- Khi `PackCustomBundleAsync` fail sau khi gọi `DeductMaterialsAsync` → gọi compensate
- Hoặc Option B: Chuyển sang event-driven (emit `CustomBundlePackRequested` → InventoryService consume)

### Ưu tiên LOW (chấp nhận rủi ro):

**5. Race condition: SKU bị disable giữa checkout và pack**
- Option A: Snapshot `canUseInCustom` vào `CustomBundleIngredient` table
- Option B: Cho phép Thủ kho override validation khi pack (với lý do + audit log)
- Đánh giá: Xác suất thấp, có thể xử lý manual khi xảy ra

---

## Files đã thay đổi

1. `frontend/huongvantra-web-client/src/features/pos/components/CustomBundlePanel.jsx`
   - Sửa `commitQty`: thêm stock validation + toast error
   - Sửa `confirmBundle`: thêm final validation trước khi add bundle

2. `backend/huongvantra_backend/Service/OrderService/OrderService.Application/UseCases/OrderLogic.cs`
   - Thêm validation block trong `CreateOrderAsync` (line ~537-573)
   - Thêm comment trong `PackCustomBundleAsync` (line ~3179-3180)

3. `docs/custom-bundle-validation-issues.md` (báo cáo phân tích)
4. `docs/fix-custom-bundle-checkout-validation.md` (file này)

---

## Build status

- ⏳ **Backend**: Chưa build (dotnet build blocked by auto mode)
- ⏳ **Frontend**: Chưa build (npm run build blocked by auto mode)

**Cần test thủ công**:
```bash
# Backend
cd backend/huongvantra_backend/Service/OrderService
dotnet build

# Frontend
cd frontend/huongvantra-web-client
npm run build
```

---

## Người liên hệ

- **Implementation**: HuyNQ
- **Review**: [Chờ assign]
- **QA Testing**: [Chờ assign]
