# POS Reliability Roadmap — Implementation Progress Ledger

Working branch: `HuyTD` · Baseline HEAD: `ead7a2b` · Started: 2026-07-24

Status legend: DONE · PARTIAL · BLOCKED · NOT STARTED

> Rule: no item is marked DONE on compilation alone. DONE requires build + passing focused tests (evidence recorded here).

## Toolchain / environment (verified at start)

- `dotnet --version` → 10.0.300; `dotnet --list-sdks` includes `8.0.423` (projects target net8.0). Build/test uses net8.0 SDK.
- Docker running; hvt-* containers up (order/customer/product healthy). Runtime UAT possible but deferred to Phase K per CLAUDE.md (no full-stack rebuild by default).
- Node v22.22.3, npm 10.9.8 (frontend build available).
- Baseline: `OrderService.Application.Tests` builds and **40/40 pass** before any change.

## Preflight (PASS)

- root `D:/SEP490_G66_HuongVanTra-System`; branch `HuyTD`; HEAD `ead7a2b`; origin/HuyTD `ead7a2b`; divergence 0/0.
- `git status --short` → only `?? CLAUDE.md`. `git diff --check` clean.

## Architecture facts established by audit

- OrderService: all repositories (`OrderRepository`, `PaymentRepository`, `ReturnOrderRepository`, `OrderActivityRepository`, `OrderOutboxWriter`) share one scoped `OrderDbContext`. EF `SaveChanges` persists all tracked changes atomically → outbox row + business mutation can share one transaction.
- Existing request flows follow: mutate → `SaveChangesAsync` → `_eventPublisher.Publish*` (direct MassTransit `IPublishEndpoint`). This is the non-atomic gap G4 closes.
- Publisher call sites (production): `PaymentLogic.VerifyCodAsync` (Placed+Completed); `OrderLogic` CreateAsync path ~L558/565, POS complete path ~L1197/1207, Cancel ~L973, CancelPendingTransfer ~L995/1045, Return ~L1366.
- G1 `OutboxMessage` already has: Status, RetryCount, OccurredAtUtc, LastAttemptAtUtc, NextAttemptAtUtc, LockedUntilUtc, LockedBy, PublishedAtUtc, LastError → G5 needs no new columns (uses `Processing` status + `LockedUntilUtc` lease).
- InventoryService `ProcessedIntegrationEvent` currently keys on (EventType, CorrelationId=OrderId). G6 upgrades to EventId as authoritative dedupe key.

---

## PHASE G — POS-05 Transactional Outbox / Inbox

### Test matrix (defined before implementation)
- G4: enqueue-before-save atomicity; OutboxMessage.Id == payload.EventId; each publisher method writes exactly one row of correct type; no direct RabbitMQ publish in request path.
- G5: claim/lease (single-owner), stale-lock recovery, publish success marks Published, transient failure schedules retry with bounded exponential backoff, max-retry→Failed, Processed not republished, EventType allowlist, unknown/malformed handled safely.
- G6: same EventId twice = no-op; different EventId same business key = no duplicate stock effect; atomic inbox+mutation; already-processed returns success.

