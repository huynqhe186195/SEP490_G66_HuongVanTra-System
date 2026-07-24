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

## Test Evidence (2026-07-25)

| Suite | Result | Notes |
| --- | --- | --- |
| `OrderService.Application.Tests` | 98 / 98 pass | Host `dotnet test`, .NET 8. Includes 16 receipt-reprint facts. |
| `InventoryService.Application.Tests` | 68 / 68 pass | Host `dotnet test`. Includes 7 `CodReservationTraceabilityTests` facts. |
| `CustomerService.Application.Tests` | Not executed — blocked | All 16 facts fail with `0x800711C7` Application Control on `CustomerService.Infrastructure.dll`. Build succeeds 0/0; clean rebuild and out-of-repo run reproduce the block. See note below. |
| Frontend `npm run build` | Success | Only pre-existing chunk-size / dynamic-import warnings |

Build:

| Project | Result |
| --- | --- |
| `InventoryService.WebAPI` | Build succeeded, 0 warnings, 0 errors |
| `OrderService.WebAPI` | Build succeeded, 0 warnings, 0 errors |
| `CustomerService.WebAPI` | Build succeeded, 0 warnings, 0 errors |

## Migrations Applied

| Migration | Database | State |
| --- | --- | --- |
| `20260724140000_AddReservedQuantityToSkuStock` | `hvt_inventory_db` | Applied |
| `20260724160000_AddReturnInspections` | `hvt_inventory_db` | Applied; table + 7 indexes + PK + FK (WarehouseBatches SetNull) verified |
| `20260725100000_AddCodReservationTraceability` | `hvt_inventory_db` | Created; adds `ReservationStatus` / `ReservedQuantity` / `ReservedAt` / `ReleasedAt` / `DeductedAt` on `StockDeductQueueItems` and `CustomerSnapshotName` on `StockDeductQueues` |
| `20260723192707_AddOrderOutboxMessages` | `hvt_order_db` | Applied |
| `20260724195511_AddOrderReceiptPrintLogs` | `hvt_order_db` | Created; `OrderReceiptPrintLogs` audit table for controlled reprint |

ModelSnapshot in sync with migrations for InventoryService and OrderService.

## Windows Application Control Note

Host `dotnet test` is intermittently blocked by Windows Application Control (`0x800711C7`). Previously hit `HuongVanTra.Shared.dll` for InventoryService (Phase J); this run it blocks `CustomerService.Infrastructure.dll`, failing all 16 CustomerService facts before any test body runs. The block is environmental, not a code defect: `dotnet build` succeeds with 0 warnings / 0 errors, `bin` + `obj` clean rebuild does not clear it, and running the built assembly from a temporary directory outside the repository reproduces it identically. Mandated fallback: run the suite in an isolated .NET 8 Docker container (source copied in, container removed after, no Docker volume or database destructive commands). OrderService and InventoryService ran unblocked on the host this session.

## Manual / Runtime Verification Still Required

The following need a live Docker stack with real MySQL + RabbitMQ and are not covered by the InMemory unit layer:

- Real-MySQL atomic outbox claim (`UPDATE ... ORDER BY ... LIMIT`), two-worker no-double-claim, lease-expiry recovery.
- End-to-end exactly-once redelivery across the RabbitMQ + inbox path.
- COD lifecycle end-to-end: create -> reserve -> edit -> replace -> ship -> deduct; cancel before/after ship; insufficient-reserve block.
- Sell-first end-to-end: partial Shelf sale -> queue missing portion -> confirm FEFO Warehouse deduct.
- Return inspection end-to-end through the Gateway with role-gated users.
- Cash checkout and bank-transfer checkout each succeed with a single `PaymentMethod`; a multi-method checkout request is rejected.
- Sale A creates a Customer, Sale B finds and opens it; Sale B opens Sale A's Order detail.
- Reprint a `Completed` Order: audit row written, printed output shows `BẢN IN LẠI` with reprint count and reprint time.
- COD reservation traceability both directions: reserve, view from the Order detail, view the same reservation from the SKU detail, cancel → released, ship → deducted and removed from the active list.
- `CustomerService.Application.Tests` in the Docker fallback container (host run blocked by Application Control).

Run these via the UAT script in `inventory-acceptance-guide.md`.
