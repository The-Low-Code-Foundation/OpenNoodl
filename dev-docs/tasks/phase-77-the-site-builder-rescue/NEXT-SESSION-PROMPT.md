# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## State: **s37 built SBR-009 — AC2 driven in a browser, and the drive found a defect that would have shipped.**

**Five tasks in five sessions.** s33 SBR-006, s34 SBR-015, s35 SBR-012, s36 SBR-005, s37 SBR-009.
🔴 **Three tasks have still never been started**, and the phase cannot close until they are.

`/Pages/ThemeEditor` was eleven controls in one flat column. It is now **54 nodes** (was 22): three
titled cards, a presets row generated from `SITE_THEME_PRESETS`, and a live preview beside the
fields. `/Admin/PresetChip` is a new component placed three times; `/Admin/Shell` reads the Theme
record and runs the same applier the public site runs. The template regenerates at **31** components,
from 30. Committed as `bc012147`.

Read in this order:

1. **[SBR-009 §5](SBR-009-THE-THEME-EDITOR-DEMOS-ITSELF.md)** — the shape, and **§5.5, the AC
   verdicts**, one of them a browser reading and two of them honestly short.
2. **[TASKS.md → s37](TASKS.md)** — the session log and the nine lessons.
3. **[D36–D41](DEFECTS-THE-SITE-BUILDER-FOUND.md)** — unchanged; two still open.

---

## 🔴 THE BOARD — re-derived from the task FILES, 2026-09-01

🔴 **Standing rule, set by Richard 2026-08-30 — read
[`dev-docs/guidelines/PHASE-EXECUTION.md`](../../guidelines/PHASE-EXECUTION.md) first:**

> **A defect becomes the next session's first job ONLY if it blocks an acceptance criterion.**
> Otherwise it is filed with an owner, and **the next session builds the next task.**

**s37 filed no new defect rows.** The one it found (the picker running at mount) blocked AC2 and was
fixed in the session, with the flag asserted twice — on the parameter and on the rendered screen.

### 🟢 BUILD THIS: **SBR-010 / 011 / 013** — pick the top one and build it

| | what | note |
|---|---|---|
| **next** | **SBR-010 / 011 / 013** — never built | **SBR-010 is the cheapest and the most person-shaped**: the contact form has stored records since SB-004 and nothing has ever read them back. The sidebar already carries a **Messages** item with **no navigate wire** — `/Pages/Messages` is the component that does not exist, and the gap is recorded in `ADMIN_SHELL_WIRES` rather than papered over. **SBR-011 was ruled BUILD, not strike.** SBR-013 is doctrine text across three surfaces, and its AC2 wants a cold authoring session driven |
| then | **SBR-003** — the `var(--token)` dimension-port probe, and nothing else | |
| last | **SBR-014** — the gate on closing phase 77 | 🔴 **It now owes SBR-009's AC1 live half and AC3 as well** — both need a provisioned backend, and both are one session's work *together*, not two rows |

---

## 🔴 What s37 leaves for whoever picks up SBR-009's remainder

**AC1 is half-measured and AC3 is not met**, both behind the same door: `DbCollection2` fires
**neither** `fetched` nor `failure` with no backend bound, so the record path does nothing in the
`withRenderedPage` harness. What is already built and graded:

- `/Admin/Shell` reads the Theme record and runs `buildThemeApplierScript()` — **asserted
  byte-identical across all three placements**, so the derived companions cannot drift;
- `saveTheme.done → theme.storageFetch → applyTheme`, so Save repaints the panel without a reload.

**The arm that settles both** is one `withRenderedPage({ projectDir, backendPort })` run against a
claimed site: read `--primary` off `documentElement` in the admin panel **and** on `/Pages/Site`
before and after a save, then delete the Theme row and read it a third time (AC3's fallback to
Studio, which SBR-003 AC4 already drove from the record side). No test in this repository drives with
a backend yet — that is the cost, and it is SBR-014's to pay once for several ACs at the same time.

---

## 🔴 The two open register rows — unchanged, and one of them got HARDER to measure

### [D40](DEFECTS-THE-SITE-BUILDER-FOUND.md#d40) — nothing on a published page scrolls. Owner SBR-002

**Still the biggest thing s36 found, and still not settled.** The control that settles it is
unchanged and takes minutes:

> Render `templates/members-area/` through the **same** `withRenderedPage` and read the same four
> numbers. If it scrolls, D40 is the site-builder's ground and SBR-002 owns a real defect. If it does
> not, D40 is `render-from-disk.js` and the row is about the harness.

⚠️ **s37 deliberately did NOT run it.** A peer session was writing `templates/members-area/` and
`tpl001Components.ts` at 22:32 and 22:37 while this session's suites ran at 22:40 — the control would
have measured a half-edited template, and a reading like that is worse than none. ✅ **`stat` the
members-area tree before running it**, and re-check `tpl001Template` is green first: if it is red,
the template on disk is mid-edit and the control is not measurable yet.

⚠️ It still contradicts phase 81's VIB-001 (`unreachablePx: 0` on all 44 shots). **Two instruments
disagree; neither reading is safe to relay until one is re-derived.**

