# Inventory Completion Progress

This document tracks the current-scope Inventory / Warehouse / Product Master completion work.

## Baseline State - 2026-07-17

- Branch: HuyTD.
- Initial working tree before Batch 0 edits: clean.
- Existing backend solution: `backend/huongvantra_backend/huongvantra_backend.sln`.
- Existing frontend app: `frontend/huongvantra-web-client`.
- Existing test coverage before Batch 0:
  - `ProductService.Application.Tests` exists.
  - No `InventoryService.Application.Tests` project found.
  - No `OrderService.Application.Tests` project found.
  - No AuditService project is present in `Service/`.
- Existing ProductService latest migration observed:
  - `20260712120000_AddNewProductApprovalRequests`.
- Existing InventoryService latest migration observed:
  - `20260715120000_AddPartialFinishedAndBomPendingFieldsToStockDeductQueue`.
- Existing OrderService latest migration observed:
  - `20260629120000_AddCustomBundles`.

## Current Implementation Map

### Product Master

- `ProductType` currently supports `THANH_PHAM` and `NGUYEN_LIEU`; `BAO_BI` is not present yet.
- `ProductType` currently has implicit numeric values.
- Direct Product routes still exist in `ProductsController` and are authorized for `Warehouse`.
- Direct SKU write routes still exist in `ProductSkusController` and are authorized for `Warehouse`.
- Direct BOM update route exists through `ProductsController.UpdateVariantBom` and is authorized for `Warehouse`.
- Product Approval exists through `ProductApprovalRequestsController` and `NewProductApprovalRequest`.

### Inventory

- `SkuStock.WarehouseQuantityOnHand` is the current aggregate warehouse quantity field.
- `SkuStock.QuantityOnHand` is the current aggregate counter/POS sellable quantity field.
- UI and comments still contain legacy wording such as central warehouse, store/counter, and POS counter in some areas.
- `StockAdjustmentRequest` currently represents stock replenishment from warehouse aggregate to counter aggregate.
- `WarehouseBatch` and `WarehouseBatchItem` exist for lot/batch stock.
- `StockImportSlip`, `StockImportSlipLine`, `StockExportSlip`, `StockExportSlipLine`, and `StockExportBatchAllocation` exist.
- `ProductionOrder` supports multi-output lines and output expiry, but approval and destination-per-output are not implemented yet.
- `StockDeductQueue` supports partial finished deduction and pending BOM reconciliation fields.

### Order / POS Integration

- `Order.InventorySyncStatus` supports `Synced`, `PendingDeduction`, `PendingReconciliation`, and `Cancelled`.
- `IdempotencyKey` exists on `Order`.
- POS/order stock handling is integrated through InventoryService APIs and StockDeductQueue.
- Custom bundle support exists in OrderService.

### Gateway

- Gateway routes exist for:
  - `/api/v1/products`
  - `/api/v1/skus`
  - `/api/v1/inventory/sku-stocks`
  - `/api/v1/inventory/stock-adjustment-requests`
  - `/api/v1/inventory/stock-export-slips`
  - `/api/v1/inventory/stock-import-slips`
  - `/api/v1/inventory/warehouse-batches`
  - `/api/v1/inventory/production-orders`

### Docker Services

- Compose file defines MySQL, RabbitMQ, customer-service, user-service, product-service, order-service, inventory-service, document-service, gateway, and web-client.
- No AuditService is present in the current service folder or compose map.

## Batch 0 - Baseline, Inventory Map, Test Foundation

### Files Changed

- `docs/inventory-completion-progress.md`
- `Scripts/test-inventory-completion.ps1`
- `Service/ProductService/ProductService.Application.Tests/TestSupport/ProductWorkflowTestBuilders.cs`
- `Service/ProductService/ProductService.Application.Tests/ProductApprovalWorkflowBaselineTests.cs`
- `Service/InventoryService/InventoryService.Application.Tests/InventoryService.Application.Tests.csproj`
- `Service/InventoryService/InventoryService.Application.Tests/TestSupport/InventoryTestActors.cs`
- `Service/InventoryService/InventoryService.Application.Tests/TestSupport/InventoryWorkflowTestBuilders.cs`
- `Service/InventoryService/InventoryService.Application.Tests/InventoryDomainBaselineTests.cs`
- `Service/OrderService/OrderService.Application.Tests/OrderService.Application.Tests.csproj`
- `Service/OrderService/OrderService.Application.Tests/TestSupport/OrderInventoryTestBuilders.cs`
- `Service/OrderService/OrderService.Application.Tests/OrderInventoryIntegrationBaselineTests.cs`
- Solution file updated to include new test projects.

### Migrations Added

- None in Batch 0.

### Tests Added

- Product approval workflow baseline builders/tests.
- Inventory domain/workflow baseline builders/tests.
- Order inventory integration baseline builders/tests.

### Gate Results

- `dotnet restore huongvantra_backend.sln`: passed after running outside sandbox because the first sandboxed run hit `NU1301` network/socket restrictions.
- `dotnet build huongvantra_backend.sln --no-restore`: passed, 0 warnings, 0 errors.
- `dotnet test huongvantra_backend.sln --no-build`: passed.
  - InventoryService baseline tests: 3 passed.
  - OrderService baseline tests: 2 passed.
  - ProductService baseline/validator tests: 20 passed.
- `npm.cmd run build`: passed.
- `npm.cmd run lint`: failed on existing cross-application lint debt outside the Batch 0 scope.
  - Examples observed: `react-hooks/set-state-in-effect` across shared, contracts, customers, admin, products, and staff pages.
  - Additional examples observed: unused variables and `no-useless-assignment` in non-inventory files.
  - No Batch 0 file introduced frontend source changes.
- `Scripts/test-inventory-completion.ps1`: passed after script was aligned with the current service health topology.
  - ProductService `/health`: HTTP 200.
  - OrderService `/health`: HTTP 200.
  - InventoryService `/health`: HTTP 200.
  - Gateway inventory route probe `/api/v1/inventory/sku-stocks`: HTTP 401 without token, which confirms the route exists and requires auth.

### Docker Services Rebuilt

