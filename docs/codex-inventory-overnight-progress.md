# Codex Inventory Overnight Progress

## Current Phase

- Phase 4 - Integration stabilization and regression checks.
- Phase 4 source/build/runtime/API smoke checks passed; tracker update is ready to commit locally.

## Completed Phases

- Phase 0 - Safety, baseline, and source inspection.
- Phase 1 - Complete Flow 2A: sell-first, deduct branch/counter stock later.
  - Commit: `e499e65 feat(inventory): complete sell-first stock deduction flow`
- Phase 2 - New Product Creation Approval for `/inventory/products/create`.
  - Commit: `7f7c240 feat(product): add new product approval workflow`
- Phase 3 - Role and wording cleanup across Inventory.
  - Commit: `26bb277 chore(inventory): align warehouse and manager role scope`
- Phase 4 - Integration stabilization and regression checks.
  - Source/build/runtime/API smoke checks passed.
  - No production code changes were required in this phase.
  - Commit pending for this tracker update.

## Pending Phases

- Phase 5 - Final report.

## Branch And Working Tree

- Branch: `HuyTD`
- Initial working tree: clean.
- Recent commits:
  - `18e7438 Merge remote-tracking branch 'origin/HuyNQ-06' into HuyTD`
  - `c5693c3 fix customer type display error`
  - `f008fcb fix conflict and merge code`
  - `262ef6b Update inventory`
  - `cb35160 Merge branch 'main' into HuyNQ-06`

## Phase 0 Inspection Summary

### StockDeductQueue / Flow 2A

Detected backend source:

- `Service/InventoryService/InventoryService.Domain/Entities/StockDeductQueue.cs`
- `Service/InventoryService/InventoryService.Domain/Entities/StockDeductQueueItem.cs`
- `Service/InventoryService/InventoryService.Domain/Enums/QueueStatus.cs`
- `Service/InventoryService/InventoryService.WebAPI/Controllers/StockDeductQueueController.cs`
- `Service/InventoryService/InventoryService.Infrastructure/Repositories/StockDeductQueueRepository.cs`
- `Service/InventoryService/InventoryService.Application/UseCases/InventoryLogic.cs`
- `Service/InventoryService/InventoryService.Application/DTOs/Requests/InventoryRequests.cs`
- `Service/InventoryService/InventoryService.Application/DTOs/Responses/InventoryResponses.cs`
- `Service/InventoryService/InventoryService.Infrastructure/Data/Configurations/InventoryConfigurations.cs`
- `Shared_Libraries/HuongVanTra.Shared/Messages/OrderPlacedEvent.cs`
- `Shared_Libraries/HuongVanTra.Shared/Messages/StockDeductedEvent.cs`
- `Service/OrderService/OrderService.Infrastructure/Messaging/StockDeductedConsumer.cs`
- `Service/OrderService/OrderService.Application/UseCases/OrderLogic.cs`
- `Service/OrderService/OrderService.Domain/Enums/OrderEnums.cs`

Current behavior observed from source:

- `OrderPlacedEvent` creates `StockDeductQueue` with `QueueStatus.Waiting`.
- Existing `QueueStatus` only has `Waiting`, `Confirmed`, `Cancelled`.
- `StockDeductQueueController` currently protects list/preview/confirm/cancel with `PermissionNames.ViewOrder`.
- `StockDeductQueueRepository` currently returns only `QueueStatus.Waiting`; the `status` query parameter is ignored in controller.
- `PreviewQueueAsync` calculates shortage against `SkuStock.QuantityOnHand`.
- `ConfirmQueueAsync` deducts `SkuStock.QuantityOnHand`, not `WarehouseQuantityOnHand`.
- If stock is insufficient, `ConfirmQueueAsync` throws `InsufficientStockException`; it does not persist an `Insufficient` queue status.
- `CancelQueueAsync` ignores `CancelStockDeductRequest.Reason`; cancel reason is not required or saved.
- Confirm/cancel audit fields such as `ConfirmedByName`, `CancelledByName`, `LastAttemptAt`, `LastShortageReason` do not exist on `StockDeductQueue`.
- Successful confirm publishes `StockDeductedEvent`; `OrderService` consumes it and calls `MarkInventorySyncedAsync`.
- There is no detected cancellation event back to `OrderService`, so cancelled queues may not update order inventory sync status.
- Existing `StockExportSlip` and `StockExportSlipLine` already have store before/after fields (`StoreQtyBefore`, `StoreQtyAfter`) that can support a sales deduct-later voucher without adding those specific fields.

