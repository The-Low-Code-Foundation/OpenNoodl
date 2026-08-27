# Next session — Static Data, then Logic Builder, then EXP-003 Tier B

**Where the phase stands (2026-08-27, after seventeen sessions).** Session 17 did the Model2
paper design and **ruled against building it** —
[EXP-002-MODEL2-TARGET-OUTPUT.md](./EXP-002-MODEL2-TARGET-OUTPUT.md), commit `455d09e4`. Read
its §2 and §7 before ranking anything. The short version, all measured:

- **Model2 in `foreach` mode is not per-record state.** `modelnode2.ts` + `foreachitem.ts`:
  there is no id and no store lookup — the node reads the **enclosing repeater's row** via the
  ambient `_forEachModel`, which the instantiator hangs on the template's component instance.
- **All 27 corpus instances are `idSource: foreach`**, none has a `modelId`, and they do
  **135 prop reads and 0 writes** with no signal port consumed anywhere.
- **A Model2 slice would translate 0 of 27.** Not one is blocked by Model2: 7 of the 9 host
  components are reached only through the `Filters` root's `templateType: "dynamic"` repeater
  (`'./' + item.Type`), and the other 2 have `items` minted by a `Noodl.Object.create` script.
  Confirmed against the emitter's own notes, not the reasoning. NAMED-STORES §6 deferred this
  for the wrong reason ("id-addressed") — the blocker is the host, and it is Tier B's.
- The design is settled on paper anyway (§4 props-from-the-row, §5 gates) so it is not
  re-derived, and the ledger's Model2 exemption now names the real blocker.

**Next, in order (re-ranked in §7 on measured evidence — the old list ordered by raw node
count, which counts the population, not the translatable population):**

1. **`Static Data` (14 nodes, 8 signatures)** — the cleanest slice left, and every claim is
   already measured (`sd-survey.ts`): **14/14** are `type: json`, **14/14 parse** into flat
   record arrays, **14/14** have exactly one consumer (`items → For Each.items`), and
   **14/14** of those repeaters have a **statically named template with identity mapping**.
   All inputs are `allowEditOnly` (`staticdata.ts`), so the array is knowable by construction:
   a module constant plus the `.map()` `renderRepeater` already emits. This is the
   ProductCard/CategoryCard shape — the most repeated component in the corpus. Paper design
   first, as always. ⚠️ Expect the **row-output relay** (`ProductCard.addToBasket → Component
   Outputs`) to stay deferred on its own existing reason — the gain is the render, not the
   chain. Measure with the s16 audit instrument; do not quote a projected number.
2. **Logic Builder (14 nodes, 4 signatures)** — deterministic, the program is structured JSON
   ([[a-visual-function-program-can-be-generated-headlessly]]), not EXP-003.
3. **EXP-003 Tier B** — the Filters family (~80 nodes): per-component rewrites against the five
   state rows (CO §7 materialization first). **This is what unblocks Model2**, after which the
   Model2 slice is worth building to its own §4 design.

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`, plus `scripts/export-ledger`/root `package.json`/
`.github/workflows/pr.yml` only when the gate itself changes); never commit
`packages/nodegx-core/dist`; untracked files add+commit in one chain. 287 tests (~3s, from the
package dir `../../node_modules/.bin/jest`); a lone suite-level red with 0 failing tests is a
flake until re-run. `npm run export-ledger:check` from the root gates the ledger (175 types:
110 deferred, 49 translated, 1 stubbed, 15 backend-only).

**Instruments.** Session 17's are in scratchpad `943a9722-…`: `m2-survey.ts` (per-instance port
and parameter dump), `m2-reach.ts` (who instantiates a component — template vs plain instance),
`m2-rank.ts` (**deferred types by deduped corpus frequency — the re-ranking instrument, reuse
this before choosing any slice**), `sd-survey.ts` (Static Data shapes), `m2-emit.ts` (run the
real emitter over a corpus project and grep its notes — the "measure the artefact" step that
settled §2). The s16 `emit-preview.ts` + `coverage-s16.txt` are in `e93ff81d-…`; `emit-cheer.ts`
+ `coverage-audit.ts` + `projects.txt` in `21dc830c-…`; the packed `nodegx-core-0.1.0.tgz`,
`cheer-app` scratch copy and `drive-*.mjs` in `78102536-…`. ts-morph/Prettier stay uninstalled;
goldens protect the later AST refactor; package not in root `test:packages`.

⚠️ **`ParamIR.value` is a tagged union** (`literal` / `dimension` / `expression` / `script` /
`json`) — reading `.value` directly prints `[object Object]` and silently answers the wrong
question. Session 17 lost a survey run to it; unwrap by `kind`.
⚠️ **zsh does not glob unquoted parameter expansions** — `D=/path/21dc830c*/x; ls $D` finds
nothing. Resolve the directory with `ls -d` first. And `$(cat projects.txt)` splits wrong —
use `"${(@f)$(cat …)}"`.
⚠️ ts-node recipe: `TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node",
"esModuleInterop":true}' ../../node_modules/.bin/ts-node --transpile-only --skipProject <script>`
from `packages/nodegx-export`.
⚠️ jsdom drive: React only AFTER the jsdom globals; Home needs the `rr-shim.mjs` alias AND a
MemoryRouter wrapper. ⚠️ `src/analyze/appState.ts` has literal NULs — `grep -a`; never type a
NUL escape into Edit/Write args. ⚠️ "disabled" appears in tokens.css comments — sweeps restrict
to `.tsx`. ⚠️ The ledger is `ensure_ascii=True` JSON (indent 2) — rewrite it through `json.dumps`
with those settings or the diff explodes. ⚠️ Mood wires `readVisitor-2.value` into three sinks —
legitimate, don't dedupe. ⚠️ A peer's FB-026 edits live uncommitted in
`packages/noodl-runtime/src/node.ts` +
`packages/noodl-viewer-react/src/{nodes,components}/controls/TextInput*`/`text-input.ts`/
`textInputValue.ts` — never sweep them into an export commit. ⚠️ The audit's aggregate depends
on the signature dedupe — compare runs with the SAME script over the SAME list (s16's is the
current instrument), never against a remembered number. Corpus stands at **86.7%**
(2,361/2,724, 28 signatures, 40 projects) — session 17 changed no code, so it is unmoved.
