# Phase 73 — next session

**Written 2026-08-20, end of session 4.** Read [README §0](README.md) and [TASKS.md](TASKS.md)
first; this file is the working state, not the phase.

---

## 1. 🔴 Start here: author the bundle. Nothing blocks it.

**R3 is answered — the learner creates the collection.** TUT-002 is done. The F2′ defect that would
have refused the result is fixed. TUT-003 has no open dependency of any kind.

The remaining work is the artefact itself, in this order:

1. **Author the solution project.** Every type name and port name it needs is written down in
   [TUT-003 §"The graph, in the type names it is actually saved under"](TUT-003-THE-TUTORIAL-ITSELF.md)
   — **read it rather than re-deriving it**; session 4 spent most of its budget getting those out of
   runtime source and three of them are traps.
2. **Write `lesson.json`.** Step body names the collection **verbatim**; first data condition is
   `collectionExists`.
3. **`derive_starter`**, then **`check_lesson` with `backend_id`** — that is now safe and is the only
   route that grades the data conditions.
4. **Drive it in the editor.** This also closes the renderer half of TUT-002 (§4).
5. Only then TUT-004 (still needs **R2**).

⚠️ **One thing session 4 stopped short of and should be honest about:** the solution graph was
*specified*, not written. The Repeater's `parameters.template` names a **component**, so the row is a
second component and the graph is two components, not one. That is the first real decision next
session makes.

## 2. What session 4 changed

**`b5058f3b` — F2′ convicted the one step a data lesson cannot do without.**

`check_lesson --backend_id` reads one live backend and hands the **same** snapshot to the starter and
the solution context ([`lessonTools.ts:270-274`](../../../packages/noodl-mcp/src/tools/lessonTools.ts)),
because a bundle on disk has one database and not two. A snapshot describes the author's world
*after* they ran the solution; F2′ asks about the learner's world *before* they start. So any step
whose conditions are **all** data conditions was `already-satisfied-in-starter` by construction.

Measured, varying only where the snapshot went:

| Snapshot given to | F2 |
|---|---|
| starter **and** solution — the real caller's shape | **fail**, `already-satisfied-in-starter` |
| solution only — what every TUT-002 spec does | **pass** |

That step is **TUT-003 AC5**: "complete the graph, create no record, the data step stays red." F2′
now reports `not-checked` per step for database-graded steps and says which half it could not answer.

🔴 **The lesson, and it is session 3's lesson one layer out:** 70 green specs did not see it because
they all supply a snapshot in a shape **no caller uses**. The thing that found it was reading the
caller and asking what it actually passes.

## 3. Gate readings — 2026-08-20, tree at `b5058f3b`

| Gate | Reading | |
|---|---|---|
| `typecheck:mcp` | **exit 0** | |
| `tests-unit/tut-002` + `tut-003` | **76 tests / 6 suites**, all green | 70 + 6; reconciled against disk |
| new specs | **6**, of which **3 verified red** with the guard disabled | two known-firing controls stayed green in both arms, on purpose |
| `typecheck:editor` | 🔴 **exit 2 — NOT MINE** | 2 errors, both `kind: "handoff"` on `CommunityReplyBox`: `noodl-core-ui/.../Launcher/views/Community.tsx:275` and `.../CommunityPanel/CommunityPanel.tsx:176`. From a peer's **`736af592`** (phase 72 NAT-008). Zero errors in lesson files |
| `test:main` | 🔴 **3 suites failed, 278 passed · 4463/4463 tests passed** | **0 test failures** — the 3 suites (`nat-005`, `nat-007`, `nat-008`) *never compiled*, on the same peer error. ~81 tests unrun |
| `test:ci` | **not run this session** | last floor: **2849 specs / 10 failures @ `NOODL_SPEC_SEED=39393`**, re-measured 08-20 08:27 |

🔴 **`test:main` reporting `4463 passed, 4463 total` with three red suites is the trap this repo keeps
paying for.** Zero test failures and a green-looking tail; the number went *down* by ~75 from session
3's 4538 because three files never ran. **Reconcile the suite count as well as the test count, every
time.**

Relayed to the peer sessions; the EL-009 session confirmed the reading and corrected my count (I said
one error, it is two — fixing only `Community.tsx` leaves the gate red). Not this phase's to fix, and
**do not read either gate as a phase-73 regression.**

## 4. Still true from session 3 — the unproven link

`models/lessondatabase.live.ts` cannot be loaded by a plain-Node runner (it imports `ProjectModel`
and `ipcRenderer`), so the suite grades everything underneath it and the drive graded the same shared
core through the other transport. The unproven link is short and named:

```
ProjectModel.instance → getCloudServices → matchEndpointToManaged → backend:list / backend:status
   → ipcLessonReader → a step going green in lessonlayer2
```

Do not write another spec for it — **write the lesson**. That is step 4 of §1.

## 5. Owed by Richard

- 🔴 **R2** — what provenance does a community bundle install under? `lessoninstallpolicy.ts` grades
  `local` vs `local-ai`; a platform bundle is a **third** trust profile. **Blocks TUT-004 AC3 only.**
- ~~R3~~ ✅ answered 2026-08-20: the learner creates the collection. See
  [TUT-003 §R3](TUT-003-THE-TUTORIAL-ITSELF.md) for the four measurements that had already narrowed
  it to one arm.

## 6. Housekeeping

- **Committed this session:** `b5058f3b` (2 files: `lessonbundleverify.ts` + the new spec). Docs
  commit follows. Nothing of a peer's was swept — checked the stat list.
- 🔴 Peers commit to `cline-dev` from this same checkout, and did so **during** this session
  (`736af592`, `e86cd31e`, `996ccdc7` all landed after session 3's HEAD). **`git commit -- <pathspecs>`,
  never `git add -A`, never stash.** Untracked files need `git add <paths> && git commit -- <paths>`
  as **one chain**, with `-m` *before* the `--`.
- Three peer sessions were live: phase 72's community panel, phase 67b/EL-009's render harness
  (`scripts/devtools`, `tests-unit/el-009`), and one more. Neither overlaps this phase.
- No backends were started this session; no drive was run.

## 7. The trap this session paid for, for whoever hits it next

🔴 **A spec fixture in a shape no caller uses is not coverage — it is a decoy.** Session 3's
`bundle-verifies-a-data-lesson.test.ts` hands the snapshot to the solution alone. That is a
reasonable-looking fixture, it made 70 specs pass, and the one real caller does something else. The
question that found it is the same one session 3 recorded and I nearly failed to ask a second time:

> **who calls this, and what exactly do they pass?**

Not "is there a spec for it". Session 3 found its defect by asking *"who calls this, and what happens
when they do"*; session 4 found the next one by asking the narrower version — **not whether a caller
exists, but whether the fixture matches the argument the caller actually builds.**
