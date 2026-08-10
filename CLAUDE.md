# HVTPOSIMS Project Guide

## Repository

- Repository root: `D:\SEP490_G66_HuongVanTra-System`
- Backend root: `backend/huongvantra_backend`
- Frontend root: `frontend/huongvantra-web-client`
- Main working branch for this work: `HuyTD`
- Always inspect branch, HEAD, and worktree before editing.
- Stop when the worktree contains unexplained changes.

## Architecture

- Backend: .NET 8 microservices.
- Frontend: React with Vite.
- Database: MySQL 8, database-per-service.
- Messaging: RabbitMQ with MassTransit.
- Gateway: YARP API Gateway.
- Main services:
  - CustomerService
  - UserService
  - ProductService
  - OrderService
  - InventoryService
  - DocumentService
  - AuditService
  - API Gateway
- Docker Compose files:
  - `backend/huongvantra_backend/docker-compose.yml`
  - `backend/huongvantra_backend/docker-compose.dev.yml`

## Database Ownership

- OrderService: `hvt_order_db`
- InventoryService: `hvt_inventory_db`
- ProductService: `hvt_product_db`
- CustomerService: `hvt_customer_db`
- UserService: `hvt_user_db`
- DocumentService: `hvt_document_db`
- AuditService: `hvt_audit_db`

Do not introduce cross-service database access. Communicate across service boundaries through APIs or integration events.

## Development Workflow

- Read the relevant implementation, interfaces, entities, configurations, migrations, tests, and callers before editing.
- Prefer large functional batches when the requested phase has one cohesive objective.
- Keep changes strictly within the requested phase.
- Do not perform unrelated refactoring.
- Do not modify generated files unless required by the requested task.
- Do not commit or push unless explicitly requested.
- Before reporting completion, list:
  - changed files;
  - migrations created;
  - build commands;
  - tests run;
  - test results;
  - unresolved issues;
  - manual verification still required.

## Build and Test Guidance

- Prefer targeted service builds and targeted tests.
- Do not rebuild the entire Docker stack by default.
- Do not run broad tests when focused tests are sufficient.
- Windows Application Control may block some .NET test execution.
- When Docker tests are necessary, mount source read-only or copy it into the container so Linux `bin` and `obj` directories do not pollute the Windows worktree.
- Do not automatically restart or rebuild Docker services unless runtime verification requires it.

## Prohibited Commands

Never run these commands unless the user explicitly overrides this rule after being warned:

- `git reset --hard`
- `git clean -fd`
- `git push --force`
- `docker compose down -v`
- `docker system prune --volumes`

Do not rewrite Git history.

## Ownership Boundary

Do not modify HieuTH-owned scope unless explicitly requested:

- shifts;
- shift dashboard;
- receipt reprint;
- related shift-management work.

The user's primary work includes Promotion and the remaining POS/Inventory reliability roadmap.

## Inventory Model

The system covers one physical store with two business stock areas:

- `Kho` / Warehouse:
  - raw materials;
  - packaging.
- `Kệ Hàng` / Shelf/POS:
  - finished shelf products.

Official quantity principles:

- Piece and Gram base quantities use positive integers.
- One SKU may have multiple inventory or production lots.
- Lot-level cost, remaining quantity, production/import date, and expiration may differ.
- Inventory operations must preserve FEFO and idempotency where required.

## Current POS Reliability Roadmap

Status audited against code on 2026-08-06. Summary of what actually remains:

| Phase | State | What is left |
|---|---|---|
| G — Outbox/Inbox | G1–G7 done | G8 Docker UAT |
| H — COD Reservation | H1–H6 done, H7 mostly done | COD-edit re-reserve at runtime |
| I — Sell-first (KB1–KB3) | done | FEFO batch-level unit tests |
| I — POS-06a Backorder | done | — |
| J — Return Inspection | done | Gateway UAT with Warehouse role |
| K — Regression & docs | partial | stale test counts, POS UAT harness, cleanup |

Business rules below remain the specification of record even where implementation is
complete — keep them when editing.

### Phase G — POS-05 Transactional Outbox/Inbox

Completed: G1–G7.

- G1 — OrderService Outbox schema (`OutboxMessages` table, migration `20260723192707_AddOrderOutboxMessages`).
- G2 — Outbox Writer (`IOrderOutboxWriter` / `OrderOutboxWriter`, does not call SaveChanges).
- G3 — Integration event contract metadata (`OrderPlacedEvent`, `OrderCancelledEvent`, `OrderReturnedEvent`, `OrderCompletedEvent`, `OrderShippedEvent` — all with `EventId` + `OccurredAtUtc`).
- G4 — `OutboxOrderEventPublisher` wires `IOrderEventPublisher` → `IOrderOutboxWriter`; publisher calls precede `SaveChangesAsync` in all four handlers (Create, Cancel, Complete, Return).
- G5 — `OutboxDispatcherHostedService` running as background service; `OutboxDispatchProcessor` with exponential backoff; `IOutboxStore` atomic lease claim via raw SQL `UPDATE … LIMIT`.
- G6 — InventoryService consumers (`OrderPlacedConsumer`, `OrderCancelledConsumer`, `OrderShippedConsumer`, `OrderReturnedConsumer`) use two-tier dedup: `ExistsByEventIdAsync` (EventId) + `ExistsAsync` (business key). Inbox record (`ProcessedIntegrationEvent`) committed atomically with stock mutation via shared DbContext.
- G7 — `OutboxMessagesController` at `api/outbox-messages`: paged list, stats, detail, manual retry. Guarded by `PermissionNames.MonitorOutbox`.

