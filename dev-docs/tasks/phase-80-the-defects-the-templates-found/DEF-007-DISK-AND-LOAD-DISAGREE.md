# DEF-007 — A project means one thing on disk and another once loaded

**Rank 7.** Sources: phase 78 **D9** (residual half), phase 77 **D5**. Both **NONE**-owned.

Not a bug in either mechanism. **A seam** — and every path that reads a project *without* loading it
through the editor sees a different graph from the one the editor sees. Export, deploy, headless
render, template generation and the byte gates are all on the wrong side of it.

## 1. (a) The load-time migration rewrites the graph

`runOnValueChangeMigration.ts` writes `runOnChange-<input>: false` for every node whose control
signal is wired. **Confirmed at HEAD, and it is deliberate** — Richard's decision, 2026-08-06:

> *"For every node that has its control signal connected, write `runOnChange-<input>: false` for the
> value inputs that signal used to silence. That preserves what the author actually built, rather
> than what §2's default would now do to it."*

It is idempotent, it never overwrites an explicit value, and the module explains at length why the
parameter **cannot be left absent** (a declared `default` never runs its setter, so `runOnValueChange`
reads absent as *ticked*). **None of that is the defect.**

🔴 **The defect is the consequence for anything that does not load.** Phase 78 D14 states it
exactly:

> *a migration runs where projects are loaded, and the render path that caught this reads from disk
> without it. **A template must be correct as written.***

And phase 77 D5 measured its bite: 37 nodes rewritten on load in a fresh project, zero `true`s — and
the site's root URL rendering no page at all.

### 1.1 🔴 P77 **D11** — and it is NOT the seam. The migration is wrong on its own terms.

**Added 2026-08-29** from phase 77's SBR-016 drive (their s15), and it **changes §1's last
sentence.** §1 exonerates the migration — *"None of that is the defect"* — on the reading that it
faithfully preserves a **pre-§2** author's intent and only the non-loading paths disagree. D11 is a
case that reading does not cover:

> The migration reversed two queries in `/Pages/Admin` and `/Pages/PageEditor` of a template
> **authored entirely after §2**, on an ordinary editor load. The author deliberately wanted a
> load-time fetch; `storageFetch` was wired; the migration wrote `runOnChange-collectionName: false`
> and `runOnChange-qp-pageId: false` and the fetch stopped happening.

**Read at HEAD, and the peer's account holds with one correction:**

- `RUN_ON_CHANGE_FAMILIES` has **18 entries for 15 families** — the four `Variable` types share
  one definition (`variables/variablebase.ts`) and one row each, because the migration keys on type
  name. The module says so two lines above the table. **Phase 77's "fifteen" was right.**

  🔴 **I "corrected" it to 17, and 17 is neither number.** It came from a one-line regex over the
  table requiring keys to match `[\w.\-]+`, and one key — `'Filter Collection'` — has a **space**
  in it. 18 − 1 = 17. The failure mode is the one worth keeping: the number was **plausible**, it
  sat between the two true numbers, and it fit nothing and excluded nothing — so nothing about it
  looked wrong, and I used it to overturn a correct figure that had been read off the module's own
  prose. **A hand-rolled counter's first output is a measurement of the counter.** Brace-match the
  literal, or read the sentence the author already wrote.
- 🔴 **There is no project-version guard anywhere in the pass.** The only conditions are *"this node
  is in a family"*, *"its control signal is wired"* and *"the key is absent"*
  (`runOnValueChangeMigration.ts:406-421`). Nothing distinguishes a graph carrying pre-§2 history
  from one minted this morning, and nothing could — **absence is the only evidence it has**, and a
  modern author who simply never set the parameter is indistinguishable from a legacy author who
  relied on the old default.
- The `hasOwnProperty` check is, in the module's own words, *"the whole of idempotency"*. So **an
  authored `true` is the only defence**, and it is written down in no document the author reads.

⚠️ **Why this matters for the fix in §3.2.** Writing explicit values during template generation was
listed as *"the cheaper, narrower option"* for the **disk-vs-load** problem. D11 shows it is not
merely cheaper — for a modern template it is the **only** thing that works, because the migration
will keep reversing an unstated intent on every load however well the disk-readers are fixed. The
two halves of §3.2 are not alternatives.

🔴 **Owner: DEF-007 (this task), phase 80.** Phase 77 filed D11 as `NONE`-owned. It is not unowned —
it is this row's mechanism, in this row's file, and an unowned copy of an owned row is exactly how
F15 became D8. Phase 77's register should point here rather than carry it.

## 2. (b) The curated template path does no home resolution

Phase 78 **D9** — a generated project shipped with no HOME node and every headless gate passed over
it. **Fixed** for the generated artefact (`prepareArtefact` → `pinRootNode`). What is **not** fixed:

- 🔴 **`PlatformTemplateProvider` does no home resolution at all** — neither `rootComponent` nor
  `rootNodeId` appears in it. A curated template is a prepared directory, and what the directory
  carries is what the person gets.