Detected frontend source:

- `frontend/huongvantra-web-client/src/app/App.jsx`
- `frontend/huongvantra-web-client/src/app/navigation.js`
- `frontend/huongvantra-web-client/src/features/inventory/pages/StockDeductQueuePage.jsx`
- `frontend/huongvantra-web-client/src/features/inventory/components/StockDeductPreviewModal.jsx`
- `frontend/huongvantra-web-client/src/features/inventory/services/stockDeductQueueApi.js`
- `frontend/huongvantra-web-client/src/features/orders/utils/orderDisplay.js`

Current frontend behavior observed from source:

- `/orders/stock-deduct` route exists.
- Sidebar module `stock_deduct_ops` is currently in `SIDEBAR_DISABLED_MODULES`, so it is hidden from sidebar.
- `canConfirmStockDeduct()` currently allows `admin` and `inventoryManager`, not `Manager`.
- Wording still presents warehouse/Thu kho as primary actor in this flow.
- Page has partial tabs for all/waiting/insufficient, but backend does not yet honor status filtering or persist insufficient queues.
- Preview modal can call confirm but has no final confirmation modal and no cancel-reason modal.

### Product Approval / Product Creation

Detected backend source:

- `Service/ProductService/ProductService.Domain/Entities/Product.cs`
- `Service/ProductService/ProductService.Domain/Entities/ProductVariant.cs`
- `Service/ProductService/ProductService.Domain/Entities/ProductVariantBomLine.cs`
- `Service/ProductService/ProductService.Application/DTOs/Requests/ProductRequests.cs`
- `Service/ProductService/ProductService.Application/DTOs/Responses/ProductResponse.cs`
- `Service/ProductService/ProductService.Application/UseCases/ProductLogic.cs`
- `Service/ProductService/ProductService.Infrastructure/Data/ProductDbContext.cs`
- `Service/ProductService/ProductService.WebAPI/Controllers/ProductsController.cs`

Current behavior observed from source:

- No existing `ProductApproval`, `ProductApprovalRequest`, `NewProductApprovalRequest`, or `ApprovalCode` implementation was found.
- `POST /api/v1/products` currently creates products directly and is authorized with `[Authorize(Roles = "Warehouse")]`.
- Product variants/SKUs are represented by `ProductVariant`.
- BOM is stored on `ProductVariantBomLine` by `ProductVariantId`.
- `ProductLogic.CreateAsync()` validates product, units, variants, duplicate product name and duplicate variant SKU, then creates product/variants/BOM together through `ProductRepository`.
- Product response already includes `HasBom` and `BomLineCount` from real `ProductVariant.BomLines`.

Detected frontend source:

- `frontend/huongvantra-web-client/src/features/products/pages/ProductFormPage.jsx`
- `frontend/huongvantra-web-client/src/features/products/services/productsApi.js`
- `frontend/huongvantra-web-client/src/features/auth/utils/permissions.js`
- `frontend/huongvantra-web-client/src/app/App.jsx`
- `frontend/huongvantra-web-client/src/app/navigation.js`

Current frontend behavior observed from source:

- `/inventory/products/create` renders `ProductFormPage` in create mode.
- `ProductFormPage` submits directly through `createProduct()` -> `POST /api/v1/products`.
- `canCreateCatalog()` currently checks warehouse role only.
- `canManageCatalog()` allows `MANAGE_CATALOG`, `MANAGE_ROLE`, or warehouse role.
- There is no current approval-code entry step or Admin product-approval page.

### Role/Permission Baseline

- UserService seeding has roles: `Admin`, `Sale`, `Warehouse`, `Accountant`, `Manager`.
- `Warehouse` currently has `VIEW_ORDER` and `MANAGE_CATALOG`.
- `Manager` currently has `CREATE_ORDER`, `VIEW_ORDER`, `VIEW_ALL_CUSTOMERS`, `MANAGE_EMPLOYEE`, `CREATE_CUSTOMER`, `VIEW_CUSTOMER`.
- Shared `PermissionNames` includes `CREATE_ORDER`, `VIEW_ORDER`, `MANAGE_CATALOG`, `MANAGE_ROLE`, but no dedicated stock deduction confirm permission.
- Frontend role groups currently map `inventoryManager` aliases to Warehouse/Thu kho and `agencyManager` aliases to Manager.

