# Issues — B2B / DocumentService scope cut

**Status:** Deferred / out of current release scope (2026-08)  
**Type:** Scope cut (not a software defect)

## Decision

Corporate customers (`DoanhNghiep`), B2B contract orders, and **DocumentService** are removed from the **runtime** stack for this release.

## What changed

- `document-service` removed from `docker-compose.yml` (not started).
- Gateway routes `/api/contracts` and `document-cluster` removed.
- OrderService registers `DisabledContractCatalogClient` (no HTTP to DocumentService).
- Order create rejects `OrderChannel.B2B`, `ContractId`, and corporate customers.
- CustomerService rejects create/update/import of `CustomerGroup.DoanhNghiep`.
- Frontend flags remain off: `B2B_CONTRACTS_ENABLED`, `CORPORATE_CUSTOMERS_ENABLED`.

## What remains (by design)

- Source code for `DocumentService` kept in repo for possible re-enable.
- DB name `hvt_document_db` may still appear in init scripts (unused if service not started).
- Order columns `ContractId` / contract snapshots kept for historical rows.
- IAM permission names for contracts may still exist in seed (unused in UI).

## Impact

- POS / COD / Inventory / Payment / Outbox: unaffected for retail customers.
- B2B sell-by-contract and corporate CRM: unavailable until scope is restored.

## Restore checklist

1. Re-add `document-service` to compose and Gateway routes.
2. Switch OrderService DI back to `ContractCatalogClient` HttpClient.
3. Restore OrderLogic / CustomerLogic corporate gates.
4. Set FE flags to `true`.
5. Run DocumentService migrations against `hvt_document_db`.
