# Phase 77 — next session

## ✅ No hold. Richard cleared the CPU freeze 2026-08-28 (s4): *"Freeze is off, go nuts."*

## Where the phase stands

| task | state |
|---|---|
| SBR-001 | ✅ closed s2, driven |
| SBR-002 | ✅ closed s4, driven |
| SBR-003 | ✅ closed s5 |
| SBR-004 | 🟢 **s7: AC1, AC2 and AC4 all driven PASS on a claimed site.** AC3 is SBR-012's. Two findings came out of it and both are below |
| SBR-005…014 | ⬜ open |

**s7 did what s6 owed.** Both fixes are authored in `packages/noodl-mcp/tests/sb006Components.ts`,
regenerated into the shipped `site-builder.content.json` (`npm run template:site-builder`), and
driven. Full detail is **SBR-004 §9** — read it before touching the graph.

- **AC1**: nav **219 → 68px**, all three links on **one row at y=24**; header 98, footer 74.
  The lever is `sizeMode` (`STACKED_IN_A_COLUMN`). 🔴 `flex-grow` is not the lever — twice measured.
- **AC2**: `--primary`/600 on the current link and muted/400 on its siblings, on a fresh `/home`
  load **and** after clicking through to `/about`. Nothing poked.
- **AC4**: re-confirmed at 360px with a control pair.

## 🔴 Start here: the root URL `/` renders no page

Bigger than either AC that was just fixed, and it is the URL a first visitor types.

**Driven at `http://localhost:8574/` on the claimed site**: `Noodl.Variables` holds **0 keys**,
`siteCurrentSlug` is `undefined`, the `h1` is empty, and the whole body is
`Home About Studio / My site / My site / Home` — the nav and the footer, no page.
`/home` and `/about` render correctly, so it is the **empty-slug path** specifically.

**The mechanism is named and is the same family as AC2's.** `/Pages/Site`'s
`The slug to show` (`resolveSlug`) guards on `if (Inputs.homeSlug === undefined) return;`.
Its `run` is `Page.didMount`; its `runOnChange-in-homeSlug` is `false`. So if the
`SiteSettings` fetch answers *after* mount — which is a race it wins only by luck on a local
backend — the guard fires once and nothing re-runs it. The empty URL slug is the one case that
*needs* `homeSlug`, which is why only `/` breaks.

✅ The fix has the same shape as AC2's: write `runOnChange-in-homeSlug: true` (and
`-in-slug`) explicitly in `sb006Components.ts`. Verify it the way AC2 was verified — load `/`
and read `Noodl.Variables.siteCurrentSlug` and the `h1`, on a claimed site.
⚠️ Check the ordering consequence first: `resolveSlug` writes the app-wide current slug and
gates the filtered page query, so making it re-run on every input change is a real behaviour
change, not just a re-trigger. §9.2 has the reasoning; the other 33 migrated nodes are fine.

## 🔴 The finding that is bigger than this template: the NDA-017 migration fires on new projects

`sb006Components.ts` never authored the `runOnChange-*: false` that broke AC2. They are written
on **every project load** by the NDA-017 back-compat migration (`applypatches.js:71` →
`ProjectPatches/runOnValueChangeMigration.ts`): for any node in the fifteen families whose
**control signal is connected**, write `runOnChange-<input>: false` for the value inputs that
signal used to silence.

That is correct for a graph authored before NDA-017 §2, and the migration **cannot tell such a
graph from one created this morning** — the project format has nowhere to record that it ran, an
open question §2 recorded and did not close.

**Measured over a freshly created site-builder project: 37 nodes carry a migrated `false`, and
not one node in the project carries a `true`.** Four are the template's deliberate
`NO_LOAD_TIME_FETCH` pairs; the other 33 are the migration's.

✅ **What makes the fix work**: an already-present `runOnChange-<input>` key is **never touched,
whatever its value**. So an explicit `true` survives the load and *absent* does not — which is
why the spec asserts the literal `true` rather than "not `false`".

🔴 **This is a product defect, not a template one**, and it deserves a task of its own: every
author who wires `Run` on a new graph gets their value inputs silently turned passive on the
next load, and the property panel will show them unticked with no explanation. Worth reading
§2's "once and stamp" open question again — a project-format marker is the obvious answer.

## ⚠️ `maxWidth` is inert on `Text`

