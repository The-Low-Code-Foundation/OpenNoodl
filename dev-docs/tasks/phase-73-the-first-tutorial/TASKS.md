# Phase 73 — the tasks (TUT: the first tutorial)

**Created:** 2026-08-19 out of [README.md](README.md).

> 🔴 **Read [README §0](README.md) first.** The ruling this phase teaches — *async lives on the
> canvas; blocks are synchronous computation* — is the tutorial's subject, and TUT-003 is graded on
> whether a builder can act on it afterwards.

> 🔴 **Read [README §1](README.md) before starting any task.** Three of its five findings make a
> task smaller than its title suggests, and one (§1D) means **TUT-004 must not build an install
> mechanism** — `LearningFolderModel.install` exists, is wired, and has a `platform` source arm that
> production code has simply never constructed.

**Tiers:** 1 = clearing the way · 2 = the contract · 3 = the artefact · 4 = delivery.

**Effort:** S ≈ a session · M ≈ 2–3 · L ≈ a week+.

| Task | One line | Surface | Tier | Effort | Depends on / must honour |
|---|---|---|---|---|---|
| **✅ [TUT-001](TUT-001-ONE-DATABASE-NOT-FORTY.md)** | **One database, not forty.** The Backend Services list renders every backend on the machine flat; show the attached one and put the rest behind a finder that searches the metadata already on disk | editor | **1** | S/M | ✅ **DONE 08-19.** R1 answered and **driven**; all six ACs close |
| **✅ [TUT-002](TUT-002-A-CONDITION-THAT-CAN-SEE-DATA.md)** | **A condition that can see data.** The lesson vocabulary is entirely graph-structural, so a data tutorial cannot grade the data. Add snapshot-backed collection verbs, built-in DB only, and give the MCP the same ones | editor / noodl-mcp | **2** | M | ✅ **DONE 08-20 (session 3).** All seven ACs close; both fillers built and called; the sidecar half **driven against four real backends**. 🔴 Session 3 also found and fixed the harness defect that would have refused every data lesson as F2 |
| **[TUT-003](TUT-003-THE-TUTORIAL-ITSELF.md)** | **The tutorial itself.** A Visual Function that validates and shapes input, fans out on `send signal` to Create Record, and a Query that feeds the list back — the composition ruling, taught | content / editor | **3** | M | ✅ **UNBLOCKED — R3 answered 2026-08-20: the learner creates it.** Must carry a `solution/` or three of four harness classes go dark. ⚠️ Do **not** grade `hasColumns` against a system table — see TUT-002's drive. 🟡 Session 4 fixed the F2′ defect that would have refused it and recorded every node type / port name it needs; **the bundle itself is not yet authored** |
| **[TUT-004](TUT-004-ONE-CLICK-FROM-THE-PANEL.md)** | **One click from the panel.** The community panel installs a bundle; the web page keeps its download link. Build the caller, not the mechanism | editor / platform | **4** | S/M | TUT-003, phase 72 NAT-005/006. 🔴 **R2.** 🔴 §1D — `install()` already exists |

---

## Status

- **✅ TUT-001 built 2026-08-19 (session 1).** `backendVisibility.ts` + a finder dialog; the two
  flat `.map()`s are gone. **40 specs** in `tests-unit/tut-001/`, `test:main` **265/4249** green,
  `typecheck:editor` clean, **five controls verified red**, `test:ci` at floor (**2849 / 10 @
  39393**, same 10 by name). ✅ **Driven** against the seven real backends on this machine — all
  five written-in-advance predictions held, and R1's claim end to end: the line named the hidden
  running backend, two clicks stopped it, **and `lsof` confirmed the port dead**.
- **R1 is answered** (README §3): the collapsed line is `1 attached · 6 others, 1 running` and the
  finder draws the **same** `LocalBackendCard`, so Stop is two interactions away. ✅ **R3 answered
  2026-08-20** (session 4); **R2 is still open** and blocks TUT-004 AC3.
- **🟡 TUT-002 session 2 (2026-08-20) — the CONTRACT, not the feature.** Three verbs
  (`collectionExists` / `hasColumns` / `rowCountAtLeast`), the evaluator arms, the three-way refusal
  (`refused` / `unavailable` / absent) and the F1 `unreachable-collection` check. **31 specs**,
  `test:main` **270 / 4381** green, `typecheck:editor` exit 0, **6 controls verified red**.
  🔴 The green suite was coverage of a contract no production path exercised.
