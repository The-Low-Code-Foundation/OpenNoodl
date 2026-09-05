# Phase 79 — next session

**Written 2026-09-05, end of session 4.** The previous version of this file asked for a copy-review
session with Richard. **That has partly happened**: he was asked, chose *"draft it, capture the
rules"*, and [LESSON-VOICE.md](LESSON-VOICE.md) now exists — measured across all three shipped
bundles rather than asserted. Two of its calls are still his. This file replaces that one.

## The board — re-derived from the task files

| task | state |
|---|---|
| [SYL-001](SYL-001-THE-HAND-HOLDING-HALF.md) | ✅ done, driven |
| [SYL-002](SYL-002-THE-CHAIN-THAT-CANNOT-DRIFT.md) | 🟡 **unblocked** — two spine lessons now exist |
| [SYL-003](SYL-003-THE-CREATURE-YOU-CHOSE.md) | ⬜ open, independent |
| [SYL-004](SYL-004-LESSON-1-YOUR-CREATURE-ON-SCREEN.md) — lesson 1 | 🟢 built, gated, driven |
| [SYL-005](SYL-005-LESSON-2-IT-BREAKS-ON-A-PHONE.md) — lesson 2 | 🟢 built, gated `d656b714`, ⬜ **not driven** |
| [LESSON-VOICE.md](LESSON-VOICE.md) | 🟡 written; §3 and §6 are Richard's |
| [DEFECTS-LESSON-2-FOUND.md](DEFECTS-LESSON-2-FOUND.md) | 5 rows, all owner `NONE` |

**Two of twelve spine lessons ship.** `lessons:check` exit 0 over 3 bundles.

---

## FIRST JOB — drive lesson 2

🔴 **It is the only thing SYL-005 owes that is not done**, and lesson 1 set the standard. It was
skipped because the box was at load average 8.32 with four peer sessions live, not because it was
judged unnecessary.

**Check the box first** (`uptime`, `npm run dev:stop -- --list`, `ListAgents`) — a dev stack is three
webpack watchers plus Electron, and a peer's `dev` reaps yours.

The bundle is already on disk at `project-examples/lessons/it-breaks-on-a-phone`. Install it the way
[SYL-004](SYL-004-LESSON-1-YOUR-CREATURE-ON-SCREEN.md) did — place it in `Learning/` and register it
in `learning_folder.json` directly, because the real installer goes through a **native file dialog
CDP cannot drive** (that path is specced by `tut-004/the-real-bundle-installs.test.ts`).

