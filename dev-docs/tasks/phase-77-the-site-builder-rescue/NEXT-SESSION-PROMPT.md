# Phase 77 — next session

## ✅ No hold. Richard cleared the CPU freeze 2026-08-28 (s4): *"Freeze is off, go nuts."*

## Where the phase stands

| task | state |
|---|---|
| SBR-001 | ✅ closed s2, driven |
| SBR-002 | ✅ closed s4, driven |
| SBR-003 | ✅ **closed s5** — its carried `var(--token)` dimension probe is answered (below) |
| SBR-004 | 🟡 **built, swept, driven — but AC1 and AC2 are NOT verified**; see "start here" |
| SBR-005…014 | ⬜ open |

**s5 gate readings** (tree `78a04e69`, everything committed):
`typecheck:editor` 0 · `typecheck:mcp` 0 · mcp sb006+sb007 **71/71** ·
`test:main` **375 suites / 6254 tests** · `test:ci` **2875 specs / 4 failures, all
`AIX-006 style vocabulary` by name** (seed 79133).

⚠️ The floor moved from **2863 to 2875** — a peer's TPL-001 (members-area template) landed 12
specs mid-session. Separate failures **by name**, never by count.

## 🔴 Start here: claim a site and re-drive AC1 and AC2

**This is the one thing s5 could not do, and it is two of SBR-004's four ACs.** Both s5 drives
were of an **unclaimed** site, where the nav renders **zero links**. So:

- **AC2 has never been observed in a browser.** The current-page distinction is asserted in
  specs only. The mechanism is `/Pages/Site`'s `resolveSlug` writing `Noodl.Variables
  .siteCurrentSlug`, and each `/Site/NavLink` reading it through a `Variable2` node **plus** a
  direct read in its state function. The direct read exists for the ordering the spec cannot
  see — a link created *after* the page resolved its slug gets no `changed` signal. **A running
  nav is the only thing that can tell you whether both halves work.**
- **AC1's person sentence has only been seen on a "This site has not been set up yet." page.**

To claim: provision `SITE_SETUP_TOKEN` through the backend card's overflow "···" → **Secrets**
panel (writing `~/.noodl/backends/<id>/secrets.json` by hand is blocked), then run the setup
flow. Use **`SBR-004 Mounted Drive`** — it is the only drive project carrying the current graph.
`SBR-004 Theme Drive` has the pre-`mounted` graph; do not reuse it.

⚠️ **One observation s5 recorded and did NOT diagnose:** on the unclaimed page at 360px the
`nav` measured **151px** tall and `header` **150px**, against ~33px and ~36px of apparent
content. `flex-grow: 0` on the shell's children changed neither, so it is not the parent
distributing space; every `Group` computes `flex: 100 1 auto` (Noodl's default). **Measure it on
a claimed page before treating it as a defect** — a page with a title and sections may absorb it
entirely. It is what makes the unclaimed screenshot look sparse.

## What s5 settled, so nobody re-derives it

- ✅ **A `var(--token)` on a dimension port constrains a real box.** `max-width:
  var(--site-measure)` → computed `704px`, rendered **704px**; the unknown-token control
  → computed `none`, rendered **940px**. Same element, same viewport, one variable.
  🔴 The control is also SBR-012's arm 3 in miniature: **a typo'd token renders as nothing**, and
  no raw-colour check can see it.
- ✅ **AC4's overflow half.** `scrollLeft` reaches 0; a planted 2000px control reaches 1640, so
  the absence has a known-firing signal. ⚠️ `body.scrollLeft` reads 0 in *both* arms — `html` is
  the scroller, and a body-only reading fails in the same shape as a pass.
- 🔴 **`visible` holds its space; `mounted` does not.** `visible: false` is `visibility: hidden`
  — the port's own text says "keeping the space it occupies in the layout". At 360px the hidden
  contact wrapper was **365px** of empty page. Six public-site surfaces are now `mounted`, and a
  spec refuses `visible` anywhere on the public site (parameters AND wires). **Use `mounted` for
  anything shown conditionally, everywhere in this phase.**
- 🔴 **Nothing consumed `--background`/`--foreground` before SBR-004.**
  `TokenResolver.generateCss` stamps `:root {…}` and `body { font-family }` and nothing else
  (`TokenResolver.ts:137`). A token nothing reads is a theme nobody sees — **every new surface
  must name its own colours.**
- 🔴 **A `For Each` cannot carry a constant** (`foreach.tsx:586-597`) — only `id` and the model's
  own fields. The app-wide-variable route is the answer; SBR-006/007 will hit this again.
- 🔴 **`aria-current` is unauthorable — no ARIA anywhere in the platform.** No visual node
  declares an aria or attribute port; the only ARIA in `noodl-viewer-react` is a hard-coded
  `aria-hidden` on `IconGlyph`'s svg. This is the runtime-accessibility hole that blocks four
  adjacent markets. **Worth its own task; it is not SBR-004's to fix.**
- ⚠️ **A wrapped row around a Repeater WITH a gutter is refused** (`uncollapsible-multi-column`
  arm B, `responsiveArrangement.ts:238-256`) — the `columnGap` is the discriminator. Put the
  spacing on the item.
- ⚠️ **`Text` has no padding ports; `Group` has no text `color` port.** Margin on text, colours
  on leaves.
- ✅ **The 2-suite `test:main` failure s4 left owed was never a flake.** Four
  `tests-unit/sb-01{7,8}` specs declared `const siteBuilder` with no top-level import/export, so
  TypeScript treated them as global **scripts** and ts-jest typechecks all of `tests-unit` in one
  program; whichever pair shared a worker failed TS2451 and the whole **suite failed to run** —
  2 failed suites, **0 failed tests**, 6244 instead of 6254. `export {}` scopes them. **A suite
  that fails to RUN reads like a flake and is not one — reconcile the test COUNT, not just the
  failure list.**

## Wizard-driving recipe (s5 used it twice; it works)

1. Stamp and click **"New project"** — it needs **two** clicks the first time.
2. Stamp the `Start from a Template` **BUTTON** (`EntryModeStep-module__ModeCard-hit`).
3. Type the name into the modal's one `input`, then **Next**.
4. 🔴 Click the `button[class*=TemplateCard--]` **root** and **verify `--selected` landed** —
   clicking the title span reports success and selects nothing, and Review then says
   "Hello World".
5. Check Review names **Site Builder**, then **Create Project**.
6. Preview appears as a **separate CDP target** (`--target=viewer`), titled by the page.
7. 🔴 **The preview is 988×313 until you pick a device size** — topbar `ZoomSelect` (the *first*
   `EditorTopbar-module__ZoomSelect`) → "Mobile, common (360 x 800)".
8. ⚠️ `cdp eval` shares one context across calls — `const x` twice is a `SyntaxError`. Use IIFEs.
9. ⚠️ An HMR abort reloads the renderer back to the **launcher**, losing your stamps. Re-stamp.

## Standing context

- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
- 🔴 Never scope by time. Every task's ACs include a person sentence — verify as written, and if
  the platform cannot express what an AC asks for, **say so and record the gap** rather than
  quietly substituting.
- Shared checkout: **pathspec commits only** (peers were mid-edit on lessons and the members-area
  template all session); announce editor launches **and** teardowns; `test:ci` alone.
