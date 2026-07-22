# Inventory Acceptance Guide

Tai lieu nay tom tat pham vi hien tai cua module Inventory/Product catalog trong HVTPOSIMS va checklist nghiem thu sau Batch 10.

## Current Scope

- Product catalog co 3 loai hang hoa: `THANH_PHAM`, `NGUYEN_LIEU`, `BAO_BI`.
- Ton kho vat ly duoc tach thanh 2 location hien tai:
  - `Warehouse`: Kho tong.
  - `Shelf`: Ke Hang/POS sellable stock.
- Chua ho tro multi-branch, multi-warehouse dong hoc, hay dynamic location.
- Nha cung cap luon nhap vao `Warehouse` thong qua Supplier Receipt/manual material import flow.
- `WarehouseQuantityOnHand` la aggregate ton Kho tong.
- `QuantityOnHand` la aggregate ton Ke Hang/POS sellable stock.
- Ton kho chi dung 2 don vi chuan: `Gram` va `Piece`.
- Product master sau khi tao la read-only tren UI kinh doanh. Tao/xoa hang hoa phai di qua approval request.
- BOM gan theo finished `ProductVariant`/SKU, dung cho san xuat va sell-first reconciliation.
- Production Order co approval, output destination theo tung output line: `Warehouse` hoac `Shelf`.
- Stocktake theo location, khong thay doi ton truoc khi approve.
- Sales flows da tich hop voi Shelf/Warehouse model.
- Global audit log nam o AuditService va ghi nhan authenticated non-GET request metadata.

## Future Scope

- Multi-branch va dynamic warehouse/location.
- PurchaseOrder/account payable automation.
- Multi-level BOM.
- Advanced procurement forecasting.
- Complex quarantine/damaged-goods workflow.
- Lot-level costing/FIFO valuation.
- POS lot selection/deduction UI nang cao.

## Main API And Workflow Map

| Workflow | Main APIs | Stock location effect | Main documents |
| --- | --- | --- | --- |
| Supplier receipt | `POST /api/v1/inventory/supplier-receipts` then submit/approve | Increase `Warehouse` | `StockImportSlip`, `StockImportSlipLine`, `InventoryLedgerEntry` |
| Warehouse to Shelf replenishment | `POST /api/v1/inventory/stock-adjustment-requests` then approve | Decrease `Warehouse`, increase `Shelf` | `StockExportSlip`, `StockImportSlip`, batch allocations, ledger |
| Shelf return to Warehouse | `POST /api/v1/inventory/shelf-return-requests` then approve | Decrease `Shelf`, increase `Warehouse` | import/export slips and ledger |
| Supplier return | `POST /api/v1/inventory/supplier-return-requests` then approve | Decrease `Warehouse` | export slip, batch allocations, ledger |
| Production | `POST /api/v1/inventory/production-orders` then submit/approve/complete | Deduct materials from `Warehouse`; receive outputs to selected destination | material export slip, finished import slip, batches, ledger |
| Stocktake | `POST /api/v1/inventory/stocktake-requests` then submit/approve | Adjust selected location only | stocktake import/export slip and ledger |
| POS immediate sale | `POST /api/v1/orders` + Inventory POS handling | Decrease `Shelf` only | POS export slip, batch allocations, ledger |
| Sell-first reconciliation | `POST /api/stock-deduct-queue/{id}/confirm` | Deduct `NGUYEN_LIEU`/`BAO_BI` from `Warehouse` only | material export slip, allocations, ledger |
| Customer return | Order return flow event | Sellable receipt currently returns to `Shelf` | customer return import slip, batch, ledger |
| Custom bundle packing | `POST /api/v1/orders/custom-bundles/...` and `POST /api/v1/inventory/deduct-materials` | Deduct materials from `Warehouse` | material export slip, allocations, ledger |

## Data Dictionary Notes

| Field/entity | Meaning |
| --- | --- |
| `SkuStock.WarehouseQuantityOnHand` | Aggregate Warehouse quantity for one SKU. |
| `SkuStock.QuantityOnHand` | Aggregate Shelf/POS sellable quantity for one SKU. |
| `WarehouseBatch.Location` | Physical lot location, currently `Warehouse` or `Shelf`. |
| `WarehouseBatchItem.QuantityOnHand` | Remaining physical quantity for one SKU inside a lot. |
| `StockImportSlip.ReferenceType/ReferenceId/ReferenceCode` | Business source reference such as ProductionOrder, SupplierReceipt, Stocktake, CustomerReturn. |
| `StockExportSlip.ReferenceType/ReferenceId/ReferenceCode` | Business source reference for outbound movement. |
| `StockExportBatchAllocation` | Trace from export slip/line to consumed batch/item quantity. |
| `InventoryLedgerEntry` | Immutable stock movement record with location, before/after, actor snapshot and business reference. |
| `InventoryOptions.SimulateWarehouse` | Legacy development simulation flag. Current scope expects `false`. |

## Migration Notes

Do not rewrite applied migrations. Current Inventory/Product scope relies on these recent migrations:

