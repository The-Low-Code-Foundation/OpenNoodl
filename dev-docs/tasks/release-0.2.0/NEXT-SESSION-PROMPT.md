# Release 0.2.0 — next session

**Written 2026-08-20, end of the release session; updated the same day after a CI-cleanup
session.** This file is the working state of the 0.2.0 release, not a phase. Read
[RELEASE-PROCESS.md](../../guidelines/RELEASE-PROCESS.md) before touching anything in §3.

🔴 **THE DRAFT IS STILL UNPUBLISHED AND §3 IS STILL THE WHOLE REMAINING RELEASE.** The cleanup
session changed **nothing** about the shipped artifacts — it fixed CI gates on `cline-dev` only.
`gh release list` still shows **0.1.7 as Latest** and **0.2.0 as Draft**.

---

## 0. Where this got to

| | |
|---|---|
| `3a20f46c` | `chore(release): 0.2.0` — the version bump, committed with a **pathspec** so a peer's two in-flight files stayed out |
| `v0.2.0` | tag pushed 12:31Z, triggering run **32369270228** |
| `b2aeaad` (nodegx-community@main) | deployed to nexus-1 12:23Z — the reason any of the new community surfaces have data at all |
| `8a17a0ad` | `fix(ci): three of the four red PR jobs…` — the CI cleanup, **after** the tag. Not in the 0.2.0 build; it rides in 0.2.1 |

**0.2.0, not 0.1.8**, and the previous release was **0.1.7** — not 0.1.17. 149 feature and fix
commits, 478 total, since `v0.1.7` (13 August).

### ✅ The build is GREEN and the draft is complete — run 32370132405, 16m14s

All four legs plus `merge mac update feed` and `verify draft release is complete` passed on the
**second** attempt (the first is §1). **15 assets**, checked directly rather than taken from the
green tick:

- both mac arches — `mac-arm64.dmg/.zip`, `mac-x64.dmg/.zip` (+ blockmaps)
- `win-x64.exe` (+ blockmap) · `linux-x86_64.AppImage` · `linux-amd64.deb`
- `latest.yml`, `latest-mac.yml`, `latest-linux.yml` (the last is inert by design)

✅ **`latest-mac.yml` lists all FOUR mac files under one `version: 0.2.0`** — the multi-arch feed
merge did its job; a single-arch feed has no symptom on the machine that cut the release.
✅ **macOS signed and notarised** — `identityName=Developer ID Application: Osborne Solutions`,
`notarization successful`, ticket stapled.

🔴 **`isDraft: true`. It is NOT published.** Nothing has reached a user or the auto-update feed.
**§3 is the remaining work**, and none of it is automatable.

Draft release notes: **`scratchpad/RELEASE-NOTES-0.2.0.md`** in the release session's scratchpad.
⚠️ Scratchpads are session-scoped — if it is gone, it is regenerable from
`git log v0.1.7..v0.2.0`, but re-read §2's "known limitations" before publishing anything.

---

## 1. The first v0.2.0 build failed on ALL FOUR legs — diagnosed and fixed

Run **32369270228**: `win32-x64`, `darwin-x64`, `darwin-arm64` and `linux-x64` all failed at
**"Build, sign, and publish the editor"**. Not a platform problem — one root cause.

```
[webpack-cli] Failed to load webpackconfigs/webpack.renderer.production.js
[webpack-cli] TypeError: pattern.match is not a function
    at webpackconfigs/helpers/get-externals-modules.js:10:33
```

**The cause.** `get-externals-modules.js` did
`packageJson.build.files.map((pattern) => pattern.match(/\!node_modules\/(.+)/))`, which assumes
every entry of `build.files` is a **string**. It is not: electron-builder also accepts
`{from, to, filter}` copy directives, and **three of them were added** to ship the render
harness inside the asar (`scripts/devtools` → `render-harness`, the node catalogs, and
`DefaultTokens.ts`). An object has no `.match`.

✅ **Fixed** — `.filter((pattern) => typeof pattern === 'string')` before the map. Verified
behaviour-preserving: the exclusion set is still exactly
`['eslint-linter-browserify', 'globals', 'lodash']`, and all three are confirmed **absent from
externals** (i.e. still bundled), which is what `905666e8` and `dd4fab3a` fixed originally.

### 🔴 The finding worth keeping: EVERY LOCAL GATE PASSED

`getExcludedNodeModules()` is only reached when `production` is true. So:

| | |
|---|---|
| `webpack.renderer.dev.js` | never calls it |
| `webpack.test-ci.js` (`test:ci`) | different config — never calls it |
| `typecheck` / `lint` / `test:main` | do not load webpack config at all |

