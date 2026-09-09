# HLS-002 — `nodegx export`, and the proof it is the same export

The command already exists as a script someone runs by hand. This gives it a front door — and,
more importantly, gives the product a reason to believe the two front doors agree.

## 1. The person sentence

**A GitHub Action runs `nodegx export ./app ./out` and gets exactly what the author would have got
by clicking Export as React code.**

## 2. What exists (measured 2026-09-09)

`packages/nodegx-export/scripts/emit-app.ts` already takes `<projectDir> <outDir>` and a
`--preflight` mode whose contract is *"in this mode the runner must not touch the filesystem for
output at all"* — with a row in `tests/preflight.test.ts` driving the script rather than the library,
"because this is where the mistake would be". That is `--dry-run`, built and specced.

`writeExport(projectDir, outDir, app, fs)` takes `fs` as an argument so a plain-Node runner can call
it, and `checkTarget()` already refuses a target inside the project — because the editor's loader and
the MCP scanner would both read the export back as project content.

So the sequence is settled. What is missing is a `bin`, argument handling that is not
`process.argv.slice(2)`, and **the equivalence claim**.

## 3. Scope

- `nodegx export <project> <out>` and `--dry-run` (the existing pre-flight, verbatim — not a
  re-worded summary).
- Exit codes that a pipeline can branch on: success, refused target, not a v2 project, pre-flight
  refusals present. `--dry-run` prints and exits without writing.
- `writeExport.ts` and `checkTarget` move out of `noodl-editor` into the package. The editor's
  command becomes a caller.
- 🔴 **The equivalence spec** — one project, both doors, identical outputs.
- **Out of scope:** whether the output is *correct* (HLS-003) or *builds* (HLS-004).

## 4. Acceptance criteria

1. **(person)** From a clean checkout with no editor running: `nodegx export` a real project, then
   export the same project through the editor's menu item into a second directory. Diff the two
   trees. They are identical, including the copied assets.
2. `--dry-run` writes nothing at all — asserted by mtime over the whole output path's parent, not by
   the absence of the output directory. 🔴 Including no `mkdirSync`.
3. Each exit code is produced by a real cause and asserted distinctly. A refused target and a failed
   parse do not share a code.
4. The editor's export command still works and still shows the pre-flight modal and the toast — a
   mutant that breaks the shared path reddens both the CLI spec and the editor spec.

## 5. Traps

- 🔴 **AC1 is the reason this task exists and it is easy to fake.** If both doors call the same
  function, the diff is trivially empty and proves nothing about the *product* — so the spec must
  drive the editor's command through the editor's own code path (the `flushPendingProjectSave` →
  `parseProject` → … sequence), not call the library twice.
- 🔴 The editor flushes a pending autosave first **because the exporter reads from disk**. A CLI has
  no autosave to flush, but a running editor might. Decide what `nodegx export` does when the
  project is open and dirty, and say it in words on screen — do not silently export a stale file.
  (See #41, which asks for exactly this signal.)
- ⚠️ `copies` is a second channel and the shipped script runner once dropped it on the floor
  (P18 §19.6): fonts silently absent, every gate green. Assert both counts and a byte-identical copy.