- None in Batch 0.
- `docker compose ps` confirmed current services were running:
  - `product-service`: Up, healthy.
  - `inventory-service`: Up, healthy.
  - `order-service`: Up, healthy.
  - `mysql`: Up, healthy.
  - `rabbitmq`: Up, healthy.
  - `gateway`: Up.
  - `web-client`: Up.
- Short Docker log inspection showed transient startup connection retries for MySQL/RabbitMQ before services became ready; current health and smoke checks passed.

### Checkpoint Commit

- Local checkpoint commits are now explicitly allowed by Huy after a batch gate passes.
- No push is allowed.
- Batch 0 checkpoint commit will be created with message:
  - `chore(inventory): establish completion baseline and test foundation`
- Batch 0 checkpoint commit hash:
  - `021abf8`

## Gate Policy Update - 2026-07-17

- Full frontend lint is still run and tracked after each batch.
- The current full `npm.cmd run lint` failure is treated as pre-existing cross-application lint debt.
- Full lint baseline errors outside Inventory/Product/Order are not a blocking gate for later batches.
- Scoped lint on files/directories changed by each batch is a hard gate.
- Any lint error in a file changed by the current batch must be fixed.
- Later batches must not increase the full-project lint error count.
- Full frontend production build remains a hard gate.
- Backend build/test, Docker health, smoke test, and relevant service logs remain hard gates.

## Batch 1 - Canonical Item Types, Locations, and Base Stock Units

### Files Changed

- ProductService:
  - Added canonical `ProductType` values for `THANH_PHAM`, `NGUYEN_LIEU`, and `BAO_BI`.
  - Added canonical `InventoryUnit` for `Gram` and `Piece`.
  - Added `Product.InventoryUnit`, request/response mapping, validation, migration, and tests.
  - Tightened BOM validation so output SKU must be `THANH_PHAM`, components must be `NGUYEN_LIEU` or `BAO_BI`, duplicate/self-reference lines are rejected, and BOM quantities are normalized to positive integer base units.
- InventoryService:
  - Added canonical `InventoryLocation` for `Warehouse` and `Shelf`.
  - Added `WarehouseLowStockThreshold` and `ShelfLowStockThreshold` on `SkuStock`.
  - Kept legacy `LowStockThreshold` synchronized with Shelf threshold for compatibility.
  - Updated low-stock checks and `SkuStockResponse` mapping to use the new location-specific thresholds.
- Frontend:
  - Added shared product type/unit helpers.
  - Updated Inventory/Product labels toward `Kho`, `Kệ Hàng`, and `Sản phẩm kệ`.
  - Updated Product Approval, BOM, Production Order, and Inventory stock screens to display/use `THANH_PHAM`, `NGUYEN_LIEU`, `BAO_BI`, `Gram`, and `Piece`.
  - Scoped lint errors in changed frontend files were fixed.

### Migrations Added

- ProductService: `20260717100000_AddInventoryUnitToProducts`
  - Adds `Products.InventoryUnit`.
  - Backfills `Gram` when existing `BaseUnit` or `WeightUnit` is gram/kg-like; otherwise backfills `Piece`.
- InventoryService: `20260717101000_AddSkuStockLocationThresholds`
  - Adds `SkuStocks.WarehouseLowStockThreshold`.
  - Adds `SkuStocks.ShelfLowStockThreshold`.
  - Backfills `ShelfLowStockThreshold` from legacy `LowStockThreshold`.

### Tests Added/Updated

- Product tests now cover stable `ProductType` values including `BAO_BI`.
- Product validator tests now cover `InventoryUnit` inference and integer base-unit normalization.
- Inventory tests now cover `InventoryLocation` and location-specific low-stock thresholds.

### Gate Results

- `dotnet build huongvantra_backend.sln --no-restore`: passed, 0 warnings, 0 errors after the EF `InventoryUnit` mapping fix.
- `dotnet test huongvantra_backend.sln --no-build`: passed.
  - InventoryService tests: 4 passed.
  - OrderService tests: 2 passed.
  - ProductService tests: 23 passed.
- Scoped frontend lint on all Batch 1 changed frontend files: passed.
- `npm.cmd run lint`: failed on remaining pre-existing cross-application lint debt outside Batch 1 changed files.
  - Current count after Batch 1: 131 errors, 14 warnings.
  - This is lower than the recorded Batch 0 baseline of 149 errors, 15 warnings.
- `npm.cmd run build`: passed.
- Docker Compose rebuild/restart:
  - Rebuilt/restarted `product-service`, `inventory-service`, and `web-client`.
  - Compose also recreated dependent services during the first rebuild, but no DB reset or volume deletion was performed.
- Docker health:
  - `product-service`: Up, healthy.
  - `inventory-service`: Up, healthy.
  - `order-service`: Up, healthy.
  - `mysql`: Up, healthy.
  - `rabbitmq`: Up, healthy.
  - `gateway`: Up.
  - `web-client`: Up.
- Relevant logs:
  - Product migration `20260717100000_AddInventoryUnitToProducts` applied successfully.
  - Inventory migration `20260717101000_AddSkuStockLocationThresholds` applied successfully.
  - ProductService was restarted after removing the EF sentinel warning for `InventoryUnit`; follow-up logs show no `InventoryUnit` sentinel warning.
- `Scripts/test-inventory-completion.ps1`: passed.
  - ProductService `/health`: HTTP 200.
  - OrderService `/health`: HTTP 200.
  - InventoryService `/health`: HTTP 200.
  - Gateway inventory route probe `/api/v1/inventory/sku-stocks`: HTTP 401 without token, which confirms the route exists and requires auth.

### Checkpoint Commit

- Batch 1 checkpoint commit will be created with message:
  - `feat(inventory): align item types locations and base stock units`

## Batch 2 - Warehouse Product Creation Request Workflow

### Files Changed

- ProductService:
  - Added `ProductCreationRequest`, `ProductCreationRequestItem`, `ProductCreationRequestRevision`, and `ProductCreationRequestStatus`.
  - Added EF configurations, `ProductDbContext` DbSets, migration, and model snapshot entries.
  - Added Product Creation Request request/response DTOs, `ProductCreationRequestLogic`, and `ProductCreationRequestsController`.
  - Registered `ProductCreationRequestLogic` in `Program.cs`.
  - Disabled legacy Product Approval write/bypass routes with HTTP 410 while preserving legacy GET history.
  - Reused `ProductLogic.CreateAsync()` for approved Product/SKU/BOM creation and tightened creation-path BOM validation/normalization.
