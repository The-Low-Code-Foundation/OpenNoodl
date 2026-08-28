# Next session — EXP-010 landed; next is EXP-011 (the picker gap, Tier 1)

## Where the phase stands

**EXP-010 is built and driven (session 34).** `parseProject` had zero references to
`noodl_modules` — the directory was never opened — so every node from a project's own kit fell out
of the render tree and left the JSX with a gap and no marker. That is closed: a real 25-component
site (`cn027-drive`) now exports, builds, and renders **all four** of its custom nodes in a
headless browser, and a kit that fails leaves a `TODO(export)` where its node stood.

Read [EXP-010 §7–§9](./EXP-010-CUSTOM-NODES-AND-MODULES.md) before touching `src/kits/` emission —
§7 lists five things that were nearly wrong, including one that reintroduced this task's own defect
one directory over.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The number

```
npm run export-ledger:picker      # ratcheted in PR CI — holds at 51/127 (40.2%)
```

🔴 The corpus audit (85.00% / REACH 93.38%) is a regression net, never a priority oracle.
🔴 Custom node types are **deliberately** outside that number — the decision and its reasoning are
in `packages/nodegx-export/coverage-ledger.json`'s `$customNodesComment`. Do not "fix" it by adding
them; a denominator that moves with whichever project you point it at is the mistake this phase
lost twelve sessions to.

## Do this next: EXP-011 — the picker gap, Tier 1

**[EXP-011-PICKER-COVERAGE.md](./EXP-011-PICKER-COVERAGE.md).** `Object`/arrays, `HTTP Request`,
dates, plain value nodes.

⚠️ **Build the picker-exercising projects in §2 before ranking anything.** The corpus cannot tell
you what to build — that is the whole of the session-31 re-scope.

Translating `Cloud Function` there also closes EXP-009's AC4: the client seam is ready for
`/functions/<name>`.

## Then

- **EXP-004** — the honesty UX (a report file into the output). EXP-010 leaned on it twice: the
  emitted `TODO(export)` markers and the module report both end with "See the export report", and
  there is no report yet. That sentence is currently a promise the output does not keep.
- **EXP-010 leftovers, all optional and all named in §9:** Route A (needs the kit-format convention
  phase 69 owns, §6); a kit's *logic* nodes (`nodes:` rather than `reactNodes:` — `tally-kit` is a
  whole vocabulary of them and every instance exports as a named deferral); npm-dependency kits.
- **EXP-009 leftovers, small:** drive the exported login/admin forms in a browser (AC2/AC3 were
  wire-verified; nobody has clicked the exported forms), and delete the drive-residue user
  `exp009-drive` from the local Puppy backend's `_User` if it annoys anyone.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 554/554
cd ../nodegx-module-inject && ../../node_modules/.bin/jest --config jest.config.js   # 31/31
```

Corpus net: `build-corpus.ts` **40/40**; audit sums to **3775/4441 = 85.00%** — sum the `^=== `
lines with a **regex**, not awk fields (project names contain spaces, which silently shifts `$3/$4`
and read 83.59% in session 33 before the regex).

⚠️ `ts-node` needs an **absolute** path and `--compiler-options '{"module":"commonjs"}'`, run from
`packages/nodegx-export`. `build-corpus.ts` needs **both** `--app <harnessDir>` and the project
list; copy the harness with **`cp -a`** so the `@nodegx/core` symlink survives; zsh project list is
`"${(@f)$(cat projects.txt)}"`.

## ⚠️ Exporting now runs the project's kit code

`parseProject` executes each `noodl_modules/<kit>/index.js` in a Node `vm` context, because a
custom node's ports are declared nowhere else on disk (`src/parse/kitSource.ts` says why, and why
the three existing kit evaluators cannot answer this). A `vm` context is not a security boundary.
This is stated in both files; do not let it become implicit.

## Building and driving an exported app (how s34 did it)

- The prepared Vite harness with `node_modules` intact is s33's scratchpad
  `62743c97-…/scratchpad/app` — `cp -a` it, delete `src/`, `dist/`, `public/`, then emit into it.
  **Never overwrite its `package.json`** (session 5's lesson); `emit-to-app.ts` skips it.
- 🔴 **The writer must perform `EmittedApp.copies` as well as `files`.** A `.woff2` is not a string
  and cannot travel in `files`; a harness that only writes `files` silently drops every module
  asset and the icons render blank rather than erroring.
- `npm run build` runs `tsc -b && vite build`, so the generated wrappers are typechecked.
- Serve with `npx vite preview --port 5199 --strictPort`; **stop it by port**
  (`lsof -ti :5199 -sTCP:LISTEN | xargs kill`).
- To *click*, headless Chrome needs `--remote-debugging-port` and a CDP session — `--dump-dom`
  cannot interact. s34's `cdp-drive.mjs` (below) is ~20 lines over the global `WebSocket`.
- 🔴 **Give each signal a distinct observable sink.** Two signals wired to the same popup slot made
  the drive unable to say which one arrived — the second to fire satisfied the observation either
  way. The fixture's dial now has two separate click targets for exactly this.

## Instruments

s34 scratchpad `a85c658b-…`: `emit-to-app.ts` (files **and** copies), `cdp-drive.mjs`,
`reload.mjs`, `sweep.ts` (parse+emit every corpus project — 47/47 clean), `observe2.ts`,
`notes.ts`, `mods.ts`, prepared apps `kitapp/` and `realapp/`.
s33's `62743c97-…` has the harness `app/` and `coverage-audit.ts`.
s31's `4fdc2703-…` still has `reach.py`, `deferred-census.ts`, `rank2.ts`, `mutate.py`
(🔴 rank2/census are regression instruments — do not rank work with them).
