# Management logic review — 21 October 2026

## Outcome and scope

Confirmed defects affect financial consistency, ownership validation, permissions, tenant references, dividend calculations, and failed-save handling. This is a review, not an implemented correction. No live shareholder, dividend, or wallet records were changed.

Reviewed Management Overview, Shareholders, Capital Transactions, Dividends, Setup, their API routes/controllers/models, and the frontend store. Ran 23 backend reproduction scenarios against the disposable `docclear_regression_test` database, plus isolated frontend store/date checks. These are targeted reproductions, not a claim of exhaustive coverage of every possible input or browser interaction.

Evidence is retained in:

- `D:/project v2/.local/management-review.cjs`
- `D:/project v2/.local/management-review-results.json`
- `D:/project v2/.local/management-frontend-review.cjs`
- `D:/project v2/.local/management-frontend-review-results.json`

The backend harness resets the disposable database and must never be pointed at live data.

## Screenshot calculation

The displayed shareholder arithmetic is correct for company capital AED 60,000:

| Shareholder | Ownership | Required | Contributed | Pending | Excess |
|---|---:|---:|---:|---:|---:|
| manu | 50% | 30,000 | 1,000 | 29,000 | 0 |
| sabu | 30% | 18,000 | 50,000 | 0 | 32,000 |
| sanu | 20% | 12,000 | 20,000 | 0 | 8,000 |

Individual pending capital totals AED 29,000; individual excess totals AED 40,000. Company contributions total AED 71,000, giving a net company excess of AED 11,000. Both measures can be useful, but Overview should distinguish company net funding from individual obligations.

## Confirmed findings, in correction order

### 1. Critical: failed financial operations leave committed records

Location: `backend/controllers/management.controller.js:149`, `:178`, `:251`, `:316`.

Related writes are separate database operations without an encompassing transaction. A later failure does not roll back earlier writes.

Reproductions:

- Wallet permission rejection returned HTTP 500 after recording an AED 100 dividend payment, updating paid amount to 100, and marking the declaration **Fully Paid**. No wallet posting existed.
- A rejected wallet posting left a capital transaction saved.
- A negative capital contribution returned HTTP 500 but left an AED -100 capital record. The wallet remained unchanged.
- A negative dividend payout returned HTTP 500 but left a payment row and paid amount of -10. The wallet remained unchanged.
- A failed shareholder edit left an ownership-history entry for a change that did not take effect.

Correction: validate all inputs, references, and permissions before writing; commit each business operation and its ledger effects in one transaction. Ownership history must commit with its shareholder edit. Dividend declaration and all distributions must commit together.

### 2. Critical: concurrent requests can overpay and corrupt wallet balances

Location: `backend/controllers/management.controller.js:188`, `:202`, `:311`, `:321`, `:338`.

Reproductions:

- Two simultaneous AED 75 payouts against an AED 100 allocation both returned HTTP 201. Payment rows totaled 150, while cached paid amount showed only 75. A wallet starting at 1,000 showed 925.
- Concurrent contributions of AED 100 and 200 produced ledger entries totaling 300, but a wallet starting at 1,000 ended at 1,100 in the latest run instead of 1,300. Which update survives depends on timing.

Correction: lock the relevant distribution/declaration and wallet rows within the transaction, recheck remaining amounts after acquiring locks, and update balances atomically. Add replay protection for financial submissions and concurrency regression tests.

### 3. High: ownership limits are inconsistent and bypassable

Location: `backend/controllers/management.controller.js:116`, `:138`.

Reproductions:

- Editing a 50% owner to 90% alongside another 50% owner succeeded: total 140%.
- A -10% owner was accepted.
- Two concurrent 60% creations both succeeded: total 120%.
- A user restricted to their own records could create another 40% while an existing hidden owner held 100%: total 140%.
- Creating an inactive 20% shareholder was rejected when active ownership was already 100%, although the cap query otherwise counts active holders.

Correction: use one server-side ownership validator for creation, editing, and status changes. Validate finite values within 0–100 and calculate the active tenant total independently of the caller's display scope. Serialize competing ownership changes using a stable tenant-level lock.

### 4. High: tenant references and detail permissions are not consistently enforced

Location: `backend/controllers/management.controller.js:77`, `:138`, `:173`.

Reproductions:

- A capital transaction accepted a shareholder ID belonging to another tenant.
- A capital transaction supplied with a foreign wallet ID returned success and saved its capital row, but silently omitted the wallet posting.
- A role allowed shareholder listing but denied detail access received actual identity numbers, bank details, and capital transaction details in the list response.
- An edit response also exposed identity and bank details to a role denied detail access.

Correction: resolve referenced entities within the current tenant and authorized operation scope; reject an explicitly supplied invalid wallet rather than silently skipping it. Apply an explicit response-field contract to list and mutation responses, including nested associations. Keep tenant-wide invariant calculations separate from what the caller is allowed to read.

