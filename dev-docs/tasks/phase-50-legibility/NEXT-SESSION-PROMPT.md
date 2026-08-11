# Phase 50 — next session

**Written 2026-08-11**, at the end of a session that built the **three remaining LEG tasks in three
parallel worktrees**, cleared the blocker they were waiting on, and merged all of it to `cline-dev`.

**7 of 7 are built. 7 of 7 are merged. The phase is NOT closed.**

What is left is not a task. It is **two measurements nobody has taken** and **one exit criterion that
has to be struck rather than met**. Everything below is either a number you can go and get, or a
decision that belongs to Richard.

> ⚠️ This file replaces the 2026-08-11 morning version, which said *"4 of 7 built, 0 merged"*. That
> is now history. Do not act on it if you find a stale copy.

---

## 1. Where the phase actually stands

| Task | State | The thing that is still missing |
|---|---|---|
| LEG-003 | ✅ merged `e0732dd1` | — |
| LEG-004 | ✅ merged `e0732dd1` | — |
| LEG-006 | ✅ merged `e0732dd1` + `3ba3e40a` | — |
| LEG-007 | ✅ merged `e0732dd1` | — |
| **LEG-001** | ✅ merged `599ecd49` | 🔴 **the live-model re-measurement** — §3 |
| **LEG-005** | ✅ merged `3c1aea66` | 🔴 **nothing was ever painted** — §2 |
| **LEG-002** | ✅ merged `c9ced40f` | the ProblemsPanel row has never been seen on screen |

Plus the blocker, which was not a task and had to land first:

**`fc36d61a` — `fix(models): the metadata bag a clone shared with its original`.** `toJSON` deep-copied
every field *except* `metadata`, which it handed out by reference, so `NodeGraphNodeSet.clone()`
produced a node sharing its source's bag. The same reference let `toJSON` mutate the node it was
merely serialising. Two further seams in the family: `ComponentModel` aliased in both directions, and
`ProjectModel.duplicateComponent` built the copy from `name`/`graph`/`id` only — **so a duplicated
component was dropping the `description` LEG-006 had shipped four commits earlier.**

LEG-007 had pinned the node-level defect with a deliberate `toBe` and written down how the assertion
should flip when the fix landed. It flipped exactly as specified.

### The lane branches and worktrees

`leg-lane` (LEG-001), `leg-005-lane`, `leg-002-lane`, and `wt-trial-leg50` (the throwaway trial merge),
all under **`/Users/richardosborne/vscode_projects/OpenNoodl-worktrees/`** — a sibling of the repo, not
a session scratchpad, so they will still be there. All merged; **safe to remove** with
`git worktree remove`. Built with `scripts/devtools/make-worktree.sh`, which verified `require.resolve`
lands inside each worktree before exiting.

**Zero shared files across the three lanes** — verified with `comm -12` on all three pairs before
merging, and all three merges were conflict-free. That was not luck; it was the split.

---

## 2. 🔴 First job: drive LEG-005. Nothing has ever been painted

This is the largest unverified surface in the phase, and the lane that built it says so itself.

**The hand-off is written and it is good.**
[`notes/leg-005-lane-notes.md`](notes/leg-005-lane-notes.md) **§4** is an eight-step drive written for
someone who has not seen the diff: the exact eval snippets (native-setter writes on
`HTMLTextAreaElement.prototype`, `window.__nodeGraphEditor` / `findNodeWithId` / `selectNode` /
`layoutAndPaint`), plain global selectors (`.property-comment-bar|label|sizer|input`), and the model
reads that are the witness for every commit. **Follow it. Do not re-derive it.**

The eight steps, and what each is really testing:

| § | Step | Why it can fail |
|---|---|---|
| 4.1 | Row renders for a node with **no** comment | The entire point of the task. A conditional row is the context menu again |
| 4.2 | Type → commit → read the **model** back | `el.value = x` does not drive React; use the native setter |
| 4.3 | Stripe repaints **without a reselect** | Moved from a hand-written `owner.repaint()` to a `commentChanged` model binding |
| 4.4 | One undo removes it | Goes through `setComment(…, { undo: true })`. `push()` then `do()` runs **nothing** — `pushAndDo` |
| 4.5 | Clearing matches the popup exactly | Two ways to clear that behave differently is worse than one way |
| 4.6 | Save, close, reopen | The round trip a human uses to notice it is gone |
| 4.7 | **Contrast, both themes, hexes printed** | See below |
| 4.8 | The one thing to eyeball, not measure | Height of the wrapped placeholder at a real panel width |

### ⚠️ 4.7 is the one to be most careful with

The lane's contrast table is **arithmetic on `colors.css` token hexes, not samples**, and it says so.
This repo has a long record of a computed ratio being wrong about the element it claimed to be about.
**Sample the real elements, print `fg` and `bg` hex with every ratio**, and confirm or refute:

