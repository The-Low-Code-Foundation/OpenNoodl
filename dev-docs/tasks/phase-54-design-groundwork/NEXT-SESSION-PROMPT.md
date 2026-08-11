# Phase 54 — the next session

**Written:** 2026-08-11, by a session that **owned the checkout for about twenty minutes** and spent
it on the blocking gate — then lost the suite to a sibling that brought up a dev stack mid-run.

**This replaces the previous prompt.** Its §6 and §7 (the three unmerged DSG branches, the parallel
recipe) still hold and are not repeated. What changed: the gate was finally attempted, the baseline
is now measured, the trial merge is current, and **two of the instruments this project trusts were
found to be lying.**

---

## §0 — Read this first, it will save you the mistake this session made

🔴 **`npm run dev:stop --list` does not list. It kills.** npm swallows `--list` as its own config
flag and forwards nothing, so `stop-dev.js` runs its killing path with an empty argv. Proved with a
throwaway script: `npm run show --list` → `argv: []`, `npm run show -- --list` → `argv: ["--list"]`.

🔴 **`node scripts/devtools/dev-processes.js --list` is a silent no-op** — that file is a
`module.exports` with no CLI entry point. It prints nothing and exits 0 whether the checkout is idle
or running seventeen dev processes. **This session opened by running it, got silence, and read it as
an idle checkout.** That happened to be true, but only the independent `ps` sweep established it.

✅ **The one correct form is `npm run dev:stop -- --list`** (bare `--`). It printed all 17 processes
of the sibling's stack and killed none.

## §1 — The gate: half done, and the half that is done is worth having

✅ **Baseline, `cline-dev`: `Jasmine: 2632 specs, 6 failures (failed)`, seed 05169.** Exactly the
recorded floor, and the same six — two `AI model registry`, four `AIX-006 style vocabulary`. This is
now measured rather than inherited, which is what the register kept asking for.

✅ **The trial merge is current.** `wt-trial54` = `cline-dev` + `dsg-004` + `dsg-005` + `dsg-007`,
merged clean at **`d137c69b`**, in an existing worktree that already has `node_modules`:

```
/private/tmp/claude-501/-Users-richardosborne-vscode-projects-OpenNoodl/f5b771e5-.../scratchpad/wt-trial54
```

⚠️ It will be behind again by the time you read this — re-merge `cline-dev` first. Use the worktree
rather than a checkout: the primary tree has a sibling's 20+ uncommitted files in it, permanently.

❌ **F30 is STILL fixed-and-unproven, three sessions running.** `test:ci` in the merged worktree was
**killed at spec 550 of 2632**, six seconds before a sibling's `npm run dev:debug` brought up 17
processes. `ProjectIdentity.test.ts` never executed — **0 of its 9 specs appear in the log.**

**So the remaining job is one clean `test:ci` run in `wt-trial54`, and nothing else.** Everything
that used to stand in front of it — the merge, the baseline to compare against, the barrel check
(`tests/index.ts:27` → `models` → `ProjectIdentity.test`, confirmed present) — is done.

🔴 **F44 — a killed run is shaped like a clean one, and reads as *better*.** The void run ended with
**no `FAILED:` lines, no `Jasmine:` line, `lerna success exec`, and exit code 0.** Checking the exit
code says green; counting failures says zero. The only tell is an **absence**. The rule is not "read
the `Jasmine:` line instead of the exit code" — it is **"a run with no `Jasmine:` line did not
happen"**, and you have to go looking for the absence on purpose.

⚠️ This session was the **victim** of the `dev:stop` rule, not the offender, and could have done
nothing to prevent it. A 15-minute `test:ci` on a shared checkout cannot be protected, only detected.

## §2 — What is available without the editor, ranked

`render:report` drives **its own headless Chrome** and `dev-processes.js:56`'s `DEV_TOOL` regex does
not match it. Re-confirmed this session: four scoring runs completed normally beside the sibling's
live stack. It is the one visual instrument that is legal beside a sibling.