### Migration Baseline

InventoryService latest detected migrations include:

- `20260701123000_AddStockImportSlipLines`
- `20260702120000_AddSlipCreatorSnapshots`
- `20260706120000_RefactorProductionOrdersToMultiOutput`
- `20260706123000_AddProductionOrderOutputLineExpiry`

ProductService latest detected migrations include:

- `20260614092529_AddBrandAttributeNameProductTypeBomLines`
- `20260628000000_RemoveProductSkusAddVariantSyncFields`

OrderService latest detected migrations include:

- `20260628215806_AddOrderIdempotencyKey`
- `20260629120000_AddCustomBundles`

### Gateway Baseline

- Gateway has routes for `/api/stock-deduct-queue/{**catch-all}` to `inventory-cluster`.
- Gateway has routes for `/api/v1/products` and `/api/v1/products/{**catch-all}` to ProductService.
- No product approval routes were detected.

### Docker Baseline

- `docker compose ps` from `backend/huongvantra_backend` failed because Docker Desktop / Docker API pipe was unavailable:
  - `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`
- Docker is therefore not available for Phase 0 verification in this run.

## Files Changed

- `docs/codex-inventory-overnight-progress.md`
- Phase 1 implementation files committed in `e499e65`:
  - `backend/huongvantra_backend/Shared_Libraries/HuongVanTra.Shared/Messages/StockDeductedEvent.cs`
  - `backend/huongvantra_backend/Service/InventoryService/InventoryService.Domain/Enums/QueueStatus.cs`
  - `backend/huongvantra_backend/Service/InventoryService/InventoryService.Domain/Entities/StockDeductQueue.cs`
  - `backend/huongvantra_backend/Service/InventoryService/InventoryService.Application/DTOs/Responses/InventoryResponses.cs`
  - `backend/huongvantra_backend/Service/InventoryService/InventoryService.Application/Interfaces/IInventoryEventPublisher.cs`
  - `backend/huongvantra_backend/Service/InventoryService/InventoryService.Application/Interfaces/IStockDeductQueueRepository.cs`
  - `backend/huongvantra_backend/Service/InventoryService/InventoryService.Application/UseCases/InventoryLogic.cs`
  - `backend/huongvantra_backend/Service/InventoryService/InventoryService.Infrastructure/Data/Configurations/InventoryConfigurations.cs`
  - `backend/huongvantra_backend/Service/InventoryService/InventoryService.Infrastructure/Messaging/InventoryEventPublisher.cs`
  - `backend/huongvantra_backend/Service/InventoryService/InventoryService.Infrastructure/Repositories/StockDeductQueueRepository.cs`
  - `backend/huongvantra_backend/Service/InventoryService/InventoryService.WebAPI/Controllers/StockDeductQueueController.cs`
  - `backend/huongvantra_backend/Service/InventoryService/InventoryService.Infrastructure/Migrations/InventoryDbContextModelSnapshot.cs`
  - `backend/huongvantra_backend/Service/InventoryService/InventoryService.Infrastructure/Migrations/20260712100000_AddStockDeductQueueAuditAndInsufficientStatus.cs`
  - `backend/huongvantra_backend/Service/InventoryService/InventoryService.Infrastructure/Migrations/20260712100000_AddStockDeductQueueAuditAndInsufficientStatus.Designer.cs`
  - `backend/huongvantra_backend/Service/OrderService/OrderService.Application/UseCases/OrderLogic.cs`
  - `backend/huongvantra_backend/Service/OrderService/OrderService.Infrastructure/Messaging/StockDeductedConsumer.cs`
  - `frontend/huongvantra-web-client/src/app/navigation.js`
  - `frontend/huongvantra-web-client/src/features/inventory/components/StockDeductPreviewModal.jsx`
  - `frontend/huongvantra-web-client/src/features/inventory/pages/StockDeductQueuePage.jsx`
  - `frontend/huongvantra-web-client/src/features/inventory/services/stockDeductQueueApi.js`
  - `frontend/huongvantra-web-client/src/features/orders/utils/orderDisplay.js`
