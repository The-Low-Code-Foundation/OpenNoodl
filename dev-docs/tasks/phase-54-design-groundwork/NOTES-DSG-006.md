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
| F41 | **`one accent` counts accents, not restraint.** haiku and sonnet both score `1 accent` in the same hue, at **603,740px²** and **14,474px²** respectively — a full-bleed wash and an accent on a control read as a tie | ✅ **closed** — scores viewport *share*; see §8 |
| F44 | **A `test:ci` run killed from outside reports no failures at all.** The merged-tree run died at spec 550 of 2632 with `GPU process exited unexpectedly: exit_code=15`, **zero `FAILED:` lines, no `Jasmine:` summary, `lerna success`, and exit code 0.** A void run and a clean run are near-indistinguishable at a glance, and the void one looks *better* | 🔴 open — §9 |
| F45 | **`node scripts/devtools/dev-processes.js --list` is a silent no-op.** That file is a **module with no CLI entry point**: it prints nothing and exits 0 whether the checkout is idle or running seventeen dev processes. The real instrument is `npm run dev:stop -- --list` | 🔴 open — §9 |
| F42 | **Rhythm expressed as padding is invisible to a gap measurement.** The first version measured only inter-band gaps and reported *"1 distinct gap: 0"* for a page with perfectly good rhythm — bands in this renderer abut and carry their spacing internally. It now counts gaps **and** band padding | ✅ caught before it shipped |
| F43 | **The token-coverage gate scans one of the four places a token name is written.** `tests/models/StyleTokenCoverage.test.ts` walks `ElementConfigRegistry` only, so `--border-control` in `design.ts` and in `docs/node-catalog/examples/*.json` was invisible to it — and `catalog:examples` passes 57/57 without checking token names at all | ✅ **closed** — `npm run catalog:tokens`, proved red then green; see §7 |

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

## §7 — The gate that would have caught it (F43) — built

`npm run catalog:tokens` → [`scripts/validate-token-references.ts`](../../../scripts/validate-token-references.ts).
There are **four** places a token name gets written and the coverage gate read one:

| Where a `var(--token)` can appear | Was guarded by | Now |
|---|---|---|
| `ElementConfigRegistry` defaults/sizes/variants | ✅ `tests/models/StyleTokenCoverage.test.ts` | unchanged |
| the doctrine, `AiAssistant/authoring/prompts/*.ts` | ❌ nothing | ✅ `catalog:tokens` |
| `docs/node-catalog/examples/*.json` (176 references) | ❌ nothing — `catalog:examples` is 57/57 green and never looks at a token name | ✅ `catalog:tokens` |
| a **preset key** no default token declares | ❌ nothing — dead weight that reads as a real token | ✅ `catalog:tokens` |

**186 references across 63 files, all resolving against 182 tokens.**

⚠️ **A script, not a spec, and that was the point.** Extending `StyleTokenCoverage.test.ts` would have
put the check in `tests/` — jasmine, `test:ci` only — which this session could not run and therefore
could not have proved red. Cf. DSG-007's `ProjectIdentity.test.ts`, still fixed-and-unproven for
exactly that reason. This one **was** proved: removing `--border-control` from `DefaultTokens` turns
it red on `ui-split-hero.json:175` *and* on all four orphan preset keys, and green again on restore.

## §8 — How F41 was closed

`§4`'s row now scores **how much of the page the accent covers**, not how many accents there are.
The measurement half went into `@nodegx/render-measure` for the same reason F36 did: it is the only
home from which this can later become a DSG-004-shaped gate. `colors.accents[]` gains a **`share`**
(fraction of the viewport) alongside `area`, and `colors.viewportArea` carries the denominator so a
score can be recomputed from a stored report without knowing which viewport produced it.

| replay | before | after | `one accent` |
|---|---|---|---|
| phase55-s6-haiku | 5/8 | **4/8** | **PASS → FAIL** — `1 accent, 52.4%` |
| phase55-s6-sonnet | 7/8 | 7/8 | PASS — `1 accent, 1.3%` |
| the other four | 2/8, 2/8, 2/8, 6/8 | unchanged | already FAIL at `0 accents` |

