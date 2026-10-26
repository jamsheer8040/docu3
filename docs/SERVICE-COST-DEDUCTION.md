# Service cost deduction

The workspace `wallet_deduction_point` setting is enforced by the server. Under `service_completion`, the completion preview loads the current policy and authoritative cost before opening the dialog. A positive cost requires an active, accessible wallet or supplier from the same workspace. A zero cost requires explicit confirmation and creates no financial entry. Update the cost source first if zero is incorrect.

The cost source is the linked sales-order line (cost × quantity), then linked non-cancelled invoice lines, then the service master. An explicitly zero linked cost remains zero; it does not fall back to a different positive master cost. The request cannot override the amount.

Linked invoice creation, editing and issuing defer cost posting to service completion under this policy. Standalone invoices retain invoice-level posting. Previously posted service costs are not posted again. Service and invoice workflows lock linked service rows, and service completion records its status, account posting, balance change and deduction flag in one transaction. Direct requests for completed status columns cannot bypass the completion action.

Changing the policy does not retroactively debit existing services or change their recorded costs. No live services or balances are modified by the regression tests; those use the disposable regression database.
