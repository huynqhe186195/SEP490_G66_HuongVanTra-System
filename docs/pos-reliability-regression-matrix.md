# POS Reliability Regression Matrix

Regression and acceptance evidence for the POS Reliability roadmap (Phases G-K) on branch `HuyTD`. Code identifiers stay in English; narrative in Vietnamese where useful.

## Scope

| Phase | Feature | Status | Commit |
| --- | --- | --- | --- |
| G (POS-05) | Transactional Outbox/Inbox exactly-once | Done | `61686a8` |
| H (POS-04) | COD Shelf stock reservation | Done | `61686a8` |
| I (POS-06) | Sell-first checkout reconciliation | Done | `6cb76c3`, `4ad8cb5` |
| J | Return inspection safety | Done | `4008142` (backend), `f69f18f` (frontend) |
| K | Regression + documentation | This document | pending final commit |
| L1 | Single PaymentMethod per Order (split payment reverted) | Done | `fix(pos): revert split payment and restore sale visibility` |
| L2 | Sale store-wide read access on Customer + Order | Done | `fix(pos): revert split payment and restore sale visibility` |
| L3 | Controlled receipt reprint with audit trail | Done | `feat(pos): add controlled receipt reprint` |
| L4 | Bidirectional COD reservation traceability | Done | `feat(inventory): add COD reservation traceability` |

### Post-PM decision note

The PM meeting cancelled two earlier proposals. They are **not** current business rules and must not be reintroduced:

- Simultaneous cash + bank-transfer payment on one Order (split payment). Current rule: **exactly one `PaymentMethod` per Order**.
- Restricting a Sale to only their own Customers/Orders. Current rule: **Sale reads every Customer and Order within store scope**.

Existing `Payment` structures are retained because payment history, QR callback, COD, debt, refund and audit still depend on them; only multi-method checkout is rejected. No destructive migration was applied.

## Business Invariants Verified

