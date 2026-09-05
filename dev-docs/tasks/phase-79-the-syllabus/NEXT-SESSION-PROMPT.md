# Phase 79 — next session

**Written 2026-09-05, end of session 6.** Richard's instruction was *"let's make some more spine
tutorials please"*. **One was built, gated and committed**: lesson 5, `show-what-it-feels`. The
previous prompt made driving lessons 3 and 4 the first job; **that did not happen and the reason is
recorded rather than implied** — a peer held the dev stack, and then the box rebooted under a
fleet-wide load spike (load average **218**) which also took the `nodegx` MCP server out for the rest
of the session.

## The board — re-derived from the task files

| task | state |
|---|---|
| [SYL-001](SYL-001-THE-HAND-HOLDING-HALF.md) | ✅ done, driven |
| [SYL-002](SYL-002-THE-CHAIN-THAT-CANNOT-DRIFT.md) | 🟡 **unblocked, four sessions overdue** — five spine lessons now join |
| [SYL-003](SYL-003-THE-CREATURE-YOU-CHOSE.md) | ⬜ open, independent |
| [SYL-004](SYL-004-LESSON-1-YOUR-CREATURE-ON-SCREEN.md) — lesson 1 | 🟢 built, gated, **driven** |
| [SYL-005](SYL-005-LESSON-2-IT-BREAKS-ON-A-PHONE.md) — lesson 2 | 🟢 built, gated, ⬜ not driven |
| [SYL-006](SYL-006-LESSON-3-POKE-IT.md) — lesson 3 | 🟢 built, gated, ⬜ not driven |
| [SYL-007](SYL-007-LESSON-4-IT-FORGETS-YOU.md) — lesson 4 | 🟢 built, gated, ⬜ not driven |
| [SYL-008](SYL-008-LESSON-5-SHOW-WHAT-IT-FEELS.md) — lesson 5 | 🟢 **built, gated, ⬜ not driven** |
| [LESSON-VOICE.md](LESSON-VOICE.md) | 🟡 written; §3 and §6 are Richard's |
| [DEFECTS-LESSON-2-FOUND.md](DEFECTS-LESSON-2-FOUND.md) | 5 rows, all owner `NONE` |
| [DEFECTS-LESSON-3-FOUND.md](DEFECTS-LESSON-3-FOUND.md) | 4 rows, all owner `NONE` |
| [DEFECTS-LESSON-5-FOUND.md](DEFECTS-LESSON-5-FOUND.md) | 🆕 **4 rows, all owner `NONE`** |

**Five of twelve spine lessons ship.** `lessons:check` exit 0 over 6 bundles, and the chain reads out
in its own numbers: `3n → 6n → 11n → 15n → 18n → 21n`.

---

## FIRST JOB — the drive. It has now slipped four sessions and it has got bigger every one of them

🔴 **Ten graded `connection` conditions now ship across lessons 3, 4 and 5, and not one has ever been
observed being graded in a running editor.** Lessons 1 and 2 have no wires at all. Everything else
about all five lessons is measured: they render, they install through the real model, F1–F4 pass, the
chain is byte-exact. **The runner is the hole, and every remaining spine lesson is built on it.**

**Check the box first** (`uptime`, `ListAgents`) — this is the constraint that has actually blocked
this job four times, and session 6 lost the box entirely to a load spike. Install by placing the
bundle in `Learning/` and registering it in `learning_folder.json` directly; the real installer goes
through a native file dialog CDP cannot drive.

**What the drive is for — the first four are inherited, the last two are new with lesson 5:**

1. 🔴 **Does the runner grade a `connection` condition at all?** Lesson 3 step 4 is the cheapest
   instance. If this fails, five lessons need re-cutting.