**The four things the drive is for, and nothing else** — everything else was answered from source and
is recorded in [SYL-005 §6](SYL-005-LESSON-2-IT-BREAKS-ON-A-PHONE.md#6--what-was-not-done-and-what-it-costs)
so you do not re-derive it:

1. 🔴 **Does the runner resolve a 5-segment node path?** `…:#Page shell:#Board:#Care:#Feed`. Lesson
   1's deepest is 4. **This is the real unknown** — if it fails, steps 4 onward never tick.
2. 🔴 **The negative control**: on the untouched starter, "check my work" must read *not complete*.
   Structurally guaranteed by `derive_starter`'s replay and F2, never observed on screen.
3. **The positive**: add `Board`, check again, expect step 2 to complete and the runner to advance.
4. **Confirm [D2](DEFECTS-LESSON-2-FOUND.md#d2-️--the-learner-is-shown-a-raw-type-name)** — step 3's
   condition should render *"a **net.noodl.visual.columns** called “Care”"*. Predicted from
   `describeCondition`; seeing it is what turns a prediction into a finding.

⚠️ **Set `NOODL_REMOTE_DEBUG_PORT` if anything already holds 9222.** It was free at 08:45.

## SECOND JOB — pick one, they are independent

### (a) D1 — the gate hole, ~1 session

[D1](DEFECTS-LESSON-2-FOUND.md#d1--create_lesson-cannot-catch-a-condition-a-learner-can-never-satisfy)
is the highest-value row on the register and it gets worse with every lesson: **`create_lesson`
cannot see a condition whose unit a learner can never type.** All four classes read `pass` while the
step refuses correct work. Lesson 2 hit it on `Group.maxWidth` (`defaultUnit: "%"`) and it was caught
by hand.

The fix is mechanical: for every `paramsEqual` naming a number-with-units port, compare the
condition's unit to the catalog's `defaultUnit`; **warn** (never refuse — lesson 2 does it
deliberately and correctly) and name the step. ⚠️ Build the **reverted arm**: the check must go red
on lesson 2's original `body` and green on the current one, or it is measuring nothing.

### (b) SYL-002 — the chain check, ~1 session

R1: *"build the equality check before lesson 3, not after lesson 12."* **It is now buildable** and
lesson 3 is next, so this is the last cheap moment. The invariant, and the diff that proves it holds
today, are in [SYL-005](SYL-005-LESSON-2-IT-BREAKS-ON-A-PHONE.md#-the-chain-is-a-build-constraint-and-it-constrained-this-lesson-twice).

🔴 **Compare `nodes.json` and `connections.json`, not the whole directory** — `_registry.json`
legitimately differs ([D4](DEFECTS-LESSON-2-FOUND.md#d4-low--derive_starter-ships-a-_registryjson-that-counts-the-solution))
and so do timestamps, and a check that fails on those is a check somebody turns off. The lesson order
has to come from `curriculum.json` in the **other repo**, which is the part that needs designing.

### (c) Lesson 3 — `poke-it`, ~1 session

Events. Its starter must equal lesson 2's solution, so it may only **add** to the `Board`/`Care`
strip — which is exactly why lesson 2 ends with three words that do nothing.

⚠️ **`Button` is the type name of the DEPRECATED node.** `poke-it` needs
`net.noodl.controls.button`. Same trap for `Variable`, `Text Input`, `Checkbox`, `Radio Button`,
`Cloud Function`.
🔴 **Read [D1](DEFECTS-LESSON-2-FOUND.md#d1--create_lesson-cannot-catch-a-condition-a-learner-can-never-satisfy)
before writing a single `paramsEqual`** — check every number-with-units port's `defaultUnit` with
`get_node_type` first, or do (a) so the gate does it for you.

---

## What is waiting on Richard, and none of it blocks the above

- ⬜ **The step prose of both spine lessons.** Drafted so he is editing, not staring at a blank page.
  Print lesson 2's without making a second copy of it:
  ```bash
  python3 -c "
  import json
  d=json.load(open('project-examples/lessons/it-breaks-on-a-phone/lesson.json'))
  for i,s in enumerate(d['steps'],1):
      print('--- %d %s (%s)'%(i,s.get('title'),'popup' if s.get('kind')=='popup' else 'task'))
      print(s.get('body',''))
      if 'detail' in s: print('DETAIL:'); print(s['detail'])
      print()"
  ```
  🔴 **Prose-only edits are cheap** — edit `lesson.json`, then
  `npm run lessons:check > /tmp/lc.log 2>&1; echo "EXIT=$?"` (⚠️ **not** `| tail`; `$PIPESTATUS` is
  empty in zsh). No re-derive, no re-drive. **The exception is `body` and `completeWhen`, which are a
  pair**: if a rewrite changes what the step asks for, the condition moves with it, and *that* means
  `derive_starter` → `create_lesson` → re-drive.
- ⬜ **[LESSON-VOICE.md](LESSON-VOICE.md) §3 — em dash.** New measurement: `log-a-thing` already uses
  **11 em dashes and 0 hyphen-dashes**, so **lesson 1's 9 hyphens are the outlier**, not the house
  style. This is a stronger case than the previous prompt had. Nine substitutions in one file.
- ⬜ **§6 — do we say "node"?** Suggested rule: on a type's first appearance in a lesson, then not
  again.
- ⬜ **Both badges**: `First Light`, `Holds Its Shape`.
- ⬜ **Lesson 2's `description`**, and 🔴 **its `teaches` line**: R2 says *alignment*, and the lesson
  does **not** teach alignment — the step that would have was deleted because the control it set
  changed nothing on screen ([D5](DEFECTS-LESSON-2-FOUND.md#d5-low--columnsjustifycontent-is-inert-for-auto-height-items)).
- ⬜ **Does the creature get eyes?** Still open from lesson 1.

## ⬜ The curriculum entry still does not exist

`curriculum.json` is in the **separate `nodegx-community` checkout** and still lists `poke-it` at
spine position 2. R2's insert is **two edits**: the new entry, and `poke-it`'s `needs` moving to
`it-breaks-on-a-phone`. Spine 12 → 13, curriculum 15 → 16.

⚠️ **This does not gate shipping.** The editor's Learning shelf seeds from the repo directory, so
lesson 2 already reaches every install. `curriculum.json` is what puts it on the served
`/university` page — and being served, it reaches existing installs with no update, which is why the
wording is Richard's.

## Traps from this session worth not repeating

- 🔴 **`grep` skipped a `.ts` file silently.** `grep -n SHIPPED_LESSONS_REPO_PATH lessonseed.ts` →
  nothing; `grep -an` → seven hits. The absence would have led to inventing an allowlist that already
  existed. **Use `-a`.**
- 🔴 **A corpus grep can answer the wrong question convincingly.** Sampling real projects for
  `maxWidth` shapes returned 60+ consistent hits — every one written by an MCP server or an export
  fixture, i.e. the wrong population for *"what does the panel write when a person types?"*. It would
  have confirmed the bug instead of finding it. The answer came from the panel's own source.
- 🔴 **A graph that validates can teach the opposite of its own title.** The first draft's breakpoint
  folded the columns at every width. Every gate passed. `render_report` at two viewports is what
  disagreed.
- ⚠️ **A new bundle is a "stowaway" until `git add`.** `rel-012/shipped-lessons-reach-the-artefact`
  fails on any untracked file under `project-examples/lessons`, and it is right to.
