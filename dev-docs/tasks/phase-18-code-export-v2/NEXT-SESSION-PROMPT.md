# Next session — EXP-009 landed; next is EXP-010 (custom nodes)

## Where the phase stands

**EXP-009 is built and driven (session 33).** An exported `Puppy test 3` now talks to its real
backend: the Landing page listed the six actual database rows in a headless browser, with a
backend-down negative control reading zero. Auth and writes round-trip (verified at the wire
with the exact request shapes the emitted client makes). No master key anywhere in the built
bundle — pinned by tests and by a parser that drops privileged fields by construction.

Read [EXP-009-BACKEND-CONNECTION.md](./EXP-009-BACKEND-CONNECTION.md) §8 for what was measured,
and [EXP-009-CLIENT-TARGET-OUTPUT.md](./EXP-009-CLIENT-TARGET-OUTPUT.md) for the design if you
touch `src/api/` emission. The connected api files are byte-goldens in
`packages/nodegx-export/tests/goldens/exp009/` — change the emitter and the goldens together.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The number

```
npm run export-ledger:picker      # ratcheted in PR CI — holds at 51/127 (40.2%)
```

🔴 The corpus audit (85.00% / REACH 93.38%) is a regression net, never a priority oracle.

## Do this next: EXP-010 — custom nodes

**[EXP-010-CUSTOM-NODES-AND-MODULES.md](./EXP-010-CUSTOM-NODES-AND-MODULES.md).**
`parseProject` never opens `noodl_modules/`, so MCP-written nodes are dropped silently with no
marker in the output — the "silently half-working app" failure mode, on the surface NodeGX
users actually build on. They are already React (`window.React` + `createElement` + ports);
Route B (ship the kit + a minimal shim) is the fast correctness floor.

## Then

- **EXP-011** — the picker gap, Tier 1: `Object`/arrays, `HTTP Request`, dates, plain value
  nodes. **Build the picker-exercising projects in §2 before ranking anything.** Translating
  `Cloud Function` there also closes EXP-009's AC4 — the client seam is ready for
  `/functions/<name>`.
- **EXP-009 leftovers, small:** drive the exported login/admin forms in a browser (AC2/AC3 were
  wire-verified; nobody has clicked the exported forms), and delete the drive-residue user
  `exp009-drive` from the local Puppy backend's `_User` if it annoys anyone.
- **EXP-004** — the honesty UX (report file into the output).

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 519/519
```

Corpus net (all green at s33): `build-corpus.ts` **40/40**; audit sums to **3775/4441 = 85.00%**
— sum the `^=== ` lines with a **regex**, not awk fields (project names contain spaces, which
silently shifts `$3/$4` and read 83.59% this session before the regex).

⚠️ `ts-node` needs an **absolute** path and `--compiler-options '{"module":"commonjs"}'`, run
from `packages/nodegx-export`. `build-corpus.ts` needs **both** `--app <harnessDir>` and the
project list; copy the harness with **`cp -a`** so the `@nodegx/core` symlink survives; zsh
project list is `"${(@f)$(cat projects.txt)}"`.

## Driving an exported app against a backend (how s33 did it)

- Backend instances live in `~/.noodl/backends/<id>/` (`config.json` has the port). Start one
  headless: `node packages/nodegx-backend/bin/nodegx-backend.js serve --data-dir
  ~/.noodl/backends/<id> --port <port> --backend-id <id>`. Puppy test 3 =
  `backend_msjck0y2ukxwv`, port 8581. **Stop it after** (kill by `lsof -ti :PORT -sTCP:LISTEN`).
- CORS is open (`Access-Control-Allow-Origin: *`), so a `vite preview` origin works.
- Headless Chrome: `--headless=new --timeout=15000 --virtual-time-budget=6000 --dump-dom` —
  without `--timeout` it wedges forever; even with it the process can outlive the dump, so
  write the DOM to a file and read the file.

## Instruments

s33 scratchpad `62743c97-…`: prepared harness `app/` (+ `drive-app/` with the built bundle),
`emit-to-app.ts`, `projects.txt`, `coverage-audit.ts`, `build-s33.txt`, `cov-s33.txt`.
s31's `4fdc2703-…` still has `reach.py`, `deferred-census.ts`, `rank2.ts`, `mutate.py`,
`dumpall.ts`, `showfile.ts` (🔴 rank2/census are regression instruments — do not rank work).
