# Service staff assignment

Each service has one optional `assigned_user_id`, separate from internal notes.
Assigning staff keeps a pending service pending; starting it changes its workflow status.

- Service create/edit accepts an active internal user from the current tenant, or null for Unassigned.
- Sales-order push uses a confirmation dialog with the same optional staff choice. An omitted selection remains unassigned.
- Starting an unassigned service assigns it to the authenticated user. Existing assignments are retained.
- Assignment and status changes lock the service row in a transaction. Simultaneous starts do not overwrite the first assignee. Sales-order pushes lock the item to prevent duplicate services.
- Assignment events retain the previous/new staff, actor, reason and timestamp. Names are snapshotted for history.
- Completed and cancelled services cannot be reassigned. Open services can be reassigned from Employee Tracking even when their general edit form is locked by an invoice.

## Employee Tracking

The main-menu page `/employee-tracking` has an independent `employee_tracking` report permission, configured under Settings → Roles → Employee Tracking. Its View setting accepts No access, Own, or All. Own returns only the logged-in employee's summary and services assigned to or completed by that employee; creating a service does not make it their workload. All includes everyone and unassigned work in the current workspace. Other business permissions do not grant report access. Existing staff roles without this setting have no report access until configured; Admin/Developer retain full access.

The summary, assignment list, counts, filters and report history enforce the report scope on the server. The list returns only report fields, without service notes, prices or invoice details. Opening services and changing assignments still require the corresponding Services permissions. No service access is granted by a tracking role. Counts describe current assignment, not lifetime employee productivity. Staff can exist without login access and still be assigned manually.

The staff picker exposes only IDs/names, not user management or payroll details. It is available with service read access or sales-order write access. All service/user/history queries are tenant-scoped, and customer portal accounts are excluded from internal assignment operations.

## Upgrade

`20261017000000-service-staff-assignment.js` and the idempotent startup upgrade add nullable assignment fields and the `service_assignments` table. Existing service notes remain intact and are never interpreted as staff assignments. Existing services start unassigned; no historical owner is inferred. Rollback retains assignment data.

## Validation

The backend regression suite covers optional assignment, eligible staff, tenant isolation, assignment history, retained assignees, concurrent starts, completion, filtered counts, duplicate sales-order pushes and a repeatable schema upgrade. Browser checks cover the service edit dropdown, optional sales-order push selector and Employee Tracking menu/page.
# Employee progress and performance

Employee Tracking includes completion cards, interactive stacked workload bars, a monthly completion trend (up to the last 12 months of the selected range), and an Assigned / Started / Completed timeline in History. All themes use the same page.

The period selector offers Yearly (current calendar year), Monthly (current calendar month, default), and Today, using UAE time. Switching applies automatically to charts, counts, and service lists. The exact date range appears beside the selector. Clear filters restores Monthly. Workload and the service list use creation dates; completion counts, average elapsed hours, and the trend use completion dates. Service type and employee filters apply automatically. Completion percentage is completed / (total - cancelled), with zero for an empty denominator. Bar segments and card counts filter the service table.

The four Total Services / Unassigned / In Progress / Completed summary cards follow the top period selector and have no individual period controls. Employee cards, workload chart, completion trend, workload table, and service assignment list have independent period selectors. Selecting a period within one of those cards affects only that card. Clicking the top selector resets all local choices to its period, including when clicking the already selected top period. Clear filters resets all choices to Monthly. Employee and service type filters remain shared. Clicking a count or workload bar opens the service list using the source card's period without resetting the other cards. Three period summaries are fetched together per refresh/service-type change; local period changes reuse those results, with stale responses ignored and unavailable periods explicitly marked.

New completions snapshot the assigned employee ID in nullable `completed_by_user_id` (falling back to the acting user only if unassigned). Old records remain null and appear as unattributed completions; historical staff are never guessed. Average duration includes waiting time and excludes missing or negative timestamps. It is not an SLA or active work timer. No deadlines or on-time scores are inferred.

