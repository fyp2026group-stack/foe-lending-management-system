# Technical Officer operational additions

Migration `046_officer_operational_contract.sql`; existing `/api/lending` authentication, private/no-store response, Origin/JSON/CSRF, current authority, optimistic versions, immutable ledger and exact command replay remain in force. No ADMIN operational bypass is added.

## Handover facts and laboratory names

`POST /api/lending/issues` accepts optional `remarks: string`, trimmed, 1–1000 characters when supplied. Omit when absent; null, blank, non-string and oversized values are invalid. Continue sending `{commandId,allocationId,quantity,expectedVersion,assetId?,serial?}` under the existing physical contract. Successful response stays `{loanId,assetId,movementId,version,loanVersion}`. A changed remark with the same command ID conflicts; an exact replay creates no additional history or movement. Remarks are factual borrower-visible handover facts, not private staff notes.

Every new successful issue stores one protected immutable handover record. Physical loan readers (`borrowed`, `expected`, `overdue`, `inspections`, `maintenance`, `extensions`, `borrower-history`) add:

```ts
{
  labName: string;
  handover: null | {
    loan_id: string; actor_id: string; movement_id: string;
    remarks: string | null; created_at: string;
  };
}
```

Names and nested history are added only after the existing record visibility checks. Legacy issues have `handover: null`; no facts are backfilled. New issues without remarks have a record with `remarks: null`. `ready` and `allocations` rows also add `labName: string` using the same existing row scope. Existing `labId` remains the filter/identity key.

## Assigned laboratory completed operations

`GET /api/lending/operations-summary?from=<ISO timestamp>&to=<ISO timestamp>&labId=<optional UUID>` requires a current active TECHNICAL_OFFICER role. Both finite timestamps are required; `from < to`, maximum interval 31 days. Other query keys are invalid, including pagination. ADMIN alone and other roles receive 403; absent/expired/revoked sessions receive 401. Each query applies current assigned-lab scope before aggregation; an unassigned lab filter returns empty labs and zero counts.

```ts
{
  from: string;
  to: string;
  laboratories: Array<{ id: string; name: string }>;
  completed: {
    handovers: number;
    receipts: number;
    inspections: number;
    maintenance: number;
    total: number;
  }
}
```

`laboratories` lists all current assigned labs narrowed by `labId`, including labs with no events; it can label inventory/location lab IDs without a privileged laboratory-directory read. The half-open interval `[from,to)` counts physical loan issues (including consumable fulfilment), physical return receipts, terminal inspection decisions (`CLEAR_AVAILABLE`, `ROUTE_MAINTENANCE`) and terminal maintenance decisions (`RESOLVED_AVAILABLE`, `RETIRED`). Each row counts once, irrespective of quantity. Unresolved inspections, in-progress maintenance, identity materialization, reservations, catalogue changes, stock receipts/adjustments and security/session events are excluded. Label this metric **Completed lending operations**; use the four subtotals for precise descriptions. For a local calendar day, the client supplies its actual midnight boundaries with timezone offsets; the server does not assume a university timezone.

## Explicitly unavailable

**Stock alerts:** database migrations 001–045 define no low-stock/reorder threshold column, threshold table or configured alert policy. The supplied directive explicitly identifies prototype thresholds as illustrative. Existing quantity/state balances cannot establish an institutional alert threshold. No alert endpoint, count, boolean or default threshold was invented. Display unavailable rather than zero; needs an authoritative threshold policy and configuration source before implementation.

**TO catalogue create/edit/deactivate:** preserved existing ADMIN-only `POST items/categories/locations` and `PATCH items/categories/locations` contracts (`031_catalogue_evolution.sql`, lines 91–95; `docs/workflow/catalogue-api-contract.md`). Phase 1 `06-permissions.md` defines assigned-lab physical operations and administrative policies, but no TO catalogue-authoring capability. `inv_items` and `inv_categories` are shared definitions without an owning laboratory; changing one can affect other labs. Lab assignment therefore cannot safely authorize shared item editing or deactivation. The directive says role-authorized/in permitted scope, and does not resolve ownership/capability policy. TO-only users retain scoped inventory reads and physical operations; catalogue mutations return 403. ADMIN rights and version/deactivation safeguards are unchanged. A scoped authoring capability/ownership decision is required before expanding this contract.

## Verification evidence

Applied 046 and repeated the digest-protected migration runner on the existing loopback synthetic database. Final sequential run: 8/8 passed, zero skipped (`officer-operations`, `physical-lifecycle`, `catalogue`, `lending-lifecycle`, `lending-authority`, `application-lending`, `lending-sources`, `workflow-basic`). Rollback fixtures cover remarks validation/replay/changed-command conflicts, immutable history, names and revoked scope, role-denied summary access, explicit finite periods, lab filtering, revocation and direct runtime table denial. Physical lifecycle tests verify completed handover counts increase once across replay/materialization and retain stock conservation. Typecheck and changed-backend-file lint passed. Full-project lint reported a concurrent frontend `react-hooks/refs` error at `src/components/ui/final-confirmation.tsx:23`; this backend task did not edit that file. HTTP/browser integration and independent QA/security review remain unverified.
