# Phase 50 — next session

**Written 2026-08-12**, at the end of a session that took **both outstanding measurements**, struck
the void exit criterion, and drove LEG-005 for the first time.

**7 of 7 built. 7 of 7 merged. Both measurements taken. The phase is decidable now — and one of its
five exit criteria is measured as FAILED, which is the whole point of this file.**

> ⚠️ This replaces the 2026-08-11 evening version, which said *"two measurements nobody has taken"*.
> Both have now been taken. Do not act on a stale copy.

---

## 1. What changed this session

| Thing | Result | Where |
|---|---|---|
| `test:ci` on the merged tree | **`Jasmine: 2672 specs, 6 failures`** — total *and* all six names identical to baseline | §5 |
| **LEG-005 drive**, all 8 steps of its §4 | ✅ **8/8 pass** | [`notes/leg-005-drive-results.md`](notes/leg-005-drive-results.md) |
| **LEG-001 re-measurement** | 🔴 **ZERO. 0 of 182 nodes** | [`measurements/LEG-001-COMMENT-REMEASUREMENT.md`](measurements/LEG-001-COMMENT-REMEASUREMENT.md) |
| Exit criterion 2 | **struck**, with the reason written into the README | README §Exit criteria |
| The four merged lane worktrees | removed; branches kept | — |

Commits: `b0ad50ed` (LEG-005 drive + the scanner), `36821c0e` (the measurement).

---

## 2. 🔴 The finding that decides the phase

**LEG-001's argument is refuted as stated, and the phase must not claim otherwise.**

The task reasoned: *an optional field with one clear sentence of description got 89.3–100% for
`label`; this task is that sentence, written for `comment`.* The sentence shipped verbatim, reached
the model, and produced **nothing**.

| | this run |
|---|---:|
| nodes authored | 182 |
| **carrying `metadata.comment`** | **0** |
| carrying `label` | **103 (56.6%)** |
| write/stage calls carrying the field | 0 of 24 |
| assistant turns that mention "comment" | **0 of 39** |

**The control is inside the run** — same model, same brief, same node schema, two *optional* declared
fields. Nothing differs between `label` and `comment` but the field itself.

It is a **real** zero, not a broken rig; three things were verified before spending, and each would
have faked it. See §3. **"Judge the comments, do not count them" is vacuous when there are none**, so
the criterion is recorded as **not met** rather than quietly satisfied.

### The next move, and it is cheap

🔴 **LEG-001 shipped half of itself.** §5 of the task specifies a doctrine half — a sentence or two in
`AUTHORING_TRAPS` and `dev-docs/best-practices/` on *when* a comment is worth writing, matched to
§4's three cases. **It is not there.** The task's own ordering rule was *structure > gate >
documentation*, with doctrine following the vocabulary row rather than replacing it. The structural
half is in and measures zero; **the documentation half has never been tried.**

**Do that before buying another n=1 at $3.62.**

⚠️ And hold a second reading, which would change the fixture rather than the code: `label` names what
is in front of you, a comment needs a constraint the brief never stated. The storefront brief
contains almost no external rules, so a model with nothing to say may be *right* to say nothing — in
which case this fixture cannot measure the field at all, and the brief needs décret-style constraints
in it.

---

## 3. ⚠️ Read this before any future paid run

🔴 **`noodl-mcp` serves `dist/noodl-mcp.cjs`, not `src/` — and `dist` is gitignored.**

