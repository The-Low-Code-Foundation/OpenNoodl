# Release 0.2.0 — next session

**Written 2026-08-20, end of the release session.** This file is the working state of the
0.2.0 release, not a phase. Read [RELEASE-PROCESS.md](../../guidelines/RELEASE-PROCESS.md)
before touching anything in §3.

---

## 0. Where this got to

| | |
|---|---|
| `3a20f46c` | `chore(release): 0.2.0` — the version bump, committed with a **pathspec** so a peer's two in-flight files stayed out |
| `v0.2.0` | tag pushed 12:31Z, triggering run **32369270228** |
| `b2aeaad` (nodegx-community@main) | deployed to nexus-1 12:23Z — the reason any of the new community surfaces have data at all |

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

### 2a. 🔴 Three ratchets are RED on `cline-dev`

Pre-existing on committed work, **not** caused by the release, and **not** run by
`release.yml` — but they are red on the PR gate right now.

| Gate | What it says |
|---|---|
| `tokens:css` | **3 custom properties used but never defined.** `--font-family-mono` in **4 files**, `--logic-overlay-height` in `CanvasTabs.module.scss`, `--theme-font-family-mono` in `AskAboutNodeDialog.module.scss` |
| `colors` | **noodl-core-ui rose by 2** — hex literals in `preview/launcher/Launcher/components/LearnerPathSection/LearnerPathSection.module.scss`. Baseline 0 |
| `tsfixme` | count rose above baseline; largest are `cn-006-token-defaults.test.ts` (+5), `NodeComponentMark.test.ts` (+4), `paste-carries-labels-and-comments.spec.ts` (+4), `NodePickerSearch.test.ts` (+4) |

✅ **`--font-family-mono` is a NAME ERROR, not a missing token.** The real one is
**`--font-family-code`**, defined in
`packages/noodl-core-ui/src/styles/custom-properties/fonts.css:21`. A `var()` naming nothing
renders its fallback silently, and one of the four files is
`components/community/Community.module.scss` — so **mono text in the new community UI is
falling back to the body font** on the build that just shipped. Cosmetic, real, one rename.

⚠️ **`AskAboutNodeDialog.module.scss` was a peer's uncommitted file during this session** —
that is why `--theme-font-family-mono` was left alone. **Check `git status` before assuming it
is yours to fix.**

⚠️ **`--logic-overlay-height` may legitimately be host-supplied at runtime.** The checker has a
`HOST_SUPPLIED` list for exactly that. Establish which it is before adding it — the script says
to name the host.

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
