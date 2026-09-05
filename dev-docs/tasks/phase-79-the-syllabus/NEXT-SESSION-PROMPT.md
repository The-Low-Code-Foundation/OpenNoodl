# Phase 79 — next session

**Written 2026-09-05, end of session 5.** The previous version made driving lesson 2 the first job.
**That did not happen and the reason is recorded rather than implied**: a peer session held the dev
stack for a REL-012 drive and then a REL-016 drive for the whole session. Richard's instruction for
the session was *"continue making new tutorials to ship with the editor"*, and two were built.

## The board — re-derived from the task files

| task | state |
|---|---|
| [SYL-001](SYL-001-THE-HAND-HOLDING-HALF.md) | ✅ done, driven |
| [SYL-002](SYL-002-THE-CHAIN-THAT-CANNOT-DRIFT.md) | 🟡 **unblocked and now overdue** — four spine lessons join |
| [SYL-003](SYL-003-THE-CREATURE-YOU-CHOSE.md) | ⬜ open, independent |
| [SYL-004](SYL-004-LESSON-1-YOUR-CREATURE-ON-SCREEN.md) — lesson 1 | 🟢 built, gated, **driven** |
| [SYL-005](SYL-005-LESSON-2-IT-BREAKS-ON-A-PHONE.md) — lesson 2 | 🟢 built, gated `d656b714`, ⬜ not driven |
| [SYL-006](SYL-006-LESSON-3-POKE-IT.md) — lesson 3 | 🟢 built, gated, ⬜ not driven |
| [SYL-007](SYL-007-LESSON-4-IT-FORGETS-YOU.md) — lesson 4 | 🟢 built, gated, ⬜ not driven |
| [LESSON-VOICE.md](LESSON-VOICE.md) | 🟡 written; §3 and §6 are Richard's |
| [DEFECTS-LESSON-2-FOUND.md](DEFECTS-LESSON-2-FOUND.md) | 5 rows, all owner `NONE` |
| [DEFECTS-LESSON-3-FOUND.md](DEFECTS-LESSON-3-FOUND.md) | 4 rows, all owner `NONE` |

**Four of twelve spine lessons ship.** `lessons:check` exit 0 over 5 bundles, and the chain reads out
in its own numbers: `3n → 6n → 11n → 15n → 18n`.

---

## FIRST JOB — drive lessons 3 and 4, and it is one drive, not two

🔴 **This has been deferred three sessions running and it has stopped being a gap against a
standard — it is now the one unexercised mechanism the rest of the spine is built on.**

Lessons 1 and 2 contain **no connections at all**. Lessons 3 and 4 contain **six graded
`connection` conditions between them, and not one has ever been observed being graded in a running
editor.** Everything else about both lessons is measured: they render, they install through the real
model, F1–F4 pass, the chain is byte-exact. The runner is the hole.

**Check the box first** (`uptime`, `ListAgents`) — a peer's `dev` reaps yours and announcing is the
protocol here. Install by placing the bundle in `Learning/` and registering it in
`learning_folder.json` directly; the real installer goes through a native file dialog CDP cannot
drive (specced by `tut-004/the-real-bundle-installs.test.ts`).

**The four things the drive is for:**

1. 🔴 **Does the runner grade a `connection` condition at all?** Lesson 3 step 4 is the cheapest
   instance: `Poke.onClick → Poked.flip`. If this fails, four lessons need re-cutting and it is
   better to know now.
2. 🔴 **Does it resolve a 5-segment node path?** `…:#Page shell:#Card:#Reaction`. Open since lesson
   2 and never answered. Lesson 2's deepest is 6 segments, so drive that one in the same sitting.
3. **The negative control** — on each untouched starter, "check my work" must read *not complete*.
   Structurally guaranteed by `derive_starter`'s replay and F2, never seen on screen.
