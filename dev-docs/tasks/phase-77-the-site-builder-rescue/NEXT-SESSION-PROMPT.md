# Phase 77 — next session

## ✅ No hold. Richard cleared the CPU freeze 2026-08-28 (s4): *"Freeze is off, go nuts."*

## Where the phase stands

| task | state |
|---|---|
| SBR-001 | ✅ closed s2, driven |
| SBR-002 | ✅ closed s4, driven |
| SBR-003 | ✅ closed s5 |
| SBR-004 | 🟡 **built s5, driven on a claimed site s6 — AC1 and AC2 both FAIL, both diagnosed.** The fixes are small and named below |
| SBR-005…014 | ⬜ open |

**s6 did what s5 owed**: claimed the site through the real Secrets panel + `/admin/setup`,
published three pages, and drove the public site with a nav that finally has links in it.
Everything below is measured, each with a control pair on the same page load. Full detail is
**SBR-004 §8** — read it before touching the graph.

## 🔴 Start here: two small fixes in `sb006Components.ts`, then re-drive §8's tables

Both are in the template source (`packages/noodl-mcp/tests/sb006Components.ts`), **not** in a
drive project, and §8 already contains the acceptance table for each.

### 1. AC2 — the current-page state never runs (one parameter)

`Site/NavLink`'s `Is this the page being read` has `runOnChange-in-slug: false` and
`runOnChange-in-current: false`, so its only trigger is `Which slug the page is showing.changed`.
`/Pages/Site` writes `siteCurrentSlug` **before** the nav's `For Each` builds the links, so
`changed` has already fired and never fires again. Measured: all three links render
`rgb(0,0,0)`/400 on load, and on `/about` after in-app navigation too (the page re-mounts).

🔴 **§5's mitigation cannot help and the reason is worth keeping**: the direct
`Noodl.Variables[...]` read is *inside the function body*, and the body never executes. A
fallback inside a function does not cover "the function is never called."

✅ Set `runOnChange-in-current: true`. Proof it is sufficient: poking the variable while the
links are mounted produces **`rgb(30,77,140)`/600 for the current link and `rgb(86,83,76)`/400
for its siblings** — both channels, exactly as built.

⚠️ While there, look at the **footer's `Home` link**, which is `--primary` + semibold on every
page. Until AC2 works the footer is the only thing on the page that looks like a current-page
indicator, and afterwards the two need to not disagree.

### 2. AC1 — the nav is a column and the sections split the viewport

Neither is authored; both are platform defaults the template has to override explicitly.

| | as built | control | varied |
|---|---|---|---|
| nav is a column | nav **219px**, links on 3 lines | nav **68px**, one row | `width:auto; flex-grow:0` on the links |
| sections split the page | 219 / 218 / 219 | **138 / 98 / 74** | `height:auto` on nav, header, footer |

- `addDimensions` defaults every node to `width: 100`, `height: 100`, unit **`%`**
  (`node-shared-port-definitions.ts:813-846`); `Group`'s `defaultSizeMode` is `explicit`. So an
  unstyled `Group` is `width:100%; height:100%` and three stacked ones take a third each.
- `Text` is `defaultSizeMode: 'contentHeight'` (`text.ts:149-152`) so it still takes
  `width:100%`, and `Layout.size` converts a percentage *along* the parent's direction into
  `flexGrow` (`layout.ts:83-88`) — the measured `flex: 100 1 auto`. **In a `flex-wrap: wrap`
  row every `Text` claims the whole line, so a "bar" renders as a stack.**

🔴 **This also closes s5's undiagnosed 151px/150px note, and s5's lever was the wrong one.**
`flex-grow: 0` changes nothing (verified 0 in computed style, heights held) — the height comes
from `height: 100%`. **Do not re-test this with flex-grow.**

✅ With both neutralised the page is AC1's sentence: `Home  About  Studio` on one rule-bottomed
row, Home in `--primary` semibold, serif display, 704px measure, warm ground. Three inline
overrides, no graph change — the distance to AC1 is small.