- Phase 2 implementation files committed in `7f7c240`:
  - `backend/huongvantra_backend/Service/ProductService/ProductService.Domain/Entities/NewProductApprovalRequest.cs`
  - `backend/huongvantra_backend/Service/ProductService/ProductService.Domain/Enums/NewProductApprovalStatus.cs`
  - `backend/huongvantra_backend/Service/ProductService/ProductService.Domain/Enums/ProductCreationMethod.cs`
  - `backend/huongvantra_backend/Service/ProductService/ProductService.Application/DTOs/Requests/ProductApprovalRequests.cs`
  - `backend/huongvantra_backend/Service/ProductService/ProductService.Application/DTOs/Responses/ProductApprovalResponses.cs`
  - `backend/huongvantra_backend/Service/ProductService/ProductService.Infrastructure/Data/Configurations/NewProductApprovalRequestConfiguration.cs`
  - `backend/huongvantra_backend/Service/ProductService/ProductService.Infrastructure/Data/ProductDbContext.cs`
  - `backend/huongvantra_backend/Service/ProductService/ProductService.Infrastructure/Migrations/20260712120000_AddNewProductApprovalRequests.cs`
  - `backend/huongvantra_backend/Service/ProductService/ProductService.Infrastructure/Migrations/ProductDbContextModelSnapshot.cs`
  - `backend/huongvantra_backend/Service/ProductService/ProductService.Infrastructure/UseCases/ProductApprovalLogic.cs`
  - `backend/huongvantra_backend/Service/ProductService/ProductService.WebAPI/Controllers/ProductApprovalRequestsController.cs`
  - `backend/huongvantra_backend/Service/ProductService/ProductService.WebAPI/Extensions/ProductClaimsExtensions.cs`
  - `backend/huongvantra_backend/Service/ProductService/ProductService.WebAPI/Program.cs`
  - `backend/huongvantra_backend/API_Gateway/HuongVanTra.Gateway/appsettings.json`
  - `frontend/huongvantra-web-client/src/app/App.jsx`
  - `frontend/huongvantra-web-client/src/app/navigation.js`
  - `frontend/huongvantra-web-client/src/features/auth/services/authApi.js`
  - `frontend/huongvantra-web-client/src/features/products/pages/ProductApprovalsPage.jsx`
  - `frontend/huongvantra-web-client/src/features/products/pages/ProductFormPage.jsx`
  - `frontend/huongvantra-web-client/src/features/products/services/productsApi.js`
- Phase 3 wording cleanup files committed in `26bb277`:
  - `backend/huongvantra_backend/Service/ProductService/ProductService.Application/CatalogViewScope.cs`
  - `backend/huongvantra_backend/Service/UserService/UserService.Infrastructure/Data/DataSeeder.cs`
  - `frontend/huongvantra-web-client/src/app/navigation.js`
  - `frontend/huongvantra-web-client/src/features/iam/utils/iamLabels.js`
  - `frontend/huongvantra-web-client/src/features/inventory/components/InventorySlipDocument.jsx`
  - `frontend/huongvantra-web-client/src/features/orders/pages/OrdersPage.jsx`
  - `frontend/huongvantra-web-client/src/features/products/pages/ProductApprovalsPage.jsx`
  - `frontend/huongvantra-web-client/src/features/products/pages/ProductFormPage.jsx`
- Phase 4 changed files:
  - `docs/codex-inventory-overnight-progress.md`

## Migrations Added

- Phase 1 added and applied:
  - `20260712100000_AddStockDeductQueueAuditAndInsufficientStatus`
- Phase 2 added and applied:
  - `20260712120000_AddNewProductApprovalRequests`

## Commands Run