Authored as AC4's guard, driven, and removed. With `maxWidth: { value: 100, unit: '%' }` set on
the nav link, `getComputedStyle(link).maxWidth` reads **`none`** on the claimed site — while on
the same page load `Page ground`'s `minHeight` and `Page shell`'s `maxWidth`, the same port
family and the same `{ value, unit }` shape, both render on their `Group`s. `maxWidth` is a
declared, unconditional port on `Text` in the catalog. **Do not re-add it from the armchair**;
the spec pins its absence. AC4 holds without it (measured, §9.4).

## 🔴 Still standing from s6, unchanged

**SB-017 §11.1's `prop-title`/`prop-slug` drop is driven.** Typing a title and a slug in
`/Pages/Admin` and pressing `New page` POSTs
`{"published":false,"showInNav":true,"navOrder":0,"ACL":{…}}` — **HTTP 201, no title, no slug**.
The three `prop-*` that arrive are exactly the three set as *parameters*; `prop-title`/`prop-slug`
exist only as **connection targets**. Discriminators in SBR-004 §8.3. So the ruled SBR-008 fix is
**not only a deploy fix** — the admin→site loop is broken in the local preview.

⚠️ **`/Pages/Admin` at 360px: the `New page` button's centre is off-screen** (box 310→410 in a
360px viewport; clipped, not scrollable, so a `cdp click` lands on nothing). SBR-006's.

🔴 **The footer's `Home` link is `--primary` + semibold on every page.** Now that the nav has a
real current-page indicator, the footer is a second one that disagrees on every page except home.

## What s6/s7 settled, so nobody re-derives it

- ✅ **The Secrets panel works.** `···  → Secrets` on the backend card wrote `SITE_SETUP_TOKEN`
  into `~/.noodl/backends/<id>/secrets.json` under the **`functions`** namespace, which is what
  `resolveFunctionSecret` reads (`service.ts:793`). s5's "blocked" was about hand-editing the file.
- ✅ **49 specs were green while AC1 and AC2 both failed on a real page.** Three checks now close
  the hole (SBR-004 §9.5): the AC2 one imports and runs the **real** migration over the **real**
  written artefact; the AC1 one walks the whole *placed* tree across component boundaries and
  asserts the ordered census of every node it reached. Both mutants call the same function the
  green arm calls.
- ✅ Driving the shipped artefact: read the 11 parameter values out of the regenerated
  `site-builder.content.json` and apply them into the drive project **by label** — never retype
  them, or you measure something that does not ship.

## Traps this session paid for

- 🔴 **A control pair that clears an inline style clears the RUNTIME's value too.** The first
  `maxWidth` control read 399px in both arms — because setting `el.style.maxWidth = ''` to
  "restore" it deleted the value the runtime had written. Both arms ran without the thing under
  test and agreed, which reads exactly like "the parameter does nothing". ✅ **Read the property
  first and restore what you read**, and treat two identical arms as a broken instrument before a
  finding.
- 🔴 **The viewer target is listed as `webview`, not `viewer`.** `cdp targets | grep viewer`
  never matches, so an until-loop on it spins forever. `--target=viewer` itself works fine.
- ⚠️ There is no CDP emulation command in `cdp.js`. To drive a phone width, set the editor's
  `webview` element width directly (`document.querySelector('webview').style.width='360px'` plus
  its parent) and wait on `window.innerWidth` in the viewer.
- ⚠️ A hand-copied project does **not** appear in the launcher's list, and `Open project…` is a
  native dialog. Patch the project the launcher already knows, after backing it up.

## Standing context

- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
- 🔴 Never scope by time. Every task's ACs include a person sentence — verify as written, and if
  the platform cannot express what an AC asks for, **say so and record the gap** rather than
  quietly substituting. (`maxWidth` above is exactly that case.)
- Drive artefacts: **`SBR-004 Mounted Drive`** is claimed, has `SITE_SETUP_TOKEN` provisioned and
  three published pages (`home`/`about`/`studio`), owner `owner@example.com` /
  `drive-password-1`, and **now carries the s7 graph**. A pre-s7 copy is `SBR-004 AC1AC2 Drive`.
  `SBR-004 Theme Drive` still carries the pre-`mounted` graph — do not reuse it.
- Shared checkout: **pathspec commits only**; announce editor launches **and** teardowns;
  `test:ci` alone.
