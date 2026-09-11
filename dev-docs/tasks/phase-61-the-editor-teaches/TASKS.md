# Phase 61 — the tasks (FUN: the code editor teaches)

**Created:** 2026-08-09, out of [README.md](README.md) and Richard watching a new user's first
Function node.

**Every claim about existing code in these files was read in source on 2026-08-09.** Two premises in
the originating brief were wrong and both corrections are in the README. Anything marked
⚠️ **unverified** must be confirmed before the task depending on it is worked.

## The one-line premise

A new user was **eight characters** from working code (`Outputs.Output_1 = Inputs.Input_1`), was
**already being warned** by a linter that did not know `Input_1` was a port, and the affordance that
would have taught them — *typing `Inputs.` creates the port* — is invisible, while the one they found
in the property panel teaches nothing.

🔴 **Corrected 2026-08-12:** they were warned **twice**. `var Output_1 = Input_1` *throws* — it has
never run silently — and the runtime failure goes to `Error` and `Failure` ports that nothing on the
canvas draws attention to. The silent case is the *next* thing they type, `Output_1 = Inputs.Input_1`,
which lands on an implicit global. Neither report names the port. See README **premise correction 3**;
it moves the diagnosis and leaves every task standing.

> 🔴 **Status column corrected 2026-08-14 against git, not against this table.** Four rows
> (FUN-004, FUN-006, FUN-008, FUN-009) read `📋 open` while their commits were already on
> `cline-dev`, and FUN-001's row said §2 was *"not yet signed by Richard"* when it was **signed
> 2026-08-12**. **Real state: 8 of 9 built — FUN-005 (the ports rail) is the only one open.**
> The staleness was found by phase 67, which nearly authored a curriculum lesson around it; see
> [phase 67 RULINGS.md](../phase-67-nodegx-university/RULINGS.md) "Blocker 3".
>
> 🔴 **Corrected again 2026-08-15, and the second pass is the instructive one.** The 08-14 sweep
> fixed the **status column** and left the **prose in the same row** untouched, so FUN-007 went on
> claiming its §2 was "not done" for another day while `97e465a2` had built it on 08-12. A register
> is not reconciled when its states are right; it is reconciled when its *sentences* are. Found by
> phase 66's FIX-017, whose own §1 was by then stale in the opposite direction — it told its reader
> this file was four tasks behind, which had already been fixed.

