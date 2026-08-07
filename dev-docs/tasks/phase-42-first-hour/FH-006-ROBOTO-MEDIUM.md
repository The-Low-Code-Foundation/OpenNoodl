# FH-006 — Where "Roboto Medium" comes from

Covers reported item **5**. Small, but the verdict needs one measurement in your project.

## What was reported

> In text style, Roboto Medium is still in there for some reason, all by itself, can we remove it?

## What research found

`"Roboto Medium"` appears **nowhere** in the repo as a string — not in templates, starter assets,
default tokens, or editor code. POL-006's new-project work ships Inter + Lucide only. The
text-style picker list is 100% project metadata (`StylesModel.ts:12` reads
`ProjectModel.getMetaData('styles')`); nothing seeds it.

Roboto exists in exactly one place: **the shipped prefab/module library**. Entries under
`library/prefabs|modules/*/project/fonts/Roboto/`, referenced by their `project.json` text styles
as `"fontFamily": "fonts/Roboto/Roboto-Medium.ttf"`. Importing any of them copies the TTF into your
project, and then the **font picker** (not the text-style picker) lists it — label derived from the
filename (`fontItems.ts:63-87`), grouped under a `fonts/Roboto` heading **with one entry, alone** —
which matches "all by itself" precisely. (The label would read `Roboto-Medium` with a hyphen.)

## The measurement — DONE. Verdict: library content.

Measured against `NodeGX test projects/Puppy test` (2026-08-05):

- `nodegx.styles.json` has `textStyles` with **exactly one** entry, named **"Label Small"**, whose
  `fontFamily` is `fonts/Roboto/Roboto-Medium.ttf`.
- `fonts/` contains **exactly one** file: `fonts/Roboto/Roboto-Medium.ttf`.
- The project contains an imported **Date Picker** prefab, which is where both came from —
  `library/prefabs/date-picker/project/project.json` ships that identical `"Label Small"` style.

**The doc's dichotomy above was slightly wrong.** The answer falls *between* the two branches: the
text-style key **is** present, but the style is not named "Roboto Medium" — it is named
"Label Small". What was seen as "Roboto Medium, all by itself" is the **font picker** entry: the
project ships exactly one font file, so the `fonts/Roboto` group has exactly one entry, alone,
labelled `Roboto-Medium`. That is the font-picker prediction, confirmed. So it is neither
"user data to delete" nor "no style key at all" — it is imported prefab content, and **the fix is
library content**. No AI authoring path invented anything.

Two premises above were also wrong, corrected here:

| Doc said | Actually |
|---|---|
| "Sixteen" entries ship Roboto | **18** — 16 prefabs + 2 modules (`modules/image-cropper`, `modules/panning-and-zooming-control`) |
| Roboto-Medium, "~34" `fontFamily` refs | **three weights, 39 refs**: `Roboto-Medium.ttf` ×21, `Roboto-Regular.ttf` ×15, `Roboto-Bold.ttf` ×3 |
| "Inter equivalents" (source unstated) | Inter is **not** in `library/`. The TTFs ship at `packages/noodl-core-ui/src/assets/fonts/Inter/` (Regular, Medium, Bold, + 6 more). Sourced from there. |

And a **19th entry** no grep of the survey found, only the check did: `modules/simple-tooltips`
names Roboto in a `style.fontFamily = 'Roboto, Oxygen, …'` string inside its *minified* bundle. It
ships no TTF, so it never polluted the picker — it just rendered Roboto on machines that have it.

## What to build (assuming the library-content verdict) — DONE

1. Sweep `library/` + `library-dist/`: Roboto TTFs → Inter equivalents; rewrite the
   `fontFamily` style values; regenerate dist zips.
2. A check that fails if any library project references a font file it doesn't ship, or ships a
   font family the design system has retired (write the check before the fix list — phase-39
   rule).

### How it was built

The check lives in `scripts/library/check.ts` (`checkFonts`), wired into the existing
`npm run library:check` gate rather than a sibling script — one gate, not two. It was written
first and **was red**: 19/58 entries failing.

The check had to be widened **twice**, and each widening found real content the previous pass
called clean:

1. First pass scanned JSON for `fontFamily` *keys* + CSS `font-family:` in code files. Found 18.
2. `simple-tooltips` sets the family via `style.fontFamily = '…'` in JS, not CSS. Added a JS
   pattern → 19. (The first attempt at that pattern used one capture group plus a backreference
   and silently missed it, because the family list contains the *other* quote character:
   `'Roboto, …, "Open Sans", sans-serif'`. Each quote style now gets its own group.)
3. After the sweep the check went green **while Roboto was still in four `project.json` files** —
   `font-family: Roboto, sans-serif` inside a CSS string in a *Javascript node's `code` parameter*,
   i.e. a JSON string **value**, invisible to a `fontFamily`-key walk. `.json` and `.map` are now
   scanned as raw text as well as parsed. That widening put 5 entries back to red.

Sweep result, counted from `git status`, not from memory: **19 entries changed**; **46 Roboto TTFs
deleted** plus the 2 Roboto `LICENSE.txt` they shipped with (48 files removed); **27 Inter TTFs
added** — only the weights each entry actually references, which is why `image-cropper` goes from
12 shipped Roboto weights to 3 Inter ones — plus Inter's `LICENSE.txt` into each of the 18 font
directories (45 files added, SIL OFL requires the licence to travel with the font, and the Roboto
dirs already did this); **39 `fontFamily` path references** rewritten; **8 bare CSS/JS family
names** rewritten (4 `project.json` code parameters, 2 in `simple-tooltips`' bundle, 2 in its
sourcemap).

**Every changed entry's `library.json` version was bumped.** This is the phase-21 stale-zip cache
trap and the bump is the entire fix for it: the zip filename carries the version, so
`date-picker-1.3.0.zip` → `date-picker-1.4.0.zip` is a *new URL*, which is what makes
`getModuleTemplateRoot`'s "never re-download a non-empty cache folder" behaviour correct instead of
a trap. A same-URL republish would have silently done nothing for every existing user.

### Filed, not fixed

A bare `font-family: Inter, sans-serif` in an injected CSS string **still does not resolve to the
bundled TTF**, and never did with Roboto either. `fontloader.ts` derives the CSS family from the
*filename* — `Inter-Medium.ttf` registers as family `Inter-Medium`, not `Inter`. So those four
datepicker-popup CSS blocks have always fallen back to the system font unless the viewer's machine
happens to have the family installed. The sweep changed *which* family is named, not whether it
resolves. Fixing that properly means naming the registered family (e.g. `'Inter-Medium', Inter,
sans-serif`) and depends on load ordering — out of scope here.

## Criteria

1. Fresh project → import the date-picker prefab → font picker shows no Roboto group. — **needs a
   human**; not verified without the editor.
2. The prefab still renders with a real font (Inter), not a fallback serif. — **needs a human.**
3. The library check is green and would have been red before the sweep. — **verified.** Red at
   19/58 failing before, `58/58 entries clean` and exit 0 after; `library:build` and
   `library:verify-dist` both green; a content-level scan of all 58 built zips finds zero Roboto
   bytes.

## Note for whoever reads this next

A library fix is **not** retroactive. Richard's existing "Puppy test" project already has its own
copy of `fonts/Roboto/Roboto-Medium.ttf` and its own `"Label Small"` style pointing at it. Nothing
here cleans that up — he deletes the font via the picker and repoints (or deletes) the style, or
re-imports the Date Picker from the republished library into a fresh project.
