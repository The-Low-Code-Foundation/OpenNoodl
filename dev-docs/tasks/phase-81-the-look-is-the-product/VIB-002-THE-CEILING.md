# VIB-002 — The Ceiling

**Register rows: V5 (no decorative ground anywhere in the sanctioned vocabulary), V13 (display type
capped at 48px, no responsive type story).**

Built 2026-08-31. **Status: 🟡 PASSABLE — CONFIRMED BY RICHARD 2026-08-31 (§9), capability closed, WORTHY gap named.**
See §5 for the verdict, §9 for his ruling, and §7 for what this task deliberately does not fix.

---

## §1 🔴 What was measured before anything was built — and the correction it forced

README §1(c) says the kit's ceiling is *"flat-colour bootstrap"* and names the absences as
*"no gradient, image background, opacity, blur, layering."* Measured **through the door**
(`get_node_type('Group', ports: [...])` against the bound MCP server, not by reading source):

| capability | port on `Group` | verdict |
|---|---|---|
| opacity | `opacity` (number, default 1) | ✅ **already existed** |
| blend | `mixBlendMode` (16 enums) | ✅ **already existed** |
| layering | `zIndex` (number), `position` (relative/absolute/**sticky**/fixed) | ✅ **already existed** |
| depth | `boxShadowEnabled` + six `boxShadow*` ports | ✅ **already existed** |
| escape hatch | `styleCss` (raw CSS declarations) | ✅ already existed |
| **gradient ground** | — | ❌ nothing |
| **image ground** | `backgroundImage` → **`notFound`** | ❌ nothing |
| **blur** | — | ❌ nothing |

🔴 **So README §1(c) is half wrong, and the half it is wrong about matters.** Layering, depth,
translucency-by-blend and absolute positioning were expressible in the engine the whole time and
were simply **never taught** — no composition uses them, no doctrine paragraph names them, and
`get_style_vocabulary` mentions none of them. The genuinely absent capability was narrower:
**a ground that is anything other than one flat colour**, and a way to blur.

That distinction changed what this task built. Two thirds of the work here is *instruction*, not
engine — and that is a finding about the phase's diagnosis, not a criticism of it.

Token side, measured the same way: **13 categories, none decorative** — confirmed. `--text-6xl`
(60px) is the top of the type scale, and `prompts/design.ts` then talked authors down from it in
so many words:

> *"**Type does not scale.** `fontSize` has no responsive form, so a `--text-6xl` display headline is
> 60px on a phone too. Pick the display size that still works at 390px — usually `--text-4xl` or
> `--text-5xl`."*

That paragraph **is** V13's 48px ceiling, in the product's own instruction surface, and it was
correct advice about the tokens that existed.

---

## §2 What was built

### (a) The ground — five ports on `Group`

`NodeSharedPortDefinitions.addBackgroundInputs`, applied to `Group` only
(`node-shared-port-definitions.ts`, wired in `nodes/visual/group.ts`):

| port | type | what it does |
|---|---|---|
| `backgroundImage` | `image` | a picture behind the children; empty clears rather than requesting `/null` (`resolveMediaSource`) |
| `backgroundGradient` | string | a gradient token or CSS gradient, painted **on top of** the image |
| `backgroundSize` | enum cover/contain/auto | |
| `backgroundPosition` | enum center/top/bottom/left/right | |
| `backdropBlur` | number px | `backdrop-filter: blur()` — frosted glass over whatever is behind |

🔴 **The one decision worth knowing**: the two background ports compose into a single
`background-image` declaration, **gradient first** — `background-image: <gradient>, url(<image>)`.
That is the CSS scrim idiom, and it is what makes "a headline over a photograph nobody has seen"
one node instead of an `Image` with an absolutely-positioned `Group` over it. Composing them in one
`_updateBackgroundLayers` method (the same shape as `_updateBoxShadow`) is not tidiness: they write
the same CSS property, so as independent `inputCss` ports whichever was set last would silently
erase the other.

**Group only, deliberately.** `addSharedVisualInputs` has eighteen callers; widening this mixin to
all of them would put five ports on `Text` for no gain and grow eighteen catalog entries.

### (b) Ten new tokens

**Gradients** (new `gradient` category, grouped under Effects):
`--gradient-brand`, `--gradient-deep`, `--gradient-spotlight`, `--gradient-surface`,
`--gradient-scrim`.

