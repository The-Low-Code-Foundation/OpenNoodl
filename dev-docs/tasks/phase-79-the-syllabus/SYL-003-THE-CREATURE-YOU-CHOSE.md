# SYL-003 — the creature you chose

| Field | Value |
|---|---|
| **Prefix** | `SYL` |
| **Effort** | M |
| **Surface** | `editor` (the image property picker), `docs` |
| **Rules** | Richard, 2026-08-28 — see §"The ask" |
| **Blocks** | nothing. Lesson 1 ships without it and **upgrades** to it later |

## The ask

Asked where lesson 1's creature picture should come from — offered three options
(draw it from Circles, a shipped Lucide glyph, or the learner supplies a file) — Richard
proposed a fourth:

> *"We need some kind of image avatar search API type thing where they can search for an image by
> keyword and select one, something with PNG avatars or something? It must exist"*

✅ **He is right that it should exist, and right that nothing here does it.** This task is that
capability. It is **not** a lesson task: it serves templates, every future tutorial, and anyone
who has ever needed a placeholder face in a mockup.

## What exists today, measured

- **The search UX already exists — for icons.** [`iconpicker.jsx`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/iconpicker.jsx)
  has a filter box (`iconpicker-search-input`, line ~159) over the Lucide set. 🔴 **Copy this
  pattern rather than inventing one** — it is the interaction Richard described, already shipped,
  and it works offline.
- **The image picker has no equivalent.** [`ImageType.ts`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/ImageType.ts)
  lists what is already in `assets/` and offers "import a file" (FB-015 AC2). No search, no remote
  source, no generation.
- **Nothing ships a picture.** `STARTER_ASSETS` carries the four Inter weights and the Lucide
  icon font — **no images at all** — and `log-a-thing` ships none either.
- ⚠️ **The only `unsplash` strings in the repo are inside MCP test fixtures** — a model inventing
  URLs in a replay capture. There is no integration to build on, and finding those strings in a
  grep is not evidence of one.

## 🔴 Two constraints that should shape the answer

**Offline.** Lesson 1 is the most beginner-facing artefact we ship. A remote image search makes a
network call a prerequisite for minute five of the first lesson. [P72 NAT-013](../phase-72-nobody-has-to-leave/NAT-013-WHAT-IT-DOES-WITH-NO-NETWORK.md)
exists to ask what happens with no network, and D17 requires a lesson stay installable from a local
directory with no origin.

**Moderation.** An unfiltered keyword photo search inside a product sold to universities can return
anything, on the first screen a learner ever sees. That is a liability, not a nice-to-have.

## ✅ The shape that keeps the idea and loses both problems: generate, don't search

**DiceBear** and **RoboHash** turn any string into a unique creature. The learner types `Nibbles`
and gets *their* creature, deterministically — which is closer to what Richard actually asked for
than a photo search, because the result is theirs rather than stock.

- No API key, no rate limit, no account.
- **DiceBear is MIT and publishes npm packages that render locally**, so this can work with no
  network at all — which is the version worth building.
- It cannot return anything unsafe, because it generates rather than retrieves.
- ⚠️ **Unverified and worth checking first**: local generation produces **SVG**. PNG would need
  rasterising, and whether the `Image` node accepts an SVG source is a question, not an assumption.
  🔴 Check that before promising it — an `Image` that silently renders nothing is exactly the
  defect this product's authors most often ship.

## Scope

1. Verify the SVG question above. It decides everything downstream.
2. Add keyword → avatar to the image property picker, modelled on `iconpicker.jsx`.
3. Offline by default. If any remote source is added at all, it is **additive** and the picker must
   be fully useful with the network off.
4. Write the chosen asset into `assets/` like `importFileIntoProjectAssets` does, so the project
   owns its picture and the graph references a project asset, not a URL.

## Acceptance criteria

1. A learner can type a word, see avatars, pick one, and it lands on an `Image` node.
2. 🔴 **With the network disabled, it still works** — proven with the network actually off, not by
   reading the code. An offline claim verified only by inspection is the claim this repo has been
   burnt by.
3. The chosen avatar is a **project asset on disk**, so the project still renders after the
   source that produced it is gone.
4. 🔴 **`render_report` shows the picture** — `images.broken: 0` and the screenshot looked at. A
   URL that returns 200 can still be a picture of the wrong thing.
5. Lesson 1 is **not** modified as part of this task. It ships with the Circle creature and is
   upgraded deliberately, so a defect here cannot break the first lesson in the curriculum.

## Traps

- 🔴 **The picker's search is over a shipped set; this one is over a generator.** "No results" for
  an icon means the glyph does not exist; for a generator every string is valid. Do not copy the
  empty state along with the interaction.
- ⚠️ **A generated avatar is deterministic on its seed.** That is a feature — the same name gives
  the same creature, so a lesson's completion condition could in principle check it — but it also
  means a learner who renames their creature gets a *different* animal. Decide which of those you
  want before wiring it to a name field.