## 🔴 The other thing s6 found, and it is bigger than SBR-004

**SB-017 §11.1's predicted `prop-title`/`prop-slug` drop is now driven.** Typing a title and a
slug in `/Pages/Admin` and pressing `New page` POSTs
`{"published":false,"showInNav":true,"navOrder":0,"ACL":{…}}` — **HTTP 201, no title, no slug**.
The three `prop-*` that arrive are exactly the three set as *parameters*; `prop-title`/`prop-slug`
exist only as **connection targets** and the node's saved `dynamicports` holds no `prop-*` at all.

Discriminators (so nobody re-derives it): `/Pages/Setup` uses the same node type and the same
`onTextChanged → port` wire and **its three values all arrived**, so the instrument fires; and a
create issued after the columns existed, and again after a full viewer reload, dropped them
identically — not a schema race.

🔴 **A slug-less page is unreachable and a title-less one renders a blank nav link.** So the
ruled SBR-008 fix (README §1: derive `prop-<field>` in the runtime from the node's own wires) is
**not only a deploy fix** — the admin→site loop is broken in the local preview, which is where
every first impression of this template happens. Worth re-reading SBR-008's scope against this.

## What s6 settled, so nobody re-derives it

- ✅ **The Secrets panel works.** `···  → Secrets` on the backend card wrote `SITE_SETUP_TOKEN`
  into `~/.noodl/backends/<id>/secrets.json` under the **`functions`** namespace, which is what
  `resolveFunctionSecret` reads (`service.ts:793`). s5's "blocked" was about hand-editing the
  file, not the panel. `claimSite` then granted the role and wrote both singletons.
- ✅ **AC4's overflow half holds on a claimed page at 360px**: `scrollLeft` 0 as built, **1640**
  with a planted 2000px control, 0 after removing it.
- ⚠️ **`/Pages/Admin` at 360px: the `New page` button's centre is off-screen** (box 310→410 in a
  360px viewport; hit at x=355, missed at x=360; `scrollWidth` stays 360, so it is clipped).
  A `cdp click` aims at the centre and lands on nothing. SBR-006's, but a real one.

## Traps this session paid for

- 🔴 **A refused write and a filtered read look identical.** A `DELETE` loop with output to
  `/dev/null`, "confirmed" by an *anonymous* query, reported six rows gone that were still
  there — they were admin-ACL rows the anonymous query could never see, and they sat in the nav
  as blank links through the first pass of the measurements. ✅ **Check the HTTP status, and
  verify on the same population you wrote to.**
- 🔴 **Panels are all mounted; only one has a box.** `document.querySelector('[class*=PanelHeader-module__Title]')`
  returns the *first* — a hidden, zero-sized "Components" — so ten rail clicks all read as
  "nothing happened" when every one had worked. ✅ **Filter by `getBoundingClientRect().width > 0`.**
- ⚠️ Menu items double (the `BaseDialog` ghost) — pick the copy with no `MeasuringContainer`
  ancestor. DOM stamps survive across `cdp` calls but **a click that re-renders wipes them**;
  re-stamp before each click.
- ⚠️ The preview device size is the editor topbar's **first** `EditorTopbar-module__ZoomSelect`.
  At 360px a button whose centre is at x≥360 cannot be clicked by selector at all.

## Standing context

- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
- 🔴 Never scope by time. Every task's ACs include a person sentence — verify as written, and if
  the platform cannot express what an AC asks for, **say so and record the gap** rather than
  quietly substituting.
- Drive artefacts: **`SBR-004 Mounted Drive`** is claimed, has `SITE_SETUP_TOKEN` provisioned and
  three published pages (`home`/`about`/`studio`), owner `owner@example.com` / `drive-password-1`.
  Re-usable as-is. `SBR-004 Theme Drive` still carries the pre-`mounted` graph — do not reuse it.
- Shared checkout: **pathspec commits only**; announce editor launches **and** teardowns;
  `test:ci` alone.
