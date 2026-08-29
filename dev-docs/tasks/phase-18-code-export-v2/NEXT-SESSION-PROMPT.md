# Next session — EXP-004 has no unblocked scope lines left

## Where the phase stands

**Session 52 built EXP-004's last unblocked scope item**: the original node source preserved in
comments. A Function or Expression this export refuses now carries its authored code at module
scope, beside where the printed wrappers go.

🔴 **Every remaining EXP-004 line needs a host or a person. Do not try to satisfy one with a test.**

**69 of 127 (54.3%)** — unchanged for a fifth session. Nothing on the picker moved, deliberately.

## 🔴 Read this before planning anything

1. **`@nodegx/export` has no consumer anywhere in the product.** Three repo-wide grep hits, all
   comments. The only way to run a code export today is `ts-node scripts/emit-app.ts` by hand.
   The in-editor report is blocked on an **editor export command** — a feature, not a wiring job —
   and it is owned by **`NONE`**. §21.1 has the evidence.
2. 🔴 **Grep for the thing before building it, and read what a passing assertion *means*.**
   s51's README already shipped for one project in seven with a green test pinning its absence.
   s52's source-preservation had a field built for it (`NodeIR.sourceText`) that **nothing reads**.
   Both scope lines read like new files and neither was.
3. 🔴 **Registration is not emission.** s52 nearly shipped `plan.jsFunctions` as the discriminator
   for "did this body print?". `formatList` **is** registered and never prints. Only
   `referencedJsIds` separates them, and testing the proxy before using it is what caught it.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The numbers

```
npm run export-ledger:picker      # ratcheted in PR CI — holds at 69/127 (54.3%)
npm run export-ledger:check       # 175 types: 83 deferred, 76 translated, 1 stubbed, 15 backend-only
```

🔴 The corpus audit is a regression net, never a priority oracle.
🔴 Custom node types are **deliberately** outside the picker number — `$customNodesComment` in
`packages/nodegx-export/coverage-ledger.json` says why. Do not "fix" it by adding them.

## Do this next — in the order they are worth doing

### 1. Three EXP-004 lines now need Richard, not a session

None can be closed by the person who wrote the artefact, and all three are recorded as unrun
rather than quietly checked off:

- **The comprehension test.** *"A developer unfamiliar with the project reads the exported README
  and can state what needs doing without asking questions."* **Ask Richard to read one** —
  `tests/fixtures/puppy-test-3` exports the richest example — and to say what he could not work out.
- **The external review of the verification wording** (implementation step 6).
- 🆕 **Whether the preserved source block actually helps.** s52 proved the code is *there* and that
  the report's `grep -rn "TODO(export)" src` leads to it. Whether a developer can rewrite
  `formatList` from it is unmeasured, and is the same kind of question as the two above.

### 2. Decide whether the editor gets an export command at all — Richard's call

Now the only thing standing between this phase and its whole value being reachable outside a
terminal. **Ask before building it.** It may belong in its own task.

### 3. A chain-local for `Error` (§14.6, §17.6, §18.6) — owed by **two** nodes

`External Link` and `Navigate To Path` both refuse a read of `Error` from inside their own outcome
chains, on §8.2's closure rule. One chain-local closes both.

### 4. The collection-state slice — unblocks `Set Object Properties` and `Remove Object From Array`.

### 5. The date family's signals — an `effect()` slice, not a date slice (§9.6).

### 6. EXP-009 leftovers — drive the exported login/admin forms; delete the drive-residue user
`exp009-drive` from the local Puppy backend's `_User`.

## 🔴 What session 52 left honestly unfinished

**`NodeIR.sourceText` still has no consumer.** The field the IR documents as *"the
preserved-as-comment fallback when a translation stays unverified"* is written by the parser and
read by nothing. s52 quoted `JsFunctionPlan.body` instead — what the wrapper would have printed,
and the same text for `kind: 'function'`. The field was left as it was rather than quietly deleted
or quietly adopted. **Decide which, rather than inheriting the ambiguity a third time.**

**A Visual Function's preserved block is generated code, not authored text**, and its wording says
so. **No corpus fixture exercises that branch** — the wording is unverified against a real one.

**The corpus population is one node.** `puppy-test-3`'s `formatList` is the only corpus node whose
body never printed. The product surface is much larger — a Function whose outputs feed nothing
statically translatable is ordinary — but that is an argument, not a measurement.

## 🔴 What session 52 would tell you if it could only say three things

