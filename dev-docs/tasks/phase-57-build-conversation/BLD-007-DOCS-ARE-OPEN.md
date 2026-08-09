# BLD-007 — Docs are open: any doc, declared by the doc itself

**Status:** ✅ **merged and fully gated; nothing driven live** · **Track A** · **independent — parallelisable** ·
closes **D9**

Built 2026-08-08 in a worktree, beside a concurrent phase-56 QA session holding the dev editor — so
every claim written here on that date was a jest/tsc number and **not one of them was a live
measurement**. **Merged to `cline-dev` 2026-08-09** and the Jasmine half finally run.

⚠️ **Running it found a real regression this task shipped, and only `test:ci` could have.**
`tests/ai/project-docs.test.ts`'s 7 new specs all passed; **two pre-existing AIX-009 specs failed** —
`2581 specs, 8 failures` against a `2574 / 6` baseline. `dispatchProjectDocTool` had taken the doc
set as a **third parameter defaulting to `{}`**, giving "what docs exist" two sources that could
disagree. Every pre-BLD-007 call site kept compiling, silently resolved against the empty set, and
answered *"this project has no fetchable documents"* for a project whose context was holding an
ARCHITECTURE.md — **no type error, and no symptom until a real turn asks for a doc.** Fixed by
reading the set from the public `context.docs`, which is built once per session from the same
snapshot `projectDocTools` is handed; the parameter and `AuthoringSession`'s redundant held field are
gone. Register **B7**. **Now `2582 specs, 6 failures`** — the inherited six, confirmed by name.

**The general lesson, and it is the phase-56 lesson again:** a gate that has never been *run* is not
a gate. This one was typechecked, unit-tested at 21/21, and wrong.

## The defect, measured

**A doc you write yourself can never reach the builder.** Richard's example — a document explaining
tax rates in his country, so the AI builder gets it right on the next component — can be created,
will be listed in the Docs panel, will render, and **will be silently ignored forever**.

