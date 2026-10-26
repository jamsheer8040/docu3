# Lead Management Module

_Reference edition 1.0 · 22 October 2026_

Functional Reference and Implementation Guide

What the module does, why its features exist, how staff use it, and the conditions another application must implement.

This guide is for a business owner explaining the workflow to a product designer, developer or implementation partner. It documents the reviewed application as it exists on 22 October 2026, then identifies decisions and gaps that must be resolved before reproducing it.

### The core concept

A lead is an enquiry or sales opportunity. It records who is interested, the service requested, how the enquiry arrived, who is responsible, and what should happen next. A lead can refer to a new prospect or an existing customer asking about another service.

The current lead workflow is New → Contacted → Qualified → Follow-up. Archived removes an enquiry from active pursuit while keeping its history. Follow-up is a repeatable work state, not a one-time milestone.

### Keep these ideas separate

- Lead type: Company or Person, displayed as B2B or B2C. This is a reference tag.

- Lead stage: the current sales activity state. Previous milestones remain visible.

- Quotation state: a separate commercial document lifecycle. Quote Sent is a badge beside the lead stage.

- Customer and service work: operational records with their own ownership and permissions. An enquiry or quotation does not automatically create them.

### How to use this guide

The opening sections explain the business workflow. The later sections cover the data model, API contract, acceptance criteria, current gaps, recommended design decisions, practical scenarios and source evidence. All names and payload examples are illustrative; no live customer records are included.

Status of statements: “Current” describes reviewed behavior. “Recommended” describes a design decision for a replacement application. A legacy endpoint or a historical import instruction is not presented as a completed end-to-end feature.

## Feature map and responsibilities

What: one shared workspace for capturing and working sales enquiries. Why: staff need a clear owner, a next action and a durable record rather than separate spreadsheets. How: the list, Kanban board and detail page all operate on the same lead records.

| Capability | Business purpose | Current working method |
| --- | --- | --- |
| Capture and classification | Record enquiries consistently | Create a lead manually or import an Excel workbook. Select Person or Company and an optional service. |
| Pipeline management | Understand the current action | Use five visible stages and separate status history. |
| Follow-ups | Avoid forgotten enquiries | Schedule one next date; log unlimited completed activities with notes and an optional attachment. |
| Staff ownership | Make responsibility visible | Use creator and assigned staff separately. Assignment avatars appear in list and Kanban. |
| Quotations | Record the offer without losing the enquiry | Create a linked quotation; its sent marker appears beside the lead stage. |
| Reporting and portability | Find work and share records | Search and filter, download Excel, and use dashboard pipeline and due-follow-up cards. |

### People and permissions

| Actor | Typical responsibilities |
| --- | --- |
| Administrator | Configure roles, assign records, manage source/service setup and oversee staff activity. Admin and Developer roles retain broad access. |
| Sales staff | Work accessible leads, record contact outcomes, schedule follow-ups and prepare quotations when authorised. |
| Senior sales or team lead | Use a role with broader record scopes where required. Seniority itself does not grant access. |
| Operations staff | Work on customer services through separate modules. Lead access is optional and role-controlled. |
| Customer portal user | Has separate customer-facing access. Do not treat the portal as an internal lead workbench. |

Recommended setup: junior sales roles can use Assigned to me or Created or assigned to me. Supervisors may use All records. Set View list and View details independently; seeing a row does not necessarily permit opening it.

## Lead identity and contact fields

What: a lead combines an opportunity identity with contact details. Why: companies and individuals can both enquire, and a company may have a different contact person. How: store the customer or company label separately from the optional person name.

| Field | Meaning and condition |
| --- | --- |
| Customer or Company Name | Required in the form and standard import. Stored as company_name, up to 150 characters. For a personal lead this is the individual’s main display name. |
| Lead Type | Person or Company. The normal new-lead form defaults to Company. Older or imported leads may have no type; do not guess one automatically. |
| B2B or B2C tag | Company displays B2B; Person displays B2C. The tag is descriptive and does not control stage or permission. |
| Contact Person | Optional name field, up to 150 characters. Can identify the company’s contact separately from the opportunity display name. |
| Phone or WhatsApp | One shared contact field is used. Required in the form/import; database length is 20 characters. A separate WhatsApp-number field is not needed in the current design. |
| Email | Optional, up to 100 characters. Standard Excel import validates email shape. The manual form uses an email input but does not apply the same full server validation as the importer. |
| Existing Customer | Optional customer_id. Selecting an existing customer links the enquiry and prefills available contact information. Typing a new prospect does not create a customer. |
| Service Required | Optional service_id pointing to the workspace service catalog. It describes interest; it does not start a service order. |

### Phone normalization

The standard importer recognizes UAE mobile formats. For example, 502029780 and 0502029780 become +971502029780; 00971502029780 becomes +971502029780. Other formats are preserved instead of silently inventing a country code.