1. **The reading that fits is not the one that excludes.** Two nodes looked identically broken by
   every measurement taken: node id in no emitted file, script text nowhere. One was a real defect;
   the other (`reading-shelf`'s `toRow`) is **translated inline** into its collection chain, and
   its pre-flight saying *"the export refuses none of them"* was correct. **Reading the emitted
   page** is what separated them. Trusting the sweep would have "fixed" a working translation.
2. 🔴 **A control that reads zero has told you nothing.** The negative control for the U+2028 guard
   reported 0 parse errors with the guard removed — because the probe carried a **literal** U+2028
   in its own TypeScript source, where it had already been spent as a line break. The body under
   test never contained one. **Write the escape, never the literal**, and check the control fires
   before believing what it says about the finding.
3. **Print the generated artefact and read it as a reader.** The same habit that found four defects
   in s51's prose is what found `toRow` in s52's sweep. The suites cannot do this for you.

## 🔴 A trap in the shared `mut.py` habit — read before copying it

Session 52 **deleted `packages/nodegx-export/src` mid-run**. The snapshot step was
`mkdir -p snap && rm -rf snap/* && cp -a src …` in one `&&` chain; the glob matched nothing in the
empty directory, **zsh failed the whole compound**, and `snap/` stayed empty. `restore()` then ran
`rmtree(live)` *before* `copytree(snap)` and the copy had nothing to copy.

Recovery was clean because every file was tracked and only `src/` was reached (the loop threw on
its first directory). ⚠️ **`git checkout --` is blocked by the harness classifier and is the wrong
tool anyway** — the files were *deleted*, so they were restored additively with
`git show HEAD:<path> > <path>` per path, skipping anything that still existed, then verified with
`git diff --stat HEAD` showing empty.

**The fixed runner is in this session's scratchpad and is the one to copy.** It (a) refuses to
start unless every snapshot directory exists and is non-empty, (b) re-checks the snapshot inside
`restore()` before deleting anything, and (c) byte-compares after every mutant.
🔴 **Back up any file you have edited but not committed to a path outside the snapshot** — a
restore from an empty snapshot cannot give it back, and git only has the committed version.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files. ⚠️ A *new* test
file is untracked, and `git commit <pathspec>` **errors** rather than skipping it — `git add` it
and commit in the same command so the staging window stays closed.
⚠️ **Delete scratch scripts from `scripts/` before committing** — s52 left a `_emit1.ts` there.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 1044/1044, 42 suites (1039/42 before §23)
cd ../nodegx-module-inject && ../../node_modules/.bin/jest --config jest.config.js   # 31/31
cd ../noodl-runtime && ../../node_modules/.bin/jest   # 2564 passed, 13 skipped, 144 suites
npm run export-ledger:picker                  # from the repo root — holds at 69/127
npm run export-ledger:check                   # 175 types
```

⚠️ **`test:ci` was not run by this session, and this session did not need it** — nothing outside
`packages/nodegx-export` was touched. If you touch `noodl-runtime`, run it yourself rather than
inheriting a relayed floor.

✅ **`ts-node` starts `scripts/emit-app.ts` in ~1.5 s — measured, 2026-08-29.** The inherited
warning that it "takes well over two minutes" does **not** reproduce.
⚠️ **A foreground `sleep` is blocked.** To wait, use `run_in_background: true` with an
`until <check>; do sleep 5; done` loop.
🔴 **A full-suite mutation run takes ~5 minutes and the tool timeout is 2** — launch it with
`run_in_background: true`. A single-file jest run (~2 s) is fine in the foreground, and s52's six
mutants against `tests/in-code-markers.test.ts` took well under a minute in total.
⚠️ **`${PIPESTATUS[0]}` is empty in zsh** — run gates **without a pipe** and read `$?`.
⚠️ **`jest -t` takes a REGEX** — `-t 'U+2028'` matched nothing and printed `21 skipped, 21 total`
while reporting exit 0, which reads exactly like a passing filtered run. **Check the summary line
says something ran** before believing a filtered verdict.
Copy a harness with **`cp -a`** so the `@nodegx/core` symlink survives.

## Running the pre-flight

```
cd packages/nodegx-export
../../node_modules/.bin/ts-node -P tsconfig.json scripts/emit-app.ts --preflight tests/fixtures/puppy-test-3
```

Writes nothing, prints the summary to stdout. Without the flag the second argument is the output
directory and the export writes **`files` and `copies`** — §19.6's defect was dropping the second.

## The three documents the export writes, and the fourth thing it now preserves

- **`EXPORT-REPORT.md`** — the complete itemised record of every refusal, in the exporter's own
  words. **The `TODO(export)` markers in the generated code point at it by name.**
- **`README.md`** — the front door. **Emitted for every project since §22.**
- **The pre-flight** (`--preflight`, stdout only) — read standing up, before any of it exists.
  🔴 **It deliberately does not carry the next steps** — §22.3 says why; do not "fix" that.
- 🆕 **The code of a refused script node**, as a comment at module scope in the file where its
  wrapper would have gone (§23). On `puppy-test-3` that is `src/pages/Admin.tsx:9`, and the inline
  marker that sends a reader there is at `Admin.tsx:67`.

🔴 **The ordered steps are one function, `nextSteps()`, with two renderers.** If you change the
list, change it there. `tests/exported-readme.test.ts` crosses the two documents per fixture.

## Building and driving an exported app

- **`scripts/emit-app.ts` is the honest runner** — it writes `files` **and `copies`** (§19.6),
  `EXPORT-REPORT.md`, `README.md`, and answers `--preflight`.
- Harness: `cp -a` a prepared harness, `rm -rf src dist tsconfig.tsbuildinfo`, then emit into it.
  **Never overwrite its `package.json`.** ⚠️ The export writes `README.md` unconditionally, so a
  harness with its own README will have it replaced — that is intended.
- `npm run build` runs `tsc -b && vite build`. **This is the step that finds what tests cannot** —
  s52 ran it on `puppy-test-3` with the new comment block in place: exit 0, 57 modules.
- Serve with `npx vite preview --port 53xx --strictPort`; stop it by port
  (`lsof -ti :53xx -sTCP:LISTEN | xargs kill`). ⚠️ **`vite preview` binds `localhost`, and
  `curl 127.0.0.1` gets nothing.**
- Launch Chrome **separately** on a non-default debug port with a fresh `--user-data-dir`.
  🔴 **Do not pass `--disable-popup-blocking`** if a `window.open` is under test.
- 🔴 **Read `textContent` per element, never `body.innerText`**.
- 🔴 **Click with `Input.dispatchMouseEvent`**, never `element.click()`.
- ⚠️ **A React controlled input needs the native value setter plus an `input` event.**
- 🔴 **Write the expected answers down before the app runs**, then **sabotage in separate arms**.
- ⚠️ **An error row is never cleared**, so a success row must run **before** any failure row, and
  a row that navigates away runs **last**.

## Authoring a project without an MCP server bound to it (unchanged, and it works)

⚠️ **The session's own `nodegx` MCP server binds ONCE**, and `open_project` on a different
directory reports `bound: false` and changes nothing. Use the stdio client instead.

1. Drive a **second server over stdio from a script**: `mcp-client.mjs`, ~50 lines over `spawn` +
   newline-delimited JSON-RPC, running the server from **`src` via ts-node**, never `dist/`.
   ⚠️ Its calls file is a list of `{ "name", "arguments" }` — not `{ "tool", "args" }`.
2. `update_component` takes `operations` (`add_node` / `add_connection` / …) — for **appending**
   to an existing page it is the one to use, and a second run does not duplicate nodes.
3. ⚠️ `p-`/`q-` parameters report `dynamic-port-skipped` at **info** severity and the write lands.
   That is "unverified", not "verified correct" — the emitted code is the check.
4. ⚠️ **Create a page before any page that navigates to it**, and **writing a page can steal
   `startPage`** — check `components/App/nodes.json` afterwards.
5. ⚠️ An `HTTP Request` fixture needs **`url`**, not `resource`.

## Instruments

s52 scratchpad `e4b8cbef-…/scratchpad/`: `mut.py` (**the guarded runner — copy this one**),
`snap/` (src + tests + scripts), `harness/` (the built `puppy-test-3` export),
`component.ts.good` (the out-of-snapshot backup that made recovery possible).
s51 `9fcea17d-…`; s50 `e54aeffc-…`; s49 `481a2793-…`; s48 `e6b5ff80-…`; s47 `99fc4b87-…`;
s46 `cf0e64bb-…/openarm/`; s44 `7408cf11-…` (**the harness s52 copied**); s43 `2011a26f-…`;
s40 `1a63a0f6-…`; s38 `e94a3353-…` (the original harness).

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a` / `grep -a`.
