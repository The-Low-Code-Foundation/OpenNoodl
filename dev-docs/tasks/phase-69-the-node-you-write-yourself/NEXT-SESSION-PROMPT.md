# Phase 69 — next session

**Written 2026-08-17, session 21.** 🔴 **This file is a REWRITE, not an amendment.** It is
overwritten every session; if you find yourself prepending, rewrite it instead. Everything that
outlives the phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first. **s21 built and drove CN-006b** — the
kits surface. The build is small; what is worth reading is §1, because **three of the task's own
acceptance criteria were written against premises that turned out to be false**, and two of them
would have shipped something wrong.

---

## 0. Where the phase is

| Task | Built | Driven | Note |
|---|---|---|---|
| **CN-001** … **CN-006**, **CN-018**, **CN-019** | ✅ | ✅ | Closed sessions 4–15 |
| **CN-007** | ✅ s14 | ✅ s15 | AC1/3/4/5 met; **AC2 still not started** |
| **CN-008** | ✅ s16 | ⚠️ **AC1 needs a live model** | §4 |
| **CN-009** | ✅ s17 | ⚠️ **AC5's consequence needs a live model** | §4 |
| **CN-010** | ✅ s18 | ✅ AC1 s19 | **AC4 not started** |
| **CN-014** | ✅ AC1's library half, s20 | ✅ s20 | AC1's 2nd clause + AC2/AC3 open |
| **CN-006b** | ✅ **s21** | ✅ **s21** | **AC1–AC4 all met.** §1 |
| CN-011 … CN-013, CN-015 … CN-017 | 📋 | — | §3 |

🔴 **The drive debt is unchanged and is still exactly one item: CN-008 AC1 + CN-009 AC5 are one
drive, not two.** Both want a live model authoring in a project that has a kit. ⚠️ **Read §4 first**
— there is a stale-build trap that would make the whole run grade the wrong code.

**Nothing is blocked on a decision.**

## 1. What s21 did, and the lesson

CN-006b's four acceptance criteria are met and driven. The surface is a kits list in `KitsSection`
(with node counts, expandable node names, and remove), and a provenance row in the property panel
header. ⚠️ **Item 2 of the spec — "a create entry point" — was already built by CN-006.** Reading
the file before writing is what established that; the section even carried a note reserving the list
for this task.

### 🔴 The lesson: three false premises, in one short spec

**This is the sixth consecutive session in which the handover's or the task's stated premise did not
survive contact with the data.** The practice that catches it every time is the same one: *run the
thing the task describes, over real data, and count what comes back, before writing anything.*

| The spec said | What a census found |
|---|---|
| list each kit "with the right node count and **version**" | **No manifest in any of the 29 real projects has a `version` field.** The scaffold writes none, and `MANIFEST_SCHEMA` in `@nodegx/module-inject` has no `version` property at all. The row now reads one **when present** and omits it otherwise — `v0.0.0` would be a number nothing on disk ever said |
| "**a link to its docs** — the `docs` field already exists and is already carried through `nodelibraryexport.ts`" | It is carried, and **it is prose**. Measured on the payload a real viewer sent: both kit types carry the author's sentence, and **not one of the 175 built-ins carries the field at all**. An `href` would have opened nothing |
| provenance is "already carried" | ✅ True — and the useful correction is the *direction*: `module` was already on the exported type and needed **a reader, not plumbing**. `NodeLibraryDataNodeType` declared neither it nor most of the payload, exactly as s20 found |

🔴 **`docs` is now the fourth field in four consecutive tasks to bite a second consumer** —
CN-008's `docs`, CN-009's `summary`, CN-010's `dp.note`, and this. **One field, two vocabularies, and
the consumer that reads it decides which one it thinks it has.**

### ✅ A P1 capability gap, found and closed in passing

`getNodeDocs` reads the enriched catalog — keyed by type name, generated at repo-build time — so **a
kit type can never be in it**. The header's help button was gated on that lookup, so **a kit node had
2 action buttons and a built-in 3**. That is precisely the capability difference P1 forbids, and
AC4 exists to catch it. The kit's own `docs` prose fills the button now, with **no "Read more"** fine
type because there is no page behind the click.

### The rule for "is this a kit" had to be built from a census

🔴 **There is no `kind: 'node-kit'` marker.** The 29 projects contain exactly four manifest shapes —
iconset (`type`), asset module (`browser`, no `main`), ERG-002 library (`kind`), and kit (`main`, no
marker of its own) — and only the first three are positively identifiable. So kit-ness is
**subtractive**, and ⚠️ **a fixture containing only a kit passes against a `listNodeKits` that
returns every module it finds.** The central test writes all four shapes for that reason.

⚠️ **`joinKitNodes` keeps apart two states disk cannot distinguish.** ✅ D3 puts node lists in the
running viewer's gift, so a kit with no nodes is **"installed, not yet loaded"** — never "0 nodes",
which reads as a broken kit. Groups with no kit on disk surface as **orphans** rather than being
dropped, which is exactly AC3's aftermath.

