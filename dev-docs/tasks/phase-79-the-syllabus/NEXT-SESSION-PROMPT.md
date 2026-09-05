# Phase 79 — next session

**Written 2026-09-05, end of session 7.** Richard's instruction was *"can we make another spine
tutorial or two please?"*. **Two were built, gated, driven and committed**: lesson 6 `moods`
(`45dac86f`) and lesson 7 `it-gets-demanding` (`08b9974e`).

## The board — re-derived from the task files

| task | state |
|---|---|
| [SYL-001](SYL-001-THE-HAND-HOLDING-HALF.md) | ✅ done, driven |
| [SYL-002](SYL-002-THE-CHAIN-THAT-CANNOT-DRIFT.md) | 🟡 **unblocked, six sessions overdue** — seven spine lessons now join |
| [SYL-003](SYL-003-THE-CREATURE-YOU-CHOSE.md) | ⬜ open, independent |
| [SYL-004](SYL-004-LESSON-1-YOUR-CREATURE-ON-SCREEN.md) — lesson 1 | 🟢 built, gated, driven |
| [SYL-005](SYL-005-LESSON-2-IT-BREAKS-ON-A-PHONE.md) — lesson 2 | 🟢 built, gated, ⬜ not driven |
| [SYL-006](SYL-006-LESSON-3-POKE-IT.md) — lesson 3 | 🟢 built, gated, ⬜ not driven |
| [SYL-007](SYL-007-LESSON-4-IT-FORGETS-YOU.md) — lesson 4 | 🟢 built, gated, ⬜ not driven |
| [SYL-008](SYL-008-LESSON-5-SHOW-WHAT-IT-FEELS.md) — lesson 5 | 🟢 built, gated, ⬜ not driven |
| [SYL-009](SYL-009-LESSON-6-MOODS.md) — lesson 6 | 🟢 **built, gated, DRIVEN** |
| [SYL-010](SYL-010-LESSON-7-IT-GETS-DEMANDING.md) — lesson 7 | 🟢 **built, gated, DRIVEN** |
| [LESSON-VOICE.md](LESSON-VOICE.md) | 🟡 written; §3 and §6 are Richard's |
| defect registers | **17 rows across four files, every one owner `NONE`** |

**Seven of twelve spine lessons ship.** `lessons:check` exit 0 over 8 bundles, and the chain reads
out in its own numbers: `3n → 6n → 11n → 15n → 18n → 21n → 25n → 30n`.

---

## 🟢 What changed about how these are measured, and it is the useful part of the session

**The app can be served and clicked, headlessly, in about four commands.** Nobody had done this in
this phase before session 7:

```bash
node scripts/devtools/render-from-disk.js <project-dir> --port 8617 &     # serves the real viewer
export DRIVE_STATE=/tmp/my-drive.json
node scripts/devtools/drive-page.js start http://127.0.0.1:8617/ --width 1280 --height 900 --profile x
node scripts/devtools/drive-page.js click Poke        # exact text match; clickish for substrings
node scripts/devtools/drive-page.js look              # visible text
node scripts/devtools/drive-page.js shot /tmp/a.png   # LOOK at it — opacity is invisible to `look`
node scripts/devtools/drive-page.js stop; lsof -ti :8617 -sTCP:LISTEN | xargs kill
```

⚠️ `eval` wraps its argument in a function body, so it needs `return` in front of the expression
(row [I2](DEFECTS-LESSON-7-FOUND.md)). Use `dom` and screenshots for anything visual.

🔴 **This is NOT the editor lesson-runner drive that is still owed.** It exercises the app the lesson
builds, not the grading of conditions. What it removes is the other doubt — that the graph might not
do what the prose says — and it caught things a render could not:

- lesson 6's branch fires on the **fifth** poke and not the fourth, and reverses on `Rest`;
- lesson 7's `And` **refuses** while one input is false even though the other is true, which is the
  only observation that can catch a missing `input 1` wire.

---

## FIRST JOB — still the lesson runner, and it has now slipped five sessions

