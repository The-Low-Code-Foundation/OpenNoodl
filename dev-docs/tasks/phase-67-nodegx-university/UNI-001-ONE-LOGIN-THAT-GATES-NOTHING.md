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

---

# ✅ E1 — THE ISSUER IS BUILT. 2026-08-19, session 29.

**The bottleneck the alpha bar named as item one is gone.** Before this session the only
`insert into sessions` statements in the whole platform repository were **in test files**
(measured twice, sessions 28 and 29), so `readCommunitySession()` returned `null` for every
human being alive and nothing UNI-015/016 built was reachable by a real person.

## What is built, and where

**Platform (`nodegx-community`):**

| File | What |
|---|---|
| `src/lib/session.ts` | 🔴 **the mint.** `createSession` / `revokeSession` / `revokeAllSessions`, the cookie builders, a 30-day TTL. Composable inside a caller's transaction (no nested `begin`) |
| `src/lib/site.ts` | `SITE_ORIGIN`, `originIsSecure()` (derived from the SCHEME, never `NODE_ENV`), and `safeReturnPath()` |
| `src/lib/githuboauth.ts` | the GitHub client — authorize URL, and a code exchange that is an **injected function type** |
| `src/lib/signin.ts` | an OAuth identity → an account. Handle derivation and collision walk; the email rule |
| `src/lib/signin-http.ts` | start / callback / sign-out as plain functions, so a spec drives the same code the route runs |
| `src/lib/devicepairing.ts` | the device flow — begin / approve / redeem |
| `src/db/sql/0010_…` | `device_authorizations`, two CHECK constraints, and the argument for the shape |
| 6 routes | `/api/auth/github/{start,callback}`, `/api/auth/signout`, `/api/v1/auth/device{,/approve,/token}` |
| `src/app/auth/device/` | the page a person types the eight characters into |
| `src/app/layout.tsx` | 🔴 the header's sign-in button **is no longer inert**, and the signed-in chip is real |

**Editor (this repo):**

| File | What |
|---|---|
| `models/community/communityorigin.ts` | 🔴 `COMMUNITY_URL` **moved out of the dialog**. A constant exported from a *view* is one a *model* cannot import |
| `models/community/communitysession.ts` | gained `writeCommunitySession` / `clearCommunitySession`. Still the ONLY place that key is touched |
| `models/community/communitysignin.ts` | the device dance and `signOutOfCommunity`. Everything external injected |
| `AskAboutNodeDialog.tsx` | a **Sign in to NodeGX** affordance on the signed-out branch, the code shown while waiting, and cancellation on unmount |

## 🔴 THREE DECISIONS THAT WERE FORCED, NOT CHOSEN — do not re-litigate them cheaply

1. **The device flow, not a loopback listener and not a `nodegx://` handler.** Two sentences in
   this task's own scope eliminate both: *"no listener is opened"* kills the loopback redirect,
   and a protocol handler is one an OS registration makes ambiguous between a dev build, a
   portable build and a second install — handing a live credential to whichever copy won.
   ⚠️ **This is NOT D19's struck "browser handoff ticket" returning.** That one handed an editor
   session to *Discourse*; there is no Discourse and no second system. This is the first
   hand-off, from a browser to the editor, and it is the only way the editor gets a token.
2. **GitHub only. No email/password.** The scope asks for *"email + OAuth"* and *"password
   reset"* — and **nothing on this platform sends mail** (E6, and D19 was ruled *on the condition*
   that this changes). A password flow whose reset arm cannot be delivered locks people out, so
   it waits for E6 rather than shipping half. `accounts` grew no `password_hash` column.
3. **No OIDC provider face.** D19 struck it and this task's own amendment says *"do not build a
   provider face speculatively."* What is built is the opposite direction: we are the client.

## ⚠️ WHAT E1 DOES NOT CLOSE

- 🔴 **AC2's LAUNCHER affordance is not built.** The sign-in lives in the composer, because the
  alpha bar's sentence is *"ask a question about a node from inside the editor"* and sending
  somebody off to find a launcher card mid-question is asking them to abandon what they were
  doing. **The launcher card and the signed-in chip are still owed**, and AC2 does not close
  until they exist.
- 🔴 **NOBODY CAN ACTUALLY SIGN IN YET, and it is one form away.** `githubOAuthConfig()` returns
  `null` without `GITHUB_OAUTH_CLIENT_ID`/`_SECRET`, and the start route then answers **503 with
  a plain sentence** rather than redirecting into a provider error page. Creating the OAuth App
  is Richard's — see the ask added to the phase README. It is free and takes a minute; it is a
  **credential**, not a design question.
- ⚠️ **AC4's grep is not re-run.** *"Reads of the session outside the launcher/account module
  come back empty"* — the composer now reads it, which was already true before this session
  (UNI-016 put it there) and is arguably what the criterion means to permit. **The criterion
  needs re-wording or a verdict**, and pretending it passed would be worse than saying so.
- **AC1's regression gate** — the full `test:main`/`test:ci` baseline — is the standing claim
  that signing in *gates nothing*. `test:main` was re-run this session; **`test:ci` was not**.

## Not in v1

Org SSO (UNI-005), the analytics pipeline (only the toggle, if D11 says so), profile editing
(UNI-003), any editor feature keyed to the account.