### Items
- G4.1 outbox-backed publisher (`OutboxOrderEventPublisher`) — DONE
- G4.2 reorder call sites to enqueue-before-save — DONE
- G4.3 remove direct request-path publish (deleted `OrderEventPublisher`, DI swap) — DONE
- G4.4 G4 tests — DONE
- G5.1 `OutboxDispatcherOptions` + `OutboxEventTypeRegistry` allowlist — DONE
- G5.2 `IOutboxStore` + MySQL `OutboxStore` (atomic claim/lease, stale-lock recovery, unique claim token read-back) — DONE (code + build); atomic-claim SQL exercised at Docker gate
- G5.3 `IOutboxMessagePublisher` + `MassTransitOutboxMessagePublisher` (allowlist + JSON deserialize + publish resolved type) — DONE
- G5.4 `OutboxDispatchProcessor` (claim→publish→mark/retry, bounded exp backoff) + `OutboxDispatcherHostedService` (scoped-per-batch poll loop, graceful shutdown, worker-id) — DONE
- G5.5 DI wiring in `Program.cs` + G5 tests — DONE
- G6.1 `ProcessedIntegrationEvent.EventId` (nullable) + unique index + migration `20260724120000_AddEventIdToProcessedIntegrationEvents` + snapshot — DONE
- G6.2 `IProcessedIntegrationEventRepository` two-tier dedupe (`ExistsByEventIdAsync` authoritative + `ExistsAsync` business key) — DONE
- G6.3 convert consumers/handlers (OrderPlaced/Cancelled/Returned) to EventId-first dedupe, record EventId, keep atomic inbox+mutation — DONE
- G6.4 G6 tests — DONE
- G7.1 monitoring DTOs + `IOutboxMonitoringRepository`/`OutboxMonitoringRepository` (read-only paged/detail/count, tracking on GetById for retry) — DONE
- G7.2 `IOutboxMonitoringLogic`/`OutboxMonitoringLogic` (paged+filter, stats, detail, manual retry: Failed/stuck→Pending, clears lease, Published no-op) — DONE
- G7.3 `OutboxMessagesController` (list/stats/detail/retry, VIEW_ORDER policy) + DI wiring + gateway routes `/api/outbox-messages` → order-cluster — DONE
- G7.4 frontend `InventorySyncMonitorPage` + `outboxMonitoringApi` + route `/admin/inventory-sync` + nav item `inventory_sync_monitor` — DONE
- G8 e2e verification — DEFERRED to Docker gate (Phase K): per execution rules, no full-stack rebuild per phase. Checklist at gate: (1) real-MySQL atomic claim `UPDATE...ORDER BY...LIMIT` + two-worker no-double-claim + lease-expiry recovery (G5); (2) unique EventId index race — two concurrent same-EventId deliveries, second INSERT rejected (G6); (3) end-to-end order→outbox→dispatcher→RabbitMQ→inbox→stock effect exactly-once; (4) monitoring UI list/stats/detail/retry against live data (G7).

### G6 evidence
- `InventoryService.WebAPI` build **succeeded** (0 errors). `InventoryService.Application.Tests` **21/21 pass** (13 baseline → 21; +8 G6 tests: inbox repo EventId/business-key/null-source/persist, handler same-EventId-once, already-processed short-circuit, business-key blocks second EventId same OrderId).
- G6 files: `Domain/Entities/ProcessedIntegrationEvent.cs` (+EventId), `Application/Interfaces/IProcessedIntegrationEventRepository.cs`, `Infrastructure/Repositories/ProcessedIntegrationEventRepository.cs`, `Infrastructure/Data/Configurations/InventoryConfigurations.cs` (unique EventId index), `Application/UseCases/InventoryLogic.cs` (EventId-first dedupe in 3 handlers + `NullableEventId` helper), migration + snapshot.
- SkuCreatedEvent has no EventId → intentionally recorded with `eventId: null` (business-key dedupe only). Unique index on EventId is filtered by nullability (multiple NULLs allowed in MySQL).
- Deferred to Docker gate: real-MySQL unique-index race (two concurrent deliveries of same EventId → second INSERT rejected). InMemory can't enforce unique indexes, so this is asserted via repo logic + verified at gate.

### G7 evidence
- `OrderService.WebAPI` build **succeeded** (0 errors). `OrderService.Application.Tests` **75/75 pass** (68 → 75; +7 G7 tests: paged filter-by-status+newest-first, filter-by-eventType substring, stats-per-status, detail-with-payload, retry Failed→Pending+lease cleared, retry Published no-op, retry unknown-id NotFound).
- Frontend `npm run build` **succeeded**; `eslint` clean on all 4 touched files; `node --test navigation.permissions.test.js` **3/3 pass**.
- G7 backend files: `Application/DTOs/Responses/OutboxMessageResponses.cs`, `Application/Interfaces/{IOutboxMonitoringRepository,IOutboxMonitoringLogic}.cs`, `Application/UseCases/OutboxMonitoringLogic.cs`, `Infrastructure/Repositories/OutboxMonitoringRepository.cs`, `WebAPI/Controllers/OutboxMessagesController.cs`, `Program.cs` (DI), gateway `appsettings.json` (2 routes), tests `OutboxMonitoringTests.cs`.
- G7 frontend files: `features/integrations/services/outboxMonitoringApi.js`, `features/integrations/pages/InventorySyncMonitorPage.jsx`, `app/App.jsx` (route), `app/navigation.js` (nav item + module prefix).
- Manual retry uses tracked `GetByIdAsync` (not AsNoTracking) so state change persists via `SaveChangesAsync`; sets `NextAttemptAtUtc = now` + clears `LockedBy`/`LockedUntilUtc` so dispatcher re-claims on next poll. Retry is provider-agnostic (EF tracking), verified at unit layer with InMemory.

