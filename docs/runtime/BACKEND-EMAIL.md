# Email for the local backend

The standalone NodeGX backend (`nodegx-backend`) can send email: password
reset, email verification, and arbitrary application notifications from a
workflow via the **Send Email** node. NodeGX does not run a mail service — it
speaks SMTP to whatever you configure (your provider's SMTP endpoint, or your
own mail server), exactly like Pocketbase. The full design record is
[`dev-docs/tasks/phase-22-production-backend/BAK-002-EMAIL-SUBSYSTEM.md`](../../dev-docs/tasks/phase-22-production-backend/BAK-002-EMAIL-SUBSYSTEM.md).

## The one thing you must know

**With no SMTP configured, email-dependent flows fail loudly, not silently.**
The password-reset and verification-request endpoints still answer success (so
they can't be used to enumerate accounts) but nothing is sent — the failure is
logged server-side. The **Send Email node** and the panel's **Send test email**
button, in contrast, are admin-authenticated surfaces and report the exact
reason ("Email is not configured for this backend: no SMTP host/port set…")
so you notice the misconfiguration immediately, in the History Panel or the
panel itself. There is no queue and no retry-forever — one documented retry,
then an honest failure.

## Setting it up

In the editor: **Backend Services → (your local backend) → Email**.

| Field | What it is |
|-------|------------|
| Host / Port / Security | Your SMTP endpoint. STARTTLS/plaintext is typically 587 or 25; implicit TLS is typically 465. |
| Username / Password | Your SMTP credential. The password is stored in `<dataDir>/secrets.json` (mode 0600, plaintext — see "Secrets" below) and is never echoed back by any read surface (panel, MCP, or the HTTP API). |
| From address / name | What recipients see. |
| Base URL | **The backend's deployed origin**, e.g. `https://api.yourapp.com` — used to build the links in reset/verify emails. This is the ONE canonical base-URL setting for the backend; a later magic-link/OAuth feature reuses this same field rather than adding a second one. Leave it blank during local development and the backend falls back to `http://127.0.0.1:<port>` (a warning surfaces on test-send so you don't ship a broken link by accident). |
| Enabled | Master on/off switch, separate from having the fields filled in — lets you finish setup before flows start firing for real. |

Click **Send test email** after saving — it either succeeds or tells you
exactly why not.

### Common providers

Any SMTP-speaking provider works. A few common ones:

| Provider | Host | Port | Notes |
|----------|------|------|-------|
| Mailgun | `smtp.mailgun.org` | 587 | Username is the SMTP login from your domain's Mailgun settings, not your account email. |
| Amazon SES | `email-smtp.<region>.amazonaws.com` | 587 | Use SMTP credentials (not IAM keys) generated in the SES console. |
| Postmark | `smtp.postmarkapp.com` | 587 | Username and password are both your Server API Token. |
| Your own postfix/exim | your host | 25/587 | Whatever your server requires. |

**Deliverability (SPF, DKIM, sender reputation) is your provider's
responsibility, not NodeGX's** — set those up with whichever provider you
choose, the same way you would for any app.

## Password reset and email verification

Both flows are automatic once SMTP is configured — the stock login/signup
nodes call the same endpoints they always have (`requestPasswordReset`,
`verificationEmailRequest`); nothing changes in your project's graph.

- **Password reset**: a user requests a reset by email; they get a link to a
  minimal page the backend itself serves (no separate app needed) to set a new
  password. The reset token is single-use, expires in 1 hour, and is hashed at
  rest — never stored in plaintext. Every existing session for that user is
  invalidated the moment the password changes.
- **Email verification**: opt-in per backend (the "Send a verification email
  on signup" toggle). Turning on "Block login until the user's email is
  verified" enforces it; leave it off to just track `emailVerified` without
  gating login.

Both public endpoints (`/requestPasswordReset`, `/verificationEmailRequest`)
are rate-limited (a simple fixed window — 5 requests / 15 minutes per client
address) and answer identically whether or not the address exists, so they
cannot be used to check who has an account.

## Templates

Two templates ship with sensible defaults: **Password Reset** and **Verify
Email**. Edit them in the panel's Templates section (or via MCP —
`list_backend_email_templates` / `set_backend_email_template` /
`reset_backend_email_template`) using `{{variable}}` interpolation:

- Password Reset: `{{appName}}`, `{{username}}`, `{{resetUrl}}`, `{{expiresIn}}`
- Verify Email: `{{appName}}`, `{{username}}`, `{{verifyUrl}}`

A blank field falls back to the shipped default — you only need to override
what you want to change. This is intentionally a textarea, not a rich
template designer; that's out of scope for v1.

## The Send Email node

A server-side-only node (it lives in the "Cloud" category alongside Request
and Response) for sending your own application email from a cloud
function/workflow — order confirmations, alerts, anything beyond the built-in
reset/verify flows. Wire `to`/`subject`/`text`/`html` directly, or set
`template` to reuse one of the two built-in templates against your own
variables. `sent`/`failed` report the outcome, and every call shows up in the
**History Panel** like any other function execution — including a failed one,
with the actual reason, when SMTP isn't configured.

## Secrets

The SMTP password lives in `<dataDir>/secrets.json` alongside the backend's
admin credential, under an `email` key: `{ "adminToken": "…", "email": {
"smtpPassword": "…" } }`. The file is mode 0600 and plaintext — no at-rest
encryption is claimed, matching the admin credential's existing protection
level. This is the one shared secrets convention for the backend; anything
else that needs a secret (a future webhook signing secret, for instance)
belongs in this same file under its own key, not a second file.

## Out of scope (for now)

- Running or embedding a mail server, queues, or bounce/complaint webhooks
- Marketing/bulk email
- Magic-link login (reuses this plumbing, but is its own feature)
- A local mail-capture dev server (nice-to-have; use a real SMTP sandbox
  provider — e.g. Mailtrap, Ethereal — for local testing in the meantime)