- Gateway:
  - Added `/api/v1/product-creation-requests` Gateway routes.
- Frontend:
  - Replaced the old approval-code page with Warehouse-first multi-product request UI at `/inventory/product-approvals` and `/inventory/products/create`.
  - Added Draft save, submit, Admin approve/reject/cancel, BOM rows per SKU, Excel template/import/export, and request list display.
  - Updated navigation/auth module mapping so Admin and Warehouse can access the new request workflow.

### Migrations Added

- ProductService: `20260717110000_AddProductCreationRequests`
  - Adds `ProductCreationRequests`.
  - Adds `ProductCreationRequestItems`.
  - Adds `ProductCreationRequestRevisions`.

### Tests Added/Updated

- Product workflow baseline tests now cover `ProductCreationRequest` builder and stable status enum values.
- Product workflow test builders now include a multi-product Product Creation Request draft.

### Gate Results

- `dotnet build Service\ProductService\ProductService.WebAPI\ProductService.WebAPI.csproj --no-restore`: passed, 0 warnings, 0 errors.
- `dotnet build huongvantra_backend.sln --no-restore`: passed with 2 pre-existing warnings outside Batch 2.
  - `OrderService.Application/UseCases/OrderLogic.cs`: unused `ex`.
  - `InventoryService.Infrastructure/Repositories/WarehouseBatchRepository.cs`: nullable value may be null.
- `dotnet test huongvantra_backend.sln --no-build`: passed.
  - ProductService tests: 25 passed.
  - InventoryService tests: 4 passed.
  - OrderService tests: 2 passed.
- Scoped frontend lint on Batch 2 changed frontend files: passed.
- `npm.cmd run lint`: failed on remaining pre-existing cross-application lint debt outside Batch 2 changed files.
  - Current count after Batch 2: 130 errors, 14 warnings.
  - This is lower than Batch 1 count of 131 errors, 14 warnings and Batch 0 baseline of 149 errors, 15 warnings.
- `npm.cmd run build`: passed.
- `git diff --check`: passed.
- Docker Compose rebuild/restart:
  - Rebuilt/restarted `product-service`, `gateway`, and `web-client`.
  - Compose also recreated dependent services, but no DB reset or volume deletion was performed.
- Docker health:
  - `product-service`: Up, healthy.
  - `inventory-service`: Up, healthy.
  - `order-service`: Up, healthy.
  - `customer-service`: Up, healthy.
  - `document-service`: Up, healthy.
  - `user-service`: Up, healthy.
  - `mysql`: Up, healthy.
  - `rabbitmq`: Up, healthy.
  - `gateway`: Up.
  - `web-client`: Up.
- Relevant logs:
  - Product migration `20260717110000_AddProductCreationRequests` applied successfully.
  - Gateway loaded YARP proxy config successfully.
- DB verification:
  - `__EFMigrationsHistory` contains `20260717110000_AddProductCreationRequests`.
  - `ProductCreationRequests`, `ProductCreationRequestItems`, and `ProductCreationRequestRevisions` exist.
- Gateway route probe:
  - `curl.exe -i http://localhost:5000/api/v1/product-creation-requests`: returned HTTP 401 without token, confirming the route exists and requires auth.
- `powershell -ExecutionPolicy Bypass -File Scripts\test-inventory-completion.ps1`: passed.
  - ProductService `/health`: HTTP 200.
  - OrderService `/health`: HTTP 200.
  - InventoryService `/health`: HTTP 200.
  - Gateway inventory route probe `/api/v1/inventory/sku-stocks`: HTTP 401 without token.

### Checkpoint Commit

- Batch 2 checkpoint commit will be created with message:
  - `feat(product): implement warehouse product creation approval workflow`
- No push is allowed.

## Batch 3 - Product Master Data Locking and Deletion Approval

### Files Changed

- ProductService:
  - Added `ProductDeletionRequest`, `ProductDeletionRequestItem`, `ProductDeletionRequestRevision`, and `ProductDeletionRequestStatus`.
  - Added EF configurations, `ProductDbContext` DbSets, migration, and model snapshot entries.
  - Added Product Deletion Request request/response DTOs, `ProductDeletionRequestLogic`, and `ProductDeletionRequestsController`.
  - Registered `ProductDeletionRequestLogic` and `InventoryProductDeletionValidationClient` in `Program.cs`.
  - Disabled direct Product create/update/delete/restore, direct SKU mutation, and direct BOM update routes with HTTP 410.
  - Kept internal approved-workflow creation paths intact.
  - Updated repository soft-delete behavior to set `Products.IsDeleted=true`, `Products.IsActive=false`, and deactivate active variants.
- InventoryService:
  - Added `/api/v1/inventory/product-deletion-validation` for ProductService approval-time validation.
  - Validation reports warehouse stock, shelf stock, active production orders, pending stock deduct queue, and pending stock adjustment requests per SKU.
- Gateway:
  - Added `/api/v1/product-deletion-requests` routes.
  - Added `/api/v1/inventory/product-deletion-validation` route.
- Frontend:
  - Added `/inventory/product-deletion-requests` management page for Warehouse/Admin.
  - Warehouse can create multi-product deletion requests, save draft, edit Draft/Rejected requests, and submit for Admin review.
  - Admin can review request detail and approve/reject/cancel PendingApproval requests.
  - Product list delete action now creates/submits a Product Deletion Request instead of direct delete.
  - Product detail/edit route no longer opens the old edit form.
  - BOM page is read-only; direct BOM editing is blocked in UI and points users to Product Creation Request workflow.
  - Added navigation/auth module access for `product_deletion_requests`.

### Migrations Added

- ProductService: `20260717120000_AddProductDeletionRequests`
  - Adds `ProductDeletionRequests`.
  - Adds `ProductDeletionRequestItems`.
  - Adds `ProductDeletionRequestRevisions`.

### Tests Added/Updated