- `git branch --show-current` - passed, output `HuyTD`.
- `git status --short` - passed, output empty.
- `git log --oneline -5` - passed.
- `Test-Path docs\codex-inventory-overnight-progress.md` - passed, output `False`.
- `docker compose ps` from `backend/huongvantra_backend` - failed because Docker API was unavailable.
- `rg` searches for StockDeductQueue, Product Approval, routes, migrations, roles, permissions - passed.
- `Get-Content` inspections for StockDeductQueue/Product/Order/User/frontend route and service files - passed.
- `dotnet build Service/InventoryService/InventoryService.WebAPI/InventoryService.WebAPI.csproj` - first attempt failed in sandbox with `NU1301`; escalated retry passed with one existing nullable warning in `WarehouseBatchRepository.cs`.
- `dotnet build Service/OrderService/OrderService.WebAPI/OrderService.WebAPI.csproj` - passed with one existing unused-variable warning in `OrderLogic.cs`.
- `npm.cmd run build` from `frontend/huongvantra-web-client` - passed with existing Vite dynamic import/chunk size warnings.
- `docker compose ps` retry from `backend/huongvantra_backend` - still failed because Docker API pipe was unavailable.
- `git diff --check` - passed; only Windows LF/CRLF warnings.
- Resume command `git branch --show-current` - passed, output `HuyTD`.
- Resume command `git status --short` - passed, Phase 1 source changes present and uncommitted.
- Resume command `git log --oneline -5` - passed, latest commit is `7ed93c9`.
- `docker version` - passed, Docker Desktop is available.
- `docker compose ps` - passed, backend containers are running; `hvt-inventory-service` and `hvt-order-service` are healthy before rebuild.
- `docker compose build inventory-service order-service` - passed.
- `docker compose up -d --no-deps inventory-service order-service` - passed, both containers recreated and started.
- `docker compose logs inventory-service --tail 300` - passed; service started and no migration/runtime failure was observed.
- `docker compose logs order-service --tail 300` - passed; service started and no runtime failure was observed.
- DB verification through `docker exec -i hvt-mysql mysql ... hvt_inventory_db` - passed; migration exists and all Phase 1 columns exist.
- Log filtering for `migration failure`, `duplicate column`, `unknown column`, `table already exists`, `unhandled exception`, `crash`, `fail`, `error`, `exception` - passed; no matching service error lines.
- `docker compose ps inventory-service order-service` - passed; both services are healthy after restart.
- Final `dotnet build Service/InventoryService/InventoryService.WebAPI/InventoryService.WebAPI.csproj` - first sandbox attempt failed with `NU1301`; escalated retry passed with one existing nullable warning in `WarehouseBatchRepository.cs`.
- Final `dotnet build Service/OrderService/OrderService.WebAPI/OrderService.WebAPI.csproj` - passed with 0 warnings and 0 errors.
- Final `npm.cmd run build` - passed with existing Vite dynamic import/chunk size warnings.
- Final `git diff --check` - passed; only Windows LF/CRLF warnings.
- `git add -A` - passed; staged Phase 1 verified changes.
- `git commit -m "feat(inventory): complete sell-first stock deduction flow"` - passed; created commit `e499e65`.
- Phase 2 `dotnet build Service/ProductService/ProductService.WebAPI/ProductService.WebAPI.csproj` - first sandbox attempt failed with `NU1301`; escalated retry passed.
- Phase 2 `npm.cmd run build` - passed with existing Vite dynamic import/chunk size warnings.
- Phase 2 final `dotnet build Service/ProductService/ProductService.WebAPI/ProductService.WebAPI.csproj` - passed with 0 warnings and 0 errors.
- Phase 2 `dotnet build API_Gateway/HuongVanTra.Gateway/HuongVanTra.Gateway.csproj` - passed with 0 warnings and 0 errors.
- `docker compose build product-service gateway` - passed.
- `docker compose up -d --no-deps product-service gateway` - passed; both containers recreated/started and `product-service` is healthy.
- `docker compose logs product-service --tail 300` - passed; service started without migration/runtime failure.
- `docker compose logs gateway --tail 200` - passed; gateway started and loaded proxy config.
- DB verification through `docker exec -i hvt-mysql mysql ... hvt_product_db` - passed; migration exists and `NewProductApprovalRequests` table/columns/index exist.
- Log filtering for ProductService/Gateway migration/runtime error patterns - passed; no matching service error lines.
- `curl.exe -i http://localhost:5000/api/v1/product-approval-requests` - returned `401 Unauthorized`, confirming Gateway route exists.
- `curl.exe -i http://localhost:5003/api/v1/product-approval-requests` - returned `401 Unauthorized`, confirming ProductService controller exists.
- Admin API smoke check through Gateway - login `admin`, `GET /api/v1/product-approval-requests?page=1&pageSize=5&status=all` returned `HTTP 200`.
- Manager permission smoke check through Gateway - login `manager01`, `POST /api/v1/product-approval-requests/validate-code` returned `HTTP 403`.
- Phase 2 final `git diff --check` - passed; only Windows LF/CRLF warnings.
- `git add -A` - passed; staged Phase 2 verified changes.
- `git commit -m "feat(product): add new product approval workflow"` - passed; created commit `7f7c240`.
- Phase 3 `rg` searches for role wording and inventory/order/product labels - passed; no remaining `Chờ trừ kho` wording in inspected areas.
- Phase 3 `dotnet build Service/ProductService/ProductService.WebAPI/ProductService.WebAPI.csproj` - first sandbox attempt failed with `NU1301`; escalated retry passed with 0 warnings and 0 errors.
- Phase 3 `dotnet build Service/UserService/UserService.WebAPI/UserService.WebAPI.csproj` - first sandbox attempt failed with `NU1301`; escalated retry passed with 0 warnings and 0 errors.
- Phase 3 `npm.cmd run build` - passed with existing Vite dynamic import/chunk size warnings.
- Phase 3 `git diff --check` - passed; only Windows LF/CRLF warnings.
- `git add -A` - passed; staged Phase 3 verified changes.
- `git commit -m "chore(inventory): align warehouse and manager role scope"` - passed; created commit `26bb277`.
- Phase 4 source regression inspection for Production Order expiry, exact-SKU warehouse lots, manual import slips, stock deduct queue, Product Approval routes, and OrderService stock sync consumer - passed; no new code changes required.
- Phase 4 `dotnet build Service/InventoryService/InventoryService.WebAPI/InventoryService.WebAPI.csproj` - passed with one existing nullable warning in `WarehouseBatchRepository.cs`.
- Phase 4 `dotnet build Service/ProductService/ProductService.WebAPI/ProductService.WebAPI.csproj` - passed with 0 warnings and 0 errors.
- Phase 4 `dotnet build Service/OrderService/OrderService.WebAPI/OrderService.WebAPI.csproj` - passed with one existing unused-variable warning in `OrderLogic.cs`.
- Phase 4 `dotnet build API_Gateway/HuongVanTra.Gateway/HuongVanTra.Gateway.csproj` - passed with 0 warnings and 0 errors.
- Phase 4 `dotnet build Service/UserService/UserService.WebAPI/UserService.WebAPI.csproj` - passed with 0 warnings and 0 errors.
- Phase 4 `npm.cmd run build` - passed with existing Vite dynamic import/chunk size warnings.
- Phase 4 `git diff --check` - passed.
- Phase 4 `docker compose ps` - passed; affected services were running before restart.
- Phase 4 `docker compose build inventory-service product-service order-service gateway user-service` - passed.
- Phase 4 `docker compose up -d --no-deps inventory-service product-service order-service gateway user-service` - passed.
- Phase 4 logs for `inventory-service`, `product-service`, `order-service`, `gateway`, and `user-service` - passed; no migration failure/runtime crash observed.
- Phase 4 log filtering for migration/runtime error patterns - passed; no matching service error lines.
- Phase 4 `docker compose ps inventory-service product-service order-service gateway user-service` - passed; `inventory-service`, `product-service`, `order-service`, and `user-service` are healthy; `gateway` is running.
- Phase 4 Inventory DB verification through `docker exec -i hvt-mysql mysql ... hvt_inventory_db` - passed:
  - `20260706123000_AddProductionOrderOutputLineExpiry` exists.
  - `20260712100000_AddStockDeductQueueAuditAndInsufficientStatus` exists.
  - `ProductionOrderOutputLines.ExpiresAt` exists as nullable `datetime(6)`.
  - `ProductionOrderOutputLines.PlannedQuantity` exists.
  - unique index `IX_ProductionOrderOutputLines_ProductionOrderId_FinishedSkuId` exists.
  - no `ProductionOrders` row is missing output lines.
  - `StockDeductQueues` audit/shortage columns exist.
