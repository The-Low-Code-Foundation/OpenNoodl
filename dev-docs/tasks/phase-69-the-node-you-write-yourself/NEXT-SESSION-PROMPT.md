# Phase 69 is CLOSED (20/20). This file exists to hand off what OUTLIVES it.

**Written 2026-08-18, end of s32.** There is no RUN 4. CN-016 closed the campaign, its acceptance
criteria were driven in a live editor, and [README.md](README.md) is the record. **Do not start a
session here.** What follows is the work this phase *created* elsewhere, and the two things a next
session must not misread.

---

## 1. 🔴 Two defects the closing drive found. Neither is phase 69's. Both are real.

Written up in [notes/cn-016-drive-observations.md](notes/cn-016-drive-observations.md).

### a. `await filesystem.writeFile()` is a no-op with a DEAD error path — **worth its own task**

`FileSystem.writeFile(path, content, callback)`
(`packages/noodl-editor/src/editor/src/utils/filesystem.js`) is callback-style and returns
`undefined`. **Thirteen call sites `await` it with no callback.** Each one:

1. **does not wait** — success is recorded before the write completes;
2. **throws an uncaught `TypeError` per write** (measured: exactly two per project import, matching
   the two files `writeImportReport` writes);
3. 🔴 **has an unreachable `try/catch`** — the failure goes to a callback that does not exist, so
   **a failed write is reported as a successful one.**

`nodesharecontext.ts:125` calls `.then()` on the `undefined` return and is already dead code.

✅ **The fix**: return a promise when no callback is passed. It strictly improves all thirteen.
⚠️ **Why it is not a five-minute change**: it is a shared primitive in a **`.js`** file, which is
invisible to every gate but `test:ci`. Grep the callers, change it, run `test:ci` **alone**.

### b. A deploy publishes the project's bookkeeping

`CLAUDE.md`, `IMPORT-REPORT.md`, `import-report.json` and `noodl_modules/kit-provenance.json` all
ship into the deployed folder — the last carrying the URL a kit came from and a consent timestamp.
CN-017 was deliberate that a provenance record does **not** travel with an *export*; a deploy is the
more public of the two. A decision for whoever owns `build/ignore.ts`, not a bug to fix blind.

## 2. 🔴 What "20/20" does NOT license anyone to say

**The library is not certified fit to publish.** ~9 shipped modules vendor large third-party
libraries with **no licence text**, and **mapbox-gl v2+ is proprietary**. That is **P65 LBR-007**,
untouched by this phase, and no licence audit of the 29 shipped modules was done. A peer flagged
that "20/20" reads as the licensing question being answered — it is not.

**Nothing publishes `library/`** either; that is **P65 LBR-001**. `library:verify-origin` now fails
the build when the origin and `library/` diverge *differently than the baseline records*, which stops
the gap widening unnoticed — but it compares **coverage by label, not content**, and says so in its
own output. When LBR-001 lands, `unpublished` in `scripts/library/origin-baseline.json` should empty
and that script is where a payload-hash check belongs.

⚠️ **One inherited premise this phase corrected twice, so it does not come back:** *"the CDN serves
2024 content"* was measured **before** the 2026-08-13 repoint and is **false**. The origin is live:
**29/29 prefabs and 26/30 modules match by label**, and the four that do not are exactly the entries
this repo has authored since the last publish.

## 3. What phase 69 handed to other phases

| where | what |
|---|---|
| **P65** | LBR-001 (publish `library/`) and LBR-007 (licences) both still gate whether any of this reaches users. LBR-006's real case is **Shake Detector** — a `type: 'module'` entry shipping **zero** `noodl_modules/`, so it installs with the **overwrite** default rather than keep-yours. `library:verify-dist` now prints that as a NOTE. |
| **P70** | `render_report` serves only one path — tasked as **EL-009**. |
| **anyone touching kits** | There is **no kit version anywhere**: the entry declares one, nothing carries it into the project, the scaffold writes none, and `MANIFEST_SCHEMA` has no `version`. Any "update the kit" feature starts by deciding where a version lives. |

## 4. If you are picking up a gate here

- 🔴 **`test:ci` must run with NOTHING else on this checkout.** s32 ran it beside `test:main` and
  three typechecks and it **timed out at 900s without reporting results** — which exits **1**, and a
  clean floor run also exits 1. **A run with no summary line is not a measurement.** Delete
  `packages/noodl-editor/tests/test-results.json` first; note it is not written at all on a timeout,
  so its absence is itself a failure signal.
- ⚠️ **Compare failures BY NAME, not by count.** The count moves as tests land.
- 🔴 **Re-measure. Never quote a handover's numbers** — including this one's.