| Task | File | One line | State |
|---|---|---|---|
| FUN-001 | [FUN-001-ONE-NOTATION-WRITTEN-DOWN-ONCE.md](FUN-001-ONE-NOTATION-WRITTEN-DOWN-ONCE.md) | one module owns the notation copy and the two expression builders | ✅ **in `cline-dev`** `f03eaece` — §2 taken on the recommendation and ✅ **signed by Richard 2026-08-12** (this row said "not yet signed" until 2026-08-14) — `Inputs.`/`Outputs.` are the notation, `Noodl.Inputs` is never written by us, enforced by `notation.test.ts`. Four findings measured against the real parser; **F5 invalidates FUN-002's specced seed** |
| FUN-002 | [FUN-002-NEVER-A-BLANK-PAGE.md](FUN-002-NEVER-A-BLANK-PAGE.md) | a new Function node arrives with a body that works — and therefore with two ports | ✅ **in `cline-dev`** `b3837c9d` — 🔴 the **specced seed body was wrong** (four ports, not two); `SEED_FUNCTION_BODY` ships instead. ⏳ live drive outstanding |
| FUN-003 ⭐ | [FUN-003-THE-DECLARED-PORTS-REACH-THE-EDITOR.md](FUN-003-THE-DECLARED-PORTS-REACH-THE-EDITOR.md) | **the structural task** — one field so the editor can see the ports declared in the panel | ✅ **merged** `fun-003-lane` — 🔴 §3's *"strip the prefix here"* **would have been a defect**; nothing is stripped. ⏳ the A→close→B drive is the one criterion still open |
| FUN-004 ⭐ | [FUN-004-THE-DIAGNOSTIC-THAT-NAMES-THE-PORT.md](FUN-004-THE-DIAGNOSTIC-THAT-NAMES-THE-PORT.md) | **the flagship** — four messages with one-click fixes, including the observed bug verbatim | ✅ **in `cline-dev`** `6dc6c019` (the linter learns a name is a port, and offers the fix) + `bfc52b4c` (the Ports tab reads the values the running app actually has). Status corrected 2026-08-14, this row read `open` |
| FUN-005 | [FUN-005-THE-PORTS-RAIL.md](FUN-005-THE-PORTS-RAIL.md) | the ports become clickable beside the code; `+` creates one without leaving; live values | 📋 open |
| FUN-006 | [FUN-006-THE-BAR-THAT-KNOWS-WHAT-IS-TRUE.md](FUN-006-THE-BAR-THAT-KNOWS-WHAT-IS-TRUE.md) | a dismissable line that names *their* ports and retires itself on success | ✅ **in `cline-dev`** `5f96f1f2` + `7afbf9fe` (the retirement counts *succeeding*, not opening a node that already succeeded) — status corrected 2026-08-14, this row read `open` |
| FUN-007 | [FUN-007-THE-LOOP-CLOSES-AFTER-THE-RUN.md](FUN-007-THE-LOOP-CLOSES-AFTER-THE-RUN.md) | "this node wrote no output"; runtime errors reach the gutter at the right line | ✅ **merged** `fun-007-lane` — 🔴 **F24 refuted: the observed body throws**, and the premise moved with it. ✅ **§2 IS built** — `97e465a2` (2026-08-12) adds `utils/runtimeDiagnostic.ts` + 176 lines of spec and feeds it from `WarningsModel`; both files are in the tree and their specs pass. **This row said §2 was "not done" until 2026-08-15** — the 2026-08-14 sweep corrected the *status column* and did not read the prose beside it |
| FUN-008 | [FUN-008-COMPLETION-MEETS-THE-WRONG-INSTINCT.md](FUN-008-COMPLETION-MEETS-THE-WRONG-INSTINCT.md) | typing `Inp` offers `Inputs.Input_1` — the smallest task here | ✅ **in `cline-dev`** `ad47b239` — a bare port name completes to its notation, and `Inputs.` stops withholding. Status corrected 2026-08-14, this row read `open` |
| FUN-009 | [FUN-009-THE-EXPRESSION-NODES-OPPOSITE-RULE.md](FUN-009-THE-EXPRESSION-NODES-OPPOSITE-RULE.md) | the sibling node with the inverse rule, and why the user's guess was reasonable | ✅ **in `cline-dev`** `ace5232f`, **driven** `601dd5d2` — a code port *declares* its notation; the premise held, F17 closed, F35 was one port short. Status corrected 2026-08-14, this row read `open` |

## Suggested order, and why

1. **FUN-001 first**, because four tasks write user-facing copy and a phase whose surfaces disagree
   about the notation is worse than no phase. It is mostly a decision and one small module. **It
   needs Richard's sign-off on §2 before FUN-002 can be written.**
2. **FUN-002 next.** Cheapest, independent of the seam, and it is the only task that helps a user who
   never makes a mistake at all — they simply have nothing to imitate. If exactly one thing ships
   from this phase, ship this.
3. **FUN-003.** Nothing downstream works without it, and it ships dark, so it can land any time and
   be verified by the first consumer.
4. **FUN-004.** The flagship, and the only task that addresses the observed failure verbatim. It is
   also the one whose value is easiest to overstate: a green lint panel is not a working node, so its
   acceptance insists on running the result.
5. **FUN-008 alongside** — smallest task in the phase, same knowledge as FUN-004, different moment.
6. **FUN-005**, the largest and the best. §1 and §2 need no runtime connection; **ship those before
   §3's live values**, which need the relay and the display dialect and are where the cost is.
7. **FUN-006** last of the editor work, because it is the task most likely to be built generically
   and be worth nothing — it wants FUN-003 and FUN-004 in place so it can be the *narrator* rather
   than the whole help system.
8. **FUN-007** is independent of the seam and can be worked in parallel at any point. It is the only
   task that closes the loop after the run, and the only one that catches the case where the user
   never opens the editor again.
9. **FUN-009** whenever the Expression copy is being written — ideally with phase 59's LGC-001, since
   both need the same three sentences.

## Standing constraints

- **`Inputs.` / `Outputs.` is the notation; `Noodl.Inputs` is a legacy alias we support forever and
  never write.** Pending Richard's sign-off in FUN-001 §2. Nothing in this phase may emit the alias.
