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

### Phase G — POS-05 Transactional Outbox/Inbox

Completed:

- G1 — OrderService Outbox schema.
- G2 — Outbox Writer.
- G3 — Integration event contract metadata.

Current baseline includes:

- `OrderPlacedEvent`
- `StockDeductedEvent`
- `OrderCancelledEvent`
- `OrderReturnedEvent`
- `OrderCompletedEvent`

Each relevant event has:

- `EventId`
- `OccurredAtUtc`

Not completed:

- G4 — Write integration events to Outbox in the same Order transaction.
- G5 — Outbox Dispatcher.
- G6 — Inventory Inbox and idempotent consumers.
- G7 — Monitoring and manual retry.
- G8 — End-to-end verification.

### Phase H — POS-04 COD Stock Reservation

Not completed:

- H1–H6.

Business rules:

- Draft COD does not reserve stock.
- Confirmed COD reserves Shelf stock.
- Available quantity equals Shelf OnHand minus Reserved.
- Editing a reserved order must atomically release and re-reserve.
- Cancellation before dispatch releases the reservation.
- Dispatch commits physical stock export.
- Failure or return after dispatch follows the return flow.
- Reservation is independent from payment collection.
- No partial delivery in phase 1.

### Phase I — POS-06 Sell-first Reconciliation

Not completed:

- I1–I7.

Business rules:

- No second-person approval before serving the customer.
- A valid sale completes immediately when total available sources are sufficient.
- Shelf stock is deducted immediately where available.
- A reconciliation queue is created only for the missing Shelf portion.
- Total source insufficiency at checkout blocks the order.
- Queue confirmation occurs manually after sale.
- Warehouse, Manager, or Admin may confirm.
- Confirmation deducts raw materials and packaging from Warehouse using FEFO.
- Confirmation is all-or-nothing.
- Insufficient confirmation must not create partial or negative stock.
- Rejecting or cancelling reconciliation never cancels the completed customer order.

### Phase J — Return Inspection Safety

Not completed:

- J1–J5.

Business rules:

- Creating a return must not automatically increase sellable stock.
- Returned goods require inspection.
- Supported dispositions include:
  - Restock Approved;
  - Quarantined;
  - Disposed or Rejected.
- Refund state and inventory disposition must remain separately auditable.
- Inspection decisions must be idempotent and permission-controlled.

### Phase K — Full Regression and Documentation

Not completed:

- K1–K4.

Includes:

- regression matrix;
- Docker runtime/UAT;
- technical and acceptance documentation;
- final cleanup and checkpoint.

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
