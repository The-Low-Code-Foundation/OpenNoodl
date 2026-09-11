# SBR-009 — The theme editor demos itself

**Fixes finding 3's surface.** Screen 4 — "the demo the template exists to give". The screen
already writes a record and applies it to the document root; once SBR-003/004/006 land, its
writes become live. This task makes the screen worthy of being the product's best moment.

## 1. The person sentence

**A client can change their site's colour and see the site change** — the phase's root
sentence, on the screen built for it.

## 2. Scope

- **Grouped sections**: Site (name, home page — already save here), Colour (primary,
  background, text), Type & shape (heading font, corner rounding) — labelled, in cards.
- **Presets row**: Studio / Press / Night from SBR-003's data. Picking one fills the fields;
  Save writes the record. A client never faces an empty colour picker.
- **Live preview panel beside the fields** — a mini rendering (hero + button + card) that
  applies the *edited-but-unsaved* values locally, so a change is visible without leaving the
  screen. Local-only: this is not SBR-011's cross-app preview.
- The Theme record schema per SBR-003 (the wider subset), and `applyTheme` extended to write
  exactly that subset.

## 3. Acceptance criteria

1. **(person)** Changing primary and saving changes the public site AND the admin panel itself
   (both apps consume the same tokens) — driven, colour read back from a resolved style.
2. **(person)** Picking the Night preset restyles the preview panel immediately, before save;
   Cancel/never-saving leaves the site unchanged (negative control).
3. Deleting the Theme row falls back to Studio (SBR-003 AC4 driven from this screen's "reset"
   if one ships, or by direct record deletion).
4. The three prop- wires this screen owned (census: `/Pages/ThemeEditor` 3) save correctly on
   deploy once SBR-008 lands — re-read the chip, don't assume.

## 4. Traps

- 🔴 A token write is invisible in the same eval; smooth scroll zeroes `scrollTop` — drive with
  the second-call pattern.
- 🔴 The preview panel must consume the SAME token names, not a copied palette (the
  second-copy-drifts trap wearing a preview costume).

---

## 5. BUILT — s37, 2026-09-01. AC2 driven in a browser; AC1 half-measured, AC3 blocked

`/Pages/ThemeEditor` was **eleven controls in one flat column**: four unlabelled colour boxes, no
grouping, no starting point, and nothing to look at until you saved and navigated to the public
site. Every part of it worked. **None of it was a demo**, and this screen is the one the phase's root
sentence is about.

It is now **54 nodes** (was 22): three titled cards, a presets row generated from
`SITE_THEME_PRESETS`, and a live preview panel beside the fields. `/Admin/PresetChip` is a new
component placed three times. `/Admin/Shell` gained a Theme query and an applier, so the admin panel
wears the client's colours too.

### 5.1 🔴 The blocker was in the task file all along, and it was not a conflict

The presets row **cannot exist** under SBR-012's gate as it shipped: `rawColoursInArtefact` was
asserted `toEqual([])` and a second arm refused a hex anywhere in the artefact's 290 KB. A preset row
is three palettes; there is no way to author one without literals.

