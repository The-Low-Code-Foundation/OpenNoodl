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
4. ✅ **AMENDED 2026-08-18 (session 34) — see the verdict section below, which quotes the
   original in full and argues the change rather than assuming it.** No module may read the
   session that is not on a **recorded list with a reason**, and **no editor capability may sit
   inside a session branch** — the "gates nothing" principle is structurally visible, and is now
   a gate (`tests-unit/uni-001/session-readers.test.ts`) rather than a grep somebody re-runs.
   ~~`grep` the editor for reads of the session outside the launcher/account module comes back
   empty.~~

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
- ✅ **AC4 — SETTLED 2026-08-18 (session 34), and it was a wording defect, not a code one.**
  The verdict and its evidence are in their own section below; the short version is that a
  *location* test never expressed "gates nothing" and the one reader outside the named modules
  withholds nothing. It is now enforced by a spec instead of re-argued every session.
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

- ~~**AC4's grep still needs a verdict rather than a run**~~ ✅ **SETTLED in session 34** — the
  section below. AC2's own launcher hook was the third reader, and it is what made the wording
  easy to settle rather than harder: the criterion had to name a *property*, not a *place*.
- **The happy path is unproven end to end.** E10 (no OAuth App) then E2 (nothing deployed), in
  that order. The device flow's own half is specced in `communitysignin.test.ts`; what nothing in
  either repository can substitute for is E9's smoke drive on the deployed box.

# ✅ AC4 — THE VERDICT. 2026-08-18, session 34.

**Two sessions recorded AC4 as *"needs a verdict rather than a run"* and neither one gave it.**
This is it, with the measurement it rests on, because a criterion nobody will settle is a
criterion that quietly becomes optional.

## What the grep actually returns — measured before anything was argued

Every file under `packages/*/src` that reaches the store, by import path or by any exported name:

| File | Is it "the launcher/account module"? |
|---|---|
| `models/community/communitysession.ts` | it **is** the module |
| `models/community/communitysignin.ts` | the account module — the device flow writes, sign-out clears |
| `pages/ProjectsPage/useCommunityAccount.ts` | the launcher (AC2's own hook, added session 33) |
| `views/…/AskAboutNodeDialog/AskAboutNodeDialog.tsx` | 🔴 **no** |

**So the literal grep returns exactly one file, and it has since UNI-016 — before this task had an
issuer at all.** Reporting AC4 as passing would have been false; deleting it would have thrown
away the only structural expression of principle 1 this repo has.

## 🔴 THE RULING: THE CRITERION WAS WRONG, THE CODE IS RIGHT

**A location test never expressed "gates nothing".** It is a proxy that fails in both directions:
a read *inside* the launcher can withhold a feature and the grep stays empty, while the read that
exists in the composer withholds nothing and the grep goes red. The criterion's second clause —
*"the 'gates nothing' principle is structurally visible"* — is the requirement; the first clause
was a guess at how to see it.

**What the composer's read does, in the source:** it chooses a **transport** and adds an
**offer**. Signed in, a *Post to the community* button appears. Signed out, the sign-in offer
appears — and *Copy and open the community*, which needs no account, is the **CTA**. The
capability is available either way. That is the opposite of a gate, and UNI-016 AC5 already
warned in as many words against deleting the hand-off.

⚠️ **The third reader is what made this easy rather than harder.** When the composer was the only
reader, "move it or re-word it" looked like a coin toss. AC2's launcher hook made the pattern
plain: **every reader is a surface that draws the account, and none of them is a feature that
checks for one.** That is a property, and a property can be asserted.

## What replaced it — `tests-unit/uni-001/session-readers.test.ts`, 10 tests

1. **A recorded reader set.** The population is walked **from disk** (`packages/*/src`, 2548
   files) rather than listed, so a reader in a directory that did not exist when the spec was
   written is still caught. Each of the four entries carries **a reason**, and the reason has to
   answer *"what does this read withhold?"* — the only acceptable answer being *nothing*.
2. **No capability inside a session branch**, by balanced-brace scanning of the composer's JSX.
   🔴 **The control pair is real code, not a fixture:** the signed-in post button *is* inside
   `{session && (…)}` and the checker must report it **gated**; the hand-off and Cancel must
   report **ungated**. A checker that cannot see a gate that is there cannot be trusted to report
   its absence — the phase has recorded that failure five ways.
3. **Non-vacuity first.** The sweep asserts it saw a real population, found a known reader, and
   that an absent token reads absent — because a misconfigured root returns zero files and then
   every absence below it passes for the worst possible reason.

✅ **The gate was proven to fail before it was believed.** An unlisted reader planted in a
*different package* (`noodl-types/src`) turned exactly one test red and **named the file**;
removing it returned green. A gate that has only ever been green has not been tested.

## ⚠️ What this does NOT close, and it is deliberate

- **AC1 remains the regression gate for "gates nothing".** This spec proves the *structure*; only
  the full baseline proves the *behaviour*. Do not let a green run here stand in for it.
- 🔴 **`test:ci` is still unmeasured for this claim.** `test:main` is not the whole of AC1.

**Gates, measured 2026-08-18 (session 34), both sides of the edit:**

| | Before any edit | After |
|---|---|---|
| `test:main` | **0 failed / 3816 passed / 3816, 249 suites** | ✅ **0 failed / 3826 passed / 3826, 250 suites** |
| `npx tsc -p tsconfig.json --noEmit` | — | ✅ **exit 0** |

✅ **The delta reconciles: +1 suite and +10 tests, all of them this file's; nothing existing
moved.** 🔴 **The floor was CLEANER than session 33's after-state** (which was 1 failed / 3808 /
3809 across 248) — a peer fixed phase 69's `cn-002` red and added a suite in between. That is
exactly why the floor gets re-measured rather than quoted. ⚠️ **`test:ci` was NOT run** — four
peer sessions were live on this checkout.
- ⚠️ **The list is only as good as the question asked when a row is added.** The failure mode this
  cannot prevent is somebody adding a row to turn the suite green. The spec says so in the
  assertion's own comment, which is where the person doing it will be looking.

---

## Not in v1

Org SSO (UNI-005), the analytics pipeline (only the toggle, if D11 says so), profile editing
(UNI-003), any editor feature keyed to the account.