- Phase 4 Product DB verification through `docker exec -i hvt-mysql mysql ... hvt_product_db` - passed:
  - `20260712120000_AddNewProductApprovalRequests` exists.
  - `NewProductApprovalRequests` table exists.
  - `ApprovalCode`, `Status`, and `ManualModeReason` exist.
  - unique index `IX_NewProductApprovalRequests_ApprovalCode` exists.
- Phase 4 no-token Gateway smoke checks - passed:
  - `/api/v1/product-approval-requests` returned `401`, not `404`.
  - `/api/stock-deduct-queue/waiting` returned `401`, not `404`.
  - `/api/v1/inventory/stock-import-slips` returned `401`, not `404`.
- Phase 4 authenticated Gateway smoke checks - passed:
  - Admin `GET /api/v1/product-approval-requests?page=1&pageSize=5&status=all` returned `HTTP 200`.
  - Manager `GET /api/stock-deduct-queue/waiting?page=1&pageSize=5&status=all` returned `HTTP 200`.
  - Manager `POST /api/v1/product-approval-requests/validate-code` returned `HTTP 403`.

## Tests/Builds Run

- Phase 0: source inspection only.
- Phase 1:
  - InventoryService targeted build.
  - OrderService targeted build.
  - Frontend production build.
  - `git diff --check`.
  - Docker availability check.

