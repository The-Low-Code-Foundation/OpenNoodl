# CMP-004 — The shelf exists, and nothing tells an agent it is there

🔴 **The MCP ships a component library and a working install path. The authoring briefing never
mentioned it once.** A model following THE ORDER built every part from scratch, every time.
⚠️ §2 below counted **42 entries** on 2026-09-09; re-counted 2026-09-10 it is **72** — the shelf
grows, so re-count it rather than quoting this file.

✅ **AC1 closed 2026-09-10** — the shelf is step 3 of THE ORDER, in the doctrine channel.
✅ **AC4 closed 2026-09-10 (session 3)** — the path is two-way, and step 4 of THE ORDER says so.
✅ **AC2 closed 2026-09-10 (session 4)** — `list_library({query})`, and the doctrine tells an agent
to ask it by name for each part it was about to build.
**AC3 and AC5 are open.** The shelf is still prefab-sized
(AC3 — 🔴 **no longer blocked**; the CSV was already in the repo and reading it changed what AC3
asks for, see below), and no graded build has yet shown a model reaching for it (AC5).

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

**AC2 — the shelf is searchable by what a part does.** ✅ **DONE, 2026-09-10 (session 4).**
`list_library` takes a `query`, and the doctrine's step 3 now tells an agent to **ask it for each
part it was about to build** rather than to browse 72 rows.

### 🔴 The measurement that settled "or state why tags are enough": they are not

The AC offered a way out — argue that tags suffice. Over the shelf as it actually is, they do not,
and the proof is a single pair of strings:

