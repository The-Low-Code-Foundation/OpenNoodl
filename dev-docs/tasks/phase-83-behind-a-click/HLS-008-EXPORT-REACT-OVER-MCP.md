# HLS-008 — `export_react` over MCP

The agent half of the same core. An agent that authored an app over MCP currently has to stop and
ask a human to click Export.

## 1. The person sentence

**An agent finishes building an app and ships it in the same conversation — no human, no window.**

## 2. Scope

- `export_react(project_dir, out_dir, dry_run?)` in `packages/noodl-mcp/src/tools/`, alongside the
  23 tool modules already there.
- 🔴 **`dry_run: true` returns the pre-flight verbatim** — the same text `--dry-run` prints. Not a
  re-worded JSON summary. The pre-flight is the product's own account of what the export will do,
  and two wordings of it is two things to keep true.
- The tool refuses a target inside the project (`checkTarget`), the same way, with the same reason —
  because the MCP scanner walks the project directory and would read the export back as content.
- **Out of scope:** `deploy_static` / `deploy_ssr` from #36. Those wait on HLS-010's verdict.

## 3. Acceptance criteria

1. **(person)** In a fresh MCP session with no editor running: author a small app, call
   `export_react`, then `npm ci && npm run build` in the output directory. It builds, and the pages
   are the pages that were authored.
2. `dry_run` writes nothing — asserted by mtime over the target's parent — and its text is
   **byte-identical** to the CLI's `--dry-run` for the same project.
3. A target inside the project is refused, with the reason, and nothing is written.
4. The tool appears in the server's advertised surface and its description says what the export
   cannot translate — pointing at the export ledger rather than restating it.

## 4. Traps

- 🔴 **The MCP tool surface has a token budget** (three budgets; 7 free slots at last measure). A
  tool added without checking it can push another tool out of the advertised set — check before,
  and measure the surface after.
- 🔴 **A stale `dist/` hides a merged change** — run from `src` when verifying, and rebuild before
  believing a "the tool is not there" reading.
- ⚠️ AC2's byte-identity is the point: it is what stops the CLI and the MCP tool becoming two
  descriptions of one behaviour that drift.
- ⚠️ The bound server may be the **installed app**, not this checkout. Read `probed` before
  concluding anything about which code answered.

## 5 — Closed, 2026-09-10 (session 11)

**4 of 4 acceptance criteria.** See [HLS-008-WHAT-WAS-BUILT.md](HLS-008-WHAT-WAS-BUILT.md).

✅ **§2 above was right in every clause** — the first time in four sessions a task file's §2 held up.
The only correction is cosmetic: 24 tool modules, not 23. It was still re-measured before a line was
written, and that budget bought the two decisions the task turned on (the surface read *before* the
placement, and the built artefact driven rather than the checkout).

🔴 **§2's `dry_run` requirement decided the whole shape.** "Returns the pre-flight verbatim — not a
re-worded JSON summary" is not satisfiable by assembling `parseProject`/`emitApp`/`renderPreflight`
here; it is satisfiable by calling `runCli`. So `@nodegx/export` now exports the command, and
byte-identity is structural.

🔴 **§4's trap list was one short, and the missing one was the serious one.** It warns about the
token budget (measured: 0 cost) and about a stale `dist/` (avoided: two resolvers now point at
`src/`). It does not warn that the **shipped** server is a single `.cjs` copied into a directory
with nothing above it — and `loadCatalog()` reads a file from disk. Register row **C72**.