- Product workflow baseline tests now cover `ProductDeletionRequest` builder and stable status enum values.
- Product workflow test builders now include a multi-product Product Deletion Request draft.

### Gate Results

- `dotnet build Service\ProductService\ProductService.WebAPI\ProductService.WebAPI.csproj --no-restore`: passed, 0 warnings, 0 errors.
- `dotnet build Service\InventoryService\InventoryService.WebAPI\InventoryService.WebAPI.csproj --no-restore`: passed, 0 warnings, 0 errors.
- `dotnet build huongvantra_backend.sln --no-restore`: passed with 1 pre-existing warning outside Batch 3.
  - `OrderService.Application/UseCases/OrderLogic.cs`: unused `ex`.
- `dotnet test Service\ProductService\ProductService.Application.Tests\ProductService.Application.Tests.csproj --no-restore`: passed, 27 tests.
- Host `dotnet test huongvantra_backend.sln --no-build`: ProductService and InventoryService tests passed, but OrderService tests were blocked by Windows Application Control loading `OrderService.Domain.dll` with `0x800711C7`.
- Container backend test gate:
  - `docker run --rm -v "${PWD}:/src" -w /src mcr.microsoft.com/dotnet/sdk:8.0-alpine dotnet test huongvantra_backend.sln --no-restore`: passed.
- Scoped frontend lint on Batch 3 changed frontend files: passed.
- `npm.cmd run lint`: failed on remaining pre-existing cross-application lint debt.
  - Current count after Batch 3: 130 errors, 14 warnings.
  - This does not increase the Batch 2 count of 130 errors, 14 warnings and remains below Batch 0 baseline of 149 errors, 15 warnings.
- `npm.cmd run build`: passed.
- `git diff --check`: passed.
- Docker Compose rebuild/restart:
  - Rebuilt/restarted `product-service`, `inventory-service`, `gateway`, and `web-client`.
  - Compose also recreated dependent services, but no DB reset or volume deletion was performed.
- Docker health:
  - `product-service`: Up, healthy.
  - `inventory-service`: Up, healthy.
  - `order-service`: Up, healthy.
  - `customer-service`: Up, healthy.
  - `document-service`: Up, healthy.
  - `user-service`: Up, healthy.
  - `mysql`: Up, healthy.
  - `rabbitmq`: Up, healthy.
  - `gateway`: Up.
  - `web-client`: Up.
- Relevant logs:
  - Product migration `20260717120000_AddProductDeletionRequests` applied successfully.
  - InventoryService started with no new migration required.
- DB verification:
  - `__EFMigrationsHistory` contains `20260717120000_AddProductDeletionRequests`.
  - `ProductDeletionRequests`, `ProductDeletionRequestItems`, and `ProductDeletionRequestRevisions` exist.
- Gateway route probes:
  - `curl.exe -i http://localhost:5000/api/v1/product-deletion-requests`: returned HTTP 401 without token, confirming the route exists and requires auth.
  - `curl.exe -i -X POST http://localhost:5000/api/v1/inventory/product-deletion-validation ...`: returned HTTP 401 without token, confirming the route exists and requires auth.
- `powershell -ExecutionPolicy Bypass -File Scripts\test-inventory-completion.ps1`: passed.
  - ProductService `/health`: HTTP 200.
  - OrderService `/health`: HTTP 200.
  - InventoryService `/health`: HTTP 200.
  - Gateway inventory route probe `/api/v1/inventory/sku-stocks`: HTTP 401 without token.

### Checkpoint Commit

- Batch 3 checkpoint commit will be created with message:
  - `feat(product): enforce master data locking and deletion approval`
- No push is allowed.

## Batch 4 - Centralized Immutable System Activity Log

### Files Changed

- Added a dedicated `AuditService` with Domain/Application/Infrastructure/WebAPI/Test projects and registered it in `huongvantra_backend.sln`.
- Added `SystemActivityLog` storage, `AuditDbContext`, EF configuration, migration, query DTOs, query logic, idempotent writer, and RabbitMQ consumer.
- Added shared audit contract and middleware in `HuongVanTra.Shared`:
  - `SystemActivityEvent`
  - `SystemActivityAuditMiddleware`
  - `SystemActivityAuditExtensions`
  - `SensitiveDataRedactor`
- Wired audit middleware into:
  - `ProductService`
  - `InventoryService`
  - `OrderService`
  - `CustomerService`
  - `UserService`
  - `DocumentService`
- Added RabbitMQ publish configuration for `UserService` and `DocumentService`.
- Added `AuditService` Dockerfile and fixed `UserService` Dockerfile so shared project references build in Docker.
- Added `hvt_audit_db` to `Scripts/init-databases.sql` and `audit-service` to `docker-compose.yml`.
- Added gateway route/cluster for `/api/v1/audit/system-activities`.
- Added Admin frontend page `/admin/system-activities`:
  - read-only log list
  - filters
  - server-side pagination
  - detail modal
  - CSV export
  - sidebar entry `Nhật ký hệ thống`

### Migrations Added

- AuditService: `20260717130000_CreateAuditService`
  - Adds `SystemActivityLogs`.
  - Adds unique index on `EventId`.
  - Adds indexes for time, actor, role, service, module, action, entity code, result, and correlation id.

### Tests Added/Updated

- Added AuditService baseline tests for:
  - duplicate `EventId` idempotency through `SystemActivityWriter`
  - filters and pagination through `SystemActivityLogic`
  - sensitive value redaction

### Gate Results

- `dotnet build Service/AuditService/AuditService.WebAPI/AuditService.WebAPI.csproj`: passed, 0 warnings, 0 errors.
- `dotnet build huongvantra_backend.sln`: passed with 2 warnings outside the new AuditService code.
  - `OrderService.Application/UseCases/OrderLogic.cs`: unused `ex`.
  - `InventoryService.Infrastructure/Repositories/WarehouseBatchRepository.cs`: nullable value warning.
- Host `dotnet test Service/AuditService/AuditService.Application.Tests/AuditService.Application.Tests.csproj --no-restore`: test assembly built, but testhost could not run on Windows host because x64 `Microsoft.AspNetCore.App` 8.0 runtime is missing.
- Container backend test gate:
  - `docker run --rm -v "${PWD}:/src" -w /src mcr.microsoft.com/dotnet/sdk:8.0-alpine dotnet test huongvantra_backend.sln --no-restore`: passed.
