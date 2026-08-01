# BCN-006 — Notes

**Steps 1–3 of eight.** The lifecycle designed in prose, `IAuthAdapter` with the Parse-wire
implementation, and the refresh/single-flight/cross-tab machinery under test on injected timers.

Read alongside [BCN-006-LIFECYCLE-DESIGN.md](./BCN-006-LIFECYCLE-DESIGN.md), which is the deliverable
step 1 asks for and carries six decisions for Richard, and
[BCN-006-AUTH-CONTRACT.md](./BCN-006-AUTH-CONTRACT.md), whose premises §1 corrects.

> ⚠️ **Steps 4–8 are not done and the phase's exit criterion 4 cannot be claimed.** Nothing in the
> product refreshes a token. See §6.

---

## 1. Spec premises that were wrong

### 1.1 ⚠️ "`cloudstore.js` reads the session directly from `localStorage` (`:80`)" — stale, and the true version is worse

> Traps: *"Until that is repointed, the data adapter and the auth adapter have two views of who is
> logged in."*
> Step 2: *"`cloudstore.js`'s direct `localStorage` read is repointed at it."*

`cloudstore.js` has no such read. **BCN-002 already moved it** into
`ParseWireAdapter.readStoredCurrentUser`, and left a comment saying BCN-006 owned replacing it.

The conclusion the trap draws is right, and the count is four times larger than the spec knew.
Grepping for the key rather than the file found it spelled out by hand in:

| Site | Named in a spec? |
|---|---|
| `ParseWireAdapter.readStoredCurrentUser` | as `cloudstore.js:80` |
| `noodl-viewer-react/src/api/cloudfunctions.ts:49` | **no** |
| `noodl-viewer-react/.../data/cloudfunction.ts:72` | **no** |
| `noodl-viewer-react/.../data/cloudfunction2.ts:59` | **no** |
| `userservice.ts` — eight reads, writes and `delete`s | implied by "session storage moves into the adapter" |

Three of the five were in no spec at all, and every one of them was a separate opinion about who is
signed in. **Implemented against the evidence:** `SessionStore` owns the key, `parseSessionStore(appId)`
returns the *same object* to every reader, and nothing else in the repo spells
`Parse/<appId>/currentUser` any more.

### 1.2 ⚠️ `AuthSession` was an envelope, and nothing produces or consumes one *(contract shape #4)*

BCN-001 shaped it `{user: AuthUser, sessionToken: string}`. Parse answers `/login`, `/users` and
`/users/me` with the user record and `sessionToken` **in** it; `userservice.ts` stores that object
verbatim under one key; `login.ts`, `signup.ts`, `api/users.ts` and the `User` node all read user
fields straight off what `success` hands them.

Corrected in the contract rather than cast away in the adapter, per BCN-002's rule. `AuthSession`
extends `AuthUser` — the user's own fields, flat, with `sessionToken`/`refreshToken`/`expiresAt`
beside them. That is also the right shape for the other four rather than a concession to this one:
Directus and Supabase answer `{access_token, refresh_token, user}` and their adapters flatten
*towards* this, the same direction `recordIdentity.ts` normalises records.

### 1.3 ⚠️ `SignInWithProviderOptions` cannot take `Callbacks` *(contract shape #5)*

It navigates the browser away. Nothing after it runs and `success` never fires, so requiring one —
which `Callbacks` does — would have made every call site declare a callback that cannot be called.
`signinwith.ts` passes only `error`, and passes it for the two things that can fail *before* the
navigation. Both callbacks are now optional and the doc comment says why.

### 1.4 The lifecycle needed a decision the design doc did not have

Written into the design and then contradicted by implementing it: **a request inside the refresh
margin must not queue.** Only the refresh token rotates, so the access token in hand is good until
`expiresAt`, and holding a request back for a refresh that has not finished adds latency to buy
nothing. The design doc §3 was amended in the same commit that found it. Queueing is now what happens
only when there is genuinely no usable token — which, on a correctly scheduled lifecycle, is never.

---

## 2. What moved, and what deliberately did not

| Piece | Where it is now |
|---|---|
| `_makeRequest` and the ten auth methods | [`ParseAuthAdapter.ts`](../../../packages/noodl-runtime/src/api/backends/ParseAuthAdapter.ts) — the only live copy |
| `setUserProperties`, `listAuthProviders` | The adapter. Not contract methods; they moved because leaving either behind leaves a **second** `_makeRequest` in `userservice.ts`, and the claim is that there is one |
| BAK-004's return leg (`_consumeAuthReturn`, `_stripAuthParamsFromUrl`, `_currentUrlWithoutAuthParams`) | The adapter. Four backends have four redirect shapes; what they share is only the *outcome*, a session |
| The four session events | `AuthEvents`, implemented once for every adapter, plus `sessionChanged` |
| Session storage and the Parse key | `SessionStore`, shared with the data wire |
| `current`, `getUserModel`, `forScope`, `instance` | **Stayed** in `userservice.ts`. `current` is a `ModelLike` eleven nodes read and building it needs `CloudStore._fromJSON`; an adapter importing the Model classes is what the adapter layer exists to avoid |
| `_serializeObject` | **Stayed**, injected into the adapter as a hook — the same seam BCN-002 used |
| Every node call site | **Unchanged.** `logIn(options)`, not `logIn(handle, options)` |

### How the ordering survived

