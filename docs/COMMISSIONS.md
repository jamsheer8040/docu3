# Commission module

## Workspace master switch

**Settings → General → Commission enabled** controls the whole module and requires a confirmation popup for either direction. Existing workspaces default to ON. The switch is tenant scoped and requires Settings write access; customer portal users cannot change it. Generic settings saves cannot bypass its confirmation endpoint.

Turning OFF is blocked if an active commission is pending approval or if an approved entry has any unpaid balance, including partially paid commissions. Rejected and voided historical entries are closed and do not block OFF. Approved entries must be fully settled. The setting and financial operations share a workspace lock so an invoice cannot create a pending commission concurrently with a successful OFF operation.

While OFF, the main menu and role-permission row are hidden, direct commission APIs are blocked, invoice commission fields disappear, no new invoice commission is calculated, and profit-report columns and CSV commission values are omitted. Commission-linked expense rows are hidden from the ordinary expense list and detail view; ordinary expenses remain. Historical commission expenses stay included in accounting aggregates, expense totals, dashboards and profit reports. Historical records, criteria, payments and actual wallet balances are preserved. Historical invoice net profit and report totals remain unchanged by ON/OFF; hiding a column does not remove its deduction. Switching does not refund past payouts or post wallet transactions.

Turning ON restores existing history and features under the saved permissions. Eligibility applies only to invoices created after the latest activation. Earlier invoices, including drafts issued later and invoices made while OFF, cannot gain commission through recalculation or resubmission. Existing commissions, expenses and payouts stay unchanged. Changes propagate immediately in the current session and on navigation/refresh in other sessions; server enforcement applies on every request.

The confirmed master endpoint is `PUT /api/v1/config/commission`, with boolean `enabled`, `expected_enabled` and `confirmed: true`.

## Simple criteria

Open **Commissions → Criteria settings**. Enable commission and enter only:

- Minimum service charge after invoice discount, in AED.
- Commission percentage of that actual service charge.

Actual service charge = max(0, sum of invoice line service charge × quantity − invoice discount). Costs and VAT do not increase this basis. Eligibility uses greater than or equal to the threshold; a positive actual charge is required. Commission is rounded once to cents.

Example: service charges AED 100, discount AED 30, threshold AED 70, commission 10%. The invoice qualifies and calculated commission is AED 7. Raising the service charge and then discounting it does not inflate commission.

The old employee, role, employment-day, service, invoice-total, priority and date formula criteria are removed from the working configuration. Old formulas remain stored solely for history. Saved criteria affect subsequent calculations; existing simple drafts and approvals keep their snapshots until a monetary invoice change or explicit rejected-entry resubmission.

## One invoice and one salesperson

Staff detail pages include a **Commission** tab with that employee's eligible invoices and commission, pending approval, approved amount, paid amount, outstanding balance, payable-now amount and rejected commission. It defaults to all history, supports invoice-date filters and expands each invoice's payment/reversal history. The tab uses the same statement API and accounting totals as Commissions, with a fixed staff filter and no staff selector. Own-only permission cannot open another employee's commission tab; all-view permission allows the selected employee's history. The tab is read-only and hidden when the workspace commission master is OFF.

Only the customer's assigned active internal salesperson receives commission. Customer creation defaults this assignment to the creator and allows another salesperson to be chosen. Reassigning the customer does not transfer an existing saved commission to someone else. Foreign, inactive, portal or missing owners cannot qualify.

## Lifecycle and accounting

