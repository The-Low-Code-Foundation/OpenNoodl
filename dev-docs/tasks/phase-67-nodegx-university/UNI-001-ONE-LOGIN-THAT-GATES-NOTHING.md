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

- ✅ **AC2's LAUNCHER affordance — BUILT 2026-08-18 (session 33). See the section below.** The
  sign-in also lives in the composer, because the alpha bar's sentence is *"ask a question about
  a node from inside the editor"* and sending somebody off to find a launcher card mid-question
  is asking them to abandon what they were doing. Neither surface substitutes for the other.
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

---

# ✅ AC2 — THE LAUNCHER CARD AND THE CHIP. 2026-08-18, session 33.

**Driven, not just specced:** the card was rendered in a real editor, a session was written and
read back, sign-out was clicked, and the store file was watched disappear. What could *not* be
driven is the happy path — E2 serves nothing at `community.nodegx.io` and E10 has no OAuth App —
so what a click produces today is the failure branch, verbatim: *"The community could not be
reached (TypeError: Failed to fetch)."* 🔴 **That is the correct behaviour of a launcher pointed at
an undeployed platform, and it is E2/E10's line item, not this task's.**

## What is built, and where

| File | What |
|---|---|
| `noodl-core-ui/src/constants/communityCopy.ts` | 🔴 **D2's string, once.** `COMMUNITY_SIGN_IN_LABEL`, the sign-out label, and the sentence below. `constants/externalLinks.ts` is the precedent for a dependency-free constants module both packages can reach |
| `…/Launcher/components/CommunityAccountCard/` | the card: signed-out offer, the eight-character code while waiting, the chip + **Sign out** when signed in, an error line that never becomes a dead end |
| `…/Launcher/LauncherContext.tsx` · `Launcher.tsx` · `views/Projects.tsx` | `community?: CommunityAccountHostState` threaded through, and the card rendered beside `ConnectAgentCard` in both the welcome and the with-projects arms |
| `noodl-editor/…/ProjectsPage/useCommunityAccount.ts` | the host half — reads the store, runs the device flow through `platform.openExternal`, cancels on unmount, signs out |
| `ProjectsPage.tsx` | one hook call, one prop |
| `tests-unit/uni-001/launcher-offers-signin.test.ts` | 20 assertions, source-analysis with negative controls, in the shape `composer-offers-signin.test.ts` set |

## 🔴 THE PRINCIPLE IS RENDERED, NOT ASSUMED

`COMMUNITY_GATES_NOTHING` — *"Everything in the editor works without an account, and always
will."* — is **on the card**. The launcher is the single most likely place in the whole editor for
a new user to conclude that the thing they downloaded is gated, and the phase's first principle is
worth nothing if the one surface that implies the opposite does not say it out loud. The spec
asserts the constant is *rendered*, not merely defined: a constant nobody places says nothing to
anybody.

## What the drive showed

| Step | Observed |
|---|---|
| Launcher, signed out | `[data-test=community-account-card]` present, button reads **Sign in to NodeGX**, the gates-nothing sentence renders |
| A session written to the store, renderer reloaded | chip renders `NB / @nia-builds / Signed in to the NodeGX community`; the sign-in button is gone |
| **Sign out** clicked | chip gone, offer back, **and the store file deleted** — AC2's *"sign-out wipes it"*, end to end |
| **Sign in** clicked | the real device flow ran and reported the unreachable platform in the card's error line, button still live |

## ✅ AND THEN THE HAPPY PATH, END TO END, ON LOCALHOST

**Same session, after Richard clicked the button and got the unreachable-platform message.** With
`COMMUNITY_URL` pointed at a local `next start` for four minutes: **Sign in to NodeGX** clicked in
the real launcher → the card rendered a live device code → approved over HTTP as `@nia` with a
seeded dev cookie → **the editor's own poll redeemed a real platform-minted token, persisted it to
the store, and rendered the chip** (`@nia-new`). The three routes ran in the order the flow
specifies: `POST /api/v1/auth/device` → `/approve` → `/token`.

🔴 **So the only thing between a stranger and an account is E10 then E2.** Every route exists, the
editor calls them correctly, and the token round-trips into the store the launcher reads. ⚠️ The
pointer change was **reverted in the same session** and `git status` is clean on
`communityorigin.ts` — a localhost origin must never be committed.