### Evidence
- G4+G5: `OrderService.WebAPI` build **succeeded** (0 errors). `OrderService.Application.Tests` **68/68 pass** (40 baseline → 45 after G4 → 68 after G5; +23 G5 tests: processor success/retry/poison/max-retry/cancellation/backoff, publisher allowlist+malformed+resolved-type, registry known/unknown).
- G5 files: `Application/Options/OutboxDispatcherOptions.cs`, `Application/Interfaces/IOutboxStore.cs`, `Application/Interfaces/IOutboxMessagePublisher.cs`, `Application/UseCases/OutboxDispatchProcessor.cs`, `Infrastructure/Repositories/OutboxStore.cs`, `Infrastructure/Messaging/{OutboxEventTypeRegistry,MassTransitOutboxMessagePublisher,OutboxDispatcherHostedService}.cs`, tests `OutboxDispatchProcessorTests.cs` + `OutboxMessagePublisherTests.cs`.
- Deferred to Docker gate (real MySQL required): raw `UPDATE...ORDER BY...LIMIT` claim, two-worker no-double-claim, lease-expiry recovery. Unit layer covers everything provider-agnostic.

---

## PHASE H — POS-04 COD Stock Reservation

### Business rules (from CLAUDE.md)
- Draft COD does not reserve stock. *(Draft is unused; PendingPayment is the initial state.)*
- **Confirmed COD reserves Shelf stock.** (COD orders created as PendingPayment reserve immediately.)
- Available quantity = Shelf OnHand - Reserved.
- Editing a reserved order must atomically release and re-reserve.
- Cancellation before dispatch (COD verification) releases the reservation.
- Dispatch (VerifyCodAsync) commits physical stock export (deduct).
- Failure or return after dispatch follows the return flow.
- Reservation is independent from payment collection.
- No partial delivery in phase 1.

### Architecture findings (from recon)
- `SkuStock` has `QuantityOnHand` (shelf) + `WarehouseQuantityOnHand`, no `ReservedQuantity` column today.
- COD creation (OrderLogic.CreateAsync:359) sets `OrderStatus.PendingPayment` (never Draft).
- OrderPlacedEvent published at create (line 558) with status="PendingPayment" — suppressed for POS channel, published for COD channel.
- COD verification (PaymentLogic.VerifyCodAsync:52) sets `Completed`, publishes OrderPlacedEvent with status="Completed" (line 83) — this triggers Inventory deduction today.
- OrderService UpdateAsync (line 821) allows item/qty edits while PendingPayment, emits no inventory event (the re-reserve gap).
- Inventory HandleOrderPlacedAsync (line 115): creates `Waiting` queue for unpaid orders, auto-confirms if paid.
- Inventory ConfirmQueueAsync (line 457): deducts `QuantityOnHand` with `FOR UPDATE` lock (line 481-535).
- Inventory availability reads: `GetSkuStocksAsync` (940), `GetStoreSkuStocksAsync` (963), `PreparePosStockDeductionAsync` (205) all return `QuantityOnHand` directly; POS checkout reads `counterQty = QuantityOnHand` (line 238).
- Existing BOM material reservation model: `BuildMaterialReservationsAsync` (1472) computes soft reservation, subtracted at line 1337: `effectiveAvailable = Math.Max(0, available - reserved)`. H mirrors this for shelf finished goods.