It reads like a ruling collision, and the right move was to look before repealing anything. **SBR-012
§2, scope bullet 4, already ruled it** — *"the artefact-level scan is therefore textual over
parameter values AND script sources, with the `designTokens`/**preset-data** blocks as the one
allowed home for literals."* The gate was built (s35) with an empty list because there was no
preset-data block yet. SBR-009 built the block the scope anticipated.

🔴 **The exemption is one row and it is not a relaxation.** `TEMPLATE_COLOUR_EXEMPTIONS` names
`/Pages/ThemeEditor | The three presets | functionScript`, and beside it `presetHexesInArtefact()`
asserts the **24 hexes in that script are `SITE_THEME_PRESETS`, in order**. A hand-edited preset, a
fourth palette pasted in, a digit nudged: all satisfy the exemption and all fail the derivation. The
source population gains nothing — the script is `JSON.stringify(SITE_THEME_PRESETS)`, so the hexes
are hand-written in exactly one file in the repository.

### 5.2 🔴 The drive found a defect the graph could not: the screen picked Night for you

First render, before any fix: the preview was already **Night**, all five boxes pre-filled with
Night's values, and nobody had clicked anything.

`presets` reads `in-name` from three chips, and each chip publishes its `name` **at mount** — a
`Component Inputs` constant per placement. With the checkbox ticked the picker ran three times before
a person touched the screen, last placement winning. **`run` is additive: wiring it does not stop a
node running on its own.** `runOnChange-in-name: false` is what does.

⚠️ **And "unstated" does not mean "unset" in this template.** DEF-007 §3.2's
`pinRunOnValueChangeDefaults` writes `true` into the artefact for every governed checkbox the source
leaves unstated, so leaving the box out is an active choice to run on arrival. The only way to say
*wait for the signal* is to say it.

🔴 This is the **fourth** instance of s36's shape (D36, D39, D41, and now this) and the first found
by a browser rather than by reading a graph. It is asserted twice on purpose: on the parameter
(`sbr009ThemeEditor`) and on the rendered screen (`sbr009ThemeEditorDrive`).

### 5.3 The preview consumes token NAMES — §4's trap, with a mechanism

`previewScope` carries `cssClassName: 'ndl-theme-preview'`; `previewCss` writes
`.ndl-theme-preview { --primary: …; … }` into a **`CSS Definition`** node; every node inside is
authored `var(--primary)`, `var(--surface)`, `var(--radius-md)` exactly like the rest of the
template. A custom property on an ancestor wins for its subtree, so **one token name resolves to the
edited value inside the panel and to the floor outside it**.

The alternative — wiring the edited hexes into the preview's colour ports — was fewer nodes and a
second palette: the panel would show *the fields* rather than *the site*, and would disagree the day
a component started reading a token the fields do not carry. `sbr009ThemeEditor` asserts **no wire
lands on any port inside the scope**, so the class is the only channel there is.

🔴 **Three things in that paragraph were unprovable from the graph, and the drive settled all three.**
`CSS Definition.style` is declared `allowEditOnly` in the node catalog: the door accepted a
connection into it and nothing in the repository said the runtime would honour one. It does — the
rule is present and **empty** on the first paint, which is also the control that makes every later
difference attributable.

### 5.4 What SBR-009 fixed on the way, without being asked

- 🔴 **Save was blanking eight record fields.** `buildTokens` was fed four inputs and wrote twelve
  keys, so opening this screen and pressing Save wrote `''` over `colorOnPrimary`, `colorSurface`,
  `colorTextSoft`, `colorBorder`, `colorAccentSoft`, `radius`, `fontUi` and `measure`. Invisible
  until now because nothing could set them; the presets row is what would have made it lossy. All
  twelve now travel both ways.
- 🔴 **SBR-016's defect, one wire away from returning.** Wiring `saveTheme.done → theme.storageFetch`
  makes NDA-017's migration write `runOnChange-collectionName: false` on every project load, which
  kills the **load-time** fetch — the screen would have opened with eleven empty boxes on a themed
  site. Authored `true`, with the reason beside it, exactly as `/Pages/Admin` does.
- 🔴 **`/Pages/ThemeEditor` was the last bare page in the corpus** (`templateAppearance`'s
  `BARE_PAGES_TODAY`), listed as debt phase 77 owned. The floor is now `[]` for all three templates
  — and the ratchet's positive control had to be **re-pointed**, because it named the very page that
  was fixed. It now constructs its positive by sabotage; the alternative was putting the debt back.
- ✅ **One applier, three placements.** `buildThemeApplierScript()` moved to `siteTheme.ts`
  byte-identically (the artefact's `/Pages/Site` script is unchanged, which is how the extraction is
  proved). The derived companions — `--primary-hover`, `--ring`, `--accent-foreground`, the two
  border steps, the mirrored base family — now have one copy, not three.

### 5.5 AC verdicts

| AC | verdict |
|---|---|
| **1** — *(person)* changing primary and saving changes the public site **and** the admin panel | 🟡 **HALF.** The structure is built and graded: `/Admin/Shell` reads the Theme record and runs the same applier the public site runs (asserted byte-identical, all three), and `saveTheme.done` re-fetches the singleton so the fetch repaints the panel without a reload. **The live half is not driven** — it needs a provisioned backend, and `DbCollection2` fires neither `fetched` nor `failure` with none bound, so the record path does nothing in the harness this session used. The arm that would settle it is a `withRenderedPage({backendPort})` run against a claimed site: read `--primary` off `documentElement` in the admin panel and on `/Pages/Site` before and after a save |
| **2** — *(person)* picking Night restyles the preview immediately, before save; never saving leaves the site unchanged | 🟢 **MET, DRIVEN.** `sbr009ThemeEditorDrive`, 6/6, headless Chrome at 1280×900. Before: root `--primary` `#2563eb`, scope the same, hero painted `rgb(37,99,235)`, five boxes empty, rule present and empty. Click **Night**. After: scope `--primary` `#d9a441`, `--background` `#14161a`, `--radius-md` `10px`, **hero painted `rgb(217,164,65)`**, five boxes filled with Night's values — and `documentElement`'s tokens **unchanged**, and the sidebar item the shell paints from the same token name **unchanged**. The negative control is in the same reading, and it is not vacuous: that sidebar item IS painted from `--primary`, so a leak would have reached it |
| **3** — deleting the Theme row falls back to Studio | 🔴 **NOT MET, and blocked for the same reason as AC1's live half** — a record cannot be deleted from a screen with no backend. No "reset" affordance was shipped: SBR-003 AC4 already drove the fallback from the record side, and adding a destructive button this task cannot drive would be worse than leaving the row open. **Owner: SBR-014**, in the same backend-backed pass as AC1 |
| **4** — the three `prop-` wires save correctly on deploy | 🟢 **MET, read off the chip rather than assumed.** `tests-unit/sb-017`: `/Pages/ThemeEditor` is still **3**, and `unresolvedWires()` is `[]`. The screen is thirty-two nodes larger and owns exactly three `record.prop-*` wires, because the twelve token fields travel as ONE object on one wire — which is what SBR-003's contract asked for |

### 5.6 Gates taken

- ✅ **`sbr009ThemeEditor` — 30/30** (artefact, off disk) and **`sbr009ThemeEditorDrive` — 6/6**
  (headless Chrome, real render).
- ✅ **`sbr012RawColourGate` — 27/27** (was 25; +2 are the colour-exemption pair and the derivation).
- ✅ **`sb005AdminPanel` 34/34, `sb006PublicSite`, `sb007Template` 62/62, `templateAppearance` 24/24.**
- ✅ **`@noodl/mcp` package suite — 85 suites, 1116 of 1117**, file count reconciled against
  `jest --listTests` (**85**). ⚠️ The one red is **`tpl001Template` on `templates/members-area`**, and
  it is **not this work**: a peer session was editing that template and `tpl001Components.ts` while
  this suite ran (mtimes 22:32 and 22:37 against a 22:40 reading). Nothing here touches members-area.
- ✅ **`tsc --noEmit` on `@noodl/mcp` — exit 0.**
- ✅ **`npm run template:site-builder` — 31 components, 6 pages registered**, and `sb007Template`'s
  byte-identity arm green against it.
- ⚠️ **Editor `test:main` — 4 failures in 3 suites, 6633 passed**, and all four are **pre-existing and
  attributable by name**: `sb-018/every-wired-text` and `sb-018/the-list-refreshes` are SBR-005's
  (`/Site/SectionView body`, and `/Admin/SectionRow`'s new `DropAt`/`DropIndex`), and
  `aib-007/backendRequirement` (`noodl.cloud.listusersinrole` unclassified) is red at HEAD and has
  nothing to do with this template. The four editor-side censuses this work DID move —
  `tests-unit/sb-007` ×3 and `tests-unit/sb-017` ×4 — are updated and green.
  🔴 Two of those three sb-007 rows were **already wrong at HEAD** and it was measured rather than
  assumed: with HEAD's artefact in place the component count read 24 against a line saying 22, and
  the node-id count read 295 against a line saying 274. `test:main` is still the unwatched runner
  that D19 named.

### 5.7 What is left on this task

**AC1's live half and AC3**, both behind the same door: a provisioned backend. They are one session's
work together and belong with SBR-014's pass rather than as a separate row.
