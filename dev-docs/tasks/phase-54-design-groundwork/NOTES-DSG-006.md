# NOTES — DSG-006 §3, the design rubric

**Written:** 2026-08-11, in a session that did **not** own the checkout (a phase-50 LEG session was
live in four worktrees and in the primary tree). Everything here was produced without the editor,
without the dev stack, and without a paid drive.

Built: [`measurements/score-design.js`](measurements/score-design.js) — one row per criterion of
DSG-006 §3, scored off artefacts already on disk, reproducible the way `score-run.js` is.

---

## §1 — Why this was the task, and what was not done

The handover's §3 blocking gate (`test:ci` on the merged DSG tree) **was not run and could not be**.
A sibling session held the checkout: four `leg-*` worktrees with commits 5–30 minutes old, and 15
modified + 12 untracked LEG files in the primary tree. `test:ci` launches Electron and `dev:stop`
kills by checkout, so running either would have reaped the sibling's work.

**DSG-007's `ProjectIdentity.test.ts` is therefore still fixed-and-unproven, and F2 is still not
closed.** That is unchanged by this session; it stays the first thing to do in a session that owns
the checkout.

The rubric was chosen because the handover ranked it first among the checkout-free work, and because
it costs nothing: the replay projects are all still on disk under `NodeGX test projects/`.

## §2 — The instrument

Six criteria are render facts and come from `renderReport`; two are authoring facts and are read
straight off the component JSON. Rendering the graph facts would only prove the strings survived a
paint, which is not the question.

⚠️ `render:report` drives its **own headless Google Chrome**, not Electron. `dev-processes.js:56`'s
`DEV_TOOL` regex matches `webpack|lerna|electron/dist|nodegx-backend|start-electron-dev|scripts/start.ts|dev-debug.js`
— it does **not** match Chrome. That is why this was safe beside a live sibling, and it is the check
to repeat rather than assume.

There is deliberately **no total**. Phase 58's exit test hid its one failing criterion behind one
green summary; the whole reason §3 exists is that a single verdict is the wrong shape.

## §3 — The result: six replays, per criterion

| criterion | doctrine | src | haiku | qwen | sonnet | deepseek | kimi | ds-awp006 |
|---|---|---|---|---|---|---|---|---|
| type-hierarchy | `§3` | render | PASS | FAIL | PASS | FAIL | FAIL | PASS |
| one-accent | `§4` | render | — | — | — | — | — | — |
| rhythm | `§1`,`§8` | render | — | — | — | — | — | — |
| imagery-present | `§5` | render | FAIL | FAIL | PASS | FAIL | FAIL | PASS |
| narrow-survives | `§7`,`§11` | render | FAIL | PASS | PASS | PASS | PASS | PASS |
| grid-is-a-grid | `§8`,`§11` | render | PASS | FAIL | PASS | FAIL | FAIL | PASS |
| empty-state | `§9` | graph | FAIL | FAIL | FAIL | FAIL | FAIL | FAIL |
| real-copy | `§10` | graph | PASS | PASS | PASS | PASS | PASS | PASS |
| **scored** | | | **3/6** | **2/6** | **5/6** | **2/6** | **2/6** | **5/6** |

Distinct font weights, the sharpest single column: haiku `400,600,700`; qwen `400`; sonnet
`400,500,600,700`; **deepseek none at all**; kimi `400`; ds-awp006 `400,500,600,700`.

## §4 — What the numbers say

**The rubric reproduces Richard's verdict without being told it.** The judgement on record is
*"Sonnet is the only one that clears the bar"*; the two runs that score 5/6 are **sonnet** and
**ds-awp006** — and ds-awp006 is deepseek *with phase 58's scaffolding*, i.e. the same base model
that scores 2/6 cold. Every other run lands at 2/6 or 3/6. That is the calibration this instrument
needed, and it came free: the score informs the verdict and agrees with it.

It also means the rubric can now do the thing the judgement cannot — say whether a later change made
pages prettier or merely not worse.

## §5 — Register

| # | Finding | State |
|---|---|---|
| F36 | **Two of DSG-006 §3's own eight criteria cannot be measured.** The render report carries **no colour at all** and **no band geometry**, so `one accent` (`§4`) and `rhythm` (`§1`,`§8`) have no instrument behind them. The spec's table named measurements nothing produces | 🔴 open — §6 |
| F37 | **The mechanical rubric agrees with the human verdict.** sonnet 5/6 and ds-awp006 5/6 against 2/6–3/6 for every cold alternative, with no input from Richard's judgement | ✅ measured |
| F38 | **Doctrine `§5` (imagery) is not landing.** Four of six replays contain **zero `Image` nodes** — not broken URLs, none authored. Only sonnet (10) and ds-awp006 (8) have any | 🔴 open |
| F39 | **Doctrine `§9` (empty states) is landing nowhere.** 0/6 — and no project contains a gate node of *any* kind, so there is no branch for a list that is empty. Uniform failure, so the criterion currently discriminates nothing | 🔴 open |
| F40 | **`real-copy` passes 6/6 and therefore carries no signal yet.** Either `§10` is fully absorbed or the detector is too narrow to catch what these models actually write. Do not read the green row as evidence until one run fails it | 🟠 filed |

⚠️ F25 stays **open**: this closes six of its eight rows, not all eight. It is honest to say the
design half now has a per-criterion score with two named holes, not that it has one.

## §6 — The open question F36 leaves

`one accent` and `rhythm` need two facts nothing currently emits: background colours, and vertical
gaps between bands. Both are genuine render-time facts, so the architecturally right home is
`@nodegx/render-measure` (`measureExpression`) — which is also what would let them become a **gate**
later, in the DSG-004 shape.

The cost of putting them there is that the render report is on the MCP wire, so every consumer pays
for the fields. That is a real trade and it was **not** made in this session: the package is shared,
a sibling held the tree, and the choice belongs to a session that can measure the payload delta.

Until it is made, the two rows print `no-data` with the reason rather than being dropped — **a
criterion that is silently absent reads as a criterion that passed.**
