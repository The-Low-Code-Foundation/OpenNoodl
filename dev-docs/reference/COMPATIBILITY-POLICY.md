# Compatibility Policy — NodeGX is a fresh start

**Decided:** 2026-07-30 by Richard
**Status:** Binding on every task, in every phase, from this date
**Supersedes:** every "existing projects must keep working" clause written before this date

---

## The decision

> **NodeGX is a fresh start. Existing Noodl projects will not reliably import.**
>
> We promise the best import and conversion we can build, and nothing more. What the importer
> cannot convert is handed to the user's AI assistant to fix inside the new project, or is
> deleted and rebuilt there. **No task may be halted, narrowed, or compromised to protect
> projects built in Noodl 2.x or in pre-revival OpenNoodl.**

Design for the project someone will build in NodeGX next year. Not for the one they abandoned in
2023.

## Why

Two reasons, and the second is the one that costs us daily.

**The population is gone.** Noodl was discontinued. The overwhelming majority of projects built in
it have been abandoned along with it. We have been paying a continuous tax to protect users who,
in most cases, are not coming back — and who, if they do come back, are coming back *for the new
thing*.

**The constraint is unfalsifiable, so it wins every argument.** "Would this break an existing
project?" cannot be answered, because we have no corpus of existing projects to test against. An
unanswerable question attached to a change request reliably produces one of three bad outcomes,
all of them visible in this repo's own history:

- **Halt.** The task stops at an assessment and never ships the fix.
- **Dual-path.** Both behaviours ship, gated by a flag, and now there are two code paths to
  maintain and two behaviours to document.
- **Default-to-broken.** The fix ships switched off — the new correct behaviour is opt-in, so the
  wrong behaviour is what every user actually gets.

Every one of those is worse than a clean break in a product with no installed base.

## What this waives

Stop writing these. If you find one in a spec you are executing, treat it as void and say so in
your notes:

- "Existing projects must keep working / keep running / are unaffected."
- "Existing projects cannot break."
- "Deprecated means hidden, not removed" — **as a blanket rule**. Removal is now on the table;
  argue it on maintenance cost, not on installed base.
- "Default to the old behaviour so no existing project changes."
- "This is a behaviour change for existing projects" — as a *reason not to*. Still note it as a
  changelog fact; it is no longer a veto.
- "Ship both and let the user opt in" — where the only motivation for the old path is legacy
  projects.
- "Add a compatibility shim / migration path" — where the shim exists only for pre-NodeGX files.

**The default answer flips.** Before: keep the old behaviour unless the break is proven safe.
Now: **ship the correct behaviour**, and record the break.

## What this does NOT waive

The fresh start is about *other people's old files*. It is not a license to be careless. Four
things still hold, and none of them is negotiable:

1. **Never silently corrupt a project you opened.** A load may fail loudly, refuse, or migrate
   with a visible report. It must never write a subtly-wrong project back to disk. Round-trip
   fidelity (SUB-002) stands as built.