- 🔴 **Do not let this become lesson 1's blocker.** It was raised while building lesson 1 and the
  standing rule is that such findings become work, not scope creep into the task that found them.

---

# 🟢 BUILT — session 12 (2026-09-05)

**All five acceptance criteria met and driven in a running editor.** Richard chose this lane over H1
and lesson 8 when asked.

## Step 1 first, because it decided everything: an `Image` node DOES render an SVG

The task said to verify this before promising anything, and it was measured rather than reasoned
about. A DiceBear SVG was written into a scratch project's `assets/`, pointed at by an `Image` node,
and rendered headlessly — **beside a deliberately missing file**, because `images.broken: 0` proves
nothing unless the instrument can be seen reporting a failure.

| arm | reading |
|---|---|
| `assets/svg-probe-nibbles.svg` | rendered — the bot is in the screenshot at 160px, `objectFit` honoured |
| `assets/svg-probe-does-not-exist.svg` | **broken**, reported as `broken-image` |

`2 images (1 broken)`. **So there is no rasterising step and no PNG**, and the whole feature stays
offline. The scratch page and asset were deleted afterwards.

## What shipped

| file | what it is |
|---|---|
| `utils/avatargenerator.ts` | the rules — seeds, slugs, file names, the licence gate. **Imports nothing** |
| `utils/avatarstyles.ts` | the only file naming `@dicebear` packages; webpack-only |
| `utils/projectAssets.ts` | `writeGeneratedAssetIntoProject` + `AssetWriteDeps`, beside the existing copy path |
| `propertyeditor/avatarpicker.tsx` | the popout: keyword box, 9 styles × 4 variations, CC0 footer |
| `propertyeditor/DataTypes/ImageType.ts` | the *Create an avatar…* route and the write |
| `propertyeditor/components/pickerEmptyStates.ts` | the third footer action |
| `propertyeditor/models/modelProxy.ts` | a `label` getter — see D-A below |
| `styles/propertyeditor/iconpicker.css` | `.avatarpicker-tile` — see D-B below |

**Generate, not search**, as the task proposed. Nine styles, four variations each, deterministic on
the seed.

## 🔴 The licensing decision the task did not know it was making

The task recorded *"DiceBear is MIT"*. That is true of `@dicebear/core` and **false of most of the
artwork**, which is licensed per style. Read off the installed packages:

- **CC0 1.0** — `thumbs`, `open-peeps`, `lorelei`, `notionists`, `pixel-art`, `shapes`, `rings`,
  `identicon`, `glass`. **These nine are what ship.**
- **CC BY 4.0** — `adventurer`, `fun-emoji`, `croodles`, `big-ears`, `big-smile`, `micah`, `miniavs`,
  `personas`, `dylan`, `toon-head`. Shipping one obliges an attribution into every project a learner
  exports.
- **"Free for personal and commercial use"**, on a web page, with no licence text — `bottts`,
  `avataaars`.

⚠️ **`bottts` is the obvious creature style and it is deliberately NOT shipped.** That is a
licensing decision for Richard, not a code change: the nine CC0 styles are public domain, which is
the only version defensible in a product sold to universities without somebody signing off on the
other two categories.

`avatarLicenceViolations` is the gate, and **it reads each installed package's own `LICENSE` file**
rather than this repo's list — so a tenth style with a CC BY artist reddens at the moment it is
added. Mutant-checked: flipping the required licence to `CC BY 4.0` turned all nine red.

## Acceptance criteria

| AC | state |
|---|---|
| 1 — type a word, see avatars, pick one, it lands on an `Image` node | 🟢 driven; `Source` committed as `assets/nibbles-thumbs.svg` |
| 2 — **with the network disabled it still works** | 🟢 driven offline **on the product surface**, control armed |
| 3 — the avatar is a project asset on disk | 🟢 `assets/nibbles-thumbs.svg`, 1618 bytes |
| 4 — `render_report` shows the picture, `images.broken: 0` | 🟢 `6 images (0 broken)`, screenshot looked at |
| 5 — lesson 1 is not modified | 🟢 untouched |

### AC2 is the one worth reading

🔴 **`npm run cdp -- network offline` does not survive the CDP client disconnecting.** Setting it in
one command and measuring in the next reported `REACHED THE NETWORK` — the emulation had already
been torn down. A two-command offline test here measures **nothing**, and would have read as a pass.

So AC2 was taken in **one CDP session** (`scratchpad/offline-in-app.js`): emulate offline, run a
`fetch` control, retype the keyword, re-read the grid, run the control again.

```
CONTROL (must be BLOCKED): BLOCKED
typed while offline: typed
OFFLINE RESULT: {"tiles":36,"decoded":36,"alt":"Creatures avatar for Offline Otto"}
CONTROL still armed after the drive: BLOCKED
```

A **brand new keyword** was used so the tiles could not be cached, and the control is read on both
sides of the drive so the absence is asserted beside a known-firing signal.