🔴 **Twenty-six graded `connection` conditions ship across lessons 3-7 and not one has been observed
being graded in a running editor.** Lessons 6 and 7 add four first-of-their-kind cases on top of the
inherited ones:

1. 🔴 **Does the runner grade a `connection` at all?** Lesson 3 step 4 is still the cheapest instance.
2. 🔴 **A runtime-minted SIGNAL input** — `to-Happy`, `to-Bored` on lesson 6's `States`.
3. 🔴 **A runtime-minted OUTPUT** — `word` on the same node.
4. 🔴 **A wire leaving the Page node** — `didMount` in lesson 7 step 2. Nothing else in the spine
   addresses the page itself as a source.
5. **A numbered input with a space in its name** — `input 0` / `input 1` on lesson 7's `And`.
6. Inherited and still open: a **5-segment node path**, a condition on a **runtime-minted port**
   (`count`, `pokes`), `paramsEqual` round-tripping a string with `{braces}`, and the **negative
   control** — an untouched starter must read *not complete*.

**Check the box first** (`uptime`, `ListAgents`, and read any peer announcement). Install by placing
the bundle in `Learning/` and registering it in `learning_folder.json` directly; the real installer
goes through a native file dialog CDP cannot drive.

## SECOND JOB — pick one

### (a) [I1](DEFECTS-LESSON-7-FOUND.md) — the gates cannot see a time-based lesson. **Strongest.**

🔴 Lesson 7's solution and a copy with **all eight of its wires deleted** produce comparable render
reports, because the delay has not fired when the harness screenshots. `F4 pass` is printed in the
same tone it uses for a lesson it actually checked. Every remaining spine lesson touching time,
animation or navigation has the same hole.

⚠️ The cheap fix is probably not a new gate: `render-report` could take a `--settle-ms` or a second
capture, letting F4 ask *did anything change between these two frames?*. **Build the reverted arm** —
a check that does not go red on today's harness measures nothing.

### (b) SYL-002 — the chain check. Six lessons late, and seven bundles now join.

R1 said *"build the equality check before lesson 3, not after lesson 12."* Sessions 6 and 7 both held
byte-exact on the first attempt using the writer control (round-trip the previous solution's
`nodes.json` through `json.dumps(d, indent=2, ensure_ascii=False)`, no trailing newline, and compare
bytes). ⚠️ Compare `nodes.json` and `connections.json` only — `_registry.json` legitimately differs
([D4](DEFECTS-LESSON-2-FOUND.md)). The lesson order has to come from `curriculum.json` in the other
repo.

### (c) Lesson 8 — `snacks`, ~1 session

`Static Data`, `For Each`, `For Each Actions`. **Its opening problem is built and waiting**: lesson 7
ends by pointing at `Feed`, `Play` and `Sleep` — three words typed by hand since lesson 2, which
Nibbles now actively asks you to use.

🔴 **Read all four registers before designing, and check every node name in the entry with
`get_node_type` first.** Four of the seven entries built so far have named a node that could not do
the job the description implies; that check has paid for itself every single time.

---

## 🔴 Four rules the chain imposes, and nothing checks any of them

1. **A spine lesson may only ADD.** Grading a parameter the previous lesson set makes
   `derive_starter` retract it.
2. **Ungraded parameters may only go on nodes THIS lesson creates.**
3. **An outro may promise the app will GAIN something, and may never promise that anything already on
   screen will change or go away.**
4. 🆕 **A lesson may not repair a value an earlier lesson graded.** Lesson 6 could not fix
   *"poked 1 times"* because the words live in `Caption`'s graded `format`. It says so in its intro
   rather than quietly substituting something else, and that is the pattern to copy.

## ⬜ The curriculum edits owed — now FIVE, still one file, still not blocking

`~/vscode_projects/nodegx-community/src/lib/curriculum.json`. The editor's Learning shelf seeds from
the repo directory, so all seven lessons already reach every install; this is what puts them on the
served `/university` page.

1. **R2's insert** — a new entry for `it-breaks-on-a-phone` at position 2, `poke-it`'s `needs` moving
   to it. ⬜ The description is Richard's.