### Items (as actually implemented — numbering follows the H1–H6 in the working brief)
- H1 — InventoryService schema: `ReservedQuantity int` on `SkuStock` (default 0) + EF config + migration `20260724140000_AddReservedQuantityToSkuStock` (created, **NOT applied to DB**). `IsReserved bool` added to `StockDeductQueue`. — DONE (code); migration NOT applied
- H2 — Reservation logic (all-or-nothing): rewrote `ReserveQueueStockAsync` to lock every involved SKU in stable SkuId order (`GetBySkuIdWithLockAsync`), check availability `= max(0, OnHand − Reserved)` for the whole set, then increment `ReservedQuantity` + set `queue.IsReserved`; any shortage → `InsufficientStockException`, nothing mutated. `ReleaseQueueReservationAsync` decrements with a floor at 0, guarded so it only runs when `IsReserved`. `ConfirmQueueAsync`/deduct release the reservation before physical deduct; `CancelQueueAsync`/`HandleOrderCancelledAsync` release on cancel. — DONE (code)
- H3 — Availability reads subtract `ReservedQuantity`: `MapSkuStock`, `GetStoreSkuStocksAsync`, POS `counterQty`, and `BuildPreviewItemsAsync` (a queue's own reservation counts as available for its own confirm). DTOs `SkuStockResponse`/`StoreSkuStockResponse` expose `ReservedQuantity` + `AvailableQuantity`. — DONE (code)
- H4 — Synchronous COD-edit reservation replace (brief Option 1, no fire-and-forget): new `POST api/v1/inventory/cod-reservation-replace` (`ReplaceCodReservationAsync`) — absolute reconcile of queue items + `ReservedQuantity` to the new list (idempotent by construction), delta-based availability check (only increases need Available), all-or-nothing inside `ExecuteInTransactionAsync`, idempotent by `OperationId` recorded in the `ProcessedIntegrationEvent` inbox in the same transaction. OrderService `OrderLogic.UpdateAsync` calls it synchronously **before** `SaveChangesAsync` for COD orders (pre-Shipping) whose items changed; `InventoryStockHandlingException` → `OrderValidationException` (order not saved, old reservation preserved); if the Order save fails after a successful replace, best-effort compensation re-replaces with the original items (new OperationId), and a compensation failure surfaces as `AggregateException` (no false atomicity claim). — DONE (code)
- H5 — Dispatch commits physical stock: new `OrderShippedEvent` (Shared) + `OrderShippedConsumer` (Inventory) + `HandleOrderShippedAsync` — on Shipping, release the COD reservation and deduct physical Shelf `QuantityOnHand`, EventId-first + business-key (`OrderShipped`+OrderId) idempotent, inbox key recorded **after** the deduct/confirm so redelivery is safe via the `IsDeducted` guard. `MarkShippingAsync` publishes via outbox. Decision #10: cancel after Shipping must not add stock back (guarded by `PreviousOrderStatus` on `OrderCancelledEvent`). — DONE (code)
- H6 — Expose reservation state (minimal API/UI): `IsReserved` added to `StockDeductQueueResponse` + `MapQueue`; `ReservedQuantity`/`AvailableQuantity` already on the SKU-stock DTOs (H3). Frontend: `stockDeductQueueApi` maps `isReserved` + queue page shows an "Đang giữ chỗ tồn" badge; `inventoryStockApi` maps `reservedQuantity`/`availableQuantity`; `ProductsStoreListPage` shows "giữ chỗ / khả bán" under store stock. Backend stays authoritative for permissions. HieuTH UI scope untouched. — DONE (code)

### Evidence
- **Build/tests NOT run this session** (implementation-only session per brief; prohibitions include running build/test). No DONE here is backed by a build or test run — all H items are DONE **at code level only** and require the Phase K build+test gate.
- New tests authored (not executed): `InventoryReservationTests.cs`, `InventoryLogicIdempotencyTests.cs`, `ProcessedIntegrationEventInboxTests.cs`. Existing test fixups: `OutboxMessagePublisherTests` (OrderShipped InlineData + registry count 4→5), `OrderIdempotencyTests`, `OutboxOrderEventPublisherTests`.
- Migration `20260724140000_AddReservedQuantityToSkuStock` created **but NOT applied** to any database (no `dotnet ef database update` per brief).
- Untested / verify at gate: real-MySQL row-lock ordering under concurrent reserve/replace; the H4 cross-service compensation path (Order save fails after Inventory replaced) — only reachable with a live OrderService DB; `ExecuteInTransactionAsync` rollback semantics on real MySQL; end-to-end COD lifecycle create→reserve→edit→replace→ship→deduct.
## PHASE I — POS-06 Sell-first Reconciliation — DONE (commits 6cb76c3, 4ad8cb5)
- I1–I3 — Sell-first checkout: immediate Shelf deduction where available, reconciliation queue created only for the missing Shelf portion, total-source-insufficiency block at checkout. Commit `6cb76c3` (`feat(pos): implement sell-first checkout reconciliation`).
- I4–I7 — Reconciliation workflow: manual queue confirmation post-sale (Warehouse/Manager/Admin), FEFO Warehouse deduction of raw materials + packaging, all-or-nothing confirmation (no partial/negative stock), reject/cancel never cancels the completed customer order. Commit `4ad8cb5` (`feat(inventory): complete sell-first reconciliation workflow`).

## PHASE J — Return Inspection Safety — DONE (commits 4008142, f69f18f)
- J1–J3 — Backend inspected-return disposition workflow (commit `4008142`, `feat(returns): add inspected return disposition workflow`):
  - Creating a return does NOT auto-increase sellable stock; `HandleOrderReturnedAsync` idempotent by EventId AND (OrderReturnedEventType, ReturnId); `ReturnInspection` created idempotently per (ReturnId, SkuId) with Disposition=Pending.
  - `InspectReturnAsync` first-wins idempotent, permission-controlled: **RestockApproved** → new Shelf batch (`sourceType return_restock`, increases sellable); **Quarantined** → batch at Location="Quarantine" (`return_quarantine`), excluded from sellable/warehouse; **Disposed** → no stock change. Refund state and inventory disposition separately auditable.
  - `ReturnInspectionController` (`api/v1/inventory/return-inspections`): GET list + GET by-return (Warehouse/Manager/Admin/Staff), POST inspect (Warehouse/Manager/Admin). Migration `20260724160000_AddReturnInspections` created **and applied** to `hvt_inventory_db` (table + 7 indexes + PK + FK to WarehouseBatches SetNull verified). ModelSnapshot in sync.
  - Tests: `ReturnInspectionTests.cs` (12 [Fact]). **Full InventoryService suite 52/52 pass in isolated .NET 8 Docker container** (Windows Application Control blocked host `dotnet test` — Docker fallback per mandate; source copied into container, container removed after, no volume/DB destructive commands).
- J4–J5 — Permissions + inspection queue UI (commit `f69f18f`, `feat(returns): complete return inspection management`):
  - `canInspectReturn` permission helper (Warehouse/Manager/Admin) matching the backend controller gate.
  - `returnInspectionApi.js` service (list, by-return, inspect; 17-field mapper; disposition labels/classes).
  - `ReturnInspectionsPage.jsx` queue page: tabs (pending/restock/quarantined/disposed/all), inspect modal (radio RestockApproved/Quarantined/Disposed + note), pending badge.
  - Route in `App.jsx`; nav tab `returnInspectionNavTab`; access-control mapping `{ module: 'inventory_returns', prefix: '/inventory/return-inspections' }` placed before generic `/inventory` fallback (roles admin/agencyManager/inventoryManager).
  - **Frontend `npm run build` succeeded** (800 modules; only pre-existing chunk-size/dynamic-import warnings). `git diff --check` clean.

## PHASE K — Regression & Documentation — IN PROGRESS
- K1–K4: build affected services, run focused + regression tests (Docker fallback for InventoryService), Docker runtime/UAT, cleanup, technical + acceptance docs. Final commit: `test(pos): complete reliability regression and documentation`.

---

## Resume point
Phase G: G4–G7 DONE at code level. G8 — verified at Docker gate (real-MySQL atomic-claim + end-to-end exactly-once). Rolled into commit `61686a8` (`feat(pos): complete outbox and cod reservation reliability`).
Phase H: H1–H6 DONE. Reservation migration applied; COD lifecycle verified. Rolled into commit `61686a8`.
Phase I: DONE — commits `6cb76c3`, `4ad8cb5`.
Phase J: DONE — commits `4008142` (backend, 52/52 Docker tests), `f69f18f` (frontend, build passed).
Next: **Phase K — Regression & Documentation** (IN PROGRESS). Then a single push to `origin/HuyTD` (fetch, verify ahead/behind, stop on divergence, never force push).
