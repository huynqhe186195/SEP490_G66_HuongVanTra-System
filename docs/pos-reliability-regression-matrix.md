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

## Test Evidence (2026-07-24)

| Suite | Result | Notes |
| --- | --- | --- |
| `OrderService.Application.Tests` | 76 / 76 pass | Host `dotnet test`, .NET 8 |
| `InventoryService.Application.Tests` | 52 / 52 pass | Host `dotnet test` this run; also confirmed 52 / 52 in isolated .NET 8 Docker container during Phase J (Windows Application Control fallback) |
| Frontend `npm run build` | Success (800 modules) | Only pre-existing chunk-size / dynamic-import warnings |

Build:

| Project | Result |
| --- | --- |
| `InventoryService.WebAPI` | Build succeeded, 0 warnings, 0 errors |
| `OrderService.WebAPI` | Build succeeded, 0 errors (2 pre-existing nullable warnings, not Phase J) |

## Migrations Applied

| Migration | Database | State |
| --- | --- | --- |
| `20260724140000_AddReservedQuantityToSkuStock` | `hvt_inventory_db` | Applied |
| `20260724160000_AddReturnInspections` | `hvt_inventory_db` | Applied; table + 7 indexes + PK + FK (WarehouseBatches SetNull) verified |
| OrderService Outbox schema | `hvt_order_db` | Applied |

ModelSnapshot in sync with migrations for InventoryService.

## Windows Application Control Note

Host `dotnet test` for InventoryService was previously blocked by Windows Application Control (`0x800711C7`, `HuongVanTra.Shared.dll`). Mandated fallback: run the full suite in an isolated .NET 8 Docker container (source copied in, container removed after, no Docker volume or database destructive commands). Both the Docker run (Phase J) and a later host run (Phase K) reported 52 / 52.

## Manual / Runtime Verification Still Required

The following need a live Docker stack with real MySQL + RabbitMQ and are not covered by the InMemory unit layer:

- Real-MySQL atomic outbox claim (`UPDATE ... ORDER BY ... LIMIT`), two-worker no-double-claim, lease-expiry recovery.
- End-to-end exactly-once redelivery across the RabbitMQ + inbox path.
- COD lifecycle end-to-end: create -> reserve -> edit -> replace -> ship -> deduct; cancel before/after ship; insufficient-reserve block.
- Sell-first end-to-end: partial Shelf sale -> queue missing portion -> confirm FEFO Warehouse deduct.
- Return inspection end-to-end through the Gateway with role-gated users.

Run these via the UAT script in `inventory-acceptance-guide.md`.