🔴 **Every one is written in terms of other tokens, never raw hex.** `MinimalPreset` moves
`--primary` to near-black and overrides no gradient — and `--gradient-brand` becomes a near-black
wash without the preset knowing gradients exist. A literal `#2563eb` here would have been a second
copy of the brand colour, drifting the first time anybody re-themed. `--gradient-scrim` is the one
exception and it is deliberate: a legibility scrim is black-to-transparent in every theme.

**Translucency**: `--surface-glass`, `--border-glass`. These exist because `opacity` on a `Group`
fades its own children, so a see-through panel has to come from an alpha *fill* — and an alpha fill
written inline draws `raw-color-literal`. **The capability was in the engine and unreachable through
the sanctioned door**, which is the V5/V9 pattern in miniature.

**Fluid display type** (V13): `--display-sm` / `--display-md` / `--display-lg`, values
`clamp(44px, 1.4rem + 5.6vw, 96px)` and siblings — 44px at 390 and 96px at 1900 from one parameter.

🔴 **No runtime change was needed for this and that is the whole point.** A token's value is emitted
verbatim into `:root` (`TokenResolver.generateCss`), so a token whose value is a `clamp()` scales
with the viewport with nothing in the engine knowing. What was missing was never a responsive
`fontSize` port; it was **a token that scales**. The doctrine paragraph quoted in §1 has been
replaced, and `displayHeadline` moved from `--text-6xl` to `--display-lg`.

### (c) Two recipes, three compositions, and the doctrine

- `docs/node-catalog/examples/ui-gradient-hero.json` and `ui-image-scrim-band.json` — gated by
  `npm run catalog:examples` (64/64 clean, warnings-as-errors).
- `heroGround`, `imageGround`, `glassPanel` in `StyleCompositions.ts`, each anchored to one of
  those recipes as the file's own rule requires.
- `prompts/design.ts` §4 gains **"every band does not get the same ground"** (the four ways a Group
  can carry a ground, and that gradient-over-image is one node) and **"depth is an alpha fill, not
  `opacity`"** (which also names `boxShadowEnabled`, `position: absolute` + `zIndex` — the
  capabilities §1 found were already there and untaught). §3 and §7's type paragraphs are rewritten
  around the fluid tokens.

---

## §3 The demonstration project

`demo/vib-002-ground/`, built by `demo/build-vib002-ground.js`.

🔴 **The page is assembled from the shipped recipes, not hand-written.** The builder copies
`ui-gradient-hero` and `ui-image-scrim-band` verbatim and re-parents them onto one Page. A
hand-written demonstration would only have proved that *a person* can express a gradient ground,
which nobody doubted. What has to be proved is that the **sanctioned vocabulary** can — so the
picture must be of the recipes an authoring model is handed. The only thing the demo adds is listed
in `DEMO_OVERRIDES`: the photograph, because every shipped example carries `src: ""` (register V7,
owner VIB-003) and a verdict about an image ground needs a project that has one.

Third band: the **same** hero recipe wearing `--gradient-brand` instead of `--gradient-spotlight`.
Nothing else moved. That is the argument for putting a ground in a token rather than a composition
per mood, made as a picture rather than a sentence.

Run: `packages/nodegx-backend/tests/vib002-ground.look.ts` (outside `testMatch`, one command).

⚠️ It asserts that the **built viewer bundle** contains the new ports before photographing
anything. A stale bundle renders the page with the ports simply absent — a flat band,
indistinguishable from the defect this task exists to fix. `npm run build:editor:_viewer` first.

---

## §4 🔴 Two defects the demonstration found, both by looking

### (a) V1 bit a brand-new, gate-clean recipe — written by a session that had just read V1

The first render put the image band's copy at the **top** of the frame with ~250px of empty
photograph below it, and the scrim's dark end under nothing. `justifyContent: 'flex-end'` was set
correctly the whole time.

The cause is register **V1**: the `shell` inside the band carried no `sizeMode`, so it was the
runtime's 100%×100% default, became `flexGrow:100` in a column and **filled the 520px band** —
leaving `justifyContent` nothing to justify. Nothing anywhere said so. The example gate passed, the
parameter gate passed, `unreachablePx` was 0.

Confirmed by a control pair rather than by reasoning: adding `sizeMode: 'contentHeight'` to that one
node, changing nothing else, moved the copy to the foot of the frame. Before/after PNGs are both
kept (`ground-door-first-render/` and `ground-door/`).

🔴 **This is the strongest evidence VIB-005 has** — not a defect in a shipped template written months
ago, but V1 defeating a session that had the diagnosis open in front of it. Filed as **V17**.

### (b) `--gradient-brand` read as a flat blue block at 1900

