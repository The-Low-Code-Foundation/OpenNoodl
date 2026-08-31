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
2. (b) A curated template installed **through the picker** opens on its home component. Driven, once
   the picker can reach it.
3. (a) A generated artefact rendered **from disk** and the same project **loaded in the editor**
   agree about every `runOnChange-*` — asserted as a **pair**, because either one alone is the state
   this task exists to distinguish.
   ✅ **GREEN 2026-08-31 (s31).** Was 56 on 2026-08-29, re-derived at **65** two days later, now
   **0** — the whole seam, both `applyPatches` passes, measured with the before artefact as a
   red control. See §6.2. Gated by `DEF-007 AC3` in `sb007Template.test.ts`.
4. The seam's documentation names each path and which side it is on.

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