Current list and Kanban WhatsApp links strip non-digits from the stored number. They do not independently add +971 to every manually entered local number. Recommended: use the same normalization function on create, edit, import and WhatsApp-link generation, with a visible validation message for unsupported numbers.

## Operational fields and record relationships

| Field or relationship | What it means and how it is maintained |
| --- | --- |
| Status | One of New, Contacted, Qualified, Follow-up or Archived in the active UI and normal validation. |
| Source | Origin of the enquiry. Manual options currently include Website, Referral, Social Media, Meta Ads, Cold Call and Other. Import can preserve other source text. |
| Notes | Free-text business context and outcomes. Notes are not a replacement for a dated follow-up record. |
| Next follow-up date | One pending calendar date, required in Follow-up stage. It is cleared when the lead leaves that stage. |
| Follow-up scheduled at | Server-owned timestamp set when a date is scheduled or changed. Used for deadline progress; clients must not override it. |
| Archive reason | Required nonblank reason when Archived, maximum 5,000 characters. Removed from the active lead when reopened; archive history retains earlier reasons. |
| Creator | created_by is stamped by the authenticated user. It is separate from the assigned staff member and cannot be reassigned by editing a lead. |
| Assigned staff | assigned_user_id identifies the responsible active internal employee in the same workspace. Leads may be unassigned. The normal lead form currently has no salesperson selector. |
| Added On and Updated At | Creation and update timestamps. Standard import can set Added On from a valid historical date. Do not replace a historical creation date merely because the record was imported later. |
| Quote Sent | Derived badge: at least one linked quotation has a non-null sent_at. It is not a free-text flag or a stage. |
| WhatsApp clicks | Count of recorded link-opening actions. It does not confirm delivery, reading, a response or a completed follow-up. |
| Customer conversion fields | customer_id, converted_by and converted_at support a customer link and legacy conversion history. The normal customer handoff is not a complete automatic workflow today. |

Every lead belongs to one tenant or workspace. A lead can have many status-history rows, many completed follow-ups and many quotations, while currently keeping only one next follow-up date and one assigned staff member.

## Creating an enquiry and linking a customer

### What and why

Capture an enquiry without forcing a new customer account or operational job. This lets a salesperson explore the requirement first and also records new requests from an existing customer.

### How to create a lead

1. Open Leads and choose Add Lead. The role must have lead Create permission.

2. Choose Company or Person. Enter the display name in the main Customer or Company Name field.

3. Search existing customers if appropriate. The search uses accessible active customer records; selection fills the customer link and available contact details.

4. For a new prospect, keep the typed name without selecting a customer. Fill in the shared phone number, optional contact person, email and requested service.

5. Choose the source and initial stage. New is the ordinary starting point. Choosing Follow-up requires a date; choosing Archived requires a reason.

6. Save. The server stamps workspace and creator and creates an initial stage-history entry. Assign the responsible staff member through Record assignments where required.

### Existing customer selection

The name search is case-insensitive and ignores spaces for matching. Typing a changed name after selecting a customer can clear the link and prefilled phone/email. Confirm the contact details before saving. The customer list loaded into this form is limited to the accessible active customers returned by the customer API, up to 1,000 requested records.

### Conditions to preserve in another application

- Creating a lead must not create a customer merely because a new name was typed.

- Selecting a service must not create a job, invoice, payment or commission.

- Default lead creator is the logged-in user. Default lead assignee is not automatically the same person in the current lead form.

- Current manual create does not provide the standard importer’s duplicate-phone check. A replacement should define whether duplicates are blocked, warned about or intentionally allowed for separate opportunities.

- Field requirements should be enforced on the server as well as in the UI. The current create endpoint validates stage conditions more consistently than general contact-field content.

## Pipeline stages and lifecycle conditions

| Stage | What and why | How and conditions |
| --- | --- | --- |
| New | An enquiry is captured and not yet progressed. | Default initial stage. No required follow-up date or archive reason. |
| Contacted | A salesperson has established or attempted the initial contact according to the business process. | Set from list, Kanban or detail controls. The stage itself does not automatically log a call or prove a response. |
| Qualified | The opportunity is considered worth progressing. | A normal active stage. Completing a scheduled follow-up without another date also returns here. |
| Follow-up | There is a scheduled next action. | Requires a valid next_follow_up_date. Scheduling and rescheduling set the server scheduling timestamp. |
| Archived | The enquiry is no longer being actively pursued. | Requires a nonblank reason. Follow-up scheduling and logging are disabled until the lead is reopened. |

### A current stage is different from a reached milestone

The detail timeline shows which stages have already been reached and which one is current. New is considered reached for every lead. A recorded Contacted or Qualified state, or completed follow-up activity, is enough to show the contact milestone as reached. Previous history remains after later changes.

The detail view avoids offering Mark Contacted or Mark Qualified again when the milestone is already reached. Follow-up remains repeatable. Staff do not need to reset an enquiry to New or Contacted every time they make another call.