Not completed:

- G8 — End-to-end runtime verification (Docker UAT). Current evidence is unit tests only.
  `docs/pos-reliability-regression-matrix.md` lines 140-145 record the specific gaps:
  atomic lease claim against real MySQL, two concurrent workers not double-claiming,
  expired-lease recovery, and exactly-once redelivery through RabbitMQ.

Note: the two-tier dedup described in G6 lives in `InventoryLogic` (`ExistsByEventIdAsync` /
`ExistsAsync`), not in the consumer classes — consumers only delegate.

### Phase H — POS-04 COD Stock Reservation

Completed: H1–H6 (infrastructure already implemented).

Key implementation:

- `SkuStock.ReservedQuantity` — reservation counter per SKU.
- `StockDeductQueueItem.ReservationStatus` (`None/Active/Released/Deducted`) + per-line `ReservedQuantity`, `ReservedAt`, `ReleasedAt`, `DeductedAt`.
- `StockDeductQueue.IsReserved` — idempotency guard.
- `ReplaceCodReservationAsync` — atomic release-old + re-reserve-new when COD order items are edited.
- Available-stock at Shelf = `SkuStock.QuantityOnHand - SkuStock.ReservedQuantity`.
- All read/trace endpoints present (`/reservations/by-order`, `/by-sku`, `/active-orders`).
- **Bug fix 2026-08-10**: COD reservation now checks both Shelf and Warehouse finished goods (like POS direct checkout). When Shelf insufficient but Warehouse has stock, reserves only Shelf portion and marks `WarehouseTransferQuantity` for Thủ kho to transfer. Queue stays `Waiting` (not `Insufficient`) so warehouse staff can process. Only fails when both Shelf + Warehouse insufficient.

Partially completed:

- H7 — Docker UAT largely done. `docs/pos-reliability-regression-matrix.md` lines 127-135
  records 9 COD reservation cases passing against the real stack (reserve, release,
  dispatch, repeat-request 409).
- Still missing: the COD-edit branch (atomic release-old + re-reserve-new) has not been
  exercised at runtime — see matrix line 146.

### Phase I — POS-06 Sell-first Reconciliation

Completed: I1–I7.

Implemented in commits 6cb76c3, 4ad8cb5, 456879a.

Deduction priority order at checkout:

1. Shelf (Kệ Hàng) finished goods
2. Warehouse (Kho) finished goods
3. Warehouse raw materials / packaging — only when both Shelf and Warehouse finished goods are exhausted

Business rules (confirmed 2026-08-04, implemented — verified against code 2026-08-06):

**Scenario 1 — Shelf sufficient:**
- Deduct Shelf, order Completed immediately. No Thủ kho action needed.

**Scenario 2 — Shelf insufficient, Warehouse finished goods covers the rest:**
- Sale confirms payment → order status: WaitingTransfer (Chờ điều chuyển), customer waits.
- Thủ kho confirms once → system auto-generates Transfer Slip (Kho → Kệ).
- Order → Completed, hand goods to customer.

**Scenario 3 — Shelf + Warehouse finished goods insufficient, raw materials sufficient:**
- Sale confirms payment → order status: WaitingProduction (Chờ sản xuất), reconciliation queue created.
- Thủ kho confirms once → system auto-generates simultaneously:
  - Production Order (records raw material → finished goods conversion)
  - Transfer Slip (Kho → Kệ)
- Order → Completed, hand goods to customer.

**Scenario 4 — All sources insufficient (Backorder):**
- See Phase I — POS-06a below.

General rules:
- Confirmation is all-or-nothing.
- Insufficient confirmation must not create partial or negative stock.
- Rejecting or cancelling reconciliation never cancels the completed customer order.

Implementation status (verified 2026-08-06 — scenarios 2 and 3 are DONE, the earlier
"requires rework" note was stale):

- Scenario 2: `InventoryLogic.PreparePosStockDeductionAsync` returns mode
  `WarehouseTransferPending`; `OrderLogic.cs:2550` maps it to `OrderStatus.WaitingTransfer`.
  Only the Shelf portion is deducted at checkout; the Warehouse portion waits for Thủ kho.
- Scenario 3: mode `pending_bom_reconciliation` → `OrderLogic.cs:2551` →
  `OrderStatus.WaitingProduction`.
- Single-confirmation auto-generation is implemented in `InventoryLogic.ConfirmQueueAsync`
  (line 707). One transaction: sufficiency check first (all-or-nothing), then Production
  Order, then Kho → Kệ Transfer Slip, then Shelf export. Shortage sets `QueueStatus.Insufficient`
  and mutates no stock.
