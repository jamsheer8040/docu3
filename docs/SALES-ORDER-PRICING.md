# Sales order discount and VAT

Sales orders support an AED discount and a VAT percentage. The form, detail view,
legacy Pro Forma download and document-template Sales Order / Pro Forma exports
use the same rule: subtotal = sum(quantity × unit price), taxable amount =
subtotal − discount, VAT = taxable amount × rate, total = taxable amount + VAT.
Monetary values round to whole fils; VAT rounds half up after discount.

The backend validates prices, whole-number quantities, discount precision and
VAT rates from 0–100. Discount cannot exceed subtotal. Submitted computed totals
are ignored. Updates calculate against the final persisted service lines,
including preserved confirmed or pushed services, inside the transaction.
Failed validation rolls the update back.

`discount` defaults to zero. `tax_rate` is nullable on historical orders, which
retain the previous active-tax fallback until edited. New orders default to
their company's active rate and save the chosen rate. Editing an order captures
that rate too, so later changes to the company tax master cannot alter its PDF.
Existing orders are not backfilled or repriced during deployment. Totals are
derived from saved prices, discount and rate rather than trusting client totals.

Migration `20261027010000-sales-order-pricing.js` and the repeatable startup
helper add the two fields without dropping or renaming data. All business
queries retain tenant scope and existing Sales Order permissions. These changes
do not create invoices, expenses, service execution or wallet movements.

## Bank details and terms

Sales orders also save bank name, account holder, account number, IBAN, SWIFT/BIC,
branch, payment terms and terms and conditions. New forms prefill the existing
tenant quotation defaults when available; edits are specific to that order.
The API snapshots defaults for new orders and preserves omitted fields on
updates. Later changes to workspace defaults do not change saved documents.
Bank fields allow 150 characters each; each terms field allows 5,000 characters.

The order detail view and both PDF paths print saved sections. Long terms flow
onto additional pages. The legacy Pro Forma header directs the reader to saved
payment terms instead of asserting “Due on receipt”. Historical nullable fields
are not backfilled; the legacy PDF retains its previous voucher-footer fallback
when the order has no saved bank/terms fields. Explicitly blank saved fields
suppress that fallback.

Migration `20261027020000-sales-order-document.js` and its repeatable startup
helper add nullable JSON/text fields without changing historical financial data.
