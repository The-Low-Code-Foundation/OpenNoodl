# FH-006 — Where "Roboto Medium" comes from

Covers reported item **5**. Small, but the verdict needs one measurement in your project.

## What was reported

> In text style, Roboto Medium is still in there for some reason, all by itself, can we remove it?

## What research found

`"Roboto Medium"` appears **nowhere** in the repo as a string — not in templates, starter assets,
default tokens, or editor code. POL-006's new-project work ships Inter + Lucide only. The
text-style picker list is 100% project metadata (`StylesModel.ts:12` reads
`ProjectModel.getMetaData('styles')`); nothing seeds it.

Roboto exists in exactly one place: **the shipped prefab/module library**. Sixteen
`library/prefabs|modules/*/project/fonts/Roboto/Roboto-Medium.ttf`, referenced by their
`project.json` text styles as `"fontFamily": "fonts/Roboto/Roboto-Medium.ttf"`. Importing any of
them copies the TTF into your project, and then the **font picker** (not the text-style picker)
lists it — label derived from the filename (`fontItems.ts:63-87`), grouped under a `fonts/Roboto`
heading **with one entry, alone** — which matches "all by itself" precisely. (The label would read
`Roboto-Medium` with a hyphen.)

## The one measurement that settles it

Open the project you were driving and look at `metadata.styles.text` (in `project.json` /
`nodegx.styles.json`):

- **Key absent** → you saw the font picker listing an imported prefab's TTF. The fix is library
  content: replace Roboto with Inter in the 16 `library/` prefab/module trees (fonts + the ~34
  `fontFamily` references in their styles), mirror into `library-dist/`, and remember the
  stale-zip cache trap (phase 21) — the editor caches library zips.
- **Key present, named "Roboto Medium"** → it's data in that project (user- or AI-authored);
  delete via the picker's trash icon, no code change — but then check whether an AI authoring
  path invents text styles it shouldn't.

## What to build (assuming the library-content verdict)

1. Sweep `library/` + `library-dist/`: Roboto TTFs → Inter equivalents; rewrite the
   `fontFamily` style values; regenerate dist zips.
2. A check that fails if any library project references a font file it doesn't ship, or ships a
   font family the design system has retired (write the check before the fix list — phase-39
   rule).

## Criteria

1. Fresh project → import the date-picker prefab → font picker shows no Roboto group.
2. The prefab still renders with a real font (Inter), not a fallback serif.
3. The library check is green and would have been red before the sweep.
