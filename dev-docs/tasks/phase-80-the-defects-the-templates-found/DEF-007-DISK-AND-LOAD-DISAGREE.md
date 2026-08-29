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
- **0 of 97.** Every project directory on this machine with a manifest: **91** carry `rootNodeId`,
  **2** carry both, **6 carry neither**, and **none carries `rootComponent` alone**. The population
  §3.3's resolver would rescue is empty, and the two that carry a name (`SBR No Backend`,
  `alpha007-hostile-fixture`) carry an id beside it, which `fromJSON` prefers anyway.
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
- **6 of 97** carry no home (`ac4-drive`, `cn012-drive`, `fb015-drive`, `fb017-drive`,
  `fb018-drive`, `test`). They are 0–2 component scratch projects rather than publishable
  templates, so this is a **live hole, not a live incident** — but it is the hole AC1's sentence
  falls through, and the resolver in §3.3 would not have closed it.

🧭 **A decision, not a fix to be guessed at**: refuse at publish (*"this project has no home"*),
or resolve-and-warn at install the way `loadPreview` already does. Refusing is honest about a
template nobody can open; warning matches the behaviour a person already gets from preview.

## 3. Scope

1. **Name the seam.** A single documented answer to *"what does a project on disk mean?"* — and which
   of export / deploy / headless render / template generation apply the migrations and which do not.
2. **(a)** Either apply the load-time migrations on the disk-reading paths too, **or** make template
   generation write the explicit values so an artefact is correct as written. ⚠️ The second is what
   phase 78 D14 chose for its own template and it is the cheaper, narrower option.
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
   📊 **Measured 2026-08-29: they disagree in 56 places across 13 components** on the shipped
   site-builder artefact — see §6.1. The pair is currently **red**, and that is the starting
   number this criterion has to drive to zero.
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
