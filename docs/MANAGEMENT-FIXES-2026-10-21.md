# Management fixes — 21 October 2026

Implemented the corrections identified in the Management logic review. Existing financial records are not rewritten or automatically reconciled.

## Financial integrity

- Shareholder edits and their ownership history commit together.
- Capital transactions and wallet postings commit together.
- Dividend declarations and all shareholder allocations commit together.
- Dividend payments, paid totals, declaration status, and wallet postings commit together.
- A tenant row lock serializes competing Management financial operations; wallet rows are also locked before their balances are read and changed.
- Form submissions carry durable retry keys. Replaying the same successful request returns its receipt without another transaction; reusing the key with different data returns a conflict. Receipts contain only record IDs and commit alongside the financial operation.
- Monetary input is validated on the server, and dividend allocation uses integer cents with a deterministic largest-remainder rule.

## Ownership and dividends

- Ownership must be between 0% and 100%. The active tenant total may not exceed 100%, including edits, reactivation, concurrent creation, and callers with restricted record visibility.
- Inactive shareholders do not consume the active ownership limit.
- Active ownership must equal 100% before a new dividend declaration.
- Dividends must be positive and may not exceed the stated profit.
- Cancelled, draft, and fully paid declarations cannot accept payments.
- Payouts cannot exceed the remaining allocation. Existing inconsistent payment history or allocation totals block further payment with a reconciliation message.
- Small allocations now sum to the exact declared amount, including an AED 1 split across 33.33%, 33.33%, and 33.34% ownership.

## Permissions, references, and interface

- Shareholder and selected wallet references must belong to the current workspace and satisfy the relevant permissions.
- List responses carry explicit record-access information; denied details, identity numbers, bank details, and nested financial details are redacted. Write responses contain IDs only.
- Related list joins are tenant constrained.
- Add/edit/pay/Setup controls reflect their actual permissions.
- A successful save is no longer reported as failed because a later refresh failed. A warning tells the user to refresh rather than submit again.
- Management totals distinguish loading and errors from zero. Invalid capital setup is rejected rather than silently converted to zero, and configuration read failures return an error.
- Transaction dates and financial-year defaults use the UAE calendar day.
- Overview labels clarify that company shortfall/excess are net figures. Shareholder obligations remain individual calculations.

## Rules retained or made explicit

- Advance continues to count as capital.
- Wallet selection remains optional for off-system transactions. An explicitly selected invalid wallet is rejected.
- Adjustment creation is disabled because it had no defined financial effect. Existing Adjustment records trigger a reconciliation error rather than being silently ignored in totals.
- Refunds retain the existing policy; this change does not invent a new shareholder loan or overdraft policy.
- Historical discrepancies require a separate reviewed reconciliation. The tests do not establish whether live history contains such discrepancies.

## Verification

- `backend/test/management.test.js`: 28 scenarios passed (29 test entries including the parent test), covering the original failures, competing requests, private fields, exact allocation, request replay, injected ledger/allocation failures, and valid partial/full payouts.
- `frontend/test/management.test.cjs`: 4 checks passed for save/refresh separation, stable retry keys, save rejection, and UAE midnight/year boundaries.
- Existing backend regression suite: 44 tests passed.
- Nuxt production build completed successfully.

Database tests use only `docclear_regression_test`, guarded by the database name, local host, and explicit reset environment variable. Run the two backend suites sequentially because each resets that disposable database.

The additive `management_requests` table is registered with the normal startup schema synchronization; a migration is included for migration-driven environments. Its receipts are retained on rollback so old financial requests cannot become payable again.
