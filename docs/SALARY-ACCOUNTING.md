# Salary booking and expense accounting

New payroll bookings record salary expense once. Booking does not move money; payments settle the existing liability.

- Each tenant can book one payroll per month. A staff member cannot be included twice in that payroll. An unpaid month may be unbooked and booked again after correcting it.
- A new payroll has one linked Expense for its total net salary. `SalaryPayroll.expense_id` and `Expense.salary_payroll_id` retain the relationship; a unique tenant/payroll index prevents duplicate expense postings.
- The expense is recognized on the selected booking date, which is the expense row's accounting timestamp under the application's existing report convention. The payroll's own creation timestamp retains when it was actually entered.
- Salary can be paid in multiple instalments or by batch payment, up to the employee's remaining balance. Each payment retains its own SalaryPayment and wallet transaction. The linked expense amount stays fixed; only its paid amount, settlement status and most recent account/date change.
- Profit reports and dashboard profit totals include the salary expense once. Payments do not deduct profit a second time.
- The Expenses tab lists operational expenses and one read-only salary row per staff member, with All / Operational / Salary filters. Staff rows display month, staff name, individual net salary, paid and balance; View Payroll opens that month in Salary. They have distinct `salary-item-<id>` display IDs and retain `expense_id` and `salary_item_id` as source references. The monthly Expense is replaced by its staff breakdown in this list, never shown or counted alongside it. No duplicate expense is created. Search, status filters, totals and pagination operate on individual staff rows. Unbooked zero-amount reversal records remain protected history and are excluded from active salary listings.
- The operational subtotal still excludes linked salary expenses. The Salary subtotal already includes them, so Combined does not double count them. Ordinary manually entered expenses are unchanged.
- The list API accepts `expense_kind=all|operational|salary`; omitting it retains the original operational-only behavior for existing clients. Salary expense breakdowns require company Internal Staff list/detail access to all staff, plus existing Expenses visibility. Scoped Staff users do not receive company-wide salary totals through Expenses. Tenant/role and payroll ownership checks also apply to list totals and pagination. Historical payroll without an explicit expense link is not automatically posted or projected.
- Salary expenses cannot be changed, paid or deleted through ordinary Expense actions. All settlement uses Salary payroll.
- Unbooking is allowed only for payroll with no payment history. The linked expense becomes a protected zero-amount reversal record with its original amount in the note; the payroll and its items are removed. Rebooking creates a new payroll and a new linked expense. Reversing all payments does not make a payroll eligible for deletion.
- Booking, linked-expense posting, instalments, batch settlement and unbooking are atomic within their respective salary transaction. A failed expense posting/settlement rolls back payroll changes, payments and wallet changes together.

## Existing payroll

Existing payroll has a null expense link and is not automatically reposted. It may already have been entered manually as an expense. Its existing payment workflow continues, but no new historical expense is inferred or added. The Salary tab displays a reconciliation notice for these records.

Before making historical adjustments, reconcile the booked payroll, SalaryPayment records, wallet transactions and any manual salary Expense entries. Link or post approved adjustments only through an explicit reconciliation process; never blindly regenerate expenses or delete past payroll.

## Deployment

`salaryAccountingSchema` and migration `20261026010000-salary-accounting.js` add nullable links and the unique expense index. Startup applies the repeatable additive helper. No historical financial records are backfilled, deleted or revalued.

## Scope

Implemented review items: salary expense integration, payment retry protection, Staff/HR access and employee eligibility, booking validation, consistent calculation rounding, salary-basis audit fields, reliable loading states, page simplification and controlled payment reversal.

## Controlled payment reversal

Company internal Admin users can open a staff row's Payment History and choose Reverse payment. The confirmation requires a reason (maximum 2,000 characters). This reverses the full selected instalment; it does not delete it or edit its original amount, wallet or date. Corrected payments use the ordinary Pay action with a fresh payment reference.

`POST /salaries/payments/:id/reverse` accepts `{ reason }`. Under the same tenant financial lock used by payroll payments, the API verifies the original salary item, payroll, employee, wallet and matching salary debit, and checks the active payment totals against the recorded salary/payroll/linked-expense balances. Unverifiable or inconsistent legacy entries require reconciliation; the API does not guess their original accounting.

The operation posts a new incoming wallet ledger entry (`SalaryPaymentReversal`, referencing the original payment ID), credits the exact original wallet and reduces the salary item, payroll and linked salary expense paid amounts. It restores the latest remaining active payment's account/date, or clears them if no payments remain. The booked expense amount and profit remain unchanged: reversal reopens the liability rather than cancelling the earned salary. The original outgoing wallet entry remains intact. Inactive wallets and employees can still receive valid historical corrections.