- Scoped frontend lint on Batch 4 changed frontend files: passed.
- `npm.cmd run lint`: failed on remaining pre-existing cross-application lint debt.
  - Current count after Batch 4: 130 errors, 14 warnings.
  - This matches the Batch 3 count and remains below the Batch 0 baseline of 149 errors, 15 warnings.
- `npm.cmd run build`: passed.
- `git diff --check`: passed.
- Database preparation for existing Docker volume:
  - `docker exec hvt-mysql mysql ... CREATE DATABASE IF NOT EXISTS hvt_audit_db ...`: passed.
  - No DB reset and no Docker volume deletion were performed.
- Docker Compose rebuild/restart:
  - First run exposed missing shared project copy in `UserService.WebAPI/Dockerfile`.
  - Dockerfile was fixed and the second `docker compose up -d --build ...` passed.
- Docker health:
  - `audit-service`: Up, healthy.
  - `product-service`: Up, healthy.
  - `inventory-service`: Up, healthy.
  - `order-service`: Up, healthy.
  - `customer-service`: Up, healthy.
  - `document-service`: Up, healthy.
  - `user-service`: Up, healthy.
  - `mysql`: Up, healthy.
  - `rabbitmq`: Up, healthy.
  - `gateway`: Up.
  - `web-client`: Up.
- Relevant logs:
  - Audit migration `20260717130000_CreateAuditService` applied successfully.
  - MassTransit configured endpoint `audit-service.system-activity`.
  - Audit bus started on RabbitMQ.
- DB verification:
  - `hvt_audit_db.__EFMigrationsHistory` contains `20260717130000_CreateAuditService`.
  - `SystemActivityLogs` exists.
- Gateway route probes:
  - `curl.exe -i http://localhost:5000/api/v1/audit/system-activities`: returned HTTP 401 without token, confirming the route exists and requires auth.
  - `curl.exe -i http://localhost:5000/api/v1/inventory/sku-stocks`: returned HTTP 401 without token, confirming existing inventory route still works.
- Manual health smoke:
  - `CustomerService /health`: HTTP 200.
  - `UserService /health`: HTTP 200.
  - `ProductService /health`: HTTP 200.
  - `OrderService /health`: HTTP 200.
  - `InventoryService /health`: HTTP 200.
  - `DocumentService /health`: HTTP 200.
  - `AuditService /health`: HTTP 200.
- The previously referenced `Scripts\test-inventory-completion.ps1` was not present in the current repo checkout, so manual health and gateway smoke checks were used instead.

### Checkpoint Commit

- Batch 4 checkpoint commit will be created with message:
  - `feat(audit): add centralized immutable system activity log`
- No push is allowed.

## Batch 5 - Inventory Ledger and Controlled Supplier Receipts

### Files Changed

- InventoryService:
  - Added `InventoryLedgerEntry` and repository/query APIs for immutable stock movement history.
  - Added `SupplierReceipt`, `SupplierReceiptItem`, and `SupplierReceiptStatus`.
  - Added Supplier Receipt request/response DTOs and controller endpoints.
  - Added read-only Inventory Ledger controller endpoints.
  - Added supplier receipt approval flow in `InventoryLogic`.
  - Supplier receipt approval creates warehouse batches, one `StockImportSlip` header, multiple `StockImportSlipLine` rows, ledger entries, and audit-visible HTTP activity in one transaction.
  - Draft/Pending supplier receipts do not change stock.
  - Creator self-approval is rejected.
  - Completed approval is idempotent and returns existing completed receipt.
  - Existing shelf replenishment approval now records warehouse out / shelf in ledger entries.
  - Legacy direct warehouse batch creation is restricted to Admin.
  - `StockImportSlip` now stores optional `SupplierReceiptId` and `SupplierReceiptCode`.
- Gateway:
  - Added routes for `/api/v1/inventory/supplier-receipts`.
  - Added routes for `/api/v1/inventory/ledger`.
- Frontend:
  - `/inventory/import/create` now creates and submits a controlled Supplier Receipt instead of directly creating manual warehouse batches.
  - Added `/inventory/supplier-receipts` management page with list, filters, pagination, detail modal, submit, approve, reject, and cancel actions.
  - Added `/inventory/ledger` read-only page with filters, pagination, and CSV export.
  - Added Supplier Receipt and Inventory Ledger API services.
  - Added Inventory navigation/sidebar entries for Supplier Receipts and Ledger.
  - Import slip type mapping now displays `supplier_receipt` as supplier receipt import.

### Migrations Added

- InventoryService: `20260717140000_AddInventoryLedgerAndSupplierReceipts`
  - Adds `InventoryLedgerEntries`.
  - Adds `SupplierReceipts`.
  - Adds `SupplierReceiptItems`.
  - Adds `StockImportSlips.SupplierReceiptId`.
  - Adds `StockImportSlips.SupplierReceiptCode`.

### Tests Added/Updated

- Inventory domain baseline tests now cover:
  - Stable `SupplierReceiptStatus` lifecycle values.
  - Ledger before/delta/after movement invariant.

### Gate Results

- `dotnet build Service\InventoryService\InventoryService.WebAPI\InventoryService.WebAPI.csproj --no-restore`: passed, 0 warnings, 0 errors.
- `dotnet test Service\InventoryService\InventoryService.Application.Tests\InventoryService.Application.Tests.csproj --no-restore`: passed, 6 tests.
- `dotnet build huongvantra_backend.sln --no-restore`: passed with 1 pre-existing warning outside Batch 5.
  - `OrderService.Application/UseCases/OrderLogic.cs`: unused `ex`.
- Host `dotnet test huongvantra_backend.sln --no-restore`: Inventory/Product/Order tests passed before abort, but AuditService host test execution is blocked by missing x64 `Microsoft.AspNetCore.App` 8.0 runtime on Windows.
- Container backend test gate:
  - `docker run --rm ... mcr.microsoft.com/dotnet/sdk:8.0-alpine dotnet test huongvantra_backend.sln --no-restore`: exit code 0. In this environment the command produced no detailed console output, so host targeted test results above remain the detailed evidence.