- ✅ `EmbeddedTemplateProvider` resolves the name into a concrete `rootNodeId` at install, **and its
  own comment states the trap** (`:119-125`): `fromJSON`'s `rootComponent` hint calls
  `setRootComponent()`, which *"silently no-ops unless the NodeLibrary already has the root node's
  type loaded"* — and at project-creation time the editor is on the launcher with an **empty
  NodeLibrary**, so the hint is lost and *"the project is saved with no home component"*.

⚠️ **The curated half is read from source, not driven.** A curated template cannot be installed
through the picker until it is published. **Grade it there** and do not let D9's driven half stand in
for this reading.

### 2.1 🔴 Driven 2026-08-29 — §3.3's fix has an EMPTY POPULATION, and the real gap is next to it

**The bullet above is a true reading of the source. Its consequence does not follow.**
`PlatformTemplateProvider` does no home resolution — confirmed, it writes bundle bytes verbatim.
But it needs none, because **the shape §3.3 would resolve never reaches it.** Measured three ways,
all at HEAD:

- **The editor's writer never emits `rootComponent`.** `projectmodel.ts:1435` writes
  `rootNodeId: this.rootNode ? this.rootNode.id : undefined` and no name field at all. The legacy
  name is a **`fromJSON` fallback only** (`:238-243`), guarded by `&& !_this.rootNode`, and its own
  comment says what it is for: *"Handle rootComponent from templates (name of component instead of
  node ID)"*. A project that has been through the editor once carries the id.
- **0 of 340.** Widened from the 97 project directories under `NodeGX test projects` to every
  manifest under `vscode_projects` and `Documents` — **340** files: **277** carry `rootNodeId`,
  **63** do not, and **exactly 2 carry `rootComponent` at all**. Both of those two (`SBR No
  Backend`, `alpha007-hostile-fixture`) carry an id beside the name, which `fromJSON` prefers
  anyway. **The set carrying a name and no id is empty at both denominators.** ✅ The counter is
  not silently inert — it *found* the 2, so the absence is measured rather than assumed.

  ⚠️ **The 63 without a home are not 63 broken apps, and the wide denominator is the wrong one for
  that half.** Most are **modules and prefabs** (`opennoodl-modules/modules/*`, the
  `library/*.zip/project.json` bundles) — a module is a bag of components with no home *by design*,
  so an absent `rootNodeId` there is correct. The honest figure for **projects a person opens** is
  the narrow one: **6 of 97**, all scratch drives (`ac4-drive`, `cn012-drive`, `fb015-drive`,
  `fb017-drive`, `fb018-drive`, `test`). 🔴 **Which is itself a finding for the fix below:** a home
  check that refuses at publish must not refuse a module, and "has no `rootNodeId`" does not
  distinguish the two.
- **The two providers take different input shapes, deliberately.** `EmbeddedTemplateProvider`
  resolves because its input is a hand-authored TypeScript object naming a component —
  `hello-world.template.ts:40`, `rootComponent: 'App'`. `PlatformTemplateProvider`'s input is **a
  real project's files**: `shareAsTemplate` walks the project directory and uploads its manifests
  verbatim (`MANIFESTS`, `:325`). The home was resolved to a concrete id the moment the editor
  saved it — there is nothing left to resolve.

🔴 **The gap that IS real, and which no row in this task names: nothing on the curated path checks
that a template has a home at all.**

- **No publish gate.** `shareAsTemplate.ts` and `shareTemplateForm.ts` contain **zero** references
  to `rootNodeId` or `rootComponent` — the single `home` hit is a filesystem path in a comment.
  A project with no home uploads cleanly; `hasProjectManifest` only asks whether a manifest exists.
- **No install-side rescue.** `createFromTemplate.ts` does not mention either field.
- ✅ **And the rescue exists elsewhere, which is what makes the absence legible.**
  `noodl-preview/src/loader.ts:131-156` has `resolveRootNode` — it guesses a root using the
  editor's own `allowAsExportRoot` predicate and **tells the user it guessed**. Its docstring names
  the population exactly: *"projects written by the editor always carry one. Projects authored from
  outside (an agent writing v2 files, the MCP server) frequently do not."* That is an independent
  author reaching the same measurement as the 97-project count above.
- **6 of 97** projects carry no home. They are 0–2 component scratch projects rather than
  publishable templates, so this is a **live hole, not a live incident** — but it is the hole AC1's
  sentence falls through, and the resolver in §3.3 would not have closed it.

🧭 **A decision, not a fix to be guessed at**: refuse at publish (*"this project has no home"*),
or resolve-and-warn at install the way `loadPreview` already does. Refusing is honest about a
template nobody can open; warning matches the behaviour a person already gets from preview.

## 3. Scope

1. **Name the seam.** A single documented answer to *"what does a project on disk mean?"* — and which
   of export / deploy / headless render / template generation apply the migrations and which do not.
