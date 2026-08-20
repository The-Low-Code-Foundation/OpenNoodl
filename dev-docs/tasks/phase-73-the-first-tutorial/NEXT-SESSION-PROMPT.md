# Phase 73 — next session

**Written 2026-08-20, end of session 3.** Read [README §0](README.md) and [TASKS.md](TASKS.md)
first; this file is the working state, not the phase.

---

## 1. Built vs. driven

| Task | Built | Driven | Note |
|---|---|---|---|
| **TUT-001** one database, not forty | ✅ | ✅ | all six ACs close; committed `6ba357e9` |
| **TUT-002** a condition that can see data | ✅ | 🟡 **half** | all seven ACs close; committed `b73b5972`. The **sidecar** filler is driven against four real backends; the **renderer** filler is specced underneath and not driven end to end — see §4 |
| **TUT-003** the tutorial itself | — | — | 🔴 **no longer blocked by TUT-002. Blocked on R3 only** |
| **TUT-004** one click from the panel | — | — | blocked on TUT-003, NAT-005/006, and **R2** |

**Built-but-undriven: the renderer half of TUT-002's filler**, and the honest way to drive it is to
author TUT-003 against it — which is what the next session should do the moment R3 lands.

## 2. Gate readings — 2026-08-20, tree at `6ba357e9`

| Gate | Reading | |
|---|---|---|
| `typecheck:editor` | **exit 0** | process exit, not a grep of the output |
| `typecheck:mcp` | **exit 0** | stricter than `typecheck:editor`; run both |
| `test:main` | **279 / 280 suites · 4538 / 4539 tests** | 🔴 the one failure is **not mine**: `uni-001/session-readers` on a peer's untracked `src/editor/src/hooks/useCommunityPeople.ts` (phase 72 NAT-008), which their next commit fixes. Two peers confirmed it independently |
| `noodl-mcp` jest | **55 suites / 648 tests, 0 failures** | ⚠️ `tests/provision.test.ts` failed once under parallel load and passed alone and on a clean re-run — it spawns a real backend. A lone red there is a flake until re-run |
| `tests-unit/tut-002/` | **70 tests, 5 files** | 8 controls red-then-restored |
| MCP resident surface | **8,223 / 8,280 tokens, 20 tools** | the `lesson` group is **deferred**, so nothing added this session is billed against the gate |
| `test:ci` @ `NOODL_SPEC_SEED=39393` | **`Jasmine: 2849 specs, 10 failures`** | ✅ re-measured 08-20 08:27 on this tree — the floor, and the same 10 by name (4× AIX-006 · 2× AI model registry · 1× AIX-011 · 3× SUB-011) |

🔴 `test:ci` exits **1** at a clean floor, and a 600s tool timeout promotes it to background and
reports **exit 0** regardless. Completion is the `Jasmine:` line. Never `$?`, never through a pipe.

## 3. 🔴 Start here: R3, then TUT-003

TUT-002 is done and TUT-003 is now blocked on **one ruling and nothing else**:

> **R3 — does the tutorial ship its collection pre-made, or does the learner create it?**

Both are gradeable now, which is new. What changed the question:

- **Learner-creates** is what the three verbs were built for, and F1 will check the collection name
  against the bundle's own projects, so a typo is caught before install.
- **Pre-made** is now the *riskier* one to grade, not the safer one: with a snapshot in play, a
  `collectionExists` step whose collection ships pre-made is **already satisfied in the starter**,
  which is F2′ — and the harness is right to say so.

⚠️ **Do not grade `hasColumns` against a system table.** Confirmed on real backends: `/admin/schema`
pairs `sqlite_master` with `_Schema` *by exact name*, so a table the backend created itself comes
back with `columns: []` and `hasColumns` answers false forever. `User`, `Conversation` and one
`Puppy` all did this on this machine.

Order once R3 lands:

1. **Author TUT-003's solution**, then `derive_starter`, then `check_lesson`.
   ✅ Pass `backend_id` to `check_lesson` to have the data conditions replayed against a real
   backend rather than reported as not-checkable.
2. **Drive it in the editor.** That is what closes the renderer half of TUT-002 (§4): install the
   bundle, open it, create the record, watch the step tick without touching the graph.
3. Only then TUT-004.

## 4. What is specced but not driven, precisely

`models/lessondatabase.live.ts` cannot be loaded by a plain-Node runner (it imports `ProjectModel`
and `ipcRenderer`), so the suite grades everything *underneath* it — the reader, the narrowing, the
snapshot builder, the binding classifier, both transports — and the drive graded the same shared
core through the *other* transport, against four real backends.

The unproven link is short and named:

```
ProjectModel.instance → getCloudServices → matchEndpointToManaged → backend:list / backend:status
   → ipcLessonReader → a step going green in lessonlayer2
```

Nothing about it is subtle; it simply needs a lesson with a data condition to exist. Do not write
another spec for it — write the lesson.

## 5. Owed by Richard

- 🔴 **R3** — see §3. **Blocks TUT-003, which is now the only thing it blocks.**
- 🔴 **R2** — what provenance does a community bundle install under? `lessoninstallpolicy.ts` grades
  `local` vs `local-ai`; a platform bundle is a **third** trust profile. Blocks TUT-004 AC3.

## 6. Housekeeping

- **Committed this session:** `b73b5972` (TUT-002 code + specs, 22 files) and `6ba357e9` (TUT-001,
  9 files). Docs commit follows. Nothing of a peer's was swept — checked the stat list of both.
- 🔴 Peers commit to `cline-dev` from this same checkout. **`git commit -- <pathspecs>`, never
  `git add -A`, never stash.** Untracked files need `git add <paths> && git commit -- <paths>` as
  **one chain**, and `-m`/`-F` must come *before* the `--`.
- Two peer sessions are live: phase 72's community panel (`models/community/`, `CommunityPanel`,
  `hooks/useCommunityPeople.ts`) and phase 67b's render harness (`scripts/devtools`,
  `noodl-mcp/src/render.ts`). Neither overlaps this phase.
- Drive copy `tut001-drive` and its launcher-store row are left in place on purpose.
- The four backends started by the drive stopped themselves; `lsof` on 8578+ was clean afterwards.

## 7. The two traps this session paid for, for whoever hits them next

1. 🔴 **A control read `52 passed, 52 total` with no failure line.** A jest *worker* had crashed on
   an unhandled rejection from a `void somePromise` in one of my own specs, taking an 18-test file
   with it. **Reconcile the test count AND the suite count on every control** — 70 → 52 is not a
   failure, it is a file that never ran. Second session running this exact shape has appeared.
2. 🔴 **The green suite was not evidence about the feature.** 31 specs passed while the bundle
   harness would have refused every data lesson ever written. What found it was asking *"who calls
   this, and what happens when they do"* — not another spec on the same seam.
