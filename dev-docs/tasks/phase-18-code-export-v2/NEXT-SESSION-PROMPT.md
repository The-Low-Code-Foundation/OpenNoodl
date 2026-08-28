# Next session — EXP-011 Tier 1.1 landed; next is Tier 1.2, `HTTP Request`

## Where the phase stands

**EXP-011 Tier 1.1 is built, driven and gated (session 36).** The client-side data vocabulary:
`Object`, `Array Filter`, `Array Map` and `Clear Array` export. The other four of Tier 1.1's eight
defer, each on a named mechanism, and **three of them are blocked by something that is not about
them** — read [EXP-011 §7.3](./EXP-011-PICKER-COVERAGE.md) before "finishing Tier 1.1", because
there is no work on those nodes that would finish it.

**55 → 59 of 127 (43.3% → 46.5%).** Floor raised in the same commit.

Read [EXP-011 §7](./EXP-011-PICKER-COVERAGE.md) before touching this family. §7.2 is the one that
matters most: three defects that **only building and driving the emitted app could find**, and all
three are traps the next slice can walk into unchanged.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The number

```
npm run export-ledger:picker      # ratcheted in PR CI — holds at 59/127 (46.5%)
npm run export-ledger:check       # also enforces the SHAPE of a deferral (EXP-011 AC4)
```

🔴 The corpus audit is a regression net, never a priority oracle.
🔴 Custom node types are **deliberately** outside the picker number — `$customNodesComment` in
`packages/nodegx-export/coverage-ledger.json` says why. Do not "fix" it by adding them.

⚠️ **Session 35's handoff quoted "corpus 41/41; audit 3787/4441 = 85.27%", and those two describe
different sets** — `4441` is the **40**-project denominator, `exp011-variables`' 24 nodes are not in
it. On that same 40, this session's changes read **3795/4441 = 85.45%**. With all 41 it is
3818/4465; with `Reading Shelf` added, 3847/4494. Quote which set you measured.

## Do this next: EXP-011 Tier 1.2 — `HTTP Request`

**[EXP-011 §3 Tier 1](./EXP-011-PICKER-COVERAGE.md), item 2.** Any app that talks to anything that
is not its own backend. `packages/noodl-runtime/src/nodes/std-library/data/httpnode.ts` — read it
before designing, the way §7 read `filtercollectionnode.ts` before designing the filter.

Then **Tier 1.3, the date family** (`Now`, `Date To String`, `Date Add`, `Date Compare`,
`Date Difference`, `Date Parts`) — six Utilities nodes, and anything with a timestamp needs two.

## Then

- **EXP-004** — the honesty UX (a report file into the output). Still owed: EXP-010's emitted
  `TODO(export)` markers and module report both end with "See the export report", and there is no
  report. Tier 1.4's and Tier 1.1's deferral notes now join them.
- **The collection-state slice** — it is what unblocks `Set Object Properties`, and (with the
  row-output relay) `Remove Object From Array`. Both ledger entries name it.
- **EXP-010 leftovers**, optional, named in its §9. **EXP-009 leftovers**: drive the exported
  login/admin forms in a browser, and delete the drive-residue user `exp009-drive` from the local
  Puppy backend's `_User`.

## 🔴 What session 36 would tell you if it could only say four things

1. **Measure the blocker before building the enabler.** The session opened intending to mint an
   `id` on every inserted row so `Remove Object From Array` could translate. Checking the
   row-output relay first showed the delete-a-row flow is blocked *there*, so the ids would have
   bought nothing and would have changed a shipped slice's output. Twenty minutes of grep beat a
   day of work.
2. **A `toContain` cannot fail on code that does not parse.** The first `Clear Array` fork emitted
   `}; else` — a SyntaxError — and three assertions passed on it because every substring really was
   present. `tests/emitted-syntax.test.ts` is the floor beneath `tsc` now; it is cheap, and it has
   a control pair so it cannot pass vacuously.
3. **A green suite over fixtures that lack your node type proves nothing about your node type.**
   Two temporal-dead-zone `ReferenceError`s (a `const` arrow read from a pass that runs before its
   declaration) sat behind 626 passing tests, because **no fixture had a `Model2` node**. Emit a
   real project early, not at the end.
