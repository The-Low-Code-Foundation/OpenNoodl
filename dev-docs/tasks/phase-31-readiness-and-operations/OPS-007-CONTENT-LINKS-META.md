# OPS-007: Content, Links & Meta as Derived Panels

## Metadata

| Field | Value |
|-------|-------|
| **ID** | OPS-007 |
| **Phase** | Phase 31 — Readiness & Operations (Track P) |
| **Tier** | 3 — the sweep |
| **Priority** | 🟡 Medium — no gate depends on it; it is the most-used thing in the phase |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 1–1.5 wks |
| **Prerequisites** | none |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** |

## Objective

Every visible string, every outbound URL, and every page's meta in one editable list each — derived
from the graph, not from a convention file anyone has to maintain.

## Background

The [frontend-tweaker chapter](../../../../ai-coding-docs/docs/part-5/frontend-tweaker.md) identifies
four things people tweak constantly after a build — styles, text, links, SEO — and solves each with a
convention file the AI is instructed to keep current (`@tweak` CSS annotations, i18n JSON, `links.json`,
`meta.json`), plus a dev panel that reads them.

**NodeGX already solves the first one.** The property editor and UIX-001's design tokens are the
`@tweak` panel, built properly.

The other three do not exist here at all, and the chapter's framing of why they matter is the part to
take seriously — it is not about translation:

> "i18next isn't just for translation — it's a text management architecture."

The chapter's rule 7 ("when adding a new page or component, update the relevant convention files in the
same task") is the tell that this design is a workaround. In NodeGX there is nothing to update: the
strings are in the graph. **Derive the list; do not ask anyone to maintain it.**

## Current State

| Piece | State |
|---|---|
| Styles | property editor + `DesignTokenPanel` (UIX-001) — the chapter's styles half, done |
| Text | authored inline on Text/Button/Label node properties; no aggregate view exists |
| Links | authored inline on navigation and external-link nodes; no aggregate view |
| Page meta | RUN-002 established that one artifact serves SSR+SSG; per-route meta is not an editable surface |
| Search | `views/panels/search/` — finds nodes, not content |

## Desired State

### 1. Content panel

Every user-visible string in the project, grouped by component, each editable in place. Editing writes
back to the node property it came from — no parallel store, no sync problem, no drift.

- **Interpolated values are protected.** A string carrying a binding renders the bound part as a
  non-editable chip, the way the chapter protects `{{name}}`. Deleting a binding by editing text is the
  obvious way this feature corrupts a project.
- **Filter by unreached components** once RCK-001 exists — "these strings are on screens no journey
  visits" is a genuinely useful editorial view.
- Strings that come from data rather than from the graph are listed as such and are not editable here.

### 2. Links panel

Every outbound URL and every internal navigation target, in one list, each editable. This is the one
that gets used most: a Calendly link changes, a social profile moves, a terms page gets a new path.

Also reports **dead internal targets** — a navigation node pointing at a component that no longer
exists. That check is free once the list is derived and it is a real defect class.

### 3. Meta panel

Per-route title, description and OG image, with the character counts the chapter recommends (the
"Google truncated it" cycle is real and the count prevents it). Feeds SSR/SSG output through RUN-002's
single artifact.

### 4. i18n is the export shape, not the storage shape

Do **not** move project strings into locale files as the storage format. That would swap a derived list
for a convention file — the exact inversion this phase exists to avoid.

Instead: *export* the content list as locale JSON, and accept a translated file back, mapping by the
same derived keys. Monolingual projects get the panel and never see a locale file. Multilingual
projects get the architecture without anyone having authored keys by hand.

### 5. The AI can read and write all three

`content_list`, `content_set`, `links_list`, `links_set`, `meta_get`, `meta_set` on the MCP server. "Change
every mention of the old product name" is then one operation instead of a graph crawl, and AIX-011's
doc-authoring work has a precedent for the write path.

## Implementation Steps

1. Derivation: which node properties are user-visible text, which are URLs. Put the rule in the node
   catalog (SUB-004/SUB-005) rather than in a list in the panel, so a new node type is covered
   automatically.
2. Content panel with in-place editing and binding chips.
3. Links panel + dead-target detection.
4. Meta panel + character counts + SSR/SSG wiring.
5. Locale export/import over the derived keys.
6. MCP tools.
7. **Live pass**: rename a product across a project from the Content panel and confirm nothing else
   changed; break a navigation target and confirm the Links panel reports it.

## Success Criteria

- [ ] Every visible string in the QA fixture appears in the Content panel, and editing writes to the
      right node property.
- [ ] A string containing a binding cannot have its binding destroyed by text editing.
- [ ] The Links panel lists every outbound and internal target and flags dead internal ones.
- [ ] Meta edits reach both SSR and SSG output.
- [ ] Locale export/import round-trips without anyone authoring a key.
- [ ] Derivation is catalog-driven — adding a node type with a text port surfaces it with no panel
      change.
- [ ] MCP tools list and set all three.

## Out of Scope

- **A styles tweaker.** It exists (property editor + design tokens).
- **Runtime language switching.** Export/import shape only; a language-switcher node is a library
  question for LIB-003, not this task.
- **Rich text editing.** Plain strings and bindings. A WYSIWYG here is a different product.
- **Content versioning or approval workflow.** No CMS.

## Traps

- **Binding chips are the correctness risk.** NDA-015's explicit-binding work and the binding chip in
  UIX-003 are prior art — reuse rather than inventing a second representation that can disagree.
- **Do not create a parallel string store.** The moment content lives in two places, one of them is
  wrong. Write back to the node property, always.
- **Derived keys must be stable across edits.** If a key changes when a component is renamed, every
  imported translation detaches. Decide the key derivation carefully and write it down — this is the
  one part of the task that is expensive to change later.
- **`typeName ≠ displayName`** (AIX-011). Deriving "is this a text port" from a display name will work
  in testing and fail on the library's long tail.
- **Some text ports are dynamic** (`sendDynamicPorts` carries no description — NDA-005). They will be
  invisible to a catalog-driven derivation. Report the gap rather than pretending the list is complete.
</content>
