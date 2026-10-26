# Document templates

## Agreed product direction

Replace the free-form Voucher Design editor with Document Templates. Each document
type has four code-defined layouts: Classic, Modern, Compact, and Minimal. Layout
structure, required fields, totals, and signature placement are maintained in code.
Users can select a default independently for each document type, preview layouts,
and override the template when issuing a document. Company branding and footer
notes remain editable.

Document types:

- Quotation (new business workflow required).
- Pro forma invoice.
- Invoice.
- Tax invoice (its required fields remain separate from an ordinary invoice).
- Sales order.
- Payment receipt.
- Expense/payment voucher.

## Current implementation findings

- `backend/utils/pdfGenerator.js` generates Invoice PDFs from a fixed PDFKit layout.
- Pro forma PDF generation in the same file reads the Sales Order voucher default,
  falling back to Invoice. It has no independent Pro forma default today.
- `VoucherDesign` stores editable designs per tenant. Its document-type enum does
  not distinguish Pro forma or Tax Invoice.
- Settings currently mounts `VoucherDesignSettings.vue` under Voucher Design.
- Invoice and Sales Order detail views already expose PDF download actions.

## Implementation order

1. Introduce a versioned, code-defined template catalog and common document renderer.
   Give each supported document type a stable key independent of its display name.
   Validate document-type/template combinations on the backend.
2. Add tenant-scoped defaults and editable footer settings. Store selection and
   renderer version on issued documents so later default changes do not restyle
   historical documents. Preserve existing voucher records and legacy PDF behavior
   until a document explicitly adopts the new templates.
3. Connect Invoice, Tax Invoice, and Pro forma downloads to the shared renderer.
   Give Pro forma an independent default. Include a template override in the issue
   or export flow and keep existing record permissions on downloads.
4. Add Sales Order, Receipt, and Expense Voucher output adapters and download flows.
   Reuse their existing authoritative business totals rather than recalculating
   accounting data in the layout layer.
5. Replace the settings editor with Document Templates: document-type selection,
   four previews, default selection, footer editing, and a sample PDF generated
   by the same renderer as actual downloads. Remove free-form editing from the UI
   only once the replacement outputs work.
6. Build Quotation separately: tenant-scoped numbering, customer and line items,
   validity dates, draft/sent/accepted/rejected/expired states, and explicit
   conversion to Sales Order or Invoice with duplicate-conversion protection.
   Then enable the Quotation template family.

## Verification requirements

- Defaults and overrides cannot read or modify another tenant's configuration.
- Old records and existing voucher defaults retain their rendering behavior.
- Preview and exported PDF use the same template implementation.
- All four layouts handle long descriptions, long company/customer names,
  multi-page tables, discounts, tax, empty optional fields, and signature/footer
  placement without overlap or truncated totals.
- Invoice and Tax Invoice preserve their correct document titles and business data.
- New quotations convert through the existing business creation rules; exporting
  or previewing a quotation does not create transactions.

## Implemented first release

Settings now exposes Document Templates with four fixed layouts for Invoice,
Tax Invoice, Pro Forma, Sales Order, Payment Receipt and Expense Voucher. Each
type has a workspace default; exports allow a one-off layout override. New
documents snapshot their layout, renderer version and footer in tenant-scoped
DocumentTemplateSnapshot rows in the creation transaction when one is supplied. Company
details/logo continue to use current workspace branding. Existing documents can
still use their original PDF endpoints, and voucher records are preserved.

Receipt downloads are available on invoice income entries in the Wallet ledger;
they use the actual payment transaction amount. Invoice and Sales Order details
and Expense editing expose template PDF menus. Previews use the same PDF renderer
and are displayed with PDF.js to support browsers without a native PDF viewer.

Quotation creation/conversion remains a separate, unimplemented workflow and is
clearly marked Coming soon. Layout snapshots are not immutable archives of the
entire document: branding and business data remain live.

Validation: PDF pagination/validation unit tests, backend integration tests for
authentication, permissions, tenant isolation and saved defaults, production
frontend build, and browser verification.