| Invariant | Where enforced | Verification |
| --- | --- | --- |
| Order data + outbox event saved in one OrderService transaction | Outbox writer | OrderService tests |
| `OutboxMessage.Id == payload EventId` | Outbox writer | OrderService tests |
| Dispatcher retries never lose events | Outbox dispatcher | OrderService tests (retry/backoff/poison) |
| Inventory inbox dedup by `EventId` + business key | `ProcessedIntegrationEvent` | InventoryService idempotency tests |
| Redelivery does not duplicate stock movements/slips/allocations/ledger | Inbox + `IsDeducted`/`IsReserved` guards | InventoryService idempotency tests |
| Confirmed COD reserves Shelf; Available = OnHand - Reserved | `ReserveQueueStockAsync`, availability reads | InventoryService reservation tests |
| COD edit atomically release + re-reserve | `ReplaceCodReservationAsync` | InventoryService reservation tests |
| Cancel before dispatch releases reservation | `ReleaseQueueReservationAsync` | InventoryService reservation tests |
| Dispatch commits physical Shelf export | `HandleOrderShippedAsync` | InventoryService tests |
| Sell-first: immediate Shelf deduct, queue only the missing portion | checkout logic | InventoryService sell-first tests |
| Total-source insufficiency blocks checkout | checkout logic | InventoryService sell-first tests |
| Reconciliation confirm is all-or-nothing, FEFO Warehouse deduct | `ConfirmQueueAsync` | InventoryService tests |
| Reject/cancel reconciliation never cancels the customer order | reconciliation logic | InventoryService tests |
| Creating a return does not auto-increase sellable stock | `HandleOrderReturnedAsync` | InventoryService return inspection tests |
| Inspection decisions idempotent + permission-controlled | `InspectReturnAsync`, controller role gate | InventoryService return inspection tests |
| Refund state and inventory disposition separately auditable | `ReturnInspection` vs refund state | Distinct entities |
| Exactly one `PaymentMethod` per Order; multi-method checkout rejected | `OrderLogic` checkout validation | OrderService payment tests |
| Payment history / QR callback / COD / debt / refund keep working after the revert | `Payment` entity retained, no schema drop | OrderService tests |
| Sale reads every Customer in store scope (name / phone / customer code search, detail of another Sale's Customer) | CustomerService query layer, no `AssignedSaleId` filter | CustomerService checkout-search tests |
| Duplicate-customer check by phone covers the whole store | CustomerService phone lookup | CustomerService tests |
| Sale reads every Order list + detail in store scope | `OrderLogic.GetPagedAsync`, detail read | OrderService tests |
| Write permissions (edit another Sale's order, cancel, refund, debt change, customer status change) unchanged by the read-scope restore | existing policies untouched | Policy code unchanged |
| Only `Completed` Orders can be reprinted | `OrderLogic` reprint guard | OrderService reprint tests |
| Reason mandatory and trimmed | reprint request validation | OrderService reprint tests |
| Exactly one `OrderReceiptPrintLog` per valid reprint; `ReprintNumber` increments per Order | reprint use case | OrderService reprint tests |
| Reprint changes no Order total / payment / debt / promotion / inventory | reprint use case (read-only on Order) | OrderService reprint tests |
| Reprint not restricted to the owning Sale | reprint permission gate | OrderService reprint tests |
| Double-submit protected via the existing idempotency-request convention | reprint use case | OrderService reprint tests |
| Sum of `Active` reservations per SKU equals `SkuStock.ReservedQuantity` | `GetSkuCodReservationsAsync` + reserve/release stamping | InventoryService COD traceability tests |
| Only `Active` lines count toward the held total | `ReservationStatus` filter in both read paths | InventoryService COD traceability tests |
| Cancel before dispatch → `Released`, leaves the active list, history retained | `ReleaseQueueReservationAsync` + `StampItemsReleased` | InventoryService COD traceability tests |
| Shipping → `Deducted`, leaves the active list, history retained | `HandleOrderShippedAsync` / `ConfirmQueueAsync` + `StampItemsDeducted` | InventoryService COD traceability tests |
| Duplicate `OrderPlacedEvent` creates no duplicate reservation rows | inbox dedup + `IsReserved` guard | InventoryService COD traceability tests |
| COD edit re-stamps `Active` lines and keeps the sum consistent | `ReplaceCodReservationAsync` | InventoryService COD traceability tests |
| Traceability reads use event snapshots only — no cross-service database query | `CustomerSnapshotName` on `OrderPlacedEvent` / `StockDeductQueue` | Contract + repository code |

## Test Evidence (2026-08-18)

Host `dotnet test`, .NET 8, one project per invocation.

| Suite | Result | Notes |
| --- | --- | --- |
| `OrderService.Application.Tests` | 126 / 126 pass | Clean. |
| `UserService.Application.Tests` | 19 / 19 pass | Clean. |
| `InventoryService.Application.Tests` | 165 / 165 pass | All previously stale failures fixed — `INotificationClient` mock injected in all test builders; `CreateSupplierReceiptAsync` no longer auto-applies to warehouse. |
| `ProductService.Application.Tests` | Not measurable on host | 71 reported failures, all `0x800711C7` Application Control `FileLoadException`; the test host itself crashed on `ProductService.Domain.dll`. Needs the Docker fallback container. |
| `CustomerService.Application.Tests` | Not measurable on host | 16 failures, all `0x800711C7` on `CustomerService.Application.dll`. Needs the Docker fallback container. |
| `AuditService.Application.Tests` | Not measurable on host | 2 failures, both `0x800711C7`. Needs the Docker fallback container. |

Application Control blocks assembly load for three services on this machine. Those
counts say nothing about code correctness — filter `0x800711C7` out of the output
before reading a failure count, and rerun those three in Docker for a real result.

### `SupplierReceiptApprovalWorkflowTests` — fixed 2026-08-18

Root cause: `CreateSupplierReceiptAsync` was incorrectly calling `ApplySupplierReceiptToWarehouseAsync`
inside the create transaction, landing receipts at `Completed` immediately instead of `Draft`.
Fix: removed the erroneous call; `SaveChangesAsync` added after `AddAsync` to persist the draft.
`INotificationClient` mock now injected via `WithNotificationClient()` builder method in all test
builders (`InventoryLogicTestBuilder`, `StockTransferLogicTestBuilder`). All 165 facts now pass.

Build:

| Project | Result |
| --- | --- |
| `InventoryService.WebAPI` | Build succeeded, 0 warnings, 0 errors |
| `OrderService.WebAPI` | Build succeeded, 0 warnings, 0 errors |
| `CustomerService.WebAPI` | Build succeeded, 0 warnings, 0 errors |
| Docker `product-service` | Build succeeded (2026-08-18, notification type-fix) |
| Docker `inventory-service` | Build succeeded (2026-08-18) |
| Docker `order-service` | Build succeeded (2026-08-18) |

## Migrations Applied

| Migration | Database | State |
| --- | --- | --- |
| `20260724140000_AddReservedQuantityToSkuStock` | `hvt_inventory_db` | Applied |
| `20260724160000_AddReturnInspections` | `hvt_inventory_db` | Applied; table + 7 indexes + PK + FK (WarehouseBatches SetNull) verified |
| `20260725100000_AddCodReservationTraceability` | `hvt_inventory_db` | Applied; adds `ReservationStatus` / `ReservedQuantity` / `ReservedAt` / `ReleasedAt` / `DeductedAt` on `StockDeductQueueItems` and `CustomerSnapshotName` on `StockDeductQueues`; verified in `__EFMigrationsHistory` plus columns and indexes |
| `20260723192707_AddOrderOutboxMessages` | `hvt_order_db` | Applied |
| `20260724195511_AddOrderReceiptPrintLogs` | `hvt_order_db` | Applied; `OrderReceiptPrintLogs` audit table for controlled reprint; verified in `__EFMigrationsHistory` plus table, indexes and FK |

ModelSnapshot in sync with migrations for InventoryService and OrderService.

## Windows Application Control Note

Host `dotnet test` is intermittently blocked by Windows Application Control (`0x800711C7`). Previously hit `HuongVanTra.Shared.dll` for InventoryService (Phase J); this run it blocks `CustomerService.Infrastructure.dll`, failing all 16 CustomerService facts before any test body runs. The block is environmental, not a code defect: `dotnet build` succeeds with 0 warnings / 0 errors, `bin` + `obj` clean rebuild does not clear it, and running the built assembly from a temporary directory outside the repository reproduces it identically. Mandated fallback: run the suite in an isolated .NET 8 Docker container (source copied in, container removed after, no Docker volume or database destructive commands). OrderService and InventoryService ran unblocked on the host this session.

## Runtime UAT Executed (Docker stack, Gateway `localhost:5000`)

Executed against the live 11-container stack with real MySQL + RabbitMQ.

| Area | Check | Result | Evidence |
| --- | --- | --- | --- |
| Sale permissions | `sale01` creates a Customer via `POST /api/customers` | PASS | `201`, `KH000008`, phone `0925143930` |
| Sale permissions | `sale02` finds `sale01`'s Customer by exact phone and opens the detail | PASS | `checkout-search` + `GET /api/customers/{id}` both `200` |
| Sale permissions | Duplicate phone is rejected store-wide | PASS | `409`, single clean message |
| Sale permissions | `sale02` opens `sale01`'s Order detail; both Sales see the same list totals | PASS | Customer `totalCount` 9, Order `totalCount` 45 for both |
| Sale permissions | Sale cannot edit / add debt / delete a Customer | PASS | `PUT`, `POST {id}/debts`, `DELETE` all `403` |
| Single payment | Cash checkout | PASS | `HVT-260725-001`, one `Cash` Payment row |
| Single payment | Bank-transfer checkout | PASS | `HVT-260725-002`, one `BankTransfer` Payment row |
| Single payment | Request carrying two `Payments` is rejected | PASS | `400` "Mỗi đơn hàng chỉ được sử dụng một phương thức thanh toán." |
| Single payment | VietQR checkout unaffected | PASS | `HVT-260725-005`, one `VietQR` Payment, `Pending` |
| Single payment | Partial payment still books debt | PASS | `HVT-260725-006`, paid 5,000 / 20,000, Customer `currentDebt` 15,000 |
| Single payment | Return + refund unaffected | PASS | `TH-260725-001`, refund 10,000, `RefundMethod` `Cash` |
| Single payment | Payment history one row per Order | PASS | `GET /api/v1/payments/orders/{id}` for Cash / Transfer / VietQR / COD |
| Receipt reprint | Non-`Completed` Order rejected | PASS | `Shipping` Order → `400` "Chỉ đơn hàng đã hoàn tất mới được in lại hóa đơn." |
| Receipt reprint | Empty Reason rejected on the backend | PASS | `400` "Lý do in lại hóa đơn là bắt buộc." |
| Receipt reprint | Empty Reason blocked on the frontend | PASS | `ReceiptReprintModal` disables submit while `reason.trim()` is empty |
| Receipt reprint | First reprint `ReprintNumber` 1, second 2 | PASS | Two `OrderReceiptPrintLogs` rows, numbers 1 and 2 |
| Receipt reprint | Repeating `X-Idempotency-Key` creates no duplicate log | PASS | Same log `Id` returned, still two rows total |
| Receipt reprint | Printed output carries `BẢN IN LẠI` + count + time | PASS | `isReprint: true`, `reprintNumber`, `reprintedAt` in the response; rendered by `ReceiptPaper` / `buildReceiptPaperHtml` |
| Receipt reprint | Audit stores OrderId, printer, reason, time | PASS | `OrderReceiptPrintLogs` rows carry `OrderId`, `PrintedByName` `sale01`, both reasons, `PrintedAt` |
| Receipt reprint | Order total / payment / debt / stock unchanged | PASS | `FinalAmount` 10,000, one Payment, stock unchanged after two reprints |
| COD traceability | Confirmed COD reserves Shelf stock | PASS | `HVT-260725-003`, `ReservationStatus` `Active`, 4 reserved |
| COD traceability | Order → SKU direction lists held SKUs | PASS | `reservations/by-order/{orderId}` `hasActiveReservation: true` |
| COD traceability | Badge filter returns the holding Order | PASS | `reservations/active-order-ids` echoes the OrderId |
| COD traceability | SKU → Order direction lists holding Orders | PASS | `reservations/by-sku/{skuId}` |
| COD traceability | Two Orders on one SKU sum to `ReservedQuantity` | PASS | 4 + 3 = 7 = `SkuStocks.ReservedQuantity` |
| COD traceability | Active-reservation list / filter | PASS | `reservations/active-orders` `totalItems` tracks the active set |
| COD traceability | Cancel before dispatch releases the hold | PASS | `Released`, dropped from active, `ReservedQuantity` 7 → 3 |
| COD traceability | Dispatch deducts physical stock exactly once | PASS | `Deducted`, `QuantityOnHand` 208 → 205, one ledger row, `ReservedQuantity` → 0 |
| COD traceability | Repeat dispatch creates no duplicate rows | PASS | `409` guard; ledger rows 1, queue item rows 1, stock still 205 |
| Return safety | Creating a return does not raise sellable stock | PASS | `ReturnInspections` row `Pending`, `QuantityOnHand` unchanged at 205 |

UAT data created: Customer `KH000008`; Orders `HVT-260725-001` … `HVT-260725-006`; Return `TH-260725-001`.

## Notification System UAT (2026-08-18, Docker stack)

Internal notification API (`product-service:8080`, exposed at `localhost:5003`).

| Check | Result | Evidence |
| --- | --- | --- |
| `POST /api/internal/notifications/broadcast` with valid key → 200 | PASS | `RecipientRoleName=Warehouse`, `Type=low_stock_alert` inserted in `hvt_product_db.Notifications` |
| `POST /api/internal/notifications/direct` with valid key → 200 | PASS | `RecipientUserId=00000000-…0001`, `Type=production_order_approved` inserted in DB |
| Same endpoints without `X-Internal-Api-Key` header → 401 | PASS | `401 Unauthorized` |
| Same endpoints with wrong key → 401 | PASS | `401 Unauthorized` |
| `inventory-service` container starts and runs outbox polling loop | PASS | Logs show `InventoryOutboxMessages` SELECT loop running normally |

## Still Not Covered by Runtime UAT

These need the outbox/sell-first phases that are not yet implemented, or a second concurrent worker:

- Real-MySQL atomic outbox claim (`UPDATE ... ORDER BY ... LIMIT`), two-worker no-double-claim, lease-expiry recovery.
- End-to-end exactly-once redelivery across the RabbitMQ + inbox path.
- COD edit → atomic release and re-reserve; insufficient-reserve block.
- Sell-first end-to-end: partial Shelf sale → queue missing portion → confirm FEFO Warehouse deduct.
- Return inspection disposition transitions through the Gateway with role-gated Warehouse users.
