# BLD-007 — Docs are open: any doc, declared by the doc itself

**Status:** 📋 not started · **Track A** · **independent — parallelisable** · closes **D9**

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

- [ ] Create `docs/uk-vat.md` with `inject: pull` → it appears in the authoring loop's tool list, and
      a build that mentions VAT fetches it. Measured on a real turn, not asserted.
- [ ] The same doc with `inject: always` → it is in the always-block, and the panel states the cost.
- [ ] A project with no user docs produces a **byte-identical request** to before this task landed.
      This is the cache-safety check and it is the one that matters.
- [ ] A doc with no front matter still works, and its file on disk is unmodified.
- [ ] `KNOWN_DOCS` no longer gates injection (`grep` shows it seeds templates only).
- [ ] Both clients (editor loop and `noodl-mcp`) resolve the same doc set from one module.

## Register

| # | Finding | State |
|---|---|---|
| | | |