| | |
|---|---|
| entries on the shelf | **72** (the task's own §2 said 42 — it has grown) |
| distinct tags | **22** |
| entries tagged `UI` | **50** — 69% of the shelf under one tag |
| tags with exactly one member | **7** (`Animation`, `Custom nodes`, `Localization`, `Pages`, `Payments`, `Service`, `Utilities`) |
| 🔴 entries tagged **`Utility`** | **8** |
| 🔴 entries tagged **`Utilities`** | **1** — `intl-format`, **the only formatting entry there is** |

**`list_library({tag: "Utility"})` — the obvious query, and the only kind the shelf could answer —
returns eight rows and excludes the one entry that formats things.** A vocabulary typed by hand
over years has a singular and a plural on opposite sides of the one question this AC was written
about. Asserted in `tests/cmp004LibraryQuery.test.ts` against the real `library/`, because it is
the case rather than an illustration of it.

### 🔴 And the shelf ALREADY ANSWERS the AC's worked example — nobody could ask it

`intl-format` is a module of **locale-aware formatting nodes**: `Relative Time` ("3 hours ago",
with an auto-refresh interval), `Format Number`, `Format List`, `Pluralize`, every one of them with
a Locale input. It has been on the shelf the whole time.

⚠️ **This phase walked past it twice in one day.** CMP-005 §1 lists *"relative time — no token"* as
an open gap in the date formatter and §4 rules it out of scope as *"a node with a clock in it"* —
which is exactly right, and exactly the node `intl-format` ships. The reason nobody found it is the
reason this AC exists: its node names are written in one place, its **description**, and the shelf
had no query that read descriptions. **The shelf's problem was never that it was empty.**

### What was built

- `libraryShelf.ts` — `queryTerms` + `scoreEntry`, and `listShelf` takes `query`. Fields are
  weighted (label/slug 4, tag/component 3, description 1), terms are ORed, rows come back best
  first carrying `matchedTerms` and `matchedIn` so a model can judge a row instead of trusting it.
- Matching is **word-prefix, both directions, four characters in, with at most four of tail**. The
  bidirectional part is what makes *"date formatter"* find a label saying *"Format"* — a substring
  test does not, and fails silently. 🔴 **The tail bound was earned by a measured false positive:**
  without it the tag `Form` matched the term `formatter`, and since a tag outscores a description,
  `date-picker` came back as the best answer to *"is there a date formatter?"*, beating the entry
  that formats dates. A prefix rule with no bound turns every four-letter word into a wildcard.
- Component names are read (a `project.json` parse per entry, 3 MB and ~25 ms over the whole shelf,
  measured) **only on a query call**, so the index stays an index.
- The empty answer is a real answer: the note names `export_to_library` and says to build the part
  and put it back. Silence reads as "the shelf has no opinion" and sends the agent to build anyway.

⚠️ **Deliberately not `find_tools`' matcher**, which the handoff asked to check first. That one is a
substring test over a tool group's id, title and keywords and *pointedly refuses to search the
prose* — its own comment explains why: a group's purpose is a sentence whose incidental nouns
duplicate the tool names, so searching it would collapse the deferral. Here the description is the
only place what a part does is written down. Same word, opposite instrument.

**Graded by** `tests/cmp004LibraryQuery.test.ts` (19 specs, over the real library) and seven new
assertions in `tests/phase85Doctrine.test.ts` (24 total), four of them over the wire.

🔴 **A control caught a spec that graded nothing.** The first version of "matches a component name"
picked a distinctive word out of a component name and asserted the entry came back — and it came
back off its *label*. Blanking the component list turned **nothing** red. Rewritten around
`filters`, whose components include `/Filters/Date Filter` while the word `date` appears nowhere in
its label, slug, tags or description: `matchedIn` is asserted to be exactly `['component']`, and
the control now turns it red. See [[assert-an-absence-with-a-known-firing-signal-beside-it]].

**AC3 — parts, not just prefabs.** The shelf indexes single-component entries.

🔴 **UNBLOCKED, and the premise was wrong — 2026-09-10 (s3), on Richard's correction.** Two sessions
carried *"blocked on Richard's CSV, ask for it"*. **The CSV has been in the repo the whole time**:
`dev-docs/tasks/phase-86-the-community-already-built-it/corpus/components/Components.csv`, 29 rows
(name, use case, creator credit, notes), committed at `121fd5c5f` — **thirty-four minutes before
session 2 wrote the blocker down.** See [[a-none-owned-blocker-is-the-one-most-likely-already-fixed]]:
re-measure a blocker before inheriting it.

⚠️ **And reading it kills the AC as written.** The CSV is 29 **prefab-scale** community components —
a WebRTC recorder, TinyMCE, AG Grid, a signup template. It is not a corpus of one-node logic
utilities. P86's COM-005 already measured it against the shelf: **8 of the 29 are covered by an
existing entry** (Dropzone→`file-upload`, Tiptap/TinyMCE→`rich-text-editor`, AG Grid→`table`,
Better Markdown→`markdown`, Check window width→`media-query`, CSV Download→`file-download`, Signup &
Login→`auth-pages`, Email validator→`form-validation`) and exactly **three gaps** remain — audio
recording, video recording, masonry grid.

✅ **So the boundary with P86 is settled, and it is P86's own wording** (COM-003 §7: *"This task
produces examples; COM-004/005 produce library entries; the shelf that carries them is P85's"*):

| | |
|---|---|
| the 29 community components | **P86** — COM-003 makes examples, COM-004/005 make the three missing entries |
| the shelf that carries them, and its granularity | **P85, this AC** |

**What AC3 actually still needs is the UNIT the CSV does not contain**: the one-node utility CMP-003
measured as the most reused thing in a real app (`Format full name` 9×, `Generate Google icon
object` 9×, `Is Trainer check` 9×) — and now [CMP-005](CMP-005-THE-DATE-FORMATTER.md), a real date
formatter, which is the worked example of a small sharp part the product does not have.

**AC3 is done when the shelf carries at least three single-component entries, one of them produced
by `export_to_library` rather than hand-authored**, and `list_library` distinguishes a part from a
prefab (a `tag`, a `type`, or a stated reason it need not).

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
