# AIX-009 — As-Built Notes

**Status:** implemented, partially verified · **Date:** 2026-07-27 · **Branch:** `cline-dev` (worktree)

A project's `docs/` folder: owned by the human, tracked by git, read by the AI
before it authors anything.

---

## What shipped

| Piece | Where |
|---|---|
| Format + pure text transforms | `packages/noodl-editor/src/editor/src/models/ProjectDocs/docsText.ts` |
| Seed templates | `…/ProjectDocs/templates.ts` |
| Filesystem model | `…/ProjectDocs/ProjectDocsModel.ts` |
| Reviewed-write staging | `…/ProjectDocs/DocProposals.ts` |
| Boot wiring + sync provider | `…/ProjectDocs/install.ts`, `…/ProjectDocs/currentDocs.ts` |
| Context injection | `…/AiAssistant/authoring/ContextBuilder.ts` (3 new handouts) |
| Prompt blocks + system section | `…/AiAssistant/authoring/prompts/authoring.ts` |
| Pull-only tool | `…/AiAssistant/authoring/projectDocsTool.ts` |
| Panel | `…/views/panels/DocsPanel/`, registered in `router.setup.ts` |
| MCP tools | `packages/noodl-mcp/src/tools/docsTools.ts` |
| Markdown source view | `packages/noodl-core-ui/src/components/code-editor/{markdown-language.ts,MarkdownEditor.tsx}` |
| Specs | `packages/noodl-editor/tests/ai/project-docs.test.ts`, `packages/noodl-mcp/tests/docsTools.test.ts` |

## `ProjectDocsModel` and why it cannot clobber an external edit

The model is filesystem-backed with no manifest and no `project.json`
involvement. Its surface:

```
static forProject(project) → model | undefined     // undefined for an unsaved project
hasDocs()                                          // docs/CONVENTIONS.md exists — the single predicate
list()      → DocEntry[]                           // docs/**.md + the known files that are MISSING
read(rel)   → string | undefined
content()   → { conventions?, brief?, architecture? }
write(rel, text, { baseline })                     // atomic; refuses on drift
remove(rel) / seed()
startWatching() / stopWatching() / refresh()
```

Two mechanisms carry criterion 7, and neither is a lock:

1. **Optimistic concurrency on every write.** `write` takes the exact bytes the
   caller last saw. Before touching disk it re-reads and compares; on any
   difference it throws `DocsConflictError` and writes nothing. This is the same
   discipline as `ProjectStore.assertNoDrift` on the MCP side. The panel surfaces
   the conflict and offers a reload; it never silently wins.
2. **A poll, not a watcher.** `IFileSystem` exposes no watch API and no mtime —
   `FileStat` is `{ size }` and nothing else. Extending the cross-platform
   filesystem interface for this feature would have been a bigger change than
   the feature, so `refresh()` re-reads the handful of small doc files every 2s
   and compares **content**. Content comparison is exact where an mtime/size
   heuristic is not; a file edited to the same length would defeat the
   heuristic and does not defeat this.

Writes are temp-file + rename, so a crash mid-write leaves the previous doc
intact rather than a truncated one the agent then reads as gospel.

The panel prefers the boot-installed model instance over constructing its own,
so the panel and the authoring loop share one cache and one poll: a doc saved in
the panel is what the *next build* is told, immediately, not up to a poll later.

## Where the doc blocks land relative to AIX-007's cache breakpoints

AIX-007 spends three Anthropic breakpoints: end of the system prompt (which
covers `tools`, rendered ahead of `system`), end of the opening turn's reference
blocks (`cacheBoundary`), and end of the newest turn. The doc material touches
the first two, and all of it is on the **stable** side:

```
tools                        ← get_project_doc appended here, ONLY when docs/ARCHITECTURE.md exists
system prompt                ← PROJECT CONVENTIONS section: unconditional, phrased conditionally
                             ← breakpoint 1
--- PROJECT OVERVIEW ---
--- NODE CATALOG ---
--- STYLE VOCABULARY ---
--- PROJECT BRIEF ---        ← AIX-009
--- PROJECT CONVENTIONS ---  ← AIX-009
                             ← breakpoint 2 (cacheBoundary)
--- YOUR TASK ---            ← varies per request, unchanged
[update mode: --- CURRENT COMPONENT --- …]
```

Three ordering decisions worth recording:

- **Docs are appended after the existing blocks, not inserted before them.**
  Spec §3 only requires "in the cache-stable prefix, ahead of the varying
  request", and appending keeps the established prefix bytes byte-identical: a
  project that *gains* a `docs/` folder invalidates only the tail of its prefix
  rather than all of it, and a project without one produces turns byte-identical
  to before this task landed. A spec asserts both. (Arguably docs are *more*
  stable than the project overview, which changes every time a component is
  added, so a purist ordering would put them first. Not done: reordering the
  existing blocks was out of territory this batch, and it would invalidate every
  cached prefix in flight for a marginal gain.)
- **The system prompt section is unconditional and phrased conditionally**
  ("This project *may* ship its own written rules…"). A conditional section would
  make the system prompt vary by project, and the system prompt is the *first*
  cached block — the one whose stability is worth the most.
- **The tool list varies only on ARCHITECTURE.md's existence**, which is stable
  per project. Offering a tool that could only answer "there is no such file"
  would spend prefix bytes and invite a wasted turn.

`ARCHITECTURE.md` is pull-only for the same reason rather than for economy: if
the largest doc were injected on demand-by-task, the size of the cached prefix
would vary turn to turn within one project.

