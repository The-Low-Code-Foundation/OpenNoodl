# FB-015 — the empty box called Source

**Filed:** 2026-08-22, test-user session, item 1. **Status: ✅ DONE, DRIVEN in the real editor
2026-08-24 (session 21).** All five ACs. Size: M (delivered M+, see AC4).

> *"The image node 'source' and 'source set' are confusing. First of all I don't know the
> difference. Second, the source input doesn't make it clear in any way that you need to either
> add a URL, or add an image… to your project folder. Having a button here to click to take the
> user to the project folder would be nice, maybe making an assets folder already? And having a
> visual explanation in the menu that pops up… because it's an empty box by default with no
> explanation why."*

---

## Ground truth (verified 2026-08-22)

- `src` ("Source", type `image`) and `srcSet` ("Source Set", type plain `string` — a raw HTML
  `srcset` list) live in `packages/noodl-viewer-react/src/nodes/visual/image.ts:79–106`.
  `srcSet` has **no picker, no validation, no affordance** — and `getInspectInfo`
  (`image.ts:34–44`) prefers it, so Source Set silently wins the inspector readout.
- **The empty box is exact**: `DataTypes/ImageType.ts:36` — `if (!filesLeft) return;` — with no
  images in the project, items are never added, and `ContentPicker`
  (`components/ContentPicker.tsx:97–104`) has **no empty state at all**: the "Choose image"
  header over a blank scroll div.
- **There is no assets convention and no import path anywhere.**
  `ProjectModel._listFilesInDirectory` (`projectmodel.ts:964–1005`) recursively walks the whole
  project directory by extension (it will descend into `node_modules`); folder grouping is
  incidental. No `showOpenDialog`, no copy-into-project, no drag-drop. Files must be placed on
  disk by hand — which nothing tells the user.

## Scope

1. **An empty state that teaches**: when the picker has nothing, say why and offer the two
   routes — *paste a URL* and *import an image*. This is the core fix.
2. **An import path**: an "Import image…" button in the picker (native file dialog → copy into
   the project under `assets/`, created on demand). Establishing `assets/` as the *suggested*
   convention costs nothing — the walker already finds files anywhere, so nothing breaks for
   existing projects; new imports just land somewhere sane. Plus "Show project folder" (opens
   the OS file manager) for the manual route.
3. **Source Set explained or demoted**: at minimum a real description on the field and a
   placeholder showing the `small.png 480w, large.png 1080w` shape; consider moving it under
   FB-017's advanced tier — a `srcset` string is exactly "shit you only use in specific use
   cases". Also fix `getInspectInfo`'s preference so the inspector reports what's actually
   driving the image.

## Acceptance criteria

- AC1: with zero images in the project, clicking Source opens a picker that states both routes
  and offers Import; it never renders a bare empty panel.
- AC2: Import copies the file into `assets/` (created if absent), the picker refreshes and the
  new image is selectable — driven in the running editor.
- AC3: the walker excludes `node_modules` (and dotfolders) — a project with dependencies no
  longer lists their images as yours.
- AC4: Source Set carries a description + example; if demoted to advanced, that's FB-017's
  mechanism, referenced not duplicated.
- AC5: the picker's empty state is shared, not Image-specific — fonts and any other
  `PickerTypeView` with a filesystem source get the same treatment (same component, per-type
  copy).

## Traps

- Drives mutate the opened project (opening already writes 3 files) — drive on a copy.
- The import writes into the user's project directory: use the editor's real write path, not
  `filesystem.writeFile` fire-and-forget (the awaited-callback no-op trap — 13 sites already).


---

# What was built — 2026-08-24 (session 21)

## Ground truth, re-measured before building

**AC4's description half was already done and the file did not know it.** `srcSet` has carried
*"A srcset list letting the browser pick a resolution, e.g. `small.png 480w, large.png 1080w`"*
since **NDA-012** (`d2613cb8`). The ground truth above says the port has *"no picker, no
validation, no affordance"* — true when filed, and one third wrong now. Measured off the source,
not relayed. What was missing was the **placeholder** and the `getInspectInfo` preference; AC4
turned out to be the largest piece of the task.

