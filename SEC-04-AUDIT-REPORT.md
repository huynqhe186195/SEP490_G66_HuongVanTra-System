# SEC-04: Audit Report - Product API Authorization

**Ngày audit:** 2026-08-25  
**Phạm vi:** ProductService - tất cả 16 controllers  
**Phương pháp:** Quét tự động bằng authaudit.js + xác minh thủ công

## Tóm tắt

Phát hiện **11 endpoint công khai** không có bảo vệ authorization:
- 8 endpoint GET danh mục (Brands, Categories, AttributeNames, PriceBooks)
- 3 endpoint POST notification nội bộ (đã có validation API key trong code nhưng không dùng attribute)

## Chi tiết từng controller

### 1. AttributeNamesController ❌
**Route:** `api/v1/attribute-names`

| HTTP | Endpoint | Status | Đề xuất |
|------|----------|--------|---------|
| GET | `api/v1/attribute-names` | **OPEN** | Thêm `[Authorize(Policy = PermissionNames.ViewCatalogAccess)]` |
| GET | `api/v1/attribute-names/{id:int}` | **OPEN** | Thêm `[Authorize(Policy = PermissionNames.ViewCatalogAccess)]` |
| POST | `api/v1/attribute-names` | ✅ ManageCatalog | OK |
| PUT | `api/v1/attribute-names/{id:int}` | ✅ ManageCatalog | OK |
| DELETE | `api/v1/attribute-names/{id:int}` | ✅ ManageCatalog | OK |
| POST | `api/v1/attribute-names/{id:int}/restore` | ✅ ManageCatalog | OK |

### 2. BrandsController ❌
**Route:** `api/v1/brands`

| HTTP | Endpoint | Status | Đề xuất |
|------|----------|--------|---------|
| GET | `api/v1/brands` | **OPEN** | Thêm `[Authorize(Policy = PermissionNames.ViewCatalogAccess)]` |
| GET | `api/v1/brands/{id:int}` | **OPEN** | Thêm `[Authorize(Policy = PermissionNames.ViewCatalogAccess)]` |
| POST | `api/v1/brands` | ✅ ManageCatalog | OK |
| PUT | `api/v1/brands/{id:int}` | ✅ ManageCatalog | OK |
| DELETE | `api/v1/brands/{id:int}` | ✅ ManageCatalog | OK |
| POST | `api/v1/brands/{id:int}/restore` | ✅ ManageCatalog | OK |

### 3. CategoriesController ❌
**Route:** `api/v1/categories`

| HTTP | Endpoint | Status | Đề xuất |
|------|----------|--------|---------|
| GET | `api/v1/categories` | **OPEN** | Thêm `[Authorize(Policy = PermissionNames.ViewCatalogAccess)]` |
| GET | `api/v1/categories/{id:int}` | **OPEN** | Thêm `[Authorize(Policy = PermissionNames.ViewCatalogAccess)]` |
| POST | `api/v1/categories` | ✅ ManageCatalog | OK |
| PUT | `api/v1/categories/{id:int}` | ✅ ManageCatalog | OK |
| DELETE | `api/v1/categories/{id:int}` | ✅ ManageCatalog | OK |
| POST | `api/v1/categories/{id:int}/restore` | ✅ ManageCatalog | OK |

### 4. PriceBooksController ❌ **HIGH RISK**
**Route:** `api/v1/price-books`

| HTTP | Endpoint | Status | Đề xuất |
|------|----------|--------|---------|
| GET | `api/v1/price-books` | **OPEN** | Thêm `[Authorize(Policy = PermissionNames.ViewCatalogAccess)]` |
| GET | `api/v1/price-books/{id:guid}` | **OPEN** | Thêm `[Authorize(Policy = PermissionNames.ViewCatalogAccess)]` |
| POST | `api/v1/price-books` | ✅ ManageCatalog | OK |
| PUT | `api/v1/price-books/{id:guid}` | ✅ ManageCatalog | OK |
| DELETE | `api/v1/price-books/{id:guid}` | ✅ ManageCatalog | OK |

**Lưu ý:** PriceBooks chứa thông tin giá nhạy cảm (giá sỉ, giá hợp đồng B2B). Đây là lỗ hổng nghiêm trọng nhất.

### 5. InternalNotificationsController ⚠️ **FALSE POSITIVE**
**Route:** `api/internal/notifications`