4. **Sabotage the driven project.** The last hole — an `Array Map` naming a source property the
   array lacks, emitting `row.nope` and failing `tsc -b` — was found by breaking the thing on
   purpose, not by reasoning. The same sabotage doubles as the mutant that proves the drive can
   fail at all.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 636/636
cd ../nodegx-module-inject && ../../node_modules/.bin/jest --config jest.config.js   # 31/31
```

⚠️ `ts-node` needs an **absolute** path and `--compiler-options '{"module":"commonjs"}'`, run from
`packages/nodegx-export`. `build-corpus.ts` needs **both** `--app <harnessDir>` and the project
list; copy the harness with **`cp -a`** so the `@nodegx/core` symlink survives; zsh project list is
`"${(@f)$(cat projects.txt)}"`. Sum the audit's `^=== ` lines with a **regex**, not awk fields —
project names contain spaces, which silently shifts `$3/$4`.

## 🔴 Authoring a project without an MCP server bound to it (unchanged, and it works)

`create_project` **does not repoint the bound server** — it says so in its own result. So:

1. `mcp__nodegx__create_project` to scope and skeleton the project.
2. Drive a **second server over stdio from a script**: `mcp-client.mjs`, ~50 lines over `spawn` +
   newline-delimited JSON-RPC. It runs the server from **`src` via ts-node**, never from `dist/`.
3. `update_component` takes `{ path, set: {...} }` **or** `{ path, operations: [...] }` — and the
   operation discriminators are **snake_case**: `add_node`, `update_node`, `remove_node`,
   `add_connection`, `remove_connection`, `set_ports`, `set_visual_roots`, `set_component_info`.
   Passing `addNode` returns *"Invalid discriminator value"* seven times and one `isError`.
4. ⚠️ `mcp-client.mjs` truncates each result to 6000 chars, so a big `render_report` comes back as
   **unparseable JSON**. Grep the raw text for what you need rather than `JSON.parse`-ing it.
5. `render_report` confirms the **interpreter** runs it, before you ask whether the export does.

## Building and driving an exported app (what session 36 reused)

- Harness: `cp -a` the prepared `harness/` (a Vite app with `node_modules` and the `@nodegx/core`
  symlink), `rm -rf src dist public`, then emit into it. **Never overwrite its `package.json`.**
- `npm run build` runs `tsc -b && vite build`, so the generated wrappers are typechecked. **This is
  the step that finds what tests cannot** — it caught two separate emit defects this session.
- Serve with `npx vite preview --port 5199 --strictPort`; stop it by port
  (`lsof -ti :5199 -sTCP:LISTEN | xargs kill`). Chrome on a **non-default** debug port (9333), so a
  stray browser cannot steal it.
- 🔴 **Typing into a React-controlled input needs the native value setter**, not `el.value = x`.
- 🔴 **Read `textContent` per element, never `body.innerText`** — `innerText` collapses empty
  elements away, and an empty readout is exactly what an honest deferral leaves behind.
- 🔴 **Give the drive something that must NOT happen.** Reading Shelf's wishlist button is the
  negative control; without it the filter excludes nothing and a passing drive proves nothing.

## Instruments

s36 scratchpad `9001618b-…`: `mcp-client.mjs`, `emit-to-app.ts`, `drive-shelf.mjs`,
`coverage-audit.ts`, `projects-42.txt`, `corpus-harness/`, the built `shelfapp/`.
s35's `91a5e120-…` has `harness/`, `dialapp/`, `drive.mjs`, `projects.txt` (41).
s34's `a85c658b-…` has `realapp/`, `kitapp/`, `cdp-drive.mjs`, `sweep.ts`, `mods.ts`.

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes** (a map-key
separator written literally into template strings, lines ~240/469/490/493). `grep` and `rg` treat
the whole file as **binary and print nothing** — use `rg -a`. It cost this session one search
before the cause was spotted; replacing them with `\0` escapes would be behaviour-identical.