Everything else in the ground truth held exactly: `ImageType.ts`'s `if (!filesLeft) return;`,
`ContentPicker`'s absent empty state, and a walk with no exclusions at all.

## AC1 + AC5 — the empty state

`ContentPicker` now distinguishes **four** states where it drew one blank panel:

| state | what it draws |
|---|---|
| items | the list (unchanged) |
| loading | *"Looking…"* |
| a filter matched nothing | *"Nothing here matches “zzz”."* |
| the project has none | the empty state: why, plus both routes |

🔴 **The filed bug is the loading/empty pair.** `if (!filesLeft) return;` meant a project with no
images never got `addItems` at all — so *"empty"*, *"still walking"* and *"the loader gave up"*
were the same bytes, and the one that actually happened was the third. Every loader now reports on
every path out, including the ones that find nothing, and `openContentPicker`'s handle
(`addItems` / `setItems` / `setLoading` / `isOpen`) is what makes that expressible.

✅ **One shared component, per-type copy** (AC5). The copy lives in `components/pickerEmptyStates.ts`
rather than inline in the `PickerTypeView` subclasses — those reach `ProjectModel`, Electron and
the DOM, so nothing can grade them outside a running editor, and *an empty state that exists only
as a string literal inside an unreachable file is graded by reading the file, which passes just as
well on a literal nothing renders*. Built there, the strings **and the wiring of the buttons** are
real values a spec calls.

Coverage is a **sweep**, not a list: `emptyStateCoverage.test.ts` parses every
`this.openContentPicker(` call site out of `DataTypes/` and requires an `emptyState` or a written
reason. **3 pickers carry one** (image, file, identifier); **`FontType` is the one exception**, and
structurally — `loadFontItems` pushes the eight `COMMON_FONTS` synchronously before it looks at the
project, so its no-rows branch is unreachable. FB-018 stalled at 5 of 36 row classes for three
phases because nothing recorded that it had; this is the same shape, and the sweep is the guard.

## AC2 — the import

`utils/projectAssets.ts`, dependency-injected so the naming rules are gradeable without a disk.
`ImageType` supplies the real `filesystem` calls wrapped as promises — **not** the awaited-callback
no-op this repo has thirteen sites of; a failed copy reaches `ToastLayer.showError`.

🔴 **The platform's `makeUniquePath` cannot be used here.** It appends its counter to the end of
the whole path: `assets/logo.png` becomes **`assets/logo.png-1`**. For a project file that is ugly;
for an *image* it is the filed bug arriving by another door — the walk filters by extension, so the
imported file **would not appear in the picker that just imported it**. Names are made unique
before the extension: `logo-1.png`.

A file **already inside the project** is not copied, just selected — otherwise "Import" on
something the author already has leaves them two copies and a picker listing both. That test is
path-anchored (`root + '/'`), so `…/My App Backup/x.png` is not mistaken for `…/My App/x.png`.

## AC3 — the walk

`utils/projectDirectoryWalk.ts`: `node_modules` and any dot-prefixed directory, **matched by path
segment, never by substring**. DEP-008 already paid for that lesson — `fullPath.indexOf('.git')
!== -1` silently dropped `pre.gitlab-assets/` from every deploy. Deliberately **not** the deploy's
gitignore matcher: its defaults exclude `project.json`, `docs/` and a v2 project's `components/`,
which is right for publishing a build and wrong for *"show me my files"*, where hiding a file the
author can see on disk is the defect rather than the feature.

Four callers benefit, not one: both pickers, the font list and both halves of the import flow.

## AC4 — Source Set, and the field that crosses five hand-written lists

`getInspectInfo` used to `return this.props.dom.srcSet` and stop, so an author debugging **Source**
saw only the srcset string — no hint Source was set, and no preview. Both are reported now,
labelled, because both are true. Only `src` can be previewed: which `srcset` candidate the browser
took depends on the viewport and the device pixel ratio at the moment it decided.

