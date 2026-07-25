# BAK-002: Email — SMTP, Templates, Reset & Verify

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BAK-002 |
| **Phase** | Phase 22 — Production Backend (Revival Track H) |
| **Tier** | 1 — credibility |
| **Priority** | 🟠 High (password reset is table stakes; WF-004 ships it as a 501) |
| **Difficulty** | 🟢 Low–Medium |
| **Estimated Time** | 1–2 weeks |
| **Prerequisites** | WF-004 (sessions/users routes exist); BAK-004 consumes this for magic links |
| **Branch** | `task/bak-002-email-subsystem` |
| **Recommended executor** | 🟢 **Sonnet 5** — the design is specified here; nodemailer + two token flows + templates is known-shape work with mechanically verifiable success. |

## Objective

Give `nodegx-backend` an email subsystem: SMTP configuration per backend, a small template system, and the two flows every real app needs — password reset and email verification — un-501ing the endpoints WF-004 stubs, plus a Send Email node for workflows.

## Background

WF-004's wire-protocol section explicitly defers `requestPasswordReset` and email-verify to 501s. That is the right v1 call and the wrong place to stop: "forgot password" is the feature whose absence most loudly says *toy*. For a self-hosted product the scope is genuinely small — we do not run a mail service, we speak SMTP to whatever the operator configures (their provider, their Mailgun/SES/Postmark SMTP endpoint, their own postfix). Deliverability is the operator's domain, exactly as with Pocketbase.

The same subsystem is load-bearing for later work: BAK-004's magic links are an email flow, and WF-002's node family wants a Send Email node — automations that can't notify anyone are half-automations.

## Current State

- No mail dependency anywhere in the monorepo; no SMTP config surface.
- `/requestPasswordReset` and email-verification endpoints: 501 per WF-004 (verify as-built).
- The Parse-wire clients (`userservice.ts`) already call password-reset endpoints; the two endpoints the legacy client scrapes as HTML keep their shape (WF-004 wire map) — this task must serve those shapes for real.
- Backend config persistence (`~/.noodl/backends/<id>/`) exists and deploys with the backend — the natural home for SMTP settings.

## Desired State

- **SMTP config** in backend config: host, port, security (STARTTLS/TLS), username, password, from-address, from-name, and a public **base URL** setting (the deployed origin used to build links in emails — coordinate: BAK-004 needs the same setting for OAuth redirects; define it once, here).
- Secrets at rest: SMTP password stored in the backend's config with the same protection level as WF-005's webhook secrets — one shared secrets convention, not two (record the convention; full at-rest encryption is not claimed).
- **Editor UX**: an Email section in the Backend Services panel (one-panel constraint): config form + "Send test email" button with loud success/failure.
- **Flows:**
  - *Password reset*: `POST /requestPasswordReset` → single-use, time-limited token (hashed at rest) → email with link to a minimal service-served page → new password → sessions invalidated. Responds identically whether or not the address exists (no account enumeration).
  - *Email verification*: on signup (opt-in per backend), `emailVerified` on the user record, verification link, re-request endpoint, and a per-backend policy toggle: unverified users may / may not log in.
- **Templates**: subject + text + HTML bodies with `{{variable}}` interpolation; sensible defaults shipped; per-backend overrides editable in the panel; template set enumerable/editable via MCP.
- **Send Email node** (WF-002 family): to/subject/body(+template ref) in, sent/failed out — server-side only, catalog entry included, execution-record integration via WF-006.
- **Loud failure doctrine**: no SMTP configured → flows and node fail with an explicit "email not configured" error into execution records and the panel status; **no silent drop, and no queue pretending otherwise** — sends are synchronous with one documented retry.

## Scope

### In Scope
- [ ] nodemailer (or equally boring, maintained equivalent) in `nodegx-backend` only
- [ ] SMTP + base-URL config, secrets convention shared with WF-005, panel section + test send
- [ ] Password-reset flow end-to-end incl. the service-served reset page and session invalidation
- [ ] Email-verification flow + per-backend login policy toggle
- [ ] Template system with defaults, overrides, MCP surface
- [ ] Send Email node + catalog entry + execution records
- [ ] Anti-enumeration and token-hygiene tests (single-use, expiry, hash-at-rest)
- [ ] Rate limiting on the two public endpoints (simple fixed-window here; BAK-009 generalizes)
- [ ] Docs: SMTP setup for the common providers, deliverability honesty (SPF/DKIM are your provider's job)

### Out of Scope
- Running/embedding a mail server; queues; bounce/complaint webhooks
- Marketing/bulk email of any kind
- Magic-link *login* (BAK-004 — it reuses this plumbing)
- Rich template editor UI (a textarea with variables is v1)
- Local mail-capture dev server (nice-to-have; note it, don't build it)

## Implementation Steps

1. **Config + secrets convention** (with WF-005 alignment) + panel section + test send.
2. **Token infrastructure** shared by both flows: issue, hash, expire, consume-once.
3. **Password reset** end-to-end, matching the wire shapes the clients already call.
4. **Verification** + policy toggle enforced at login.
5. **Templates** + defaults + MCP.
6. **Send Email node** + catalog + WF-006 records.
7. **Tests + docs.**

## Success Criteria

- [ ] On a deployed backend with real SMTP config, a user completes forgot-password → email → new password → old sessions dead, driven from the stock login nodes
- [ ] Signup with verification on: user receives mail, verifies, `emailVerified` flips; policy toggle blocks/permits unverified login as configured
- [ ] Reset requests for unknown addresses are indistinguishable from known ones, and both endpoints are rate-limited
- [ ] A workflow sends email via the node; the send appears in the History Panel; with SMTP unconfigured the same workflow fails loudly with an actionable message
- [ ] Templates overridable per backend and enumerable via MCP
- [ ] All token-hygiene tests green

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Reset endpoint used for account enumeration or mail-bombing | Uniform responses + rate limits are scope items with tests |
| Links built from the wrong origin behind proxies | The explicit base-URL setting is the single source; test-send surfaces a wrong value immediately |
| Secrets sprawl (SMTP here, webhook secrets there, OAuth later) | One recorded convention defined in this task; BAK-004 and WF-005 reference it |
| Sends block request handling | Async send with bounded timeout; the flows tolerate slow SMTP without wedging the service |
| HTML email rendering rabbit hole | Ship plain-but-decent defaults; overrides are the escape hatch, not a template designer |

## References

- [WF-004](../phase-19-cloud-workflows/WF-004-BACKEND-SERVICE.md) — wire shapes, the 501s this replaces, config persistence
- [WF-005](../phase-19-cloud-workflows/WF-005-TRIGGERS.md) — the secrets convention to share
- [WF-006](../phase-19-cloud-workflows/WF-006-OBSERVABILITY-WIRING.md) — execution records for the node
- `packages/noodl-runtime` `userservice.ts` — the client calls whose shapes are the contract

## Checklist

- [ ] Config, secrets convention, panel UX, test send
- [ ] Reset + verification flows with hygiene tests
- [ ] Templates + MCP; Send Email node + catalog
- [ ] Rate limits; docs; CHANGELOG