There is a second, coarser proof in CI: `tests-unit/syl-003/avataroffline.test.ts` runs the real
ESM library in a child process with `fetch`/`net`/`dns`/`http`/`https`/`tls` replaced by throws.
Mutant-checked — removing the `fetch` poison reddens the control while **the other three tests still
pass**, which is exactly why the control has to be there.

## Two defects this task found and fixed

### D-A — `ModelProxy` had no `label`, so the prefill silently did nothing

A `TypeView` is handed a `ModelProxy`, not the `NodeGraphNode`, and the proxy forwards `type` and
`variantName` but never `label` — which is a *getter* on the node. `parent.model.label` therefore
read `undefined` in silence and the picker opened on an empty box, looking exactly like a picker
that had chosen not to prefill. **Measured in the running editor** (`hasParent: true, hasModel:
true, labelType: "undefined"`), not guessed at. Fixed by forwarding it like its two neighbours; the
picker now opens on the node's own name.

### D-B — `.iconpicker-icon` is a 24×24 box built for a 20px glyph

Reused for a 44px avatar it clipped every tile against the next style's header. Found by **looking
at the screenshot**, not by any number: the DOM said 36 images and all 36 had `naturalWidth > 0`.
Fixed with `.avatarpicker-tile`.

## Gates

`test:main` **429 suites / 7178 tests, exit 0**. `tsc -p packages/noodl-editor` **exit 0** (read via
`$pipestatus[1]` — `PIPESTATUS` is a bash-ism and reads empty in this zsh). 20 new specs across
three files, both load-bearing gates mutant-checked.

---

# 🟢 Richard's ruling, 2026-09-05 — the CC BY styles are IN, with the credit carried

Asked to choose between CC0-only, adding the CC BY 4.0 styles, and adding `bottts`/`avataaars` too,
**Richard chose the CC BY styles**. Seven were added, and the obligation that comes with them is
now discharged **inside the learner's project** rather than noted in ours.

| | styles | credit owed |
|---|---|---|
| **CC0 1.0** | Creatures, Hand drawn, Illustrated, Sketched, Pixel art, Shapes, Rings, Identicon, Glass | none |
| **CC BY 4.0** | Adventurers, Fun faces, Doodles, Big smiles, Portraits, Personas, Cartoon heads | **the artist, wherever the work appears** |

**Sixteen styles, 64 avatars per keyword.** `bottts` and `avataaars` remain out — their terms are a
sentence on a web page rather than a licence text — and a spec now names them, so adding one is a
deliberate act with a red test in front of it rather than a plausible one-line addition.

## 🔴 What "carried" means, and why it is not a line in our docs

CC BY 4.0 asks that the artist is credited **wherever the work appears**. What appears is the
*learner's exported app*, not this editor — so a credit in NodeGX's own documentation would satisfy
nobody. Picking a CC BY avatar therefore writes `assets/IMAGE-CREDITS.md` into the project, beside
the picture, where it travels with anything they publish:

```
| picture | style | artist | licence |
| --- | --- | --- | --- |
| assets/cover-photo-adventurer.svg | Adventurers | Lisa Wischofsky | CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) |
| assets/cover-photo-micah.svg | Portraits | Micah Lanier | CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) |
```

The picker shows the artist **beside the style name before the click**, so the author can see what
picking one commits their project to.

## Driven, with the control that makes it mean something

| arm | reading |
|---|---|
| pick **Adventurers** (CC BY) | `cover-photo-adventurer.svg` **and** a credits file with one row |
| pick **Creatures** (CC0) — the control | the SVG lands, and the credits file stays at **one** row |
| pick **Portraits** (CC BY), credits file already on disk | **two** rows, sorted, merged into the existing file |
| `render_report` on the CC BY avatar | `2 images (1 broken)` — the portrait drawn, the deliberately missing control broken |

🔴 **The CC0 arm is the one that matters.** Writing a credit for a public-domain picture would put a
claim in the author's project that the licence does not make, and without that arm "the credits file
has a row in it" would be true whichever way the code branched.

## The gate grew a second half

`avatarLicenceViolations` now rejects **two** shapes: a licence outside the permitted set, and a
CC BY style with **no named artist** — because a credits file with a blank in it reads as an
attribution and is not one. Both halves have a failing arm in the specs, and the disk-reading gate
additionally asserts **cardinality** (`ccByCount` is 7), because "no CC BY style is missing an
artist" is also true when the loop found no CC BY styles at all.

⚠️ **An earlier `test:main` exited 1 while reporting `429 passed, 429 total`.** Three subsequent
runs were clean at exit 0. Recorded as a flake, not chased — but if it recurs it is real.

## Gates after the ruling

`test:main` **429 suites / 7187 tests, exit 0** · `tsc -p packages/noodl-editor` **exit 0** ·
29 specs across the three SYL-003 files, the credits dedupe mutant-checked (removing the filter
reddens exactly the idempotence test).