4. **Confirm [D2](DEFECTS-LESSON-2-FOUND.md#d2-️--the-learner-is-shown-a-raw-type-name)** — a
   condition renders its raw type name. Lesson 3 shows it twice over
   (`net.noodl.controls.button`, `net.noodl.animatetovalue`), which is uglier than lesson 2's single
   instance and makes the case for fixing it stronger.

## SECOND JOB — pick one

### (a) SYL-002 — the chain check. **Now the strongest candidate.**

R1 said *"build the equality check before lesson 3, not after lesson 12."* It is three lessons late.
Four spine lessons now join, so the check has real joins to test rather than one.

🔴 **Session 5 broke the chain and it was pure ENCODING** — see
[SYL-007](SYL-007-LESSON-4-IT-FORGETS-YOU.md#-and-the-chain-broke-first-on-encoding-with-nothing-semantically-wrong).
Lesson 3 was hand-authored (the `nodegx` MCP server binds once and was already bound to another
session's directory), and Python's `json.dump` defaults `ensure_ascii=True`, so the file carried
`—` escapes and a trailing newline where the tools write literal UTF-8 with neither.
**Semantically identical; byte-different.**

**That is the design input this task was missing.** A byte check will fire on differences that mean
nothing, and the tempting fix is to loosen it into a semantic compare — at which point it stops
catching the thing it exists for. Session 5's answer was to make the *writer* match and keep the
check exact; the task should decide whether that holds when the writer is a human.

⚠️ Compare `nodes.json` and `connections.json` only — `_registry.json` legitimately differs
([D4](DEFECTS-LESSON-2-FOUND.md#d4-low--derive_starter-ships-a-_registryjson-that-counts-the-solution)).
The lesson order has to come from `curriculum.json` in the **other repo**, which is still the part
that needs designing.

### (b) Lesson 5 — `show-what-it-feels`, ~1 session

Expressions and reactive data flow. Its starter must equal lesson 4's solution, so it may only add.
**Its opening problem is already built and waiting**: lesson 4 deliberately ends with the card
saying a bare `3`, and the curriculum entry opens *"the number is stored and the screen says nothing
useful."*

🔴 **Read the two registers before writing a single condition.** In particular
[D1](DEFECTS-LESSON-2-FOUND.md#d1--create_lesson-cannot-catch-a-condition-a-learner-can-never-satisfy)
— check every number-with-units port's `defaultUnit` with `get_node_type` before grading it with
`paramsEqual` — and [E1](DEFECTS-LESSON-3-FOUND.md#e1--a-button-cannot-be-put-on-the-design-system-from-the-properties-panel),
because lesson 5 may want a styled control and cannot have one.

### (c) [E1](DEFECTS-LESSON-3-FOUND.md#e1--a-button-cannot-be-put-on-the-design-system-from-the-properties-panel) — the Button cannot be put on the design system, ~1 session

The highest-severity row on either register, and it is now **visible in two shipped lessons**: both
buttons in the spine render raw `#000000` beside a `--primary` circle. `backgroundColor` defaults to
a hard-coded black and the `variant` port that would paint `--primary` is `allowConnectionsOnly`, so
the on-token route is not offered in the panel at all.

⚠️ **Build the reverted arm.** The check must go red on today's catalog and green after, or it is
measuring nothing.

---

## ⬜ The curriculum edits owed — now THREE, still one file, still not blocking

`curriculum.json` lives in the separate `nodegx-community` checkout
(`~/vscode_projects/nodegx-community/src/lib/curriculum.json`). None of this gates shipping — the
editor's Learning shelf seeds from the repo directory, so all four lessons already reach every
install, and a peer's packaged build in session 5 confirmed it (**4 lessons, 122 files, no
stowaways**). `curriculum.json` is what puts them on the served `/university` page.

1. **R2's insert** — a new entry for `it-breaks-on-a-phone` at position 2, and `poke-it`'s `needs`
   moving to it. Spine 12 → 13, curriculum 15 → 16. ⬜ **The description is Richard's.**
2. **`poke-it`'s `nodes` gains `Switch`.** The entry names `Button` and `Animate To Value`, and
   **those two cannot be connected** — `Click` is a signal, `Target Value` is a number, and no
   visual node in the catalog has a signal input at all. A converter is structurally required.
3. **`it-forgets-you`'s `nodes` loses `Value Changed`.** `Counter` already emits `countChanged`, so
   watching the count with a Value Changed duplicates a port the node has.

⚠️ Also owed from lesson 2: **`it-breaks-on-a-phone`'s `teaches` must drop *alignment***
([D5](DEFECTS-LESSON-2-FOUND.md#d5-low--columnsjustifycontent-is-inert-for-auto-height-items)) — the step that would have taught it was measured to change
nothing and was deleted.

## What is waiting on Richard, and none of it blocks the above

- ⬜ **The step prose of all four spine lessons.** Drafted so he is editing, not staring at a blank
  page. Print any lesson's without making a second copy:
  ```bash
  python3 -c "
  import json,sys
  d=json.load(open('project-examples/lessons/%s/lesson.json'%sys.argv[1]))
  for i,s in enumerate(d['steps'],1):
      print('--- %d %s (%s)'%(i,s.get('title'),s.get('kind','task')))
      print(s.get('body',''))
      if 'detail' in s: print('DETAIL:'); print(s['detail'])
      print()" it-forgets-you
  ```
  🔴 **Prose-only edits are cheap** — edit `lesson.json`, then
  `npm run lessons:check > /tmp/lc.log 2>&1; echo "EXIT=$?"` (⚠️ **not** `| tail`; `$PIPESTATUS` is
  empty in zsh). **The exception is `body` and `completeWhen`, which are a pair.** In lesson 4 that
  bites on one word: `Rest`'s caption is graded with `paramsEqual`, so renaming the button costs a
  `derive_starter` → `create_lesson` → re-drive.
- ⬜ **[LESSON-VOICE.md](LESSON-VOICE.md) §3 (em dash)** — lessons 3 and 4 were both written em-dash,
  so the corpus is now **four bundles to one**. Lesson 1's nine hyphens are the last outlier and the
  case for correcting them is as strong as it will get.
- ⬜ **§6 — do we say "node"?** Lessons 3 and 4 follow the suggested rule (say it on a type's first
  appearance, then not again). Three bundles now do it; it is a rule in practice and wants ratifying.
- ⬜ **Four badges**: `First Light`, `Holds Its Shape`, `First Contact`, `It Remembers`.
- ⬜ **Does the `Poke` button get a colour?** It is black, which is E1. Fixing E1 fixes both lessons
  for free; styling around it does not.
- ⬜ **Does the creature get eyes?** Still open from lesson 1.

## Traps from this session worth not repeating

- 🔴 **A byte-identical chain check fires on encoding.** `json.dump` defaults to
  `ensure_ascii=True`; the tools write literal UTF-8 with no trailing newline. Semantically equal,
  byte-different. **Match the writer, do not loosen the check.**
- 🔴 **The `nodegx` MCP server binds ONCE, and it may already be bound to another session's
  directory.** `open_project` reports where and changes nothing. Authoring by hand is a workable
  fallback — `derive_starter` and `create_lesson` take explicit directories and do not care about
  the binding — but it is what let the encoding drift in.
- 🔴 **A curriculum node list is a draft, not a specification.** Two of the four entries touched this
  session named a node pairing that cannot be built. Check the ports with `get_node_type` before
  designing around a name.
- 🔴 **`Color Blend` cannot take a design token** and says so only in a port description. It
  `parseInt`s a 6-digit hex and returns the string `#NaNNaNNaN` for `var(--primary)`, silently. It
  killed lesson 3's first design, which was the corpus's own `anim-hover-highlight` idiom.
- ⚠️ **`Timer`'s display name is `Delay`**, it lives under **Utilities**, and it has no value output
  at all — only signals. Lesson 6's curriculum entry names it as "Timer".
- ⚠️ **A `text` parameter left unset is a detector.** `Score` carries none, so a wire that stops
  delivering falls through to the catalog placeholder and F4 sees it. Setting it "so it reads nicely"
  would swallow the failure the gate exists to catch.