### 5. High: dividend validation and completion status are incomplete

Location: `backend/controllers/management.controller.js:245`, `:298`.

Reproductions:

- Declaring AED 100 against stated profit of AED 10 succeeded, bypassing the frontend limit.
- A cancelled declaration accepted a payout and changed to Partially Paid.
- A declaration with no shareholders was accepted with zero distributions.
- At 90% ownership, an AED 100 declaration allocated 90. Paying 90 marked it Fully Paid, leaving 10 unallocated.
- With ownership 33.33%, 33.33%, 33.34%, an AED 1 declaration allocated only AED 0.99.

Correction: enforce positive, finite monetary amounts and the agreed profit limit on the server; reject payouts for ineligible declaration states. Define what incomplete ownership means before declaration. Allocate in currency minor units with a deterministic remainder rule, and reconcile declared, allocated, and paid totals before marking Fully Paid. Preserve the existing ownership snapshot on historical distributions.

### 6. High: Adjustment is accepted but has no financial effect

Location: `backend/controllers/management.controller.js:27`, `:77`, `:173`; `frontend/components/management/ManagementCapital.vue`.

An AED 100 Adjustment was accepted, but Overview counted zero received and no wallet entry was created. Shareholder totals likewise handle Contribution, Advance, and Refund, not Adjustment.

Correction: define signed adjustment semantics, affected balances, and audit requirements, then implement them consistently. Until then, the option should not imply a functioning financial adjustment.

### 7. Medium: setup and load failures can look like valid zero values

Location: `backend/controllers/management.controller.js:17`; `frontend/components/management/ManagementDashboard.vue`; `ManagementSetup.vue`.

Saving `proposed_company_capital: "not-a-number"` returned success. Overview then displayed proposed capital as zero because `parseFloat(value) || 0` masks invalid data.

Static inspection also found no useful dashboard loading/error presentation: missing values format as zero and initial fetch rejection is not surfaced as a financial-data error.

Correction: validate capital configuration at the API boundary; distinguish unconfigured, invalid, loading, failed, and actual zero values. Display a clear retryable error rather than financially meaningful zeros after a failed load.

### 8. Medium: a successful save can be reported as failed, encouraging duplicates

Location: `frontend/stores/management.js:45`, `:59`, `:88`, `:118`, `:132`.

Mutation methods save, then await a list refresh inside the same error path. The isolated store reproduction made POST succeed and the subsequent GET fail. Both attempts were reported as failed although both POSTs succeeded.

Correction: distinguish save failure from refresh failure. Close/confirm a successfully saved operation, offer a refresh retry, and protect financial creates against duplicate submissions with server-side replay protection.

### 9. Medium: action controls do not reflect permissions

Location: `frontend/pages/management/index.vue`; Management component templates.

Static inspection shows Add Shareholder, Record Transaction, Declare Dividend, Pay, and Setup controls without corresponding action permission checks. API checks still reject some unauthorized operations, so visible buttons alone are not proof of a write bypass. However, they create misleading affordances; the partial-save defect above makes late permission failures particularly serious. Setup uses configuration permissions, which may differ from Management permissions.

Correction: gate UI actions and Setup consistently with their actual server permissions, while retaining server enforcement and checking all required permissions before writes.

### 10. Medium: default transaction dates use UTC rather than the UAE day

Location: `frontend/components/management/ManagementCapital.vue`; `ManagementDividends.vue`.

`toISOString().substr(0, 10)` produces the previous date during the first four hours of a UAE day. At UAE 01:00 on 21 October, the reproduced default was 20 October.

Correction: derive date-only values from the configured business timezone, consistently across capital and dividend forms.

## Business rules to settle before broad corrections

1. Should Advance count as equity capital, as it currently does, or remain a separate shareholder loan balance?
2. Should the Overview show both individual pending/excess and company net funding? They answer different questions.
3. Are wallet-free transactions permitted for off-system payments? Regardless of that answer, an explicitly selected invalid wallet must fail without partial writes.
4. Must active ownership equal 100% before dividend declaration, or should any unallocated amount remain explicitly retained?
5. What do positive/negative adjustments mean, and may a refund exceed the shareholder's contributed balance?

## Recommended implementation sequence

First fix atomic writes, tenant/reference checks, strict server validation, and concurrency controls together. Next fix ownership and dividend invariants, allocation rounding, and status transitions. Then correct response permissions, save/refresh handling, loading states, dates, and action visibility. Turn the reproductions into persistent regression tests as each issue is corrected.

Any reconciliation of existing live capital, wallet, or dividend history should be a separate reviewed task. This review did not establish whether historical live records were affected by these defects.