### Transition behavior

The list and board can request any visible stage, subject to edit scope and conditional fields. The backend does not enforce a strict forward-only sequence through every stage. A replacement should preserve the history while deciding explicitly whether backward moves need a reason.

Leaving Follow-up clears the pending date and scheduling timestamp. Scheduling is not the same as completing an activity. Moving to Archived clears the pending schedule; reopening uses an active stage and requires a new date if that stage is Follow-up.

Won and Lost remain in the stored legacy model, but the current API presents those old values as Qualified and does not accept them as normal stage updates. Quote Accepted is also separate. Resolve the conversion gap on page 21 before implementing a new success endpoint.

## Scheduling and completing follow-ups

### What and why

A schedule is a promise to act on a date. A completed follow-up is a record of something that actually happened. Keeping these separate avoids inflated activity counts and makes overdue work visible.

### How to schedule or reschedule

1. Choose Schedule follow-up from a lead, or move the lead into Follow-up. Edit permission for that lead is required.

2. Choose a calendar date. The server validates the date, changes the stage to Follow-up and records when the schedule was made.

3. If a pending date exists, use the reschedule control to change it. An unchanged date does not reset the server scheduling timestamp.

4. On the due date or later, the action is marked due. Use it to open Log completed follow-up.

### How to log an activity

1. Choose one channel: Call, WhatsApp, Meeting or Email. Call is the form default.

2. Enter the actual contact date and time and nonblank conversation notes or outcome. The event time must be current or in the past.

3. Optionally attach one supported file, and optionally choose the next follow-up date.

4. Save. The server records the activity and, when completing a pending schedule, checks that the submitted scheduled date still matches the lead.

### Counting and history

Each successful activity submission creates one completed follow-up record. The system supports any practical number of completed follow-ups; it is not restricted to ten. Scheduling and rescheduling do not add completed activity records. The detail page counts activities by channel and lists them newest first.

A follow-up date is a calendar date in the UAE business workflow; occurred_at is a timestamp representing an actual event. The UI uses the local browser time for event entry and sends an ISO timestamp. Recommended: define the business timezone consistently in a replacement.

## Follow-up outcomes and deadline progress

| Action or condition | Result |
| --- | --- |
| Complete the pending schedule and enter another date | Create one completed activity; remain in Follow-up with the new pending date and a new scheduling timestamp. |
| Complete the pending schedule with no next date | Create one activity; move to Qualified; clear the pending date and scheduling timestamp. |
| Log an unscheduled activity with another date | Create one activity and put the lead into Follow-up for that date. |
| Log an unscheduled activity with no next date | Create one activity; keep the current stage unchanged. |
| Schedule a date but do not log contact | Change the schedule only. Completed follow-up counts do not increase. |
| Submit an outdated scheduled date | Reject with a conflict and ask the user to refresh; do not complete a different schedule silently. |
| Log an activity while Archived | Reject. Reopen the lead first. |
| Enter blank notes, an unsupported channel or a future event time | Reject the activity. Notes must be nonblank and at most 5,000 characters. |

### Due and overdue behavior

A pending follow-up is due when its date is today or earlier in Asia/Dubai. The due action uses a red emphasis and the label Fo-Due. The UI refreshes its business date periodically so due state can change without reopening the page.

The progress outline measures elapsed calendar days between scheduling and the due date. It is clamped between 0 and 100 percent; the entire due day and all overdue days show 100 percent. It is a deadline indicator, not a sales probability or completion percentage.

The date validator currently permits a valid past follow-up date. Such a date is immediately due. A replacement should decide whether intentionally backdated schedules are permitted or require a reason.

There is no independent completion checkbox for every stage. Logging a follow-up records actual activity, while status history records stage changes. Both remain available so repeated contact does not erase earlier milestones.

## Communication notes and attachments

### WhatsApp connection

What: a clickable phone link in the list and Kanban view opens WhatsApp using the shared phone number. Why: staff should not copy a second duplicate WhatsApp number. How: the UI builds a wa.me link and separately increments the click counter.

Opening WhatsApp does not send a message automatically and does not create a completed follow-up. The user communicates in WhatsApp, then records the real outcome through Log follow-up. Do not use the click counter as proof of a response, message delivery, reading or conversion.

### Follow-up attachments

| Condition | Current rule |
| --- | --- |
| Required or optional | An attachment is optional; notes remain required. |
| Number of files | One attachment per completed follow-up submission. |
| Supported formats | PDF, JPG, JPEG, PNG and WEBP. |
| Maximum size | Up to 10 MB at the upload boundary; the UI rejects larger files. |
| File validation | Extension, declared MIME type and file signature must agree. |
| Storage and display | Binary data is stored with the activity and excluded from normal JSON responses. Filename and type are available for display. |
| Download protection | The requested activity must belong to the accessible lead in the same workspace. Download uses no-store and no-sniff response headers. |

