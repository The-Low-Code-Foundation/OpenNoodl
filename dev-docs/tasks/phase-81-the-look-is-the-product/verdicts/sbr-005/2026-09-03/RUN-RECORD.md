# 2026-09-03 — the site builder, re-photographed, and the fixture that was lying

**Run by P77 s48** at Richard's ask (*"is the template still shit, and have phase 81's principles
reached it?"*). Two arms of `sbr005-sections.look.ts`, ~3.5 min each.

```
npx jest --config packages/nodegx-backend/jest.config.js \
  --testMatch '**/tests/**/*.look.ts' --runTestsByPath \
  packages/nodegx-backend/tests/sbr005-sections.look.ts
```

---

## 🔴 The finding: every phase-81 verdict on this template was rendered on a page that could not scroll

`authorSiteTemplate` copies `noodl-mcp/tests/fixtures/demo-app` — a **generic v2 skeleton** whose
settings block is `{ htmlTitle, navigationPathType }`. The site-builder template's own settings
block carries a third key, `bodyScroll: true`, and has since D40 was fixed. **The harness never
applied it**, so `#root` stayed `overflow: clip; position: fixed` — per NDA-008's own comment, *"no
scroll container at all"*.

Two consequences, both of them visible in every recorded verdict:

1. `canScroll: false`, and **`unreachablePx` in the four figures**.
2. A full-page capture expands the viewport to the content height, and a `position: fixed` root then
   **stretches to fill it**. Those shots show the header, hero and gallery, then **1,100–1,400px of
   white**, then the footer pinned at the bottom — while the `.txt` beside each one proves the CTA,
   passage and contact sections are all present in the DOM. 🔴 **The void is the defect, not the
   design**, and a reader judging the look from those pictures is judging D40.

### The control pair — same harness, same page, same widths, one variable

| `all-five` | preview 988 | desktop 1280 | wide 1900 | phone 390 |
|---|---|---|---|---|
| **`bodyScroll` absent** (the fixture as it was) | `scroll=NO unreachable=1719px` | `scroll=NO unreachable=1139px` | `scroll=NO` | `scroll=NO` |
| **`bodyScroll: true`** (as the template ships) | `scroll=yes unreachable=0px` | `scroll=yes unreachable=0px` | `scroll=yes unreachable=0px` | `scroll=yes unreachable=0px` |

✅ **The reverted arm reproduces the 2026-09-01 manifest's numbers exactly — 1719 and 1139.** That is
what makes this a measurement rather than a nicer number: the only thing that changed is the setting,
and turning it off puts the historical readings back.

### The fix, and why it is not a second literal

`TEMPLATE_SETTINGS` is now **exported** from `noodl-mcp/tests/sb007Template.ts` — the one place the
template's settings are written — and imported by `nodegx-backend/tests/helpers/site-drive.ts`.
A retyped copy in the harness would drift from the template exactly as the template drifted from
`createProject.ts`, which is the two-create-paths shape that cost D40 fourteen sessions.

⚠️ Byte-neutral on the shipped artefact: `sb007Template.test.ts` **62/62**, and
`site-builder.content.json` md5 unchanged at `42abe93c0046ec30bf0c3602b5dd9065`.

---

## 🔴 This does NOT resolve D40's VIB-001 contradiction. It sharpens it.

D40's row records an open disagreement: **VIB-001 measured `unreachablePx = 0`** while the judge line
for D40's own run read `scroll=NO unreachable=92px`. s47 accounted for it as *a corpus mixing
projects from both create paths*.

🔴 **That account is now positively excluded, at least for these two runs.** `vib001-site.look.ts`
and `sbr005-sections.look.ts` both call **the same `authorSiteTemplate`**, on the same fixture, and
neither applied `bodyScroll`. Yet:

| run | page | reading |
|---|---|---|
| `vib-001`, 2026-08-31, `d96a7cb4` | `public-home`, content 1594 vs 900 | **`canScroll: true`, `unreachablePx: 0`** |
| `sbr-005`, 2026-09-01, `5ac3e72a` | `all-five`, content 2039 vs 900 | **`canScroll: false`, `unreachablePx: 1139`** |

Same fixture, same harness, both taller than the viewport, opposite answers. **So it is not the
create path.** The remaining candidates are the **89 commits between those two SHAs** (four of them
touch `noodl-viewer-react/src`, including VIB-002's ground work) or a real difference between the two
pages. ⚠️ **Neither has been measured. Do not write this row as settled.**

---

## The look, on shots that are finally of the page rather than of D40

Judged from `all-five-desktop-full.png`, `all-five-wide-viewport.png` and
`kind-contact-desktop-viewport.png` in this directory.

✅ **What is working, and it is more than the baseline suggested**: an editorial serif against a sans
body, a warm off-white ground, a hero that reads as a poster rather than a card, a deep-blue CTA band
with a white pill button.

🔴 **Still SHITTY, for six nameable reasons** — a better VIB-009 brief than the baseline was:

1. 🔴 **The contact form's inputs are invisible.** Three labels with nothing beneath them: no box, no
   border, no rule. A visitor cannot see where to type.
2. **The nav wraps to two lines at 1900px** — seven short items, and it breaks after five. It is
   capped to the content column.
3. **The column never widens**: ~700px centred at 1900, nothing full-bleed. Component-demo altitude,
   which is VIB-013's argument.
4. **Two button idioms**: the CTA is a white pill, `Send` is a square-cornered black rectangle, and
   black is not in the palette.
5. **`--primary` fights the palette** — corporate blue nav/footer links against cream and earth.
6. Uniform vertical rhythm, so hero and passage carry the same weight.

### 🔴 (1) and (4) have ONE cause, and it is a template gap rather than a runtime bug

`sb006Components.ts:1569-1595` — four controls, and **not one style parameter between them**:

```
nameField     net.noodl.controls.textinput  { useLabel: true, label: 'Your name' }
emailField    net.noodl.controls.textinput  { useLabel, label, type: 'email' }
messageField  net.noodl.controls.textinput  { useLabel, label, type: 'textArea' }
sendButton    net.noodl.controls.button     { label: 'Send' }
```

No background, no border, no radius, no colour — while the `h2` immediately above them sets four
`var(--token)` values. So the page renders the **stock control defaults**. Fixing it is authoring,
not engineering.

⚠️ **What is NOT a finding**: the gallery's flat gradient tiles. Those are the harness's own
synthetic pictures — `swatch(name, from, to)` at `sbr005-sections.look.ts:88` builds a data-URI SVG
linear gradient so each picture can be identified by colour and ACL-asserted. **A fixture choice,
not the template failing to use `starter-imagery`.** It was very nearly reported as a product defect.

---

## The one red, and it is NOT this session's

`AC3: a sent message says so, a failed one says so, and never both` —
`no button labelled "Send". Buttons on the page: []`, at the **failure arm**'s click, after
`service.stop()`.

🔴 **Identical in both arms** — `1 failed, 2 passed, EXIT=1`, same test, same message, with and
without `bodyScroll`. So it is pre-existing at HEAD and this session did not cause it.

⚠️ **Not diagnosed, and it is already a known-open row**: P77's board carries *"SBR-005 AC3's failure
control ⬜"*. What is new is the measurement — **zero buttons anywhere on the page** once the backend
stops, not merely a missing `Send`. Whether the published page unmounts its sections when its backend
goes away, or the harness simply raced the teardown, is unmeasured. Owner: **SBR-005**.
