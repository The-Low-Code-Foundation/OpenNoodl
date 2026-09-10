# CMP-004 — The shelf exists, and nothing tells an agent it is there

🔴 **The MCP ships a 42-entry component library and a working install path. The authoring briefing
never mentioned it once.** A model following THE ORDER built every part from scratch, every time.

✅ **AC1 closed 2026-09-10** — the shelf is now step 3 of THE ORDER, in the doctrine channel. The
other four ACs are open, and AC1 alone does not make the loop compound: the shelf is still
prefab-sized (AC3) and still one-way (AC4).

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

**🔴 The path is one-way.** `install_prefab` brings entries in. Nothing takes a component out of a
project and offers it to the shelf, so the community library can only grow by someone hand-authoring
a `library.json` in the NodeGX repo.

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

**AC4 — the path is two-way.** A tool that takes a component from the bound project and produces a
shelf-shaped entry for it. Measured by round trip: export a component from project A, install it
into project B, and it renders.

**AC5 — an agent actually reaches for it.** In the CMP-002 graded build, the model calls
`list_library` before authoring its first component. 🔴 **Grade this on the tool-call log, not on the
output** — a page that happens to look right proves nothing about whether the shelf was consulted.

## 5. What this does not own

Whether any *particular* prefab is good. `library/prefabs/AUDIT.md` already lists six product
defects found inside them, owner NONE.
