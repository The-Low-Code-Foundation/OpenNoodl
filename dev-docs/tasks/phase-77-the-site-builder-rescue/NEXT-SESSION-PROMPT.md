# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## ✅ s8b drove it. SBR-004's ACs are done; start on the open tasks

The root URL fix is **driven with a control pair**, not asserted. Detail in SBR-004 §11.

🔴 **Two things from that drive that change what other tasks assume:**

1. **The defect was never the empty-slug path.** §9.2 said `/home` and `/about` were fine and
   only `/` broke. With the `SiteSettings` fetch slowed by 1500ms, **all three render no page** —
   the guard `if (Inputs.homeSlug === undefined) return;` gates every slug, not the empty one.
   The root URL was just the path that lost the race on a warm local backend. **A cold backend
   over a real network is the arm this template has never been driven in — carry that into
   SBR-014.**
2. **A single pass on a race proves nothing.** The first pre-fix reading of `/` was a PASS, and
   so were twelve consecutive reloads. Both arms would have agreed. The instrument that worked:
   `Fetch.requestPaused` on `*8594*` in the viewer target, delaying **only** backend requests so
   `didMount` still fires on its own clock. Kept as
   `scripts/devtools/slow-backend-probe.js <delayMs> <label> <path>` — **reuse it for anything with a
   fetch-vs-mount ordering.**

## What s8 built

- **The fix**: `runOnChange-in-slug`/`-in-homeSlug: true` on `/Pages/Site`'s `The slug to show`
  in `sb006Components.ts`, regenerated. The ordering consequence the s7 handoff asked to check
  first was checked and is benign — `out-slug` is `pageQuery`'s only trigger, but a run before
  `homeSlug` publishes nothing, so the first run that reaches the body is the first fetch.
- 🔴 **§9.2's clearance of the other 32 silenced nodes was an armchair claim, and is now a
  census** (SBR-004 §10.3). 27 nodes, 48 parameters. The sentence turned out right for a reason
  it did not state: the discriminating property is **whether the silenced input's producer is
  ordered before the control signal**. The template has exactly one control signal that fires on
  a clock its values do not share (`Page.didMount`) and exactly one producer with that guarantee
  (`PageInputs` — `router.tsx:586` sets it before `addChild`). Two mount-triggered nodes; one
  was the defect, one (`/Pages/PageEditor`'s `Hold the page id`) is measurably safe.
- **New artefact-wide gate** in `sb007Template.test.ts`: known-firing signal, a grader that
  asserts its **reason column** and not just emptiness, and a mutant that calls the grader.
  🔴 The mutant reds on `in-homeSlug` **alone** and clears `in-slug` — finer than the fix, and
  worth keeping: a grader that named both inputs would be naming the port list, not the defect.

**Gates**: template regenerated · `typecheck:editor` 0 · `typecheck:mcp` 0 · mcp sb004/005/006/007
**122/122** · editor sb-007/015/017/018 + sbr-001/002/003 + fb-005 **377/377** · `test:main`
**6254/6254**.
⚠️ **`test:ci` was NOT run** — it drives Electron and Richard's stack was live. Owed.

## 🔴 The product defect that still has no task

`sb006Components.ts` never authored a single `runOnChange-*: false`. They are written on **every
project load** by the NDA-017 back-compat migration (`applypatches.js` →
`ProjectPatches/runOnValueChangeMigration.ts`), for the value inputs of any node in the fifteen
families whose control signal is wired — **37 of them in a project the template minted that
morning, and not one `true` anywhere in it.**

NDA-017 §4 closed its own "once and stamp" open question with *"presence of the key is the
marker"*. **That inverts on projects authored after §2**: the migration reads an absent key as
"pre-§2, silence it" and the panel reads the same absence as "never touched, so ticked". Same
absence, opposite meanings, and the marker cannot tell the two populations apart. It bites an
author, not only a template — wire `Run` on a graph you are authoring today, save, reload, and
your value inputs are unticked with no explanation.

✅ **What s8 measured about the fix, since §2's premise about it is also wrong** (written up in
NDA-017 under *"A third premise that did not survive contact"*):

- The format **does** have version channels the migration can already see: `version` (the
  `ProjectModel.Upgraders` ladder) and `nodegxVersion`, on the raw JSON `applyPatches` receives
  (`projectmodel.editor.ts:24` — the next lines read `content.version`).
- ⚠️ But `version` is gated by `supportedProjectVersion`, so bumping the ladder makes projects
  unopenable in older builds.
- ⚠️ And `ProjectModel.toJSON` is a **whitelist**, so a new top-level marker key would be
  dropped on the next save and the migration would simply run again. A stamp is a small
  deliberate format change — a field plus a `toJSON` line — not a free one.

**This needs a task and an owner, and whose phase it belongs to is Richard's call**, which is
why s8 recorded it (README §4 finding 8) rather than minting an SBR id for it.

## 🔴 Still standing, unchanged

**SB-017 §11.1's `prop-title`/`prop-slug` drop is driven.** Typing a title and a slug in
`/Pages/Admin` and pressing `New page` POSTs `{"published":false,"showInNav":true,"navOrder":0,
"ACL":{…}}` — **HTTP 201, no title, no slug**. The three `prop-*` that arrive are exactly the
three set as *parameters*; `prop-title`/`prop-slug` exist only as **connection targets**.
Discriminators in SBR-004 §8.3. The ruled SBR-008 fix is **not only a deploy fix**.

⚠️ **`/Pages/Admin` at 360px: the `New page` button's centre is off-screen** (box 310→410 in a
360px viewport; clipped, not scrollable, so a `cdp click` lands on nothing). SBR-006's.

🔴 **The footer's `Home` link is `--primary` + semibold on every page.** Now that the nav has a
real current-page indicator, the footer is a second one that disagrees everywhere but home.

⚠️ **`maxWidth` is inert on `Text`** — authored, driven (`computed: none`), removed. Same port
family renders fine on `Group`. A product defect worth its own look. Do not re-add it from the
armchair; the spec pins its absence, and AC4 holds without it (§9.4).

## Traps s7/s8 paid for

- 🔴 **A control pair that clears an inline style clears the RUNTIME's value too.** Both arms
  read 399px because `el.style.maxWidth = ''` deleted what the runtime had written. Read the
  property first and restore what you read; two identical arms are a broken instrument before
  they are a finding.
- 🔴 **The viewer target is listed as `webview`, not `viewer`** — `cdp targets | grep viewer`
  never matches and an until-loop on it spins forever. `--target=viewer` itself works.
- ⚠️ No CDP emulation command in `cdp.js`. For a phone width set the editor's `webview` element
  width directly and wait on `window.innerWidth` in the viewer.
- ⚠️ A hand-copied project does **not** appear in the launcher's list, and `Open project…` is a
  native dialog. Patch the project the launcher already knows, after backing it up.
- 🔴 **A mutant that restates the rule proves the rule is writable, not that the check runs.**
  s8's first draft of the new gate did exactly that; the grader is now a function both arms call.

## Standing context

- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
- 🔴 Never scope by time. Every task's ACs include a person sentence — verify as written, and if
  the platform cannot express what an AC asks for, **say so and record the gap** rather than
  quietly substituting.
- Drive artefacts: **`SBR-004 Mounted Drive`** carries the s7 graph (not yet s8's). A pre-s7 copy
  is `SBR-004 AC1AC2 Drive`. `SBR-004 Theme Drive` still carries the pre-`mounted` graph — do not
  reuse it.
- Shared checkout: **pathspec commits only**; announce editor launches **and** teardowns;
  `test:ci` alone, and never beside a live stack.