2. ✅ **(a) DONE 2026-08-31 (s31) — the second option.** Template generation now writes the
   explicit values (`pinRunOnValueChangeDefaults`, called from `toTemplateContent`), so the
   artefact is correct as written. §6.2 records the measurement and the one decision inside it.
   ⚠️ Done **for the site-builder generator only.** `tpl001Template.ts`'s `prepareArtefact` is the
   other generator and has **not** been given the same pass — and it is **not** a one-line call,
   because it writes a **v2 directory** (`components/*/nodes.json` + `nodegx.project.json`) rather
   than one legacy `content.json`. `pinRunOnValueChangeDefaults` takes the legacy
   `{components:[{graph:{roots,connections}}]}` shape, so TPL-001 needs its graph assembled into
   that shape first — which `readAsLegacyProject` already does for site-builder, through
   `ProjectImporter`. **Nobody has measured whether TPL-001 has a disagreement at all**; that
   measurement is the first job, not the port.
3. ~~**(b)** Give `PlatformTemplateProvider` the same `rootNodeId` resolution
   `EmbeddedTemplateProvider` already has — by **id lookup**, independent of the NodeLibrary.~~
   🔴 **Struck 2026-08-29 — see §2.1.** The curated path receives a real project's files, which
   already carry a concrete `rootNodeId`; the name-shaped input this would resolve is
   `EmbeddedTemplateProvider`'s alone. **Replaced by:** decide where a *missing* home is caught —
   refuse at publish, or resolve-and-warn at install as `noodl-preview` already does. 🧭

## 4. Acceptance criteria

1. **A person's sentence:** *I pick a template from the shelf, press preview, and the app is there.*
2. (b) A curated template installed **through the picker** opens on its home component.
   ✅ **GREEN 2026-08-31 (s41) — DRIVEN, with a control that discriminates.** Richard ruled
   *publish one now, then drive it*, and the blocker turned out to be a wrong assumption: the shelf
   is served by `nodegx-community`, which **runs locally**, and publishing is a **database
   credential** act rather than a session-token one. A curated template was published to a local
   instance of the real platform, drawn by the picker over real HTTP (badge **Community**),
   installed, and the editor opened on **`App`** — the home, at **index 3 of 4** and alphabetically
   last. 🔴 **The control is what makes it a measurement**: the same template with `rootNodeId`
   deleted lands on `/#__page__/Acme Legal Client Portal`, index **0**. Only that field was varied.
   See §8. ⚠️ Nothing was published to the live service.
3. (a) A generated artefact rendered **from disk** and the same project **loaded in the editor**
   agree about every `runOnChange-*` — asserted as a **pair**, because either one alone is the state
   this task exists to distinguish.
   ✅ **GREEN 2026-08-31 (s31).** Was 56 on 2026-08-29, re-derived at **65** two days later, now
   **0** — the whole seam, both `applyPatches` passes, measured with the before artefact as a
   red control. See §6.2. Gated by `DEF-007 AC3` in `sb007Template.test.ts`.
   🔴 **SCOPED TO SITE-BUILDER, and the second artefact is NOT green.** Measured 2026-08-31:
   **TPL-001 (`templates/members-area`) disagrees in 57 places** (`writes 57, familyNodes 105`,
   against site-builder's `0, 82` — both arms non-zero, so the 0 is an absence and the 57 a
   presence). AC3's sentence says *"a generated artefact"* and one is green; **the row is not
   discharged for every shipped template.** Owned as **Row 10**, owner `NONE`. ⚠️ The port should
   make the gate **enumerate the generators**, not gain a second hand-written block — that is the
   decaying-hand-list shape AC4 exists to prevent.