**It separates the only pair it could have.** haiku and sonnet paint the *same hue* at the *same
count*; the wash is now the only one that fails, and sonnet is left as the sole 7/8. The row moved in
the direction Richard's verdict already pointed, which is the check that matters — an instrument
whose first act is to agree with everything it is shown has not been tested.

⚠️ **The 25% ceiling is a doctrine call, and the corpus cannot defend it.** The only two runs with any
accent sit at **0.524** and **0.013**, so *every* threshold between about 2% and 52% splits them
identically. A quarter of the page is where a colour stops reading as an accent and starts reading as
the surface it is painted on — but that is a judgement, not a measurement, and `ACCENT_CEILING` in
[`score-design.js`](measurements/score-design.js) is the one line to move if Richard wants it
elsewhere. Nothing else changes with it.

⚠️ `share` postdates the six stored reports, so the criterion **falls back to the count** when a
report carries no `share` rather than silently passing a wash it cannot measure.

🔴 **A backtick in a comment inside `measureExpression` ends the string.** The whole measurement block
is one template literal, so ``  `share` `` in a comment terminated it and surfaced as
`SyntaxError: Unexpected identifier 'share'` from `new Function` in the *purity test*, hundreds of
lines from the cause. Purity is back at 5/5. There is now a warning to that effect at the edit site,
because nothing else in the file says so.

## §9 — What the gate cost, and the two instruments that lied

This session **owned the checkout for about twenty minutes** and spent it on the handover's §1.

✅ **Baseline, `cline-dev`: `Jasmine: 2632 specs, 6 failures (failed)`, seed 05169** — exactly the
recorded floor of 6, and the same six: two `AI model registry` and four `AIX-006 style vocabulary`.

❌ **The merged tree is still unproven.** `wt-trial54` was brought up to date (`cline-dev` +
`dsg-004` + `dsg-005` + `dsg-007`, a clean merge, `d137c69b`) and `test:ci` ran there — and was
**killed from outside at spec 550 of 2632**, six seconds before a sibling's `npm run dev:debug`
brought up seventeen dev processes in the primary checkout. `ProjectIdentity.test.ts` never
executed: **0 of its 9 specs appear in the log.**

🔴 **F44 — a killed run is shaped like a clean one.** It ended with **no `FAILED:` lines, no
`Jasmine:` summary line, `lerna success exec`, and exit code 0.** Every habit that says "check the
exit code" and every habit that says "count the failures" reports this run as *better* than the
baseline that honestly printed 6. The only tell is the **absence** of the `Jasmine:` line — so the
rule is not "read the Jasmine line instead of the exit code", it is **"a run with no `Jasmine:` line
did not happen at all"**, and absence has to be checked for explicitly.

🔴 **F45 — the instrument for "is the checkout quiet" was a no-op.**
`node scripts/devtools/dev-processes.js --list` prints nothing and exits 0 **always**: that file is a
`module.exports` with no CLI entry point, and `--list` is parsed by `stop-dev.js`. This session ran it
at the start, got silence, and read it as an idle checkout — which happened to be true, but only an
independent `ps` sweep actually established that. Run **`npm run dev:stop -- --list`** (note the `--`);
it kills nothing and printed all seventeen processes correctly.

⚠️ **The rule about `dev:stop` runs in both directions.** The register already says *"`dev:stop`
KILLS a sibling's `test:ci`"*. Here this session was the **victim** rather than the offender, and
nothing it could have done would have prevented it — which means a long `test:ci` on a shared
checkout is not something a session can protect, only detect. Detecting it is F44.

Two guards on the gate itself, both from things this repo has paid for:

- **under 50 references found is exit 2, not a pass** — a gate that finds nothing because it read
  nothing is the failure mode, not the success one;
- **prose placeholders are excluded by name**, not by heuristic. The doctrine teaches the *shape*
  `var(--token)`, which is five legitimate hits; listing them means a real token ever called
  `--token` would still have to be declared here deliberately.

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
