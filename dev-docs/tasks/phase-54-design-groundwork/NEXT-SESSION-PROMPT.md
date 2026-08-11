# Phase 54 — the next session

**Written:** 2026-08-11, at the end of a session that ran **beside two live siblings** — a phase-50
LEG session holding 18 uncommitted files in the primary tree, and a phase-60 SIG session committing
to `cline-dev` while this was being written. No gate that launches Electron was run, for the same
reason as last time.

**This replaces the previous prompt.** Its §1, §2, §6 and §7 still hold verbatim and are not repeated
— go read them for the three unmerged DSG branches, the trial-merge numbers, and the parallel recipe.
What changed is §3 (still blocked), §4 (three of five items are now done) and §5 (numbering settled).

---

## §0 — Read this before you plan

**The previous prompt ranked five checkout-free tasks. Three are now built.** Do not re-plan them:

| Was | Now |
|---|---|
| §4.1 the design rubric | ✅ **built, all 8 rows** — `measurements/score-design.js`, `e41cb2a8` + `fb696b0d` |
| §4.2 decide `--border-control` | ✅ **decided and defined** — Richard's call, `fb696b0d` |
| §4.3 the gate that would have caught it | ✅ **built** — `npm run catalog:tokens`, `614e3673` |
| §4.4 DSG-003's five remaining recipes | 🟠 **unblocked** — see §2 |
| §4.5 spec F33 | 🟠 unchanged — still a UX decision, still needs Richard |

**The one correction worth carrying:** the previous prompt said `--border-control` is "defined in no
token set". The AI-facing token did not exist, but the editor's own chrome **already defined
`--theme-color-border-control: #7c8894`**, used for `PrimaryButton`'s control ring. The concept and
its value existed; only the AI-facing name was missing. Grep before quoting a spec row — including
the rows in this file.

## §1 — Still the blocking gate: `test:ci` has NOT been run

Unchanged from the last prompt, and now **two** sessions have failed to get to it.

- `packages/noodl-editor/tests/models/ProjectIdentity.test.ts` (DSG-007/F30) — jasmine,
  barrel-exported, typechecks clean, **assertions still never executed**. `test:main`'s `testMatch`
  covers `tests-main/` and `tests-unit/` only and cannot reach `tests/`.
- DSG-004's promotion of `uncollapsible-multi-column` to authored-blocking also needs one jasmine run.

**Until `test:ci` is green on the merged tree, F30 is fixed-and-unproven and F2 is not closed.**

⚠️ **A quiet dev stack is not a quiet checkout.** This session found *zero* Electron and webpack
processes at a moment when a sibling was committing 48 seconds earlier. `dev:stop --list` **first**,
never `dev:stop` — it kills by checkout and also matches a sibling's running `test:ci`. Check
`git log -1` and `git status` for a sibling's uncommitted work before believing the process table.

## §2 — What is available without the editor, ranked

`render:report` drives **its own headless Google Chrome**, and `dev-processes.js:56`'s `DEV_TOOL`
regex does not match it. It is the one visual instrument that is legal beside a live sibling — which
answers the question the last prompt left open in its §4.4.

1. **DSG-003's five remaining recipes** ⭐ **now the best available task.** The last prompt gated this
   on "check whether either script needs a browser this session can legally launch". Answered: it
   does, and it can. Three of the eight recipes shipped the defect they were teaching against (F23)
   because they were written from an *unmeasured* DOM. `npm run render:report -- <project-dir>` gives
   you the measured one, and `score-design.js` now scores the result per criterion.
2. **F39 — doctrine `§9` lands nowhere.** 0/6 replays build an empty-state branch and **no replay
   contains a gate node of any kind**. Either the doctrine never says how, or the vocabulary has no
   way to express it. Find out which before writing prose — DSG-004 refuted a whole gate premise by
   checking whether the thing was expressible at all.
3. **F38 — doctrine `§5` lands for two models of six.** Four replays contain *zero* `Image` nodes.
4. **F41 — `one accent` counts accents, not restraint.** haiku and sonnet both score `1 accent` in the
   same hue at 603,740px² and 14,474px². Area share is already in the report (`colors.accents[].area`);
   the criterion just does not use it.
5. **F40 — `real-copy` passes 6/6, so it discriminates nothing.** Widen the detector, or prove `§10`
   is genuinely absorbed. Do not read the green row as evidence until one run fails it.

## §3 — What needs Richard, not a session

- **F33** — a copied project directory inherits its parent's id. Deliberately not built: re-minting
  may be wrong, because "duplicate this project, experiment against the same data" is legitimate.
  Refuse-and-explain is plausibly correct. Residual hole to state either way: a copy of an *unbound*
  project, provisioned under a matching backend name, reuses the original's backend.
- **The §5 migration of the seven stranded projects** stays unexecuted, and both preconditions still
  stand: a build carrying F30, and one actual jasmine run. `Puppy test` and `test1` both point at
  8578; `BCN009 QA` (8579) has no claimant.

## §4 — Register, settled

Phase-54 numbering: **F1–F29** in the task files, **F30–F34** on the three unmerged branches,
**F35** = `--border-control` (the collision the last prompt flagged — `DSG-006`'s register keeps F25),
**F36–F43** in [NOTES-DSG-006.md](NOTES-DSG-006.md).

Closed this session: F35, F36, F42, F43. Open: **F38, F39, F40, F41**.
Still open from before: **F2** (needs `test:ci`), F26, F33.

⚠️ **F25 is closed but its two hardest rows were the last to work.** `one accent` and `rhythm` had no
instrument at all until this session; do not assume a row that prints a number was always measuring
something.

## §5 — The three traps this session paid for

- 🔴 **`rhythm` nearly shipped as a plausible lie.** The first version measured only inter-band gaps
  and reported *"1 distinct gap: 0"* for sonnet — a page with obviously good rhythm. Bands in this
  renderer **abut and carry their spacing as internal padding**, so gaps alone measure nothing. It
  was wrong in the direction that produces a believable number, which is the direction nobody checks.
  **A new measurement's first job is to disagree with something you already know.**
- 🔴 **A gate in `tests/` cannot be proved red beside a sibling.** That is why `catalog:tokens` is a
  script. DSG-007's `ProjectIdentity.test.ts` is the counter-example, unproven across two sessions
  now. If you build a check this session, build it where you can run it.
- ⚠️ **Commit path-limited, always.** A sibling landed `57196555` between this session's two commits
  and held 18 unrelated files the whole time. `git add -A` would have swept them.

## §6 — Gates run, with numbers

| Gate | Result |
|---|---|
| `typecheck:editor` | exit 0 |
| `catalog:examples` | 57/57 strict, warnings-as-errors |
| `catalog:tokens` (new) | 186 references / 63 files / 182 tokens, clean — **and proved red** |
| `nodegx-render-measure` jest | 5/5, purity holds |
| `test:ci` | ❌ **not run** — §1 |
| `test:main` | ❌ not run — a sibling was live, and two concurrent runs invent failures |
