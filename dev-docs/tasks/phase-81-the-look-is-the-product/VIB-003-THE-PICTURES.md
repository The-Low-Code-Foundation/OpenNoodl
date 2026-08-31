# VIB-003 — The Pictures

**Register rows: V7 (closed, and the row was materially wrong — §1(a)), V19 (the instrument), V20 (the door). Opened here: V21, V22, V23.**

Opened 2026-08-31, session 3. **Status: 🟡 PASSABLE — the first phase-81 page on which the imagery/iconography tell does not fire.** See §5 for the verdict, §4 for the five defects the rendering found, §7 for what this task deliberately does not fix. ⚠️ Provisional until Richard has looked (README §3.5).

VIB-002 closed PASSABLE and Richard ruled *"very passable, nearly worthy"*. §5 of that file named
the remaining distance, and the first item on it is this task: **the page he looked at has one
photograph used as a ground and not one icon anywhere.** *"No imagery and no iconography"* is a
disqualifying WordPress-starter tell (README §2) and it is the only one VIB-002 could not clear.

---

## §1 🔴 What was measured before anything was built

Every number here was re-derived from disk this session. Where it disagrees with the README or the
handoff, **the measurement wins** and the disagreement is stated.

### (a) 🔴 The corpus is nearly RIGHT, and this session's first measurement of it was wrong

README §1(d) and register V7 say *"all 62 catalog examples ship `src: \"\"`"*. This session's first
re-derivation agreed and went further — *"three of three Icon nodes set no glyph at all"*. **Both are
false, and the second was false because of how it was measured**: the sweep filtered node parameters
against a key list (`src`, `icon`, `iconName`, `name`, …) that **did not contain `iconIconSource`**.
Every icon read as unset because the question never asked about the field an icon is stored in.
`asked − answered` is not `absent`, and it is worth naming because the wrong number pointed at a
day of work that was not needed.

Re-derived properly across the **64** examples, counting a port fed by a connection as authored —
which it is: an `Image` in an upload recipe *should* take its `src` over a wire.