## Tests/Builds Passed

- InventoryService targeted build passed after running outside the restricted network sandbox.
- OrderService targeted build passed.
- Frontend production build passed.
- `git diff --check` passed.
- Docker build/restart of `inventory-service` and `order-service` passed.
- Phase 1 migration exists in `__EFMigrationsHistory`.
- `StockDeductQueues` contains:
  - `ConfirmedBy`
  - `ConfirmedByName`
  - `ConfirmedByRoleName`
  - `CancelledBy`
  - `CancelledByName`
  - `CancelledByRoleName`
  - `CancelReason`
  - `LastAttemptAt`
  - `LastShortageReason`
- Phase 2 ProductService targeted build passed.
- Phase 2 Gateway targeted build passed.
- Phase 2 frontend production build passed.
- Docker build/restart of `product-service` and `gateway` passed.
- Phase 2 migration exists in `hvt_product_db.__EFMigrationsHistory`.
- `NewProductApprovalRequests` contains:
  - `ApprovalCode`
  - `Status`
  - `ProductSnapshotJson`
  - `FinalProductSnapshotJson`
  - `ManualModeReason`
  - `CreatedProductId`
- `IX_NewProductApprovalRequests_ApprovalCode` exists and is unique.
- Gateway route `/api/v1/product-approval-requests` returns `401` without token instead of `404`.
- Admin list API returns `HTTP 200`; Manager validate-code API returns `HTTP 403`.
- Phase 3 ProductService targeted build passed.
- Phase 3 UserService targeted build passed.
- Phase 3 frontend production build passed.
- Phase 3 `git diff --check` passed.
- Phase 4 InventoryService/ProductService/OrderService/Gateway/UserService targeted builds passed.
- Phase 4 frontend production build passed.
- Phase 4 source regression inspection passed without additional source changes.
- Phase 4 Docker build/restart/log checks passed.
- Phase 4 DB migration/schema checks passed.
- Phase 4 Gateway API smoke checks passed.

## Tests/Builds Failed Or Blocked

- Initial InventoryService build failed only because sandbox blocked NuGet network access (`NU1301`); escalated retry passed.
- Earlier `docker compose ps` failed because Docker daemon/API was unavailable; retry after Docker startup passed.
- Phase 2 initial ProductService build failed only because sandbox blocked NuGet network access (`NU1301`); escalated retry passed.

## Current Known Issues

- Phase 1 manual browser/API verification still needs Huy data:
  - enough-stock queue confirm
  - insufficient-stock queue retry
  - cancel queue with reason
  - sales outbound voucher visible in export slips
  - OrderService status no longer pending after confirm/cancel
- Product Approval source implementation now exists; runtime migration/API verification is still pending.
- Phase 2 manual API/UI verification is still pending:
  - Admin create/authorize/cancel approval request
  - Warehouse validate code
  - Warehouse automatic create
  - Warehouse manual fallback with reason
  - reused/cancelled/Manager code usage blocked
- Phase 4 did not create new sample business data. Warehouse automatic/manual product creation and end-to-end stock deduction still need Huy's browser test data/account tomorrow morning.

## Next Recommended Action

- Commit this Phase 4 tracker update.
- Move to Phase 5 final Vietnamese report.

## Last Safe Local Commit Hash

- `26bb277 chore(inventory): align warehouse and manager role scope`
