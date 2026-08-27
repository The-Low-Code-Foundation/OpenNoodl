# Next session — EXP-002 after session 7 (the expression family): Model2, then the recorded holes

**Where the phase stands (2026-08-27, after seven sessions).** EXP-002 steps 1–6, named stores,
collections, and now the grown expression family are done. Session 7 extended
`EXP-002-LOGIC-TARGET-OUTPUT.md` (§6–§9 — read the extension before touching logic) and landed
**And / Or / Inverter and the Condition value outputs** as boolean expressions, plus the first
**boolean render sink**: `enabled` → `disabled` (an inverting `attr-not:disabled` role in
`CONTENT_PARAMS`, buttons now emit content attrs). Two source-reading corrections to what the
old prompt predicted:

- **Switch is NOT a ternary — it is a stateful latch** (`on`/`off`/`flip` mutate
  `_internal.state`, outcome signals on top; `switch.ts`). No expression exists to extract; the
  honest translation is a boolean `useState` with three setter paths — **its own future slice**
  beside `effect()`. It defers whole today.
- **Boolean expressions are truthiness devices** (`a && b` evaluates to an operand, the node's
  `result` to a strict boolean), so they are admitted into truthiness sinks only: a Condition's
  `condition` input, another logical's operand, and `enabled`. Any value-shaped sink (format
  placeholder, store write, payload, collection entry, text) defers with a note. They could
  land later by emitting `!!(…)`-coerced forms — there was no fixture material to hold a
  golden to.

**The rules that cost thought** (all in the target doc §6–§9): Inverter has an **undefined
passthrough** (`invert(undefined) = undefined`, deliberate) — an Inverter over a
maybe-undefined source defers, since `!x` would answer `true` where the runtime answers falsy;
plan.ts has its own `maybeUndefinedExpr` twin of emit's `maybeUndefined` for this. Condition
value outputs need `runOnChange-condition` **ticked** (the branch gate mirrored) and a pure
comparator node (no eval/arms/done wired); `result` → bare condition truthiness, `isfalse` →
`!cond`. Numbered ports are `"input 0"`, `"input 1"` (space, from 0); wires beat literal
params; literals fold (decisive literal collapses the node; single survivor collapses to its
truthiness; And nobody fed defers). Negation shapes: `!name`, `!(a && b)`, `!!x` for a bound
`not` (the double negation is deliberate); `enabled: false` authored → bare `disabled` attr.

- **Fixture** (Cheer via its MCP server, snapshot re-copied): Home `hasName` (Condition,
  default runOnChange) `visitorVar.value → condition`, `result → cheerButton.enabled` ⇒
  `disabled={!name}`. Mood `freshBoard` (Inverter over `subNote.value` — required key, so
  translatable) + `canSteal` (And: `readVisitor-2.value`, `freshBoard.result`) →
  `themeButton.enabled` ⇒ `disabled={!(name && !note)}` ("steal the name onto a fresh board
  only" — the drive order changed to match: steal FIRST, then type the note). Notes
  `draftOrVisitor` (Or: `noteDraftVar.value`, new `visitorRead.value`) → `canAdd` (Condition,
  untick) between `addButton.onClick` and `makeNote.new` ⇒
  `if (noteDraft.get() || visitorName.get()) notes.add({…})`.
- **Proof**: 131 tests (~1s, from the package dir `../../node_modules/.bin/jest`; new
  `tests/boolean-logic.test.ts` holds the slice's rules; the four page goldens updated).
  Re-emitted into this session's scratchpad `cheer-app/` (session
  `729429a9-c13f-4fa3-8721-2a058607661a`; node_modules carried from the 08-27 copies; core tgz
  still current — core src unchanged since 08-07), `tsc -b` + `vite build` clean, four jsdom
  drives green with the new disabled/guard assertions. render_report on the live project:
  clean; the one `dead-placeholder-text` on Home is the pre-existing CheerBanner boot state.

**Next, in order of value:**

- **Model2 (id provenance)** — unchanged from the collections slice (COLLECTIONS-TARGET §5):
  the lone `NewModel.id → modifyId` wire is its first, degenerate case; a literal-id Model2
  read and a same-handler NewModel id are the next two.
- **Smaller recorded holes**, cheapest first: boolean expressions into value sinks via
  `!!(…)`-coercion (needs fixture material); `else` arms and multi-action arms are implemented
  but fixture-unexercised (the `};` cosmetic in brace arms is known); nested Conditions defer;
  a String-Format-fed `enabled` is allowed but unexercised.
- **The two state-shaped slices**, each its own design decision on paper first: Switch as
  component state (`useState` + three setters + the Switched signals question), and on-change
  firing (`runOnChange` ticked with wired arms) as the `effect()` row.

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`); never commit `packages/nodegx-core/dist`; untracked
files add+commit in one chain. Fixtures are snapshots — re-copy from the live Cheer project
after MCP edits (`diff -rq`; the registry lives at `components/_registry.json`). ts-morph/
Prettier remain uninstalled; the goldens protect the later AST refactor. The package is still
not in root `test:packages`; wiring it in edits the shared root package.json — do it
deliberately, announced. Emit recipe: `emit-cheer.ts` in the scratchpad, run with
`TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node","esModuleInterop":true}'
../../node_modules/.bin/ts-node --transpile-only --skipProject` (it restores the scratch
`file:` core pin after writing — update its OUT path to the new session's scratchpad). ⚠️ jsdom
drive trap: import React only AFTER installing the jsdom globals (recipes in
`cheer-app/drive-*.mjs`). ⚠️ `src/analyze/appState.ts` contains literal NUL bytes — `grep -a`;
never type `\u0000` into Edit args. ⚠️ "disabled" appears in tokens.css token comments — a
puppy-style "no disabled anywhere" sweep must restrict to `.tsx`. ⚠️ The Mood fixture wires
`readVisitor-2.value` into three sinks (setTheme.value, hasVisitor.condition, canSteal
"input 0") — all legitimate, don't "deduplicate".
