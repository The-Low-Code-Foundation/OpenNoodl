# TPL-002 — "Tell me when something is posted"

**Adds email notifications to [TPL-001](TPL-001-THE-MEMBERS-AREA.md).** Richard, 2026-08-28:
*"Users receive notifications by email if they opt in for that when new content is added."*

Split from TPL-001 on purpose: this half depends on SMTP credentials the template **cannot ship**
(§2), and the shelf's first row must not wait on an external dependency.

## 1. The person sentence

**A member ticks one box in their account and gets an email when the secretary posts an
announcement — and can untick it, from the email itself, without asking anyone.**

## 2. 🔴 The dependency the template cannot carry

Email is real here and does not need building: `nodegx-backend/src/email/Mailer.ts` (BAK-002)
speaks SMTP via nodemailer, and the **Send Email node** reaches it from a cloud function through
`_noodl_send_email` (`service.ts:541`).

What it needs is configuration that lives **in the backend, not the project**:

- `email.json` in the backend data dir — host, port, secure, username, from-address.
- `secrets.json`, `email` namespace, `smtpPassword` — through the product's **Secrets panel**;
  writing that file by hand is blocked, and the panel is the flow a person uses anyway (P77 s4b
  provisioned `SITE_SETUP_TOKEN` exactly this way).

Neither is a project file, and `shareAsTemplate` strips secrets by rule — *"a template that
carried one would publish it."* **So on a fresh install this feature is inert, and that is
correct.** What is not correct is being inert *silently*.

## 3. 🔴 The AC this task exists for

**An admin who posts an announcement on a backend with no SMTP configured is told so, in a
sentence, at the moment they post.** Not a silent no-op, not a spinner, not an error in a log
nobody reads.

This is SBR-002's finding applied one layer up: the site builder's no-backend deadline *never
spoke*, and only a drive found it — the specs could not. Grade this with the negative control
beside it: configured ⇒ the mail sends and the sentence does not appear; unconfigured ⇒ the
sentence appears and nothing is queued.

## 4. Scope

- **Opt-in on the account page.** 🔴 **Default off.** These are charities and congregations in
  the UK and EU; consent is opt-in, and a template that ships opt-out teaches every one of them
  to break the law on their first day.
- **A fan-out on publish** — a cloud function that reads the opted-in, **approved** members and
  sends one email each. Pending and declined members are not members (TPL-001 AC3's rule, same
  bug, new surface).
- **An unsubscribe link in every email** that works without signing in, and flips the same flag
  the account page does. One writer, one flag.
- **The admin sees what happened** — "sent to 24 members", or the §3 sentence.

## 5. Acceptance criteria

1. **(person)** Member ticks the box, admin posts, member receives the email. Driven against a
   captured transport, not a real inbox.
2. **(person)** A member who has **not** ticked it receives nothing — the negative control run in
   the same send as AC1, so "nothing sent at all" cannot pass as a green.
3. **(person)** §3 — unconfigured SMTP says so at post time, with the configured case as control.
4. **(person)** The unsubscribe link works signed out, and the account page then shows the box
   unticked — the two surfaces read one flag.
5. A pending member who opted in before approval receives nothing.
6. A send failure for one recipient does not lose the announcement or stop the other 23 —
   `Mailer.send` resolves rather than rejects, and the fan-out must not undo that.

## 6. Traps

- 🔴 **A signal into a value port arrives once as `false`** — "sent" and "opted in" are both that
  shape; an `=== true` guard never fires (SBR-002).
- 🔴 **The opt-in flag is user-writable data.** A member must be able to change their own row and
  nobody else's — this is the one place in the template where a member has write access, so it is
  the one place row-level ACL is actually load-bearing rather than table-level.
- 🔴 **Email addresses are the most sensitive thing this app holds.** The fan-out must not leak
  the member list — no `to:` with 24 addresses in it.
- 🔴 A **shipped** `email.json` with a plausible-looking host would make every install try to send
  through somebody else's server. Ship no email config at all.
