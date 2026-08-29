# Phase 78 — next session

## Where it stands

**TPL-002 is built, graded, and driven.** s14 built the feature; s15 took the one thing s14 left —
*"nobody has ticked the box on the screen, and nobody has opened the unsubscribe link in a page"* —
and in taking it found two defects inside TPL-002's own acceptance criteria, both now fixed.

| | after s14 | after s15 |
|---|---|---|
| `tpl002-account-drive.test.ts` | — | **22/22** |
| `tpl002-account.look.ts` (pictures) | — | **written** |
| `tpl001Template.test.ts` | 71/71 | **71/71** (one pinned `mounted` count 46 → 49) |
| the four tpl001/tpl002 backend suites | 108/108 | **130/130** |
| noodl-mcp | 958/958 | **958/958** |
| generation | 88 + 6 info | **88 + 6 info**, exit 0 |

✅ `typecheck:mcp` and the backend `tsc` clean. ⚠️ `test:ci` **not run** — no editor source touched,
deliberately, as every session this phase. Committed as `7392e687`.

## 🔴 Read this first

- 🔴 **[D36](DEFECTS-THE-TEMPLATES-FOUND.md): a `Condition` can only ever turn a gate ON.** Tick the
  account page's box and untick it **without reloading** and it showed *both* confirmations at once.
  Every earlier reading was of a **first** change, which leaves exactly one notice up and looks
  perfect — the defect needs two transitions in one page life. Fixed with `onClear`/`offClear`/
  `failClear`, the `missingClear` shape, on the same `mounted` inputs.
  **The generic form: a spec that grades a confirmation by asserting the right sentence is present
  passes while the wrong one is present too. The row that catches it is `not.toContain` on the
  sentence that should have gone.**
- 🔴 **[D37](DEFECTS-THE-TEMPLATES-FOUND.md): `useLabel` defaults `false`**
  (`node-shared-port-definitions.ts:1440`), so a control labelled with a sibling `Text` node emits no
  `<label for>` and **its words do nothing when tapped**. The whole opt-in was a 24×24 square —
  exactly WCAG 2.2 SC 2.5.8's floor and no more. Applies to every checkbox and radio anyone builds
  the obvious way.
- 🔴 **[D38](DEFECTS-THE-TEMPLATES-FOUND.md): `render-from-disk.js:452` inlines the whole project as
  `window.projectData` in a `<script>`.** So `outerHTML` — and `querySelectorAll('*')` textContent —
  carries **every string the template is authored out of, on every page, whether or not anything
  rendered**. An absence check on a project string cannot pass; **a presence check on one cannot
  fail**, which is the expensive direction. `sentence()` now excludes `SCRIPT`/`STYLE`/`NOSCRIPT`.
  Every existing `html` assertion in the drives is about **row data**, so none was wrong — but
  `tpl001-empty-states` carried a row that measured the harness, and it now says what is true.
- ⚠️ **A member's band has THREE items, not six.** Three of the six are `moderatorOnly` and ship
  `mounted: false`. A look taken only as a member measures the wrong screen.

## Then, in order

1. ⬜ **[D39](DEFECTS-THE-TEMPLATES-FOUND.md) needs Richard, and it is cheap to ask.** The
   unsubscribe page names no association — its eyebrow is the literal *"Members' area"* — and offers
   no way back, while its own sentence says you can turn emails on again from your account. Not an
   oversight: the page is built to make **no** round trip, and the association name costs one public
   query. Does it name the association and offer a way in, or stay a single sentence?
2. ⬜ **T5 / publishing.** Unchanged, and still **Richard drives it first**. AC1 of TPL-001 is
   ungradeable until the template is on the shelf.
3. ⬜ **T3**, the category question. Untouched, and it needs Richard.
4. 🔴 **D22–D24, D28, D30, D32–D39 are all `NONE`.** **Twelve** unowned rows now; four were filed
   today. Phase 80 owns the register sweep.

## The two harnesses, and when to run them

**The drive** — a gate, runs in the suite:

    npx jest --config packages/nodegx-backend/jest.config.js \
      --runTestsByPath packages/nodegx-backend/tests/tpl002-account-drive.test.ts

**The look** — asserts almost nothing, writes pictures. `.look.ts` so no suite runs it. Run it
whenever you touch the account page, the unsubscribe page or `BAND_NAV`:

    npx jest --config packages/nodegx-backend/jest.config.js \
      --testMatch '**/tests/**/*.look.ts' --runTestsByPath \
      packages/nodegx-backend/tests/tpl002-account.look.ts

`TPL002_OUT=` chooses the directory (default `/tmp/tpl002-look`). It writes a PNG, the page text and
`<label>-<w>.band.txt` — every nav button's rect grouped by its top edge, which is what says how many
rows there are and whether anything is clipped. ✅ **The band was looked at and is right**: at 1280
five across with "Your account" alone on row two, nothing clipped; 2×3 at 390. No change made.

`tpl001-rows.look.ts` is still the only way to see the **lists** with content in them, and is
unchanged.

## 🔴 Traps this session paid for

- 🔴 **The order was the finding.** The drive was written and run **before** either fix: two rows red,
  twenty green; after the fixes, 22/22. That is a control pair taken in the only order that proves
  anything. Had the fixes gone first, 22/22 would have been consistent with a spec that grades itself.
- 🔴 **An absence read off the wrong string is unfalsifiable in both directions, and only one of them
  is noisy.** `html.not.toContain(A_PROJECT_SENTENCE)` fails loudly and gets noticed;
  `html.toContain(...)` passes silently on a blank page. D38's row had been green for four sessions.
- 🔴 **Ann was not a control for the unsubscribe, and the spec would have looked complete without
  Sam.** She is `false` before and after — which a token that did nothing at all satisfies exactly.
  A negative control has to be something whose value had to **survive**.
- 🔴 **The confirmation is not the consequence.** A page that paints "Done" and writes nothing passes
  every sentence row. The reading that matters is the **second send**: it skipped Mo and still
  reached Sam.
- ⚠️ **The link had to come out of the message body.** Composing `/unsubscribe?token=` in the harness
  from a token read out of the database would have left the whole surface between the pump and the
  router — the query string, `encodeURIComponent`, `PageInputs.queryParams` — unmeasured.
- ⚠️ **A pinned count is a claim, and its comment is a second one.** `tpl001Template.test.ts`'s
  `mounted` count moved 46 → 49, and the prose beside it said the confirm step was *"the one place a
  single node's `mounted` is driven from TWO conditions"*. That stopped being true in the same edit.

## Richard's rulings, still standing

- **Appearance is an acceptance criterion, graded BEFORE the behaviour work, by looking at it.**
  ✅ Honoured this session — the look ran first, and it is what found D37.
- **Seeding, 2026-08-29: close the delete gap, seed nothing.** AC6's designed empty state stands.
- **Opt-in, never opt-out** — UK and EU charities and congregations. ✅ Now graded on the screen, not
  only in the row: the box is `present`, `painted`, **unticked** and drawing no tick on first load.
- **Scope: A + B + all of C, with C done by phase 80.**
- **Templates exist to surface product defects** — findings go in the register **as work with an
  owner**, never as notes.
- **Privacy**: `requestAccess` keeps the non-answer. **Publishing**: not yet. He drives it first.
