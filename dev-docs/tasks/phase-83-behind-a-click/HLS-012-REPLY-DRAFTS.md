# HLS-012 — the reply drafts

**Status: drafted 2026-09-09, session 2, `opennoodl-2d`. NOT POSTED.**
🧭 **Richard posts these, or approves the text.** An agent does not post to the community on its own
account. Until one is posted, HLS-012 is not closed — a draft is not a reply.

Every factual claim below was re-measured at `cline-dev` HEAD on 2026-09-09 before it was written
down; the measurements are listed in §4 at the bottom so a reviewer can check them without reading
the README. Nothing here states a release or a date (AC3, and R1 is unruled).

---

## 1. Reply to [#11](https://github.com/The-Low-Code-Foundation/NodeGX/issues/11) — @dominikstohl

> You are not blind: the `noodl build` command documented at `docs.noodl.net/2.9/cli/commands/build/`
> was never part of what was open-sourced, and there is no build or export CLI in this repository
> today. Four packages ship a `bin` — `noodl-mcp`, `noodl-preview`, `nodegx-backend` and
> `nodegx-observe` — and none of them builds an app.
>
> One thing will have made the search harder than it should have been: **`main` is still v0.1.x.**
> The exporter you would have been looking for, `packages/nodegx-export`, does not exist on `main`
> at all — it lives on `cline-dev`, with six other packages that are not on `main` either.
> [#20](https://github.com/The-Low-Code-Foundation/NodeGX/pull/20) is the open PR that syncs them.
> If you were reading `main`, the code was genuinely not there to find.
>
> **There are two different "builds" here, and they are not the same size of job.** Worth separating
> them, because the answer is different for each:
>
> **Export to React** — reads the project on disk and emits a React + Vite app you build and host
> yourself. This part is already a chain of pure functions (`parseProject → emitApp →
> summarizePreflight → writeExport`) in `packages/nodegx-export`, and there is already a script that
> runs it end to end from a shell: `packages/nodegx-export/scripts/emit-app.ts <projectDir>
> <outDir>`. `writeExport` takes `fs` as an argument specifically so a plain-Node runner can call it.
> What is missing is packaging, not logic: `@nodegx/export` is `"private": true` with
> `main: "src/index.ts"`, no build script and no `bin`, and two of its files import by relative path
> out into other packages. That is the whole distance between "it runs" and "you can install it in
> a CI job".
>
> **Deploy** — the 2.9 sense: the interpreted viewer plus cloud functions, pushed to a folder or a
> host. This one is not close. `deployToFolder` takes a live `ProjectModel`, which is the editor's
> document model — 1,927 lines, with an undo queue, a warnings model, the node library, an event
> dispatcher, a file watcher and the migrator behind it. It is not a parser you can call from a
> script. Whether it gets a CLI at all is an open question here rather than a scheduled one.
>
> For continuous deployment, export is the one you want, and it is the one being worked on now.
> @dishant-kumar-thakur filed [#36](https://github.com/The-Low-Code-Foundation/NodeGX/issues/36) for
> the same core from the agent angle, and that is the umbrella issue for this work: a `nodegx`
> binary with `export`, `render` and `serve`, and an `export_react` tool on the MCP server. Two
> known defects are being fixed alongside it, because both are worse in a pipeline than behind a
> GUI: [#24](https://github.com/The-Low-Code-Foundation/NodeGX/issues/24) — a freshly exported
> project does not pass `npm run build` — and
> [#23](https://github.com/The-Low-Code-Foundation/NodeGX/issues/23) — some component-input bindings
> are dropped and the export report does not say so.
>
> No date on any of it; there is no release ruled for it yet. But the question has an answer, and
> the answer was never "you missed it".

---

## 2. Reply to [#36](https://github.com/The-Low-Code-Foundation/NodeGX/issues/36) — @dishant-kumar-thakur

> Checked against `cline-dev` HEAD. This holds where it can be verified from outside, and the two
> things a sourcemap could not show both make the job bigger rather than smaller. Taking this as the
> umbrella issue for the headless work.
>
> **Confirmed, re-measured:**
>
> - The export chain is pure and already runnable from a shell. `scripts/emit-app.ts <projectDir>
>   <outDir>` is substantially the CLI already, and it has a `--preflight` mode that prints
>   `renderPreflight()`'s text and is specified to touch the filesystem not at all — so `--dry-run`
>   is as free as you say it is.
> - `writeExport(projectDir, outDir, app, fs)` injects `fs` on purpose; the header says so.
> - The packaging pattern is in the repo: `@nodegx/core` builds to `dist/` with
>   `publishConfig.access: public`, and `noodl-preview`, `noodl-mcp`, `nodegx-backend` and
>   `nodegx-observe` all ship `bin` shims that fail with a readable message when `dist/` is missing.
> - `serve` is the same task as [#31](https://github.com/The-Low-Code-Foundation/NodeGX/issues/31)
>   seen from the other end: loopback by default, and sharing becomes a decision that prints a URL
>   and a token, rather than a default that listens on every interface.
>
> **Two things the sourcemap could not show:**
>
> 1. **`@nodegx/export` cannot be published as it stands.** Beyond `"private": true`,
>    `main: "src/index.ts"` and no build script, two files reach *out* of the package by deep
>    relative path: `src/parse/parseProject.ts:16` imports `DEFAULT_TOKENS` from the **editor**, and
>    `src/analyze/logicbuilder.ts:33` imports `detectIO` from **`noodl-runtime`**. The other 40
>    files are clean. Both of those are shared truth with another package rather than strays, so
>    each needs a decision — extract, inject, or duplicate with a gate — not a move. "Publish the
>    pure parts" is three jobs, and this is the first.
>
> 2. **The exporter reads the project file as written, not the graph the editor showed the author.**
>    There is a project-load seam here: the editor applies a set of patches when it opens a project,
>    and readers that go straight to the files on disk do not. `parseProject` is one of those
>    readers — it is registered as `does-not-apply` in `NON_FROMJSON_READERS`
>    (`models/ProjectPatches/projectLoadSeam.ts`), alongside the MCP server's project store and
>    template generation. On one template we measured 56 stored parameters that the editor rewrites
>    on open, and drove that to zero — but a zero on one template is not a closed seam, and the
>    module says so itself.
>
>    **For your use case this is the one that matters.** Every command in your table can ship and be
>    green and the export can still disagree with the canvas — and in a CI job there is nobody to
>    notice. It was in neither issue, and it is the load-bearing piece of the work.
>
> **One correction: the `deploy` row is not the same price as the `export` row.** In your table they
> sit in the same column, and they are different orders of work. `deployToFolder` takes a live
> `ProjectModel`: 1,927 lines dragging in `UndoQueue`, `WarningsModel`, `NodeLibrary`, an
> `EventDispatcher`, the project file watcher and the migrator, plus `Exporter.exportToJSON`.
> `ProjectModel` is a singleton with no `fromDirectory` — the loaders are `readJSONFromDirectory`,
> `fromLocalStorage` and `fromJSON`. Whether it can load headlessly at all is a spike that ends in a
> written verdict, not a packaging task, and nothing is promising a `deploy` command before that
> verdict exists.
>
> **And a hole nobody had noticed until this issue reframed the problem as a lifecycle:** cloud
> functions have no headless door at all. The only deploy path is
> `WorkflowDocument.deployFunctions()`, reached from exactly two call sites, both of them UI. The
> MCP server already provisions a backend — so an agent can create the backend and cannot put a
> function on it. Any app with a backend, which is most apps worth deploying, cannot be shipped
> headlessly today. That is now a task of its own, independent of the deploy spike above.
>
> Related, and all in scope with this one:
> [#11](https://github.com/The-Low-Code-Foundation/NodeGX/issues/11) (the same core from the CI
> angle, asked in April 2025 and answered now),
> [#24](https://github.com/The-Low-Code-Foundation/NodeGX/issues/24),
> [#23](https://github.com/The-Low-Code-Foundation/NodeGX/issues/23),
> [#31](https://github.com/The-Low-Code-Foundation/NodeGX/issues/31),
> [#38](https://github.com/The-Low-Code-Foundation/NodeGX/issues/38).
>
> No release ruled for it, so no date. Thanks for the measurements — the `--preflight` and `fs`
> observations in particular saved the scoping sweep a day.

---

## 3. Cross-link comments — AC2

Four one-liners, so the work is legible from whichever issue someone lands on.
[#36](https://github.com/The-Low-Code-Foundation/NodeGX/issues/36) is the umbrella; the reply in §2
already links out to all of these, so these link back.

**On [#23](https://github.com/The-Low-Code-Foundation/NodeGX/issues/23):**

> In scope with #36 (the headless CLI). It is filed there deliberately rather than as a standalone
> export bug: behind the GUI a dropped binding is an annoyance the author may spot on the canvas; in
> a CI job that runs `nodegx export` there is nobody looking, and a report that says "translated
> with nothing left over" is the only thing anyone reads. The task is the report's silence as much
> as the dropped bindings.

**On [#24](https://github.com/The-Low-Code-Foundation/NodeGX/issues/24):**

> In scope with #36 (the headless CLI), and the fix is not the point — the gate is. Nothing on our
> side has ever compiled the exporter's output, which is why this reached you. `tsc --noEmit` over
> a freshly emitted app is going into the exporter's own suite so the next one is caught before a
> user finds it.
>
> One note on the diagnosis: this is structural rather than one character class. `plan.ts` makes
> *every* `Component Inputs` port an optional prop and the emitted `tsconfig.json` sets
> `strict: true`, so arithmetic on any component input is TS18048, not just the one you hit.

**On [#31](https://github.com/The-Low-Code-Foundation/NodeGX/issues/31):**

> This and #36's `serve` row are the same task, approached from opposite ends — you want it to stop
> listening on every interface, #36 wants `nodegx serve --host --token`. Both are satisfied by the
> same change: loopback by default, and sharing becomes an explicit decision that prints a URL and
> a token. Tracked with #36.

**On [#38](https://github.com/The-Low-Code-Foundation/NodeGX/issues/38):**

> In scope with #36 (the headless CLI), kept as a separate piece of work because it is severable
> from the rest — it is the step that closes the loop rather than part of the CLI: the agent
> authors on disk and the project appears in the editor the person already has open. Confirmed
> there is no route in today — no `--project` flag, no registered URI handler, and the MCP server
> never touches the launcher's recent-projects store.

---

## 4. The measurements behind the drafts

Taken 2026-09-09 at `cline-dev` HEAD `11b2d3a9`, in this session, before the text above was written.

| claim in the drafts | instrument | reading |
|---|---|---|
| no build/export CLI in the repo; four `bin`s and none builds an app | read `bin` out of all 22 `packages/*/package.json` | `nodegx-backend`, `nodegx-observe`, `noodl-mcp`, `noodl-preview` |
| `@nodegx/export` private, `main: src/index.ts`, no `bin` | same sweep | confirmed |
| two outbound deep imports, other 40 files clean | `grep -ran '\.\./\.\./\.\./' packages/nodegx-export/src/` | `parse/parseProject.ts:16`, `analyze/logicbuilder.ts:33`; the third hit is inside an emitted string literal in `emit/component.ts:6918` |
| 42 source files | `find packages/nodegx-export/src -name '*.ts' \| wc -l` | 42 (the issue says 45 recovered from the sourcemap; not worth correcting publicly) |
| `emit-app.ts` takes `<projectDir> <outDir>` and `--preflight`, writes nothing in that mode | read `scripts/emit-app.ts` header | confirmed, and the header states the no-write rule itself |
| `parseProject` on the `does-not-apply` side of the seam, with two other headless readers | read `projectLoadSeam.ts:117-150` | confirmed; the three are code export, MCP, template generation |
| `ProjectModel` 1,927 lines; `deployToFolder` takes one | `wc -l`, read `deployer.ts:1-50` | 1,927; `DeployToFolderOptions.project: ProjectModel`, `Exporter.exportToJSON(project, …)` at `deployer.ts:71` |
| #11 open since 2025-04-16, one comment (dishant, 2026-09-08) | `gh issue view 11` | confirmed — and the existing comment already cross-links #36 |
| #20 is an open, non-draft PR | `gh issue view 20 --json url` returns a `/pull/` URL | confirmed — ⚠️ `gh issue view` answers for a PR without saying so; the URL field is what gives it away |

🔴 **Not cited in any draft:** the `claude.ai/code/artifact` field-report URL from #36. Every claim
above points at a repo path a reader can check for themselves.