The format says so outright
([docsText.ts:9-12](../../../packages/noodl-editor/src/editor/src/models/ProjectDocs/docsText.ts#L9)):

> *"The format has no manifest: git owns `docs/`, a text editor is a first-class way to work on it,
> and exactly four paths are known to the system. **Anything else under `docs/` is carried and
> editable but never injected.**"*

`KNOWN_DOCS` is a three-entry constant
([:37-60](../../../packages/noodl-editor/src/editor/src/models/ProjectDocs/docsText.ts#L37)), and the
retrieval tool's parameter is an enum with **one value** that replies with a scolding string to
anything else
([projectDocsTool.ts:43-56](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/projectDocsTool.ts#L43),
[:70-78](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/projectDocsTool.ts#L70)).

## Why it was closed — and why the fix cannot be "inject everything"

The closure is not arbitrary. `projectDocTools` is offered *only* when the project has an
ARCHITECTURE.md, specifically so `AUTHORING_TOOLS` stays a constant and the AIX-007 cache-stable
prefix is byte-identical across every turn of every session
([projectDocsTool.ts:9-16](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/projectDocsTool.ts#L9)).
And `DOC_CAPS` caps each source *before* it reaches the shared budget rather than trusting the budget
to notice ([docsText.ts:62-77](../../../packages/noodl-editor/src/editor/src/models/ProjectDocs/docsText.ts#L62)).

Both properties must survive this task.

## Build

1. **A doc declares its own injection, in its own front matter.**

   ```markdown
   ---
   title:  UK VAT rules
   inject: pull            # pull (default) | always
   when:   tax, VAT, pricing, invoices
   ---
   ```

   - `inject: pull` — the doc appears in the retrieval tool's list with its title and `when` hints,
     fetched on the turn it becomes relevant. **The always-block is untouched, so the cached prefix
     is untouched.**
   - `inject: always` — appended to the always-block. The user is opting into a real per-turn cost,
     so the Docs panel **states it**: *"adds about 600 tokens to every turn in this project."*
2. **`get_project_doc`'s enum becomes the discovered list.** One value → the project's actual
   pull-injectable docs, each with its title and hints in the description.
   - ⚠️ **The tool definition is part of the cached prefix** (on Anthropic, `tools` renders ahead of
     `system`). It is now *project*-dependent rather than constant, which is fine — it is stable
     within a session — **but it must be stable within a session.** Adding a doc mid-session
     invalidates the prefix. Decide and document: rebuild the tool list at session start only, and
     say so in the module note.
3. **Per-doc caps.** Extend the `DOC_CAPS` discipline to discovered docs with a sane default; reuse
   `truncateDoc`'s heading-boundary cut ([docsText.ts:96+](../../../packages/noodl-editor/src/editor/src/models/ProjectDocs/docsText.ts#L96))
   rather than writing a second truncator. A silently short user doc is exactly the failure the
   format exists to avoid.
4. **`KNOWN_DOCS` becomes a seed set, not a vocabulary.** BRIEF, ARCHITECTURE and CONVENTIONS ship as
   three ordinary documents carrying `always` / `pull` / `always` front matter. The special-casing in
   code goes; the templates stay.
   - ⚠️ **Existing projects have no front matter.** A doc without it takes the default for its path
     if it is one of the three known ones, else `pull`. **Never rewrite a user's file to add front
     matter without asking** — `ProjectDocsModel` is written defensively about external edits for
     good reason ([ProjectDocsModel.ts:5-16](../../../packages/noodl-editor/src/editor/src/models/ProjectDocs/ProjectDocsModel.ts#L5)).
5. **"New doc" in the Docs panel** — name, purpose, injection mode — seeded with a short template
   that explains what a good context doc contains.
6. **The MCP side gets the same list.** `list_project_docs` / `get_project_doc` on `noodl-mcp` must
   see the same set from the same module — the AAQ-005 one-substrate rule. ⚠️ Verify what those
   tools read today before assuming they share a module with the editor.

## Acceptance

| # | Criterion | State |
|---|---|---|
| 1 | `docs/uk-vat.md` with `inject: pull` appears in the tool list, and a build that mentions VAT fetches it — **measured on a real turn** | ⬜ **open** — the mechanism is built and gated offline (`projectDocTools` widens the enum, `dispatchProjectDocTool` routes it); the *turn* is a live measurement nobody has taken |
| 2 | The same doc with `inject: always` lands in the always-block, and the panel states the cost | 🟡 built — `ContextBuilder.projectAlwaysDocs()` charges it, `docBlocks()` renders it last, and the panel states tokens per turn on both the new-doc form and the selected doc. **Not driven** |
| 3 | A project with no user docs produces a **byte-identical request** | ✅ for the part that can be proven offline, and it is the sharp part: the tool definition is compared against a recorded pre-BLD-007 golden, and `content()` returns no `extra` field at all rather than an empty array. The whole-request comparison is still a live/harness check |
| 4 | A doc with no front matter still works, and its file on disk is unmodified | ✅ `never rewrites the file it read` **run and passing** under `test:ci`, 2026-08-09 |
| 5 | `KNOWN_DOCS` no longer gates injection | ✅ `grep` shows it seeds templates, supplies historical per-path defaults, and is consulted by nothing that decides whether a doc is read |
| 6 | Both clients resolve the same doc set from one module | ✅ `noodl-mcp` imports `describeDoc` through `editor-deps` and reports the injection **each file declared**; 2 new specs, suite 227 green |

**Gates at build time (2026-08-08, worktree):** `tests-unit` 887/887 (21 new, `tests-unit/bld-007/`) ·
`noodl-mcp` 227 pass / 45 skip (2 new) · `tsc -p noodl-editor` clean ·
`tsc -p noodl-editor/tsconfig.tests.json` clean · `noodl-mcp` tsc has **6 inherited errors** in
`interfaceGate`/`stagingDiagnostics` (`ToolCallResult.text`), identical on the untouched primary
checkout — not this task's.

**Gates on `cline-dev` after the merge (2026-08-09), with BLD-012 also merged:**
**`Jasmine: 2582 specs, 6 failures`** — the inherited six confirmed **by name** (4 `AIX-006 style
vocabulary`, 2 `AI model registry`), not by arithmetic · `test:main` **84 suites / 1125 tests**
(was 80 / 1085; +2 suites and +21 from this task) · `noodl-mcp` **291 pass** ·
`typecheck:editor` + `typecheck:editor-tests` clean · `catalog:check`, `cloud-library:check`,
`catalog:merge:check`, `library:check` all green.

⚠️ **The first run of that suite was `2581 / 8`.** See register **B7** — the two extra failures were
this task's, and nothing else in the gate set could see them.

## Register

| # | Finding | State |
|---|---|---|
| **B1** | **`inject` needed a third state nobody specified: a value the format cannot use.** `inject: sometimes` had to be neither obeyed nor silently dropped — dropping it reproduces D9 exactly, one layer up, because the user's declaration is again carried and ignored. `ParsedDoc.problems` carries it to the panel. | ✅ built, spec'd |
| **B2** | **`ProjectDocsContent` had to stay a three-field object.** Folding the seed docs into a list would have been tidier and would have touched `ContextBuilder`, `collectSources`, `review/types`, `PlanningSession` and `AuthoringSession` — and made "byte-identical for an existing project" a code path to remember rather than a property of the shape. `extra?:` is additive on purpose. | ✅ decided |
| **B3** | ⚠️ **A seed doc that overrides its own default has to leave its named field.** `docs/ARCHITECTURE.md` declaring `inject: always` cannot stay in `content.architecture` — that field *is* the pull route, and `projectDocTools` reads it to decide the tool exists. It travels through `extra` instead. This is the mechanism that makes `KNOWN_DOCS` a seed set rather than a vocabulary, and it is not obvious from the task text. | ✅ built |
| **B4** | **The external-edit poll could not see a new file.** `refresh()` re-read `cache.keys()` + `KNOWN_DOCS`, so a doc written in VS Code — the way a user actually writes one — produced no change event and never reached the snapshot. The feature would have appeared broken for the exact workflow it was built for. Found by reading `refresh()`, not by a failing test. | ✅ fixed (one directory listing per poll) |
| **B5** | **The tool definition must be built once per session, and now it also has to be *ordered* once.** `discover()` sorts by path: the definition lives in the cached prefix, and a filesystem returning two files in a different order between sessions would invalidate it for nothing. | ✅ built |
| **B6** | ⚠️ **`injection: 'default'` was a second word for `always`**, and it was on the MCP wire (`DocRow.injection`). Renamed to one vocabulary across both clients; one MCP spec asserted the old string and was updated. Anything outside this repo reading that field sees a changed value. | ✅ changed deliberately |
| **B7** | 🔴 **This task shipped a regression, and the unrun gate is the only thing that would have caught it.** `dispatchProjectDocTool` took the doc set as a **third parameter defaulting to `{}`**, so "what docs exist" had two sources. The one real caller passed it; **every other call site kept compiling and silently resolved against the empty set**, answering *"this project has no fetchable documents"* for a project whose own context was holding an ARCHITECTURE.md. Two pre-existing AIX-009 specs caught it the first time `test:ci` ran — `2581 / 8` against a `2574 / 6` baseline. ⚠️ **`tsc` and 21/21 unit specs were both green while this was live**, because a defaulted parameter is exactly the shape a type system cannot object to. Fixed by reading `context.docs` (public, built once per session from the same snapshot `projectDocTools` gets); the parameter and `AuthoringSession.projectDocs` are gone, so the two sources cannot disagree again. One spec asserting the superseded scolding string was repointed at the new contract, and the empty-context case gained the regression spec it never had. | ✅ fixed 2026-08-09 |