### Business notes and import traceability

Lead notes store general context. Activity notes store a dated conversation outcome. Stage-history archive reasons record why the lead was stopped at that time. These are different records and should not be merged into one unstructured text field.

The current UI hides recognized historical import-identification lines from the ordinary note editor and preserves them when visible notes are edited. Other historical business notes can still be visible. Recommended: store provenance in dedicated metadata fields rather than depending on a particular note-text pattern.

Call, Email and Meeting channels describe logged contact methods. They do not provide telephony, email delivery or meeting-booking integrations by themselves.

## List Kanban and lead detail screens

### List view

What: a compact working directory of accessible enquiries. Why: staff need to compare contacts and choose the next action quickly. How: show lead identity, contact, service, source, assigned staff, status, follow-up, Added On and available actions.

Lead identity cells show the company or personal name and the optional B2B or B2C reference tag. Service chips use consistent colours by service name. Assigned staff uses a photo or initials with a hover label; an unassigned lead shows a question-mark avatar.

Clicking the identity-through-assignee area opens the detail page when permitted. Interactive controls such as WhatsApp, status selection and follow-up actions handle their own click and do not open the page accidentally. Opening details needs detail permission, not just list permission.

### Search filtering and sorting

- Search matches company name, contact name, email and phone, case-insensitively.

- Filters combine stage, source and requested service. Source/service choices are derived from the accessible loaded lead set, including missing-value choices.

- Follow-up date sorting supports ascending or descending due order. Leads without a pending follow-up are placed after dated follow-ups.

- Reset filters also resets paging and sorting. Standard table sorting and dedicated follow-up sorting do not stay active at the same time.

### Kanban view

The board uses New, Contacted, Qualified, Follow-up and Archived columns. Cards show key contact, service/type references, assignment and follow-up information. Dragging between columns requires edit permission. Moving to Follow-up opens date scheduling; moving to Archived requires a reason. Other valid changes save the target stage.

### Detail view

The detail page combines contact/opportunity data, channel counts, an action to schedule or log follow-ups, chronological activity and attachment access, quote history, a lifecycle timeline and stage history. Follow-up history and quote history use approximately 65 percent and 35 percent of the history row on wide screens and stack on narrow screens.

List/board changes do not create separate lead copies. Current UI state is refreshed or merged through the lead store; server permissions remain authoritative.

## Ownership roles and access conditions

### What and why

Role rules define which records a user can see or change. Creator and assignee identify two different relationships to a lead. This makes junior and senior staff access configurable without assigning different privileges to every individual record manually.

| Permission | Allowed scope or behavior |
| --- | --- |
| View list | No access, Created by me, Assigned to me, Created or assigned to me, or All records. |
| View details | Independent choice of the same record scopes. A user can see a summary row while being unable to open full notes/history. |
| Create | On or off. Also controls normal Excel import and downloading its template. |
| Edit | Independent record scope. Covers status changes, scheduling, follow-up logging and changing an accessible assignment. |
| Delete | Independent scope. Does not override the rule against deleting a lead linked to a customer. |
| Quotation access | Separate quotation permissions are needed to create documents, read quote history or open a particular quotation. |
| Dashboard access | Role dashboard access and template determine which cards appear; underlying module and record permissions still apply. |

### How assignment works

Use Settings → Roles → Record assignments, select Leads, and choose an active internal employee from the same workspace. The user must be able to edit the lead. The current lead create/edit form does not itself expose an assignment dropdown. Unassigned leads remain possible.

Created or assigned means a logical OR: either relationship qualifies. Selecting All does not cross the workspace boundary. Changes to a shared role affect all users of that role on subsequent authenticated requests.

### Server enforcement

The server stamps tenant and creator, strips protected creator/conversion fields from normal edits, validates assignees and applies record scopes to queries and writes. Follow-up and history access derives from the parent lead. Hidden detail fields must not become visible merely through an export, file download or dashboard link.

A salesperson assigned to a lead is not automatically the owner of a linked customer. Customer salesperson assignment is a separate downstream responsibility used by the commission module.

## Quotations alongside the lead lifecycle

### What and why

A quotation is a commercial offer linked to an enquiry; it is not a lead stage. Keeping the document separate allows a lead to remain in Follow-up while an offer has already been shared.

### How to work with a quotation

1. From an accessible lead detail page, choose Create quotation when quotation Create permission is available.

2. Save the lead link and recipient snapshot. Add service lines, quantity, rate and permitted tax/discount information. Catalog selection supplies defaults that can be adjusted in the quotation workflow.

3. Include validity, bank information, payment terms and terms and conditions where needed. Save as Draft.

4. Mark Sent after sharing the offer. This is a recorded manual sharing action; it is not automatic email or WhatsApp delivery.

