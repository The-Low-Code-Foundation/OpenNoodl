# SB-007 — it ships as a template

**Status: ✅ DONE s9 (2026-08-26).** The Site Builder is on the embedded shelf as
`embedded://site-builder`, category `site`, and its content is **generated from the
components the MCP door writes** rather than typed beside them.

- Generator: `scripts/generate-site-template.ts` (`npm run template:site-builder`)
- Builder: `packages/noodl-mcp/tests/sb007Template.ts`
- Artefact: `packages/noodl-editor/src/editor/src/models/template/templates/site-builder.content.json`
- Editor module: `…/templates/site-builder.template.ts`, one map line in `EmbeddedTemplateProvider`
- Specs: `noodl-mcp/tests/sb007Template.test.ts` (**22**), `noodl-editor/tests-unit/sb-007/site-template.test.ts` (**12**)

---

## 1. What the task actually was

The README says *package via FB-005's registry/provider mechanism — do not re-spec*.
That half was cheap and stayed cheap: FB-005 T3/T4 had already built the picker, the
registry, the `listing({})` failure reporting and the category vocabulary, all
committed. Shipping into it is a `*.template.ts` and one line in a `Map`.

The task was the other half, which the README does not name because nobody knew it was
there: **the nineteen components a person gets.**

Five sessions authored eighteen of them, and every one of those runs authored into
`packages/noodl-mcp/tests/fixtures/demo-app`. A template has no fixture.

---

## 2. 🔴 The component five sessions never authored

`demo-app` contains an `App` component holding a `Router` named `Main`. Nothing in
`sb004Components.ts`, `sb005Components.ts` or `sb006Components.ts` writes one —
`ROUTER = 'Main'` in SB-005 is a reference to the *fixture's* node, and eleven
`RouterNavigate` nodes across both panels point at it.

Authored into a clean skeleton, the door writes every page, reports success on every
one, and registers nothing. That is not a bug in the door: `pageRegistration.ts` says
so in its own header —

> A project with no router is **not** an error — single-screen apps exist, and refusing
> an otherwise-good write over a missing router would be this phase's mistake in the
> other direction.

— and `registrationSummary` returns `{}`, so `registeredPages` is simply **absent from
the payload**. There is no diagnostic, no warning, and no field to notice missing.

**Measured, as a one-edge arm** (`sb007Template.test.ts` §2). Two builds differing in a
single component, everything else held — same skeleton, same order, same door, same
eighteen sets:

| | components written | pages written | writes that succeeded | pages registered |
|---|---|---|---|---|
| **no `App`** | 18 | 5 | 5 | **0** |
| **with `App`** | 19 | 5 | 5 | **5**, start page `/Pages/Site` |

The control is the second row, and it is not optional: `registrations === {}` is equally
consistent with a builder that never populates that map, which is the same reading and
the opposite fix.

So `APP_NODES` lives in `sb007Template.ts` and is **authored through the same door** as
everything else. The one component the site cannot run without would otherwise have been
the only one no gate ever saw.

---

## 3. Why the template is generated

The alternative was a hand-written `site-builder.template.ts` holding the same nineteen
graphs. That makes a twin of four suites at once — three mutation-graded authoring
suites and one browser drive — and
`measure-the-artefact-before-believing-the-task-file` is exactly about what happens
next: the shipped template keeps working, the specs keep passing, and neither is about
the other.

So `npm run template:site-builder` authors all nineteen through the real MCP server,
reads the result back with **the editor's own `ProjectImporter`** (pure — types only, no
`ProjectModel`, no `NodeLibrary`, no Electron), and writes one JSON file.

**The drift gate is byte equality over the whole artefact**, and it is affordable because
regeneration is deterministic: the door's id remapping, its auto-placement and its page
registration are all functions of the authoring order. The three per-write fields that
are *not* — `created`, `modifiedBy`, and a component `id` — are dropped by
`toTemplateContent`, and that is the point rather than a tidy-up. Carrying them would
force the gate to compare *part* of the artefact, which is the check that passes while
the thing it guards rots.

Graded (M5): editing `NOT_FOUND_TEXT` in `sb006Components.ts` without regenerating
reddens with the line number and both strings, and names the command to run.

---

## 4. 🔴 F22 — the id rewrite missed a field, and no template had ever had one

**FOUND, MEASURED AND FIXED s9.**
`EmbeddedTemplateProvider.instantiateContent` regenerates every node id so two projects
from one template do not share UUIDs, then rewrites the connections that reference them.
It does **not** touch `graph.visualRoots`, which also names node ids.

It was never wrong before because it never had a population. `hello-world` is a
hand-written graph with no `visualRoots` at all, and it was the only embedded template
for the whole life of the class. Every component a v2 door writes carries one
(`reconstructLegacyComponent` restores it from `nodes.json`), and this template brought
**twelve** at once.