| Pair | Predicted dark | Predicted light |
|---|---|---|
| Label `fg-default-shy` on `bg-1` | `#8b95a1`/`#12161b` = 5.98:1 | `#616c79`/`#ffffff` = 5.34:1 |
| Comment text `fg-default` on `bg-2` | `#a6b0bb`/`#181d24` = 7.70:1 | `#4a5663`/`#f7f9fb` = 7.10:1 |
| Placeholder `fg-default-shy` on `bg-2` | `#8b95a1`/`#181d24` = 5.57:1 | `#616c79`/`#f7f9fb` = 5.06:1 |

The lane's own **"most likely thing to be wrong"** is 4.8: the hidden-mirror height mechanism yielding
a box tall enough for the wrapped placeholder at a real panel width. Second most likely: blur-commit
racing the panel remount when you click a different node while focused.

**⚠️ Serialisation.** The editor cannot be driven while `test:ci` owns Electron, and a `dev:debug`
launch reaps a running suite (and vice versa). A sibling session was live in this checkout all evening.
Poll for a **sustained** quiet window — `npm run dev:stop -- --list` is the only spelling that lists
rather than kills, and it matches a running `test:ci` Electron too.

---

## 3. 🔴 Second job: LEG-001's re-measurement — and it costs money

This is **the flagship's acceptance criterion**, and it is the only way to learn whether the phase's
central claim was right.

The claim: `label` is in the authoring vocabulary with one clear sentence of description and got
**1,003 of 1,123 agent-authored nodes (89.3%)**. `metadata.comment` was not in the vocabulary and got
**1 in 2,045**. LEG-001 closed that arm — the field now exists, with this sentence, in both doors:

```
Why this node is the way it is — a constraint, a rule, or a decision with an alternative. Omit when the type and label already say it.
```

**What to run:** re-author one phase-55 fixture with the field declared. The comparable baseline is
**1 in 2,045**; anything above zero is new information and the number goes in the register whichever
way it falls.

⚠️ **Judge the comments, do not count them.** A run producing 100% coverage of *"This is a Group"* has
**failed** this task while passing a coverage check. Read twenty and say so in the register. Expect the
cheap-model split to reappear (haiku 1/94, qwen 3/19).

🔴 **A real Anthropic provider is configured in this editor — a drive costs money. Ask Richard before
spending it.**

---

## 4. The exit criterion that has to be struck, not met

README exit criterion 2 says `agent-chat` is regenerated and its label coverage goes above 90%, *"the
same fixture that currently reads 0 of 262, so the number is comparable."*

**It is not comparable and the criterion is void.** `project-examples/agent-chat` was built **by hand**
during AIX-005 on 2026-07-27 (`b95eddb4`), before the authoring vocabulary existed. It is not a sample
of agent output. Regenerating it with a current model would measure nothing this phase did —
`phase55-replay-sonnet` already reads 196/196 with no LEG task shipped, and eight of twelve model runs
are at 100%.

[`notes/leg-002-lane-notes.md`](notes/leg-002-lane-notes.md) **§4** states this in strike-ready form
with the measured substitute. **Strike the criterion, replace it with §3's comment measurement, and say
in the README why** — a phase that quietly drops an exit criterion is indistinguishable from one that
failed it.

Regenerating `agent-chat` anyway is still worth doing, on its own terms: the repo's flagship
AI-authoring demonstration having 0 labels and 0 comments is embarrassing. **Frame it as fixing a stale
fixture, never as evidence.**

---

## 5. What LEG-002 measured, because it changed the task

The spec told the lane to pin *non-trivial* against the corpus **before** freezing it, and the
measurement **rejected the spec's own candidate definition**. `scripts/legibility/scan-labels.js` is
committed and re-runnable; it reproduces §2's table exactly, so it measures the same thing.

| Candidate | repo | `library/` | model runs |
|---|---:|---:|---:|
| every unlabelled node | 4,426 | 1,062 | 120 |
| **§3's own candidate** | 2,232 | **502 (37.7%)** | 92 |
| fan-out only | 567 | 205 | **0** ⚠️ blind to the population the phase is about |
| **THIS RULE** | **214** | **25 (1.9%)** | **9** |

What ships: *three or more **unlabelled** same-type siblings under one parent, each a junction.*

The property that decided it: **zero hits on all ten model runs that already label**, 6 on
`phase55-replay-haiku` (1% labelled), 3 on `qwen35-27b` (16%). 53 of 58 shipped prefabs untouched.
71 of the repo's 214 are `agent-chat` — found without being told to look there.

Two corrections to §2's own table, both harmless: `library/` is **58** files not 34 (node total
identical), and the model-run corpus is **twelve** dirs, 1,126 nodes (§2's eleven = this minus one
3-node stub).

`validate:project` went **5 errors / 147 warnings** before and after, run not reasoned; the 223 new hits
land entirely in `infos`. The tripwire asserting `isBlockingForAuthoredOutput` is false was **proved
red** by temporarily adding the code to `AUTHORED_BLOCKING_WARNINGS` (2 failed / 18 passed), then
reverted.

---

## 6. Three debts found on the way, filed and not fixed

None is phase 50's, all are real, and each was verified in source rather than inferred.