The payment retains `reversed_at`, `reversed_by_user_id`, `reversal_reason` and `reversal_transaction_id`; history displays the reversal and credit reference. These nullable columns are installed additively by migration `20261026030000-salary-payment-reversals.js` and a repeatable startup helper. No historical records are automatically reversed or backfilled.

Concurrent or repeated reversal of the same payment with the same reason returns the existing result without another credit. A different reason after reversal returns a conflict. Original payment/batch receipt retries also remain safe and explicitly report payments that have since been reversed. All reversal changes commit or roll back together. A lost acknowledgement can be retried safely.

A payroll with any payment history cannot be unbooked, including when all payments were reversed, preserving the audit trail. If a reversal response is uncertain, the frontend clears stale balances and requires payroll/history to be reloaded before another financial action. A confirmed reversal followed by a failed refresh is shown as a saved correction requiring refresh.

## Salary page layout

The Salary tab has one inline booking sheet and one confirmation at its bottom. Its three main totals are Booked salary, Paid and Balance; before booking, the salary and balance are explicitly Estimated and are not described as payable. Estimated totals follow the edited booking sheet rather than the original staff preview. The general expense summary cards remain on the Operational tab.

Each booked row has one Pay button. Payment history and salary breakdown remain in its row menu. The duplicate booking dialog, its fullscreen flow, duplicate confirmation buttons, repeated booking summary bar and duplicate menu Pay action have been removed. Initial payroll and wallet requests belong to the parent Expenses page, avoiding repeated requests when the Salary tab mounts. Read-only HR can view the preview without editing its date, salary, leave or notes.

## Loading and recovery

Loading a month immediately clears the previous payroll, preview, summary, employee selection and payment history. Each month, summary and history request has an independent sequence number and user/permission identity check. Old responses and errors cannot replace a newer selection or dismiss its loader. Closing payment history or switching month invalidates its in-flight request.

Month, summary and payment-history failures have separate messages and retry actions. A failed history load is not presented as an empty payment history. Booking, cancellation and new salary payments require the selected month to have loaded successfully; new payments additionally require a booked payroll. The browser closes stale detail/payment dialogs when payroll refreshes. Pending transfers retain their original request reference and remain retryable even when the month could not load. Confirming an old transfer refreshes the currently selected month rather than switching the user back to the transfer's month.

A successful booking or cancellation followed by a failed refresh remains a successful save with an explicit refresh warning. The page requires a successful reload before further changes. Late booking/cancellation confirmations do not replace a month selected while the request was in flight. These frontend guards supplement the unchanged backend validation and atomic accounting.

Unbooking requires the exact loaded payroll ID: `DELETE /salaries/month/:month?payroll_id=:id`. The API compares that reference to the visible current payroll while holding the tenant financial lock. A replacement payroll for the same month returns HTTP 409; missing or malformed references return HTTP 400. An old cancellation retry cannot delete a replacement payroll. Clients must refresh to use the updated request contract. Conflicting, missing-record or uncertain cancellation replies clear the browser's old view and require reloading and reviewing the current record before cancelling again. No existing payroll is modified by deploying this protection.

## Calculation and salary audit

New preview and saved calculations use integer cents and round leave deduction once, half up: `monthly basis × unpaid leave days ÷ calendar days in the payroll month`. The daily rate is rounded for display only. Net salary is the basis minus leave deduction and other deductions, plus bonus. Totals sum the individual cent amounts. For example, AED 1,000 with 10 unpaid days in a 31-day month yields a deduction of AED 322.58 and net AED 677.42; multiplying the displayed daily rate of AED 32.26 would incorrectly produce net AED 677.40.

The browser and API deploy independently, with their calculation implementations tested for parity against an independent integer reference across 28–31-day months, fractional leave and money boundaries. The API recalculates the amounts; submitted display totals do not override them.

Payment settlement also uses whole fils for the remaining balance, overpayment checks, accumulated paid totals, batch sums and paid-status decisions. Conversion to AED occurs only for storage/API display. The browser uses the same whole-fils subtraction for full-payment amounts, selected-row totals and displayed balances. For example, AED 60.00 minus AED 59.99 leaves exactly AED 0.01; that final instalment can be settled, retried and reversed without floating-point residue. Payment receipt replay returns the exact current balance. No historical transaction or salary balance is recalculated or backfilled by this fix.

