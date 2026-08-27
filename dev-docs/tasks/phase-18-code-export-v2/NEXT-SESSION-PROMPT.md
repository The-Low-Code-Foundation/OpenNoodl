# Next session — EXP-003 after session 13 (the paper design): build the pure re-host slice

**Where the phase stands (2026-08-27, after thirteen sessions).** Sessions 1–12 built EXP-002
through the Component Object slice (corpus 86%, 2,332/2,709 across 28 distinct graphs; session
12 `f6ef7175`). **Session 13 wrote EXP-003's paper design —
[EXP-003-JS-TARGET-OUTPUT.md](./EXP-003-JS-TARGET-OUTPUT.md) — read it in full before touching
any JS-node translation code.** No production code changed this session. The design's headline,
settled by the runtime sources + a full corpus census (139 JS nodes, 42 distinct bodies,
`js-survey.ts` + `js-survey-out.txt` + `js-survey-distinct.txt` in session 13's scratchpad
`36f6b553-…`):

- **Translation is re-hosting, not rewriting.** A pure `Inputs`→`Outputs` body is emitted
  **verbatim** inside a typed wrapper — correctness by construction, no LLM, no traces. The
  LLM + trace harness narrows to idiomatization (optional, later) and Tier B (the
  runtime-coupled Filters family: `Component.Object` ×80, `RepeaterObject` ×70, `Noodl.Events`
  ×40, plus cross-node function sharing through the `Component` scope — per-*component*
  rewrites, blocked on the controlled-state vocabulary anyway).
- **Two translatable shapes now** (both pure): **A1 reactive-derived** (no `run` wire → one
  render local per node, sinks read fields, every output maybe-undefined through the s12
  `{kind:'undefined'}` folds) and **A2h handler-inline** (`run` ← handler chain, outputs
  consumed in-chain; `done` is invocation-only in the source, so the translation is *exact*).
  Run-wired outputs feeding render sinks defer by name to controlled-state.
- **The purity gate** (§3, each failure a named defer): body compiles (+ strict-mode recompile
  — runtime compiles non-strict, emitted TS is strict); no `Noodl./Component./Script./this.`;
  no Date/random/fetch/timers/window/async; inputs statically sourced; consumed outputs land
  (strict-mixed verdict); consumed `isTrueEv`/`isFalseEv`/`failure` defer. Junk bodies are
  real in the corpus (`zzzUndefinedThing;`, `const total = pri`) — does-not-compile is a
  first-class reason. **Javascript2 defers whole** (it's a hand-written node DSL, not a
  function; corpus = date-picker DOM code + junk, zero cost).
- **Equivalence rules written** (§5): grade Q (quiescent snapshots — what makes per-render
  recompute faithful) vs grade I (per-invocation pulse count+order; `success` before `done`);
  `Object.is` + structural, no float tolerance same-engine; the verifier must fail the
  known-bad set (including "change-gate removed" which Q must NOT catch). Trace seams named
  (§6): `setScriptInputValue` / `runScript` / proxy set trap pre-gate / `_sendSignal` /
  `_onInputValueArrived` / `_calculateExpression`.

**Next: build the re-host slice** per §4/§9 of the design doc:

1. `BindingSource` grows `jsfun` (`{nodeId, fnName, args, output}`); plan resolves `in-*`
   feeds through `resolveExpr`; purity gate in analyze with every §3 reason producing its
   named defer; emit hoists the wrapper above the component + one render local per instance;
   A2h as a handler action step. Function names sanitize from node labels, dedupe per file.
2. Fixture: Cheer grows a pure Function formatter + a pure Expression gate via MCP on live
   exp002-step5-cheer, snapshot re-copied (`diff -rq`). Golden byte-for-byte; gate unit tests
   incl. corpus junk bodies verbatim; jsdom drive; emitted app `tsc -b` + `vite build`.
3. **Ledger: flip `JavaScriptFunction` + `Expression` → translated in the SAME commit;
   `Javascript2` stays deferred with its exemption rewritten to name the §1 ruling.** Re-run
   the audit (`coverage-audit.ts`, zsh `"${(@f)$(cat projects.txt)}"`, dedupe by signature);
   expect ~15–25 raw nodes + collateral (§8's honest estimate — the Filters ~80 stay Tier B).
4. Then, per the s12 ranking: **the controlled-state slice** (now doubly motivated: it unlocks
   Tier B and the run-wired-to-render shape) → Model2 (27) → Logic Builder (14).

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`, plus `scripts/export-ledger`/root `package.json`/
`.github/workflows/pr.yml` only when the gate itself changes); never commit
`packages/nodegx-core/dist`; untracked files add+commit in one chain. 217 tests (~6s, from the
package dir `../../node_modules/.bin/jest`); a lone suite-level red with 0 failing tests is a
flake until re-run. Fixtures are snapshots — re-copy from live Cheer after MCP edits (registry
at `components/_registry.json`). ts-morph/Prettier remain uninstalled; goldens protect the
later AST refactor; package still not in root `test:packages`. Emit recipe: `emit-cheer.ts`
(s12 scratchpad `e605feba-…`), `TS_NODE_COMPILER_OPTIONS='{"module":"commonjs",
"moduleResolution":"node","esModuleInterop":true}' ../../node_modules/.bin/ts-node
--transpile-only --skipProject` — update OUT to the new scratchpad; scratch app pins
`file:../nodegx-core-0.1.0.tgz` (current while `git log -1 -- packages/nodegx-core/src`
predates the pack date, 08-07). ⚠️ jsdom drive: import React only AFTER the jsdom globals;
router-importing modules need `rr-shim.mjs`. ⚠️ `src/analyze/appState.ts` has literal NULs —
`grep -a`; never type a NUL escape into Edit/Write args (write via python bytes). ⚠️ "disabled"
appears in tokens.css comments — sweeps restrict to `.tsx`. ⚠️ The ledger is
`ensure_ascii=True` JSON — python rewrites must keep it. ⚠️ Mood fixture wires
`readVisitor-2.value` into three sinks — legitimate, don't dedupe.
