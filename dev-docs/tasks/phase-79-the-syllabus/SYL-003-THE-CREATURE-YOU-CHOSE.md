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