Measured **before** the fix, by installing the real template through the real provider:
all twelve dangling — `/App: visualRoots names app_root`, `/Pages/Site: visualRoots names
page`, and ten more.

⚠️ **The near-miss in the fix.** A pass that rewrote any string matching an old id would
have corrupted eight parameters in this one template: `as: 'section'`, `as: 'nav'`,
`as: 'header'` and five `flexDirection: 'row'` all collide with a node id, because the
ids a graph author picks and the HTML element names a `Group` takes come from the same
small vocabulary. The rewrite is structural: only fields declared to hold ids are
touched.

`lessonstarter.ts:341` already checks this class of defect on a different artefact, in
the same words — *"visualRoots names X, which is not there"*.

**What it cost in practice, stated rather than inflated**: `NodeGraphModel.fromJSON`
ignores `visualRoots` and `toJSON` re-derives it from the live roots
(`getVisualRootIds()`), so the editor heals it on the first save. The dangling ids are
what the *file* carries between install and that save, and every reader that takes the
field at face value — the exporter's round trip, `ContextBuilder`, `GraphSnapshot` —
reads them in that window.

---

## 5. Acceptance

1. ✅ **It is on the shelf with no network.** `embedded://site-builder`, first provider
   in `templateRegistry.providers`, drawn by `TemplateStepBody` with the rest.
2. ✅ **Its category is the platform's vocabulary, not prose.** `site`, in `0020`'s
   `project_template_category_known`. FB-005's `EMBEDDED_TEMPLATE_CATEGORIES` walks
   every embedded template, so this row is graded by their gate as well as ours.
3. ✅ **Installing writes a project that opens.** One `project.json`, nineteen
   components, a concrete `rootNodeId` resolved from `rootComponent` — the thing
   `instantiateContent` exists for, because `ProjectModel.fromJSON`'s name hint no-ops
   on the launcher's empty NodeLibrary.
4. ✅ **Two projects from it are two projects.** Disjoint node ids across 191 nodes, the
   shared template object unmutated, and — after F22 — every id-bearing field rewritten.
5. ✅ **The app has an entry point.** One `Router`, named what all eleven
   `RouterNavigate` nodes ask for, listing all five pages, opening on the public site.
6. ✅ **The artefact is closed under its own references.** Every instance node type,
   every repeater template, and every `RouterNavigate` target resolves *inside* the
   shipped project — the last of those against the router's `routes`, not merely against
   the component list.
7. ✅ **It is what the door writes today**, byte for byte, or it reddens.

---

## 6. 🔴 Two claims this template does not make

**It is not pre-rendered.** SSG skips dynamic `{param}` routes and the public site is a
catch-all at `{slug}`, so it would pre-render the four literal `admin/` paths and none of
the site. On the one template whose product is SEO. Recorded in SB-006 and stated again
in the template module's header so the next person selling it reads it there.

**It ships no backend policy** → **SB-015**. SB-004 §4's `security.json` — public read of
`Page`/`Section`, `role:admin` write, `ContactMessage` create `nobody` — is a
backend-side artefact, and a template is a project directory. A new project from this
template has all nineteen graphs that assume that policy and **no policy**. Every
publication claim SB-008 measured stands on a file this template cannot carry.

---

## 7. What is checked where, and what still is not

| claim | where | how |
|---|---|---|
| the artefact is the door's output | `sb007Template.test.ts` §1 | byte equality, regenerated in-process; graded M5 |
| a page can be written into no router | §2 | one-edge arm + control (18 vs 19 components) |
| the router is named, populated, ordered | §3 | over the shipped artefact; graded M2, M3 |
| reference closure | §4 | instance types, repeater templates, **routed** navigate targets; graded M4 |
| F14's tie is gone | §5 | segment counts over the shipped `urlPath`s, both panels in one router |
| on the shelf, category, install | `site-template.test.ts` §1–2 | through the real provider; graded M8 |
| every id-bearing field rewritten | §3 | measured red before the fix; graded M7 |

⬜ **Not done, stated so it is not assumed.**

- **Nothing has opened this template in the editor.** The install is measured through the
  provider with a mocked `@noodl/platform`; no `ProjectModel` has read the result and no
  canvas has drawn it. The same narrowing SB-005 acceptance 6 carries.
- **Nothing has deployed a project created from it.** SB-008 deployed the *authored* v2
  directory; the template's `project.json` is a different serialisation of the same
  graphs and the conversion between them (`ProjectImporter`) is exercised only by this
  generator.
- **Rule 4 (`points to` widens) is still UNMEASURED** — fourth session running.