- Scoped frontend lint on Batch 5 changed frontend files: passed.
- `npm.cmd run lint`: failed on remaining pre-existing cross-application lint debt.
  - Current count after Batch 5: 127 errors, 14 warnings.
  - This is lower than Batch 4 count of 130 errors, 14 warnings and remains below Batch 0 baseline of 149 errors, 15 warnings.
- `npm.cmd run build`: passed.
- Docker Compose rebuild/restart:
  - Rebuilt/restarted `inventory-service`, `gateway`, and `web-client`.
  - Compose recreated dependent services as part of the dependency graph, but no DB reset or volume deletion was performed.
- Docker health:
  - `inventory-service`: Up, healthy.
  - `product-service`: Up, healthy.
  - `order-service`: Up, healthy.
  - `audit-service`: Up, healthy.
  - `customer-service`: Up, healthy.
  - `document-service`: Up, healthy.
  - `user-service`: Up, healthy.
  - `mysql`: Up, healthy.
  - `rabbitmq`: Up, healthy.
  - `gateway`: Up.
  - `web-client`: Up.
- Relevant logs:
  - Inventory migration `20260717140000_AddInventoryLedgerAndSupplierReceipts` applied successfully.
  - Gateway loaded YARP proxy config and proxied supplier receipt / ledger smoke requests.
  - AuditService started successfully and reported database already up to date.
- DB verification:
  - `hvt_inventory_db.__EFMigrationsHistory` contains `20260717140000_AddInventoryLedgerAndSupplierReceipts`.
  - `InventoryLedgerEntries`, `SupplierReceipts`, and `SupplierReceiptItems` exist.
  - `StockImportSlips.SupplierReceiptId` exists.
  - `StockImportSlips.SupplierReceiptCode` exists.
- Gateway route probes:
  - `curl.exe -i http://localhost:5000/api/v1/inventory/supplier-receipts`: returned HTTP 401 without token, confirming the route exists and requires auth.
  - `curl.exe -i http://localhost:5000/api/v1/inventory/ledger`: returned HTTP 401 without token, confirming the route exists and requires auth.
  - `curl.exe -i http://localhost:5000/api/v1/inventory/supplier-receipts/template`: returned HTTP 200 and CSV content.
- Frontend route probes:
  - `curl.exe -I http://localhost:3000/inventory/supplier-receipts`: returned HTTP 200.
  - `curl.exe -I http://localhost:3000/inventory/ledger`: returned HTTP 200.
  - `curl.exe -I http://localhost:3000/inventory/import/create`: returned HTTP 200.

### Checkpoint Commit

- Batch 5 checkpoint commit will be created with message:
  - `feat(inventory): add ledger and controlled supplier receipts`
- No push is allowed.

## Batch 6 - Shelf Replenishment, Shelf Return, and Supplier Return

### Starting State

- Started after clean worktree at local commit `f300f4b`.
- Existing `StockAdjustmentRequest` already performs a pending approval style movement from `WarehouseQuantityOnHand` to `QuantityOnHand`.
- Existing replenishment approval creates export slips and ledger entries, but warehouse batches are still warehouse-only and no Shelf batch is created.
- Existing `WarehouseBatch` has no `Location`, `ParentBatchId`, or `SourceBatchId` fields.
- No dedicated Shelf Return or Supplier Return workflow exists yet.
- No unified "Trả hàng nhập" UI exists yet.

### Files Changed So Far

- InventoryService:
  - Added `WarehouseBatch.Location`, `ParentBatchId`, and `SourceBatchId` for location-aware lot lineage.
  - Added slip reference fields on `StockImportSlip` and `StockExportSlip`.
  - Added `ShelfReturnRequest`, `ShelfReturnRequestItem`, `SupplierReturnRequest`, `SupplierReturnRequestItem`, and `InventoryReturnRequestStatus`.
  - Added repositories, controllers, DTOs, DI, and `InventoryLogic` flows for shelf return and supplier return.
  - Existing shelf replenishment approval now creates Shelf-location batches from FEFO warehouse allocations.
  - Existing shelf replenishment status now completes as `Completed`; `Approved` remains for backward compatibility.
  - Added migration `20260717150000_AddInventoryReturnFlowsAndBatchLocations`.
- Gateway:
  - Added routes for `/api/v1/inventory/shelf-return-requests`.
  - Added routes for `/api/v1/inventory/supplier-return-requests`.
- Frontend:
  - Added `/inventory/returns` unified page for `Tra hang nhap`.
  - Added `inventoryReturnApi.js`.
  - Added Inventory navigation/sidebar entry for `Tra hang nhap`.
  - Added batch `location`/lineage mapping.
  - Added slip type labels for shelf return, supplier return, and inbound data correction.
  - Added `completed` display mapping for stock replenishment requests.

### Gate Results So Far

- `dotnet build Service\InventoryService\InventoryService.WebAPI\InventoryService.WebAPI.csproj --no-restore`: passed, 0 warnings, 0 errors.
- `dotnet build huongvantra_backend.sln --no-restore`: passed with 1 pre-existing warning outside Batch 6.
  - `OrderService.Application/UseCases/OrderLogic.cs`: unused `ex`.
- Host `dotnet test Service\InventoryService\InventoryService.Application.Tests\InventoryService.Application.Tests.csproj --no-restore`: blocked by Windows Application Control policy loading the copied test `InventoryService.Domain.dll` (`0x800711C7`), not by test assertions.
- Scoped frontend lint on Batch 6 changed frontend files via `npx.cmd eslint ...`: passed.
- `npm.cmd run lint`: still fails on pre-existing cross-application lint debt.
  - Current count after Batch 6 changes: 127 errors, 14 warnings.
  - This does not increase the Batch 5 count of 127 errors, 14 warnings and remains below Batch 0 baseline of 149 errors, 15 warnings.
- `npm.cmd run build`: passed with existing chunk/dynamic import warnings.
- `git diff --check`: passed; Git emitted Windows LF-to-CRLF warnings only.
- Container backend test gate:
  - `docker run --rm ... dotnet test Service/InventoryService/InventoryService.Application.Tests/InventoryService.Application.Tests.csproj --no-restore`: exit code 0; Docker produced no detailed console output.
  - `docker run --rm ... dotnet test huongvantra_backend.sln --no-restore`: exit code 0; Docker produced no detailed console output.
