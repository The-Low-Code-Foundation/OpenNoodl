# Publishing 0.2.2 — the runbook

_Written 2026-09-01, phase 82 session 9, as row 8 preparation. Mechanics follow the
[0.2.0 runbook](../release-0.2.0/PUBLISH-0.2.0.md), which is the precedent for how a cut is
actually done here. **Every reading below was taken this session at HEAD `60fe7e16`, not relayed.**_

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

🔴 **Pushing 569 commits is Richard's call, not a session's.** It is an outward-facing act on the
shared repository. Nothing below can start until it happens.

**After the push, and before anything else:** let the push run finish and read it. The 0.2.0
precedent expects **8 of 10 jobs green**, with `Test (editor)` and `Lint` red for known reasons
(§1).

---

## 1. Before you cut

| check | expected | reading 2026-09-01 |
|---|---|---|
| `git rev-list --left-right --count origin/cline-dev...cline-dev` | `0 0` | 🔴 **`0 569`** — see §0 |
| `npm run ci:build:editor` | exit 0 | ✅ **exit 0**, both webpack passes *compiled successfully* |
| `packages/noodl-editor/package.json` version | `0.2.2` | 🔴 **still `0.2.0`** — see §2 |
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

## 2. The version bump

🔴 **`packages/noodl-editor/package.json` still reads `0.2.0`.** It is the only `0.2.x` version
literal in the repo (the root `package.json`'s `1.1.0` is the monorepo, not the product). It must
become `0.2.2` **before** tagging — `artifactName` interpolates `${version}` into every asset
filename, so a stale version produces a draft full of `NodeGX-0.2.0-*` files under a `v0.2.2` tag.

Commit the bump on `cline-dev`, push it, then tag that commit.

---

## 3. The cut

```bash
# tag at the tip you actually want, checked first
git tag v0.2.2 <sha>
git push origin v0.2.2
```

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

## 6. What row 8 does NOT wait for

✅ **The template publish (row 7) is a separate moment** — Richard's ruling G5a. The shelf is a
database row written by `publish-project-template.ts`; the tag is a GitHub release. Neither blocks
the other, and row 7 can go first.