⚠️ **What this still does not prove:** the GitHub half. `/api/auth/github/start` answers 503, so
the browser sign-in that normally precedes an approval was replaced by a seeded dev session. E9's
smoke drive on the deployed box is still the only thing that closes that.

⚠️ **"Survives a restart" was driven as a renderer RELOAD, not a process restart.** The read path is
the same one and the store is a file on disk, so it survives by construction — but the stronger
claim is not what was measured, and is written down that way rather than rounded up.

## 🔴 FINDING A — THE STORE IS A FILE IN `userData`, NOT `localStorage`, AND THE MODULE SAID OTHERWISE

`communitysession.ts` carried a long, careful security note whose first sentence was **wrong**:
*"THE STORE IS `JSONStorage`, WHICH IS `localStorage` IN THE RENDERER."* It is not.
`@noodl/platform-electron` calls `setStorage(new StorageNode())` at import, and `StorageNode`
writes `<userData>/<key>.json`. Measured, not reasoned: the session lands in
`~/Library/Application Support/NodeGX/nodegx.community.session.json`, and sign-out removes that
file.

✅ The conclusion survived the correction — a plaintext file readable by any process running as
this user is still the wrong home for a credential of value — **but the reasoning had to be redone
to know that**, which is the whole reason a wrong premise in a right-sounding note is expensive.

⚠️ **And the scope's `0600` is not true.** UNI-001 says the token is stored *"in `<userData>`
(0600, the relay-token precedent from OBS-004)"*. `StorageNode` writes with the process umask like
every other file it writes. Recorded as a gap rather than fixed inside a launcher task: narrowing
it means changing `StorageNode` for all of its callers, which is a decision about the platform
layer.

## 🔴 FINDING B — E1's OWN RENAME LEFT `test:main` RED FOR A DAY, AND THE HANDOVER SAID IT WAS RUN

The baseline taken **before any edit this session** was **3 failed / 3786 passed / 3789 total across
247 suites**, not green. Two of the three were `uni-016/composer-sends-what-it-shows.test.ts`
asserting `platform.openExternal(COMMUNITY_URL)` — and session 29, moving the constant into
`communityorigin.ts`, had imported it as `COMMUNITY_URL as COMMUNITY_ORIGIN`. The call site
still opens the community; the **instrument** could no longer see it, and its negative control
threw on a `replace` that matched nothing.

🔴 **The handover said *"`test:main` was re-run this session"* and quoted no number.** A suite
reported by name rather than by count is a suite nobody can check, and this one had been red since
the moment it was written about. ✅ **Quote the count or do not claim the run.**

✅ Fixed by dropping the alias — one name for one thing in that file — rather than by teaching the
spec the alias, which would have left the next rename to break it again. The third failure,
`cn-002/unknown-type-check-skipped.test.ts`, is phase 69's and is untouched: it was red in the
before-measurement too.

## ⚠️ FINDING C — THE HEADER AVATAR BELONGS TO GITHUB, AND THE CHIP DELIBERATELY DOES NOT GO THERE

The launcher header already draws an avatar, and it is the **GitHub OAuth** identity used for repo
cloning. There are now two identities in this editor with no relationship to each other, and one
round avatar in the top-right. Putting the community handle there would make *"whose face is
that?"* an unanswerable question, so the chip lives on the card with the sign-out beside it. 🔴 If
a later task wants identity in the header, it has to decide which identity the header is about —
that is a design decision, not a placement.

## What AC2 still does not close

- **AC4's grep still needs a verdict rather than a run** — unchanged from session 29, and now
  there is a second legitimate reader (the launcher hook) inside *"the launcher/account module"*
  the criterion names, which arguably makes the wording easier to settle rather than harder.
- **The happy path is unproven end to end.** E10 (no OAuth App) then E2 (nothing deployed), in
  that order. The device flow's own half is specced in `communitysignin.test.ts`; what nothing in
  either repository can substitute for is E9's smoke drive on the deployed box.

## Not in v1

Org SSO (UNI-005), the analytics pipeline (only the toggle, if D11 says so), profile editing
(UNI-003), any editor feature keyed to the account.
