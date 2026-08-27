# Next session — EXP-002 after session 11 (Popups): Model2 and ComponentObject are the top non-JS gaps

**Where the phase stands (2026-08-27, after eleven sessions).** Sessions 1–7 built EXP-002
through steps 1–6 plus named stores, collections, and the expression family; session 8 measured
(66%, EXP-008 ledger + CI gate); session 9 built the eight visual generators (82%); session 10
built Component Outputs (83%). **Session 11 built popups — parent-owned modal slots — and the
re-run audit reads 86% (2,320/2,703 across 28 distinct graphs).** The design was settled on
paper first in [EXP-002-POPUPS-TARGET-OUTPUT.md](./EXP-002-POPUPS-TARGET-OUTPUT.md) — read it
before touching popup or slot code. What landed, all committed:

- **Show side**: `NavigationShowPopup.show` compiles to `{ kind: 'popup-show', slotKey, then }`
  — `setOpenPopup('AboutDialog')` plus the `done`-chain as following statements. One
  `useState<'A' | 'B' | null>` slot per hosting component (setting it IS the replace policy);
  openers of one target with identical literal params share a slot key; the slot renders as
  `{openPopup === 'X' && createPortal(<div className={styles.popupLayer}>…</div>,
  document.body)}` after the root's children, `.popupLayer { position: fixed; inset: 0; }`.
  Slots and the prop are **earned by attachment** — a compiled slot whose trigger never
  attaches leaves no state behind (post-pass scan over handlers/changeHandlers/receivers).
