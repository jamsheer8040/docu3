# Quotations

Open Quotations from the main menu. Internal users require the Quotations module
permissions configured in Settings → Roles. The usual independent list, detail,
create, edit and delete scopes apply; assignment is also available through
Record assignments. Customer portal users cannot access the module or its PDFs.

The Sales Order-style form supports an existing lead, an existing customer or a
manually entered prospect. Selecting a lead never creates a customer or changes
the lead's lifecycle or follow-up schedule. Recipient details are saved with the
quotation. Service catalog entries and recipients are restricted to the workspace.

Fields include date, validity, contact information, reference, branch, sales
executive, service lines, quantities, cost, service charge, quoted rate, processing
time, discount and VAT. Totals are recomputed on the server. VAT requires the
workspace's existing VAT-enabled and tax-registration settings.

Each quotation stores bank name, account holder, account number, IBAN, SWIFT/BIC,
bank branch, payment terms, terms and conditions, public notes and internal remarks.
Internal remarks and internal cost/service-charge columns are not printed.
Settings managers can save bank details and terms as workspace defaults.

New quotations start as Draft. Mark as Sent records a manual sharing event; it
does not email or message the recipient. A linked lead then shows Quote Sent next
to its status. Sent quotations may be marked Accepted, Declined or, after their
validity date, Expired. Accepted documents are locked. Duplicate them to prepare
a new offer. Saving edits to other quotations resets them to Draft and clears the
sent marker so the revised document must be marked sent again. Only drafts can
be deleted.

PDFs use Classic, Modern, Compact or Minimal layouts and include payment/bank
details and terms. Layout defaults are in Settings → Document Templates. The
document remembers its layout and footer; the download selector remembers a
user's choice separately by workspace and browser.

Quotations do not post revenue, expenses, payments or invoices, create service
orders, or automatically create customers. No existing business records or role
permissions are changed when the module is installed. The additive migration
creates the quotations table; local startup also creates it idempotently.