| HTTP | Endpoint | Status | Ghi chú |
|------|----------|--------|---------|
| POST | `api/internal/notifications/broadcast` | Có validation | Dòng 28-31: `ValidateInternalApiKey()` |
| POST | `api/internal/notifications/direct` | Có validation | Dòng 54-57: `ValidateInternalApiKey()` |
| POST | `api/internal/notifications/batch` | Có validation | Dòng 80-83: `ValidateInternalApiKey()` |

**Phân tích:** Controller này không dùng attribute `[RequireInternalApiKey]` mà validate API key thủ công trong từng action (dòng 105-120). Cách làm hiện tại **hoạt động** nhưng không thống nhất với pattern của codebase.

**Đề xuất:** Refactor để dùng `[RequireInternalApiKey]` giống `ProductSkusController` (nhất quán, dễ audit sau này).

### 6-16. Các controller còn lại ✅
Tất cả đều bảo vệ đúng:
- **CatalogSyncController**: class-level `[Authorize]`
- **NotificationsController**: class-level `[Authorize]`
- **ProductApprovalRequestsController**: tất cả actions đều có policy
- **ProductCreationRequestsController**: tất cả actions đều có policy
- **ProductDeletionRequestsController**: tất cả actions đều có policy
- **ProductSkusController**: AllowAnonymous đều đi kèm `[RequireInternalApiKey]`
- **ProductsController**: tất cả actions đều có `ViewCatalogAccess` hoặc `ManageCatalog`
- **RetailPriceChangeRequestsController**: tất cả actions đều có policy
- **StoreProductSkusController**: class-level `[Authorize(Policy = PermissionNames.ViewOrder)]`
- **StoreProductsController**: class-level `[Authorize(Policy = PermissionNames.ViewOrder)]`
- **CostBasisReconciliationController**: tất cả actions đều có `ManageBusinessPolicy`

## Nguyên nhân gốc rễ

ProductService **không cấu hình FallbackPolicy** (tất cả user phải authenticated).

```csharp
// Program.cs line 20-21
builder.Services.AddHvtJwtAuthentication(builder.Configuration);
builder.Services.AddHvtPermissionPolicies();  // ← KHÔNG có FallbackPolicy
```

Hệ quả: mọi endpoint không có explicit `[Authorize]` → **công khai hoàn toàn**.

## Định nghĩa ViewCatalogAccess

Từ `AuthorizationServiceExtensions.cs` dòng 66-70:

```csharp
options.AddPolicy(PermissionNames.ViewCatalogAccess, policy =>
    policy.Requirements.Add(new AnyPermissionRequirement(
        PermissionNames.ViewInventory,
        PermissionNames.ManageCatalog,
        PermissionNames.ViewCost)));
```

Policy này cho phép:
- **Thủ kho** (ViewInventory) - cần xem catalog để làm phiếu nhập/xuất
- **Quản lý catalog** (ManageCatalog) - đương nhiên
- **Kế toán** (ViewCost) - cần xem để tính giá vốn

Không cho phép: nhân viên bán hàng/khách hàng xem trực tiếp (họ chỉ được xem qua StoreProducts với ViewOrder).

## Khuyến nghị triển khai

**Priority P0** (cần fix ngay - sensitive data):
1. `PriceBooksController` - GET endpoints → `ViewCatalogAccess`

**Priority P1** (fix trong sprint này):
2. `BrandsController` - GET endpoints → `ViewCatalogAccess`
3. `CategoriesController` - GET endpoints → `ViewCatalogAccess`
4. `AttributeNamesController` - GET endpoints → `ViewCatalogAccess`

**Priority P2** (technical debt):
5. `InternalNotificationsController` - refactor sang `[RequireInternalApiKey]` attribute

## Notes cho HuyTD (người implement)

- Tất cả 8 GET endpoint catalog đều dùng cùng policy: `PermissionNames.ViewCatalogAccess`
- Không phá vỡ tính năng hiện tại: các role Thủ kho/Manager/Kế toán đều đã có quyền này
- Frontend nếu gọi các endpoint này mà chưa authenticated sẽ nhận 401 → cần kiểm tra
- StoreProducts/StoreSkus là endpoint "công khai" cho sale (có ViewOrder là được) → giữ nguyên