The placeholder is the part worth reading.

### 🔴 FIVE hand-written field lists sit between a node definition and the property field

A port's `placeholder` has to be named in all of them. **Four were dropping it**, and every one was
found by driving, never by reading:

| # | list | dropped it? |
|---|---|---|
| 1 | `nodedefinition.registerInput` — the metadata builder | 🔴 **yes** |
| 2 | `InputPortMetadata` (`noodl-types`) | 🔴 **yes** — a type error, so this one was loud |
| 3 | `nodelibraryexport.formatPort` | no — added first, and alone it did nothing |
| 4 | `PropertyPanelInput`'s prop hand-off — six props, explicit, **not** a spread | 🔴 **yes** |
| 5 | `PropertyPanelTextInput`'s hand-off | 🔴 **yes** |

⚠️ **ERG-004 wrote up list 3 and only list 3.** Its note explains at length why a hand-copied
duplicate *inside* `nodelibraryexport` deleted every output-port description in the library, and
concludes by delegating so "the same trap is not set for the next field". The trap was set four
more times, in four other files, and nothing said so. **`formatPort` is the famous one, not the
first one** — list 1 runs earlier and drops the field before the export can see it.

🔴 **Each intermediate state read as "done" from the source.** After list 3, `formatPort` copied
`placeholder` and `image.ts` declared one — both files correct, and the field still arrived
`undefined`. The measurement that separated them was the drive.

### AC4's own drive table

| field | node | declares a placeholder | value | placeholder rendered |
|---|---|---|---|---|
| **`srcSet`** | 0010 (untouched) | ✅ | `""` | ✅ **`small.png 480w, large.png 1080w`** |
| `srcSet` | 0020 (set) | ✅ | the srcset | present, hidden by the value (correct) |
| **`alt`** — control, same node, **same `BasicType` path** | 0010 | ❌ | `""` | **none** |

✅ The control is on the *same* code path deliberately. `src` also shows no placeholder, but it is
an `ImageType`/`PickerTextInput` row — a different hop, so it could not have excluded *"the field
stamps every input"*.

---

# The drive (real editor, CDP, no browser) — 2026-08-24

`NodeGX test projects/fb015-drive`: two `Image` nodes, and on disk **four images that must not be
offered** — `node_modules/some-dep/dep-logo.png`, `node_modules/some-dep/assets/dep-hero.jpg`,
`.cache/cached-thumb.png`, `.git/gitthing.png` — plus an empty `my.node_modules.backup/`.

**AC1.** Source clicked, popout read out of the live DOM: header *"Choose image"*, **0 items, 0
"Looking…", 1 empty state**, reading *"This project has no images yet. / Type or paste an image URL
into the field, or import a file — it is copied into your project's assets/ folder and appears
here."*, with **`["Import image…", "Show project folder"]`**.

**AC2.** Import driven with a **trusted** `Input.dispatchMouseEvent` plus
`Page.setInterceptFileChooserDialog` + `DOM.setFileInputFiles`, all on **one** CDP connection.
🔴 `<input type=file>.click()` needs transient user activation, so a programmatic `el.click()` from
`Runtime.evaluate` opens nothing — and *"no chooser"* and *"the button is not wired"* are the same
picture. Three imports, in order:

| import | on disk | picker after | Source field |
|---|---|---|---|
| a file from outside | **`assets/imported-logo.png`**, folder created | 1 item, 1 thumbnail, empty state gone | `assets/imported-logo.png` |
| **the same file again** | **`assets/imported-logo-1.png`** | 2 items | `assets/imported-logo-1.png` |
| a file **already in the project** | **nothing** — still 2 | 2 items | `assets/imported-logo.png` |

✅ The popout survives the native dialog: `popuplayer` dismisses only on a pointerdown **and** a
pointerup that both land outside it, and it explicitly disarms on `window.blur`.

