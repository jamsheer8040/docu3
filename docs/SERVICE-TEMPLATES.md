# Service templates

Service templates are reusable job checklists shared by Sales Orders and Quotations. For example, Contract Renewal can contain Emirates ID, Visa, Medical and Typing. They are not a separately priced product and do not create service jobs themselves.

## Administration

Open **Settings → Service Templates**. Users with Settings read permission can view the templates. Settings write permission allows creation and editing; Settings delete permission allows deletion. Customer portal accounts cannot access this feature.

Enter a name, optional description, active status and an ordered list of active services with quantities. Move rows up or down to set their order. Each service appears once per template; use quantity for multiples. Names are unique within the workspace. Templates contain 1–100 services.

## Using a template

In a new or editable Sales Order or Quotation, choose **Service template → Add template** under Requested Services. Template use requires create or edit permission for either of these document modules; Settings permission is not required.

All services are appended as individual rows in template order. An untouched initial blank row is replaced. Existing rows, edits and processed Sales Order items remain intact. Selecting a template again intentionally adds another set of rows.

Costs and service charges are fetched from the current service master when adding the template. Customer pricing categories apply where available, including an explicit zero service charge. Staff may edit charges or remove unnecessary rows under the document's existing editing rules. Existing confirmed or processed Sales Order rows remain locked. The template is unchanged by document edits.

If any service is deleted or inactive, the whole addition fails with an explanation, so no required service is silently missed. Update the template or restore the service. Inactive templates are hidden from document pickers. Quotation's existing 100-line limit is checked before any new rows are appended.

Changing or deleting a template does not alter saved documents. Prices are snapshots in those document rows; later service-master edits affect future additions only. Changing a document customer after adding services does not automatically reprice existing rows; review prices before saving.

## Storage and API

The additive `service_bundles` table stores workspace, name, description, active status and JSON service IDs/quantities. No existing columns or records are changed. Startup sync creates the new table; migration `20261024000000-service-bundles.js` is also provided.

Authenticated endpoints under `/api/v1/service-bundles`:

- `GET /` — active templates for document entry.
- `GET /?manage=true` — all workspace templates for Settings.
- `GET /catalog` — active workspace service IDs/names for administrators.
- `POST /` and `PUT /:id` — validate and save an entire checklist transactionally.
- `GET /:id/expand` — return all ordered services and current master pricing, or reject the entire addition.
- `DELETE /:id` — delete only the workspace template.

All reads and mutations enforce the authenticated workspace. Client-supplied workspace IDs are ignored. Referenced services must be active in that workspace. No historical orders or quotations reference template rows, so deletion cannot cascade into them.

## Verification

Backend regression coverage exercises permission checks, tenant isolation, invalid/duplicate services, ordering, current pricing, inactive/missing services and persistence to both document types. Frontend unit coverage exercises pricing categories, zero charges, independent editable rows, preserving existing/locked rows, placeholder replacement and atomic quotation line limits.