## Charging and truncation

Three new charged handouts, all through the existing `charge()`:
`project-conventions`, `project-brief`, `project-doc:ARCHITECTURE.md`. Caps are
per-source and applied *before* the shared budget (4,000 / 1,500 / 12,000
chars), so prose can never squeeze out component reads.

Truncation cuts at the last markdown heading that fits, falling back to the last
blank line and then the cap, and the injected text then *says* it was truncated,
names the file, and instructs the model to report the truncation in its answer.
A half-read rulebook that the model treats as complete is the failure this
format exists to prevent.

## Deviations from the spec

1. **`@codemirror/lang-markdown` was not added.** The spec names it as the
   task's only new dependency. Instead `markdown-language.ts` defines a small
   `StreamLanguage` mode using `@codemirror/language`, which is already a
   dependency. Reasoning: (a) `lang-markdown` pulls `@codemirror/lang-html`,
   `@lezer/markdown` and `@lezer/common` behind it — a full CommonMark parser
   for a panel the spec itself calls "deliberately not a markdown IDE"; (b) the
   package is not in the repo's `node_modules`, so adding it would leave every
   checkout unbuildable until someone ran `npm install` — the exact trap BAK-002
   hit with `nodemailer`. The result is that this task adds **no** new
   dependency. If richer markdown editing is ever wanted, swapping in
   `markdown()` is a one-line change at a single call site in `MarkdownEditor`.

2. **`get_project_doc` lives in its own module, not in `tools.ts`.**
   `AUTHORING_TOOLS` stays a module-level constant and the session composes
   `[...AUTHORING_TOOLS, ...docTools]`. This was partly territory (AIX-011 owns
   `tools.ts` this batch) but it is also the better shape: the tool must be
   *conditionally* offered to keep the cached tool block stable, which a constant
   array cannot express.

3. **The session reads docs from an installed provider rather than from the
   panel.** `AuthoringSessionOptions.projectDocs` exists and is what specs and
   the measurement harness use, but its default is `currentProjectDocs()` — a
   settable synchronous seam installed at boot by `router.setup.ts`, beside
   `startExplainTargetTracking()`. Partly territory (AIX-011 owns
   `AiAuthoringPanel`), partly correctness: `AuthoringSession` is constructed
   synchronously and must bundle headlessly, and reading `docs/` is asynchronous
   and Electron-side. A panel-mounted subscription would also mean the *first*
   build of a session never saw the project's conventions.

4. **A `seed_project_docs` MCP tool was added** beyond the spec's three. Without
   it an external agent has to hand-author three files from scratch to give a
   project docs, which is the wrong first experience for the flow AIX-010 is
   about to lean on.

5. **The deploy gate (criterion 8) is not implemented here, by design.** The
   spec explicitly rejects patching `copy.ts`'s `ignoreFiles`, and DEP-008 owns
   the general fix. Nothing in this branch touches
   `utils/compilation/build/**`. **Criterion 8 is a cross-task interlock to be
   verified after both branches merge**: deploy a project with a populated
   `docs/` and assert the output folder contains no `docs/` and no `.md` from it.

## Defect found in someone else's code (reported, not fixed)

`UndoActionGroup`'s constructor appends its `{ do, undo }` pair straight to its
action array and leaves the group's internal pointer at `0`. Its `undo()` loops
`for (i = ptr - 1; i >= 0; i--)`, so a group built that way **has nothing to
undo**. Every existing caller is saved by `pushAndDo`, which advances the
pointer by running `do()`.

`StyleTokensModel.setToken` / `addToken` do *not*: they apply the change first
and then call `UndoQueue.instance.push(new UndoActionGroup({ do, undo }))`.
By the reading above, undoing a design-token change is a no-op. **This is
unverified against the running editor** — it is inferred from the source plus a
reproduction in this task's own code, where the identical pattern silently
failed to undo until it was run. Worth someone with the editor open trying
⌘Z after changing a token. AIX-009's own accept path uses `group.push(...)`,
which advances the pointer without executing, and its undo is verified.

## Verification

**Run and green:**

- `packages/noodl-mcp` jest suite, 5 suites / 49 specs, including 10 new
  `docsTools` specs — criterion 5 end-to-end against a real project directory,
  including six shapes of path escape rejected on both read and write.
- `node build.mjs` in `noodl-mcp` — the editor `docsText` module bundles cleanly
  into the standalone artifact.
- `tsc -p packages/noodl-editor/tsconfig.json` and `tsconfig.tests.json` — clean.
- Two throwaway esbuild harnesses (AIX-002-measure recipe) executing the new
  code headlessly: **21 checks** over the text transforms, containment,
  charging, prompt ordering, the pull tool and session wiring; **13 checks**
  over `ProjectDocsModel` on a real temp directory and the proposal
  accept/reject/undo path, with `@noodl/platform-node`'s filesystem bound in.
  All pass. (The harnesses were deleted; their assertions are the two committed
  spec files.)
- `npm run colors`, `npm run lint:ci` — green. `npm run tsfixme` is **red at the
  base commit** (+60 `any`, all in `packages/noodl-runtime/**` from PLAT-003
  slice 13b); this task's files contribute zero.

**Could not verify here** — see the report's list; the headline items are the
Electron spec suite (`test:ci` runs the primary checkout through lerna), any
live-provider behaviour (criteria 1, 2 and the live half of 4), the panel in a
running editor, and criterion 8's cross-task interlock.