**AC3, measured beside a known-firing signal.** With **7** image files on disk the picker listed
**3** — the two in `assets/` and `my.node_modules.backup/mine.png`. ✅ The lookalike folder proves
segment matching rather than substring; ✅ the two `assets/` rows *with thumbnails* prove the walk
works, so the four absent ones are excluded rather than a loader that found nothing. Without that
arm, "0 items" fits *"the exclusion works"* and *"the picker is broken"* equally well.

## 🔴 What the drive found that 32 green specs could not

**The Import button only existed while the picker was empty.** Every spec passed; the live import
worked; then the picker refilled, the empty state went away — **and the Import button went with
it**, so a second image could not be imported at all. The route vanished exactly when the author
started using it.

Nothing in the suite could have caught it, because **every arm rendered an empty picker**. The
state where the button was missing was the one nothing thought to look at. Actions are now a
`ContentPicker` footer that is always drawn, `ContentPickerEmptyState` carries only prose, and
three new specs render a **non-empty** picker and a **filtered-to-nothing** picker and require the
button in both.

⚠️ **A second instrument lesson.** The viewer webview (`http://localhost:8574/`) is what runs
`nodelibraryexport`, and **`cdp reload` does not recreate it** — an editor reload kept measuring
the node library the webview had loaded minutes earlier. Two *"the change did not work"* readings
were that, not the change. `reload --target=viewer` is the already-documented trap (it reloads the
editor); reloading the webview target directly over raw CDP is what worked.

## Gates

- `npm run test:main`: **319 files / 5137 specs / 0 failures** (mine: 4 files, 38 specs).
  ⚠️ An earlier run showed **1** failure in `bld-004/reasoningChannel` — *"nothing arrived for 0
  seconds"* — which passed **8/8 alone** and again in the clean run. A timing-sensitive stall
  detector under load, not FB-015.
- `noodl-runtime`: **141 passed / 1 skipped, 2560 specs, 0 failures** (mine: 1 file, 6 specs).
- `noodl-viewer-react`: **75 files / 965 specs / 0 failures**.
- **21 mutations, all red, none survived, none anchor-missed** — 17 over the editor half, 4 over
  the placeholder path including *"stamp every port with one"*.
- `typecheck:editor` / `:viewer` / `:runtime` / `:editor-tests` / `:mcp`: **0**. `typecheck:core-ui`
  **44**, all `TS2307`, all pre-existing, **none in a file this session touched**.
- ✅ The typechecker was **proved to see the new files** by planting an error in each:
  editor **2 → 0**, viewer **1 → 0**.
- 🔴 Re-measure rather than quoting this section.

## Deliberate remainders

- ⚠️ **Lists 4 and 5 are covered by the drive and by nothing else.** `PropertyPanelInput` and
  `PropertyPanelTextInput` both call hooks, so `tests-unit` cannot render them. Lists 1–3 are
  graded in `noodl-runtime/test/nodelibraryexport.port-placeholders.test.ts`, and the destination
  via `PropertyPanelBaseInput`, which calls none.
- ⚠️ **`getInspectInfo` is specced by neither suite and not driven** — reading it needs a running
  preview with an Image node, which this stack did not have up. The change is small and its
  reasoning is in the file.
- ⚠️ **`placeholder` is input-only**, pinned by a spec so it reads as a decision rather than a gap:
  an output port renders no editable field. It matches `default`, `tab`, `popout` and
  `allowVisualStates`, already input-only in the same builder.
- ⚠️ **`FileSystem.chooseFile` had no callers and an ignored `options`**, so any caller would have
  got a JSON-only dialog whatever it asked for. It honours `options.accept` now, defaulting to the
  old behaviour — the 24th *build the caller*.
- ⚠️ Scope 3's *"consider moving Source Set under FB-017's advanced tier"* is left to **FB-017**,
  as the scope says: referenced, not duplicated.
- Fixture kept: `NodeGX test projects/fb015-drive`, and the CDP file-chooser driver is worth
  keeping in mind — nothing else in this repo answers a native dialog.
