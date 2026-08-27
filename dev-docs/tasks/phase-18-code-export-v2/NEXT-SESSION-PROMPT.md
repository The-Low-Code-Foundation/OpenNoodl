# Next session — build the controlled-state slice (the session-15 paper design is done)

**Where the phase stands (2026-08-27, after fifteen sessions).** Session 15 wrote the
controlled-state paper design —
[EXP-002-CONTROLLED-STATE-TARGET-OUTPUT.md](./EXP-002-CONTROLLED-STATE-TARGET-OUTPUT.md) —
**read it in full before writing any slice code**, plus
[EXP-003-JS-TARGET-OUTPUT.md](./EXP-003-JS-TARGET-OUTPUT.md) §10 (the re-host rulings the
state rows compose with). Corpus stands at **87%** (2,260/2,597, 26 signatures); 261 tests.
No production code changed in session 15 — the doc is the whole delta.

**What the design settled (§ numbers are the new doc's):**

- **Five state rows** (§3): state var (`useState`), state read (`state-get` ValueExpr),
  state write (`state-set` action with `expr | op` — `op` = functional update for
  toggle/inc/dec), sync effect (the wired control input's graph path, coercion per §1's
  table, never fires Changed), push effect (lifted value outputs, CO §6 built). Plus the
  **chain-local snapshot rule**: read-after-set inside one handler inlines the written
  expression; read-after-`op` defers the reader.
- **Shapes** (§4): Switch/Counter latches (4a — consumed `switched*`/`done`/`unchanged`,
  wired `onFromStart`, Counter limits all defer named); `visible`/`mounted` as truthiness
  sinks (4b — the biggest corpus win, ~60 wires; `visible` = keep-space class toggle,
  `mounted` = conditional render, both join `enabled`'s admission list); controlled controls
  (4c — local state + sync effect + Changed chain; per-control §1 coercion table;
  `range.value → Text.text` lands; TextInput RunOnValueChange-unticked defers, `clear` is a
  `state-set` to the FB-026 empty); lifted value outputs (4d — push effect + parent
  `useState<T|undefined>`, s10 naming, collisions fail); For Each `itemsExpr` (4e — prop/state
  lists, `?? []`, index keys); invoked-JS render sinks materialize as state (4f, resolves
  JS-TARGET §3.7).
- **Survey** (`cs-survey.ts` + `cs-survey-out.txt`, s15 scratchpad `21dc830c-…`): Filters
  control wiring is all ComponentObject/Tier-B-blocked BY DESIGN — this slice is Tier B's
  vocabulary, not its translation (§7, §8). No project consumes Switch pulses or wires
  `onFromStart`. ⚠️ The runtime facts in §1 came from the tree WITH the peer's uncommitted
  FB-026 TextInput edits — if those landed/changed, re-check the §1 table against
  `text-input.ts` before trusting it.

**Next, in order:**

1. **Build the slice** per §4, fixture + tests per §9: Cheer grows (via MCP on live
   exp002-step5-cheer, **prefixed wires**, snapshot re-copied `diff -rq` then `cp`) a Switch
   latch into `mounted`+`visible`, a controlled Text Input from a variable, a lifted value
   output consumed by Home. Goldens per shape; §1 coercion-table tests; snapshot-rule tests;
   every §5 defer named. **Ledger: flip `Switch` in the same commit; `Counter` only if its
   instances actually translate.** jsdom drive (flip → vanish vs keep-space; typed sync;
   lifted arrival), emitted app `tsc -b` + `vite build`, audit re-run with named-reason
   spot-checks.
2. Then **Model2 (27)** → Logic Builder (14, deterministic slice per the s8 ruling) →
   EXP-003 Tier B (the Filters family, now that the vocabulary exists — per-component
   rewrites, CO §7 materialization first).

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`, plus `scripts/export-ledger`/root `package.json`/
`.github/workflows/pr.yml` only when the gate itself changes); never commit
`packages/nodegx-core/dist`; untracked files add+commit in one chain. 261 tests (~5s, from the
package dir `../../node_modules/.bin/jest`); a lone suite-level red with 0 failing tests is a
flake until re-run. Emit recipe (`emit-cheer.ts` + `coverage-audit.ts` + `projects.txt`) and
`cs-survey.ts` are in s15 scratchpad `21dc830c-…`; the packed `nodegx-core-0.1.0.tgz`,
`cheer-app` scratch copy and `drive-shout.mjs` remain in s14 scratchpad `78102536-…` (scratch
app pins `file:../nodegx-core-0.1.0.tgz`; current while `git log -1 --
packages/nodegx-core/src` predates the 08-07 pack date). ts-morph/Prettier stay uninstalled;
goldens protect the later AST refactor; package not in root `test:packages`.
⚠️ jsdom drive: React only AFTER the jsdom globals; Home needs the `rr-shim.mjs` alias AND a
MemoryRouter wrapper. ⚠️ `src/analyze/appState.ts` has literal NULs — `grep -a`; never type a
NUL escape into Edit/Write args. ⚠️ "disabled" appears in tokens.css comments — sweeps
restrict to `.tsx`. ⚠️ The ledger is `ensure_ascii=True` JSON. ⚠️ Mood wires
`readVisitor-2.value` into three sinks — legitimate, don't dedupe. ⚠️ A peer's FB-026 edits
live uncommitted in `packages/noodl-runtime/src/node.ts` +
`packages/noodl-viewer-react/src/{nodes,components}/controls/TextInput*`/`text-input.ts`/
`textInputValue.ts` — never sweep them into an export commit. ⚠️ ts-node recipe for scripts:
`TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node","esModuleInterop":
true}' ../../node_modules/.bin/ts-node --transpile-only --skipProject <script>`; zsh splits
`$(cat projects.txt)` wrong — use `"${(@f)$(cat …)}"`.
