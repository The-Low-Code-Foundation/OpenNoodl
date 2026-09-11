# HLS-008 — what was built

**Session 11, 2026-09-10. 4 of 4 acceptance criteria.**

`export_react` over MCP. An agent that authored an app can ship it in the same conversation: no
editor, no window, no click. Driven end to end against the **built** server bundle — created a
project, authored two pages, exported, and let `npm install && npm run build` judge the result.

## 1 — The shape, and the one decision that made everything else easy

🔴 **The tool calls the CLI, it does not re-assemble it.** `@nodegx/export` exports every piece of
the sequence, and putting them together again here would have satisfied AC2 on the day it was
written and drifted the first time either door grew a step. So `runCli` is now exported from the
package index, and `export_react` builds an `argv` and hands it a `CliIO` that captures instead of
printing.

**Byte-identity is therefore structural, not asserted.** There is one sequence and it is spelled
once — the argument HLS-002 made for the editor's door and the binary sharing `writeExport`, one
layer up. The spec is a regression test on the wiring, not the thing keeping the property true.

The three-line consequence, and it is worth knowing before the next consumer:

- `packages/nodegx-export/src/index.ts` re-exports `runCli`, `readableProject`, `lastWritten`,
  `EXIT`, `parseArgs` and `USAGE`.
- `packages/noodl-mcp` resolves `@nodegx/export` to **`src/`**, not to the `dist/` its `main`
  advertises. Two resolvers needed teaching (`jest.config.js`'s `moduleNameMapper`, `build.mjs`'s
  esbuild `alias`); the third, `tsconfig.json`, already had it — the **root** `tsconfig.json`
  carries the mapping and every package extends it. ⚠️ A `paths` block in the child would have
  **replaced** the inherited one wholesale and broken `@noodl-models/*`; that was tried, measured
  (two TS2307s in `AiAssistant/client/types.ts`) and reverted.
- Two files that had never met a second compiler now do — see §6.

## 2 — What this door decides that the other two do not

🔴 **The CLI's refusals name flags, and an agent cannot type a flag.** `nodegx export` refuses a
non-empty output folder with *"Pass `--force` to write into it anyway"*. The refusal is returned
**verbatim** — it is the product's own account and two wordings of it is two things to keep true —
and `noteFor()` appends the one sentence that translates it: *"From this tool the argument is
`force: true`, not `--force`."* One account, one addressing line, which is the shape
`open_in_editor` already uses.

🔴 **`ok` and "everything translated" are two questions and the payload keeps them apart.** A real
export exits 0 with refusals on purpose, so a project with a known deferral can still ship; only
`--dry-run` turns refusals into a non-zero code, because that is the mode a pipeline gates on. So
`ok` is `true` on every returned payload (a refusal is a `ToolError`), `exit`/`outcome` carry the
CLI's own table, and `everythingTranslates` appears **only** on a dry run. ⚠️ It is deliberately
absent on a real export: the exit code does not carry it there and the only other source is the
prose in `written` — a boolean derived by matching a sentence is a boolean that goes wrong silently
the day the sentence is reworded.

**Registered in both modes**, `--read-only` included. That flag protects the *project* from an
agent; an export reads the project and writes to a folder outside it, and `checkTarget` is what
keeps the second half true.

## 3 — The placement, measured before it was chosen

Appended to the deferred **`project`** group ("Project lifecycle" — an export is the end of one).

| | resident surface |
|---|---|
| before | **8,273** / 8,280 — 7 free (C65) |
| after | **8,273** — **0** |

Zero for the reason the `create_node_kit` and `open_in_editor` notes already record: the only
resident trace of a deferred group is `find_tools`' `(N tools)`, and *"6 tools"* and *"7 tools"* are
the same length. `keywords` are matched server-side and never sent, so they cost 0 too. Resident was
never available at any price — a new `export` group would have cost ~26 against a bar with 7.

⚠️ **What that costs, said rather than argued away:** the group's `purpose` does not mention
exporting, so a model browsing purposes will not meet this tool. The keywords are the door —
`export`, `react`, `ship`, `deploy`, `host`, `hand over` — and each one is asserted to open it,
from a **fresh un-revealed session**, rather than assumed to.

## 4 — The acceptance criteria

1. ✅ **(person)** A fresh MCP session, no editor running: `create_project` → author two pages →
   `export_react` → `npm install && npm run build`. See §5.
2. ✅ `dry_run` writes nothing (a recursive snapshot of the project, size + `mtimeNs`, identical
   after), and its text is byte-identical to the CLI's. Proved twice — in-suite against `runCli`,
   and across two real process boundaries (§5).
3. ✅ A target inside the project is refused by `checkTarget`, with the reason, `exit: 3`, and a
   snapshot showing nothing written.
4. ✅ Advertised after the reveal, absent before it (the control that makes the first assertion
   about *disclosure* rather than registration), reachable by all six keywords, and its description
   **points at `EXPORT-REPORT.md`** rather than restating a 127-row ledger that moves every phase.

**16 gates in `packages/noodl-mcp/tests/hls008ExportReact.test.ts`.** All 16 were green on their
first run, which is the moment to distrust them — so three mutants were run:

| mutant | fires |
|---|---|
| `preflight: out.trim()` | 2 gates ✕ |
| the `force: true` translation removed | 1 gate ✕ |
| the six keywords removed | 1 gate ✕ |
| `extraResources` destination changed to `catalog/` | 1 gate ✕ |