1. **DSG-003's five remaining recipes** ⭐ **still the best available task, and still not started.**
   Three of the eight shipped the defect they were teaching against (F23) because they were written
   from an *unmeasured* DOM. `score-design.js` now scores eight criteria including a working
   `one accent`, so the loop is: write, render, score, compare.
2. **F39 — doctrine `§9` lands nowhere.** 0/6 replays build an empty-state branch and **no replay
   contains a gate node of any kind**. Either the doctrine never says how, or the vocabulary cannot
   express it. Find out which before writing prose — DSG-004 refuted a whole gate premise that way.
3. **F38 — doctrine `§5` lands for two of six.** Four replays contain zero `Image` nodes.
4. **F40 — `real-copy` passes 6/6, so it discriminates nothing.** Widen the detector or prove `§10`
   is genuinely absorbed. Do not read the green row as evidence until one run fails it.

## §3 — What needs Richard, not a session

- **F33** — a copied project directory inherits its parent's id. Refuse-and-explain is plausibly
  correct; re-minting may be wrong, because "duplicate this project, same data" is legitimate.
- **The 25% accent ceiling (new).** F41 now fails an accent that covers more than a quarter of the
  viewport. **The corpus cannot defend that number** — the only two runs with any accent sit at
  0.524 and 0.013, so every threshold between ~2% and ~52% splits them identically. `ACCENT_CEILING`
  in `measurements/score-design.js` is the one line to move.
- **The §5 migration of the seven stranded projects** stays unexecuted; both preconditions still
  stand (a build carrying F30, and one actual jasmine run).

## §4 — Register, settled

**F1–F29** in the task files, **F30–F34** on the unmerged branches, **F35** = `--border-control`,
**F36–F45** in [NOTES-DSG-006.md](NOTES-DSG-006.md).

Closed this session: **F41**. Filed this session: **F44**, **F45**.
Open: **F38, F39, F40, F44, F45**, and **F2** (still needs that one `test:ci`), F26, F33.

## §5 — F41, since it changed a published table

`one accent` scored a *count*; it now scores **share of the viewport**. `@nodegx/render-measure`
emits `share` per accent plus `colors.viewportArea` as the denominator, so a stored report can be
re-scored later. haiku **5/8 → 4/8** on `1 accent, 52.4%`; sonnet unchanged at **7/8** on
`1 accent, 1.3%`; the four runs with no accent are untouched. The pair it could have separated is the
pair it separated, and sonnet is left the sole 7/8 — the direction Richard's verdict already pointed.

`design-scores.json` was regenerated against all six replays and is current.

## §6 — The traps this session paid for

- 🔴 Both `--list` instruments (§0). One kills, one is a no-op. The memory that recommended the
  killing spelling as "the safe one" has been corrected.
- 🔴 **A backtick in a comment inside `measureExpression` ends the string.** That block is one
  template literal; `` `share` `` in a comment surfaced as `SyntaxError: Unexpected identifier` from
  `new Function` **in the purity test**, hundreds of lines from the cause. Warned at the edit site now.
- ⚠️ **Commit path-limited, always.** The sibling grew from 18 to 25 files while this session ran.

## §7 — Gates run, with numbers

| Gate | Result |
|---|---|
| `test:ci` (`cline-dev`) | ✅ **2632 specs, 6 failures** — the recorded floor, seed 05169 |
| `test:ci` (`wt-trial54`, merged) | ❌ **VOID** — killed at spec 550/2632, exit 0 and no `Jasmine:` line |
| `nodegx-render-measure` jest | 5/5, purity holds after the `share` change |
| `score-design.js` | 4 replay runs + a 6-replay regeneration, all completed beside a live sibling |
| `test:main` | ❌ not run — a sibling was live, and two concurrent runs invent failures |