- ⚠️ **Internal port names carry `in-` / `out-` prefixes**
  ([`simplejavascript.ts:711-714`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts)).
  Insert one raw and you get `Inputs.in-Value` — valid JavaScript, silently wrong, and it mints a
  port called `in`. Strip once, at FUN-003's boundary.
- ⚠️ **Port display names come from a proplist a human typed into**, so `My Value` is reachable and
  `Inputs.My Value` is a syntax error. Every insertion goes through FUN-001's builders, which choose
  bracket notation. Never concatenate a dot.
- ⚠️ **A value output is an assignment; a signal output is a call.** The runtime types the port from
  the shape it finds in the text
  ([`javascriptnodeparser.js:353-366`](../../../packages/noodl-runtime/src/javascriptnodeparser.js)).
  Any inserter that does not know the type will silently create the wrong kind of port.
- ⚠️ **Nothing in this phase may leak into `'expression'` mode.** Bare identifiers there *become*
  ports ([`expression.ts:399`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts)),
  so a fix-it or completion suggesting `Inputs.foo` would create a port named `Inputs`. Gate on
  `validationType`, and test the same text in both modes.
- ⚠️ **A declared `default` never runs its setter.** FUN-002's seed is a real parameter write at
  creation, not a port default. This is the repo's most-repeated node-library trap.
- ⚠️ **`CodeAuthoringContext` is a registry read per keystroke, not a prop** — and FUN-003's field is
  per-editor, so it **must be cleared on popout close** or the next editor answers with the previous
  node's ports.
- ⚠️ **The popout is rendered under `flushSync` so it can be measured** (FH-005). Anything added
  inside it that lays out asynchronously reopens the offscreen-popout defect.
- ⚠️ **A completion source that never fires is indistinguishable from one that is not installed**, and
  the zero-length-word guard has caused exactly that in this file before. Drive completions; do not
  unit-test them alone.
- **Verify the consequence, not the mechanism.** Every acceptance list here ends at a *working node*,
  not at a green panel or a rendered affordance. The originating failure was a node that ran
  successfully and did nothing.
- **Structure > gate > documentation**, inherited from phase 58 and unchanged. FUN-003 before its
  consumers; FUN-001's module before the copy that fills it.

## What is deliberately not here

- **Making bare identifiers work.** The biggest idea in the originating conversation: rewrite the
  source so `var Output_1 = Input_1` compiles into port reads and writes — a small AST pass turning
  assignments to declared output names into `Outputs.x = `, and declared input names into parameters.
  **It is the only option where the naive code just runs**, and the instinct behind it is sound: the
  Expression node already works that way, which is *why* the mental model transfers wrongly
  (FUN-009).

  Filed, not scheduled, for three reasons. It is magic, and magic is expensive to debug in someone
  else's project. It **breaks copy-paste equivalence** with every example, doc and AI-generated body
  we will ever write, which is a permanent tax paid by everyone to help beginners for one afternoon.
  And it diverges from upstream Noodl in the language itself, not just the tooling.

  If it is ever revisited, the shape worth building is the **opt-in per node with a "show me the real
  code" reveal that converts it** — because the reveal is the teaching moment, and it makes the
  notation discoverable rather than hidden. Revisit only if FUN-002 + FUN-004 measurably fail to move
  time-to-first-working-function.

- **A tutorial or a walkthrough.** The originating user will not read one; that is the observation
  the phase is built on. Every task delivers help at the point of the mistake, in their own port
  names.

- **Blockly.** [Phase 59](../phase-59-logic-seam/README.md) owns the visual path and the three-way
  choice. Nothing here waits for it, and nothing here duplicates it. The one shared artefact is the
  three one-sentence node descriptions (FUN-001 §4, FUN-009 §4).

- **The Script node's blank page.** `Javascript2` has `const defaultCode = ''`
  ([`javascript.ts:156`](../../../packages/noodl-viewer-react/src/nodes/std-library/javascript.ts))
  and the same problem with a more complicated body shape. Filed as a follow-on to FUN-002 so that
  task stays one node and one string.

- **"Ask the AI to write it."** Already shipped — `AiChat.tsx` is a fourth `JavaScriptEditor` call
  site with a per-node function template. A beginner who does not know the notation cannot check the
  answer, and making them able to is this phase's entire job.

- **Modernising legacy `Noodl.Inputs` in user projects.** It works and it is theirs. FUN-004 §4
  ensures it is never flagged; nothing rewrites it.