2. 🔴 **Does it resolve a 5-segment node path?** `…:#Page shell:#Card:#Story`. Open since lesson 2.
3. **The negative control** — on each untouched starter, "check my work" must read *not complete*.
4. **Confirm [D2](DEFECTS-LESSON-2-FOUND.md#d2-️--the-learner-is-shown-a-raw-type-name)** — a
   condition renders its raw type name.
5. 🆕 🔴 **Does the runner grade a condition on a RUNTIME-MINTED port?** Lesson 5 grades
   `currentCount → Caption.count` and `currentCount → Excitement.pokes`. **Neither port exists until
   the learner types the parameter that mints it** — `{count}` into a format string, `pokes` into an
   expression. If the runner resolves ports against the static catalog, both steps are unsatisfiable
   and the lesson is unfinishable. Nothing on disk can answer this.
6. 🆕 **Does `paramsEqual` round-trip a string containing `{braces}`?** Lesson 5 grades
   `format == "Nibbles has been poked {count} times"`.

## SECOND JOB — pick one

### (a) [G1](DEFECTS-LESSON-5-FOUND.md#g1--an-expressions-as-number--as-string--as-boolean-outputs-never-update) — the Expression's dead outputs. **Now the strongest candidate.**

🔴 **An `Expression`'s `As Number`, `As String` and `As Boolean` outputs are never flagged dirty**
(`expression.ts:238-240` flags `result`, `isTrue`, `isFalse` and nothing else), so a wire from any of
them delivers the getter's value at connection time and never updates. Into a dimension port that
value is `NaN` and **the node disappears**: lesson 5's first build lost the creature entirely with
`create_lesson` scoring F1–F4 `pass`, `placeholders: 0` and `consoleErrors: []`.

It is a core node — one of the three sanctioned ways to compute — and this is three of its fourteen
ports dead with no warning anywhere. Two candidate fixes are written up in the row; they are **not**
equivalent, and ⚠️ **the reverted arm is mandatory** or the check measures nothing.

### (b) SYL-002 — the chain check

R1 said *"build the equality check before lesson 3, not after lesson 12."* It is four lessons late,
and five spine lessons now join. Session 5 broke the chain on **encoding**; session 6 did not,
because it ran the writer control first (round-trip the previous solution's `nodes.json` through the
intended serialiser and compare bytes — one command, and it is in
[SYL-008](SYL-008-LESSON-5-SHOW-WHAT-IT-FEELS.md)). **That is the design input the task was missing**:
keep the check exact and make the writer match.

⚠️ Compare `nodes.json` and `connections.json` only — `_registry.json` legitimately differs
([D4](DEFECTS-LESSON-2-FOUND.md#d4-low--derive_starter-ships-a-_registryjson-that-counts-the-solution)).
The lesson order has to come from `curriculum.json` in the **other repo**.

### (c) Lesson 6 — `moods`, ~1 session

Conditions and branching. **Its opening problem is already built and waiting**: lesson 5 deliberately
ends with the card reading *"Nibbles has been poked 1 times"*, and no rewording fixes it because the
right words depend on the number.

🔴 **Read all three registers before writing a condition**, in particular
[G1](DEFECTS-LESSON-5-FOUND.md#g1--an-expressions-as-number--as-string--as-boolean-outputs-never-update)
(take an Expression's value from `result`),
[D1](DEFECTS-LESSON-2-FOUND.md#d1--create_lesson-cannot-catch-a-condition-a-learner-can-never-satisfy)
(check `defaultUnit` before grading a number with `paramsEqual`) and
[E1](DEFECTS-LESSON-3-FOUND.md#e1--a-button-cannot-be-put-on-the-design-system-from-the-properties-panel).

⚠️ **`Condition`, `Switch` and `States` are the curriculum's names for lesson 6 — check the ports
with `get_node_type` before designing around any of them.** Two of the four entries checked in
session 5 named a pairing that could not be built; lesson 5's two were the first that both held.

---

## 🔴 Three rules the chain imposes, and nothing checks any of them

The first two are from session 5. **The third is new, and it is the first to bite a lesson that was
already written.**

1. **A spine lesson may only ADD.** Grading a parameter the previous lesson set makes
   `derive_starter` retract it — the learner opens lesson N to find lesson N−1's work undone.
2. **Ungraded parameters may only go on nodes THIS lesson creates**, or they survive into the starter
   as work the learner never did.
3. 🆕 **An outro may promise the app will GAIN something, and may never promise that anything already
   on screen will change or go away.** `derive_starter` only subtracts a lesson's own steps from its
   own solution; it cannot restore what the solution does not contain, so **nothing an earlier lesson
   built can ever be deleted, re-parented or hidden.**

⬜ **Lesson 4's outro is owed a prose edit** because of rule 3 — it promises the card will stop
saying `3`, and lesson 5 structurally cannot deliver that. It is a popup with no `completeWhen`, so
the edit is free. See [G4](DEFECTS-LESSON-5-FOUND.md#g4-low--nothing-checks-that-a-spine-lessons-outro-promises-something-deliverable).

## ⬜ The curriculum edits owed — still THREE, still one file, still not blocking

`curriculum.json` lives in the separate `nodegx-community` checkout
(`~/vscode_projects/nodegx-community/src/lib/curriculum.json`). None of this gates shipping — the
editor's Learning shelf seeds from the repo directory, so all five lessons already reach every
install. `curriculum.json` is what puts them on the served `/university` page.

1. **R2's insert** — a new entry for `it-breaks-on-a-phone` at position 2, and `poke-it`'s `needs`
   moving to it. ⬜ **The description is Richard's.**
2. **`poke-it`'s `nodes` gains `Switch`.**
3. **`it-forgets-you`'s `nodes` loses `Value Changed`.**

⚠️ Also owed from lesson 2: **`it-breaks-on-a-phone`'s `teaches` must drop *alignment***
([D5](DEFECTS-LESSON-2-FOUND.md#d5-low--columnsjustifycontent-is-inert-for-auto-height-items)).

✅ **Lesson 5 needs no curriculum correction** — `Expression` and `String Format` are both real type
names whose display names match, and both do the job the description implies. First spine lesson of
which that is true.

## What is waiting on Richard, and none of it blocks the above

- ⬜ **The step prose of all five spine lessons.** Print any lesson's without making a second copy:
  ```bash
  python3 -c "
  import json,sys
  d=json.load(open('project-examples/lessons/%s/lesson.json'%sys.argv[1]))
  for i,s in enumerate(d['steps'],1):
      print('--- %d %s (%s)'%(i,s.get('title'),s.get('kind','task')))
      print(s.get('body',''))
      if 'detail' in s: print('DETAIL:'); print(s['detail'])
      print()" show-what-it-feels
  ```
  🔴 **Prose-only edits are cheap** — edit `lesson.json`, then
  `npm run lessons:check > /tmp/lc.log 2>&1; echo "EXIT=$?"` (⚠️ **not** `| tail`; `$PIPESTATUS` is
  empty in zsh). **The exception is `body` and `completeWhen`, which are a pair.** In lesson 5 that
  bites on two strings: `Caption`'s **format** and `Excitement`'s **expression** are both graded with
  `paramsEqual`, so rewording the sentence or changing the sum costs a `derive_starter` →
  `create_lesson` → re-drive.
- ⬜ **[LESSON-VOICE.md](LESSON-VOICE.md) §3 (em dash)** — lesson 5 is em-dash like 3 and 4, so the
  corpus is now **five bundles to one**. Lesson 1's nine hyphens are the last outlier and the case
  for correcting them is as strong as it will ever get.
- ⬜ **§6 — do we say "node"?** Four bundles now follow the suggested rule. It is a rule in practice
  and wants ratifying.
- ⬜ **Five badges**: `First Light`, `Holds Its Shape`, `First Contact`, `It Remembers`,
  `Makes Sense Now`.
- ⬜ **Lesson 5's sentence**, currently `Nibbles has been poked {count} times`, and **its sum**,
  currently `min(96 + pokes * 8, 200)`. Both graded.
- ⬜ **Does the `Poke` button get a colour?** It is black, which is E1.
- ⬜ **Does the creature get eyes?** Still open from lesson 1.

## Traps from this session worth not repeating

- 🔴 **An `Expression`'s `As Number` / `As String` / `As Boolean` never update.** Take the value from
  **`result`**. G1 above; it cost four renders and a vanished creature.
- 🔴 **`distinctAccents` is blind to the circle.** The render report read `accents: 0` for lesson 4's
  *correct* solution, which draws a `--primary` circle 96px across. **The screenshot is what caught
  the defect**; had the numbers been trusted, the conclusion would have been "it was never there in
  lesson 4 either", which is false. **Look at the picture.**
- 🔴 **A render of one arm cannot tell a live wire from a dead one when the value is `0`.** Lesson 5
  is graded by a **control pair** — a second arm with `Pokes.startValue: 5`, which must read
  `5 times` and draw the circle at `136px`. The shipped arm alone proves neither.
- ✅ **Test the writer before authoring, not after.** One command — round-trip the previous lesson's
  shipped `nodes.json` through `json.dumps(d, indent=2, ensure_ascii=False)` and compare bytes — and
  the chain then held byte-exact on all four files first attempt.
- ⚠️ **`derive_starter`'s `unsupported` retraction is ambiguous.** *"no X → Y wire exists between
  those nodes"* is what it says both when the wire was already removed with its node (benign) and
  when the port name is wrong (fatal). G3 above.
- ⚠️ **The `nodegx` MCP server binds ONCE and may be bound to another session's directory** — and if
  it disconnects there is no way to reconnect it in-session. The lesson tools are reachable directly:
  `writeDerivedStarter` from `packages/noodl-mcp/src/lessons/starterWriter` and `writeLessonBundle`
  from `.../lessons/bundleWriter`, run under
  `npx ts-node --compiler-options '{"module":"CommonJS","esModuleInterop":true,"target":"ES2019","skipLibCheck":true}' --transpile-only`.
  That is what built this lesson.