| Service | Migration |
| --- | --- |
| ProductService | `20260717100000_AddInventoryUnitToProducts` |
| ProductService | `20260717110000_AddProductCreationRequests` |
| ProductService | `20260717120000_AddProductDeletionRequests` |
| AuditService | `20260717130000_CreateAuditService` |
| InventoryService | `20260717101000_AddSkuStockLocationThresholds` |
| InventoryService | `20260717140000_AddInventoryLedgerAndSupplierReceipts` |
| InventoryService | `20260717150000_AddInventoryReturnFlowsAndBatchLocations` |
| InventoryService | `20260717160000_AddProductionApprovalAndOutputDestination` |
| InventoryService | `20260717170000_AddStocktakeRequests` |

## Role And Permission Matrix

| Role | Current Inventory responsibility |
| --- | --- |
| Warehouse | Create supplier receipts, production orders, stocktake drafts, and operational stock requests. Cannot approve own approval-gated request. |
| Manager / Agency Manager | Review replenishment/return/stocktake flows where configured by current UI and permission policy. |
| Admin | Product creation/deletion approval, audit review, and high-level inventory reports. |
| Sales/Cashier | POS sale and customer return flow. Must not freely adjust inventory. |

Application-level approval flows must continue to enforce:

- Creator cannot approve their own request.
- Completed/approved stock-changing action cannot be applied twice.
- Multi-line stock-changing operation must be all-or-nothing.
- Frontend must show readable error messages and must not white-screen.

## Stock-Effect Matrix

| Operation | Warehouse aggregate | Shelf aggregate | Batch effect | Slip/ledger |
| --- | --- | --- | --- | --- |
| Supplier receipt approve | Increase | No change | Create Warehouse batch | Import slip + ledger |
| Replenishment approve | Decrease | Increase | Deduct Warehouse FEFO, create Shelf batch | Export + import + ledger |
| Shelf return approve | Increase | Decrease | Deduct Shelf, create Warehouse batch | Export + import + ledger |
| Supplier return approve | Decrease | No change | Deduct Warehouse FEFO | Export + allocations + ledger |
| Production complete to Warehouse | Materials decrease; outputs increase | No change | Deduct material batches, create Warehouse output batch | Export + import + ledger |
| Production complete to Shelf | Materials decrease | Outputs increase | Deduct material batches, create Shelf output batch | Export + import + ledger |
| Stocktake increase | Increase selected location only | Increase selected location only | Create adjustment batch at selected location | Import + ledger |
| Stocktake decrease | Decrease selected location only | Decrease selected location only | Deduct selected location batches | Export + ledger |
| POS normal sale | No change | Decrease | Deduct Shelf batches FEFO | Export + allocations + ledger |
| Sell-first confirm | Decrease materials only | No finished deduction | Deduct Warehouse material batches | Export + allocations + ledger |
| Customer sellable return | No change | Increase | Create Shelf return batch | Import + ledger |
| Custom bundle pack | Decrease materials only | No change | Deduct Warehouse material batches | Export + allocations + ledger |

## UAT Script

Run through Gateway where possible, using authenticated users with the proper role.

1. Warehouse creates Product Creation Request with `InventoryUnit` and BOM for finished SKU.
2. Admin approves and verifies Product appears read-only in `/inventory/products`.
3. Warehouse creates Product Deletion Request; Admin rejects and then approves a separate safe request.
4. Admin opens System Activity Log and filters Inventory/Product actions.
5. Warehouse creates Supplier Receipt with multiple raw-material/package lines; submits.
6. Reviewer approves Supplier Receipt; verify Warehouse batch, import slip, ledger and aggregate stock.
7. Manager creates Warehouse to Shelf replenishment; reviewer approves; verify both locations and slips.
8. Manager creates Shelf to Warehouse return; reviewer approves; verify both locations and slips.
9. Warehouse creates Supplier Return; reviewer approves; verify Warehouse decrease and export allocation.
10. Warehouse creates Production Order with multiple output lines and destination selection; submits.
11. Reviewer approves Production Order; Warehouse completes it; verify output batches, import/export slips and ledger.
12. Warehouse creates Stocktake for `Warehouse` and for `Shelf`; submit/approve; verify selected location only changes.
13. Open Inventory Ledger and Reports; verify filters/export and totals are plausible.
14. POS sells SKU with sufficient Shelf stock; verify Shelf decreases and Warehouse unchanged.
15. POS sells finished SKU with partial Shelf stock and BOM availability; verify queue contains missing quantity only.
16. Confirm stock deduct queue; verify materials/packages are deducted from Warehouse only.
17. POS/customer return for a sellable item; verify Shelf receipt batch/slip/ledger.
18. Custom bundle packing; verify material export slip, allocations and ledger.
19. Offline POS cache displays Shelf stock, not Warehouse stock; sync uses server-side validation.

## Final Acceptance Commands

Backend:

```powershell
cd "D:\SEP490_G66_HuongVanTra-System\backend\huongvantra_backend"
dotnet restore
dotnet build --no-restore
dotnet test --no-restore
docker compose up -d --build product-service inventory-service order-service audit-service user-service customer-service document-service gateway web-client
docker compose ps
docker compose logs --tail=100 inventory-service
docker compose logs --tail=100 order-service
docker compose logs --tail=100 product-service
docker compose logs --tail=100 audit-service
docker compose logs --tail=100 gateway
```

Frontend:

```powershell
cd "D:\SEP490_G66_HuongVanTra-System\frontend\huongvantra-web-client"
npm.cmd run lint
npm.cmd run build
```

Repo:

```powershell
cd "D:\SEP490_G66_HuongVanTra-System"
git diff --check
git status --short
```