- `ReadyToDeliver` exists as an additional status for the pickup handoff step.

Remaining gap:

- FEFO batch-level deduction path (SimulateWarehouse=false) not exercised in unit tests.

### Phase I — POS-06a Backorder on Material Shortage (Mentor requirement, 2026-08-04)

Completed (backend and frontend), verified 2026-08-06.

Mentor feedback: instead of blocking the order when Warehouse materials are insufficient,
the system should present the customer with a backorder option.

New business rules:

- When checkout detects total material shortage, do NOT block the order.
- Return a backorder signal to POS with message: "Sản phẩm này tạm thời hết hàng, sẽ có sau 3–5 ngày nữa."
- Cashier presents the customer with a yes/no choice.
- If customer declines: order is not saved (same as current block behaviour).
- If customer accepts: order is saved and payment proceeds normally.
- Order receives a new status indicating backorder (e.g. WaitingMaterials or BackOrdered).
- Reconciliation queue is created immediately with status Insufficient.
- When materials are restocked, Thủ kho confirms the queue normally (existing confirm flow).
- Cancelling a backorder order releases the queue without any stock movement.

Design constraints:

- Change is isolated to: InventoryService PreparePosStockDeductionAsync response,
  OrderService handling of the new response mode, and POS confirmation dialog.
- Do not change the Confirm/Cancel queue path — it already handles Insufficient queues.
- Do not change non-POS channels (COD, B2B still use event-driven path).

Where it landed:

- `InventoryLogic.cs:364-377` returns `BackorderRequired` instead of blocking; message text
  at lines 507-508; lead days configurable via `BackorderOptions`.
- Queue created immediately with `QueueStatus.Insufficient` (lines 430-435).
- `OrderLogic.cs:2552` maps mode `BackorderAccepted` → `OrderStatus.WaitingMaterials`.
- POS dialog: `features/pos/components/BackorderConfirmModal.jsx`, wired at `PosPage.jsx:3253`.
- Beyond the original scope, commit `c8596cda` added deposit ≥50%, pickup deadline, and
  deposit-forfeit policy.

### Phase J — Return Inspection Safety

Completed J1–J5 (backend and frontend), verified 2026-08-06.

Business rules:

- Creating a return must not automatically increase sellable stock.
- Returned goods require inspection.
- Supported dispositions include:
  - Restock Approved;
  - Quarantined;
  - Disposed or Rejected.
- Refund state and inventory disposition must remain separately auditable.
- Inspection decisions must be idempotent and permission-controlled.

Where it landed:

- `InventoryLogic.cs:1695-1709` creates `ReturnInspection` rows with `Disposition.Pending`
  and does not touch `QuantityOnHand`; asserted by `ReturnInspectionTests.cs:214-238`.
- Dispositions implemented at `InventoryLogic.cs:1741-1795`; Quarantined moves goods to
  `Location = "Quarantine"` so they stay out of sellable stock.
- Idempotency guards at lines 1688 and 1733-1734; authorization via
  `ReturnInspectionController.cs:39` (`WarehouseOrManagerOps`).
- UI: `features/inventory/pages/ReturnInspectionsPage.jsx`, route registered in `App.jsx:128`.

Remaining gap:

- Gateway-level UAT with a real Warehouse-role user has not been run.

### Phase K — Full Regression and Documentation

Partially completed.

Done:

- `docs/pos-reliability-regression-matrix.md` — invariant matrix with code traces, plus
  30 Docker UAT cases already executed against the real stack.
- `docs/inventory-acceptance-guide.md` — covers Phase J.

Not completed:

- Test counts in the matrix (lines 72-73) are stale; actual suite is 50 test files /
  373 `[Fact]`+`[Theory]` attributes across six services.
- No scripted UAT harness for the POS flows.
- Final cleanup and checkpoint.

## Transactional Messaging Rules

For the remaining POS-05 work:

- Order data and its Outbox event must be saved in the same OrderService database transaction.
- `OutboxMessage.Id` must equal the payload `EventId`.
- Request paths must not directly publish migrated RabbitMQ events.
- Dispatcher retries must never lose events.
- Inventory Inbox must deduplicate by `EventId`.
- Add a business idempotency key such as `OrderId + OperationType` where multiple EventIds could represent the same stock operation.
- Inbox processing and inventory mutation must be atomic.
- Redelivery must not duplicate stock movements, slips, allocations, or ledger entries.

## Source Control Rules

- Preserve the current branch unless explicitly instructed otherwise.
- Never stage unrelated files.
- Before a requested commit, validate the exact changed-file scope.
- Before a requested push:
  - fetch the remote;
  - verify ahead/behind status;
  - stop on divergence;
  - never force push.
- Keep commits focused by functional phase.

## Development Environment
- OS: Windows 10.0.26200
- Shell: Git Bash
- Path format: Windows (use forward slashes in Git Bash)
- File system: Case-insensitive
- Line endings: CRLF (configure Git autocrlf)
