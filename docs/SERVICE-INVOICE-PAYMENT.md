# Invoice payment identity on services

Kanban cards and list rows use the same clickable invoice badge. An active
invoice shows its number. Once fully paid, a dark green check segment appears.
Partial payments retain the plain badge, including when only one fils remains.
Draft, cancelled and inconsistent payment data never receive the paid marker.

The badge reads the linked invoice's status, payment status, total and paid
amount from the existing tenant-scoped Services API. Multiple services linked
through `ServiceOrder.invoice_id` display the same invoice payment state. It
does not allocate payment separately to individual services or change their
workflow status. Reversing payment removes the paid marker after refresh.

The visible page refreshes invoice badge data every 30 seconds and when the tab
regains focus or visibility. It preserves service workflow data and filters,
ignores responses after leaving the page or changing the signed-in user, and
stops background polling on unmount. The existing manual refresh also updates
invoice payment data. No database migration or accounting changes are needed.