### [D38](DEFECTS-THE-SITE-BUILDER-FOUND.md#d38) — the hero's scrim vs `colorOnPrimary`. Owner SBR-003

⚠️ **A hypothesis with a named test, not a finding.** Unchanged: `--gradient-scrim` is a fixed black
wash and `night`'s `colorOnPrimary` is `#191713`. **Nobody has rendered it.** 🆕 s37 makes the arm
cheaper: `sbr009ThemeEditorDrive` shows how to put a preset's tokens on a subtree and read the
computed result, with no backend. The same shape points at the hero.

---

## 🔴 What s37 paid for, and would pay again

- 🔴 **A GATE THAT LOOKS LIKE A BLOCKER MAY ALREADY HAVE RULED FOR YOU.** SBR-012's raw-colour gate
  asserts `toEqual([])` over the whole artefact, and a presets row is three palettes — so the task
  could not be built. That reads as a ruling collision, and the move for those is to **ask**. Before
  asking: **SBR-012 §2 bullet 4 already names the `designTokens`/`preset-data` blocks as the one
  allowed home for literals.** The gate shipped with an empty list because there was no preset-data
  block yet. ✅ **Read the blocking task's own SCOPE, not only its code.**
- 🔴 **AN EXEMPTION ON A COLOUR MUST BE PAIRED WITH A DERIVATION.** The row is exempt only because it
  is *data*, and that is true only while the bytes are the source's — so
  `presetHexesInArtefact() === presetHexesInSource()`, 24 hexes, in order. A drifted second copy of
  the palette satisfies the exemption and fails the derivation.
- 🔴 **THE DRIVE FOUND WHAT THE GRAPH COULD NOT.** Three chips publish `name` at MOUNT, so the picker
  ran three times before anybody clicked: the screen booted wearing **Night**, five boxes pre-filled,
  picked by nobody. **`run` is additive — wiring it does not stop a node running on its own.**
- 🔴 **"UNSTATED" DOES NOT MEAN "UNSET" IN THIS TEMPLATE.** `pinRunOnValueChangeDefaults` (DEF-007
  §3.2) writes `true` into the artefact for every governed checkbox the source leaves out — so
  leaving a box unstated here is an *active choice to run on arrival*, and the only way to say "wait
  for the signal" is to say `false`. ⚠️ This **corrects s36's lesson as it applies to this template**.
- 🔴 **A CENSUS CAN LOSE A HAZARD WITHOUT THE HAZARD CHANGING.** `buildTokens`'s four write-back rows
  left `sb007Template`'s census when Save stopped running it — that pass only reaches nodes whose
  control signal is wired. The node still reads Theme and still writes it. ✅ **Name what the
  instrument cannot see, in the spec, at the moment the number moves.**
- 🔴 **A REPAIR REDDENS THE POSITIVE CONTROL THAT NAMED IT.** `/Pages/ThemeEditor` was
  `templateAppearance`'s only bare page **and** the known-positive its CONTROL pointed at. The
  cheapest green would have been to put the debt back. ✅ **Re-point at a constructed positive.**
- 🔴 **A +1 AND A −1 THAT CANCEL ARE INVISIBLE TO A COUNT.** `sb005AdminPanel`'s declared-signal
  census stayed at **9**: `presets` gained `out-picked`, `buildTokens` lost `Outputs.built()`.
- ⚠️ **Two editor-side censuses were already wrong at HEAD**, measured by putting HEAD's artefact
  back for one run: components **24** against a line saying 22, node ids **295** against 274.
  `test:main` is still the unwatched runner D19 named. ✅ **Measure the baseline before attributing a
  delta to your own diff.**
- ⚠️ **A `CSS Definition`'s `style` is `allowEditOnly` in the catalog and takes a CONNECTION anyway.**
  Measured in a browser; nothing in the repository said either way before.

---

## 🔴 The phase's end condition, unchanged

**SBR-014 is the gate on closing phase 77**, and it re-verifies every person-sentence AC. It cannot
start while three tasks are unbuilt. 🔴 **That is the distance to done — not the length of the
register.**

⚠️ **AC3 of SBR-007 cannot be met at all** — **D15**, no drop-target capability in the runtime for a
file arriving from outside the page, re-measured at HEAD with a boundary control at s29.
**Phase 77 must not close pretending AC3 is met.**

⚠️ **AC1 of SBR-005 has a second half nobody has ruled**, and **SBR-009 AC1 now has a companion
question**: the five section kinds are five different *objects*, and the theme editor is now a
screen with a preview — **whether either is worth looking at is Richard's**. Phase 81's whole premise
is that a template can be structurally perfect and still read as a WordPress starter. The SBR-005
pictures are in
`dev-docs/tasks/phase-81-the-look-is-the-product/verdicts/sbr-005/2026-09-01/site-builder-living/`;
**no pictures were taken of the rebuilt theme editor** — the s37 drive measured computed styles, not
screenshots, and a shot list for it is a cheap thing for the next session to add.
