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

## Gate Policy Update - 2026-07-17

- Full frontend lint is still run and tracked after each batch.
- The current full `npm.cmd run lint` failure is treated as pre-existing cross-application lint debt.
- Full lint baseline errors outside Inventory/Product/Order are not a blocking gate for later batches.
- Scoped lint on files/directories changed by each batch is a hard gate.
- Any lint error in a file changed by the current batch must be fixed.
- Later batches must not increase the full-project lint error count.
- Full frontend production build remains a hard gate.
- Backend build/test, Docker health, smoke test, and relevant service logs remain hard gates.

## Remaining Risks

- The requested full scope is significantly larger than the current codebase.
- AuditService is referenced by the target scope but is not present in the current repo.
- Multiple future batches require schema, API, UI, tests, and migration work.
