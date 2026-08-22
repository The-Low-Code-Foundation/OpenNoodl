# FB-015 — the empty box called Source

**Filed:** 2026-08-22, test-user session, item 1. **Status: ⬜ open — no coverage anywhere.**
Size: M.

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
