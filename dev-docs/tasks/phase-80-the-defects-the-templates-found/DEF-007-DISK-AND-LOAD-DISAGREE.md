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

**Added 2026-08-29** from phase 77's SBR-016 drive (their s14), and it **changes §1's last
sentence.** §1 exonerates the migration — *"None of that is the defect"* — on the reading that it
faithfully preserves a **pre-§2** author's intent and only the non-loading paths disagree. D11 is a
case that reading does not cover:

> The migration reversed two queries in `/Pages/Admin` and `/Pages/PageEditor` of a template
> **authored entirely after §2**, on an ordinary editor load. The author deliberately wanted a
> load-time fetch; `storageFetch` was wired; the migration wrote `runOnChange-collectionName: false`
> and `runOnChange-qp-pageId: false` and the fetch stopped happening.

**Read at HEAD, and the peer's account holds with one correction:**

- `RUN_ON_CHANGE_FAMILIES` has **17** families, not fifteen.
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

## 3. Scope

1. **Name the seam.** A single documented answer to *"what does a project on disk mean?"* — and which
   of export / deploy / headless render / template generation apply the migrations and which do not.
2. **(a)** Either apply the load-time migrations on the disk-reading paths too, **or** make template
   generation write the explicit values so an artefact is correct as written. ⚠️ The second is what
   phase 78 D14 chose for its own template and it is the cheaper, narrower option.
3. **(b)** Give `PlatformTemplateProvider` the same `rootNodeId` resolution
   `EmbeddedTemplateProvider` already has — by **id lookup**, independent of the NodeLibrary.

## 4. Acceptance criteria

1. **A person's sentence:** *I pick a template from the shelf, press preview, and the app is there.*
2. (b) A curated template installed **through the picker** opens on its home component. Driven, once
   the picker can reach it.
3. (a) A generated artefact rendered **from disk** and the same project **loaded in the editor**
   agree about every `runOnChange-*` — asserted as a **pair**, because either one alone is the state
   this task exists to distinguish.
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
