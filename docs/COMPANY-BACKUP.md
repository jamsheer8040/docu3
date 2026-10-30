# Company database download

An internal company administrator can open Settings → General → Company Database
Backup and click Download Backup. One request creates and downloads a `.sql`
file, with no separate create/download steps. No database migration is required.

The SQL contains table definitions and the current company's records, including
financial, payroll, commission, service, customer, lead, user and configuration
data. User password hashes and company settings remain intact for restoration.
Uploaded documents/images, application code and server environment variables are
not database records and are not included. Back up the uploads volume separately.

The company ID comes exclusively from the verified administrator session. Staff,
portal users and administrators from other companies cannot select a different
company through the request. Indirect records (lead history, service pricing,
user/customer links) are filtered through their company-owned parents. Only the
company's current plan and referenced shared roles are included; platform promo
codes and other companies' records are excluded. Existing full-platform backup
routes are now restricted to internal Developer accounts.

Export reads use one InnoDB repeatable-read snapshot. Rows are read in bounded
batches ordered by their full primary key. Dates, microseconds, large integer
IDs, decimals, Unicode, JSON and binary data are preserved. Generated columns
are recreated by their table definitions rather than inserted manually. New
unscoped tables require an explicit ownership mapping before export can succeed.

The private temporary file is removed after download or failure, is not placed
in the platform backup directory, and is served with no-store headers. Repeated
clicks are blocked while a download is being prepared. Only one export per company
runs at a time in each backend process. Source records and wallet balances are
never modified.

## Import through General Settings

Choose a `.sql` file downloaded from this company's backup button (maximum
25 MB), then select one of the two import modes and click Validate Backup:

- **Replace** restores company-owned business records and removes newer records
  not present in the snapshot. It keeps the current administrator's login and
  role, platform Developer accounts, shared roles, subscription, plan and
  migration history unchanged.
- **Merge** adds missing records. Identical existing records are skipped;
  conflicting existing records stop the whole import. New financial history
  cannot be attached to existing financial records or wallets through Merge;
  use Replace to restore a coherent financial snapshot.

Validation shows the number of inserted, replaced and removed records. The admin
must type MERGE or REPLACE in a confirmation dialog. If the file or company data
changes after validation, import stops and requires another validation.

Imports do not execute uploaded SQL. The server parses the export's data format,
compares its schema with the current application, verifies company ownership,
record-ID collisions, staff assignments and references, then applies parameterized
data changes in one transaction. Arbitrary SQL and files from other companies are
rejected. Failed transactions roll back all changes. Platform access cannot be
granted through imported roles or users. Unknown or incompatible schema versions
must be migrated by a developer before import.

Before changing records, the server writes a company-only recovery SQL backup
from the locked pre-import state. The latest file is available through Download
Pre-import Backup in this section. These files are private, company-scoped, kept
under `backend/backups/companies/`, and excluded from Git. This release does not
automatically expire recovery files; server storage must be managed accordingly.
Reload the app after a successful import. Uploads are not restored by SQL import.
No live company import is performed by the tests.

## Manual restoration into a separate database

Restore into a separate, empty MySQL database using a matching MySQL version and
the corresponding application version. Select that database in a trusted MySQL
client and execute the SQL file. The file includes DROP TABLE statements and is
not intended to merge a company into an existing shared production database.
Keep original IDs, and restore the company's uploaded files separately. Review
the imported company before using it as a replacement system. Never execute the
SQL file directly against a shared production database; use the company-scoped
import flow above instead.

The integration test exports one company from a multi-company disposable database,
then restores the SQL into `docclear_regression_test` after its isolation checks
and compares restored records. The test refuses to run against the live DB.
