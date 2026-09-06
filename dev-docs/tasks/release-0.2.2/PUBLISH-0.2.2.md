# Publishing 0.2.2 — the runbook

_Written 2026-09-01, phase 82 session 9, as row 8 preparation. Mechanics follow the
[0.2.0 runbook](../release-0.2.0/PUBLISH-0.2.0.md), which is the precedent for how a cut is
actually done here. **Readings were taken at HEAD `60fe7e16` (s9) and re-taken at `5c805978` (s11), not relayed** —
each row says which. §2 is now DONE; §0 is still the blocker._

---

## 🔴 0. THE BLOCKER NOBODY HAD WRITTEN DOWN: THE BRANCH IS NOT PUSHED

```
git rev-list --left-right --count origin/cline-dev...cline-dev   →   0   569
git log -1 --format='%h %ad' origin/cline-dev                    →   c8180ef1  2026-08-21
```

**569 commits are unpushed — eleven days of work, and CI has run on none of it.** The fetch ref is
current (fetched 2026-09-01 17:59), so this is not a stale remote-tracking branch: it is real.

This matters more than it looks. The 0.2.0 runbook's first pre-cut check is `0 0` — *pushed and
current* — and the whole release workflow is triggered by pushing a tag. Tagging an unpushed branch
would push a tag pointing at commits GitHub has never seen.

🔴 **Pushing these commits is Richard's call, not a session's.** It is an outward-facing act on the
shared repository. Nothing below can start until it happens.

⚠️ **Re-read at session 11: `0 573`.** The count keeps growing — it was `0 569` at s9 — so **derive
it again at cut time rather than quoting any number in this file.** `origin/cline-dev` is still at
`c8180ef1`, 2026-08-21.

**After the push, and before anything else:** let the push run finish and read it. The 0.2.0
precedent expects **8 of 10 jobs green**, with `Test (editor)` and `Lint` red for known reasons
(§1).

---

## 1. Before you cut

| check | expected | reading 2026-09-01 |
|---|---|---|
| `git rev-list --left-right --count origin/cline-dev...cline-dev` | `0 0` | 🔴 **`0 573`** at s11 — see §0 |
| `npm run ci:build:editor` | exit 0 | ✅ **exit 0**, both webpack passes *compiled successfully* |
| `packages/noodl-editor/package.json` version | `0.2.2` | ✅ **`0.2.2`** — bumped and committed s11 (`5c805978`), see §2 |
| `git tag -l 'v0.2.1'` | empty | ✅ empty — 0.2.1 was never tagged |
| latest push run on `cline-dev` | 8 of 10 green | ⏳ cannot exist until §0 |
| `Test (editor)` | at the floor, failures named | ⏳ see below |

### 1a. `ci:build:editor` is green, and it is the gate that only production touches

✅ **Run this session, exit 0.** `getExcludedNodeModules()` is only reached when `production` is
true, so the dev config, `test:ci`, `typecheck`, `lint` and `test:main` never load it. The first
`v0.2.0` build failed on all four platforms with every local gate passing, for exactly this reason.
It is green at `60fe7e16` — but **re-run it after the version bump**, because that is a change to
a file the build reads.

### 1b. The editor test floor — re-derive it, do not carry it

🔴 **Do not take a floor from a handoff.** The 0.2.0 runbook recorded **4 failures, all
`AIX-006 style vocabulary`**; phase 80 later recorded an editor floor of **5**. A stale-high floor
hides regressions. Read the failures **by name** against `git log`, not against a remembered count.

---

## 2. The version bump — ✅ DONE, session 11, commit `5c805978`

✅ **`packages/noodl-editor/package.json` now reads `0.2.2`.** One line, committed alone by
pathspec. `artifactName` interpolates `${version}` into every asset filename, so a stale version
would have produced a draft full of `NodeGX-0.2.0-*` files under a `v0.2.2` tag.

**Re-derived, not relayed** — the s9 claim that it is "the only `0.2.x` version literal in the repo"
is *nearly* right and worth stating precisely, because a grep does not agree with it:

- Nine `library/prefabs/*/library.json` files also read `0.2.0`. They are **not** the product
  version: sibling prefabs read `1.4.0`, `0.5.0`, `2.0.0`, `1.6.0`, so this is an independent
  per-prefab space. **Do not bump them.**
- Everything else that greps is a fixture (`nodegxVersion` in two `nodegx-export` fixtures), test
  data (`autoupdater.test.js`, `cn-016/moduleCompatibility.test.ts`) or a comment.

**Both runtime consumers were checked before the bump**, and neither changes behaviour:

- [`main.js:278`](../../../packages/noodl-editor/src/main/main.js#L278) does
  `app.getVersion().split('.').slice(0, 2).join('.')` for the local-docs probe → `"0.2"` either way.
- [`autoupdater.js:41`](../../../packages/noodl-editor/src/main/src/autoupdater.js#L41) reports
  `currentVersion` to the update feed. This is exactly the value that *should* move.
- [`scripts/check-release-assets.js`](../../../scripts/check-release-assets.js) **derives**
  filenames from `productName`/`version` rather than hard-coding them, so the checker needs no edit.

✅ **Gate re-run after the bump, as §1a requires: `npm run ci:build:editor` exit 0**, both webpack
passes *compiled successfully* (52s and 2s). Read from an exit file written by the command itself,
not from the wrapper's status line.

### 🔴 The lockfile: it looks like a gate, and it is not

`package-lock.json` carries its own copy of the editor version at
`"packages/noodl-editor"`, and **CI installs with `npm ci`**
([`.github/actions/setup/action.yml:45`](../../../.github/actions/setup/action.yml#L45)) — which is
the command that fails when a lock is out of sync. So this looks like it must move too.

**It must not, and the measurement that settles it is the last release:**

```
git show v0.2.0:packages/noodl-editor/package.json  → "version": "0.2.0"
git show v0.2.0:package-lock.json                   → "version": "0.1.7"
```

🔴 **At the `v0.2.0` tag the two disagreed by a whole release** — the exact mismatch shape this bump
creates — **and that tag produced a real signed release through a workflow that runs `npm ci`.**
`npm ci --dry-run` against the bumped `package.json` also exits 0 here. The lock's own `version`
field is not part of what `npm ci` validates.

⚠️ **There is a second reason not to touch it:** `package-lock.json` currently carries an unrelated
in-flight edit (a `@nodegx/export` workspace entry, plus that same `0.1.7 → 0.2.0` catch-up) that
belongs to another session. A pathspec commit of it would take someone else's work.

## 3. The cut

```bash
# tag at the tip you actually want, checked first
git tag v0.2.2 <sha>
git push origin v0.2.2
```

✅ **`5c805978` — the version bump — is the natural tag point or later.** Anything earlier carries
`0.2.0` in `artifactName`. Confirm with `git show <sha>:packages/noodl-editor/package.json | head -8`
before tagging rather than trusting the tip.

⚠️ **If a draft or tag already exists, delete the RELEASE first, then the tag** — deleting the tag
while a release still points at it leaves a release referencing nothing:

```bash
gh release delete v0.2.2 --yes
git push --delete origin v0.2.2
git tag -d v0.2.2
```

The tag push triggers the release workflow: **~16 minutes** across four legs plus
`merge mac update feed` and `verify draft release is complete`.

### What the finished draft must contain — 15 assets, checked directly

Both mac arches (`mac-arm64.dmg/.zip`, `mac-x64.dmg/.zip` + blockmaps), `win-x64.exe` (+ blockmap),
`linux-x86_64.AppImage`, `linux-amd64.deb`, and `latest.yml` / `latest-mac.yml` /
`latest-linux.yml`.

- ✅ **`latest-mac.yml` must list all FOUR mac files under one `version: 0.2.2`.** A single-arch
  feed has no symptom on the machine that cut the release.
- ✅ **macOS must report `notarization successful`** with a stapled ticket.
- 🔴 **Do not read a published artifact as evidence a job was green.** electron-builder uploads as
  it goes, so a leg can put an AppImage in the draft and then fail building the `.deb`.
  `verify-release-assets` runs `if: always()` and names what is missing;
  `node scripts/check-release-assets.js --self-test` self-tests its rules.

### 🔴 What the 2026-09-06 cut actually did — read this before re-cutting

The tag went up and the run **failed**. Run
[`34030632269`](https://github.com/The-Low-Code-Foundation/NodeGX/actions/runs/34030632269):
linux ✅, win32 ✅, **darwin-arm64 ✗**, **darwin-x64 ✗**, `merge mac update feed` ✗,
`verify draft release is complete` ✗. The draft holds **6 of 15 assets** — the three linux files
and the three windows ones — and **no macOS build at all**.

🔴 **Both mac legs died with `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap
out of memory` in `webpack.renderer.production.js`.** Not signing, not notarisation: that step runs
*before* both, and windows — which signs — passed. V8 sizes its default old-space from system RAM,
the `macos-26-arm64` runners give node 2048 MB, and the renderer bundle grew past 2 GB during
0.2.x. See **REL-018**; the fix is `scripts/webpackHeapCeiling.ts`.

⚠️ **The failure is invisible from the two platforms most people build on.** Linux and Windows
runners have 16 GB and a ~4 GB default heap, so they built the identical bundle green. The nightly
was green on both mac legs that same morning **because it builds `main`, 1823 commits behind**.
Nothing local reproduces this; only a mac CI build grades it.

🔴 **`verify-release-assets` did its job and nobody was there to read it.** This is F73's lesson
recurring: a draft with files in it is not evidence of a green run. **Read the run, not the draft.**

**Recovery — release first, then tag, then re-cut:**

```bash
gh release delete v0.2.2 --yes          # the release BEFORE the tag, or it references nothing
git push --delete origin v0.2.2
git tag -d v0.2.2
# ... land the REL-018 fix, then re-cut per §3 above
```

⚠️ **Re-publishing the members' area is NOT part of this.** REL-001 is a separate moment: the
community shelf row is live and independent of the tag, and it was confirmed still serving
`fileCount: 100` after the failed run.

---

## 4. The notes

Two documents, per Richard's ruling of 2026-09-01:

- **The full log** — the
  [NodeGX 0.2.2 artefact](https://claude.ai/code/artifact/70d4e79e-78ce-44c8-b9f5-e06c6b0b6d11).
  🔴 **Its stat band is stale (559) and its ship-gate section still lists TPL-001 as unpublished.**
  Re-read both against reality at tag time; the count on 2026-09-01 was **573**.
  ⚠️ Viewers are currently pinned to an earlier version, not the live one.
- **The GitHub release body** — highlights plus a link to the artefact. Draft in
  [`RELEASE-NOTES-0.2.2.md`](RELEASE-NOTES-0.2.2.md).

🔴 **The notes must say that 0.2.1 was an internal cut held back as too buggy**, so the gap in the
numbering does not read as a lost release.

---

## 5. Verify, then publish

🔴 **Verify on CLEAN machines, never a development machine** — a dev machine has already trusted
the app and masks signing problems.

---

## 6. What row 8 does NOT wait for — and the one ordering that does matter

✅ **The template publish (row 7) is a separate moment** — Richard's ruling G5a. The shelf is a
database row written by `publish-project-template.ts`; the tag is a GitHub release. Neither blocks
the other **mechanically**, and row 7 can go first.

🔴 **But it should go first, and "neither blocks the other" was read as "the order does not
matter".** G5a is a ruling about *mechanism*; the consequence for a reader is the opposite. The
create wizard and the new Templates tab draw the embedded shelf **plus** whatever the community
shelf serves, and until `publish-project-template.ts` has run the second half is nothing.

⚠️ **SUPERSEDED LATER THE SAME DAY — the measurement below was true and is not any more, and it is
kept because it is what the ruling was taken on.** Richard ruled the site builder **PASSABLE** on
2026-09-05 and asked for it on the shelf; `HELD_TEMPLATE_IDS` now holds `hello-world` alone, and
`EmbeddedTemplateProvider.list()` returns **one row**, `embedded://site-builder`.

> **As measured 2026-09-05, before the ruling:** `EmbeddedTemplateProvider.list()` returns **zero
> rows** in 0.2.2 — `HELD_TEMPLATE_IDS` holds both `hello-world` (it is the blank project) and
> `site-builder` (Richard's D1) — so the create wizard and the new Templates tab draw **only** what
> the community shelf serves.
>
> ✅ **Driven in the running app 2026-09-05, both surfaces, launcher only** — the Templates tab
> reads *"No templates published yet"* and the create wizard's picker reads *"There are no templates
> to start from right now"* with **`Next` disabled**. 🔴 **Read as the genuine empty state, not a
> failed fetch**: the tab's other empty state is *"Templates could not be loaded"* and it did
> **not** render, so the community request completed and returned nothing. ⚠️ That is a reading
> against a dev stack's endpoint; it does not by itself prove the **production** shelf is bare.

**So the shelf is no longer bare, and the reason to run row 7 first is now narrower and still
real**: these notes headline the members' area by name, and a 0.2.2 tagged before the publish
offers a reader the site builder under a paragraph promising them an association's members' area.
Nothing is broken and no gate is red; the release is simply wrong about itself for as long as the
gap lasts. **Run row 7, confirm the row is live, then tag.**

✅ **RETAKEN 2026-09-05 against the unheld shelf, both surfaces, launcher only** — and it was
written down as a prediction *first*, then measured.

| surface | reading |
|---|---|
| Templates tab | facets **`All (1) ✓` / `Site (1)`**, one row: **Site Builder**, its description, chips `Site` and `Built in`, `Use this template →` |
| create wizard | *Start from a Template* → Project Basics → `Next` → **Choose a Template**, same facets, same row |

🔴 **`Next` is the discriminating half, and it was read on BOTH sides of the selection**: with the
row drawn but nothing chosen it is **`disabled: true`**; on clicking the row it is **`disabled:
false`** and the card reads `aria-pressed="true"` / *"✓ Selected"*. The empty-shelf reading above
recorded `Next` disabled with **nothing to select** — so "disabled" alone would have been the same
character in both worlds, and only the transition separates them.

Pictures: [`notes/rel-011c-unhold-2026-09-05/`](../phase-82-0.2.2-the-first-row-on-the-shelf/notes/rel-011c-unhold-2026-09-05/).

⚠️ **Neither empty-state sentence rendered** — not *"No templates published yet"* and not
*"Templates could not be loaded"*. ⚠️ Still a reading against a dev stack; it says nothing about the
**production** community shelf, which remains bare until row 7 runs.

✅ **THE LANDING PAGES (TPL-003) NEED NO PUBLISH — THEY ARE EMBEDDED, LIKE THE SITE BUILDER.**
Richard, 2026-09-05, after ruling them in: *"I want to make it one of the packages templates like
the members area and site builder."* So `landing-pages.content.json` is compiled into the editor
beside `site-builder.content.json`, registered in `EmbeddedTemplateProvider`, and the shipped
shelf offers **two** rows the day 0.2.2 installs: `embedded://site-builder` and
`embedded://landing-pages` (`sbr-001/template-needs-backend.test.ts` pins the whole list). Nothing
to run here for it. ⚠️ The members' area is NOT embedded — it is the shelf row above, and it is
still yours to publish.

(A curated copy still exists at `templates/landing-pages/` — the same build writes both shapes and
the gate holds both — and it passed the platform's own validators on 2026-09-05: 66 text files, 0
binary, `has-home`. If it is ever wanted on the community shelf as well, the command is in
`TPL-003-THE-LANDING-PAGES.md`; today that would list the same template twice.)

⚠️ Preconditions for row 7 re-checked at HEAD on 2026-09-05, all green: four top-level entries,
**100 files** (`32 × 3 + 4`, the figure `tpl001Template.test.ts` §1's control asserts), no
`.mcp.json` / `CLAUDE.md` / `.gitignore`, no `.env` / `*.key` / `*.pem`, no absolute developer path
and no credential-shaped literal in any file, and the committed artefact **byte-identical to a fresh
generate** (`tpl001Template.test.ts`, 82/82, `EXIT=0`). The submission file's "94 files" is the
09-01 figure and is superseded.