- Docker Compose rebuild/restart:
  - Rebuilt/restarted `inventory-service`, `audit-service`, `gateway`, and `web-client`.
  - Compose recreated dependency services as part of the dependency graph, but no DB reset or volume deletion was performed.
- Docker health:
  - `inventory-service`: Up, healthy.
  - `audit-service`: Up, healthy.
  - `gateway`: Up.
  - `web-client`: Up.
  - Related dependency services remained Up/healthy after recreate.
- Relevant logs:
  - Inventory migration `20260717150000_AddInventoryReturnFlowsAndBatchLocations` applied successfully.
  - Gateway proxied `/api/v1/inventory/shelf-return-requests` and `/api/v1/inventory/supplier-return-requests` to `inventory-service` and received expected HTTP 401 without token.
- DB verification:
  - `hvt_inventory_db.__EFMigrationsHistory` contains `20260717150000_AddInventoryReturnFlowsAndBatchLocations`.
  - `WarehouseBatches.Location`, `ParentBatchId`, and `SourceBatchId` exist.
  - `ShelfReturnRequests` and `SupplierReturnRequests` exist.
  - `StockImportSlips.ReferenceCode` and `StockExportSlips.ReferenceCode` exist.
- Gateway route probes:
  - `curl.exe -i http://localhost:5000/api/v1/inventory/shelf-return-requests`: returned HTTP 401 without token, confirming the route exists and requires auth.
  - `curl.exe -i http://localhost:5000/api/v1/inventory/supplier-return-requests`: returned HTTP 401 without token, confirming the route exists and requires auth.
- Frontend route probe:
  - `curl.exe -I http://localhost:3000/inventory/returns`: returned HTTP 200.

### Checkpoint Commit

- Batch 6 checkpoint commit was created:
  - `6897ffa feat(inventory): implement warehouse shelf and inbound return flows`
- No push was performed.

## Batch 7 - Production Order Approval and Output Destination

### Starting State

- Started after clean worktree at local commit `6897ffa`.
- Current `ProductionOrderStatus` supports only `Draft`, `Completed`, and `Cancelled`.
- Current `ProductionOrder` completion can move directly from `Draft` to `Completed`.
- Current `ProductionOrderOutputLine` has expiry and finished batch trace fields, but no output destination field.
- Current production completion creates finished-goods `WarehouseBatch` records in Warehouse only.
- Current production completion deducts materials from Warehouse batches via FEFO and creates export/import slips, but does not create production ledger entries.
- Batch 7 will keep existing multi-output, expiry, BOM aggregation, FEFO material deduction, slip creation, and batch traceability while adding approval gates and selectable Warehouse/Shelf output destination.

### Files Changed So Far

- InventoryService:
  - Added `ProductionOrderStatus.PendingApproval`, `Approved`, and `Rejected`.
  - Added creator/reviewer/submission snapshots to `ProductionOrder`.
  - Added `DestinationLocation` to `ProductionOrderOutputLine`.
  - Added `DestinationLocation` to `StockImportSlipLine`.
  - Added migration `20260717160000_AddProductionApprovalAndOutputDestination`.
  - `CreateProductionOrderAsync` stores creator snapshot and per-output destination.
  - Added `SubmitProductionOrderAsync`, `ApproveProductionOrderAsync`, and `RejectProductionOrderAsync`.
  - `CancelProductionOrderAsync` now records actor snapshot/reason and blocks completed orders.
  - `CompleteProductionOrderAsync` now only completes `Approved` orders, returns existing response for already completed orders, pre-validates Warehouse material shortages before FEFO deduction, creates output batches in either Warehouse or Shelf, writes production ledger entries, and keeps export/import slip traceability.
  - Product deletion validation now counts `Draft`, `PendingApproval`, `Approved`, and `Rejected` production orders as active blockers.
  - Added domain baseline tests for `ProductionOrderStatus` lifecycle and output destination default.
- Frontend:
  - Production order API mapper now reads creator/reviewer metadata and output `destinationLocation`.
  - Create Production Order modal now supports per-output destination (`Kho` or `Kệ Hàng`) and can either save draft or create-and-submit for approval.
  - Production Orders page now shows status/actions for submit, approve, reject, complete, and cancel.
  - Production order detail output tables now show destination location.
  - Stock import slip line mapper/document now supports/display destination location.
  - Moved creator role display helper to `inventoryCreatorDisplay.js` to satisfy scoped lint.

### Gate Results So Far

- `dotnet build Service\InventoryService\InventoryService.WebAPI\InventoryService.WebAPI.csproj --no-restore`: passed, 0 warnings, 0 errors.
- `dotnet test Service\InventoryService\InventoryService.Application.Tests\InventoryService.Application.Tests.csproj --no-restore`: passed, 9 tests.
- `dotnet build huongvantra_backend.sln --no-restore`: passed with 1 pre-existing warning outside Batch 7.
  - `OrderService.Application/UseCases/OrderLogic.cs`: unused `ex`.
- Host `dotnet test huongvantra_backend.sln --no-restore`: partially passed, then aborted on host environment.
  - InventoryService tests passed: 9/9.
  - ProductService tests passed: 27/27.
  - OrderService tests passed: 2/2.
  - AuditService testhost aborted because this host has x64 `Microsoft.AspNetCore.App` 10.0.8 only, while tests require x64 8.0.0. This is an environment/runtime issue, not a Batch 7 assertion failure.
- Scoped frontend lint on Batch 7 changed frontend files via `npx.cmd eslint ...`: passed.
- `npm.cmd run lint`: still fails on pre-existing cross-application lint debt.
  - Current count after Batch 7 changes: 124 errors, 14 warnings.
  - This is lower than the Batch 6 count of 127 errors, 14 warnings and remains below the Batch 0 baseline of 149 errors, 15 warnings.