Salary payment dates are real calendar dates in strict `YYYY-MM-DD` format (years 1000–9999). An omitted date defaults to the current calendar date in `Asia/Dubai`, independent of the server timezone. The API captures this once per new individual or batch request and uses it for the payment record, salary item and linked expense settlement. Explicit blank/null values, timestamps, malformed formats and impossible dates are rejected before any financial writes. Valid explicitly selected dates, including backdated dates, remain unchanged. Replaying an existing payment receipt returns the original stored date rather than recalculating it after midnight. The browser initializes individual and batch forms using the UAE business date, validates their date inputs and displays salary dates in UAE time. Historical payment dates are not rewritten.

New salary items preserve `base_salary` (actual monthly basis), `master_base_salary` (staff salary settings at booking), `days_in_month`, `calculation_version` and `override_reason`, alongside the existing basic salary, allowances, leave, deductions and bonus snapshots. A non-empty reason (maximum 2,000 characters) is required when the basis or components differ from current staff settings. A basis differing from the sum of the components is displayed as a monthly basis adjustment in the breakdown. Later changes to staff settings do not change the booked snapshots.

Migration `20261026020000-salary-calculation.js` and the repeatable startup helper add nullable columns only. Historical rows retain null audit fields and their original totals. The breakdown labels their original salary basis as unrecorded, rather than inferring or recomputing it.

## Booking validation

Staff salary settings are validated on user creation and update, before saving any user changes. Basic salary, housing/HR allowance, other allowances and explicit total salary must be non-negative decimal amounts with up to two decimal places, at most AED 99,999,999.99. Null/blank values, partial numeric text, exponent/hex strings, booleans, arrays and out-of-range amounts are rejected with HTTP 400. Omitted fields on creation default to zero; omitted components on a salary update retain their stored values. If no explicit total is submitted, the total is calculated in whole fils. An unrelated profile update leaves stored salary fields and any explicit total override untouched, including legacy values. No staff master values or booked payroll rows are automatically rewritten.

The Settings and Staff profile forms enforce the same amount limits and use exact component totals. Editing salary components updates the displayed and submitted total; unchanged salary settings preserve their existing explicit total. Enter zero explicitly when an allowance does not apply.

New bookings require a real calendar month (`YYYY-MM`, years 1000–9999) and valid booking date (`YYYY-MM-DD`). Omitted booking dates default to the last day of the selected month. Preview, summary filters and cancellation reject invalid months too.

Omitting `items` preserves automatic booking of eligible employees. An explicitly supplied list must contain at least one valid employee row, with no duplicates (including numeric/string versions of the same ID). Employee eligibility and company/Staff visibility checks remain mandatory.

Salary components, salary basis, deductions and bonuses must be finite, non-negative decimal amounts with at most two decimal places, within the storage limit. Supplied calculated fields are validated too; the server calculates the final net amount from the basis, leave deduction, deductions and bonus. It rejects deductions that would make net salary negative instead of silently clamping them to zero. Malformed values, arrays, booleans, null amounts, exponent/hex strings and trailing text are rejected rather than parsed partially.

Unpaid leave must be non-negative, use at most one decimal place (matching the stored field), and not exceed the number of days in the selected month, including leap years. Zero salaries and fractional leave remain supported. Every row is validated before creating any payroll, salary item or linked expense; rejected requests leave financial records and wallet balances unchanged. Historical payroll is not rewritten.

## Payment retry protection

Individual and batch salary payment endpoints require an `Idempotency-Key` request header (8–80 letters, digits, underscores or hyphens). Older clients without one receive a clear refresh-required error before any payment is recorded. The updated Salary page supplies it automatically.

The server serializes transfers with the existing tenant financial lock and stores a receipt in `management_requests` in the same transaction as the salary payment, wallet ledger and linked salary expense settlement. Receipts contain only the operation and payment IDs, scoped to tenant, user and reference. Reusing the same reference and payload confirms the original transfer; changing the payload or switching between single and batch with that reference returns HTTP 409. A failed transaction consumes no reference. New intentional instalments use fresh references.

Replay rechecks current salary-record and wallet access; it never serves a cached privileged response. Individual replay returns the original payment ID and the current cumulative salary balance. Batch replay returns the original batch's count and disbursed total. It makes no new financial entries, including after later instalments or full settlement.

The browser persists an unresolved transfer's reference and frozen details before sending it, under a user/workspace-specific local key. Network failures and uncertain server responses retain this attempt across page reloads. The recovery banner retries that original transfer and blocks a different salary transfer until it is confirmed. A definite initial validation/permission rejection permits correction; an earlier ambiguous result remains protected. The page also blocks duplicate submission while processing.

If payment succeeds but refreshing fails, the UI reports that the payment was saved and requires a payroll refresh before another transfer. This avoids treating a display failure as a failed payment. Historical payments are unchanged; this protection does not identify or remove older duplicate payments automatically.
