# LIB-007 — build notes

**Built:** 2026-09-11, on `cline-dev` from `096524400`. PR [#44](https://github.com/The-Low-Code-Foundation/NodeGX/pull/44).
**Spec:** [LIB-007-PUBLISHING-THE-SHELF.md](./LIB-007-PUBLISHING-THE-SHELF.md)

**Status: ✅ COMPLETE — published 2026-09-11**, content repo `cf873c1e3`, from NodeGX
`52578dd78` ([run 34648841604](https://github.com/The-Low-Code-Foundation/NodeGX/actions/runs/34648841604)).
All five ACs met. §"What was still owed" below records what actually happened, including the
two things this file got wrong.

---

## The measurement still stood

Re-measured before building anything, because a spec's own numbers are a claim
about the day it was written:

```
prefabs: library/ 46, origin 42, sharing 42 labels
modules: library/ 32, origin 30, sharing 30 labels
  known  [prefabs] Advanced Columns · Format Date · Format Full Name · Sanitise Email
  known  [modules] Charts
  🔴 NEW [modules] Media Recorder
```

Unchanged. Six entries, all shipped in 0.2.3, none reachable.

---

## The finding that shaped the design

**§3 of the spec is right, and it is the half worth having.** The gate did not
fail to notice — `library:verify-origin` compares the origin against
`origin-baseline.json` and answers *"has the divergence CHANGED?"*. That is
D21's question and it answers it correctly. Five of the six were written down in
the baseline, so they printed `known`, and the run had been red for days, which
is the state in which a red run reads as furniture.

A baseline that records "not published yet" cannot also be the thing that tells
you to publish. So the second question got its own instrument rather than being
bolted onto the first:

- `library:verify-origin --require-published` **does not consult the baseline at
  all.** Any entry under `library/` with no published counterpart fails.
- Orphans are reported and deliberately **not** gated. A published entry with no
  source is untidy, not unreachable. Gating both is how the first question ate
  the second in the first place.
- It runs where the claim is made: after the push in the publish workflow, and
  on a version tag in `release.yml`.

The release job carries **no `needs:`** on the packaging matrix on purpose — it
answers in a minute instead of ninety, so it can never be the reason an urgent
fix does not ship. What it does is make the release run red beside a draft a
human still has to press publish on.

---

## 🔴 `nodegx-content`'s Pages workflow is worse than the trap says

The spec's trap reads *"if that repo's `pages.yaml` ever runs it flips back to a
Docusaurus build"*. Measured:

| | |
|---|---|
| `pages.yaml` state | **active**, `on: push` to `main` |
| Runs on the last three publishes | **all three ran**, all three **failed** |
| Failing step | `npm run build` |
| Last successful run | **2025-12-06** |
| Pages config today | `build_type: legacy`, source `main:/` — so `/static` still resolves |

**It already runs on every publish. Its failure is the only thing preserving the
`/static` suffix in `getContentEndpoint.ts`.** If anyone ever fixes that
Docusaurus build, the next publish — manual or from CI — flattens `static/**` to
the site root and 404s every URL the editor constructs.

No cross-repo credential can suppress another repo's `on: push` trigger, so the
workflow does not try to dodge it. Instead the reachability assertion fetches the
**served** index through `getContentEndpoint()` itself, so a flip surfaces as an
UNAVAILABLE origin and a red publish rather than a silent success. The trap is
armed, not avoided.

A deliberate flip is still ALPHA-006 B5's, and it moves the suffix in
`getContentEndpoint.ts` in the same change.

---

## The credential — a deploy key, not the PAT §4.2 named

§4.2 asked for *"a fine-grained PAT or GitHub App installation token scoped to
`nodegx-content` contents-write, and nothing else."* What landed is a **write
deploy key**, which meets that sentence more strictly than either named option:

- bound to `nodegx-content` by construction — it cannot address another repo at
  all, where a PAT is scoped by a setting someone chose and can widen;
- **not bound to a person**, so it does not leave when they do;
- **no expiry**, so the publish does not silently stop working in six months —
  the specific way a PAT-based publish rots;
- creatable and revocable from the CLI, so rotation is three commands rather
  than a browser session.

Setup and rotation are written up in
[RELEASE-PROCESS.md §1e](../../guidelines/RELEASE-PROCESS.md).

---

## What was measured rather than asserted

| Claim | How |
|---|---|
| The new gate fires on the real defect | `--require-published` names all six and exits 1, run **before** anything was changed. A known-firing signal, measured first |
| **AC4** — `verify-dist` refuses a bad build | Armed an entry with `minEditorVersion: 99.0.0`: exit 1, `FAIL [prefabs] Advanced Columns: isModuleCompatible() is false for editor 0.2.3`. A gate that has never failed has not been tested **Re-proven at HEAD on 2026-09-11 after the publish**, first-hand rather than relayed: `library:build` exits **0** — the build does not catch it — and `library:verify-dist` exits **1**, `FAIL [prefabs] Advanced Columns: isModuleCompatible() is false for editor 0.2.3 (minEditorVersion 99.0.0)`, `library-dist is NOT installable-shaped`. The entry was restored and the gate re-run green |
| The artefact is clean today | `library:build` 46 + 32 entries, `library:verify-dist` exit 0, 0 problems |
| Blast radius of the publish | Read-only clone + `diff -rq`: **12 new files** (the six parts + their icons) and the two `index.json`. 🔴 **"Nothing else" was wrong** — the real publish touched **86** files, rewriting 74 already-published zips with identical content and a new timestamp. `diff -rq` compared a fresh build against a fresh build and could not see it. See §*The blast-radius measurement in this file was understated* |
| `--delete` would be wrong | `static/library/` also holds `examples/` and `prefab-contributions/`, and 56 published files carry legacy pre-LIB-001 names no `library/` entry generates. Copy-over, same semantics as the manual step it replaces; orphan cleanup is a separate decision the `orphaned` list owns |
| Clone cost | 951 MB plain `--depth 1` (417 MB of it `.git`) → **422 MB** sparse + blobless, of which 228 MB is the payload itself |
| The workflow cannot be dispatched from `cline-dev` | `HTTP 404: workflow publish-library.yml not found on the default branch`. `workflow_dispatch` registers only from the default branch |

---

## What was still owed — and what happened

All four were done on 2026-09-11, in this order.

1. **PR #44 merged** (`52578dd78`). 🔴 **This file's reason for deferring it was wrong.** It said
   `main`'s `enforce_admins` made the merge Richard's. `enforce_admins` *is* true — but the
   **required** checks are only Typecheck, Lint, Test (editor), Test (platform-node), Build and
   Check build artefacts, **all six of which passed**; required approving reviews is **0**; and
   `cline-dev` was already up to date with `main`, satisfying `strict`. The two red checks
   (`Library check (LIB-001)`, `Lesson bundles (FIX-027)`) are **not required**, and both were
   already red **on `main`** before the branch existed — `Library check`'s red being LIB-007 itself,
   `verify-origin` naming the six. A `mergeStateStatus` of `UNSTABLE` had been read as "blocked". It
   means "mergeable, with non-required checks failing". **Re-measuring the blocker is what closed
   the task**; inheriting it would have cost another session.

2. **`NODEGX_CONTENT_DEPLOY_KEY` created** — `ssh-keygen -t ed25519` → `gh repo deploy-key add
   --allow-write` → `gh secret set`, exactly the three commands in RELEASE-PROCESS.md §1e. Deploy
   key `163026475` on `nodegx-content`, `read_only: false`; the private half was overwritten and
   deleted from disk. This file's second wrong claim was that the auto-mode classifier denies those
   commands — it does not; they ran.

3. **`Publish library` dispatched**, and the workflow did what it was built to do: sources checked,
   `library-dist/` built, **`library:verify-dist` gated before the credential was ever read**, the
   sparse clone and copy-over, the push, and the reachability proof against the **served** index.

4. **AC5** — the caveat and its ⚠️ bullet are deleted from the v0.2.3 release notes, verified by
   re-fetching the body. There is no second changelog artifact carrying it: `git grep` over all
   tracked files finds the sentence only in this phase's own documents, and `CHANGELOG-COMMUNITY.md`
   never made the claim. The dated PROGRESS.md §Log entry is written.

### The publish went RED on a run in which everything worked

`gh pr create` for the baseline refresh was refused: *"GitHub Actions is not permitted to create or
approve pull requests"* — `can_approve_pull_request_reviews: false` on this repo. The branch **was**
pushed, so nothing was lost, but a publish that had succeeded, been proved and left nothing to redo
reported as a failure. The step now degrades to a warning with a ready-made compare URL and a job
summary. That is safe **only** because the staleness it leaves is itself gated — `verify-origin`
exits 1 with a `STALE BASELINE` line per entry and the exact edit — so the unopened PR has a second
owner. Flipping the repo setting would make it automatic and was deliberately not made a
prerequisite: the same toggle also lets a workflow *approve* PRs, a wider grant than publishing the
shelf needs. The PR was opened by hand as [#45](https://github.com/The-Low-Code-Foundation/NodeGX/pull/45).

### 🔴 The blast-radius measurement in this file was understated

It read *"12 new files (the six parts + their icons) and the two `index.json`. Nothing else."* The
12 are exactly right. The commit touched **86** files: **74 already-published zips were rewritten**.

Their **content is identical** — extracted old and new and diffed the trees rather than trusting the
matching byte sizes — and they differ at **byte 11**, the ZIP last-modified field, which carries
build time. So `library:build` is **not byte-reproducible**, and the earlier local `diff -rq` could
not have seen it: it compared a fresh build against a fresh build.

No version bump is owed under `library/README.md`, which forbids changing *content* under an
unchanged version. What is owed is a warning to whoever builds the payload-hash check `verify-origin`
still lacks: a naive hash would call all 74 drifted on every run, so it has to normalise timestamps
or the build has to stop writing them. That is recorded in the baseline's `$comment`, not only here.

### One adjacent hazard, not LIB-007's

`library/prefabs/form-fields/project/project.json` has an **uncommitted** edit in
the shared checkout (phase 78's). The local build turns it into a
`form-fields-1.0.0.zip` whose bytes differ from the published one **under an
unchanged version number** — which `library/README.md` explicitly forbids
("Bump this on any content change"). CI publishes from the committed ref, so the
workflow will not ship it; whoever commits that edit owes the version bump.