5. The lead shows Quote Sent beside its current stage. The detail quote history shows accessible quotation numbers, status, date, amount and sent information.

| Quotation condition | Effect on lead management |
| --- | --- |
| Draft quotation linked to a lead | Does not by itself show Quote Sent or change the lead stage. |
| At least one linked quotation has sent_at | Quote Sent can display while the lead stays in any applicable stage. |
| Sent quotation later Accepted or Declined | The lead stage is not automatically changed. The badge derives from the sent marker, not just current quote status. |
| Edit a nonaccepted quotation | It returns to Draft and clears its sent marker. Another sent quotation can still keep the lead badge visible. |
| Accepted quotation | Locked in the quotation module; duplicate it for a revised offer. |
| Historical note says quote shared | Does not create a linked quotation or qualify as the current Quote Sent badge. |

Current quotation states are Draft, Sent, Accepted, Declined and Expired. PDFs support Classic, Modern, Compact and Minimal layouts. Internal remarks and cost/service-charge columns are excluded from customer-facing quote output. These document features belong to Quotations, not to the lead record itself.

## Customers service work and commission boundaries

### Current customer relationship

A lead is not automatically a customer. The lead form can link an existing customer and the detail page can open that customer. One customer may have several enquiries; linking another opportunity is different from creating a second customer account.

A legacy conversion endpoint exists, but it requires the raw stored stage Won. The current lead update API accepts only the five visible stages and serializes older Won/Lost values as Qualified. Therefore ordinary lead progression cannot currently complete a clean mark-won-and-convert workflow. Treat this as a known gap rather than a ready automation.

### Recommended end-to-end handoff for a new application

1. After the commercial success condition is met, explicitly choose an existing customer or create one after a duplicate review.

2. Keep the original lead and its history. Link the customer and record who converted it and when.

3. Require one customer salesperson. Default customer creation to the acting user, but allow an authorised administrator to select another employee.

4. Create the operational sales order or service from the customer workflow. Keep the service requirement on the lead as enquiry context, not as a completed job.

5. Link quotation, customer, service and invoice records so the sales journey can be traced without changing old history.

### What the current surrounding modules do

Customer creation now requires a salesperson. It defaults to the logged-in creator unless another valid internal employee is selected. The assignment can be changed later. The reviewed legacy conversion endpoint also uses the acting user by default; it does not automatically inherit the lead assignee.

A quotation does not post revenue, create a service order, create an invoice or automatically create a customer. Service delivery and invoicing remain their own workflows.

### Commission boundary

A lead or quotation alone does not earn commission. In the surrounding application, an invoice has at most one commission recipient: the customer salesperson. Formula eligibility is checked for that one person. Commission release requires full invoice payment. Lead assignment and WhatsApp/follow-up activity counts must not be interpreted as payroll entitlement.

## Standard Excel import rules

### What why and how

Use Import Excel to add new lead records consistently. Download the template, prepare plain values, upload the workbook, inspect the preview, correct all row errors and confirm the import. Existing leads are not updated.

| Constraint | Current behavior |
| --- | --- |
| Workbook | Valid .xlsx only. Prefer the Leads sheet; otherwise the first sheet is used. |
| Upload size | Maximum 5 MB; one workbook per request. |
| Workbook dimensions | At most 1,000 lead rows and 50 columns. Header row is required; fully blank rows are skipped. |
| Required headers and values | Customer / Company Name and Phone / WhatsApp. Missing required headers reject the file; missing values reject the row. |
| Header matching | Case and nonalphanumeric differences are normalized. Duplicate normalized headers are rejected. |
| Cell values | Plain values, rich text and simple text objects are read. Formula cells are rejected; cached spreadsheet formulas are not treated as trusted data. |
| Dates | YYYY-MM-DD. Invalid calendar dates are rejected. Added On is optional and, when supplied, is stored at 09:00 Asia/Dubai on that date. |
| Type | B2B or Company maps to Company. B2C or Person maps to Person. Blank remains unspecified. |
| Stage | Exact current stage value; blank defaults to New. Follow-up requires Next Follow-up; Archived requires Archive Reason. |
| Service | Must match exactly one active service in this workspace after name normalization. |
| Assigned Staff | Must match one active internal employee by normalized name or case-insensitive email. Email can resolve ambiguous names. |
| Duplicate phones | Blocked against the workspace and within the file after supported normalization. The 0000 placeholder is exempt from duplicate-phone blocking. |

Import validates name lengths up to 150, phone 20, email/source 100, archive reason 5,000 and notes 20,000 characters. Email shape is checked. A blank name or phone is not automatically replaced with 0000 by the standard importer.

## Import confirmation export and historical data

### Preview and confirmation

The preview reports total, valid and invalid row counts and row-level reasons, and displays the first 100 valid rows. A workbook with any row errors cannot be confirmed successfully. Confirmation reparses the uploaded file, checks current workspace data again and writes lead rows plus initial stage histories transactionally.