| reading | count |
|---|---|
| `Image` nodes | 5 |
| …whose `src` arrives over a connection — correct as authored | **4** |
| …unwired **and** empty | **1** (`ui-split-hero`'s hero photo) |
| `net.noodl.visual.icon` nodes | 3 |
| …carrying a complete, drawable Lucide value **including `codeAsClass: true`** | **2** |
| …carrying nothing, and unwired | **1** (`vis-columns-media-cards`' favourite icon) |

So the corpus defect is **two nodes**, not sixty-two — and one of the two is a recipe named after
its photograph (`ui-split-hero`) that has never had one. Everything else was already right.

🔴 **That makes §1(b) and §1(c) worse rather than better.** Two examples have carried correct,
complete icon values — the exact shape the door cannot describe — since 2026-08-08 and 2026-08-29,
and **neither could ever have appeared in a photograph**, because the thing being photographed had
no icon set installed in it. The corpus was not what was broken. The surface that describes it and
the instrument that looks at it were.

### (b) 🔴 The door cannot tell an author what a legal icon value is, and the hint it does give is wrong

The MCP door has **no concept of an icon**. Two hits for `icon` in the whole of
`packages/noodl-mcp/src`, both incidental (a library-shelf field, one word in a tool description).
`get_style_vocabulary` — the surface whose whole job is *"this project's design system… what to
reach for"* — has a `media` category containing exactly **one** entry (`cardImage`) and names no
icon set, no glyph, and no value shape.

Measured at the door rather than from source (`get_node_type('net.noodl.visual.icon',
ports: [...])`), the only thing an authoring model is told is the port description:

> `iconIconSource` — *"Icon value (Icon Source): the glyph, picked from the project's enabled icon
> fonts; stored as class + code."*

and the authoring gate's own hint (`validation/parameterValues.ts:355`):

> `'{class, code}, e.g. {"class":"material-icons","code":"search"}'`

**Both are wrong for the set every new project actually has, and the failure is loud.**

1. **`material-icons` is not installed anywhere.** `STARTER_ASSETS` installs `inter` and
   `lucide-icons`, and nothing else. The example the gate offers names a set the project does not
   own. (It is not invented from nothing — 102 of 102 `iconIconSource` parameters in the shipped
   prefab library are `material-icons`, and `library/modules/material-icons` is a real installable
   module. But it is a **library module a person adds**, not a starter asset, so the door's worked
   example is only correct for a project somebody has already extended. ⚠️ Two prefabs ship the
   module inside their own project directory and the rest do not; whether the prefab install path
   carries it was **not measured here**, and that question is P65's. Recorded as **V20** with that
   bound stated, owner `NONE`.)
2. **`{class, code}` alone renders the glyph's NAME as visible text.** Lucide's manifest is
   `codeAsClass: true`, and `IconGlyph.tsx` branches on exactly that field:
   `codeAsClass === true` puts the code among the classes; anything else puts it in the element's
   **text**. So `{class: "lucide", code: "icon-check"}` — the value the door's own two sentences
   lead to — renders `<span class="lucide">icon-check</span>`: the string `icon-check` set in the
   Lucide webfont. The correct value is `{class: "lucide", code: "icon-check", codeAsClass: true}`,
   and **`codeAsClass` is named nowhere an authoring model can read it.**
3. **The gate accepts a bare string, which FB-019 already proved is undrawable.** `parameterValues`'
   `icon` check returns `null` for any string and its hint says *"or an icon name"*. FB-019
   (P75, closed 2026-08-23) measured a plain string arriving at this port and got **an empty,
   styled span that still takes its `iconSize` in layout**, and resolved deliberately *not* to
   coerce, because two of the three fields come from the installed set's manifest and guessing
   renders blank *having reported success*. The runtime now warns and drops the value — **and the
   authoring gate on the other side of the same product still suggests it.**

🔴 This is register **V9/V10** in miniature and it is the sharpest thing in this task: the door does
not merely fail to *encourage* iconography, it **actively mis-teaches the one value that would
produce it**, and every gate is green while it does so.

### (c) 🔴 The Judge has been photographing a project state no user has ever had

`copyTemplateProject` (`helpers/members-drive.ts:97`) copies `templates/members-area/` verbatim.
That directory is **91 files, all JSON** — no `noodl_modules/`, no font, no icon set.

But `createFromTemplate.ts:119` calls `installStarterAssets` **immediately after** the template
lands, on every creation path, with the comment saying why the order matters. So the project a
person actually opens is *template + Inter + Lucide*, always. The Judge photographs *template*.

Consequences, both of which had to be found before this task could close:

- **Every baseline PNG was rendered without Inter.** `--font-sans` is
  `"Inter, ui-sans-serif, system-ui, …"`, and the `@font-face` that makes the first name resolve
  lives in `noodl_modules/inter/styles.css`, which was not in the photographed directory. The nine
  SHITTY verdicts do not move — a font is not what made them SHITTY — but the pictures were taken
  in the wrong typeface, and a *later* verdict about typography would have been void.
- **No icon could ever have appeared in a Judge photograph, whatever value the artefact carried.**
  `render-from-disk.js` injects module stylesheets and serves the project's assets correctly; there
  was simply no module to inject. This task's own close condition — *"a template page renders with
  real icons through the Judge"* — was **unreachable by construction** until this was fixed.

⚠️ This is the opposite of viewport engineering (README §4). The banned move is making the picture
flattering; this is making the picture *the one a user gets*. The state being restored is the one
the product itself installs, from the app's own bundle, with no network and nothing to approve.
Filed as **V19**.

### (d) Where a picture is allowed to come from

`installStarterAssets` copies into `noodl_modules/`, and `starterAssets.ts` says why in a paragraph
that is load-bearing for this task: `noodl_modules/` is injected into **both** the editor preview
and a deployed build by one scanner, and ships verbatim in a deploy (absent from `build/ignore.ts`'s
defaults). It is the only mechanism in the product that puts an asset in front of the app on both
surfaces, offline.

`shareAsTemplate.ts` adds the rule that governs what may be left out of a shared template:
**a module may be omitted only if the editor can put it back.** Starter assets qualify; anything
else does not.

So there are exactly three honest places a shipped picture can live, and this task uses two:

| where | who puts it there | good for |
|---|---|---|
| `noodl_modules/<set>/` | `installStarterAssets`, from the app bundle | fonts, icon sets, **starter imagery** — present in every project, offline, deployed |
| the project's own `assets/` | the person, or a template that ships it | the app's real pictures |
| an external URL | the author, at their own risk | nothing this repo ships (a URL that 404s is an unchecked claim — doctrine §5) |

---

## §2 The seams, named per README §3.6

| what is missing | seam | fixed here |
|---|---|---|
| The door mis-teaches the icon value; `codeAsClass` is unnameable | GATE / INSTRUCTION | §3(a) |
| No installed icon set is discoverable through any door surface | INSTRUCTION | §3(a) |
| The Judge renders a state with no font and no icon set | GATE (instrument) | §3(b) |
| Every `Image`/`Icon` in the corpus is unset | CORPUS | §3(c) |
| Nothing a template or example may reference exists on disk | CORPUS / VOCABULARY | §3(d) |

---

## §3 What was built

### (a) The door can name a glyph — `get_style_vocabulary` gains an `icons` block

`packages/noodl-mcp/src/iconSets.ts` reads the project's `noodl_modules/` and reports, per installed
set, **a complete copyable value** and every glyph name the manifest declares. The compact `prompt`
rendering carries it too.

🔴 **The advertised value is built by `iconValueForGlyph`, never assembled in the door.** That is the
function the editor's picker stores values with, and FB-019 settled why nothing else may build one:
two of the three fields come from the set's manifest, so anything that guesses *"renders a blank
glyph again, having reported success"*. A door that composed its own literal would agree with the
picker until somebody installed a set with the other `codeAsClass`.

🔴 **It reads the project rather than hard-coding Lucide**, for the same reason. A project carrying a
sprite set gets a `{kind, url, symbolId}` value with no `class` in it at all. "Lucide, always" would
be right for a new project and confidently wrong one install later — which is the `material-icons`
hint's mistake with a fresher date on it.

⚠️ **An empty list stays empty.** A project with no `noodl_modules/` is told, in those words, that
`Icon` will draw nothing and not to invent a value.

### (b) The authoring gate stops teaching the value that does not draw

`validation/parameterValues.ts`' `icon` rule:

- **rejects a bare string** — the value FB-019 measured as an empty styled span that still takes its
  `iconSize` in layout, and which the runtime already reports and drops. ⚠️ **Provably inert for what
  ships**: of the **102** `iconIconSource` parameters across every JSON artefact in this repository,
  100 are `{class, code}` and 2 are `{class, code, codeAsClass}`. Not one is a string.
- **accepts a sprite value** (`kind`/`symbolId`), which the old rule's `typeof value.code === 'string'`
  test would have refused — the third arm of `Noodl.Icon`, and nothing had noticed.
- **names `codeAsClass` in the hint** and sends the author to `get_style_vocabulary`, instead of
  offering `{"class":"material-icons","code":"search"}`.

### (c) The Judge photographs a project, and leaves nothing behind

`judge()` now copies the project to a temporary directory, installs the starter assets there from
the **imported** `STARTER_ASSETS` list, serves that copy, and records what it placed in the manifest
(`written` / `skipped` / `failed` — three facts, because `written: 0` and `skipped: 17` are opposite
ones). The list moved to `starterAssetList.ts`, which imports nothing, so a plain-Node harness can
read it without reaching `@noodl/platform`; `starterAssets.ts` re-exports it so `shareAsTemplate` and
its specs did not have to move.

🔴 **The copy is not tidiness, and the first version did not do it.** `placeStarterAssets` writes
files, and writing them into the caller's directory left seventeen of them inside a checked-in demo
project — after which the *second* run reported `written: []`, `skipped: 17` and failed its own
honesty assertion. An instrument whose reading depends on whether it has been run before is not an
instrument. ⚠️ Neither the copy nor the install can reach the door assertions: nothing writes
`nodegx.project.json`, so AC2's md5 against the shipped file is unchanged.

### (d) Starter imagery, generated and shipped

`scripts/library/make-starter-imagery.js` → `noodl_modules/starter-imagery/`: two wide grounds, three
4:3 tiles, one square portrait, plus a manifest. **~6 KB of SVG for all six.** Added to
`STARTER_ASSETS`, so every project created here has pictures, offline, with nothing to approve.

Two decisions are argued in the script's header rather than assumed:

- **Generated, not sourced.** A shipped photograph carries a licence claim this repository cannot
  check on a reader's behalf.
- 🔴 **Abstract and hue-neutral.** An `<img src>` SVG is a separate document and **cannot read the
  page's custom properties** — `var(--primary)` inside one resolves against nothing. So unlike
  `--gradient-brand`, which VIB-002 wrote in terms of other tokens precisely so a preset re-themes it
  for free, a picture's colours are frozen at generation time, and a branded one clashes the first
  time somebody switches preset — loudly, because it is the largest thing on the page. The brand goes
  on top, as `backgroundGradient`, which is a token and does re-theme.

⚠️ A `noodl_modules/` directory rather than loose files under `assets/`, and not for neatness: that
prefix is what `RESTORED_ON_INSTALL` filters on, so anywhere else would have made six pictures travel
inside every shared template while the installer wrote its own copies beside them.

### (e) The doctrine (`prompts/design.ts` §5)

Rewritten from *"every listing gets a photo"* — true, and with nowhere to point — to naming both
shipped modules, the exact icon literal with all three fields, the sentence about what a missing
`codeAsClass` renders, and the fact that the curated 212 is a starting list rather than a ceiling.
The last bullet is unchanged in spirit and sharper: **an external URL is an unchecked claim; if you
have not seen it, use the starter imagery.**

---

## §4 🔴 Five defects the rendering found, none of them findable from JSON

Every one of these passed every gate. Four are in the shipped corpus and were found only by looking
at a photograph of it.

### (a) `ui-icon-feature-strip` — the icon recipe whose icons could not vary

`/Components/TrustItem` declared a Component Input called `iconName`, the three placements passed
`"truck"`, `"hammer"` and `"rotate-ccw"` — and **nothing was connected to it**. All three
"reassurances" rendered the same truck. Worse, the values passed were bare strings, so a session that
"fixed" it by wiring the port would have produced exactly the undrawable value FB-019 fixed the
runtime to refuse. Repaired: the port is `icon`, it is wired to `iconIconSource`, and each placement
carries a complete Lucide value. A three-up feature strip now shows three glyphs.

### (b) `vis-columns-media-cards` — a component interface with no ports

`card_inputs` was `{"id", "type", "label"}` — **no `ports` array at all** — with three connections
out of it. Every instance parameter was therefore discarded, and the recipe rendered `●Text` three
times. 🔴 **`npm run catalog:examples` passed 64/64, strict, warnings-as-errors**, which makes this a
gate with a hole shaped exactly like the defect: a `Component Inputs` node that nothing plugs is the
one thing the MCP server's own instructions warn about in its opening paragraph. Filed as **V22**.

### (c) The same recipe's cover image had no box

`cover_image` carried no parameters whatsoever — the doctrine's own first imagery bullet
(*"give the image a real box"*) unmet by the recipe that exists to show a cover picture.

### (d) 🔴 An `Icon` with no `iconColor` is **white**

`addIconInputs` defaults `iconColor: '#FFFFFF'`. The favourite glyph rendered white on a white card
and was invisible in the first photograph — a correct, complete, drawable icon value producing
nothing visible. **This is register V14's shape exactly** (a runtime default that manufactures a
defect, with no gate on it), one node along. Filed as **V21**, owner VIB-005.

### (e) The demo builder's own two, kept because they are the same lesson

A hard-coded `visualRoots: ['card']` — the node is `card_root` — made three component instances
render as nothing, under a section heading that still had its words. `textChars` was 606,
`unreachablePx` was 0, and every assertion in the look file passed. And `ground-ridge.svg` was
generated with its light source at the bottom-right corner, which `objectFit: cover` crops out of a
560px hero box: the first render was a black rectangle. **An asset has to be judged in the box it
will be used in**, which is the same sentence as VIB-002 §4(b) about a gradient at 1900px.

---

## §5 ✅ The verdict — 2026-08-31, PNGs in context

**Evidence**: `verdicts/vib-003/2026-08-31/pictures-door/`, artefact md5 `ceee26d4…`, HEAD
`fb3ed6f8…`. Four viewports, viewport-only and full-page captures, `manifest.json` beside them.
Read as images per README §3.4. The `door` state is the only honest one here — the page has no
backend, no data and nobody to sign in, so an empty page would have been the design's emptiness.

### `/` — four recipes, real pictures and real glyphs · **PASSABLE**

**WordPress-starter tells (README §2), one by one:**

- 🔴 *No imagery and no iconography anywhere on the page* — **DOES NOT FIRE, for the first time in
  this phase.** One hero picture, three card pictures that are three *different* pictures, three
  feature glyphs that are three *different* glyphs, one empty-state glyph and three status dots.
  VIB-002's verdict recorded this tell as *"fires, half"* and named it as the first thing standing
  between that page and WORTHY. It is cleared.
- *One narrow centred column of stacked text, one background colour end to end* — does not fire. The
  ground changes three times and the change is visible in a thumbnail.
- *Type ramp reading as two sizes; headline under ~48px* — does not fire. ~96px display against
  eyebrow, lead, item title, item body and meta.
- *Bordered grey boxes as the only structure; browser-default buttons* — does not fire. Pill buttons,
  a filled primary against an outline secondary, hairline rules on the strip.
- *Content islands floating in dead viewport space* — **fires.** See below; it is the whole gap.

**Vibe-worthy tells:** a real hero on a designed ground ✅ · depth used with intent **partly** (the
picture has a light source and a direction; nothing on the page is layered, shadowed or overlapped) ·
three visually distinct section treatments **two and a half** (white, `--surface` strip, white) ·
**icons and images doing communicative work ✅ — the tell this task existed for** · a palette that
reads chosen ✅ · copy in a specific voice ✅ · holds at 390 / 1280 / 1900 ✅.

**Richard's amended test — *does anything on this page show a decision?*** On the hero and the
feature strip, yes: a 96px headline set against a lit picture, a strip that is a rule across the page
rather than another section, three glyphs chosen per row. **On the card band, no** — and that is
where the verdict stops at PASSABLE.

**Why it is not WORTHY, per README §3.6.** The card band is the honest failure. `vis-columns-media-
cards` is a 1:2 `Columns` inside a `Group` with 12px of padding: the "cards" have **no surface, no
border, no radius and no shadow**, so three pictures with a line of text beside them float in white
with the right third of each track empty. It reads as a media *list*, because that is what the recipe
is. The `card` and `raised` compositions exist in the vocabulary and this recipe does not use either.

| what is missing | seam | owner |
|---|---|---|
| No section is a designed *thing* — no card surface, no stat tile, no testimonial, no footer, nothing to navigate | VOCABULARY | **VIB-004** (register V6) |
| Nothing on the page is layered, shadowed or overlapped, though every port for it exists | INSTRUCTION | **VIB-004** (VIB-002 §1 found these already ported and untaught) |
| The right third of every card track carries nothing at ≥1280 | VOCABULARY (V15) | **VIB-008** |

🔴 **This is the same seam VIB-002's verdict named, and it is now the only one left.** That verdict
listed three gaps — iconography (CORPUS, VIB-003), content structure (VOCABULARY, VIB-004) and the
measure (V15, VIB-008). The first is closed. Richard's *"nearly worthy"* said those three were the
whole distance; one down, and nothing new appeared in its place, which is the first evidence that
his measurement of the distance was right.

### Observations that are not defects

⚠️ **At 988×313 the headline alone fills the fold and its third line is cut** — identical to VIB-002
§5 and recorded there for the same reason: `--display-lg` is keyed to viewport *width*, so at 988
wide it resolves to ~78px in a 313px frame. That is the pane being 313px tall. The fix is a shorter
headline, not a smaller token, and a `vh` term in the clamp would shrink real desktop heroes to
protect a preview pane.

⚠️ **The starter imagery is a floor and looks like one.** Abstract slate arcs are better than an
empty box and worse than a photograph of the actual product, which is what the manifest and the
doctrine both say in those words. A verdict that treated them as an achievement would be measuring
the placeholder rather than the page.

---

## §6 Acceptance criteria

1. ✅ **An authoring model can name a glyph from what the door tells it.** `get_style_vocabulary`'s
   `icons` block reports every installed set, a complete copyable value built by the picker's own
   `iconValueForGlyph`, and every declared glyph name — in both the structured and the prompt
   rendering. §3(a).
2. ✅ **The authoring gate stops teaching the undrawable value.** §3(b), and inert on 102 of 102
   shipped parameters.
3. ✅ **The corpus draws.** Every `Image` and every `Icon` in `docs/node-catalog/examples/` now
   carries a value that renders or takes one over a wire that has something behind it, and four of
   them were repaired by looking at a photograph rather than at the JSON (§4). `catalog:examples`
   clean.
4. ✅ **Real pictures and real glyphs, photographed through the Judge in the honest state** — which
   now includes what `installStarterAssets` installs, because until this task it did not and no
   photograph could have contained an icon at all. §3(c), §5.
   ⚠️ **Bound, stated rather than glossed**: the page photographed is the *recipe corpus*, not a
   shipped template. `templates/members-area/` contains **zero** `Image` and `Icon` nodes, so putting
   pictures into it is a redesign, and redesigning it is VIB-008's task by the phase's own board. The
   claim proved here is that the sanctioned vocabulary and corpus draw; the claim about the shipped
   templates is VIB-008/VIB-009's.
5. ✅ **A verdict recorded from the picture** — §5, PASSABLE, with the WORTHY gap named and owned.
   ⚠️ **Provisional until Richard has looked** (README §3.5).

## §7 Explicitly NOT in this task

- **Marketing sections** — hero/ctaBand/featureItem/statTile/footer are V6, VIB-004. This task puts
  pictures and glyphs into the vocabulary and the corpus; it does not add a section kind.
- **Re-designing either shipped template** — VIB-008/VIB-009.
- **The ambush defaults** — V1/V2/V14/V17, VIB-005.
- **The prefab library's `material-icons` values** (V20) — recorded, not repaired here.