- **Close side**: a component hosting a translated `NavigationClosePopup` (only translatable
  when the component IS some ShowPopup's literal target) declares the reserved prop
  `onClose?: (action?: string) => void` after its output props; `closeAction-X` →
  `onClose('X')`, plain `close` → `onClose()`; the `done`-chain gates on the prop
  (`if (onClose) { onClose('ok'); onClosed?.(); };` — compact-if, the branch shape). No
  done-chain → `onClose?.('ok')`. The slot render passes `onClose` **only when the target's
  plan has `closesPopup`** — otherwise the emitted app's own tsc would fail, and a popup
  without a close node never closes at runtime either.
- **Everything unexercised defers named** (corpus: nine clones of one NoticeDialog shape —
  literal target/replace/no-params/no-results/zero consumed show-side outputs): wired target,
  `stack`, wired or non-literal popupParams, any consumed close outcome (future dispatch arrow
  recorded §7), declared `results` (value outputs → lifted state), `targetComponent`, Close
  Popup outside every target (ancestor walk). `Set Variable.done → show` (9 in corpus) defers
  by the existing owner rules — that is the logic-trigger slice, not popups.
- **Machinery changes to know**: `compiledSinks` is now keyed `${nodeId}:${port}` (ClosePopup
  compiles per trigger port; Condition's sweep reads `:eval`); `isTriggerWire(type, port)`
  replaced direct `TRIGGER_PORTS` equality (dynamic `closeAction-*` ports); a `compiling`
  set guards cyclic chains (also fixes a pre-existing arm→own-eval recursion hole); popup
  `done` wires are chain-internal in pass 2 (the Condition-arm pattern); `doneChainOf`
  compiles both popup nodes' done-chains including `done → Component Outputs.<port>`;
  emit-side `expandActions` flattens popup-show's `then` into following statements wherever
  actions print (handler arrows, receiver bodies, branch arms).
- Fixture: Cheer grew `Components/AboutDialog` (title/body/OK → `closeAction-ok`;
  `done → outputs.closed`) + Home's About button → ShowPopup. MCP-authored on the live
  `exp002-step5-cheer`, snapshot re-copied. **197 tests** (21 new in `tests/popups.test.ts`,
  incl. byte-for-byte AboutDialog golden); the Home golden in `stores-events.test.ts` grew
  with the fixture and its "no useState" assertion is now scoped to the slot. Ledger flipped
  both nav-popup entries → translated same commit (gate green, 44 translated). Emitted app
  `tsc -b` + `vite build` clean; jsdom drive `drive-popup.mjs` (session 11 scratchpad
  `fca37008-…`) proves click About → portal under `document.body` → OK → slot reset.

**Next, in corpus-impact order** (audit re-run `coverage-s11.txt`, session 11 scratchpad; 381
deferred nodes remain across the 28 distinct graphs):

1. **EXP-003 territory is now the #1 gap by far** — `JavaScriptFunction` 68 + `Javascript2` 11
   + `Expression` 10, plus most of the 34 deferred Component Outputs (fed by JS sources) as
   collateral. If the session appetite is a *deterministic* slice, skip to 2–4; EXP-003 itself
   wants its own paper design (trace harness, verification gate) per the phase README.
2. **`net.noodl.ComponentObject` (28)** — parent-scoped shared object; read the runtime source
   first (`componentobject.ts`) — likely lifted-state-shaped, design beside the
   controlled-state vocabulary.
3. **Model2 (27; id provenance)** — unchanged from COLLECTIONS-TARGET §5: the lone
   `NewModel.id → modifyId` wire is the first, degenerate case.
4. **The controlled-state slice** — wired `checked`/`value` on controls (button 15 + range 9 +
   checkbox 6 deferred are mostly this + wired-structure), Switch-as-state (5), `runOnChange`
   → `effect()`, value outputs as lifted state (COMPONENT-OUTPUTS §6), the popup close
   dispatch arrow (POPUPS §7) — one state vocabulary, then slices.
5. **Logic Builder (14)** — deterministic slice (program is structured JSON, generable
   headlessly, P73), not EXP-003. `Static Data` (14), `Counter` (7), `String` variables (6),
   remaining `Condition`/`RouterNavigate` (6 each, logic-trigger chains) follow.

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`, plus `scripts/export-ledger`/root `package.json`/
`.github/workflows/pr.yml` only when the gate itself changes); never commit
`packages/nodegx-core/dist`; untracked files add+commit in one chain. **Flip ledger entries in
the SAME commit as a slice** (gate green at 44). 197 tests (~3s, from the package dir
`../../node_modules/.bin/jest`). Fixtures are snapshots — re-copy from the live Cheer project
after MCP edits (`diff -rq`; registry at `components/_registry.json`). ts-morph/Prettier remain
uninstalled; the goldens protect the later AST refactor. The package is still not in root
`test:packages`. Emit recipe: `emit-cheer.ts` in session 11's scratchpad (`fca37008-…`), run
with `TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node",
"esModuleInterop":true}' ../../node_modules/.bin/ts-node --transpile-only --skipProject` —
update its OUT path to the new session's scratchpad; the scratch app pins
`file:../nodegx-core-0.1.0.tgz` (tgz current while `git log -1 -- packages/nodegx-core/src`
predates the pack date, 08-07; the emit script restores the pin). Audit recipe:
`coverage-audit.ts` + `projects.txt` same place — ⚠️ pass the project list with zsh's
`"${(@f)$(cat projects.txt)}"`, plain `$(cat …)` splits the space-bearing paths; dedupe clones
by (translated,total) signature before aggregating. ⚠️ jsdom drive: import React only AFTER
installing the jsdom globals; router-importing modules need the `rr-shim.mjs` alias (an ESM
shim re-exporting from a `createRequire` of the same CJS module instance; `ssr.noExternal`
breaks worse). ⚠️ `src/analyze/appState.ts` contains literal NUL bytes — `grep -a`; never type
the NUL escape into Edit/Write args (7 hits and counting — write such lines via python bytes).
⚠️ "disabled" appears in tokens.css token comments — a "no disabled anywhere" sweep must
restrict to `.tsx`. ⚠️ The Mood fixture wires `readVisitor-2.value` into three sinks — all
legitimate, don't "deduplicate". ⚠️ The ledger is `ensure_ascii=True` JSON — a python rewrite
with `ensure_ascii=False` churns every em-dash in the file.
