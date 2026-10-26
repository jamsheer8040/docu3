# Running DocClear locally

The configured local instance uses the `docclear_local` MySQL database and the
credentials in `.local/local-login.txt`. The original backend environment file is
preserved at `.local/backend.env.original`. Local data and credentials are ignored
by Git. Scheduled mail, backup, and subscription jobs are disabled locally through
`DISABLE_CRON=true`.

From the repository root, run:

```powershell
.\scripts\start-local.ps1
```

Open http://127.0.0.2:3000/login. The launcher starts the existing portable MySQL
installation and the backend/frontend as hidden background processes. It uses the
runtime path saved in `.local/mysql-runtime.txt`; if that installation moves, pass
`-MySqlHome 'C:\path\to\mysql'`. Logs are under `.local/`.

The launcher uses the built frontend. After changing frontend source, run
`npm.cmd run build` in `frontend` and restart its Node process. For active frontend
development, run `npm.cmd run dev` in `frontend` instead of the built server.

## Access from another device

The launcher binds the built frontend to `0.0.0.0:3000`, allowing both local and
network access. The backend and MySQL stay on loopback addresses; the frontend
proxies API and upload requests. On the same Wi-Fi network, open
http://172.16.10.190:3000/login and use the existing login details. This address may
change when the PC reconnects to Wi-Fi.

The Windows firewall rule `DocClear-WiFi-3000` allows TCP port 3000 only on the
WiFi interface, for local-subnet clients connecting to `172.16.10.190`. If the PC's
Wi-Fi address changes, update that rule and the backend's `FRONTEND_URL` setting.
Do not forward this port on the router. To return to local-only access, stop the
frontend and launch with `.\scripts\start-local.ps1 -FrontendHost '127.0.0.2'`.

## Regression checks

The suite requires a separate, disposable local database named
`docclear_regression_test`. It resets that database's schema. The current local
database user has access to it.

```powershell
cd backend
$env:DB_NAME = 'docclear_regression_test'
$env:TEST_DATABASE_RESET = 'yes'
npm.cmd run test:regressions
Remove-Item Env:DB_NAME, Env:TEST_DATABASE_RESET
```

## Administrator provisioning

Startup no longer creates privileged users with built-in passwords. To explicitly
create an administrator for an existing organization, supply
`BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` (at least 16 characters), and
`BOOTSTRAP_TENANT_ID`, then run `node create_admin.js` from `backend`. Existing
accounts are never overwritten by this command. Known legacy accounts that still
use their original default password are disabled on startup; customized passwords
are preserved. Provision a replacement administrator before upgrading a deployment
that relies on a legacy default account.

Private upload URLs now require a signed-in session with access to their owning
record. Shared document URLs therefore require the recipient to sign in with an
authorized account. Branding images remain public for the login page.

The model ID corrections allow clean local schema creation. Startup uses
`sync({ alter: false })` and does not resize columns in existing databases. Apply
the repository's normal migrations when deploying schema changes.