2. **`poke-it`'s `nodes` gains `Switch`.**
3. **`it-forgets-you`'s `nodes` loses `Value Changed`.**
4. 🆕 **`moods`' `nodes` → `Expression`, `Condition`, `States`.** `Switch` cannot branch; nothing in
   the `Logic` category compares two numbers, so an `Expression` is unavoidable.
5. 🆕 **`it-gets-demanding`'s `nodes` → `Timer`, `Switch`, `And`, `Animate To Value`.** `Switch` is
   the hinge — an `And` cannot read a signal.

⚠️ Also owed from lesson 2: **`it-breaks-on-a-phone`'s `teaches` must drop *alignment***
([D5](DEFECTS-LESSON-2-FOUND.md)).

## What is waiting on Richard, and none of it blocks the above

- ⬜ **The step prose of all seven spine lessons.** Print one without making a second copy:
  ```bash
  python3 -c "
  import json,sys
  d=json.load(open('project-examples/lessons/%s/lesson.json'%sys.argv[1]))
  for i,s in enumerate(d['steps'],1):
      print('--- %d %s (%s)'%(i,s.get('title'),s.get('kind','task')))
      print(s.get('body',''))
      if 'detail' in s: print('DETAIL:'); print(s['detail'])
      print()" moods
  ```
  🔴 **Prose-only edits are cheap** — edit `lesson.json`, then
  `npm run lessons:check > /tmp/lc.log 2>&1; echo "EXIT=$?"` (⚠️ **not** `| tail`). **The exception is
  `body` and `completeWhen`, which are a pair.** Lesson 6 grades two sentences and a threshold;
  lesson 7 grades `Feed me.`, `5000` and `400`. Changing any of those costs a `derive_starter` →
  `create_lesson` → re-drive.
- ⬜ **[LESSON-VOICE.md](LESSON-VOICE.md) §3 (em dash)** — seven bundles to one now. Lesson 1's nine
  hyphens are the last outlier.
- ⬜ **§6 — do we say "node"?** Six bundles follow the suggested rule. It wants ratifying.
- ⬜ **Seven badges**, the two new ones being `Made Its Mind Up` and `Two Things At Once`.
- ⬜ **Lesson 6's words**: `Nibbles is dozing` / `Nibbles is delighted`, and `pokes > 4`.
- ⬜ **Lesson 7's words**: `Feed me.`, and whether `Rest` should silence the nag. It does not today —
  `Rest` makes Nibbles bored, which makes it *start* asking.
- ⬜ **Does the `Poke` button get a colour?** Still black, still E1.
- ⬜ **Does the creature get eyes?** Still open from lesson 1.

## Traps from this session worth not repeating

- 🔴 **A screenshot that fits is not one that excludes.** Lesson 7's first drive showed the nag at
  t≈0 *and* t≈8s and read like a working timer — Chrome takes longer than five seconds to start, so
  there was never an observation before the deadline. The arm that settles it is `duration: 60000`.
- 🔴 **Read the port definition before designing around it.** Lesson 6's first design used `Visible`
  to swap two Texts; `Visible` sets `visibility: hidden` and **keeps the space**. Caught by reading
  `node-shared-port-definitions.ts:346`, not by rendering.
- 🔴 **`paramsEqual` on a `stringlist` is order-independent** and a `States` node starts in the first
  state in its list. The condition cannot say what the step body says (row H1).
- 🔴 **A `States` value with no `type-<value>` is a NUMBER**, and `jumpToState` assigns the raw value
  anyway — so it renders correctly at load and breaks on the first transition (row H2).
- ✅ **Test the writer before authoring.** One round-trip command, and the chain held byte-exact on
  the first attempt for the second and third session running.
- ⚠️ **The `nodegx` MCP server binds ONCE** and may be bound elsewhere. The lesson tools run directly:
  `writeDerivedStarter` from `packages/noodl-mcp/src/lessons/starterWriter` and `writeLessonBundle`
  from `.../lessons/bundleWriter`, under
  `npx ts-node --compiler-options '{"module":"CommonJS","esModuleInterop":true,"target":"ES2019","skipLibCheck":true}' --transpile-only`.
  That is what built both lessons.