1. An eligible issued invoice automatically saves a **Pending approval** commission. Draft invoices show a calculated preview; issuance saves the commission transaction. Invoice details show eligibility, actual charge after discount, percentage, calculated amount, status and recorded/projected profit. Manual formula selection and arbitrary amount overrides are removed.
2. An admin approves the transaction from Commissions. Approval creates one **Unpaid commission expense**, stamps the reviewer and review time, and adds the full approved amount to the staff balance. It does not deduct any wallet.
3. Approved commission can be paid only when the customer has paid the entire invoice amount. A Paid label without sufficient paid_amount is insufficient. Partial commission payouts are supported.
4. Payout deducts the chosen wallet and settles the existing approved expense. It never creates a second expense. Staff statement balance equals approved commission minus unreversed payments. Payable-now is further limited to fully paid invoices.
5. Rejection requires a reason. Pending commission has no expense; rejection of an approved but unpaid commission zeros its expense. Rejected commission is excluded from invoice profit and expenses, and has no payable balance.
6. Recorded payouts must be reversed before changing approval. A payment reversal restores its wallet and approved outstanding balance, while leaving the approval expense recognised. Admin can subsequently reject the unpaid approval to remove that expense.
7. Rejected entries can be recalculated and resubmitted from invoice details. The original rejection is retained as a voided historical revision. The replacement needs approval again.

Recorded invoice net profit = invoice total after discount − VAT − cost − other linked expenses (currently zero) − approved commission. Pending drafts show a separate projection; rejected commission is excluded. Profit reports deduct invoice discounts and include the approval expense once, regardless of payout. Their invoice rows show commission only when approved. The approval expense is dated when approved; invoice rows remain associated with invoice date.

Monetary invoice changes void the unpaid prior calculation, remove any prior approval expense, and create a fresh draft requiring review. Metadata-only edits preserve a valid snapshot. Changing/cancelling a paid commission invoice remains blocked until commission payments are reversed.

## Statements

The page shows eligible invoice count, pending commission, approved commission, commission paid, balance to be paid and rejected commission. Administrators see staff summaries and review actions; staff with Own access see only their own entries. Invoice-date and employee filters apply to statement totals. Approved balances waiting for customer payment remain visible but cannot yet be paid.

## Permissions and safety

Admin/Developer can approve or reject. Existing commission permissions continue to govern Own/All statements, criteria management and payout/reversal. Payout also requires edit access to the chosen wallet. Invoice details require invoice detail permission as well as commission access. Customer portal accounts are excluded.

Every query and mutation is tenant scoped. Invoice and entry locks serialize approval, recalculation and payout. Repeated approval cannot create duplicate expenses. Payment request keys prevent repeat wallet postings; balance validation prevents overpayment. Failure rolls back the entire approval or payout transaction. Approved expenses cannot be edited or paid through ordinary Expense actions; use Commissions.

## Existing records and deployment

The upgrade adds approval status, review fields and approval-expense link columns to commission_entries. Startup applies the additive repeatable schema helper; migration 20261026000000-commission-approval.js is also supplied. No business records or payment history are deleted.

Set the new minimum and percentage before using **Recalculate existing invoices**. This creates missing eligible drafts and replaces unpaid legacy formula calculations only for invoices created after the latest activation, over a selected range (up to one year and 500 invoices). It never auto-approves or pays. Existing simple decisions are preserved. Paid historical calculations and their original payment expenses are retained; they are not automatically converted into new approvals. Invoices preceding activation are always skipped, including legacy calculations. A tenant-scoped invoice-ID cutoff handles same-second creation safely. First setup and existing-workspace upgrade establish the initial cutoff; only a real OFF-to-ON transition advances it. Repeated ON requests, criteria edits and restarts do not advance it.

The removed formula-write API fails clearly instead of silently accepting complex rules. New settings endpoints are GET/PUT /api/v1/commissions/criteria. Review uses POST /api/v1/commissions/entries/:id/review with decision Approved or Rejected; rejection also requires reason. Existing statement, payment and reversal endpoints remain.

## Validation

The commission suite covers discount threshold equality, automatic invoice calculations, owner eligibility, tenant/permission isolation, approval and rejection accounting, repeat approvals, partial/full-payment gating, duplicate payout, payout and approval rollback, reversals, invoice changes, report rows, schema upgrades and legacy recalculation. The broader regression suite checks existing operational workflows. Test schema resets are restricted to docclear_regression_test.
