# FIX-026 — put back what the lesson needs, without throwing away the learner's work

**Filed:** 2026-08-21, out of FIX-025 §11b. **Status: NOT BUILT.** Scoped here because the drive
turned up a constraint that changes the design, and guessing at it would be the wrong kind of
progress.

---

## The ask, in Richard's words

> *"It's also easy to accidentally delete bits of the tutorial app that are needed to complete the
> session, and you might not remember what you deleted, so we need more protection against users
> accidentally messing up the whole tutorial."*

He asked for **two** things. FIX-025 built one: deleting a node a step is grading now asks first,
naming the step (`models/lessonprotection.ts`, driven and confirmed 2026-08-21). This is the
other: **putting it back.**

⚠️ **It was not left because it was judged unnecessary.** It mutates the graph — re-inserting
nodes with their parents, their parameters and their undo integration — and the session that
built the warn had no running editor to verify a mutation in. That reason has now expired; the
one below has not.

---

## 🔴 The constraint the drive found: there is no pristine copy to restore *from*

FIX-025's handover said *"the pristine source is the installed bundle under `Learning/<slug>/`."*
**That is wrong, and it is the whole design problem.** `Learning/<slug>/` **is** the learner's
working copy — it is the directory the editor opens and writes to. There is no untouched original
beside it.

The only pristine source is `entry.source.path` in the register, which is where the lesson was
installed *from*. Measured on this machine, 2026-08-21:

| lesson | `source.path` | exists today |
|---|---|---|
| `state-on-a-page` | `/tmp/claude-501/uni-007-drive-bundles/bundle-good` | ✅ — **but it is in `/tmp`** |
| `log-a-thing` | `~/vscode_projects/NodeGX test projects/tut003-drive-bundle` | ✅ |

So one of the two installed lessons has a pristine source that a reboot deletes. And for a lesson
installed from the community platform, `source.kind !== 'local'` and there is no local path at
all — which is exactly why `LearningFolderModel.reset()` refuses that case and hands it to
`lessonplatforminstall.resetFromPlatform` to re-fetch.

**This is a decision, not an implementation detail**, and it should be made before any code:

- **(a) Stand on the same footing as `reset()`.** Resolve the source the same way, and refuse
  with the same shape of message when it has gone. ✅ Cheapest, and restore is then never *worse*
  than the destructive path it exists to beat. ❌ The learner who most needs restore — weeks in,
  `/tmp` long since cleared — is the one who cannot have it.
- **(b) Snapshot at install time.** `install()` writes a `.pristine/` copy inside the lesson
  folder. ✅ Always available, works for platform lessons, makes `reset()` offline too. ❌ Doubles
  a lesson's disk footprint and adds a directory the learner can see. Needs a migration for the
  two lessons already installed.
- **(c) Derive from `solution/`.** `log-a-thing` carries one; `state-on-a-page` does not. ❌ Not
  universal, and a solution is the *finished* app — restoring from it would hand the learner
  answers to steps they have not reached. **Recommend against.**

**Recommendation: (a) now, (b) as a follow-up** — (a) is a day, restores the common case, and
(b) is a strictly compatible upgrade behind the same seam.

---

## What already exists, and must be reused rather than re-stated

- **`models/lessonprotection.ts`** already computes *which* nodes a step needs, from the same
  `completeWhen` conditions grading reads, with the label/type grammar `findNodeWithPath`
  resolves. 🔴 **Derive from the conditions, never from a hand-written `protected:` field in the
  lesson format.** A second statement of the same fact drifts on the first edit; that argument is
  why the warn works at all and it applies identically here. `protectedByLesson` answers "is this
  node needed"; restore needs the inverse — "which needed nodes are absent" — over the same
  addressing, so the two belong in one module.
- **`LearningFolderModel.reset()`** is the existing **destructive** recovery: it replaces the
  whole project copy and throws away everything the learner did. Restore has to be better than
  that, and `reset()` stays as the bigger hammer.
- **`EditorClipboard` / `NodeGraphNodeSet` / `UndoActionGroup`** are the existing machinery for
  inserting a set of nodes with parents under one undo entry. Restore should go through paste
  machinery rather than grow its own inserter — `EditorClipboard.performDelete` was split out of
  `deleteSelection` in FIX-025 for exactly this kind of reason.

## Acceptance

1. On a step whose graded node is missing, a control offers to put it back, **naming the node and
   the step** — the same sentence family as the delete confirm.
2. It restores the node **with its parent and its parameters**, so the step actually grades.
3. **It does not touch anything else the learner made.** This is the whole difference from
   `reset()` and is the acceptance criterion most worth a hostile test: restore into a project
   with the learner's own extra nodes, and assert they all survive byte-for-byte.
4. One undo entry puts the project back exactly as it was before the restore.
5. When the pristine source cannot be resolved, it says so in the learner's terms and changes
   nothing — never a partial restore.
6. 🔴 **Driven, not read.** FIX-025's thirteenth bug was created by fixing the eleventh and would
   not have been found by reading a diff. A graph-mutating action gets a drive.

⚠️ **Build the caller.** A `lessonrestore.ts` with specs and no UI entry point is unreached code,
and this repo has been bitten by that before (`models/lessongrading.ts` shipped with no importer).
The control and the module land together or not at all.
