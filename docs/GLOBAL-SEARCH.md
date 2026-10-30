# Global record search

The dashboard search finds customers and their related records together. It searches customer names, email and phone, lead contacts, invoice/quotation/order numbers, quotation recipient details, service numbers and names, and document numbers/types. It requires at least two characters.

The dropdown shows up to three matches per category. Pressing Enter opens `/search?q=...`, with independent pagination of 20 records per category. Clicking a result opens the exact customer/lead profile, transaction detail, or selected service in list view, even when it is outside the first table page. The existing permission-filtered page-name search remains available as a separate Pages group. Unconfirmed sales orders can also be found by their saved recipient name, email and phone before a customer is linked.

`GET /api/v1/search?q=...&limit=3&group=invoices&page=1` is authenticated and read-only. `group` is optional. Maximum query length is 100 characters and maximum page size is 20. Wildcards are treated as literal text. No schema changes or backfills are required.

Every query explicitly restricts tenant ID from the session. Results require both list and detail access for the record, preserving ownership scopes. Matching related records by customer contact details requires access to that customer. Portal users are restricted to their linked customers, and lead/quotation groups are unavailable to them. Responses use `Cache-Control: no-store`; the frontend debounces input, cancels old requests, and discards results after an identity change.

This is search across the seven categories above, not a full-text search of uploaded files, notes, staff salaries, wallet entries or arbitrary database columns. No financial data is modified.
