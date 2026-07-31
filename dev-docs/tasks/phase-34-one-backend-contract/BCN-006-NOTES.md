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
