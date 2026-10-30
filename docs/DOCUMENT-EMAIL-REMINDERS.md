# Document expiry email reminders

Configure the company's sender in **Settings → Email**. For Gmail, choose **Use Gmail settings**, enter the Gmail address as username and sender, and use a Google App Password after enabling 2-Step Verification. The preset uses `smtp.gmail.com`, port `587`, STARTTLS. **Save & Test Connection** saves the displayed settings and verifies SMTP authentication; it does not send an email. Sending has not been verified until real credentials are entered and a user sends a reminder.

The document card, list/mobile actions and calendar details have an email button. It opens `/documents/email/:id`, with the configured From address, current customer email, document number, holder, expiry date and reminder text prefilled. Expiry timing uses Asia/Dubai. Missing customer email can be entered manually. To, subject and plain-text message are editable, and up to 20 CC email addresses can be added. From is read-only and is resolved again on the server, never trusted from the browser.

Opening the compose screen sends nothing. The user must click **Send email**. The button prevents double submissions. Success closes the compose page; failed sends retain the entered message. SMTP acceptance is logged using the existing `document_reminder` email log type, not the WhatsApp reminder count. Partial recipient rejection is reported. SMTP acceptance is not proof of inbox delivery.

Routes: `GET`/`POST /api/v1/email/documents/:id/reminder`. Both require internal company access, and detail plus edit access to the document. Tenant ID comes from the session. Portal users and other tenants cannot compose or send these reminders. SMTP settings and logs require settings permission. General configuration responses never include SMTP credentials, and credentials cannot be changed through the generic configuration endpoint.

The existing SMTP transport is reused with CC and text support, TLS certificate validation, STARTTLS and connection timeouts. Plain reminder content is escaped before generating HTML. No database schema change is needed. Existing automatic email switches are not enabled by the preset or by composing a reminder.
