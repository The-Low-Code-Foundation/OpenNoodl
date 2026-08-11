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
| one-accent | `§4` | render | PASS | FAIL | PASS | FAIL | FAIL | FAIL |
| rhythm | `§1`,`§8` | render | PASS | FAIL | PASS | FAIL | FAIL | PASS |
| imagery-present | `§5` | render | FAIL | FAIL | PASS | FAIL | FAIL | PASS |
| narrow-survives | `§7`,`§11` | render | FAIL | PASS | PASS | PASS | PASS | PASS |
| grid-is-a-grid | `§8`,`§11` | render | PASS | FAIL | PASS | FAIL | FAIL | PASS |
| empty-state | `§9` | graph | FAIL | FAIL | FAIL | FAIL | FAIL | FAIL |
| real-copy | `§10` | graph | PASS | PASS | PASS | PASS | PASS | PASS |
| **scored** | | | **5/8** | **2/8** | **7/8** | **2/8** | **2/8** | **6/8** |

Distinct font weights, the sharpest single column: haiku `400,600,700`; qwen `400`; sonnet
`400,500,600,700`; **deepseek none at all**; kimi `400`; ds-awp006 `400,500,600,700`.

Rhythm, the second sharpest: sonnet `32/40/64/80px` over 6 bands and ds-awp006 `16/40/64/80px` over
6 — both a real 8px scale. qwen, deepseek and kimi each produced **one band and no spacing at all**,
which is the same fact their other five failures are describing from different angles.

## §4 — What the numbers say

**The rubric reproduces Richard's verdict without being told it.** The judgement on record is
*"Sonnet is the only one that clears the bar"*; **sonnet tops the table at 7/8**, with ds-awp006 at
6/8 — and ds-awp006 is deepseek *with phase 58's scaffolding*, i.e. the same base model that scores
**2/8** cold. qwen, deepseek and kimi all land at 2/8. That is the calibration this instrument
needed, and it came free: the score informs the verdict and agrees with it.

⚠️ **One accent counts colours, not restraint.** haiku and sonnet both score `1 accent` and the same
hue (`rgb(59,130,246)`), but haiku spends **603,740px²** on it against sonnet's **14,474px²** — a
full-bleed wash versus an accent on a control. The row is faithful to `§4` as written; it is not a
measure of taste, and a 40× area difference should not read as a tie. Filed as F41.

It also means the rubric can now do the thing the judgement cannot — say whether a later change made
pages prettier or merely not worse.

## §5 — Register

| # | Finding | State |
|---|---|---|
| F36 | **Two of DSG-006 §3's own eight criteria could not be measured.** The render report carried **no colour at all** and **no band geometry**, so `one accent` (`§4`) and `rhythm` (`§1`,`§8`) had no instrument behind them | ✅ **closed** — `@nodegx/render-measure` now emits `colors` and `rhythm`; see §6 |
| F37 | **The mechanical rubric agrees with the human verdict.** sonnet 5/6 and ds-awp006 5/6 against 2/6–3/6 for every cold alternative, with no input from Richard's judgement | ✅ measured |
| F38 | **Doctrine `§5` (imagery) is not landing.** Four of six replays contain **zero `Image` nodes** — not broken URLs, none authored. Only sonnet (10) and ds-awp006 (8) have any | 🔴 open |
| F39 | **Doctrine `§9` (empty states) is landing nowhere.** 0/6 — and no project contains a gate node of *any* kind, so there is no branch for a list that is empty. Uniform failure, so the criterion currently discriminates nothing | 🔴 open |
| F40 | **`real-copy` passes 6/6 and therefore carries no signal yet.** Either `§10` is fully absorbed or the detector is too narrow to catch what these models actually write. Do not read the green row as evidence until one run fails it | 🟠 filed |
| F41 | **`one accent` counts accents, not restraint.** haiku and sonnet both score `1 accent` in the same hue, at **603,740px²** and **14,474px²** respectively — a full-bleed wash and an accent on a control read as a tie | 🟠 filed |
| F42 | **Rhythm expressed as padding is invisible to a gap measurement.** The first version measured only inter-band gaps and reported *"1 distinct gap: 0"* for a page with perfectly good rhythm — bands in this renderer abut and carry their spacing internally. It now counts gaps **and** band padding | ✅ caught before it shipped |
| F43 | **The token-coverage gate scans one of the three places a token name is written.** `tests/models/StyleTokenCoverage.test.ts` walks `ElementConfigRegistry` only, so `--border-control` in `design.ts` and in `docs/node-catalog/examples/*.json` was invisible to it — and `catalog:examples` passes 57/57 without checking token names at all | 🔴 open |