Each method used to do four things in one place: write the session, rebuild `current`, call `success`,
emit. Split across two objects, the adapter raises `sessionChanged` **synchronously** between the write
and `success`, and `UserService` rebuilds `current` in that handler. `EventEmitter` dispatch is
synchronous, so the observable sequence is unchanged — and three tests assert the exact order rather
than trusting the argument.

That is the whole reason `sessionChanged` exists, and it is the only new name in the event vocabulary.

### Preserved on purpose

A no-behaviour-change task may not improve anything. Each is commented at its site and most are pinned
by a test.

- **`fetchCurrentUser`'s `209` branch clears storage and emits `sessionLost` but announces no session
  change** — so `UserService.current` keeps pointing at the user who has just turned out to be signed
  out. The `User` node clears its own model off `sessionLost`, so nothing visible depends on it.
- **The constructor's stale-session check emits `sessionLost` a second time** on a 209, because the
  adapter has already emitted one. Pre-existing; `user.ts` handles it idempotently.
- **The session header is set whenever a stored session parses**, even with no `sessionToken` — which
  sends the literal string `undefined`. BCN-002 preserved and pinned the same thing on the data wire.
- **`verifyEmail` and `resetPassword` read their outcome out of an HTML page** with
  `if (response.indexOf(…))` where the intended test was `!== -1`. Index 0 reads as false and -1 reads
  as true, so the second branch is effectively always taken. Ported verbatim.
- **`signUp` merges `options.properties` into the stored session** while sending them through the
  serialiser separately, so what is stored is the *unserialised* form.

Each is a candidate for its own commit, deliberately not taken here.

---

## 3. Deviations, with reasoning

### 3.1 The request gate is a callback, and synchronous, not a promise

`ParseWireAdapter._makeRequest` and `ParseAuthAdapter._makeRequest` build their requests
synchronously. On an `eternal` backend the gate has to be a pass-through with **no** change in
ordering, and a promise would push every request in the product onto a microtask — reordering the
callbacks twenty-five nodes see, in a task whose safety argument is that nothing moved.

So `withSession(cb)` calls back synchronously whenever there is nothing to wait for, and defers only
when the token has genuinely expired. The asymmetry is the single most load-bearing detail in the
implementation and is stated at the top of the module.

### 3.2 An `eternal` lifecycle subscribes to no storage events

Cross-tab logout propagation on Parse would be a real improvement — today a logout in tab A leaves
tab B believing it is signed in until its next request fails. It is also a real *change*, and BCN-002's
rule is that a behaviour change smuggled into a no-behaviour-change move destroys the only signal the
move produces. The controller implements and tests it; `eternal` does not arm it.

**Recorded as an available improvement, unowned.**

### 3.3 `SessionStore` resolves its storage handle per access, not at construction

Caching it looked identical until something swapped the global — and something does:
`parse-wire-adapter.test.ts` replaces `globalThis.localStorage` between cases and the first version
broke it. The replaced code was a bare `localStorage[key]` evaluated on every request, so per-access
is also the faithful translation. **Caught only by running the suite that was not this task's**, which
is the second time that rule has paid in this phase.

### 3.4 ⚠️ SSR: the obvious guard was the wrong one, and finding out changed the code

The first implementation refused to schedule when there was no storage — "no `localStorage` means a
server render". **That is false.** RUN-002's SSR harness
([`static/ssr/runtime-globals.js`](../../../packages/noodl-viewer-react/static/ssr/runtime-globals.js))
installs a `localStorage` **mock**, deliberately supporting both bracket and method access because the
runtime uses both. So a server render *has* storage, an absent-storage check concludes "browser", and
BCN-004's Directus adapter would have armed a fifteen-minute timer holding a refresh token **once per
render**, in a long-lived Node process. Nobody would look for that.

The honest signal is `window`, which the harness installs nothing of. `isBrowserTab()` is now the
guard: a `window` must exist and `_noodl_cloud_runtime_version` must not — the cloud runtime is
excluded for its own reason, that a session arrives *with* each request, already validated, and the
next request brings its own. Five tests cover it, one of them named for the trap.

Two corrections to what would otherwise have gone in these notes:

- **`userservice.ts` did not throw under SSR.** The mock has always been there. `SessionStore`'s
  tolerance of absent storage is still right for the cloud runtime and for tests, but it is not
  closing a defect and this file no longer claims it is.
- **"A server render always sees a logged-out user" was already true as shipped**, because the mock
  starts empty on every render. The design doc §6 ratifies existing behaviour rather than proposing
  new behaviour, which is a stronger position than the doc claimed.

Found by grepping for the last `localStorage['Parse/…']` in the repo, which turned out to be a comment
inside the SSR harness. **Still not exercised against a real server render** — see §5.

### 3.5 The lifecycle machinery ships wired but inert

`ParseAuthAdapter` constructs a `TokenLifecycleController` and routes `_makeRequest` through its gate,
with `{kind: 'eternal'}`. Nothing is scheduled, nothing is queued, nothing subscribes. The alternative
— building the machinery beside the request path and connecting it in BCN-004 — would leave the one
integration point in the task unexercised, and it is the point most likely to be got wrong.

---

## 4. Evidence