A successful preview does not reserve duplicate phone numbers. Another import may add them before confirmation, so confirmation must validate again. The standard importer serializes the confirmation path through the tenant row lock. It does not update an existing record or reconstruct activity from exported counts.

### Excel download

The Excel button exports the currently filtered accessible lead set, rather than just the visible pagination page. The request sends the selected lead IDs, up to 10,000. The server filters again by workspace and permissions and preserves requested row order.

Export columns: ID; Customer / Company Name; Contact Person; Type; Phone / WhatsApp; Email; Service; Source; Status; Assigned Staff; Follow-up Count; Next Follow-up; Added On; Archive Reason; Notes. Phone cells are text, the header is frozen and filtering is enabled.

The follow-up count is calculated from completed activity records. List-only permissions can omit protected notes/details in the export. Downloading a file does not grant additional access.

### Round-trip limitation

The standard import ignores exported IDs and Follow-up Count. It imports lead fields only, not activities or attachments. Reimporting an export is therefore not a complete backup restore and ordinarily triggers duplicate-phone errors for existing leads.

### Separate historical migration policy

An earlier custom spreadsheet migration supported agreed mappings such as responsive → Contacted, no response → New with source context retained, closure remarks → Archived with a reason, and Waiting for their plan as a note. It used original lead dates and estimated follow-up dates as lead date plus follow-up column number in days; Call represented an unspecified historical method.

Those are migration-specific decisions, not capabilities of the standard import dialog. The reviewed custom script creates activities only for nonblank historical follow-up cells. A request to count every blank numbered column needs a separate explicit transformation; do not claim that exported counts or blank cells automatically recreate history.

## Dashboard metrics and daily operating routine

### What and why

Dashboard templates prioritise different work for different roles. A sales-focused dashboard puts due contacts and lead distribution ahead of service delivery; an operations dashboard can omit leads entirely.

| Feature | Current behavior and interpretation |
| --- | --- |
| Lead pipeline widget | Counts the current accessible nonarchived lead pipeline by stage. It represents current work, not a period conversion funnel. |
| Follow-ups due widget | Counts Follow-up leads whose pending date is today or overdue in business time; lists up to six earliest due records. |
| Widget navigation | An individual due entry links to its lead detail page; the card destination is the lead module. |
| Template record scope | Accessible records uses the role’s scope. Assigned records adds the current user’s assignment filter; it does not widen permissions. |
| Module permission | A dashboard template cannot grant lead access. Required module rules still apply. |
| Period controls | Some dashboard business widgets use Today, Monthly or Yearly ranges. Current lead-pipeline and due-follow-up widgets are current-state queues, not creation-period counts. |
| Lead-page summary cards | Total Leads, In Pipeline (New plus Contacted), Qualified and On Follow-up use the accessible loaded records. They do not represent the current filter subset. |
| Trend percentages | The lead-page comparison percentages are hardcoded display values in the reviewed screen. They must not be used as measured month-over-month analytics. |

### Suggested daily process

1. Review due and overdue leads for the permitted scope.

2. Open each enquiry; review prior notes, current quotation and latest activity.

3. Make the contact through the chosen real communication channel.

4. Log the outcome once and choose the next date when needed.

5. Keep Qualified when no next scheduled action is required, or archive with a reason when pursuit stops.

6. Supervisors review unassigned enquiries and access gaps without using a dashboard template as a substitute for role rules.

## Data model and business invariants

| Entity | Key data | Relationship |
| --- | --- | --- |
| Lead | Identity, type, contact, stage, source, service, owner, schedule, notes, tenant | One lead belongs to one workspace; may link one customer. |
| LeadStatusHistory | previous_status, new_status, changed_by, update_source, archive_reason, created_at | Many history entries per lead. Tenant access is checked through the parent lead. |
| LeadFollowUp | channel, occurred_at, notes, creator, optional attachment name/type/binary | Many completed activities per lead; each activity also has tenant_id. |
| User and Role | Employee identity, active/internal status and per-action scope rules | Creator and assigned staff are separate links. |
| ServiceType | Service catalog identifier, name and commercial defaults | A lead’s service_id is an optional requested-service reference. |
| Customer | Customer identity and its own required salesperson | Several leads may refer to one customer. Customer ownership controls downstream commission. |
| Quotation | Lead/customer link, recipient snapshot, document lines, totals, state, sent_at | Several quotations can relate to a lead; sent documents supply its quote badge. |

### Invariants to retain in a replacement

- Workspace identity comes from authentication, never from trusted client payloads. Every lookup, write and download must remain within that workspace.

- One lead has one current stage and at most one pending follow-up date. Completed contact history can grow independently.

- A new follow-up activity and its schedule/stage changes are one transaction. A failed save must not partially complete the action.

- The pending date sent when completing a schedule must still match the locked lead record. A concurrent reschedule returns a conflict.