**29 tests, 15/15 mutations killed** — ⚠️ **and two of those mutations exposed tests that could not
fail, rather than code that was wrong**: an iconset control the `main` requirement already excluded,
and a path-traversal test whose target was refused by the *manifest* check and then by the kernel,
twice, before the guard under test was ever consulted. `test:main` **3,630 / 236** (re-measured),
`typecheck:editor` **0**.

## 2. Instrument notes from s21's drive, all reusable

- 🔴 **`window.confirm` is a NATIVE modal in Electron** — it blocks the renderer and takes CDP with
  it. Stub it (`window.confirm = () => true`) before clicking anything that confirms. The hang reads
  exactly like a broken handler.
- 🔴 **CDP hover does not open the `Tooltip`.** A real `Input.dispatchMouseEvent` `mouseMoved` onto
  the measured centre, twice, with a neutral move between, left the tooltip layer empty; so did
  synthetic `mouseover`/`mouseenter`. Fall back to reading the `content`/`fineType` props React
  passes — and **say that is what you did**, it is one step short of the rendered text.
- 🔴 **The naive React fiber walk reports the LAST button in the rail for every button.** Following
  `sibling` from the root escapes the element's own subtree. Descend only: start at `root.child` and
  never follow the root's sibling.
- ⚠️ **`npm run cdp -- click <selector>` clicks the FIRST match.** The launcher has ~400 elements
  matching `[class*=LauncherProjectCard]` and three projects named `Cashflow Command Centre`; the
  first click opened **a peer's scratchpad project** and the reading would have been about the wrong
  tree. ✅ Tag the element you mean (`setAttribute('data-drive-target','1')`) and click that.
- ⚠️ **`LocalProjectsModel.loadProject()` loads but does not BIND** — `ProjectModel.instance` stays
  on the previous project and there is no error. The launcher card click is still the only route
  found, and **there is no route back to the launcher** from an open project: getting the wrong one
  open costs a stack restart.
- ⚠️ **Selecting a node switches the sidebar away from Settings**, so a settings element measured
  after an AC2 selection is **0×0** and the click is refused. Re-open and re-measure.

## 3. Picking the next build

With CN-006b done, the tier-2 authoring arc is complete. The remaining unbuilt tasks are
**CN-011 … CN-013, CN-015 … CN-017**, and two of them say outright to **measure before specifying**:

- **CN-012 (logic nodes)** — `module.nodes` via `defineNode` is the non-visual half and is
  **untested here**; the phase's proof covered `reactNodes` only. **Establish current behaviour by
  building the caller before specifying anything.**
- **CN-015 (failures name the kit)** — S/M, and the one with the least unknown in front of it.

⚠️ **Confirm rather than inherit — six sessions running now**, and this session was the worst of
them for it: **three false premises in one spec**, two of which would have shipped a wrong surface.

## 4. ⚠️ Before attempting CN-008 AC1 / CN-009 AC5

