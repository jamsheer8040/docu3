# Role dashboard templates

Use Settings → Dashboard Templates to create, duplicate, edit, preview, reorder,
or delete a dashboard template. The starter designs are Admin Overview, Sales
Focus, and Work Focus. Templates belong to one workspace.

Each template selects an ordered set of cards. Record visibility can be the
records already allowed by the user's role, or a further restriction to records
assigned to the signed-in user. This setting never grants additional permissions.
Financial cards also require Financials access. Create links require the relevant
module's create permission.

In Settings → Roles, choose a template and click Save dashboard. A new internal
role can select its template during creation. Everyone using the role receives
the layout on their next dashboard visit. Dashboard access is still controlled
by the role's Dashboard access switch. Role record scopes remain independent.

Templates apply across themes. Roles with no selection retain their existing
dashboard. Admin role permissions remain protected while its dashboard template
can be selected independently. Customer portal and global/shared system roles
cannot be assigned a workspace template through the assignment endpoint.

Cards with time-based totals use Yearly, Monthly (default), or Today in UAE time.
Active pipelines, due follow-ups, work queues, document deadlines, wallet balances,
and aged invoices represent the current state and are labeled accordingly.
The service work queue includes pending, assigned, in-progress, waiting, and
on-hold services; completed and cancelled services are excluded.

Deleting a template is blocked while any role uses it. Select another template
or the default dashboard for those roles first. Editing a template affects every
role using it without changing that role's permissions.

The additive migration creates dashboard_templates and adds the nullable
roles.dashboard_template_id. Local startup performs the same idempotent upgrade.
No existing role is automatically assigned a template.