The bundle on disk was built before LEG-001 merged. A freshly started server advertised
`create_component`'s node fields as `id, type, label, x, y, parent, children, parameters, variant,
ports` — **no `comment`**. `node packages/noodl-mcp/build.mjs` (117 ms) fixed it.

**Had the measurement run half an hour earlier it would have returned zero for a plumbing reason, and
the phase's flagship claim would have been recorded as refuted by its own evidence.** Rebuild, then
probe `tools/list` over stdio, before spending money on anything that depends on a vocabulary change.

⚠️ `update_component` and `stage_plan_operation` nest nodes under `set`/`operations`, so a probe that
walks `properties.nodes.items.properties` finds nothing and reads like a second failure. Search the
stringified schema instead.

⚠️ `create_project` is **disabled on a bound server** — start with no project directory to reach
bootstrap mode (5 tools). Its argument is `directory`, not `path`.

---

## 4. LEG-005 — driven, and both of its own doubts refuted

The lane shipped it honestly saying *"nothing was ever painted"*. It has now been painted against a
copy of a real project (71 nodes), and **all eight steps pass**. Full detail and the two measurement
traps are in [`notes/leg-005-drive-results.md`](notes/leg-005-drive-results.md).

The two things the lane itself called most likely to be wrong were **both refuted**:

1. **The hidden-mirror height.** `height: 48` **=** `sizerHeight: 48` at a 324px panel — the wrapped
   placeholder is not clipped, confirmed by measurement and by eye.
2. **Blur racing the panel remount.** A real click onto a *different node* commits to the node the
   text was typed for, with **nothing** leaking onto the node clicked.

**The contrast table was arithmetic on token hexes, and all eight predictions are now confirmed by
sampling the live elements** — 5.98 / 7.70 / 5.57 / 3.93 dark, 5.34 / 7.10 / 5.06 / 3.62 light, every
`fg` and `bg` hex printed. The stripe binding works: 246 stripe pixels appear with **no** paint call,
and one undo returns the canvas to baseline at a **0-pixel** difference.

🔴 **One trap cost real time and will cost yours.** `el.focus()`/`el.blur()` from `cdp eval` dispatch
**no** focus events at all when the Electron window lacks OS focus — `activeElement` moves, React's
`onBlur` never runs, and a commit test reads as a false failure. **Check `document.hasFocus()`**; a
real `cdp click` gives the window focus and commits properly.

---

## 5. Gates, measured on the merged tree

| Gate | Number |
|---|---|
| `test:ci` | **`Jasmine: 2672 specs, 6 failures`** — 4× `AIX-006 style vocabulary`, 2× `AI model registry`, all inherited **by name** |
| `typecheck:editor` / `-tests` | clean |
| editor `npx jest tests-unit` | 1641 / 1641 (run from `packages/noodl-editor`, never the repo root) |
| `noodl-mcp` `npx jest` | 418 / 419 — the one failure is **DEBT-009** by name, pre-existing |

⚠️ **Only the `Jasmine:` line counts, and compare the spec total as well as the failure count.** A
sibling session was committing to this checkout throughout; re-measure rather than inherit this table.

---

## 6. Still open, and untouched by this session

The three debts filed in the previous handover are **still filed and still not fixed**, all verified
in source:

1. 🔴 **`NodeLabel.tsx:104` calls `model.off(this)` in a function component**, where `this` is
   `undefined` — `shared/model.js:84` then removes **every** listener registered without a group, on
   every unmount. One line to fix; needs a thought about what it has been silently unbinding.
2. ⚠️ **core-ui `TextArea`'s dark `::placeholder` is `#2c3540` — 1.36:1.** A defect in a shared
   component; it is why LEG-005 used a native `<textarea>`.
3. ⚠️ **`SELF_NAMING_TYPES` is transcribed by grep, not derived** — `usePortAsLabel` reaches 0 of 175
   catalog entries, so nothing gates the list.

Also open: **regenerating `agent-chat`** — worth doing because the repo's flagship AI-authoring demo
having 0 labels and 0 comments is embarrassing, but frame it as **fixing a stale fixture, never as
evidence** for this phase. It was hand-built during AIX-005 before the vocabulary existed.

---

## 7. So is the phase closeable?

**Four of five exit criteria are met or struck. Criterion 2 is measured and failed**, and criterion 1
("a human who did not watch it being built can say what each node does") has never been put to a
human — it is a judgement, and it is Richard's.

The honest position: **the phase built everything it specified, and the central claim it was built on
did not survive contact with a model.** That is a result worth having, and it is cheaper to have
learned it for $3.62 than to have shipped the doctrine, the gate and the tooling on top of an
assumption. **Closing it means deciding whether the doctrine half (§2) gets tried first, or whether
the phase closes with the finding recorded and LEG-001 reopened as its own task.** That call is
Richard's, not the next session's.
