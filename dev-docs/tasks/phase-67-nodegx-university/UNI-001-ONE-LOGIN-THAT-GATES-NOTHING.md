# UNI-001 — one login that gates nothing

**Surface:** platform + editor · **Tier 1** · **Effort:** M/L · ✅ **UNBLOCKED — D1, D2 and D11 all ruled 2026-08-14**

> **What the rulings fix here** ([RULINGS.md](RULINGS.md)):
> - **D2** — the site is **NodeGX Community** at `community.nodegx.io`; the editor's button reads
>   **"Sign in to NodeGX"**. 🔴 One string, one owner — the FUN-001 shape applies: four surfaces
>   disagreeing about one piece of copy is worse than blank. Do not reinvent it per surface.
> - **D11** — the consent screen carries **"Share anonymous usage data", unchecked by default**,
>   scoped in the string itself as *which nodes people ask about, never project content*. 🔴 For
>   **org-minor accounts the row is not rendered at all** — absent, not shown-and-off (D10
>   obligation 3).
> - **D1** — Next.js + Postgres + Drizzle, Docker on Hetzner. ⚠️ The repo must be renamed
>   `nodegx-university` → **`nodegx-community`** before any Pages deploy.

## Premise

Every dream in this phase — points, profiles, RFPs, orgs, lessons, hosting — needs one thing
first: a NodeGX account, and a way for the editor to hold a session for it. This task is the
spine. It is also where the phase's first principle is enforced in code and in review: **the
editor is fully functional signed out, forever.** The sign-in adds surfaces; it never subtracts.

## Scope (v1)

**Platform:**
- Account model: email + OAuth (GitHub at minimum — it doubles as the org hookup's identity
  rail later, R5). Sessions, password reset, account deletion (GDPR baseline from day one).
> 🔴 **AMENDED 2026-08-18 by D19 — the OIDC face lost its only consumer.** The bullet below
> justifies it with *"Discourse SSO in UNI-009"*, and there is no Discourse. **Do not build a
> provider face speculatively**: plain sessions are the whole requirement now, and the *issuer* is
> what is still missing. ⚠️ **Two pieces of the SSO design are gone with it, not deferred** — a
> browser handoff ticket (so the editor did not force a second login) and an admin log-out call
> (so sign-out killed both sessions). Neither has a referent any more.

- An OAuth2/OIDC provider face of our own, so *other* surfaces (Discourse SSO in UNI-009, the
  editor itself) authenticate against the NodeGX account rather than each growing a login.
- The consent screen: what signing in from the editor shares (account identity; nothing else by
  default). If D11 rules the analytics toggle in, it lives here, **off by default**.

**Editor (this repo):**
- A sign-in affordance in the launcher (a card or menu item) using the system browser for the
  OAuth dance — no embedded webview credential entry. Token stored in `<userData>` (0600, the
  relay-token precedent from OBS-004).
- A signed-in state chip (avatar/name) and sign-out. **Nothing else changes.** No panel, node,
  export, or template checks the session.
- All platform traffic is editor-outbound HTTPS to the platform API. No listener is opened.

## Acceptance criteria

1. A fresh editor with no account, and an editor whose token was revoked server-side, behave
   identically to today's editor in every existing test — the full `test:main`/`test:ci`
   baseline is the regression gate for "gates nothing".
2. Sign in from the launcher via system browser; the chip shows the account; the token survives
   an editor restart; sign-out wipes it.
3. Account deletion on the platform cascades (sessions, ledger rows, profile) — proven by a spec,
   not a promise.
4. `grep` the editor for reads of the session outside the launcher/account module comes back
   empty — the "gates nothing" principle is structurally visible.

## Not in v1

Org SSO (UNI-005), the analytics pipeline (only the toggle, if D11 says so), profile editing
(UNI-003), any editor feature keyed to the account.