- **✅ TUT-002 session 3 (2026-08-20) — the callers.** `lessondatabase.ts` (pure core, one reading,
  two transports) + `lessondatabase.live.ts` + `noodl-mcp`'s `lessonDatabase.ts`; `checkMyWork` and
  the lesson layer both read a snapshot; `verifyLessonBundle` now supplies `knownCollections` from
  both projects; the MCP brief documents the three verbs and a spec makes an undocumented verb
  impossible. **70 specs** in `tests-unit/tut-002/` + 4 in `noodl-mcp`, **8 controls red-then-restored**,
  `test:main` **279/280 suites · 4538/4539** (the one failure is a peer's untracked
  `useCommunityPeople.ts`), `typecheck:editor` and `typecheck:mcp` exit 0, `noodl-mcp` jest
  **55/648 green**, `test:ci` **2849 specs / 10 failures @ 39393** — the floor, same 10 by name.
  🔴 **The session's own finding:** a correct data lesson was about to be refused as **F2
  dead-on-solution** by the bundle harness, invisibly to all 31 of session 2's specs. Fixed.

- **🟡 TUT-003 session 4 (2026-08-20) — R3 answered, and the gate that would have refused the answer.**
  🔴 **R3 was not a preference; one arm was unimplemented.** A backend lives at `~/.noodl/backends/<id>`,
  a bundle is a project directory, `LearningFolderModel.install` has no database handling and nothing
  in `src/` seeds a backend — so a bundle **cannot** ship a collection. Richard ruled **learner
  creates it**.
  🔴 **The session's own finding, and it is TUT-002's shape again one layer out:** `check_lesson
  --backend_id` hands **one** live snapshot to *both* the starter and the solution context, so any
  step whose conditions are all data conditions read as F2′ `already-satisfied-in-starter` — which is
  precisely AC5's step. TUT-002's 70 specs could not see it because they supply a snapshot to the
  solution alone, and that is not the shape the only real caller has. Fixed in **`b5058f3b`**;
  **6 specs** in `tests-unit/tut-003/`, **3 verified red** with the guard disabled, two known-firing
  controls held. `typecheck:mcp` exit 0; `tut-002 + tut-003` **76 tests / 6 suites** green.
  ⚠️ `typecheck:editor` (exit 2) and `test:main` (**3 suites unrun, 4463/4463 tests passed**) are red
  on this tree from a **peer's** `736af592` — two `kind: "handoff"` errors in phase-72 community
  files, zero in lesson files. Relayed; not this phase's to fix.
  🔴 **Not yet authored: the bundle.** Every node type and port name it needs is now written down in
  the task file rather than re-derivable — including that Create Record's terminal signal is **Done**
  and the Visual Function's is **Success**.

## The order

1. ~~**TUT-001**~~ ✅ — unforked, self-contained, and it is the thing Richard is looking at every day.
2. ~~**TUT-002**~~ ✅ — all seven ACs close, and **R3 is answered**, so TUT-003 is blocked by
   nothing.
3. **TUT-003** — the artefact. Run it through `lessonbundleverify` **before** driving it; the
   harness refusing a bundle is cheaper than the editor doing it. ✅ Now safe to run it *with*
   `backend_id`, which is the only route that grades the data conditions — see session 4 in Status.
4. **TUT-004** — needs a bundle to install and phase 72's panel to install it from.

## What this phase borrows and must not rebuild

| Already built | Where | Used by |
|---|---|---|
| `LearningFolderModel.install / reset / recordProgress / recordGrade` | [`learningfolder.ts`](../../../packages/noodl-editor/src/editor/src/models/learningfolder.ts) | TUT-004 |
| The F1–F4 bundle scorecard | [`lessonbundleverify.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonbundleverify.ts) | TUT-003, TUT-004 |
| The bundle reader, incl. `solution/` | [`lessonbundleread.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonbundleread.ts) | TUT-003 |
| The file-backed grading context | [`lessonprojectcontext.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonprojectcontext.ts) | TUT-002 |
| The pure/live evaluator split | [`lessonevalconditions.ts`](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.ts) + `.live.ts` | TUT-002 |
| `activeBackendId`, `boundLocalBackend`, `projectNamesByBackend` | [`BackendServicesPanel.tsx`](../../../packages/noodl-editor/src/editor/src/views/panels/BackendServicesPanel/BackendServicesPanel.tsx) | TUT-001 |
| The `articles` table + `projectUrl` | `nodegx-community/src/db/schema.ts` | TUT-004 |