1. 🔴 **`NodeLabel.tsx:104` calls `model.off(this)` inside a function component**, where `this` is
   `undefined` in a strict-mode module. `shared/model.js:84` splices every listener whose
   `group === group`, so **`off(undefined)` removes every listener registered without a group** from
   that node's model — on every unmount, which is every time you select a different node. LEG-005's row
   sidesteps it with a `useRef({})` group rather than copying the pattern. **One line to fix; needs a
   thought about what it has been silently unbinding.**
2. ⚠️ **core-ui `TextArea`'s placeholder is unusable in dark.** `::placeholder` resolves to
   `--base-color-grey-600` = `#2c3540` — **1.36:1**. That is why LEG-005 used a native `<textarea>`
   with global CSS: overriding it from outside meant `UNSAFE_className` on the same element, a
   specificity tie decided by stylesheet order. **A defect in a shared component, not a LEG-005
   problem.**
3. ⚠️ **`SELF_NAMING_TYPES` is transcribed by grep, not derived.** `usePortAsLabel` reaches **0 of 175**
   catalog entries, so the rule cannot ask `CatalogIndex` for it and nothing gates the list. Worth 16
   corpus hits today; a new type carrying `usePortAsLabel` will be misreported until someone re-greps.
   Regenerate with the command in the constant's doc comment.

Also worth knowing: **17 of `library/`'s 25 hits are `library/modules/avatar`**, a demo gallery, and
arguably legitimate. Kept, because the rule cannot tell a demo from a page and at info severity being
wrong costs one grey line.

---

## 7. Gates, with the numbers to compare against

Measured this session on the merged tree. **Do not inherit a green board** — re-run after any sibling
commits over the tree.

| Gate | Number | Note |
|---|---|---|
| `typecheck:editor` | clean | |
| `typecheck:editor-tests` | clean | |
| editor `npx jest tests-unit` | **1641 / 1641**, 112 suites | run from `packages/noodl-editor`, **never the repo root** — the root picks up the wrong babel config and reports every suite as failing to run |
| `noodl-mcp` `npx jest` | **418 passed / 419** | the one failure is **DEBT-009** by name (`tools.test.ts`, 30,365 > 30,000 chars), pre-existing and unmoved |
| `validate:project` | 5 errors / 147 warnings | unchanged by LEG-002 |
| `test:ci` | **see §7.1** | |

### 7.1 The Jasmine number

Baseline before this session's work, measured on `fc36d61a`:
**`Jasmine: 2672 specs, 6 failures`** — 2,670 + the blocker's two new specs. All six inherited **by
name**: four `AIX-006 style vocabulary` (the known F32 fixture defect), two `AI model registry`.

⚠️ **Only the `Jasmine:` line counts.** The exit code lies, and a run that dies without a `Jasmine:`
line graded nothing — re-run it, do not read exit=1 as failures. **Compare the total spec count too, not
just the failure count**: a gitignored build artifact can make a whole block of specs vanish behind a
number that still looks like a pass.

⚠️ **A run on the merged tree was in flight when this file was written.** Its log is at
`tasks/bbogetkqw.output` in this session's scratchpad, which will be swept — **just re-run it** and
compare against 6 failures by name, with the spec total risen by the three lanes' additions.

---

## 8. Decisions already taken. Do not re-litigate them

- **The AWP-006 tool-surface budget is 8,200, not 8,000 — Richard decided this on 2026-08-11**, with
  the measurement in front of him. Base was **7,963**, independently re-measured, i.e. 37 tokens of
  headroom, so *any* new authored field broke that gate. One declared node field costs ~45 tokens per
  rendering and the node schema is inlined **three** times. The table is in the constant's doc comment
  in `toolDisclosure.test.ts`. **If the next field to arrive needs room, the honest fix is a `$ref`ed
  node schema, not a shorter sentence in front of a model.**
- **LEG-002 ships advisory in both directions**, not blocking for authored output. The spec inverts its
  own phase README deliberately and the corpus backs it. Do not "fix" it back.
- **The comment field description and LEG-005's placeholder are one voice on purpose.** They were fixed
  before the lanes launched precisely so two agents could not diverge on them, and neither lane
  objected. Changing one means changing both.
- **`update_node.set.comment` was added beyond LEG-001's spec** — a field zod does not name is a field
  zod *strips*, which is how a hero vanished in phase 58. Costs 45 of the 179 tokens. Reversible in two
  lines if you disagree.

---

## 9. The shape of the session that produced this, in case it is worth repeating

Three lanes, near-disjoint by construction, with the two things that do **not** parallelise pulled out
and done by the orchestrator:

1. **The blocker went first, alone, in its own commit** — because two of the three tasks made its
   defect user-visible for the first time.
2. **Shared copy was authored once, up front, and handed to both lanes verbatim** with instructions to
   report rather than silently edit. Two surfaces describing one field differently is a documentation
   bug no parity spec can catch, because one of the two is UI copy.
3. **Live verification was never delegated**, because `lerna exec` resolves the package root to the
   primary checkout — a drive from a worktree exercises code that is not the branch's and reports a
   result unrelated to the diff.

All three lanes were told to report **deviations with reasoning** and an explicit **"could not verify"**
list. That is where every finding in §6 came from, and where LEG-005's honest *"nothing was ever
painted"* came from. **Ask for it by name.**
