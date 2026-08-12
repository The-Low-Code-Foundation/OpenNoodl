# LGC-009 — give the language a hat

**Status:** 📋 **filed, not built, not scheduled.** Raised 2026-08-12 by the `disableOrphans`
finding, and filed on Richard's ruling as the follow-on to LGC-003 §2 rather than as part of it.
**Track: the grammar** — this is a language change, not a UI one.

> **Read `FINDING-2026-08-12-disableOrphans-kills-every-program.md` first.** This task exists
> because that finding proved a gap in the grammar, not because anyone asked for a new block.

## The claim

**A Noodl block program has no stated beginning.** `NoodlBlocks.ts` defines 15 block shapes: 9
statement blocks (`setPreviousStatement` + `setNextStatement`) and 6 value blocks (`setOutput`).
**Zero hat blocks** — nothing with a `next` and no `previous`. So a program is a free-floating
statement stack, and where it starts is wherever the user happened to drop the topmost block.

Every other block language states it. Scratch has `when green flag clicked`. MakeCode has `on
start`. Blockly's own samples hang runnable code off an event block. The hat is not decoration:
it is the token that makes "this code runs" and "this code is stranded" different sentences.

**We already have the concept — it just lives outside the workspace.** The Logic Builder node has
signal inputs. `Run` is an `EdgeTriggeredInput`. A hat reading *"when Run is received"* would say
inside the language what the node already says outside it.

## What raised it, and why it is not LGC-003 §2

LGC-003 §2 registered `Blockly.Events.disableOrphans` to grey out unreachable blocks. The predicate
disables any parentless block with a `previousConnection` or an `outputConnection`. **With no hat
in the grammar, that is every program.** One user gesture greyed the whole program, emptied
`generatedCode` to `""`, and serialised `disabledReasons: ["ORPHANED_BLOCK"]` to `project.json`.

Reverted. **The instructive part is that the framework's term was correct and our grammar was not.**
`disableOrphans` does exactly what it says. "Orphan" simply has no useful denotation in a language
where nothing is ever a parent. Two ways out: stop asking the question (the revert, ruled), or give
the language the thing that makes the question meaningful — this task.

## 🔴 The cost estimate that was wrong, corrected

The finding priced this as *"a language change with a migration for every saved program"*, and on
that basis it was set aside. **The migration half of that price is near zero, and it should not be
inherited as written.**

- The Logic Builder is **this fork's own feature**, added `554dd9f3`, **2026-01-11**. Legacy Noodl
  never had one, so **no imported Noodl project can contain a block program.** Richard's standing
  rule — new-editor stability outranks legacy import compatibility — does not even have to be
  invoked here; there is nothing on the legacy side to weigh.
- Counted on the authoring machine, 2026-08-12: **two saved programs exist in the world**,
  `lgc59-drive` and `lgc59-cycle`, both hand-authored as fixtures this week. Zero user projects,
  zero examples, zero repo fixtures.

**So the real cost is verification, not migration**, and that is why it is still its own task rather
than a quick fix. It touches `NoodlBlocks.ts`, `NoodlGenerators.ts`, `BlocklyToolbox.ts`,
`detectIO`, the LGC-004 interface rails, and LGC-007's My Blocks expansion — and none of that can
be graded without a driven editor.

## ✅ RULED 2026-08-12: the hat is MANDATORY

**Richard's ruling: a program must hang off a hat.** This was the decisive open question — the
file's own §1 says *"decide this before anything else; it decides the whole task"* — so the task
is now estimable and buildable.

**What the ruling settles, and what it does not:**

- ✅ **`disableOrphans` becomes correct**, so LGC-003 §2's static tell is bought back, for the
  right reason rather than by narrowing a predicate. The middle path that was rejected in the
  `disableOrphans` finding stays rejected; this is the other way out, and it is the one that
  makes "orphan" mean something in our grammar.