⚠️ F25 stays **open**: this closes six of its eight rows, not all eight. It is honest to say the
design half now has a per-criterion score with two named holes, not that it has one.

## §6 — How F36 was closed

Richard's call was to put the two measurements in `@nodegx/render-measure` rather than duplicate a
CDP pass in the rubric, because that is the only home from which they can later become a
DSG-004-shaped **gate**. `measureExpression` now emits two blocks:

- **`colors`** — `distinctAccents`, the top accents by *area*, and a neutral count. Neutral is
  decided by **chroma** (max minus min channel), not by matching a palette, so it holds for any
  token set and for a project that never adopted one.
- **`rhythm`** — `bands`, `distinctSpacings`, and the spacing histogram.

⚠️ **F42, and it nearly shipped as a green row.** The first `rhythm` measured only inter-band gaps
and returned *"1 distinct gap: 0"* for sonnet — a page with obviously good rhythm. In this renderer
bands abut and carry their spacing as **internal padding**, so gaps alone measure nothing. It now
counts gaps and band padding together, and the same page reads `32/40/64/80px`. The instrument was
wrong in the direction that produces a plausible number, which is the direction that does not get
noticed.

The package's purity property still holds — `tests/purity.test.js` 5/5, no `require`, no Node global.

**Cost, since this is on the MCP wire** — measured on the sonnet replay, not estimated: `colors` 97B
and `rhythm` 125B per viewport, so **444B added to a 7,578B report, 5.9%**. Both blocks are capped
(six accents, twelve spacings), so that is close to the worst case rather than a floor. ⚠️ MCP
responses go out **pretty-printed**, so the wire cost is roughly double the figures above.

## §7 — The gate that still does not exist (F43)

`--border-control` was defined this session (below), but nothing would have caught its absence. There
are three places a token name gets written and the coverage gate reads one:

| Where a `var(--token)` can appear | Guarded by |
|---|---|
| `ElementConfigRegistry` defaults/sizes/variants | ✅ `tests/models/StyleTokenCoverage.test.ts` |
| the doctrine prose, `AiAssistant/authoring/prompts/design.ts` | ❌ nothing |
| `docs/node-catalog/examples/*.json` | ❌ nothing — `catalog:examples` is 57/57 green and never looks at token names |

That is the same "nothing validates parameter values" gap the phase-38 register carries, and it is
the DSG-004-shaped work the handover ranked third. It needs no editor. **Extending the existing
coverage spec would not be enough** — it is jasmine, in `tests/`, so only `test:ci` runs it and this
session could not have proved it red. A `scripts/` gate can be proved red on the spot.

## §8 — `--border-control`, defined (handover §4.2, renumbered F35)

The handover's premise needed one correction: the AI-facing `--border-control` existed nowhere, but
the editor's own chrome **already defined `--theme-color-border-control: #7c8894`**
(`colors.css:407`/`556`), used for `PrimaryButton`'s control ring. The concept and its value already
existed; only the AI-facing token was missing. Richard's call was to define it, seeded from that
value rather than invented.

Added to `DefaultTokens.ts` and to all four presets, each in its own hue family, **measured against
that preset's own surface** rather than assumed:

| token set | `--border-control` | vs `--background` | vs `--surface` |
|---|---|---|---|
| DefaultTokens | `#7c8894` | 3.62:1 | 3.46:1 |
| Minimal | `#71717a` | 4.83:1 | 4.63:1 |
| Playful | `#a855f7` | 3.96:1 | 3.69:1 |
| Enterprise | `#64748b` | 4.76:1 | 4.55:1 |
| Soft | `#6b7280` | 4.79:1 | 4.63:1 |

All clear the doctrine's 3:1. For contrast, the tokens that already existed do not and were never
meant to: `--border` 1.18:1, `--border-subtle` 1.05:1, `--border-strong` 1.42:1 against `--surface`.