- `npm.cmd run build`: passed with existing chunk/dynamic import warnings.
- `git diff --check`: passed; Git emitted Windows LF-to-CRLF warnings only.
- Docker gate was completed manually by Huy after the previous Codex session:
  - `docker compose up -d --build inventory-service product-service audit-service gateway web-client` passed.
  - `docker ps` / `docker compose ps` showed affected containers running and healthy where health checks exist.
  - Inventory migration `20260717160000_AddProductionApprovalAndOutputDestination` applied successfully.
  - `hvt-inventory-service` started successfully and RabbitMQ bus started.

### Checkpoint Commit

- Batch 7 checkpoint commit was created:
  - `5882197 feat(inventory): complete approved production with selectable destination`
- No push was performed.

## Batch 8 - Stocktake, True Stock Adjustment, Alerts, and Inventory Reports

### Starting State

- Started after clean worktree at local commit `5882197`.
- Current code has `StockAdjustmentRequest`, but it is used for Kho -> Kệ Hàng replenishment, not true physical stocktake.
- Existing stock model separates `WarehouseQuantityOnHand` and `QuantityOnHand`, with location-aware `WarehouseBatch.Location`.
- Existing batch FEFO helpers and `StockExportBatchAllocation` can be reused for stocktake decreases.
- Existing `CreateWarehouseBatchInternalAsync` can create Warehouse or Shelf batches with source traceability.
- Existing `InventoryLedgerEntry` already supports source/destination location, reference, actor snapshot, batch, and lot code.
- Existing low-stock thresholds are already split into `WarehouseLowStockThreshold` and `ShelfLowStockThreshold`.
- Batch 8 must not reintroduce direct quantity mutation as normal business workflow.

### Files Changed So Far

- Backend Inventory:
  - Added stocktake domain model, status enum, repository, controller, DTOs, EF configuration, migration, and model snapshot entries.
  - Added migration `20260717170000_AddStocktakeRequests` for `StocktakeRequests` and `StocktakeRequestItems`.
  - Added stocktake lifecycle methods in `InventoryLogic`: create draft, submit, approve, reject, cancel, list/detail, and reason-code lookup.
  - Stocktake approval adjusts only the selected location, creates traceable import/export slips, creates ledger entries with transaction type `STOCKTAKE_ADJUSTMENT`, and republishes low-stock signals.
  - Direct `AdjustStoreStockAsync` / `AdjustWarehouseStockAsync` calls are now guarded unless `InventoryOptions.SimulateWarehouse` is enabled.
- Gateway:
  - Added `/api/v1/inventory/stocktake-requests` and catch-all child route forwarding to InventoryService.
- Frontend Inventory:
  - Added `/inventory/stocktake` page for stocktake request list, create/import template, submit/review actions, detail view, and CSV export.
  - Added `/inventory/reports` page for current stock, low stock, near-expiry batch, movement, and stocktake-history reports.
  - Added Inventory navigation entries for `Kiểm kê tồn kho` and `Báo cáo kho`.
  - Added `STOCKTAKE_ADJUSTMENT` ledger label.
- Tests:
  - Added baseline domain tests for stocktake lifecycle enum and variance formula.

### Gate Results So Far

- Backend scoped tests:
  - `dotnet test Service\InventoryService\InventoryService.Application.Tests\InventoryService.Application.Tests.csproj --no-restore`: passed, 11 tests.
- Backend build:
  - `dotnet build`: passed with 1 pre-existing warning in `OrderService.Application/UseCases/OrderLogic.cs`.
- Backend full test:
  - `dotnet test`: Inventory, Product, and Order test projects passed.
  - `AuditService.Application.Tests` aborted because this Windows host has x64 `Microsoft.AspNetCore.App` 10.0.8 installed, while that testhost requires x64 8.0.0. This is recorded as a host runtime issue outside Batch 8 Inventory code.
- Frontend scoped lint:
  - `npx.cmd eslint src/features/inventory/pages/InventoryStocktakePage.jsx src/features/inventory/pages/InventoryReportsPage.jsx src/features/inventory/services/stocktakeApi.js src/app/App.jsx src/app/navigation.js src/features/inventory/utils/inventoryNavTabs.js src/features/inventory/pages/InventoryLedgerPage.jsx`: passed.
- Frontend full lint:
  - `npm.cmd run lint`: failed with baseline `124 errors, 14 warnings`.
  - No lint errors were reported in Batch 8 changed frontend files.
- Frontend build:
  - `npm.cmd run build`: passed with existing dynamic-import and chunk-size warnings.
- Docker Compose rebuild/restart:
  - `docker compose up -d --build inventory-service audit-service gateway web-client`: passed.
- Docker health:
  - `docker compose ps` showed `hvt-inventory-service`, `hvt-audit-service`, `hvt-mysql`, `hvt-rabbitmq`, and other service dependencies running and healthy where health checks exist.
- Relevant logs:
  - `inventory-service` applied migration `20260717170000_AddStocktakeRequests`, started successfully, and RabbitMQ bus started.
  - `gateway` loaded proxy config and started successfully.
- Database verification:
  - MySQL query confirmed `__EFMigrationsHistory` contains `20260717170000_AddStocktakeRequests`.
  - MySQL query confirmed `StocktakeRequests` and `StocktakeRequestItems` exist in `hvt_inventory_db`.
- Gateway smoke:
  - `curl.exe -i http://localhost:5000/api/v1/inventory/stocktake-requests`: returned `401 Unauthorized`, confirming the route is present and protected instead of 404.
  - `curl.exe -i http://localhost:5000/api/v1/inventory/stocktake-requests/reason-codes`: returned `401 Unauthorized`, confirming the child route is present and protected instead of 404.
- Repo checks:
  - `git diff --check`: passed; Git emitted Windows LF-to-CRLF warnings only.

### Checkpoint Commit

- Batch 8 checkpoint commit was created:
  - `bb098bf feat(inventory): add stocktake controls alerts and reporting`
- No push will be performed.

## Remaining Risks

- Generic audit middleware records authenticated non-GET request metadata only; detailed before/after snapshots for each business action can be added in later targeted instrumentation batches.
- The Admin audit UI is read-only and query/export focused; it intentionally does not support update/delete.
- Host Windows test execution is still blocked by missing x64 ASP.NET Core 8 runtime; container test gate is the reliable backend test path.