| Claim | How it is evidenced |
|---|---|
| The wire still behaves | `userservice.ts` 626 → 292 lines; the ten are one-line forwards; no second `_makeRequest` outside `configservice` |
| The ordering is unchanged | Three tests assert the literal sequence `sessionChanged → success → loggedIn` (and its `logOut` and `fetchCurrentUser` variants) |
| The adapter surface does not grow quietly | A test enumerates every prototype member and names the six deliberate extras |
| One session store | `parseSessionStore` is the only constructor of a Parse-keyed store; the key is pinned by a test |
| The lifecycle | 39 tests on injected timers, clock, storage and transport — scheduling, the gate, single-flight, both failure classes, retry/backoff, the cross-tab lock, adoption, SSR refusal, declared-lifecycle validation, and the 32-bit timer ceiling |
| No bundle weight | The contract still enters `noodl-runtime` as `import type` only |

### Suites

Every package's suite, from the worktree, after fixing the resolution trap in §7.

| Package | Result |
|---|---|
| `@noodl/runtime` | **1351 passed**, 13 skipped *(1287 before this task's 64 new tests)* |
| `@noodl/backend-contract` | 88 passed |
| `@noodl/noodl-viewer-react` | 367 passed |
| `@noodl/cloud-runtime` | 57 passed |
| `@noodl/nodegx-backend` | 729 passed, 10 skipped |
| `@noodl/noodl-core-ui` | 44 passed |
| `noodl-editor` (Jasmine) | ⚠️ 1894 specs, **4 failures** — see below |
| `@noodl/mcp` | ⚠️ 101 passed, **1 failed** — `create_component validates, writes and updates the registry`, `validate_project` reports 3 errors where it expects 0. **Pre-existing and unowned**: BCN-002-NOTES §9 records the identical failure, verified there against a pre-BCN-002 tree |
| `@noodl/preview` | ⚠️ **could not run** — `assertPrerequisites` refuses without `dist/noodl-preview.cjs` and a built viewer runtime, neither of which exists in a fresh worktree. Environmental, not a regression |

### The editor's four failures

`only a project edit writes the project` ×2 (F46's autosave allowlist), `AIX-011 criterion 7 —
createPlanDocWriter on real files` ×2, plus `Git remote tests can handle merge with conflicts in
project.json` in the console tail. **Not verified against a baseline run at `b0ac1591`** — that is a
forty-minute build and was not made.

What *is* verified: **none of this task's code is in the editor test bundle at all.**
`ParseAuthAdapter`, `SessionStore`, `TokenLifecycleController`, `parseSessionStore`, `AuthEvents`,
`verificationEmailRequest`, `X-Parse-Installation-Id` and `refresh-lock` all return **zero** matches in
`packages/noodl-editor/tests/index.bundle.js`, so the diff cannot reach these specs.

All five are file-writing specs in a worktree that has never been built.
[REV-010](../phase-12-reanimation/REV-010-TEST-CI-NEEDS-MAIN-BUNDLE.md) documents the git one exactly:
`noodl-git` installs a merge driver that shells out to the editor as an Electron app, `test:ci` builds
only the renderer bundle, so on a tree with no prior `build:editor` the driver cannot start and the
spec times out. **The orchestrator should re-run this suite from the primary checkout after merging**,
where the built bundles exist.

### The deploy bundle

Built to completion (`webpack.prod.js`, 3 pre-existing size warnings). It carries the moved auth wire
— `verificationEmailRequest` and `X-Parse-Installation-Id` are in it — and the lifecycle's
`refresh-lock` key, and **zero** contract *value* symbols from this task: `AUTH_ADAPTER_METHODS` and
`DATA_ADAPTER_METHODS` both return no matches. The contract still enters the runtime as `import type`
only.

---

## 5. Could not verify

Stated plainly, because a verification claim that overreaches is worse than none.

1. **No live pass of any kind.** Step 8 owns it and needs BCN-004. Nothing here has been driven
   against a running backend — not `nodegx-backend`, not the Parse Server now in the rig. Every claim
   above is a unit-test claim.
2. **The eleven user nodes were not driven.** "No behaviour change" is a statement about signal
   ordering in eleven nodes, and the tests assert the *adapter's* call order, not the nodes'. This is
   the same gap BCN-002 recorded in its §6.3 and the same instrument would close it — RUN-001's corpus
   harness diffs probe event ordering — and it still compares runtime *versions* rather than builds.
3. **Editor live-verification was not attempted.** It does not work from a worktree: `lerna exec`
   resolves to the primary checkout, so an editor launched here exercises code that is not this
   branch's. **The orchestrator should drive a login → log out → sign up → reset password round trip
   from the primary checkout after merging.** That is the only thing that will exercise the moved
   `_makeRequest` in a browser, which is the branch every viewer runs and the one no unit test reaches.
4. **SSR was not exercised.** §3.4's guard is written against the SSR harness's *source*
   (`runtime-globals.js` installs a `localStorage` mock and no `window`), not against a server render
   that was actually performed. The reasoning is now grounded in an artifact rather than in the design
   doc, which is better than it was, and it is still not a run.
5. **Cross-tab was not exercised in two real tabs.** The lock, the `storage` event and adoption are
   tested against an injected broadcaster. Real `localStorage` write serialisation across processes is
   the assumption the design's §5 rests on and it is stated there as an assumption.
6. **A real token expiry with the app open** — the success criterion that matters — is untested by
   construction, because no backend in the product refreshes anything yet.

---

## 6. What steps 4–8 inherit

### Ready for them

- `TokenLifecycleController` takes one function, `performRefresh(session) => Promise<AuthSession>`.
  **That is the entire contract an adapter has to satisfy to get the lifecycle.** Reject with
  `{status}` or an explicit `{fatal}` so the rejected/undelivered split works; everything else is
  handled.
- The gate is already on the request path, so BCN-004 adds a `performRefresh`, not a call site.
- `SessionStore` is per-key, so a Directus session lands beside a Parse one with no collision. Two
  backends have two sessions, which is the phase decision.
- `AuthEvents` gives every adapter the five events for free.
- `validateTokenLifecycle` is what BCN-009's Backend Services panel should call before saving a
  declared lifecycle, so the user sees the reason in the form rather than at runtime.

### Left half-built, deliberately

| Item | Who picks it up |
|---|---|
| **Every `performRefresh`.** Directus, Supabase and PocketBase have none — there is no REST transport to write one against | BCN-004 → BCN-006 step 4 |
| The endpoint table in Desired State §1 is untranslated. `refreshEndpoint` strings are in the descriptors and nothing reads them | step 4 |
| **OAuth for four backends.** Only Parse's return leg exists, in `ParseAuthAdapter.consumeAuthReturn`. It is already isolated per adapter, which is the shape step 5 needs | step 5 |
| **Schema-driven user ports.** `setUserProperties` moved verbatim and is still `_User`-shaped. Desired State §3's normalised user record is not begun | step 6 |
| **Descriptor cells.** No `auth.*` capability cell was touched. The reason strings exist from BCN-001; nothing gates on them | step 7, BCN-010 |
| **`custom`'s declared lifecycle has no UI.** The validator and the degrade-to-eternal policy exist; the panel that collects the declaration does not | BCN-009 |

### Recorded, unowned

- **`dist-types/src/api/cloudstore.d.ts` carries a dangling import**:
  `import("packages/nodegx-backend-contract/src").AdapterEvent`, a baseUrl-relative specifier that
  resolves from nothing. It makes `tsc -p packages/noodl-viewer-react/tsconfig.json` fail with
  `TS2307` unless `--skipLibCheck` is passed. **Pre-existing and not this task's** — the primary
  checkout's already-built `dist-types` has the byte-identical line, and it dates from BCN-002 giving
  `AdapterEvents` a contract type. This is the PLAT-006 trap ("skipLibCheck hides dangling dist-types
  imports") in its live form. The viewer typecheck here was run with `--skipLibCheck`, which masks
  exactly that one error and nothing of this task's.
- **Cross-tab logout propagation on `eternal` backends** is implemented and switched off (§3.2).
- **`listAuthProviders` has no consumer.** BAK-004 built it for a set of sign-in buttons and nothing
  in the repo calls it. It moved with the wire rather than being deleted, because deleting a public
  method is a decision and this was not the task for it.
- **The `209` double `sessionLost`** and the four other preserved oddities in §2.

---

## 7. The worktree resolution trap, for whoever runs a parallel batch next

Not a BCN-006 finding — BCN-007 hit it in the same batch — but it changes what a green suite means and
belongs in the phase record.

In these worktrees `<wt>/node_modules`, `<wt>/packages/node_modules` and every
`<wt>/packages/*/node_modules` are **symlinks into the primary checkout**, whose own `@noodl/*` entries
are relative and therefore resolve against *that* root. So:

- a change to `packages/nodegx-backend-contract` is invisible to the worktree's own runtime suite —
  this one fails loudly, with `has no exported member`;
- **a change to `packages/noodl-runtime` is invisible to the worktree's `noodl-viewer-react` suite,
  which then passes having tested the primary checkout's sources.** That one is silent, and it is
  exactly where BCN-006's diff lives.

The fix used here: replace each package's `node_modules` symlink with a real directory that mirrors
the primary's entries and adds a worktree-local `@noodl/{runtime,backend-contract,types}`. Verify with
`node -e "console.log(require.resolve('@noodl/runtime'))"` **from the package being tested** and
confirm the path is under the worktree before believing anything.

⚠️ **`<wt>/packages/node_modules` is itself a symlink into the primary**, so
`mkdir -p packages/node_modules/@noodl` from the worktree root writes into the *primary checkout*. It
was done here by accident and reverted; do it per package.

The `dist-types` tree is also worktree-local and is not generated by anything automatic. Run
`npm --prefix packages/noodl-runtime run build:types` before the viewer will resolve a newly added
runtime module at all.

---
---

# BCN-006 — Notes, steps 4–8

**Written 2026-08-01.** Everything above this line describes steps 1–3. This half
describes **steps 4–8**, and it contradicts parts of what is above — where it
does, this is the later and better-evidenced account.

> ✅ **Exit criterion 4 can now be claimed for Directus and PocketBase, on live
> evidence.** It cannot be claimed for Supabase, and the reason is stated rather
> than worked around. See §14.

---

## 8. What was measured before anything was written

The rig was probed first, and it paid for itself four times over. Full output:
[`bcn-006-auth-driver.output.txt`](../phase-16-runtime-deploy-health/uba-e2e/bcn-006-auth-driver.output.txt).

### 8.1 Directus 11 (`:8055`)

| | Measured |
|---|---|
| login | `POST /auth/login {email, password}` → `{data:{expires, refresh_token, access_token}}` |
| ⚠️ `expires` | **`900000` — milliseconds of remaining lifetime.** The access token's own `exp` claim is `now + 900` *seconds*, which is how this was settled |
| identity field | **`email`.** `directus_users` has no username column at all |
| who am I | `GET /users/me` → `{data:{id, email, first_name, …, status, password:"**********"}}` |
| ⚠️ `emailVerified` | **does not exist.** There is `status` (`active`/`invited`/`suspended`/…), which is an account state, not an assertion about the address |
| refresh | `POST /auth/refresh {refresh_token, mode:'json'}` → new pair. **Rotates**; a replay of the spent token is `401 "Invalid user credentials."` |
| logout | `POST /auth/logout` → `204`, **and the access token still works afterwards** — it revokes the refresh token, not the JWT |
| public sign-up | `POST /users/register` → **`403 FORBIDDEN`**, and `/server/info` reports `public_registration: false` |
| password reset | `POST /auth/password/request` → `204` |
| SSO providers | `GET /auth` → `{data:[]}` — none configured |

### 8.2 PocketBase 0.30.0 (`:8091`)

| | Measured |
|---|---|
| login | `POST /api/collections/users/auth-with-password {identity, password}` → `{record, token}` |
| ⚠️ refresh token | **there isn't one.** `POST …/auth-refresh` with `Authorization: Bearer <access token>` → `200` and a new token |
| token lifetime | JWT `exp` = `now + 604800` (**7 days**). The descriptor declares `1209600` (14) |
| sign-up | `POST /api/collections/users/records {email, password, passwordConfirm}` → **`200`, no token**, and the record **omits `email`** (`emailVisibility: false`) |
| `emailVerified` | `record.verified`, a real boolean |
| wrong password | **`400`** "Failed to authenticate.", not 401 |
| garbage bearer | `401` |
| verification / reset | `204` each — and `/api/settings` says `smtp.enabled: false`, so PocketBase **logged** the mail rather than sending it |
| providers | `GET …/auth-methods` → `oauth2.enabled: false` |

### 8.3 Supabase — ⚠️ there is no auth service in the rig

`:8056` is **plain PostgREST**. GoTrue, which serves `/auth/v1/*`, is a separate
service and is not running:

```
POST /auth/v1/token?grant_type=password  -> 404
GET  /auth/v1/settings                   -> 404
```

---

## 9. Stale premises corrected

### 9.1 ⚠️ "The token is the authority" was right; "Directus returns `expires`" was not

The design's §2 and `AuthSession.expiresAt`'s doc comment both name Directus's
`expires` as the backend *"stating an expiry"*, alongside Supabase's `expires_at`
and a JWT `exp` — as if the three were the same kind of thing.

**They are not.** `expires` is a **duration in milliseconds**. Stored as
`expiresAt` it puts the deadline at 1970-01-01T00:15:00Z, every request sees an
expired token, and the app refreshes in a tight loop while appearing to work.
Read as *seconds* it lands 250 hours out and the session dies with no refresh ever
attempted. Both failures are silent.

Handled in `RestAuthAdapter.directusExpiry`, with the JWT claim preferred and
`expires` as the fallback. Pinned by a unit test and by §1 of the live driver.

### 9.2 ⚠️ "Directus, Supabase and PocketBase all issue a short-lived access token **with a refresh token beside it**"

The premise is in the task spec's Background, in the design doc's §0, and in
`TokenLifecycle`'s own contract comment. **PocketBase does not.** It refreshes by
presenting the access token.

`TokenLifecycleController` acted on the assumption: a session with no
`refreshToken` took the `failFatally` branch. So the machinery, exactly as built
and tested in steps 1–3, **would have signed every PocketBase user out at the
first scheduled refresh** — fifteen minutes to fourteen days after login, with the
message *"This sign-in cannot be renewed. Please sign in again."*

No unit test on Parse could have found this, because Parse never schedules a
refresh. Closed with `TokenLifecycleControllerOptions.refreshTokenRequired`,
defaulting to `true` so nothing that predates it moves. **Mutation-tested live:**
reverting the one condition turns §4 of the driver from four passes into four
failures carrying that exact sentence.

### 9.3 ⚠️ A refresh is not guaranteed to move the deadline

Not in any spec, and found by measurement: PocketBase returns a **byte-identical
token** for two refreshes inside the same second, because its auth claims carry
`exp` and no `iat`. That is benign in itself, but it falsifies an assumption the
scheduler rests on — *arm from `expiresAt`, and a refresh moves `expiresAt`
forward.* A backend that answers a refresh without moving the expiry makes `arm`
compute a delay of zero, fire, refresh, and loop for as long as the app is open,
with no error raised anywhere.

Guarded by `MIN_REFRESH_SPACING_MS` (5s), inert until the first successful
refresh so nothing that predates it moves.

### 9.4 The `Callbacks` shape survived contact with three more backends

Recorded because it is a premise that held. `UserServiceCallbacks`' claim that
`error` receives *"a message string, never an error object"* is now true of two
more error envelopes (`{errors:[{message}]}`, `{status, message, data}`), verified
live: a wrong password in the preview window rejects with the **string**
`"Invalid username/password."`.

### 9.5 "The contract still enters `noodl-runtime` as `import type` only"

§4 of the notes above claims this as a bundle-weight property. It stopped being
true in BCN-004 — `RestDataAdapter` imports `descriptorFor`, `readRows`,
`paginationParams` and more as **values**. `RestAuthAdapter` imports
`descriptorFor` too. Recorded so the claim is not re-inherited; the descriptors
are frozen data and small, but "type-only" is no longer the reason.

---

## 10. The two live-QA defects — root causes and fixes

Both were reproduced in the preview window before being touched, and the
**mutated build reproduces the original symptom byte-for-byte** (§13).

### 10.1 `Current.email` was `undefined` after `signUp` — ✅ fixed

**Root cause, pinned at both ends.** `POST /users` answers
`{objectId, createdAt, sessionToken}` and nothing else — deliberately, and the
backend says so in a comment: *"The client merges its own username/properties over
this, so keep it minimal."* The client merged `username` and `properties`. It
never merged **`email`**, which the caller had just supplied. So the address was
simply dropped, and only reappeared when a later call re-read the user.

**Fix.** `ParseAuthAdapter.signUp` merges `email` when one was supplied — and only
then, so a sign-up without an email does not store the key at all.

### 10.2 `emailVerified` never populated — ⚠️ **half fixed, and the other half is not mine**

**Root cause.** The field is absent from **every** response on this wire —
`/users`, `/login` *and* `/users/me`. Measured. It is not a client bug: a password
sign-up never writes the column
(`nodegx-backend/src/server/users.ts::signup`), so there is nothing to report.
The backend already reads absent as false itself (`!user.emailVerified` gates
login).

**What is fixed.** A sign-up now stores `emailVerified: false`. That is a *fact*
about an account created a millisecond ago, not a default standing in for one, and
the backend and the caller both outrank it if either says otherwise.

**⚠️ What is NOT fixed, verified rather than assumed.** For a user whose row
predates this — or who signs in on a fresh page load — `logIn` still yields
`undefined`. Checked live, deliberately, by creating a user over raw HTTP and
signing in as an account the page had never seen:

```
logIn (user created outside the client) :: email="…@example.com" emailVerified=undefined
after fetch                              :: email="…@example.com" emailVerified=undefined
```

This is the design decision working as intended — `logIn` and `fetchCurrentUser`
report exactly what the backend said, including saying nothing, because on a stock
Parse Server with verification switched off an absent value means *"not
applicable"* and answering `false` would tell every user they are unverified.

**The real fix is one line in a package that is not in my territory:**
`nodegx-backend/src/server/users.ts::signup` should write `emailVerified: false`
on the new `_User` row. Then every response carries it and no client-side default
is needed. **Owed, unowned, and it is the honest close of this defect.**

### 10.3 The `indexOf` bug — ⚠️ **fixed**, and here is the reasoning

The decision asked for. `verifyEmail` and `resetPassword` both wrote
`if (response.indexOf(phrase))` where the test had to be `!== -1`: a phrase found
at index 0 reads as *false*, an absent phrase (-1) reads as *true*. The condition
was inverted for every input except a match at index 1 or later, so the second
branch was effectively always taken and the third was dead code.

**Fixed, for three reasons rather than one:**

1. **The move it was preserved for is finished and merged.** Step 2's rule was
   that nothing be tidied on the way through so "changes nothing" stayed testable.
   That claim has been made and evidenced. Its own notes listed this as *"a
   candidate for its own commit"* — this is that commit.
2. **No test had ever reached it, and the bug was why.** Covering a branch
   requires first deciding what it should do; "leave it and test it" was never
   available.
3. **Measuring it changed the picture entirely**, and this is the part that made
   the decision easy rather than finely balanced.

**What measuring found.** Against a running backend, an invalid link answers
**HTTP 400** with the failure page — and `_makeRequest` routes any non-2xx to
`error`. So on our own backend the broken branch is unreachable in *either*
direction, and the real defect was next door and in no register:

> **The entire HTML document was arriving as the node's `error` string.**
> `<!doctype html>`, inline CSS and all, for a builder to wire to a text label.

`UserServiceCallbacks` is explicit that these two endpoints *"substitute a message
of their own"*. They did not. Fixed with `htmlPageError`, which is what doing that
looks like.

Stock Parse Server, which redirects to a `200` failure page, *does* reach the
inverted branch and reports "Invalid verification token" for any page it cannot
identify — a proxy notice, a maintenance page, a gateway error. Both wrong, and
neither fixable by preserving them.

Also corrected: `resetPassword`'s two failure strings were copied from
`verifyEmail`, so a user resetting a **password** was told their *email* had failed
to verify.

Six tests now cover these branches. All six fail when the fixes are reverted.

---

## 11. Deviations, with reasoning

### 11.1 ⚠️ Supabase auth is **gated, not implemented** — the largest deliberate gap

There is no GoTrue in the rig (§8.3), so a Supabase auth implementation would be
written from documentation and shipped untested. This phase has been wrong that
way three times — BCN-002 on all three Parse file cells, BCN-003 on four
descriptor cells, BCN-004 on the presets' total — and this is the one subsystem
where being wrong locks a user out of their own app.

So every Supabase auth call is refused with one sentence naming what is missing,
and **no request is issued**. This is not a shortfall against success criterion 1;
it is what that criterion asks for: *"All eleven user nodes work against all five
backends, **or are gated with a stated reason**."*

⚠️ **The descriptor now disagrees with reality.** `supabase.ts` says
`'auth.password': supported('POST /auth/v1/token?grant_type=password')` and
`'auth.magicLink': supported(…)`. Those cells were written from documentation and
nothing has probed them. **Owed:** either stand GoTrue up in the rig and implement
against it, or mark those cells honestly. The contract package was another
worker's blast radius in this batch, so I did not edit it — see §11.5.

### 11.2 `UserService` falls back to a BYOB backend **only when there is no endpoint**

`_handle()` returns the `cloudservices` answer **unchanged whenever the project has
an endpoint** — which is every project that works today. Only a project with no
endpoint at all falls through to `backendServices`, and that is precisely the case
the task's Current State names: *"A project on Directus today has data nodes and
no login."*

Falling back cannot regress anything there, and the reason is worth stating rather
than assuming: with no endpoint, `url` is `undefined` and every method already
answered `"No active cloud service"` before touching the network.

⚠️ **What this deliberately does not do is give the eleven user nodes a backend
picker.** BCN-009 gave the Record family a `backendId` input; the user nodes have
none, so a project with *both* an endpoint and a Directus backend signs in to the
endpoint. Anything else would silently move every existing project's users — the
same no-silent-migration rule `resolveBackend`'s own docblock settled for
`_active_`. **This is the remaining half of step 4** and it is a node-port change,
not an adapter change.

### 11.3 The auth wire profiles live in `noodl-runtime`, not the contract package

`RestWireProfile` (data) lives in `nodegx-backend-contract/src/wire.ts`, and the
auth profiles arguably belong beside it. They are in `RestAuthAdapter.ts` instead,
because the contract package was being edited by another worker in this batch and
a shared-file collision costs more than the asymmetry. **Recorded as an available
tidy-up, unowned.**

### 11.4 `logIn` on Directus fires `loggedIn` only after `/users/me`

Directus's login answers **tokens and no user record**, so the signed-in user is
unknown until a second request. Firing `loggedIn` on the first response would hand
every graph that reads `Current.email` in its `loggedIn` handler — the ordinary
case — an empty user. Two requests, one event, at the end.

The same shape appears twice more for measured reasons: a **PocketBase sign-up**
returns no token *and* no email, so `signUp` chains a login; a **Directus sign-up**
returns `204` and no session at all, so it does too.

### 11.5 Territory not entered

`packages/nodegx-backend` (§10.2's real fix), `nodegx-backend-contract/descriptors`
(§11.1), `RestDataAdapter.ts`, the realtime files and the editor. All owned by
other workers in this batch or outside the brief.

---

## 12. Steps 5, 6 and 7 — what was and was not done

Stated plainly rather than left to be inferred from what exists.

| Step | State |
|---|---|
| **4. Directus / Supabase / PocketBase adapters** | ✅ **Done** for Directus and PocketBase, live-verified. Supabase gated (§11.1) |
| **5. OAuth redirect handling per backend** | ❌ **Not done.** `signInWithProvider` on a REST backend **refuses with a sentence** rather than starting a flow whose answer nobody collects — a half-started redirect strands the user on a page with a code in the address bar and no session, which is worse than a clear refusal. `ParseAuthAdapter.consumeAuthReturn` remains the only return leg that exists |
| **6. Normalise the user record** | ◐ **Partly.** `id` → `objectId` and PocketBase's `verified` → `emailVerified` are done and tested, and `setUserProperties` needs no per-backend field list as a result — Desired State §3's claim holds for these two backends. **Schema-driven dynamic ports on the `User` and `Set User Properties` nodes were not built**; that is node-port work of the kind BCN-004 did for records |
| **7. Descriptor cells + gating hooks** | ◐ **Gating done, cells not touched.** Every method runs through `begin()`, which reads the descriptor and refuses with the descriptor's *own sentence* — so the message a user sees at runtime is the message BCN-010 will grey a port out with. `conditional` counts as unsupported until probed, which is load-bearing: Directus sign-up is 403 by default and PocketBase logs mail instead of sending it. **No descriptor cell was edited** (§11.1) |
| **8. Live pass** | ✅ Done, both wires, mutation-tested (§13) |

---

## 13. Evidence

### 13.1 The live pass — REST backends

[`bcn-006-auth-driver.ts`](../phase-16-runtime-deploy-health/uba-e2e/bcn-006-auth-driver.ts),
**35 checks, 0 failures, 42s.** Real adapter, real HTTP, real servers, **real
timers**. Injected: a plain object for `localStorage` (Node has none) and
`isBrowserTab: () => true` (the SSR guard, correctly false in Node, would switch
off the paths under test). The clock is not mocked.

⚠️ `RestAuthAdapter` uses `fetch`, not `XMLHttpRequest`, so unlike
`ParseAuthAdapter` it is fully reachable from Node.

| § | What it proves |
|---|---|
| 1 | Login, `/users/me` merged, `id`→`objectId`, the password placeholder kept out of storage, and `expiresAt` ~15 min in the **future** |
| 2 | A **scheduled** refresh fires on real timers ~5s after login; both tokens rotate; no `sessionLost`; the new token is accepted (200) and the **old refresh token is rejected (401)** |
| 3 | A spent refresh token ends the session with *the backend's own words*; an **unreachable** backend does **not** — design decision #1, live |
| 4 | ⚠️ **A genuine 25-second token expiry, with the session open.** See below |
| 5 | Ten concurrent callers → **one** rotation, all ten handed the same token, nobody signed out |
| 6 | The rig really has no GoTrue (404), and the adapter refuses rather than guessing |

**§4 is exit criterion 4.** PocketBase's `users` collection was reconfigured to
issue **25-second** tokens for the length of the test and restored afterwards —
a real short-TTL backend, which is what the spec asks for and not a mocked clock:

```
✅ the backend really is issuing ~25s tokens  — 24s
… waiting 30s — past the real expiry, with the session open
✅ the ORIGINAL token has genuinely expired  — HTTP 401
✅ the user is STILL SIGNED IN
✅ …on a token that was silently replaced
✅ …and nothing told the app the session was lost
✅ the replacement token is accepted by the backend  — HTTP 200
✅ fetchCurrentUser still works across the expiry
```

### 13.2 The live pass — the browser, and the XHR branch

Preview window (`--target=viewer`, localhost:8574), editor run **from this
worktree**, against a `nodegx-backend` on `:8579`. `Noodl.Users` is
**promise-based** — passing callbacks makes every call look like a timeout while
actually succeeding.

| | Before (BCN-006-007-LIVE-QA §1.1) | After |
|---|---|---|
| after `signUp` | `email=undefined emailVerified=undefined` | ✅ `email="…@example.com" emailVerified=false` |
| after `logOut` | — | ✅ nobody signed in |
| after `logIn` | `email="…"` `emailVerified=undefined` | ✅ `email="…"` `emailVerified=false` |
| wrong password | — | ✅ rejects with the **string** `"Invalid username/password."`, session survives |

### 13.3 ⚠️ Mutation-tested — a green run on its own proves nothing

| Mutation | Result |
|---|---|
| Revert the `signUp` email/`emailVerified` merge, **rebuild, reload the preview window** | ⚠️ **Reproduces the recorded defect byte-for-byte**: `after signUp :: email=undefined emailVerified=undefined`. Restored → green again |
| Revert `refreshTokenRequired` (live, §4) | 4 failures, carrying the predicted *"This sign-in cannot be renewed."* |
| Revert `pageSays`, `htmlPageError`, the `signUp` merge, `refreshTokenRequired` (unit) | 7 tests fail across two suites |

### 13.4 ⚠️ And one mutation that disproved a comment I had written

Dropping `mode: 'json'` from the Directus refresh **changed nothing** — the live
run stayed green. The comment claiming it was *required* was
documentation-shaped reasoning, not measurement. Measured directly:

```
no mode      -> 200  keys: expires,refresh_token,access_token  set-cookie: no
mode=json    -> 200  keys: expires,refresh_token,access_token  set-cookie: no
mode=cookie  -> 400
```

The default already is json. The parameter is kept as belt-and-braces and the
comment now says which it is. **This is the whole argument for mutation-testing a
green run**: it caught a false claim that would otherwise have been inherited as
a wire fact.

### 13.5 Gates

| Package | Result |
|---|---|
| `noodl-runtime` | **87/88 suites, 1609 passed, 13 skipped, 0 failed** (baseline 1580; +29 = 21 new REST-auth tests + 8 new Parse-auth tests) |
| `noodl-viewer-react` | **35/35 suites, 373 passed, 0 failed** (baseline 367; +6) |
| `nodegx-backend-contract` | 146 passed, 0 failed |
| `tsc` | clean — runtime, and viewer with `--skipLibCheck` (the pre-existing `dist-types/src/api/cloudstore.d.ts` dangling import) |
| `catalog:check` | clean, committed catalog up to date |

⚠️ Run `npm --prefix packages/noodl-runtime run build:types` first in a fresh
worktree or four corpus suites fail to start and the run reads `79/84`.

---

## 14. Could not verify

Stated plainly, because a verification claim that overreaches is worse than none.

1. **Supabase auth is entirely unverified**, by construction — there is no GoTrue
   in the rig. Nothing is claimed for it and nothing is implemented (§11.1).
2. **`emailVerified` is still `undefined` for pre-existing users** on the Parse
   wire. Verified *as a limitation* rather than assumed (§10.2); the close is a
   one-line backend change outside my territory.
3. **No user node was driven.** The live pass drives `Noodl.*` — the API the nodes
   call — not the nodes themselves. Nothing here says the Log In / Sign Up /
   Verify Email nodes fire their signals correctly. This is the same gap steps 1–3
   recorded and the same instrument would close it.
4. **The REST adapter was never exercised through `UserService` in a browser.**
   The `_handle()` fallback and adapter routing are covered by six unit tests
   only; staging it live needs a project with no `cloudservices` endpoint, which
   is a project-configuration change rather than a code path.
5. **`verifyEmail` and `resetPassword` were never driven against a *success*
   page.** Both fixed branches are covered by unit tests using real page bodies
   copied from a running backend, and the live run reached only the 400 path. A
   genuine verification link needs a working SMTP round-trip.
6. **Cross-tab was not exercised in two real tabs**, unchanged from steps 1–3.
7. **SSR was not exercised.** `isBrowserTab` is now injectable, which makes it
   *testable*, and it still has not been run against a real server render.
8. **PocketBase's OAuth, and every REST backend's OAuth**, are refused rather than
   implemented (step 5, §12).
9. **The Directus `expires` fallback is not reachable live** — Directus always
   sends a JWT, so `jwtExpiryMs` wins and only the unit test covers the fallback.
10. **`MIN_REFRESH_SPACING_MS` has no live evidence.** It guards against a backend
    that refreshes without moving the deadline; no backend in the rig does that,
    which is why the guard is cheap insurance rather than a fix.