The **only** gate covering it is `ci:build:editor` in `pr.yml`. 🔴 **`pr.yml` last ran on
2026-08-13 and failed.** The branch was **480 commits ahead of origin and 0 behind** — nobody
had pushed for a week — so *no CI gate ran on any of the 478 commits in this release*. The gate
existed and was never exercised.

⚠️ **`npm run ci:build:editor` is now the cheapest way to catch this class of defect locally.
Run it before tagging.** It is the production bundle path and nothing else touches it.

✅ **No draft was created.** `verify-release-assets` reported `release not found`, and
`gh release list` still shows **0.1.7 as Latest** — every leg died before electron-builder
published anything. So there were no partial artifacts to clean up, and reusing the `v0.2.0`
tag was clean rather than a rewrite of something someone might have pulled.

🔴 **For the NEXT failure, do not read a published artifact as evidence a job was green.**
RELEASE-PROCESS.md §2 records the v0.1.0 trap: electron-builder **uploads as it goes**, so a leg
can put an AppImage in the draft and then fail building the `.deb`. `verify-release-assets` runs
with `if: always()` and names what is missing; its rules self-test offline with
`node scripts/check-release-assets.js --self-test`.

---

## 2. Housekeeping — none of it blocks the build, all of it is real

### 2a. ✅ Two of the three ratchets are FIXED — `tsfixme` is left as a decision

Fixed in `8a17a0ad`. Verified by re-running each gate on the **committed** tree, exit codes
captured without a pipe.

| Gate | Was | Now |
|---|---|---|
| `tokens:css` | 3 properties used but never defined | ✅ **exit 0** — "every var(--…) in 319 stylesheets names a defined property" |
| `colors` | noodl-core-ui rose by 2 | ✅ **exit 0** — back to baseline 0 |
| `tsfixme` | above baseline | 🔴 **still exit 1 — deliberately not fixed, see below** |

✅ **Both mono tokens were the same NAME ERROR.** `--font-family-mono` (4 files) *and*
`--theme-font-family-mono` (`AskAboutNodeDialog.module.scss`) name nothing anywhere in the repo.
The token is **`--font-family-code`**
(`packages/noodl-core-ui/src/styles/custom-properties/fonts.css:21`) — which `InspectPopup`,
`InterviewCard`, `BuildThread` and `TokenCategorySection` already use, so the rename follows the
convention rather than inventing one. 8 occurrences across 5 files.

✅ **`--logic-overlay-height` IS host-supplied, and now says so.** `LogicOverlay.ts:149-155`
(`applyRect`) writes all four of `LOGIC_OVERLAY_VARS` onto `editor.shell.root.style` on every
drag frame. Added to `HOST_SUPPLIED` in `scripts/css-token-check.js` **with the host named**, as
the script demands. ⚠️ The doc comment in `LogicOverlay.ts` says these are "read by
`styles/nodegrapheditor.css`" — **that is stale**; the only CSS reader is
`CanvasTabs.module.scss`, whose `90vh` fallback is the height before the overlay is first opened.

✅ **The peer's file was handled without sweeping their work.** `AskAboutNodeDialog.module.scss`
carried an uncommitted background fix from 2026-08-19. The rename was committed **alone** — the
HEAD version was written out, re-renamed, committed by pathspec, then the peer's version restored
to the working tree. `git diff` on that file now shows **only their background hunk**.

### 🔴 `tsfixme` is NOT a one-line fix, and raising it is not mine to do

**+37 `TSFixme` and +125 `any`** across ~20 files — a week of phase work meeting the gate at
once. The largest single contributor is `packages/nodegx-node-kit-types/src/index.d.ts` (**+32**),
then `cn-013-cloud-kits.test.ts` (+11) and `cn-006-scaffold-runs.test.ts` (+11).

The gate's own instruction is to say so in the PR, run `npm run tsfixme:baseline`, and **commit
the raised baseline so a reviewer sees the decision** — "raising it silently is the one thing this
gate exists to stop." So the choice is: retype ~162 markers across other phases' test files, or
raise the baseline deliberately. **That is a call for Richard, not a cleanup.**

### 2b. 🔴 `test:ci` was NOT run for this release

**Not a release-workflow gate** — `release.yml` runs no tests at all. But it is the editor's
main suite and it was skipped for a stated reason, not an oversight:

> `vm.swapusage` showed **10993M used of 12288M** with a second Claude session live on the
> checkout. Memory's rule is *alone on the CHECKOUT ≠ alone on the MACHINE*; a run there
> produces flakes indistinguishable from regressions.

