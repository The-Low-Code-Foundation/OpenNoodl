# Next session — EXP-011 Tier 1.4 landed; next is Tier 1.1, the client-side data vocabulary

## Where the phase stands

**EXP-011 Tier 1.4 is built, driven and gated (session 35).** The four value Variables —
`String`, `Number`, `Boolean`, `Color` — export. They are one runtime definition
(`variablebase.createDefinition`), so they were one translation with a four-row cast table, and the
shape a node takes is decided by its wires: a constant folds to a literal, a wired `value` under
Run On Value Change becomes a `useState` plus a sync effect carrying `setValueTo`'s own rules, and
a wired `Set` defers with a named reason.

**51 → 55 of 127 (40.2% → 43.3%).** Floor raised in the same commit.

Read [EXP-011 §6](./EXP-011-PICKER-COVERAGE.md) before touching this family — §6.2 is the one that
was nearly wrong, and it is a trap the *next* slice can walk into just as easily.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The number

```
npm run export-ledger:picker      # ratcheted in PR CI — holds at 55/127 (43.3%)
npm run export-ledger:check       # now also enforces the SHAPE of a deferral (EXP-011 AC4)
```

🔴 The corpus audit (now **85.27%**, up from 85.00% — twelve corpus instances of these four types
translated for free) is a regression net, never a priority oracle.
🔴 Custom node types are **deliberately** outside the picker number — `$customNodesComment` in
`packages/nodegx-export/coverage-ledger.json` says why. Do not "fix" it by adding them.

## Do this next: EXP-011 Tier 1.1 — the client-side data vocabulary

**[EXP-011 §3 Tier 1](./EXP-011-PICKER-COVERAGE.md).** `Object` (`Model2`),
`Set Object Properties`, `Create New Array`, `Clear Array`, `Remove Object From Array`,
`Array Filter`, `Array Map`, `Repeater Item`. Eight nodes, and the single biggest thing standing
between a user and an export that works — it is how anyone holds a working set of rows in the UI.

**[EXP-002-MODEL2-TARGET-OUTPUT.md](./EXP-002-MODEL2-TARGET-OUTPUT.md) §4's design is still good
and should be reused; §2, §3 and §7's ranking are void.**

⚠️ `Model2`'s ledger entry carries a real warning that predates EXP-011 and still stands: all 27
corpus instances are `idSource:foreach`, sitting in components reached only through dynamically
templated repeaters. **Build against a project you author, not against those.**

⚠️ **Author the picker-exercising project FIRST** (§2). Session 35's route is written down below
and took about twenty minutes end to end.

## Then

- **Tier 1.2 `HTTP Request`**, **Tier 1.3 the date family** — the rest of Tier 1.
- **EXP-004** — the honesty UX (a report file into the output). Still owed: EXP-010's emitted
  `TODO(export)` markers and module report both end with "See the export report", and there is no
  report. Tier 1.4's deferral notes now join them.
- **EXP-010 leftovers**, all optional and named in its §9: Route A, a kit's *logic* nodes,
  npm-dependency kits.
- **EXP-009 leftovers, small:** drive the exported login/admin forms in a browser, and delete the
  drive-residue user `exp009-drive` from the local Puppy backend's `_User`.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 580/580
cd ../nodegx-module-inject && ../../node_modules/.bin/jest --config jest.config.js   # 31/31
```

Corpus net: `build-corpus.ts` **41/41** (40 + `exp011-variables`); audit sums to
**3787/4441 = 85.27%** — sum the `^=== ` lines with a **regex**, not awk fields (project names
contain spaces, which silently shifts `$3/$4`).

⚠️ `ts-node` needs an **absolute** path and `--compiler-options '{"module":"commonjs"}'`, run from
`packages/nodegx-export`. `build-corpus.ts` needs **both** `--app <harnessDir>` and the project
list; copy the harness with **`cp -a`** so the `@nodegx/core` symlink survives; zsh project list is
`"${(@f)$(cat projects.txt)}"`.

## 🔴 How session 35 authored a picker project without an MCP server bound to it

`create_project` **does not repoint the bound server** — it says so in its own result — and a new
MCP server cannot be registered mid-session. So:

1. `mcp__nodegx__create_project` to scope and skeleton the project (this works from any bound
   server; only the *authoring* tools stay pointed at the old project).
2. Drive a **second server over stdio from a script**. Session 35's `mcp-client.mjs` is ~50 lines
   over `spawn` + newline-delimited JSON-RPC: `initialize`, `notifications/initialized`, then
   `tools/call`. It runs the server from **`src` via ts-node**, not from `dist/` —
   `packages/noodl-mcp/dist/noodl-mcp.cjs` was **eight days behind `src`**, and a stale dist has
   already refused correct work once in this repo.
3. `update_component` takes `{ path, set: { nodes, connections } }` — **not** top-level
   `nodes`/`connections`, which errors with *"Provide exactly one of `set` or `operations`"*.
   `get_node_type` takes `type_names: []`, plural and an array.
4. `render_report` afterwards confirms the **interpreter** runs it, before you ask whether the
   export does.

## ⚠️ Exporting runs the project's kit code

`parseProject` executes each `noodl_modules/<kit>/index.js` in a Node `vm` context, because a
custom node's ports are declared nowhere else on disk (`src/parse/kitSource.ts` says why). A `vm`
context is not a security boundary. Stated in both files; do not let it become implicit.

## Building and driving an exported app (how s35 did it)

- Harness: `cp -a` s34's `realapp/` (a Vite app with `node_modules` and the `@nodegx/core`
  symlink), `rm -rf src dist public`, then emit into it. **Never overwrite its `package.json`.**
- 🔴 The writer must perform `EmittedApp.copies` as well as `files` — a `.woff2` is not a string.
- `npm run build` runs `tsc -b && vite build`, so the generated wrappers are typechecked.
- Serve with `npx vite preview --port 5199 --strictPort`; **stop it by port**
  (`lsof -ti :5199 -sTCP:LISTEN | xargs kill`).
- To *click* or *type*, headless Chrome needs `--remote-debugging-port` and a CDP session.
  🔴 **Typing into a React-controlled input needs the native value setter**, not `el.value = x`:
  ```js
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  ```
  Assigning `.value` directly leaves React's internal tracker unchanged and **no `onChange` fires**
  — the drive reports success and nothing happened.
- 🔴 **Read `textContent` per element, never `body.innerText`.** `innerText` collapses empty
  elements away, and an empty readout is exactly what a *deferred* node is supposed to leave
  behind — the row that proves a deferral behaves honestly is the one `innerText` deletes.
- 🔴 **Give each signal a distinct observable sink.** Two signals into one popup slot made s34's
  drive unable to say which arrived.

## Instruments

s35 scratchpad `91a5e120-…`: `mcp-client.mjs` (the stdio MCP client), `emit-to-app.ts`,
`notes.ts`, `drive.mjs`, `coverage-audit.ts`, `projects.txt` (41) / `projects-40.txt`, the
prepared apps `dialapp/` and `harness/`.
s34's `a85c658b-…` has `realapp/`, `kitapp/`, `cdp-drive.mjs`, `sweep.ts`, `mods.ts`.
s31's `4fdc2703-…` still has `reach.py`, `deferred-census.ts`, `rank2.ts`, `mutate.py`
(🔴 rank2/census are regression instruments — do not rank work with them).