2. **A project authored in NodeGX must still open in the next NodeGX.** Once we ship a real
   release, forward compatibility for *our own* format begins to matter. Until then (see "Who
   actually has a project" below) this costs nothing — but the moment v1 ships publicly, breaks
   need a migration that runs on load.

3. **The repo's own projects are the compatibility target that remains.** The QA fixture
   (`dev-docs/qa-fixtures/`), the example projects, and the docs-repo library content are real,
   they gate CI, and they must stay green. **The difference is that they are ours to edit.** When
   a change needs the fixture updated, *update the fixture* — that is a normal part of the change,
   not evidence the change is wrong. Say so in the commit.

4. **Record every break.** A break that nobody wrote down becomes a support mystery. Each one goes
   in the task's notes and, for anything user-visible, in the changelog. This policy buys speed,
   not silence.

## Who actually has a project

Worth knowing precisely, because it is the ground the decision stands on:

- **NodeGX has never had a public release.** `v0.1.0` is a *draft* release; signing and publishing
  are still human-gated. There are zero NodeGX projects in the wild.
- **The last public release of this codebase is upstream OpenNoodl `v1.1.0` (2024-09-25)** —
  pre-revival, legacy format. Projects from it fall in the same bucket as Noodl 2.x: best-effort
  import, no guarantees.
- **Therefore the only projects that exist today are ours**: the QA fixture, the repo examples, and
  the library content. All three are editable by us. All three are covered by point 3 above.

## What "best-effort import" promises

The promise is honest effort and an honest report — not fidelity.

**We will:** convert everything mechanically convertible; produce a written, per-item report of
what converted, what converted with changes, and what could not be converted at all; leave the
unconvertible parts visible in the imported project rather than silently dropping them; and hand
the AI assistant enough context to attempt the repair.

**We will not:** guarantee the imported app runs; guarantee behavioural equivalence; block a
NodeGX improvement because it would lower an import fidelity number; or maintain a legacy code
path to raise one.

**The escape hatch is the assistant, and it is a real deliverable, not a hand-wave.** The import
report is written to be consumed by an AI assistant with the node catalog (SUB-004/005), the
semantic validator (SUB-006), and the authoring loop (AIX-002) already available to it. "The
assistant will fix it" is only an acceptable answer because those four things exist. See
[LIB-006](../tasks/phase-21-library-and-import/LIB-006-LEGACY-IMPORT-ASSIST.md), which owns this
promise.

**And "delete and rebuild" is an acceptable outcome.** For a small abandoned project, rebuilding
in NodeGX is often cheaper than converting it, and the import report saying so plainly is a better
product than a broken half-conversion.

## Writing a spec under this policy

The failure mode is not malice, it is a reflex. Concretely:

**Before** (NDA-009 §2, as originally written):

> Let the author say which ports mean what, defaulting to `Do`/`Success`/`Failure` so existing
> projects are unaffected.

**After:**

> Let the author say which ports mean what. Default to `Do`/`Success`/`Failure` because it is the
> sensible default for a new task template — not to protect existing projects.

Same code, possibly. But the *reason* is now testable, and the next agent reading it does not
inherit a constraint it must tiptoe around.

**Before** (NDA-011 §1):

> Existing projects must keep running. Deprecated means hidden and unrecommended, not removed.

**After:**

> Decide removal on merit: if HTTP Request is a true superset, delete the REST node and let the
> importer flag it. Keeping it costs a permanently-maintained duplicate.

**The test to apply:** if you strike the words "existing projects" from your justification, does
the decision still stand on its own merits? If yes, keep it and fix the wording. If no, the
decision was legacy-driven — take it again.

## Shipped compromises now open for reversal

These landed *because of* the constraint this policy removes. None is urgent; all are now fair
game, and a task touching one should reconsider it rather than preserve it. **Verify each is still
as described before acting — several are second-hand from spec prose, not re-read code.**

| Where | The compromise | Now |
|---|---|---|
| RUN-001 (ph. 16) | React 17/19 dual runtime; existing projects stay on 17 until they opt in | Reconsider: is anything still on 17 worth two runtimes? |
| RUN-002 (ph. 16) | SSR is opt-in only, never auto-migrated | Opt-in may still be right — but for SSR's own reasons |
| PLAT-003 (ph. 14) | Deprecated nodes kept rather than deleted, because deleting "breaks every existing project using them, silently, at load" | Deletion is on the table; a loud load failure is acceptable |
| NDA-011 (ph. 30) | 4 deprecated nodes still shipped in the picker | Remove them |
| NDA-008 §1 (ph. 30) | `replace` transitions default to `None` so no existing project starts animating | Default on merit, not on inertia |
| NDA-010 (ph. 30) | Whatever replaces `popupParam-*` must keep reading hand-named ports | Derive ports properly; convert the fixture |
| NDA-014 (ph. 30) | Casts added only where nothing could break | Widen on type-correctness grounds |
| CED-001 (ph. 29) | Code history migration shaped so existing projects shrink rather than freeze | Fine as shipped; no longer a constraint on further change |
| WFA-003 (ph. 27) | "Backwards compatibility is not optional" for workflow definitions in data dirs | Applies only to *deployed* backends holding live data — restate on that basis |

## Where this is referenced

`.clinerules` · [`CLINE-INSTRUCTIONS.md`](../CLINE-INSTRUCTIONS.md) ·
[`TASK-TEMPLATE.md`](../TASK-TEMPLATE.md) · [`dev-docs/README.md`](../README.md) ·
[`REVIVAL-PHASES-INDEX.md`](../tasks/REVIVAL-PHASES-INDEX.md) · the phase-30 and phase-21 READMEs ·
the individual specs listed in the table above.

Those are pointers only. **This file is the single source; do not restate the policy elsewhere.**
