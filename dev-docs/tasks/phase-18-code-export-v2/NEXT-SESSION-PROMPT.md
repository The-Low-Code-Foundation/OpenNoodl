# Next session — the phase was re-scoped; start on EXP-009

## 🔴 Read these two, in this order, before anything else

1. **[README.md](./README.md)** — the objective, and §*What went wrong* (the mechanism that lost
   twelve sessions). It is short.
2. **[EXP-009-BACKEND-CONNECTION.md](./EXP-009-BACKEND-CONNECTION.md)** — the work.

## The objective, so it cannot drift again

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

Not old Noodl projects. Not downloaded prefabs. Not corpus percentages.

## The number

```
npm run export-ledger:picker                      # ratcheted in PR CI
node scripts/export-ledger/picker-coverage.js     # the readable report
```

> **51 of 127 placeable nodes export (40.2%)** — 2026-08-28

🔴 **`coverage-audit.ts` reads 85.00% and is NOT the metric.** It is a regression detector over ~40
old drive fixtures. Using it to choose work is the exact mistake this re-scope exists to prevent.
If you find yourself reading a deferral census to decide what to do next, stop — that census
answers "did I break anything", and nothing else.

## Do this next: EXP-009, the backend connection

Today every emitted backend call is a lie:

```ts
export async function fetchPuppies(): Promise<Puppy[]> { return []; }
export async function logIn(u: string, p: string): Promise<SessionUser> {
  throw new Error('logIn is not connected to a backend yet');
}
```

The exported app renders an empty list, refuses every login and silently drops every write —
against a backend whose address is sitting in `nodegx.project.json` → `metadata.cloudservices`.

**Why it is tractable:** EXP-002 already emits the interfaces, the typed signatures, the call
sites and the `Failure` paths the graph handles. Only the function bodies are stubs. The wire
format is `ParseWireAdapter.ts` — `/classes/<Collection>`, `X-Parse-Application-Id`, and
`restSerialize.ts` for the query encoding. **Port the protocol, not the 735-line adapter.**

🔴 **`X-Parse-Master-Key` never goes in a browser bundle.** EXP-009 §3 and AC5 — a grep of the
built output is an acceptance criterion, and `ParseWireAdapter:280` carries the story of what
happens when that header is wrong.

Start at EXP-009 §5 and work backwards. AC1 is the whole task in one sentence: *export
`Puppy test 3` against a running backend and the Landing page lists the puppies that are actually
in the database.*

## Then

- **[EXP-010](./EXP-010-CUSTOM-NODES-AND-MODULES.md)** — custom nodes. `parseProject` never opens
  `noodl_modules`, so MCP-written nodes are dropped silently, with no marker in the file. They are
  already React, so Route B (ship the kit + a minimal shim) is a fast correctness floor.
- **[EXP-011](./EXP-011-PICKER-COVERAGE.md)** — the picker gap, Tier 1 first: the `Object`/array
  vocabulary, `HTTP Request`, dates, the plain value nodes. **Build the picker-exercising projects
  in §2 before ranking anything.**

## Method worth keeping

Sessions 1–31 built 51 picker nodes and the method was never the problem — hand-write the target
output first, byte-for-byte goldens, mutation-check every new gate, `build-corpus.ts` over the
whole corpus, dump the artefact rather than trusting a passing test. Keep all of it. Only the
denominator changes.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage) — peers
edit `packages/noodl-editor`, `packages/noodl-mcp` and `packages/noodl-core-ui` constantly.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 504/504, never pipe it
```

⚠️ `ts-node` needs an **absolute** path and `--compiler-options '{"module":"commonjs"}'`, run from
`packages/nodegx-export`. Instruments take projects as argv; **zsh:
`"${(@f)$(cat projects.txt)}"`** — the paths contain spaces. `build-corpus.ts` lives at
`packages/nodegx-export/scripts/`, needs **both** `--app <harnessDir>` and the project list, exits
with the failure count (read the last line), and its harness must be copied with **`cp -a`** so
the `@nodegx/core` symlink survives. Sum `coverage-audit.ts` anchored on `^=== ` — its `REACH`
line also contains the words "nodes translated", and an unanchored `awk` double-counts it into a
confident, wrong 88.72%.

## Instruments

Session 31's scratchpad `4fdc2703-…`: `reach.py` (component reachability from raw files),
`rowhosts.py`, `dumpcomp.py`, `census-s31.tsv`, `cov-s31.txt`, the prepared harness `app/`, plus
s29/s30's `deferred-census.ts`, `coverage-audit.ts` (patched with the REACH line), `walls.py`
(patterns stale since s30), `rank2.ts`, `mutate.py`, `dumpall.ts`, `showfile.ts`.

🔴 **`rank2.ts` and the deferral census rank by the corpus.** They are regression instruments now.
Do not open them to decide what to build.
