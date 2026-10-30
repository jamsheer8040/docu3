# Quotation conversion

Sales Orders also offers Create Sales Order → From quotation. The searchable
picker shows only Draft, Sent and Accepted quotations that the user can view
and edit and that have no linked sales order. Selecting one loads the same
server-generated seed and editable form as conversion from quotation detail.
Canceling the picker or form creates nothing. Manual creation remains available.
The server rechecks permissions, source changes and duplicate conversion on save.

The quotation detail view offers Convert to Sales Order for Draft, Sent and
Accepted quotations, subject to quotation detail/edit and Sales Order create
permissions. Declined/Expired quotations must be reopened first. Opening or
closing the editable form does not save anything or change quotation status.

The form copies the saved service lines, including expanded bundle lines and
custom services, quantities, costs, service charges, quoted rates, processing
time, recipient, salesperson, reference, branch, notes, discount, VAT, bank
details, terms and PDF preferences. It uses the saved offer rather than current
master prices. Expected calendar dates are optional and separate from processing
time text. The user can save without selecting dates or reselecting services.

Saving occurs in one transaction under the tenant lock. The order is Unconfirmed
and linked to its source quotation; only a successful save marks the quotation
SO. A version hash rejects stale source data. A unique tenant/source index and
repeat-save handling prevent multiple orders for the same quotation. Converted
quotations are locked; revisions use Duplicate. The resulting order remains
editable under its existing permission rules, with order edits and confirmation
serialized against the tenant lock.

For a lead/prospect, the draft retains a recipient snapshot without creating a
customer. The first service item confirmation reuses the mapped customer, or creates a customer with
the order's salesperson and links the lead while retaining lead history.
Customer creation and lead linking require their respective permissions. A
matching existing phone/email requires choosing that existing customer rather
than silently creating a duplicate. The draft can be edited to complete missing
customer contact information before confirmation.

Both manual and quotation-based orders expose Confirm and Cancel on each pending
service row immediately. There is no order-level confirmation prerequisite.
Confirming is repeat-safe and does not start services, create invoices or move
money. Only the selected item is confirmed; siblings remain unchanged. A service
must be individually confirmed before it can be pushed to execution. Cancelling
all items marks the order Cancelled without creating a customer. Converted orders
cannot be deleted; their source link remains audit history. The header displays
confirmation progress calculated from the actual items, including partial progress.

The repeatable startup helper and migration 20261028010000 add nullable source
and recipient fields, optional expected dates, SO quotation status and an order
confirmation state. Existing orders default to Confirmed. Relaxing the customer
column permits converted drafts only; ordinary order creation still requires an
accessible customer. Existing transaction amounts are not backfilled or changed.

Draft order PDFs render the copied recipient snapshot before customer creation.
Saved notes, bank/terms, prices, discount, VAT, template and footer carry forward;
internal costs, service charges and internal remarks remain outside customer PDF
columns. CustomerPortal sessions cannot access customerless draft orders.
