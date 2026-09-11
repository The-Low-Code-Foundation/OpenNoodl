# TPL-003 — The landing pages

**Opened 2026-09-05**, at Richard's request, for 0.2.2:

> *"Can you please create one more template to ship with 0.2.2? I think a simple pretty landing
> page would be a great simple starter package, no backend just front end small business or
> freelancer landing page, presentation and a contact form. Could we even make a few different
> pages within the same template for different typical 'top 3' landing page types?"*

**Status: 🟢 BUILT, GATED, PHOTOGRAPHED, DRIVEN, RULED IN and EMBEDDED (2026-09-05). Richard, on
the rebuilt launch page: *"Yep better, we can add it to the template picker and ship with 0.2.2
please"*, then: *"I want to make it one of the packages templates like the members area and site
builder."* So it is `embedded://landing-pages`, on the shipped shelf beside the site builder with no
publish. Left: the commit.**

⚠️ **One correction to the premise of that second ask**: the members' area is NOT a packages
template. It is a curated shelf row (`templates/members-area/`, REL-001) that reaches the picker
only when `publish-project-template.ts` is run with his credential. The two embedded ones are the
site builder and, now, this.

## What it is

**Twenty-one components, three pages, no backend — in two shapes from one build:**

- `packages/noodl-editor/src/editor/src/models/template/templates/landing-pages.content.json` +
  `landing-pages.docs.json`, read by `landing-pages.template.ts` and registered in
  `EmbeddedTemplateProvider` — **the one that ships**, `embedded://landing-pages`. The template
  object declares no `designTokens` and no `securityPolicy`: the look is read out of the content's
  own `metadata.designTokens` (the door wrote it), and the absence of a policy and of any cloud
  component is what `templateNeedsBackend` reads as *no backend*, so the wizard attaches nothing.
- `templates/landing-pages/` — the prepared v2 directory, delivered the way TPL-001 is. Kept because
  the gate reads it, `START-HERE.md` is generated from it, and it is what a curated row would use.

| page | route | for |
|---|---|---|
| `Pages/Freelancer` | `/` (start page) | one person selling a skill — gradient hero, three services, three pieces of work, a photograph and a story, two client quotes |
| `Pages/Business` | `/business` | a place people visit — a photographed hero with three numbers on glass, three things it sells, three reasons, address and opening hours beside a photograph of the street, two regulars' quotes |
| `Pages/Launch` | `/launch` | something that does not exist yet — the promise beside a stand-in product window, two alternating text-and-window feature rows, three numbers set large on ink, the steps down a column, a light plan beside a dark one, a two-column FAQ, a brand-gradient closing band |

Every page shares `Site/Switcher` (an accent strip that flicks between the three looks and tells the
person to delete it), `Site/Header` (wordmark + *Get in touch*, which scrolls to the form),
`Site/Contact` (the form band) and `Site/Footer`. The rows of three are components with `Component
Inputs` — `Feature`, `Step`, `Stat`, `PhotoCard`, `Quote`, `FaqRow`, `HoursRow`, `Field` — so a
restyle is one place and the door's `repeated-sibling-subtree` never fires. The launch page adds
`Check`, `MockRow`, `Mock` (the stand-in product window, drawn from Groups so it re-themes and
weighs nothing), `BigStat` and `Plan` (one component, light or dark by its `ground`/`edge`/`ink`
inputs).

### 🔴 Richard's first look, and the rebuild

> *"The launch one is a bit sad, it looks too much like the freelancer one and there are three rows
> of three column cards repeated, it feels lazy. The style is basic too and again too similar to
> freelancer. The other two are good."* — 2026-09-05

He was right: the first launch page was the freelancer skeleton with different words — a gradient
hero over three bands of three cards. It was rebuilt the same session with no card grid on it at
all, and the structural difference is the design: a launch page has to SHOW a thing that does not
exist yet, so it opens on the product. Freelancer and Business were not touched.

### 🔴 The contact form works with no backend

`Send` runs one function that composes a `mailto:` link from the three fields and hands it to the
`External Link` node **in place** (`openInNewTab: false`), so the visitor's own mail app opens with
the message written and addressed. The address is ONE `String` node, `EDIT — the address the form
sends to`, feeding both the link and the line beside the form. An empty field is refused with a
notice; a sent mail is confirmed with one. All four `runOnChange-in-*` boxes are off, so typing
cannot open the mail app — the button is the only trigger.

### Copy — §E applied to a template that is all copy

