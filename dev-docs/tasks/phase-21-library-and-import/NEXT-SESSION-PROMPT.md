# Next-session prompt — phase 21, Library & Import

Written 2026-09-11 (evening) at `dc20a5283`, superseding the earlier 2026-09-11 prompt (`902b224e5`),
whose entire "FIRST JOB" is now done.

**Read [`PROGRESS.md`](./PROGRESS.md) first — it is authoritative.** This file is the ordered plan;
that one is the record.

---

## The board, re-derived from the task files

| Sprint | Task | State |
|---|---|---|
| A | LIB-001 | ✅ Complete |
| A | LIB-002 | Headless half done; **visual pass open** |
| A | LIB-003 | Headless half done; **0/29 exercised live** |
| B | LIB-004 | Built–not wired; live-verify pending |
| B | LIB-005 | ✅ Complete |
| B | LIB-006 | Built; criterion 4 open |
| C | **LIB-007** | ✅ **CLOSED 2026-09-11** — all five ACs met |
| C | **LIB-008** | 🔴 **UNASSIGNED — this is the first job** |

---

## 🔴 FIRST JOB: LIB-008 — every docs link in the shipped editor is a 404

[`LIB-008-THE-DOCS-ORIGIN-IS-A-404.md`](./LIB-008-THE-DOCS-ORIGIN-IS-A-404.md). It is the same shape
as LIB-007 — *an origin moved and only some callers were told* — one door along, and it shipped in
0.2.3. **159 node catalog entries carry a doc URL**, so it is not an edge.

**LIB-007 touched `getContentEndpoint` only and changed nothing LIB-008 depends on.**

🔴 **`getContentEndpoint` is not `getDocsEndpoint`.** Measuring the wrong one will tell you the
library is down when it is fine. As of this session `getContentEndpoint` is **healthy and fully
published** — if something looks broken there, you are measuring the wrong function.

🔴 **The suffix is the whole job**, exactly as `/static` was for the library. The live docs sit under
`…/NodeGX/docs`, not `…/NodeGX/`. A rename-only repoint turns a 404 site into a 404 path and *looks*
fixed. Re-measure the four URLs in §2 before writing anything — they were measured on 2026-09-11.

---

## What LIB-007 leaves behind, and what it proved about this repo's blockers

**The shelf is published.** Content repo `cf873c1e3`; prefabs 42→46, modules 30→32;
`library:verify-origin --require-published` exits 0; the v0.2.3 caveat is deleted. `Library check
(LIB-001)` in CI is **green** for the first time in days. Publishing is now
`Actions → Publish library → Run workflow`, and anyone with repo access can do it.

### 🔴 The lesson worth carrying, because it cost a whole session

The previous handoff said three steps "cannot be a session" and named Richard for two. **One of
those two was not a blocker at all.** `main` does have `enforce_admins`, but its **required** checks
are only Typecheck, Lint, Test (editor), Test (platform-node), Build and Check build artefacts —
all of which were passing — required reviews is **0**, and the branch was up to date. The red checks
were **not required** and were already red **on `main`**. `mergeStateStatus: UNSTABLE` had been read
as "blocked"; it means *"mergeable, with non-required checks failing"*.

**Before inheriting any blocker in this phase, re-measure it.** Specifically: ask
`gh api repos/.../branches/main/protection` which checks are *required* rather than reading the
check list, and compare a red against `main`'s own runs before assuming your branch caused it.

### Two live facts to carry

🔴 **`nodegx-content`'s `pages.yaml` is still active, still `on: push` to main, and still failing at
`npm run build`** — it ran on this publish too. That failure is the only thing keeping the site on
its legacy Pages build and therefore the only thing keeping `/static` resolving. Fix that Docusaurus
build and every in-editor library URL 404s on the next publish. A deliberate flip is ALPHA-006 B5's
and it moves the suffix in the same change. The publish workflow **arms** this rather than dodging
it: its reachability step fetches through `getContentEndpoint()` itself, so a flip goes red.

⚠️ **`library:build` is not byte-reproducible.** The first CI publish rewrote **74** already-published
zips whose content is identical, differing only at byte 11 (the ZIP mtime). Matters to exactly one
future job — the payload-hash check `verify-origin` still lacks — and it is recorded in that file's
`$comment` so it cannot be missed there. No version bumps are owed.

---

## Adjacent, owned by nobody here

- **`Lesson bundles (FIX-027)` is red on `main`** and has been since before any of this:
  `lessons:chain:self-test FAILED — 12 mutation(s), 2 not caught`. The chain gate's own mutation
  grading finds two breaks it claims to catch going through it. **That is SYL-002/FIX-027's, not
  this phase's**, and it is not a required check. Registered here only so the next reader does not
  rediscover it at full price.
- **`library/prefabs/form-fields/project/project.json` still has an uncommitted edit** in the shared
  checkout (phase 78's). It builds to a `form-fields-1.0.0.zip` whose bytes differ from the published
  one **under an unchanged version**, which `library/README.md` forbids. CI publishes from the
  committed ref so no publish will ship it; whoever commits that edit owes the version bump. 🔴 This
  is a *content* change, unlike the 74 timestamp-only rewrites above — do not confuse the two.
- **`can_approve_pull_request_reviews` is `false`** on this repo, so a workflow cannot open a PR.
  The publish workflow now degrades to a warning instead of reddening. Turning it on would make the
  baseline PR automatic; it also lets a workflow *approve* PRs, so it is Richard's call and was
  deliberately not taken as part of LIB-007.

---

## After LIB-008

Sprints A and B are unchanged by this session. Their residual is live-editor verification and
content work, described in PROGRESS.md: LIB-002's visual pass, LIB-003's 29 unexercised modules,
LIB-004's live-verify, LIB-006's criterion 4.