- ✅ **The migration is two fixtures**, `lgc59-drive` and `lgc59-cycle`, both ours, both authored
  this week. 🔴 **Do not re-derive this as "a migration for every saved program"** — that number
  was wrong once and nearly decided the ruling the other way.
- 📋 **Still unruled: one hat or several.** The per-signal hat (*"when Run is received"*, *"when
  Reset is received"*) is a capability gain the language cannot currently express, and it is the
  strongest argument for the task — but it is a separate decision and does not block starting.
- 🔴 **Still open, and now urgent: what `detectIO` does with it.** A hat naming a signal is a
  *second* declaration of a port that `noodl_define_signal_input` already declares, and LGC-004's
  **L39** records that `detectIO` resolves a clash by **document order**. A mandatory hat lands
  a second source of truth straight on top of a known ordering defect. Settle this before writing
  the generator, not after.

## §1 — The hat itself

A block with a `next` connection, no `previous`, and no output. Open questions, none of them ruled:

- **One hat or several?** The node's signal inputs are unlimited. One hat per signal input
  (*"when Run is received"*, *"when Reset is received"*) matches the node and gives a home to
  something the language cannot currently express: **different code for different signals.** That
  is a capability gain, not just a tidying, and it may be the strongest argument for this task.
- **Is the hat mandatory?** If a program without one generates no code, that is a hard migration for
  the two fixtures and an unforgiving empty state for a new user. If it is optional, top-level
  stacks still run and the hat is advisory — which keeps `disableOrphans` unusable, so **an optional
  hat does not buy back LGC-003 §2.** Decide this before anything else; it decides the whole task.
- **What does `detectIO` do with it?** The signal-input ports are currently mined from
  `noodl_define_signal_input` blocks. A hat naming a signal is a second, competing declaration of
  the same port. LGC-004's L39 already records that `detectIO` resolves a type clash by document
  order — a second source of truth would land straight on top of that.

## §2 — What it buys, stated honestly

1. **A stated entry point.** The commonest beginner question in any block tool is *"why didn't this
   run?"*, and today the language has no way to answer it, because it has no way to say where
   running starts.
2. **Per-signal programs.** See §1. Not currently expressible.
3. **`disableOrphans` becomes correct** — *only if the hat is mandatory* — which restores LGC-003
   §2's static tell for free and for the right reason.

**What it does not buy:** anything for the user who never writes a second signal handler. This is
grammar work, and grammar work is invisible when it succeeds.

## Acceptance

Nothing here is drivable until the mandatory/optional question above is ruled, so this list is
provisional and deliberately short.

1. A program with a hat generates the same code as today's equivalent hatless program.
2. The two existing fixtures (`lgc59-drive`, `lgc59-cycle`) open, run, and produce their recorded
   `generatedCode` — migrated if the hat is mandatory, untouched if it is optional.
3. `detectIO` reports one port per signal, not two, when a hat and a
   `noodl_define_signal_input` name the same signal.
4. If the hat is mandatory: `Blockly.Events.disableOrphans` can be re-registered, and a program
   under a hat survives a drag with `generatedCode` and `disabledReasons` unchanged. **This is the
   check that closes LGC-003 §2**, and it must be driven, not asserted headlessly — the whole
   defect it replaces was invisible to every spec in the phase.

## Register

| # | Finding | State |
|---|---|---|
| L41 | 🔴 **The language has no hat, and nothing noticed until a framework behaviour asked.** 15 block shapes, 9 statement / 6 value / 0 hat. The gap was invisible because everything works without one — until a predicate whose meaning depends on one was adopted | 📋 open, this task |
| L42 | 🔴 **A cost estimate can kill an option with a number nobody checked.** This was priced at "a migration for every saved program" and set aside. The population of saved programs is **two, both ours**, because the feature is 7 months old and legacy Noodl never had it. **Count the population before pricing a migration** | ✅ corrected 2026-08-12, before the estimate was inherited a second time |
| L43 | One hat per signal input would make *different code for different signals* expressible, which it currently is not. Filed as the strongest argument for this task, and not yet weighed against the cost | 📋 open, needs Richard |
