# CMP-004 — The shelf exists, and nothing tells an agent it is there

🔴 **The MCP ships a 42-entry component library and a working install path. The authoring briefing
never mentioned it once.** A model following THE ORDER built every part from scratch, every time.

✅ **AC1 closed 2026-09-10** — the shelf is step 3 of THE ORDER, in the doctrine channel.
✅ **AC4 closed 2026-09-10 (session 3)** — the path is two-way, and step 4 of THE ORDER says so.
**AC2, AC3 and AC5 are open.** The shelf is still prefab-sized (AC3, blocked on Richard's CSV) and
still has no text query (AC2), and no graded build has yet shown a model reaching for it (AC5).

## 1. The person sentence

> "It becomes a kind of community library of 'useful nodes', for the builder and the MCP… It's like
> choosing Tailwind CSS instead of writing the styles from scratch." — Richard, 2026-09-09

**Before an agent builds a part, it looks to see whether the community already built it — and when
it builds something good, that part can go back on the shelf for the next person.**

## 2. What was measured, 2026-09-09

**The shelf is real and it works.** `libraryTools.ts` registers three tools — `list_library` (:131),
`get_library_entry` (:159), `install_prefab` (:203) — over 42 entries under `library/prefabs/`,
indexed by `libraryShelf.ts`. `install_prefab` merges components, styles, variants, assets and code
modules, and never overwrites.

**🔴 Nothing in the authoring path pointed at it (fixed by AC1).** `grep -nai "library|shelf|install_prefab|reuse|existing component" src/instructions.ts`
returns **nothing**. The resident briefing's THE ORDER runs: the look → the screen list → the
component tree → leaves → sections → the page → backends. A model that follows it faithfully never
learns the shelf exists. **This is writing the styles from scratch with Tailwind sitting in
`node_modules`.**

**🔴 The shelf's unit is too big for the thing most worth sharing.** Every entry is a whole prefab —
`Accordion`, `App Shell`, `Auth Pages`, `Card & Card Grid`. There is no entry granularity for the
one-node utility that CMP-003 measured as the most reused thing in a real app: LearnBook's
`Format full name` (9×), `Generate Google icon object` (9×), `Is Trainer check` (9×). A builder who
writes a good `Sanitise email` has nowhere to put it.

**🔴 The path is one-way (fixed by AC4).** `install_prefab` brings entries in. Nothing takes a
component out of a project and offers it to the shelf, so the community library can only grow by
someone hand-authoring a `library.json` in the NodeGX repo. ✅ `export_to_library` is now the way
back out, and it writes into the same `library/prefabs/<slug>/` tree the checkout already indexes —
so a part exported here is a part `npm run library:check` and `library:build` already know how to
gate and publish. **It only ever creates a directory that does not exist and refuses when one does**:
the library tree has many editors at once, and a half-overwritten entry would show up on everybody's
shelf as a real one.

## 3. Why this is the highest-leverage item in the phase

CMP-001 makes each agent-built component better. CMP-004 makes **every** agent inherit the best
component anyone has built. The prefabs already carry nine patterns an agent cannot currently reach
for; every app Richard or the community builds adds more. A shelf that is read before authoring and
written to after it is the mechanism that makes phase 85 compound instead of repeat.

## 4. Acceptance criteria

**AC1 — the shelf is in the order.** ✅ **DONE, 2026-09-10.** It rides in `get_project_info`'s
`designDoctrine`, as **step 3** of §"The order" — after "plan the components", before "Only then
author them" — naming `list_library`, `get_library_entry({slug})` and `install_prefab({slug})`, and
saying that installing never overwrites, because a model that thinks it might will not install.
The section heading now reads *"the look, then the screens, then the shelf, then the components"*.

Graded over the wire in `packages/noodl-mcp/tests/phase85Doctrine.test.ts` — presence, POSITION
(after the screens, before authoring), the never-overwrites guarantee, and that the resident
briefing did not grow to say it. The budget gate reports **8,275 / 8,280** after the change, which
is where it was before: the doctrine channel is outside it, which is the whole reason this text
lives there. Same division of labour SBR-013 settled — `instructions` carries the order, the
doctrine carries the reasons and the tool names.

**AC2 — the shelf is searchable by what a part does.** `list_library` takes `type` and an exact
`tag` today. An agent asking "is there a date formatter?" has no query that answers. Add a text
query over label + description + component names, or state in writing why tags are enough.

**AC3 — parts, not just prefabs.** The shelf indexes single-component entries, with the CMP-003
utilities as the seed set. Richard has a CSV of community-contributed logic and visual nodes —
**that is the seed corpus, and AC3 is not done until it is on the shelf and installable.**

**AC4 — the path is two-way.** ✅ **DONE, 2026-09-10 (session 3).** `export_to_library({component,
slug, label, description, tags?, version?, readme?})` — a fourth tool in the `explore` group, write-
gated, `src/libraryExport.ts` plus a registration in `libraryTools.ts`.

**What it carries, and why each one is on the round-trip path.** A component that renders in project
A and not in project B fails for one of four reasons, so all four travel with the entry:

| | |
|---|---|
| the components it places | the **transitive closure**, via the validator's own `isComponentRef`/`refToPath`. An entry shipping only the leaf installs a page whose middle is a missing type |
| named colours, text styles, variants | only the ones a node actually names — an entry that drags a whole project's palette onto the shelf is one nobody can install without arguing with it |
| assets | a parameter naming a file inside the project (`backgroundImage: "images/logo.svg"`) |
| code modules | a type `getNodeTypeSummary` reports as `providedBy: 'project-kit'` is a type project B does not have, so the `noodl_modules` directory travels too |

🔴 **`var(--token)` values are deliberately NOT rewritten.** Measured on `templates/landing-pages`:
~180 colour parameters, **every one** a `var(--…)` and not a single named colour — the modern
authored corpus is tokens end to end. A token resolves against the HOST project, so leaving it is
exactly what makes an installed part wear project B's look instead of dragging project A's palette
along. That is the Tailwind sentence in §1, made mechanical. The tokens a part depends on are
reported and written into its README; a **literal hex** is the opposite case and is reported as a
warning per node and parameter, because it survives the trip and then ignores the host theme
forever. Nothing rewrites the author's graph either way.

**The conversion has one source of truth in each direction.** An entry ships the LEGACY monolithic
`project/project.json` (`install_prefab` refuses anything else in so many words, and all 43 shipped
entries are legacy), so the export runs `reconstructLegacyComponent` — the editor's own v2→legacy
reader, the exact inverse of the `buildComponentV2Files` the install path runs coming back.

**Graded by the round trip the AC asks for**, in `packages/noodl-mcp/tests/cmp004RoundTrip.test.ts`
— **14 specs**. Project A is the demo fixture given all four outside references plus one literal hex
and one token; project B is the same fixture *with those components deleted*, so "did it arrive?" is
unambiguous. The entry is never read back to decide whether the export worked: it is handed to
`install_prefab` in project B and the answer comes from `get_component`, `validate_project` and B's
own `nodegx.styles.json`.

✅ **Negative control run, and recorded** — with the closure walk disabled, **9 of the 14 go red**,
including the install, the graph comparison and the `validate_project` absence check. The absence
assertion has a known-firing signal beside it rather than passing on an empty list.

**AC4b — and the doctrine says so.** A two-way path nobody is told about is CMP-004's own defect a
second time: the tool exists and the loop still does not compound. `DESIGN_DOCTRINE_MD` gained
**step 4 of THE ORDER** ("when you have built something good, put it back") plus the paragraph
saying why — *a shelf that is only ever read is a fixed set of parts that ages*. Graded over the
wire in `phase85Doctrine.test.ts`: the tool name, the position (**after** authoring, not before —
it is what you do with a part, not a step before one exists), the token rule, and that the resident
briefing did not grow to say it. **The budget gate reads 8,275 / 8,280 — unchanged**, and the
seventh tool in `explore` cost zero resident tokens by LBR-008's own measurement ("6 tools" and
"7 tools" are the same string length).

**AC5 — an agent actually reaches for it.** In the CMP-002 graded build, the model calls
`list_library` before authoring its first component. 🔴 **Grade this on the tool-call log, not on the
output** — a page that happens to look right proves nothing about whether the shelf was consulted.

## 5. What this does not own

Whether any *particular* prefab is good. `library/prefabs/AUDIT.md` already lists six product
defects found inside them, owner NONE.