The members' area made its copy data (§E-i) because it had a setup door. This one has none, so it is
§E-ii end to end: **no invented business, no fictional client, no made-up number.** Every string a
person must replace is written in the shape of the thing it stands for ("One line that says what you
do, and who it is for"), every such node is labelled `EDIT —`, and `docs/START-HERE.md` is
generated from that list — 82 marked nodes, grouped by component, the address named first.

⚠️ **This is a decision for Richard.** The alternative is a plausible fictional business (a bakery,
a designer, an app) that photographs better and publishes by accident — the exact failure §E named.
Switching is a string change in `tpl003Components.ts`; the gate, the note and the pictures regenerate.

## The look

Preset **Minimal** (one of the two that pass AA on their own primary button), warmed: paper
`#fdfbf7`, rust primary `#8f3416` (white on it 7.86:1), rounder radii, Inter. Every parameter set is
`composition()` from `get_style_vocabulary` — 32 compositions used, asserted against
`requestedCompositions()`. No gradient token is overridden: the defaults are written in terms of
`--primary` and `--foreground`, so the heroes re-theme to rust and ink for free.

**Pictures:** `dev-docs/tasks/phase-81-the-look-is-the-product/verdicts/tpl-003/2026-09-05/landing-pages-door/`
— 12 shots (3 pages × preview 988 / desktop 1280 / wide 1900 / phone 390), `manifest.json` carries
the HEAD sha and the artefact md5. **0 console errors on any shot.**

## Acceptance criteria and readings

| AC | reading | how |
|---|---|---|
| AC1 the artefact is what the door writes today | ✅ byte-identical on regeneration; two consecutive runs same md5 | `tpl003Template.test.ts` §1 |
| AC2 no backend | ✅ no `__cloud__`, no policy, no `cloudservices`, no node of 11 cloud/data types | §2 (deny list checked against the members' area's real types) |
| AC3 opens on `/`, routes exactly three pages, every navigate registered | ✅ | §3 |
| AC4 every instance parameter and wire names a declared port | ✅ (the door does not check this; measured on TPL-001) | §4 |
| AC5 the form chain — one trigger, three fields, both link ports, in place, one address | ✅ | §5 |
| AC6 the form DOES it — refuses empty, composes the mailto with subject and body, confirms | ✅ driven in a real browser, `window.open` stubbed: `mailto:EDIT ME…?subject=Website enquiry from Test Person&body=Hello from the drive…`, target `_self` | `tpl003-landing.look.ts` |
| AC7 *Get in touch* reaches the form | ✅ `scrollIntoView` called on the contact band, `scrollY` 0 → 2666 | same |
| AC8 every page: one `h1` inside one `main`; frame placed once; ≥3 grounds | ✅ | §6/§7 |
| AC9 the design system is opened: tokens = preset + template, every Text has a ramp, no raw colour | ✅ | §7, `templateAppearance.test.ts` (registered, 3 pages, floor `[]`) |
| AC10 every placeholder is marked and listed; no unmarked `EDIT ME` | ✅ 82 marks | §8 |
| AC11 the door raised no warning | ✅ 49 infos, 0 warnings — 6 warnings were raised across the session and each was fixed rather than allowed | §1 asserts `severity !== 'info'` is `[]` |
| AC12 Richard's look | ✅ **2026-09-05** — Freelancer and Business *"good"* on the first look; Launch *"better"* after the rebuild, and *"ship with 0.2.2"* |
| AC13 on the picker | ✅ **EMBEDDED 2026-09-05** — `embedded://landing-pages`, offered on the shipped provider (`tests-unit/tpl-003/landing-template.test.ts`, 10; `sbr-001` pins the whole offered list as `[site-builder, landing-pages]`); install writes `project.json` + `docs/START-HERE.md` and no policy, `needsBackend` false, `rootNodeId` resolves, first open on `/Pages/Freelancer`. The publish path is not needed and its command is kept below only for a future curated copy |

Readings after embedding (2026-09-05, HEAD `fcbdb738`+this session): `tpl003Template.test.ts`
**40/40** (§1 now also regenerates the embedded pair and compares bytes); appearance + DEF-038
**41/41** (the appearance census reads the EMBEDDED template now); editor `tests-unit` —
`tpl-003`, `sbr-001`, `sb-007`, `sbr-002`, `fb-005/template-shelf`, `rel-013` — **172/172**;
`tpl003-landing.look.ts` **2/2**, 12 shots, 0 console errors; `typecheck:mcp` **0**,
`typecheck:editor` **0**. ⚠️ Not driven in the RUNNING app's create wizard — the provider-level
specs are the reading; the site builder's wizard drive (REL-011c) is the precedent for that
surface. ⚠️ Not run: `tpl001Template.test.ts` (nothing it reads was
touched — `templatePins.ts` is a NEW module the members' generator does not yet import), and the
editor `test:ci`.

## The publish — NOT NEEDED for the embedded row; kept for a future curated copy

```bash
cd /Users/richardosborne/vscode_projects/nodegx-community
DATABASE_URL=<the community DB url> \
  npx tsx scripts/publish-project-template.ts \
    landing-pages \
    /Users/richardosborne/vscode_projects/OpenNoodl/templates/landing-pages \
    site \
    "three landing pages — freelancer, local business, product launch — with a contact form and no backend" \
    --title "Landing pages" \
    --publish
```

⚠️ **Category**: `site` is the honest slug (it is a website) and is what the command says; Richard
ruled `starter` for the members' area on 2026-09-01 and may want the two rows to agree — one word
to change. The script validates the slug before writing. Run once WITHOUT `--publish` first (a
draft row), as REL-001 says.

Bundle check performed 2026-09-05: four top-level entries (`components/`, `docs/START-HERE.md`,
`nodegx.project.json`, and nothing else — no policy by design), **66 files** (21×3 + 3), no
`.mcp.json`/`CLAUDE.md`/`.env`, no absolute path, no credential-shaped literal. The photographs are
**referenced** under `noodl_modules/starter-imagery/` and ship no bytes (`STARTER_ASSETS`).

## Register — what the session found, with owners

| # | finding | where | owner |
|---|---|---|---|
| L1 | 🔴 **A component INSTANCE has no `this` output.** Wired `contact.this → ground.scrollToElement.element` and the door accepted it; the runtime logged *"Node /Site/Contact doesn't have a port named this"* on every page and nothing scrolled. Every other visual node has it (`react-component-node.ts:1076`). Fixed in the template with a wrapper Group; the door's silence on a port the runtime rejects is a product gap | runtime + door | **`NONE`** — a product row, not this template's |
| L2 | `String`'s value output is `savedValue`, not `value`. The door said so, with the list. Recorded so the next generator does not guess | door (correct) | closed |
| L3 | `gridAutoFit`'s 280px minimum fits FOUR columns in a 1200 shell — three cards sat in three of four with a quarter empty at 1280; 340 then fell to two-and-an-orphan at 988, the editor preview's default. 300 fits three at both. The composition's number is right for "unknown length" and wrong for the rows of three every landing page is made of; worth a second composition (`gridThree`) or a note in the vocabulary | kit vocabulary | **`NONE`** |
| L4 | The Judge's `unreachablePx` reads **180 on every phone shot** of a page whose content is fully reachable: under mobile emulation `window.innerHeight` is 1024 while the scroll box is 844 (`scrollHeight` = content bottom exactly, probed). An instrument artefact in `judge.ts`, the same on all three pages; the members' area's phone shots should be re-read with this in mind | P81 harness | **`NONE`** |
| L5 | `def038SettledTemplates.test.ts`'s control unsettled only a pinned `true`; an artefact whose author answered every checkbox `false` had nothing to unsettle and failed the control for a reason unrelated to settling. Widened to any governed key — the planner's idempotency is `hasOwnProperty`, so the reading is the same | gate | closed (this session) |
| L6 | Six door warnings during the build, each real: an inert `rowGap` on a row, `space-between` over percentage children (twice), a `mounted` that could only ever turn on, an inert `width` on a content-sized panel, a repeated three-node subtree. All fixed, and AC11 holds the count at 0 | template | closed |
| L7 | `oversized-page` info on all three pages (62–120 nodes; the launch page is the largest after its rebuild). The heroes and the two two-up bands are inline; factoring them would take each page under 40. Not done — a hero differs per page and a component per hero is three components for three uses | template | open, low |
| L8 | `tpl001Template.ts` still carries its own copy of the pinning `templatePins.ts` now exports. The day the members' area regenerates for another reason, it should import and delete its copy, with its gate run | P78 | open |

## Files

- `packages/noodl-mcp/tests/tpl003Theme.ts`, `tpl003Components.ts`, `tpl003Template.ts` — source of truth
- `packages/noodl-mcp/tests/templatePins.ts` — shared pinning + `collectEditMarkers` (new module)
- `packages/noodl-mcp/tests/tpl003Template.test.ts` — the gate (39)
- `packages/nodegx-backend/tests/tpl003-landing.look.ts` — pictures + the drive
- `scripts/generate-landing-template.ts`, `npm run template:landing`
- `templates/landing-pages/` — the artefact (66 files)
- `templateAppearance.test.ts`, `def038SettledTemplates.test.ts` — registered / control widened