- A stage history entry is added when a stage changes; ordinary note edits need not create a stage-change row.

- Archive needs a reason; customer-linked leads cannot be deleted. Follow-up/history relations are configured to cascade when an unlinked lead is physically deleted.

- History and file access inherit lead permissions. Assigning an unrelated tenant employee or portal account must fail.

## API operations and integration contract

The reviewed application uses authenticated JSON APIs under /api/v1, except workbook and follow-up uploads, which use multipart/form-data. The server derives the tenant and applies role and record scopes. Most responses use success and data; validation messages or row errors accompany failures.

| Method and relative path | Purpose and main condition |
| --- | --- |
| GET /leads | List accessible lead summaries with creator, assignee, service/customer references and quote badge. |
| GET /leads/:id | Get accessible full lead details, status history and completed follow-ups. |
| POST /leads | Create lead and initial stage history; needs Create permission. |
| PUT /leads/:id | Edit fields or change stage; needs Edit scope. Validate archive reason and pending date. |
| DELETE /leads/:id | Delete an accessible unlinked lead; needs Delete scope and no customer link. |
| POST /leads/:id/follow-ups | Create a completed activity with optional attachment, schedule completion token and next date. |
| GET /leads/:id/follow-ups/:activityId/attachment | Download the one attachment after parent-lead detail and tenant checks. |
| POST /leads/:id/whatsapp-click | Increment a tracked link-opening action for an accessible lead. |
| GET /leads/import/template | Download standard workbook; needs Create permission. |
| POST /leads/import/preview or /confirm | Validate file or confirm all valid rows. Upload field name is file. |
| POST /leads/export/excel | Download the permitted subset of the supplied positive integer lead IDs. |
| PUT /record-assignments/Lead/:id | Set assigned_user_id to a valid internal staff member or leave unassigned, subject to Edit scope. |
| POST /leads/:id/convert | Legacy conversion endpoint requiring raw Won status; not a complete normal-UI handoff today. |

Related quotation endpoints live under /quotations; creating from a lead passes lead_id. Keep transport-specific error codes separate from business wording: validation failures commonly use 400, access failures 403, missing/inaccessible records 404, and stale schedule completion 409.

## Example payloads and a reference import row

These examples use illustrative IDs and dates, not real application records. Authentication and workspace selection are omitted because the server owns them.

### Create a company lead

```text
POST /api/v1/leads
{
  "lead_type": "Company",
  "company_name": "Example Trading",
  "name": "Noor",
  "phone": "+971502029780",
  "email": "sales@example.test",
  "service_id": 12,
  "source": "Meta Ads",
  "status": "New",
  "notes": "Asked for licence options"
}
```

### Schedule then complete a follow-up

```text
PUT /api/v1/leads/101
{"status":"Follow-up",
 "next_follow_up_date":"2026-10-26",
 "update_source":"Details"}
```

To complete that schedule, send multipart form fields channel=Call, occurred_at=an actual past or current ISO timestamp, notes=the outcome, complete_scheduled_date=2026-10-26, and optionally next_follow_up_date=2026-10-29 and one attachment file. The actual event time cannot be in the future relative to submission.

### Archive an inactive enquiry

```text
PUT /api/v1/leads/101
{"status":"Archived",
 "archive_reason":"Customer postponed the project",
 "update_source":"Details"}
```

### Workbook example

Customer / Company Name: Example Trading; Type: B2B; Phone / WhatsApp: 0502029780; Service: an existing active service name; Source: Meta Ads; Status: Follow-up; Assigned Staff: the unique employee email; Next Follow-up: 2026-10-26; Added On: 2026-10-22; Notes: Waiting for their plan.

The template does not accept a list of historic completed activities in this row. Those need a separately specified migration or activity-import feature.

## Acceptance criteria for another application

Use these scenarios as a development and demonstration checklist. “Current” behavior and the recommended decisions in the following section should be reconciled before treating this as a signed implementation specification.

| Scenario | Expected result |
| --- | --- |
| Create Person and Company leads | Correct display names and B2C/B2B tags; no automatic customer or service record. |
| Select an existing customer | Link the accessible customer and prefill contact details; retain a distinct enquiry. |
| Use a list-only role | Show permitted summary rows; reject detail/history/file access outside detail scope. |
| Use assigned-only access | Only matching assigned records appear; unassigned or foreign-workspace records do not leak. |
| Schedule without a date | Reject; no partially changed stage or completed-activity count. |
| Complete without another date | Save exactly one activity, clear schedule and move to Qualified. |
| Complete with another date | Save one activity and replace the pending schedule without resetting earlier milestones. |
| Complete an outdated schedule | Return a conflict; preserve the newer schedule and avoid a duplicate activity. |
| Log invalid activity or file | Reject future event time, blank notes, unsupported channel, oversized file or signature mismatch. |
| Archive and reopen | Require a reason, disable new activities while archived, preserve old reasons/history and permit controlled reopening. |
| Send and revise a quotation | Show Quote Sent from real sent markers; editing a quote clears only its marker; lead stage stays independent. |
| Preview a workbook with any error | Report rows and save nothing. Confirm reparses and revalidates the file. |
| Import duplicate normalized phones | Reject duplicates except the documented 0000 placeholder exception. |
| Download filtered Excel | Export the permitted filtered set, not just one page; protected details stay protected. |
| Click WhatsApp | Open the external channel and increment a click count; do not record delivery or a completed contact. |
| Delete a customer-linked lead | Reject. Prefer archive for routine closure rather than deletion. |