4. ✅ **CLOSED s37 — the seam's documentation names each path and which side it is on, and a test
   keeps it honest.** Richard ruled *both* steps, not the cheap half:
   - The table now lives in the codebase as
     [`projectLoadSeam.ts`](../../../packages/noodl-editor/src/editor/src/models/ProjectPatches/projectLoadSeam.ts),
     beside `applyPatches` — which now carries a pointer to it at the top of the file.
   - 🔴 **The test is the point**:
     [`def007-project-load-seam.test.ts`](../../../packages/noodl-editor/tests-unit/def007-project-load-seam.test.ts)
     scans shipped source for `ProjectModel.fromJSON` and **fails when a call site appears that is
     not registered**, and when a registered one disappears. ✅ **Proved by mutant**: a seventh
     load path added to `noodl-preview/src` reddened exactly that row and no other; removing it
     went green again.
   - ✅ **The extractor is validated against an answer known by hand** (the editor's open path and
     the headless render path) before any absence it reports is trusted, and **comments are
     stripped** — `loader.ts` names `fromJSON` in a docstring twelve lines above the real call, and
     two more files name it while calling nothing. A control row asserts a comment-only mention is
     not a call site.
   - ⚠️ **The first run found `src/editor/index.bundle.js` and `src/frames/viewer-frame/index.bundle.js`** —
     gitignored webpack output that contains a copy of everything. Excluded by name, with the
     reason recorded in the file.
   - ⚠️ **What the scan cannot see**: a reader that never constructs a `ProjectModel` — code
     export, the MCP server, template generation. Those are registered as prose in
     `NON_FROMJSON_READERS` and **nothing enforces them**; the boundary is stated, not hidden.
   - **The measurement is unchanged and is now asserted**: of the five `fromJSON` sites in shipped
     source, **exactly one applies the upgrade** (the editor's own open path); two inherit it from
     an already-loaded project and two skip it outright.

## 5. Traps

- 🔴 **A migration can fire on a project authored today.** Ask **who wrote a parameter** before
  treating it as the author's intent.
- 🔴 **The byte gate compares the artefact to a fresh run of the same generator.** A field neither
  side writes is a field both sides agree about — it is a *drift* check and **cannot see a defect
  present from the first run**. It passed over D9 exactly this way.
- 🔴 **The drive serves pages directly** (`withRenderedPage` navigates to a URL), so it never asks
  the project what its home is. **45 specs including every browser one passed on a project the
  editor could not open.** The door a person uses for a project template is *open it in the editor
  and press preview*.
- ⚠️ **`rootComponent` and `rootNodeId` are not interchangeable.** `rootComponent` is the **legacy**
  field (a component *name*), which `project-v2.schema.json` (`additionalProperties: false`) does not
  permit. The v2 spelling is `rootNodeId`, a node id.

## 6. The seam, measured — 2026-08-29

§3.1 asks for *"a single documented answer to what a project on disk means"*. Here is the derived
half. **The whole seam is one call**: `applyPatches(content)` immediately before
`ProjectModel.fromJSON(content)`. `fromJSON` does **not** apply patches — it calls
`ProjectModel.upgrade` and nothing else — so every path that reaches `fromJSON` without going
through `applyPatches` first sees the file as written.

Grepped for `applyPatches` importers across `packages/*/src`, excluding the prebuilt
`src/external/*` bundles:

| path | entry point | migrations |
|---|---|---|
| Opening a project in the editor | `projectmodel.editor.ts:24` | ✅ **applies** |
| Version-control snapshot | `snapshotProject.ts:112` | ✅ **applies** |
| Headless preview / SSR render | `noodl-preview/src/loader.ts:187` | ❌ **does not** |
| Code export | `packages/nodegx-export` | ❌ **does not** |
| MCP authoring and validation | `packages/noodl-mcp` | ❌ **does not** |
| Template generation (the artefact) | written as JSON, never loaded | ❌ **does not** |

⚠️ **Two call sites inherit rather than decide.** `compilation.ts:83` and
`exportProjectComponents.ts:88` both call `fromJSON` on a project that is *already loaded*
(`this.project.toJSON()`, and a synthesised shell) — they are downstream of the editor's
`applyPatches`, not a second opinion about it. `projectmodel.ts:218` (`fromLocalStorage`) is a
third, and is the one place a project is rebuilt from a string with no patch pass at all.

### 6.1 🔴 AC3's pair, measured — the shipped template disagrees with itself in 56 places

`planRunOnValueChangeMigration` is pure and imports nothing, so it can be run over an artefact on
disk without an editor. Run against the shipped site-builder content
(`site-builder.content.json`, md5 `56e03abf8bb583cec6b038f5e12ed11e`, committed at `cdd842fc`,
**not** a working-tree edit):

**56 writes across 13 components.** Which is to say: the artefact as written and the same artefact
as the editor loads it differ in 56 stored parameters, and phase 78 D14's rule — *"a template must
be correct as written"* — is failing by that margin today.

    /#__cloud__/duplicatePage        9      /Pages/ThemeEditor          6
    /Site/ContactForm                6      /#__cloud__/site/ContactRecipient 6
    /Pages/PageEditor                5      /Pages/Site                 4
    /#__cloud__/publishPage          4      /#__cloud__/submitContactForm 4
    /Admin/SectionRow                3      /Pages/Admin                3
    /Pages/Setup                     3      /#__cloud__/claimSite       2
    /#__cloud__/site/CopySectionToPage 1

🔴 **`/Pages/Admin` and `/Pages/PageEditor` are in the list, which is P77 D11 still live** — both
are `DbCollection2` fetches being silenced on load. ⚠️ **The port names have moved since D11 was
filed** (D11 named `runOnChange-collectionName` and `runOnChange-qp-pageId`; today's plan writes
`runOnChange-records`, `runOnChange-querySettings` and `runOnChange-search` on those two
components), because phase 77's SBR-017 has been editing this artefact. **The phenomenon persists;
the specific ports are a moving target.** Re-run before quoting the breakdown — the total is
anchored to the md5 above and nothing else.

⚠️ **This number is NOT yet a defect count.** It measures *disagreement*, which is what AC3 asks
for. Whether each of the 56 is a reversal of the author's intent needs D11's question asked per
node — *did the author want this to run on load?* — and §1.1 is the reason that question no longer
has a free answer. **What it does establish is that the disk/load gap is not hypothetical and not
small**, and that closing it by writing explicit values (the §3.2 half) is 56 decisions, not a flag.

🔴 **Do not fix this by editing `site-builder.content.json` or its generator right now.** That
artefact is **phase 77's active file** — mtime 12:44 today, moved by SBR-017 this session. The fix
belongs with whoever owns the generator, sequenced after their work lands.


## 6.2 ✅ §3.2 built — 2026-08-31, s31

**65 → 0**, and the count is the first thing to say about it.

### The number had decayed, and it decided the design

§6.1 recorded **56**, anchored to md5 `56e03abf…` at `cdd842fc`. Re-derived at the point of
relying on it: `cdd842fc` **56**, `HEAD` **65**, working tree **65**. The breakdown moved too —
`/#__cloud__/reorderSection` appeared with 6, `/Admin/SectionRow` left, `/Pages/ThemeEditor` went
6 → 14 — because phase 77 keeps authoring into this template.

🔴 **That killed the obvious fix.** Settling 65 parameters by hand into a file a peer edits daily
would have been stale before it committed. The fix had to be in the generator, which is where
§3.2 already said to put it — but the *reason* it had to be there was only visible after
re-measuring. **Fourth session running that a stale recorded quantity would have produced a
defensible answer to the wrong question.**

### And the artefact is generated, which the register never said

🔴 `site-builder.content.json` **is generated** — `npm run template:site-builder` — and
`sb007Template.test.ts` asserts byte equality, so a hand edit reddens rather than ships. The
template's own header says so in capitals. §6.1's *"do not fix this by editing the artefact or its
generator, it is phase 77's active file"* was half right: the artefact is theirs, and the fix was
never an edit to it.

### The value is `true`, and the authors had already decided that

The migration writes `false` to preserve a **pre-§2** author's intent, and its only evidence such
an author exists is **absence of the key** — there is no project-version guard anywhere in the
pass, and there could not be. On a template minted after §2 it therefore rewrites parameters
nobody wrote. So the pin writes the `true` the artefact **already means** unloaded (a declared
default never runs its setter, so `runOnValueChange()` reads absent as ticked).

✅ **This is not a new policy — it is a hand-run one, automated.** The component sources already
carry **21 explicit `true`s and 27 `false`s**, pinned node by node as each breakage was found, and
`sb006Components.ts:517` states the whole argument: *"An already-present key is never touched,
whatever its value (the migration's idempotence clause), so writing `true` here is the one thing
that survives the load. Absent does not."* The pin generalises that to the 65 nobody had reached.
The 27 authored `false`s are preserved — idempotency is the migration's own rule and the pin
obeys it.

### Measured, with a control that reads red

`applyPatches` is **two** passes, not one — the node-level `Patches` and then the migration — so
the pair was measured through the whole call:

| artefact | migration writes | total disk-vs-load differences |
|---|---|---|
| before the fix (control) | 65 | **65** |
| after | 0 | **0** |

⚠️ The node-level `Patches` contribute **zero** on this artefact, so the migration was the entire
disagreement. That is a fact about *this* template and not about the seam in general.

The regeneration changed **65 lines, every one a `runOnChange-*: true`, and nothing else** — which
also proves phase 77's in-flight component edits were reproduced rather than swept.

### 🔴 The one consequence that is a decision, not a fix

The pin wrote `true` on **all six** of P77 **D33**'s unconfirmed same-collection rows on
`/Pages/ThemeEditor`. What that does and does not change:

- **Deployed, exported, headless-rendered: nothing.** Those paths already read absent as ticked.
  If those six are a real write-back cycle, **the cycle is already live in the shipped product**
  and always was.
- **In the editor: they now run**, where the migration used to silence them. So the editor stops
  masking a hazard the deployed site already has — and the editor is where the runtime's
  `[runtime/cyclic-loop]` detector lives, which is how D31 was caught at all.

🧭 **Richard's call whether that is the right trade**, and D33's owed drive is now much cheaper to
take, because the editor will exhibit the behaviour instead of hiding it. The conservative
alternative — pinning those six `false` — was rejected because two of them are `in-rows` on
functions that read a collection, and `false` there is D5/D11's failure mode exactly: the screen
never populates.

### What the gates had to become

Six specs went red, all of them grading **`plan.writes`** — *"the inputs the migration is about to
silence"* — which the fix empties by design. That block's own control comment says an empty plan
makes every assertion under it pass for free, so leaving them green-by-emptiness was not an option.

Both passes now grade what the artefact **states**:

| pass | question | population | was |
|---|---|---|---|
| `gradeMountTriggered` | does silencing this leave the node with no trigger? | 19 silenced | 65 |
| `gradeWriteBackCycle` | is running on this the thing that loops? | 72 running | 65 |

🔴 **An absent key is in both**, because absent means opposite things on the two sides of this
seam — ticked to the runtime, `false` to the migration. That is the sharpest one-line statement of
the whole defect, and it is why both mutants still work by deleting a key.

✅ **The census survived intact** — the same six D33 rows, found from the new population — and both
mutants and the discrimination control still pass, which is what says the re-aim preserved meaning
rather than moved a goalpost.

🔴 **And it found something.** `reached` went **29 → 30**. The 7 inputs that entered the population
are exactly the ones an author had pinned `true` **by hand**, and the old pass could not see them
*structurally*: it iterated `plan.writes`, and an already-present key is never written. **The seven
inputs somebody had thought hard enough about to state explicitly were the seven the hazard check
skipped.** The 30th, `/Pages/PageEditor sections-2.qp-pageId`, writes `Section` and is cleared —
no new hazard, seven questions that were never asked.

### Gates

- `npx jest` in `packages/noodl-mcp` — **79 suites, 1043 tests, all green**, including phase 77's
  then-uncommitted `sbr012RawColourGate.test.ts`.
- `typecheck:editor`, `typecheck:mcp` — clean.
- `test:ci` — **2909 specs, 4 failures, the floor exactly**, all four AIX-006 by name.

  ⚠️ **The first run read 5, and the fifth was a flake.** `pending project saves survive the way
  out — re-arms a held save when saving is switched back on` is a timing spec that polls the disk
  after `SAVE_DEBOUNCE_MS + 500`, and it has **zero** references to anything this change touches.
  Re-run on a different seed (70598 → 76055) it went away. Recorded rather than dropped, because
  a lone red that a session quietly re-rolls until it is green is how a real regression gets
  attributed to luck — the attribution here is the spec's content, and the re-run only confirmed
  it.

## 7. ✅ The two ruled items, built and driven — 2026-08-31, s38

Richard's 2026-08-31 ruling carried **two separate items**, and neither substitutes for the other:
publish catches a project that never had a home, deletion catches one that had a home and lost it.
Both are now built. **AC2 remains open** and is untouched by this session — it still needs a
curated template installed *through the picker*, which cannot be reached yet.

### 7.1 Refuse at publish

`templateHomeStatus(files)` in
[`shareAsTemplate.ts`](../../../packages/noodl-editor/src/editor/src/models/template/shareAsTemplate.ts)
answers `has-home | no-home | unreadable`, and `shareAsTemplate` refuses `no-home` **after
`no-manifest` and before `too-big`**. The order is asserted, not assumed:

- **After `no-manifest`** — somebody who picked their Downloads folder must not be told their
  project has no home page. That is a true sentence about a problem that is not theirs.
- **Before `too-big`** — a template nobody can open should be refused before its 8 MiB are
  weighed. The size is fixable by deleting assets; this is not.

🔴 **The module question from §2.1 is answered by the DOOR, not by the predicate.** §2.1 warned
that *"has no `rootNodeId`" does not distinguish a broken project from a module* — 63 of 340
manifests carry no home and most are modules and prefabs, which have none *by design*. That
warning is correct for any sweep over a disk and **does not apply here**: this door is *"Share as
**template**"*, reached from a kebab on a launcher project row, and its category vocabulary is
`starter | data-app | dashboard | site | form | integration`. **There is no module category and no
module route onto this shelf.** A template is a thing somebody installs and opens; one that cannot
open is broken whatever shape it has. ⚠️ **Recorded in the function's own header: if a "share as
module" door is ever added, it must not call this.**

⚠️ **Both spellings count.** `rootComponent` is the legacy name field the v2 schema forbids, and
its population here is empty (§2.1: 0 of 340 carry a name without an id) — it is accepted anyway,
because `fromJSON` still resolves it, so a project carrying only the name is one that *does* open.
**This function decides a refusal, so it must err towards letting a working project through.**

⚠️ **`unreadable` is a third answer, not a fold into either.** Torn JSON, or a project whose only
manifest is `components/_registry.json` (which carries no home field at all), is unmeasurable —
and an unmeasured project is **passed to the platform, not refused**. Reporting "no home page" for
a file that will not parse is a confident sentence about the wrong problem.

### 7.2 Scream on deleting a home page

🔴 **What was already protected, and what was not.** Deleting the home *component* from the
Components panel was **already refused outright** — `ProjectModel.deleteComponentAllowed` answers
*"Home component can't be deleted"*. That door was shut and is untouched.

**The open door was the node canvas.** The home is a *node*, and selecting it and pressing Delete
ran a module-scope listener in `projectmodel.ts:1457` that called `setRootNode(undefined)` with no
dialog, no toast and nothing written anywhere a person looks. 🔴 **The panel's refusal made this
worse rather than better, because it teaches that the home is protected.**

Built as [`homeprotection.ts`](../../../packages/noodl-editor/src/editor/src/models/homeprotection.ts),
a pure module mirroring `lessonprotection.ts`, wired into `EditorClipboard`:

- 🔴 **`delete()` and `cut()` both.** **`cut()` had no guard of any kind** — not even FIX-025's
  lesson one, which only ever wired `delete()`. Cutting the home node removes it exactly as Delete
  does, and the clipboard is **not** a rescue: a paste mints new ids, so `rootNode` cannot be
  restored by pasting the node back.
- 🔴 **The removal set is FLATTENED.** `removeNode` notifies `nodeRemoved` only for the node it
  was handed — its children are dropped from `nodeMap` in a `forEach` with **no notification
  each** — so `projectmodel.ts`'s listener is blind to a home node sitting inside a selected
  Group. This module walks the subtree and does not depend on that asymmetry.
- ⚠️ **A confirm, never a refusal**, on `lessonprotection.ts`'s reasoning. The Components panel
  already shows what a refusal costs: there is no way to delete a home component at all, even
  deliberately — a second defect this is careful not to copy onto the canvas.
- The two questions are **chained**, home first: a lesson step that stops completing is
  recoverable, a project with no home does not open.

### 7.3 Driven — real editor, `def007-drive`, 2026-08-31

Fixture: a copy of `DEF-015 Card Drive` under `NodeGX test projects` (local, not iCloud), home
node `650d423a-…` (`Group`, label `App`) with a `Router` child. Settled by
`_retainedProjectDirectory`, never by the card title.

| act | modal | node | `getRootNode()` |
| --- | --- | --- | --- |
| **control** — delete the `Router` (a *non-home descendant*) | **none** | deleted | unchanged |
| delete the home `Group` | **"This is your home page"** | **kept** | unchanged |
| … press **"Keep my home page"** | dismissed | **kept** | unchanged |
| … press **"Delete it anyway"** | dismissed | deleted | **`null`** |
| **cut** the home `Group` | **"This is your home page"** | **kept** | unchanged |

🔴 **The control was run FIRST and it is from the searched population** — the Router is a
descendant of the home, so it tests the predicate rather than the boundary. It raised **no** modal
while the delete path plainly worked, so the guard is not blanket-firing and the harness is not
broken. Screenshot captured of the rendered dialog.

🔴 **And the confirm branch matters as much as the refusal branch**: pressing *"Delete it anyway"*
really does delete it. This is a confirm, and a spec that only proved the dialog appears would
pass equally against a refusal, which is the thing §7.2 says not to build.

The publish gate was driven in the same running editor against this project's **real manifest**:
`has-home`, and `no-home` for the same bytes with `rootNodeId` removed — a control pair varying
exactly one field.

### 7.4 🔴 A NEW finding the drive produced: undo does not restore the home

**Undo after deleting the home node brings the NODE back and leaves the project with no home.**
Measured: after *"Delete it anyway"* then `UndoQueue.undo()`, the `Group` was back in the graph and
`getRootNode()` was still `null`.

The node's undo action restores the node; nothing restores `ProjectModel.rootNode`, because
`setRootNode(undefined)` is run by an event listener rather than as part of the undoable act. So
the damage is **not** fully undoable, which is a direct argument for the confirm and is why
Richard's *"you might not remember what you deleted"* applies here even more than in a lesson.

⚠️ **Registered, not fixed** — it is a separate defect from the two items ruled, and fixing it
means making the root-pointer change part of the undo group. Filed as a new row in
[UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md).

### 7.5 What is graded how, stated plainly

- ✅ `templateHomeStatus`, the refusal and its ordering, and every sentence: unit-graded in
  `tests-unit/fb-005/`, **4 mutants**, each reddening a different count.
- ✅ `homeInDeletion` / `homeDeletionMessage`: `tests-unit/def-007/home-protection.test.ts`,
  **3 mutants**.
- ⚠️ **The WIRING is graded by the drive alone, not by a spec.** `EditorClipboard` **cannot be
  imported under this jest** — it reaches `bugtracker.ts`, which calls `platform.getUserDataPath()`
  at module scope. So a pure-module spec here would pass against a module nobody calls; the drive
  in §7.3 is what excludes that, and it is the only thing that does.
- ⚠️ **The shared `PROJECT` fixture in `template-submission.test.ts` now carries `rootNodeId`,
  and it is load-bearing.** Deleting that field turns roughly half the file red.

## 8. 🟢 AC2 DRIVEN — a curated template, published and installed through the picker — 2026-08-31, s41

🧭 **Richard ruled: publish one now, then drive it.** AC2 had been parked since s38 on the
grounds that *"the picker cannot reach a curated template until one is published"*. It can now,
and it did.

🔴 **Nothing was published to the live service.** §2's blocker assumed publishing meant
`community.nodegx.io`. It does not: the shelf is served by `nodegx-community`, which **runs
locally**, and publishing a curated template is a **database-credential act**, not a session-token
one — `scripts/publish-project-template.ts`, exactly as `0021`'s header says (*"Share as template"
files a SUBMISSION. It does not publish*). So the whole path was driven against a local instance
of the same platform code, over a real socket, with the real route handlers.

### What the two halves were

| half | what ran |
| --- | --- |
| the platform | `nodegx-community` at `localhost:3000`, `next dev`, own database `nodegx_p80_s41` created beside the existing one and migrated from scratch (24 migrations, 57 tables) |
| the editor | a real `dev:debug` editor with `COMMUNITY_URL` **temporarily** pointed at `http://localhost:3000` — reverted at the end of the session, md5-identical to HEAD |

⚠️ **The origin edit is the one thing that could not be avoided.** `communityorigin.ts` is a
single hardcoded constant and `uni-001/composer-offers-signin.test.ts` asserts its exact literal,
so there is no env override to use. It was copied to a scratchpad before the edit and restored by
`cp` — `git diff` on that file is empty and the md5 matches the pre-edit capture.

### The fixture, and why it is the one that discriminates

`def007-curated-src`, a copy of `uni011-ac3-drive`. Its four components are, in manifest order:

```
0  /#__page__/Acme Legal Client Portal
1  /Acme Legal Client Portal/Invoice Row
2  Acme Legal Client Portal
3  App                                  ← the home lives here
```

🔴 **The home is index 3 of 4 and alphabetically last.** That is the whole point of choosing this
project: on a one-component template — or on any template whose home is first — *"opened on the
home"* and *"opened on the first component"* give the **same answer**, and a pass would prove
nothing. Here they differ.

### The drive

| step | reading |
| --- | --- |
| publish | `published: "DEF-007 Home Check" at /templates/def007-home-check — version 1, 1 files, 9 KiB` |
| the shelf over real HTTP | `GET /api/v1/community/templates` → **200**, one row, signed-out |
| the bundle over real HTTP | `GET …/def007-home-check/bundle` → **200**, and it carries `rootNodeId: 4cbaae71-…` verbatim |
| **the picker** | the wizard's gallery drew **`DEF-007 Home Check` … `Starter` … `Community`** beside the two built-in templates — `All (3)`, the badge naming `PlatformTemplateProvider` as its source |
| install | selected the card, `Create Project`, real install to `NodeGX test projects/def007-ac2-drive` |
| **AC2** | `_retainedProjectDirectory` = the new project; `rootNode.id` = **`4cbaae71-…`**, the published id; **`activeComponent` = `App`** |
| on disk | the installed project saved as v2 and `nodegx.project.json` carries `rootNodeId: 4cbaae71-…` |

✅ **So a curated template installed through the picker opens on its home component.** Identity
settled by `_retainedProjectDirectory`, never the card title.

### 🔴 The control, and it discriminates

A second curated template, `def007-nohome-check`, **identical bytes but for `rootNodeId`, which
was deleted from the manifest**, published to the same shelf and installed the same way through
the same picker.

| arm | `rootNodeId` | the editor opened on |
| --- | --- | --- |
| home present | `4cbaae71-…` | **`App`** — index **3** of 4 |
| home absent (control) | `null` | **`/#__page__/Acme Legal Client Portal`** — index **0** |

**Only `rootNodeId` was varied.** With it, the editor lands on the home; without it, it falls
through to the first component in the manifest. So the positive reading is caused by the home and
not by manifest order, alphabetical order, or anything else about this project — the explanation
a one-component fixture could not have excluded.

## 8.1 🔴 What the control exposed — a curated template with NO home installs silently

The control was built to make AC2 honest. It also measured a real hole, and this is a **finding,
not a fix**:

- **The curator's publish script has no home gate.** `publish-project-template.ts` accepted a
  manifest with no `rootNodeId` and put it on the shelf — *"published … 1 files, 9 KiB"*, no
  warning, no refusal.
- **s38's refusal does not cover this path.** It lives in
  [`shareAsTemplate.ts`](../../../packages/noodl-editor/src/editor/src/models/template/shareAsTemplate.ts)
  `:342-390`, which is the **person's** submission door (*"Refuse at publish, make sure people
  define a home page"*). A curator publishing directly with a database credential never passes
  through it. **Both doors were called "publish" and only one is gated.**
- **There is no install-side rescue either.** `createFromTemplate.ts` does not mention the field,
  and the install logged only `Project created successfully`. **No toast, no warning, nothing.**
- **The landing place is worse than arbitrary.** `/#__page__/Acme Legal Client Portal` is a
  page-scoped internal component, not a page anybody authored to be opened.
- ✅ **And the rescue already exists, one package away** — `noodl-preview/src/loader.ts:131-156`
  `resolveRootNode` guesses a root **and tells the user it guessed**. §2.1 already noted this;
  what is new is that the picker path has now been *watched* not using it.

⚠️ **Registered as a row, not built.** It is a `nodegx-community` change (the same predicate on
the curator's script) and arguably an editor one (warn at install). Owner **`NONE`** — see
[UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md) row 9. 🔴 **It does not block AC2**,
which is about a template that *has* a home, and which passes.

### Reproducing this

```bash
cd ~/vscode_projects/nodegx-community
npm run db:up
export DATABASE_URL='postgres://nodegx:nodegx@127.0.0.1:55432/nodegx_p80_s41'   # already migrated
npm run dev          # localhost:3000
```
Then point `COMMUNITY_URL` at `http://localhost:3000`, launch `dev:debug`, and the two templates
are already on the shelf. ⚠️ **The database `nodegx_p80_s41` and the container are still there** —
the container was left running because `db:down` is not a permitted command in that session.
Fixtures: `def007-curated-src` (home) and `def007-nohome-src` (control) under `NodeGX test
projects`, plus the two installed projects `def007-ac2-drive` and `def007-nohome-drive`.