Photographed: `linear-gradient(135deg, var(--primary), var(--primary-hover))` across a 1900×700 band
is two tokens one step apart (#2563eb / #1d4ed8) spread over 2000px, and the eye cannot see it. **A
gradient token that reads flat on a full-width band is the tell it exists to avoid.** A third stop
at `var(--foreground) 115%` — ink kept just off the canvas — fixed it, verified by re-render.

Neither of these was findable from JSON, a port census or a diagnostic. Both came from looking at a
picture, which is the phase's method making its own argument again.

---

## §5 ✅ The verdict — 2026-08-31, PNG in context

**Evidence**: `verdicts/vib-002/2026-08-31/ground-door/`, artefact md5 `e6dad55f…`, HEAD
`58534445…`. Four viewports, viewport-only and full-page captures, `manifest.json` beside them.
Read as images per README §3.4.

### `/` — the three grounds · **PASSABLE**

**WordPress-starter tells (README §2), one by one:**

- *One narrow centred column of stacked text, one background colour end to end* — **does not fire.**
  Three grounds in one page: a radial gradient into near-black, a photograph under a scrim, a brand
  wash. The ground changes twice, and both changes are visible in a thumbnail.
- *No imagery and no iconography anywhere* — **fires, half.** There is one photograph, used as a
  ground. There is **not one icon on the page**, and no image doing communicative work inside
  content.
- *Type ramp reading as two sizes; headline under ~48px on desktop* — **does not fire.** The
  headline measures ~96px at 1900 and ~44px at 390 from the same parameter; eyebrow, lead, body and
  meta are all distinct.
- *Bordered grey boxes as the only structure; browser-default buttons* — **does not fire.** Pill
  buttons, an inverted primary on the dark ground, a translucent panel with a hairline.
- *Content islands floating in dead viewport space* — **fires, partly.** At 1280 and 1900 the copy
  occupies the left ~55% of every band and the right side carries nothing. On a hero with a designed
  ground that reads as negative space rather than as the members-area's dead white — but it is the
  same V15 shape, and on the two lower bands it is not earning its emptiness.

**Vibe-worthy tells:** a real hero on a designed ground ✅ · depth used with intent (scrim over
photograph, translucent panel over gradient, backdrop blur) ✅ · three visually distinct section
treatments ✅ · icons/images doing communicative work ❌ · a palette that reads chosen ✅ · copy in a
specific voice ✅ · holds at 390 / 1280 / 1900 ✅.

🔴 **Applying Richard's amended test rather than the one his ruling struck out** — *does anything on
this page show a decision?* Yes, and not arguably: the ground changes three times, the type is
**set** rather than merely enlarged (leading-none, tracking-tighter at 96px), a scrim is chosen so a
headline survives a photograph nobody has seen, a panel is layered on a ground. None of those is a
framework default. The framework's default here is what the baseline photographed nine times: a
white page with a 48px heading.

**It is not WORTHY, and the gap is not polish.** It is a demonstration of three grounds, not a page:
no icons, one image used decoratively, no cards, no grid, no stats with actual numbers, no footer,
nothing to navigate. A visitor could not do anything here. Naming the gap precisely, per README §3.6:

| what is missing | seam | owner |
|---|---|---|
| Zero iconography; the one image is a ground, not communication | CORPUS | **VIB-003** |
| No content structure — feature rows, stat tiles, testimonial, footer | VOCABULARY | **VIB-004** |
| The right ~45% of every band carries nothing at ≥1280 | VOCABULARY (V15) | **VIB-008** (cross-link VIB-004) |

### Observations that are not defects

⚠️ **At 988×313 — the editor's own preview — the headline alone fills the fold**, and its third line
is cut. `--display-lg` is keyed to viewport *width*, so at 988 wide it resolves to ~78px in a 313px
frame. That is the pane being 313px tall, not the token being wrong: any designed page's hero fills
a 313px frame, and the fix is a shorter headline (this one is eleven words), not a smaller token.
Recorded rather than filed, because a `vh` term in the clamp would shrink real desktop heroes to
protect a preview pane.

⚠️ `--surface-glass` at 0.12 white is subtle over near-black and vivid over the brand blue. Both
readings are correct for the token; a designer wanting more on ink should raise the fill rather than
the border.

---

## §6 Acceptance criteria

1. ✅ **Gradients, image grounds and depth are expressible through the sanctioned vocabulary** —
   five ports on `Group`, ten tokens, three compositions, two gated recipes. Not `styleCss`: every
   one of them is a first-class port with a catalog entry, so the escape hatch stays an escape hatch.
2. ✅ **The capability is judged expressible-on-system, by rendering** — the demonstration page is
   assembled from the shipped recipes and photographed at four widths in the door state, and the
   look file refuses to photograph a viewer bundle that lacks the ports.
3. ✅ **The display-type story (V13)** — `--display-sm/md/lg` are fluid, `displayHeadline` uses
   `--display-lg`, and the doctrine paragraph that created the 48px ceiling is replaced rather than
   contradicted.
4. ✅ **The doctrine and vocabulary text that teaches it** — `prompts/design.ts` §3, §4 and §7;
   `get_style_vocabulary` picks the compositions and tokens up from the tables it already renders.
5. ✅ **A verdict recorded from the picture** — §5, PASSABLE, with the WORTHY gap named and owned.
   ✅ **No longer provisional: Richard looked and ruled the same way (§9).** Sheet sent 2026-08-31:
   **https://claude.ai/code/artifact/dac65b42-f8b6-430d-80a0-9c9ce7a4a6e1**
   — the three calibration questions on it are §5's verdict, the gradient ambition, and the empty
   right-hand half.

## §7 Explicitly NOT in this task

- **Icons and images in content** — V7, VIB-003. This task proved an image can be a *ground*; it did
  not touch the corpus's empty `src` values or put a single icon anywhere.
- **Marketing compositions** — hero/ctaBand/featureItem/statTile/footer are V6, VIB-004.
  `heroGround` and `imageGround` are *grounds*, not sections: they say what is behind the content
  and nothing about what the content is.
- **The ambush defaults** — V1/V2/V14, VIB-005. §4(a) is evidence for it, not a fix of it.
- **Re-theming either shipped template** — VIB-008/VIB-009.

## §8 Gates run

| gate | result |
|---|---|
| `npm run catalog:examples` | 64/64 clean, strict, warnings-as-errors |
| `npm run catalog:tokens` | 583 references across 71 files all resolve |
| `catalog:generate --check` | committed catalog up to date |
| `tsc -p packages/noodl-viewer-react` / `-p packages/noodl-editor` | clean |
| `styleVocabularyPorts.test.ts` + `design-token-contrast.test.ts` | 26 passed |
| `packages/noodl-viewer-react` suite | 85 suites / 1107 tests passed |
| `vib002-ground.look.ts` | 3 passed, 4 shots, `unreachablePx` 0 at every width |
| `npm run typecheck:backend-tests` | ⚠️ **no local reading obtainable — CI runs it on PR (`.github/workflows/pr.yml:39`); see below** |

🔴 **A correction to this file's own §3, and to `VIB-001-THE-JUDGE.md` §8 which it inherited from.**
Both said *"neither look file is type-checked by anything — the jest run is the typecheck."* **That
is false.** `packages/nodegx-backend/tsconfig.tests.json` (PLAT-004, long predating either file)
includes `tests/**/*.ts`, and `npm run typecheck:backend-tests` runs it. Measured with
`tsc --showConfig`: the gate resolves 256 files and **all eight `.look.ts` files are among them**,
including `vib002-ground.look.ts` and `tests/helpers/judge.ts`.

So this task shipped a `.look.ts` without running the one gate that types it, on a stated belief
that no such gate existed. The belief was an **absence claim made without the search that would
have disproved it** — one `grep` of `package.json` for `typecheck:` finds it.

### 🔴 The gate does not complete on this machine, and that is not a finding about this code

Four attempts, none of which produced a reading:

| attempt | whose | outcome |
|---|---|---|
| `npm run typecheck:backend-tests` | this session | SIGTERM at 10 min (load 13) |
| `NODE_OPTIONS=--max-old-space-size=8192` | a third session | **FATAL: JS heap out of memory at 828s**, 8.0 GB |
| single-file scope, 4 GB heap | this session | SIGTERM at 9 min, empty log |

The machine is **16 GB**, with Firefox, CoreSimulator and a peer's node process live. A run asking
for half the machine's RAM still died. Scoping the entry point to one file changed nothing, because
`vib002-ground.look.ts` imports `helpers/judge.ts`, which reaches the backend's whole `src/**` — the
*entry* is scopeable, the *type graph* is not.

🔴 **The OOM is not caused by anything this task added.** Measured rather than assumed: the gate
resolves 255 files, the largest are the backend's own (`HttpServer.ts` at 99 KB), and the generated
catalog `.d.ts` files this task regenerated are **10 KB and 1 KB, byte-identical in size to their
pre-VIB-002 versions** — they are not even in the resolved set.

✅ **And it is not an unwatched gate**, which is what this was about to be written up as.
`.github/workflows/pr.yml:39` runs `npm run typecheck:backend-tests` in the `typecheck` job, on a
runner with headroom and nothing competing. So every `.look.ts` in this package **is** typed, on PR.
What is false is only the local promise: a session on this machine should not undertake to produce a
green `typecheck:backend-tests` reading, and a handoff that says "must be re-run" is asking for
something the hardware will not give.

⚠️ **Read the log, never the error count.** The OOM run's log had **zero `error TS` lines**, and this
session's own waiter script duly printed *"(none — no look-file errors)"* and *"0"*. Read carelessly
that is a pass. It was a crash: `tsc` never reached the reporting stage. An absence of error lines
is only evidence beside proof the compiler finished — the same shape as a timed-out `test:ci` run
exiting 1 exactly like a clean floor.

⚠️ **Original status note**: a `tsc -p .../tsconfig.tests.json` was found already running,
so this session did not start a second one — a concurrent full-project `tsc` is how the first
attempt got SIGTERM'd at 10 minutes on a load-13 machine. This row stays ⚠️ until a clean reading is
recorded against it.

🔴 **And a correction to the sentence that used to be here, which said the gate was "owned".** It
named the wrong session, on an assumption rather than a measurement, and a peer had to correct it.
Three attribution errors in one move, all worth keeping:

1. **The socket you are talking to is not the author of the commit you just read.** The VIB-004
   commit mentioned the gate; the peer session that had just messaged about the checkout was a
   *different* session (P80 s34), and this session addressed it as though it were the VIB-004 author.
2. **A detached process cannot be attributed by `ps`.** The `tsc`'s PPID is **1** — its parent shell
   is gone, so the process tree says nothing about who started it. Walking PPIDs, which is the rule
   recorded for attributing a stack, silently returns no owner here rather than an error.
3. 🔴 **The only thing that named an owner was the artefact it writes to.** The command's redirect
   is `> /private/tmp/…/<session-uuid>/scratchpad/tc3.log`, and that UUID belongs to a **third**
   session — neither this one nor the peer that was asked. **Attribute a detached process by the
   path it writes, not by its parent and not by who is talking to you.**

And the thing that mattered more than the ownership: *"someone else is running it"* is not the same
claim as *"someone else is watching it"*, and only the second one makes it safe to stand down. The
resolution here needed neither — the log is world-readable, so this session waits for that run to
exit and reads its result, which answers the actual question (is `vib002-ground.look.ts` clean?)
without duplicating the work or needing to know whose it is.


---

## §9 ✅ Richard's ruling — 2026-08-31

> *"I'd say very passable, nearly worthy, definitely night and day with the original, well done"*

**PASSABLE stands.** This is the first verdict in phase 81 to survive his look above SHITTY — the
baseline is nine of nine SHITTY and both of its PASSABLEs were struck out on 2026-08-31 for being
awarded on legibility (`VIB-001-BASELINE-VERDICTS.md` §7).

### What the ruling calibrates, beyond confirming the grade

🔴 **"Nearly worthy" is a measurement of the remaining distance, and it says the gap named in §5 is
the whole gap.** He did not ask for a rethink of the grounds, the type or the ambition — which is
the reading that would have reopened the tier. So:

- **The seam analysis in §5 holds.** Icons and communicative imagery (VIB-003) plus content
  structure (VIB-004) are what stand between this and WORTHY. That is now a ruled position rather
  than this session's estimate, and VIB-003/VIB-004 should be built expecting to *close* the gap
  rather than to narrow it.
- **The gradient ambition is not the problem.** The sheet's second calibration question asked
  whether a deep gradient, very large type and a translucent strip read as "2021 SaaS" rather than
  as modern work. *"Night and day with the original"* answers it: the tokens do not need
  re-deciding before templates wear them, which was the one decision that would have got more
  expensive later.
- **This is the phase's first evidence that the diagnosis is right.** The argument that the *kit*
  is the seam — rather than two badly-styled templates — rests on widening the kit producing a
  visible jump with no template touched. It did, on his look.

### ⚠️ Still unanswered, and it is VIB-004's to carry

The sheet's third question — **the empty right-hand half of every band at ≥1280** — got no ruling.
§5 records it as firing partly, and it is the same shape as **V15**. It is not blocking: VIB-004
builds the content structure that would fill it either way, and VIB-008 owns the measure. But the
question stays open, and the next session that has his attention should re-ask it rather than
assume the silence is agreement — a hero can defend negative space and a feature band cannot, and
which of those the answer is changes what VIB-004 builds.