## Current gaps and recommended design decisions

These findings come from the reviewed implementation. They are included so another builder does not reproduce accidental constraints or assume that an earlier discussion is already an implemented feature.

| Observed condition | Recommended decision before rebuilding |
| --- | --- |
| Customer conversion requires Won, but normal stage updates do not allow Won. | Choose a clear success event: add a validated Won state or an explicit Convert to customer action. Keep conversion transactional and define duplicate resolution. |
| Legacy Won and Lost are presented as Qualified. | Define a migration map. Do not silently treat a historical loss as a qualified opportunity in new analytics. |
| UAE mobile normalization is stronger in import than in manual entry. | Use one shared normalization/validation policy and show unsupported numbers for correction before WhatsApp actions. |
| Duplicate-phone protection is importer-specific. | Define opportunity-level duplication: warn, block or allow multiple enquiries per phone with a shared contact/customer. |
| Sources are a fixed form list, while import can preserve arbitrary text. | Use a workspace source master if configurable categories are required. Do not describe the current form as a fully managed source catalog. |
| Stage history is not a complete field-edit audit. | Add an audit trail for assignment, contact fields, notes and important changes if accountability requires it. |
| Follow-up submission checks the pending date but has no general request idempotency key. | Add request identifiers to prevent accidental duplicate activity submissions after network retries. |
| One pending date per lead; no arbitrary task list or automated outreach. | Decide if multiple reminders, task owners, email/SMS delivery or escalation are separate future features. |
| Standard import does not restore activities; custom migration skips blank follow-up cells. | Specify historical completeness separately. Retain original values and label estimated dates/methods. |
| Hardcoded lead-page trend percentages and a nonpaged all-leads list API. | Calculate real period comparisons and conversion metrics; add server-side pagination, search and filters for scale. |

Do not automatically mark a lead successful just because a quote was sent, a user clicked WhatsApp, a follow-up was logged or a customer link exists. Define each business success condition explicitly.

## Operating examples and source evidence

### Example enquiry through a quotation

A salesperson captures Example Trading as a Company lead from Meta Ads and assigns responsibility. The lead is contacted and qualified. A call outcome is logged, then a date is scheduled. A quotation is prepared from the lead and marked Sent. The lead can remain in Follow-up with a Quote Sent badge. On the due date, staff log the conversation and either schedule the next action or return to Qualified. No payment or operational job is implied by these actions.

### Example enquiry that becomes inactive

The prospect asks to wait for its business plan. Record Waiting for their plan as a note and schedule a follow-up if an action date is agreed. If pursuit is stopped, archive with a reason. Keep the activities and quotation history. Reopen through an active stage before logging another contact.

### Example customer handoff

An existing customer can be linked during lead creation. For a new prospect, the reviewed application needs the conversion gap resolved before a normal mark-won flow can be relied upon. In the replacement, deliberately link or create the customer, choose its salesperson and start service work through the customer workflow. Preserve the original lead so the acquisition history remains available.

### Implementation evidence reviewed

| Source area | Files or components |
| --- | --- |
| Lead API and rules | backend/controllers/lead.controller.js; backend/routes/lead.routes.js |
| Lead record and history | backend/models/Lead.js; LeadFollowUp.js; LeadStatusHistory.js; models/index.js |
| Lead screens | frontend/pages/leads/index.vue; frontend/pages/leads/[id].vue; components/leads/LeadDialog.vue; LeadFollowUpAction.vue |
| Spreadsheet behavior | backend/utils/leadExcelImport.js; frontend/components/leads/LeadImportDialog.vue; separate historical migration script reviewed |
| Permissions and ownership | backend/utils/permissionRules.js; recordAccess.js; businessOwnership.js; routes/record-assignments.routes.js |
| Linked modules | quotation.controller.js; dashboard-template.controller.js; utils/dashboardTemplates.js; customerSalesperson.js; commissionEngine.js |
| Supporting documentation | docs/QUOTATIONS.md; docs/BUSINESS-RECORD-PERMISSIONS.md; docs/COMMISSIONS.md |

Review method: source inspection of the current workspace and existing feature documentation. This guide is not a new runtime audit or a claim that every acceptance scenario was executed during document preparation. No application code, live lead data or permissions were changed to produce it.