🔴 **A registered MCP server loads `/Applications/…`, not this checkout.** Driving the live
`nodegx-*` tools would grade the **old build**, so s18's and s17's work would not be under test at
all. The recorded route is to **spawn the bundle directly over stdio** — build to a *scratch* path
with esbuild (never over `packages/noodl-mcp/dist/`, which is what peers' registered servers load),
pass `--all-tools`, and read `inputSchema` from `tools/list` before calling.

⚠️ **Both criteria are about a *consequence*, and both say so.** CN-008 AC1: the graph the model
produces uses `Cashflow Lane` + `Money Pill` rather than a hand-rolled `Group` — *"the handout
appears in the prompt" is the mechanism and would be equally true of a broken feature*. CN-009 AC5:
an agent **places** a kit node it was not told about.

## 5. Owed by Richard

1. 🆕 **What should a kit's `docs` be able to say?** Today it is prose only, and CN-006b's spec
   assumed a URL. A kit author who wants to link a real docs page **has no way to express one** —
   `ReactNodeDefinition.docs` is a single string and the property panel now renders it as text.
   **(a)** leave it prose-only; **(b)** add a separate `docsUrl`; **(c)** sniff `http` and render a
   link. ⚠️ (c) is the cheap one and it is a **guess about the author's intent encoded in a regex**.
2. **The open-panel refresh (from s20).** An open property panel does not re-render on
   `libraryUpdated` — it recovers on any re-selection. Fold into CN-014's remaining scope, or leave
   as a known rough edge?
3. **What should `channelPort` do?** Unchanged from s19. **(a)** revive the editor-side manager;
   **(b)** have the exporter stop stripping the port; **(c)** reject it at kit-load with a
   diagnostic. ⚠️ **Doing nothing is the current state and it is the worst of the three** — the
   author gets no port and no message.
4. **Widen the project gate to check parameter values?** `checkParameterValues` has one production
   caller, so `validate:project` / `validate_project` check parameter values for **no node of any
   provenance**. `cn004.test.ts`'s last block asserts the silence deliberately — **replace it when
   the call is taken, do not delete it.**
5. **The ungated typechecks.** `packages/noodl-mcp`'s `tsc --noEmit` was red (8, s18) and runs in no
   CI job; seven of eleven `typecheck:*` scripts run nowhere, and `scripts/` is in none.
   ⚠️ `typecheck:runtime` red at 2, pre-existing. ⚠️ `typecheck:core-ui` reports **44 `TS2307`s**.
   ✅ `typecheck:editor` is **0** (re-measured s21).
6. **Should `project`'s `find_tools` purpose line name kits?** Costs resident tokens.
   `tests/kitTools.test.ts` has the control that fails when it changes. Narrowed by s17, unanswered.
7. **"Clean" is no longer "an empty diagnostics array" for any page** (s18's AC2). `Page` declares
   neither `title` nor `urlPath` statically, so **96 of 947 measured skips are `Page`**. `warnings`
   stays **0** and nothing blocks; same trade CN-002 made and you ruled for.

Open, not caused here, still wanting task numbers: 🔴 `render-from-disk.js` answers `/` and
`/index.html` and 404s everything else, **including the start page's own `urlPath`** · 🔴 the
`@noodl/mcp` provisioning flake (`provision.test.ts` red in a full run, green in isolation) · 🔴
`ViewerConnection.sendRefresh()` dead at both ends.

## 6. ⚠️ Carried, unresolved

🔴 **The cashflow kit is OUTSIDE the repo and the copies differ.** It lives in
`NodeGX test projects/cashflow-command-centre` — unversioned, covered by no gate. ⚠️ **s20's
handover said `cn069-s15-drive` carries the pre-D8 kit; it does not** — s21 drove it and the panel
showed `var(--green-600)` / `var(--amber-600)` / `var(--red-600)`. The standing note is about
`cn001-kit-drive` and `cn019-drive` **only**, and had been over-generalised. D5 makes CN-007 depend
on this kit staying working and nothing enforces it. **Still wants a task number.** ⚠️ Read it via a
`cp -R` into a scratchpad; never write to it.

⚠️ **The token vocabulary gap (s14):** the semantic set has `--destructive` but **no `--success` and
no `--warning`**, so any kit with three status bands reaches into the palette scale for two of them.

⚠️ **Free and still unchecked:** whether the editor's colour picker paints a swatch for a `color`
port whose value is a `var(--token)` string.

⚠️ **From s13, still free:** `CodeFileDocument` renders **two toolbars** — its own `css.Topbar` above
`JavaScriptEditor`'s, with two separate Save buttons (`notes/cn019-driven.png`).

⚠️ **From s18:** `find_tools`' `query` matches tool *names* only while its `describe` text says
"names and descriptions" (noticed s17, still untouched — changing it costs resident tokens).

⚠️ **`NodeLibraryDataNodeType` is not a census of the payload.** s21 added `module` to it; `ports`,
`dynamicports` and most other fields the viewer sends are still undeclared, and `BasicNodeType`'s
constructor copies **every** field regardless. **A field's absence from that interface says nothing
about whether it arrives** — check the recorded payload
(`tests-unit/cn-003/fixtures/kit-app.editor-nodelibrary.json`), not the type.

## 7. Checkout conditions

- 🔴 **An editor stack WAS launched (twice) and HAS been torn down.** `dev:debug --quiet` on 9222.
  Before launch: `dev:stop --list` clean, **paired with a `ps` walk showing 28 Electron matches that
  were all peers' MCP servers by PPID**, so the zero was attributable rather than a broken query.
  Both teardowns reported **26 processes stopped**, and peer MCP servers went **41 → 43** across
  them — `NEVER_SWEEP` working as documented. **Nothing of mine is running.**
- ⚠️ **Seven repo source files were edited and committed** (`7ea15c49`) — `projectmodules.ts`,
  `KitsSection.tsx`, `NodeLabel.tsx`, `provenance.ts` (new), `BasicNodeType.ts`,
  `NodeLibraryData.ts`, `propertyeditor.css`. There was therefore a `test:ci` contamination window.
  `ListAgents` showed 23 peer sessions but **all started 1–3 days ago**, so no broadcast was sent —
  the same call s20 made. `test:main` (plain Node, safe beside a live stack) was used, not `test:ci`.
- ✅ **No fixture or test project was written to.** The drive ran on a `cp -R` in the session
  scratchpad; the kit deleted in AC3 was deleted from that copy.
- 🔴 **`test:ci` still stands where s12 left it** (`2843 / 6 @ 39393`); s13–s21's commits are not in
  it. **Re-measure before quoting.** Do not inherit s18's `noodl-mcp` numbers either.
- ⚠️ **Peer work live in the tree and not touched**: `dev-docs/tasks/phase-50-legibility/notes/`,
  `dev-docs/tasks/phase-65-the-library/` (untracked), `dev-docs/tasks/phase-68-learnbook/README.md`,
  `scripts/library/check.ts`. ⚠️ A peer committed `b101a635` (phase-66 s56) mid-session; the
  `componentBench`/`ComponentBench` edits present at session start are in it, not in mine.
- Whoever you tell you are starting, tell you have stopped.
