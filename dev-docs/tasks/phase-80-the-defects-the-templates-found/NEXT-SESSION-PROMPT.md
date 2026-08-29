# Phase 80 — next session

## State: DEF-001, DEF-002, DEF-003 and DEF-016 are closed. The next rank is DEF-004.

**s4 (2026-08-29)** took DEF-003 and closed all three of its rows — and **two of them were not what
the register said they were.** Read `DEF-003-…md` §7 before anything else; it is short and it is the
session's whole finding.

| commit | what |
|---|---|
| `be64b4eb` | **DEF-003** — `Page.title`/`urlPath` declared, `noBoxExit` at both doors, two instrument fixes, the catalog regenerated |
| `3d4c24db` | DEF-003 closed in the register, with two other people's reds named |

Gates at close: `test:ci` **2889 specs, 4 failures, all `AIX-006 style vocabulary` by name** (the
floor, seed 85339) · viewer-react **1087/1087** · nodegx-export **797/797** · nodegx-backend
**1306 passed / 10 skipped** · noodl-mcp **927/928** (see §"not yours" below) · `typecheck:editor`,
`typecheck:mcp`, `catalog:check`, `catalog:merge:check`, `catalog:groups:check`, `docs:nodes:check`
all clean.

---

## 🔴 The finding, in one paragraph

**DEF-003 §6 said *"(c) is read from the door, not driven — drive it before building the fix"*, and
that instruction was worth more than the rest of the file.** Driven: **(c)'s premise is false** — a
page authored headlessly with `title` set renders with that `document.title`, and always has; the
exporter reads the parameter and never needed the port. **(a) was already fixed** — the door has
blocked a bare number on a percent-defaulted port since phase 40, and both phases that recorded the
row measured the *coercion* and never asked the door. Only **(b)** needed the fix it asked for.

⚠️ **The general shape, and it is worth carrying:** phases 76 and 77 recorded three rows by reading
source and one catalogue response. Two of the three were wrong about what the product does. **A row
recorded from a reading is a hypothesis; ranking it as a defect makes it look like a measurement.**

## What to do next

**DEF-004** — *When it goes wrong you cannot see where* (P77 D2, D3; bites anyone debugging). Not
read yet this session. Open beside it: **DEF-017 C1** (`--surface-raised` declared and read by
nothing; phase 78's B3 is capped until it lands), **DEF-006**, **DEF-007**, **DEF-008**, **DEF-009**,
**DEF-014**, **DEF-015**, and the four carried from phase 76 by reference.

🔴 **Before you start DEF-004, do to it what §6 made me do to DEF-003: find the claim in it that is a
reading rather than a measurement, and drive that one first.** It is two hours that can delete a day.

## 🔴 Reds that are NOT yours

- **`noodl-mcp/tests/templateAppearance.test.ts` — `site-builder has the pinned page count`,
  expected 5, received 6.** Created by `e5922d21` (**TPL-001, phase 78**) with the pin at 5 over a
  template that already ships six pages. Nothing in phase 80 can move a count of `Page` nodes.
  **Owner: TPL-001 / phase 78.**
- **`nodegx-export` is jest, not vitest.** `npx vitest run` there gives *36 suites failed, no tests,
  `describe is not defined`* — a wrong-runner result that reads exactly like a broken package. Use
  `npm test`. It is **797/797**, up from 788 with the peer's uncommitted EXP-011 work in the tree.
- **Two `nodegx-backend` browser drives in one jest run flake on each other** (they bind real
  sockets). `sb015-default-policy-drive` failed beside `sb015-first-local-run` and passed alone.
  Run that suite `--runInBand`.

## 🔴 What this session paid for, that the next one should not re-buy

- **A previous session had already written the correct fix for (c), in a code comment, with the
  condition for its own deletion.** `parameterValues.ts`'s D16 carve-out closed with *"the honest fix
  is to declare the ports on `Page`, at which point this function has no population and should be
  deleted rather than left."* Nobody did it, because the carve-out made the symptom stop. **A
  suppression that names its own real fix is a task nobody filed** — when you write one, file it.
- 🔴 **A heuristic keyed on a PORT NAME changes meaning the moment a port is declared.** Declaring
  `title` on `Page` made it "content-bearing" in `render-report.js`'s regex, which broke
  `blankDiagnosis` on AWP-003's real artefact — a blank page the tool could no longer explain. The
  suite caught it. **Widening a node's declared surface is a change to every name-keyed rule in the
  repo, not only to the rule you are working on.**
- 🔴 **Your instrument can produce a value the product cannot.** `render-from-disk.js` was missing
  the exporter's title fallback, so an untitled page rendered `document.title === "undefined"`. That
  is a string no product path emits, and it cost an hour as a phantom product defect. **When a drive
  gives you a surprising value, diff the harness against the real producer before writing it up.**
- **My own rule had a false positive and only a control found it.** `noBoxExit`'s first version
  probed box-model names only, so it fired on `Circle` — which paints through `fillColor` and
  `strokeColor` — and would have told that author to wrap it in a `Group`. **A new rule's first job
  is to name the population it claims to be about, and to put a member of the neighbouring
  population in the spec.**
- **`catalog:check` is a PR CI gate and was red at HEAD**, because DEF-016 changed node descriptions
  without regenerating. Fixed here as a side effect. Same lesson as last session's, one artifact
  over: **a closed task's debts need an owner.**

## Traps carried

- ⚠️ **The viewer bundle at session start was a 14.3 MB dev build**, not the 1.5 MB
  `webpack.viewer.prod.js` output the render harness documents. Anyone who measured against it was
  measuring a different artefact. It is now the prod build. It is **gitignored and shared** — rebuild
  it with the documented command before any drive, and check nothing else is driving first.
- 🔴 **`grep`/ugrep found ZERO matches for `runtimeBehavior`** across a tree containing hundreds.
  `rg` found them instantly. Also hit again: **`rg -rn` is parsed as `-r n`** and rewrites every
  matched line to the literal `n` — it looks like a bizarre codebase, not like a flag error.
- ⚠️ **`git commit <pathspecs>` errors on an untracked path** rather than skipping it silently, which
  is the good half of that trap. `git add` the new files and commit in the same breath.
- ⚠️ **zsh does not word-split an unquoted `$PATHS`** — a long pathspec list in a variable arrives as
  one giant filename. List them literally.