**To run it:** quiet machine, nothing else on the checkout, `NOODL_SPEC_SEED=39393`
(`tests/SpecRunner.html:41-42`).

- Floor to compare against: **2849 specs / 10 failures**, and **compare by NAME, not count**.
- 🔴 **Completion is the SUMMARY LINE, never `$?`** — a timed-out run exits 1 exactly like the
  clean floor, and **any pipe reports its last command**, so `npm run test:ci | tail` reports 0
  regardless.
- 🔴 **Delete `packages/noodl-editor/tests/test-results.json` first and require a fresh mtime.**
  It was last written **08:37** on 2026-08-20 and a stale one reads as a perfect pass.

### 2b′. 🔴 THE PR GATE RAN FOR THE FIRST TIME IN A WEEK, AND IT IS RED

Run **32370134956** (PR #20, `cline-dev` → `main`), the first `pr.yml` pass over any of these
478 commits. ✅ **`Build (viewer + editor bundles)` is GREEN** — independent confirmation of §1's
fix. ✅ `Typecheck`, `Test (platform-node)`, `Library check`, `Check build artefacts` green.
**Four jobs failed, and none of them is the release build:**

| Job | What it actually is |
|---|---|
| **Test (editor)** | 🔴 **DID NOT COMPLETE.** **2766 `[spec-start]` markers against a 2849 floor**, no summary line, died mid-`AIX-011 plan staging` under a flood of `Warning: we have more that 10000 listeners on this model`. **This is neither a pass nor a failure count — it is an unfinished run.** Reconcile the marker count before believing any reading; `exit 1` here is the timed-out-looks-like-the-floor trap |
| **Test (runtime, …)** | 🔴 Concrete and small: `@noodl/runtime` **1 suite failed to RUN** — `EditorConnection` is declared at `test/editorconnection.replyidentity.test.ts:23` *and* `test/editorconnection.sendqueue.test.ts:24`, colliding in one TS program scope. A duplicate-identifier error, not a behaviour failure |
| **Node catalog freshness** | 🔴 Concrete and small: *"Stale cloud node library: `cloud-node-library.json` does not match the cloud registry."* ✅ Fix is stated by the gate — **`npm run cloud-library:generate` and commit the result** |
| **Lint** | The three ratchets in §2a |

⚠️ **None of these was caused by the release commits** — they are a week of unpushed work meeting
CI for the first time. But two are one-line fixes and should not ride into 0.2.1.

#### ✅ Status after `8a17a0ad` — three of the four addressed, one left, one NOT re-measured

| Job | Now |
|---|---|
| **Test (runtime, …)** | 🔴 **STILL RED — and NOT for the reason §2b′ recorded.** The `EditorConnection` defect was real and **is** fixed (`tsc --noEmit -p .` exit 0; runtime is **139 passed** in CI). But the job fails on **`@noodl/preview`**, a *different* package in the same job — see §2b‴ |
| **Node catalog freshness** | ✅ **FIXED.** Regenerated. The diff is **26 lines, every one a colour hex** — no node type added, removed or renamed. It was a **second copy of the node palette drifting** from the cloud registry. `cloud-library:check` exit 0, and `catalog:check` / `groups:check` / `examples` / `merge:check` were **already green** |
| **Lint** | 🟡 **PARTLY.** `lint:ci`, `tokens:css`, `colors` all exit 0. **`tsfixme` still red** — §2a explains why that is a decision |
| **Test (editor)** | 🔴 **UNCHANGED AND UNMEASURED.** Nothing here touches it, and it was **not** re-run — see §2b |

🔴 **`Test (editor)` was deliberately not attempted.** `vm.swapusage` read **9465M used of
10240M** with a second Claude session live on the checkout — the same condition that stopped
§2b. A run there produces flakes indistinguishable from regressions. **It is still the one
outstanding measurement for this release.**

### 2b‴. 🔴 THE RUNTIME FIX WAS REAL, AND THE JOB IS STILL RED — measured on CI 2026-08-20 14:02

Pushed `77f0b83e`, run **32377316910**. ✅ `Node catalog freshness`, `Typecheck`, `Build`,
`Library check`, `Check build artefacts`, `Test (platform-node)` all **green**.
🔴 `Test (runtime, …)`, `Test (editor)` and `Lint` still red.

**Read the per-package summaries, not the job name.** The job is called
`Test (runtime, backend, viewer, mcp, preview)` and covers 16 packages. Its summaries:

| Run | `@noodl/runtime` | `@noodl/preview` |
|---|---|---|
| **32370134956** — the handover's run | 🔴 **1 failed**, 138 passed, and the log carries **2 `TS2451` / "Cannot redeclare"** hits | **never ran** — nx bailed |
| **32371952973** — 13:01, still pre-fix | ✅ 139 passed | 🔴 **1 failed** |
| **32377316910** — post-fix | ✅ 139 passed | 🔴 **1 failed** |

🔴 **Two corrections fall out of that table.**

1. **The `EditorConnection` fix was real but it did NOT turn this job green.** §2b′ named it as
   *the* cause because in the handover's run nx bailed before `@noodl/preview` ever ran — so the
   only failure visible was the runtime one. **A bailing task runner reports the FIRST failure as
   THE failure.** ⚠️ Do not read "1 suite failed to run" in a 16-package job as the job's cause.
2. **The runtime symptom was INTERMITTENT in jest and DETERMINISTIC in `tsc`.** Same commit,
   `139 passed` at 13:01 and `1 failed` earlier. `tsc --noEmit -p .` reported the collision
   **every** time. ✅ **`npm run test:packages` passing is not evidence the package typechecks** —
   only `tsc` is, and the root `npm run typecheck` (exit 0 throughout) never reached it either.

#### The actual `@noodl/preview` failure — pre-existing, one assertion, NOT a release regression

`tests/preview.test.ts:185`, *"watching › gates an invalid edit: diagnostics out, last good build
kept"*. 13 of 14 tests pass.

```
expect(state.state.report.diagnostics[0].code).toBe('dangling-connection');
Expected: "dangling-connection"
Received: "unknown-parameter"
```

⚠️ **`summary.errors` is still 1** (line 184 passes), so the invalid edit still produces exactly
one error — its **code changed**. That makes this a real question, not a stale snapshot: either a
validator gained an `unknown-parameter` diagnostic that now fires first on this fixture, or the
edit stopped producing the dangling connection it was written to produce. 🔴 **Establish which
before touching the assertion** — editing the expectation to match the output is how a validator
regression gets ratified. It failed at **13:01 on 2026-08-20, before any commit in this session**.

### 2b″. ✅ A FIFTH red job nobody had counted: `Test noodl/platform-node`

This is a **separate workflow** (`.github/workflows/test-platform-node.yml`), not the `pr.yml`
job of a similar name — which is why §2b′ could correctly record `Test (platform-node)` as green
while this one was failing. It is triggered by paths under `packages/noodl-platform*`.

🔴 **It was not a code failure. It could never have passed.** The workflow pinned
`node-version: 16`, while the repo's root `engines` requires `node >=22` / `npm >=10`, so
`npm install` died at `EBADENGINE` **before a single test ran**:

```
npm ERR! notsup Required: {"npm":">=10.0.0","node":">=22.0.0"}
npm ERR! notsup Actual:   {"npm":"8.19.4","node":"v16.20.2"}
```

✅ **Bumped to `node-version: 22`.** Verified locally first — `@noodl/platform-node`'s suite is
**22 passed, 3 skipped** on node 22.22.0. ⚠️ The workflow still uses `actions/checkout@v3` and
`actions/setup-node@v2` while every `pr.yml` job uses `@v4` and the shared `./.github/actions/setup`;
that was left alone as out of scope, **but it is the reason this workflow drifted unnoticed.**

### 2c. What WAS measured, so it is not re-derived

All at `3a20f46c`, exit codes captured **without a pipe**:

- `typecheck` · `typecheck:editor` · `typecheck:editor-tests` · `typecheck:nodegx-core` ·
  `typecheck:mcp` · `lint:ci` · `icons:css` — **all exit 0**
- `test:main` — **295 suites / 4831 tests / 0 failures**, 48s
- ⚠️ `typecheck:core-ui` exits **2**, and it is **in no gate**. Every error is `TS2307`
  unresolved-alias in **noodl-editor** files, because core-ui's `tsconfig.json` **overrides
  `paths`, replacing the root map rather than merging**. Structural, pre-existing —
  phase 73's session 6 recorded the same 44 errors independently. **Do not "fix" it as a
  release regression.**
- ⚠️ `library:check` **not run** — `scripts/library/check.ts` was modified in a peer's tree.

---

## 3. Publishing 0.2.0

The tag is pushed and the release is a **DRAFT**. It is invisible to the public and to
electron-updater until a human clicks Publish, which is what makes §1 safe to take slowly.

1. Resolve §1 — Linux green, or its absence decided out loud.
2. Read `verify-release-assets`. It fails naming what is missing.
3. **Verify on CLEAN machines, never a development machine** — a dev machine has already
   trusted the app and masks signing problems:
   - macOS: `spctl -a -vvv /Applications/NodeGX.app` → `accepted`, `source=Notarized Developer ID`;
     `xcrun stapler validate` → `The validate action worked!`; no Gatekeeper prompt on first launch.
   - Windows: **unsigned.** `WIN_CSC_LINK` is unset and no artifact has ever been run past
     SmartScreen. Keep the unsigned-install instructions in the **Windows** notes only —
     🔴 **do NOT paste them into the macOS notes**, macOS is signed and notarised and that text
     tells users to bypass Gatekeeper.
   - Linux: `chmod +x NodeGX-*.AppImage && ./NodeGX-*.AppImage` on a clean Ubuntu 22.04+.
4. Paste the release notes. **Keep the "Known limitations" section** — auto-update downloads
   silently and installs on quit, and without that sentence it reads as broken to the person it
   is working for.
5. **GitHub → Releases → the draft → Publish.**

🔴 **Rollback is forward, never down.** electron-updater never moves a user to a lower version.
A bad 0.2.0 is fixed by unpublishing it (edit → draft) and shipping **0.2.1**.

---

## 4. The community platform — deployed, and one thing left

✅ **Deployed and verified 12:23Z.** Service active, `https://community.nodegx.io/` 200,
sign-in 302s to github.com, Caddy serves this domain alongside its three neighbours, and all
three neighbours read **200 → 200** across the deploy. Off-site backup **12.1h old**, restore
check ok.

✅ **The mail drain is armed and it did not blast.** NAT-014's hazard was that `deploy.sh`
installs the timer unconditionally and the first drain mails weeks-old notifications to real
people through the same Brevo account the waitlist uses. It fired at **12:30:01Z**:
`{"state":"ok","sent":0,"failed":0,"backlog":{"queued":0,...}}` — the queue was genuinely
empty (2 threads, 0 replies). **Nothing was sent.** Watch it again after real activity.

### 🔴 The one open item: **the tutorial is not published, and it needs Richard's words**

`/api/v1/community/tutorials` is **200 and empty**, so the editor's Tutorials section draws its
empty line rather than a lesson, and TUT-004's one-click install has nothing to install.

**Why it was not done:** `scripts/publish-tutorial-bundle.ts` attaches a bundle to an
**existing** `articles` row and refuses otherwise (`no tutorial has the slug "log-a-thing"`).
A tutorial *is* an article with `kind='tutorial'`; `articles.body` is **`not null`**; and prod
has **no articles at all**. The bundle carries no public prose — its `docs/` are the lesson
project's own ARCHITECTURE/BRIEF/CONVENTIONS. So creating the row means **authoring a public
page at `community.nodegx.io/tutorials/log-a-thing`**, which is Richard's copy to write.

⚠️ `scripts/seed.mjs` has a comment worth reading first: an earlier version populated bodies
with `'Placeholder body.'` three times, on a phase whose closing bar was *"does not look like a
placeholder"*.

✅ **This is NOT on the release's critical path.** Tutorials are *served*, not shipped —
publishing one later reaches every 0.2.0 install with no app update.

Once the body exists:

```bash
rsync -az -e "ssh -i ~/.ssh/nexus_hetzner" \
  project-examples/lessons/log-a-thing/ root@49.12.102.195:/tmp/log-a-thing/
ssh -i ~/.ssh/nexus_hetzner root@49.12.102.195 \
  "cd /opt/nodegx-community && set -a && . /etc/nodegx-community/nodegx-community.env && set +a \
   && npx tsx scripts/publish-tutorial-bundle.ts log-a-thing /tmp/log-a-thing"
```

⚠️ `/api/v1/community/people` is also **200 and empty**. That is content, not code — the
directory draws its empty state.

---

## 5. 🔴 The property that made shipping today safe — do not lose it

Every unfinished P72/67b surface **fails closed**. A 404 becomes `{outcome:'absent'}`
([`communityapi.ts:1076`](../../../packages/noodl-editor/src/editor/src/models/community/communityapi.ts)),
`absent` becomes `{surface:'hidden'}`
([`peopleview.ts:333`](../../../packages/noodl-editor/src/editor/src/models/community/peopleview.ts)),
and `hidden` draws **nothing** — not an error, not an empty state.

It was built so D15 could refuse a pupil without narrating the door. Its side effect is that
**an old platform is indistinguishable from a deliberate refusal**, which is why the community
panel was shippable against a stale server at all.

⚠️ **The cost of that property is the diagnostic one.** "The section is missing" has three
causes — refused, endpoint absent, server stale — and they look identical from the editor.
**Diagnose from the wire, not the panel:** `curl -s -o /dev/null -w '%{http_code}'` against the
route. That is how the stale prod was found; nothing in the UI said so.
