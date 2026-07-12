# Codex Inventory Overnight Progress

## Current Phase

- Phase 2 - New Product Creation Approval for `/inventory/products/create`.
- Phase 1 has been committed locally and Phase 2 is ready for source inspection/implementation.

## Completed Phases

- Phase 0 - Safety, baseline, and source inspection.
- Phase 1 - Complete Flow 2A: sell-first, deduct branch/counter stock later.
  - Commit: `e499e65 feat(inventory): complete sell-first stock deduction flow`

## Pending Phases

- Phase 3 - Role and wording cleanup across Inventory.
- Phase 4 - Integration stabilization and regression checks.
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
- Phase 1 implementation files currently changed but not committed:
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

## Migrations Added

- Phase 1 added and applied:
  - `20260712100000_AddStockDeductQueueAuditAndInsufficientStatus`

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

## Tests/Builds Failed Or Blocked

- Initial InventoryService build failed only because sandbox blocked NuGet network access (`NU1301`); escalated retry passed.
- Earlier `docker compose ps` failed because Docker daemon/API was unavailable; retry after Docker startup passed.

## Current Known Issues

- Phase 1 manual browser/API verification still needs Huy data:
  - enough-stock queue confirm
  - insufficient-stock queue retry
  - cancel queue with reason
  - sales outbound voucher visible in export slips
  - OrderService status no longer pending after confirm/cancel
- Product Approval workflow does not exist yet in ProductService or frontend; this is Phase 2.

## Next Recommended Action

- Commit this docs-only Phase 1 progress update.
- Start Phase 2 source inspection for New Product Creation Approval.

## Last Safe Local Commit Hash

- `e499e65 feat(inventory): complete sell-first stock deduction flow`