## 5 — The drive

Everything below ran against `dist/noodl-mcp.cjs` **copied into a directory with no `packages/`
above it**, next to `dist/node-catalog.json` — the packaged app's layout, not the checkout's.

**AC1.** `create_project` (bootstrap mode, no project bound) → `update_component` set Home's text to
`Last boil: 08:12 this morning` → `create_component` wrote `Pages/History` → `export_react
{dry_run:true}` returned `exit: 0, everythingTranslates: true` → `export_react {out_dir}` wrote
**14 files**. Then, in that folder: `npm install` (72 packages), `npm run build` (`tsc -b && vite
build`) **exit 0**, 46 modules, `dist/assets/index-BWuE4yP4.js` 263.68 kB.

*The pages are the pages that were authored*, server-rendered from the emitted source:

```
--- Home ---    <title>Home</title><div class="Home_home"><p class="Home_placeholder">Last boil: 08:12 this morning</p></div>
--- History --- <title>History</title><div class="History_historyPage"><p class="History_historyHeading">Every boil, most recent first</p></div>
```

**AC2 across two process boundaries.** `node packages/nodegx-export/dist/cli.mjs export --dry-run
<project> > cli.txt` (the real bin, from the real build) against the same call made through an MCP
client to the bundled server. Two different bundles, two different processes:

```
081712c99b5e127a9d04a656179e0a14  cli-dryrun.txt
081712c99b5e127a9d04a656179e0a14  mcp-dryrun.txt   →  diff: IDENTICAL, 1,333 bytes
```

⚠️ **1,333 bytes is the presence control.** Two empty files also have equal hashes.

**C72, both arms.** Before the catalog was copied in, the same call returned `not-found` and *"The
node catalog could not be found. Looked for the packaged copy at … and the in-repo source at …"* —
two absolute paths that mean nothing to the person reading them. Register row C72 has the
arithmetic for why no in-repo gate could see it.

## 6 — What building this found

- 🔴 **C72 — `export_react` would have shipped dead in the packaged app.** The class matters more
  than the instance: this is the first thing bundled into `noodl-mcp.cjs` that reads a file at
  runtime, and the in-repo path resolves *by coincidence of directory depth*.
- ⚠️ **C73 — "an empty placeholder page" is tested structurally.** `isPlaceholderPageGraph` returns
  true for any page whose root has one childless `Text`, **without reading the text** — so the Home
  page this drive authored was still a placeholder, and creating a second page moved `startPage`
  onto it. The exported `App.tsx` routed `/` to `HistoryPage`. AAQ-001 owns the rule and the rule is
  intended; the gap is between its words (*"empty"*) and its test (*"one Text"*).
- 🔴 **Exporting `runCli` put `cli/run.ts` in the editor renderer's webpack graph for the first
  time, and it did not compile there.** `run.ts:149` was `if (!readable.ok)`; the editor's tsconfig
  has no `strictNullChecks`, and without it a discriminated union does **not** narrow through `!x`.
  TS2339, and a peer session's dev build could not start. Now `if (readable.ok === false)` — the
  same idiom the `checkTarget` call twenty lines below had always used, for a reason nobody had
  written down. **Two compilers read that file now; it has to satisfy the stricter reading of
  both.**
- **33 type-only re-exports in `@nodegx/export`'s index are now marked `type`** — `noodl-mcp`
  compiles with `isolatedModules`, and that package does not.
- ⚠️ **`jest` in `noodl-mcp` runs with `diagnostics: false`**, so a bad import in a spec is green
  under jest and TS2459 under `tsc --noEmit`. The suite is not the typecheck here; run both.

## 7 — Gates at this commit

| gate | result |
|---|---|
| `noodl-mcp` jest | **98 / 100 suites, 1,408 / 1,411** — the 3 reds are **C52**, re-measured unchanged |
| `nodegx-export` jest | **94 / 94 suites, 3,297 passed**, 1 skipped |
| root `npx tsc --noEmit` | 0 |
| `npx tsc -p packages/noodl-editor --noEmit` | 0 |
| `noodl-mcp` `npx tsc --noEmit` | 0 |
| resident MCP surface | **8,273 / 8,280** — unchanged |

⚠️ On the **first** noodl-mcp run, 4 suites failed; on the re-run, 2 — `projectOwnsBackend`
(`provision_backend`) and one other were flakes under a peer session's editor stack, which was live
at the time and torn down before the second run. A lone red is a flake until it is re-run.

## 8 — What is NOT established

- **`npm ci` was not run** — AC1 says `npm ci`, and the export ships no lockfile, so `npm install`
  is what there is. Nothing here would tell the difference; the criterion's word is wrong, not the
  drive.
- **Nothing was painted in a browser.** The build succeeded and both pages were server-rendered
  from the emitted source. `vite preview` and a real paint were not run.
- **One project, two pages, no backend and no assets.** The corpus gates in `nodegx-export` cover
  the export itself across 44 projects; this task added no corpus coverage and moved no golden.
- **The subprocess byte-identity is a hand drive, not a gate.** Putting it in the suite would grade
  whatever `npm run build` last produced in a sibling package — the stale-`dist` reading these
  resolvers exist to avoid.
