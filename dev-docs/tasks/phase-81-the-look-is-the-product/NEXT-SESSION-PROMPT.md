# Phase 81 — next session

**Read `README.md` §1–§4 first** — the ruling, the rubric, the protocol, the rules. Then
**`VIB-007-THE-LOOP.md` §8** (AC3, built this session; §7 is AC1, §6 is V22). Re-derive the board from
`TASKS.md` + the task files; do not trust this file's copy of it.

## Board, re-derived from `TASKS.md` (2026-08-31, session 9)

| id | status |
|---|---|
| VIB-001 The Judge | 🟢 CLOSED, all 5 ACs. Baseline 9 SHITTY / 0 / 0 |
| VIB-002 The Ceiling | 🟡 PASSABLE — Richard ruled it |
| VIB-003 The Pictures | 🟡 PASSABLE — Richard ruled it |
| VIB-004 The Marketing Kit | 🟡 PASSABLE, **not yet seen by Richard** |
| VIB-006 The Worked Page | 🟢 CLOSED — **WORTHY**, ruled by Richard. The phase's only close on the look |
| VIB-011 The Stock Library | 🟡 PASSABLE — ruled twice |
| VIB-012 Prune On Deploy | 🟢 BUILT. 3.35 MB → 92 KB. ⚠️ full Electron deploy never run end to end |
| **VIB-007 The Loop** | 🟡 **AC1 ✅ (§7), AC2's V22 ✅ (§6), AC3 ✅ (§8, this session).** AC2 owes 5 predicates; **AC4/AC5 unstarted** |
| VIB-013 The Altitude | ⬜ startable in parallel |
| VIB-005 The Ambush Defaults | ⬜ startable now — M2 applied to the runtime-default family |
| VIB-008/009 | ⬜ prove it on the shipped templates |
| VIB-010 The Cold Proof | ⬜ the exit exam. Waits on VIB-007 **and** VIB-013 |

## What this session did

**AC3 — M3, the gate fires on poverty.** Chosen over AC2's tail because §7's own closing line named it
as the one AC1 most obviously enables. Full account in `VIB-007-THE-LOOP.md` §8. **Register V10 closes.**

Three findings ship in `@nodegx/render-measure` — `no-imagery`, `no-display-type`, `single-ground` —
each one of README §2's WordPress-starter tells **verbatim**. Both arms by a real Chrome: all three fire
on the `templates/members-area` door pages the baseline ruled SHITTY (8/8, 4/4 desktop, 6/8), and **none**
fires on the VIB-006 page.

Two new measurements were needed (`images.icons`, `grounds`), and one pre-existing **product defect was
found by measuring the control** — see below.

## 🔴 Six things worth carrying out of this session

1. 🔴 **The task file's own number was the wrong measurement.** §3 M3's *"distinct grounds: 1 vs 7"* is
   counted over `nodes.json` **parameters**; a render finding sees a **DOM**. Nothing was designed until
   both arms had been rendered. **When a doc hands you a number, check which instrument produced it.**
2. 🔴 **Measuring the control found a defect that made the WORTHY page permanently uncertifiable.**
   `dead-placeholder-text` (ERROR, therefore blocking under AC1) fired on VIB-006 at both viewports: a
   `StatTile` fallback of `"0"` and an instance legitimately setting `"0"` — *"0 air miles in the boxes"* —
   are the same pixel, and the finding asserted *"so it did not arrive"* as determined fact. **A refused
   value and a never-requested value are the same picture with opposite fixes.** Fixed in
   `overriddenDefaults`; VIB-006 now renders **zero findings**. It had been broken since AC1 shipped and
   nothing noticed, because nobody had rendered the WORTHY page *through the verdict*.
3. ✅ **The threshold is the rubric's, and the corpus is the check — not the source.** README §2 says
   *"headline under ~48px on desktop"*, and the seven recorded fixtures (four independent authors' real
   builds) **all top out at exactly 48 or 60px** while the two SHITTY templates top out at 30. A ratio
   fitted to the two artefacts under test would have landed at 2.6 and meant nothing.
4. 🔴 **A field that was never measured is UNKNOWN, never zero.** The older fixtures predate `grounds`
   and `images.icons`; reading `undefined` as "none" would have reported *"no imagery"* about builds
   shipping sixteen photographs. Every predicate requires its field to **exist**, and the spec runs all
   six older fixtures through to prove silence.
5. 🔴 **Probe the DOM; do not infer it from the component that writes it.** `IconGlyph`'s font branch
   renders `span.lucide.icon-sprout` with **no `ndl-icon-glyph` class** — a selector written from the
   module's own constant counts **zero** on a page with ten glyphs. Likewise every gradient band reports
   `backgroundColor: rgba(0,0,0,0)`, so a colour-only ground count read 6 on a page with 8.
6. ⚠️ **`measureExpression` is a template literal and a backtick in a comment ends it.** The file warns
   about this in its own source; it still cost a cycle, and it surfaces as a syntax error hundreds of
   lines away.

## 🔴 The next job

Two live candidates, and a session should say which it took and why:

1. **VIB-007 AC2's tail — V32, V33, V23, V28, V29**, in that order. V32 is *configuration only* (run
   `raw-color-literal` in `catalog:examples`); expect it to red the corpus on the first run as V22 did,
   and read §6 for what switching a check on over an existing corpus costs. This is the only thing left
   between VIB-007 and AC4.
2. **VIB-013 The Altitude**, which is startable in parallel and which §2's mapping says retires M4/M5's
   ten rows — and note §2's own correction: **M5 is prevention, not cleanup**, since all five rows it
   retires are already closed and were each paid for by hand.

⚠️ **AC4 (the A/B through the Judge) is VIB-007's original close condition and is still untouched.** It
is now genuinely closer: M1 and M3 are in, and AC4 measures what an agent produces with the standard
surfaces. It needs AC2's tail first.

🔴 **Three things not to re-litigate**: instruction was measured and rejected as the lever (V17, V35);
VIB-005 owns V1/V2/V14/V17/V21/V38; and **the poverty family is `warning` on purpose** — see V42.

## 🔴 Richard has THREE questions waiting, and none blocks building

Silence is not assent. All owner **NONE** — ask him.

1. **Are the six faces the right six?**
2. **Is 3.32 MB per project acceptable?** ⚠️ Ask it *narrowly*: the **deploy** half is solved (VIB-012
   prunes to 92 KB). What is unanswered is the **per-project** cost.
3. 🆕 **V42 — should a page declare its kind?** The poverty findings cannot block while nothing can tell
   a landing page from a settings page, because README §2 exempts app-chrome from the marketing tells.
   Promotion from pressure to gate needs either a page-kind signal in the graph or a rule that only
   marketing-shaped pages are graded on marketing tells. **This is the ceiling on M3 and it is his call.**

## Gate readings (2026-08-31, session 9) — 🔴 every row is an EXIT STATUS

A crashed `tsc` writes zero `error TS` lines, so a grep over its log reads `0` and is
indistinguishable from a clean pass.

| gate | reading |
|---|---|
| `vib007-m3-measure.look.ts` (real Chrome, both arms) | **exit 0** |
| `tests/vib007PovertyFindings.test.ts` | **exit 0 — 22/22**, every mutation, both accepts arms, six older fixtures |
| poverty + `vib007RenderGate` + `renderReportModule` together | **exit 0** — 75/75 |
| `@nodegx/render-measure` purity | **exit 0** — 5/5 |
| `npm run typecheck:mcp` | **exit 0** |
| `npm run typecheck:editor` | **exit 0** |
| `noodl-editor/tests-unit/bld-014` | **exit 0** — 49/49 |
| full `noodl-mcp` suite | ⚠️ **exit 1 — 82 suites / 1083 tests, 2 failed.** See the caution below |
| `npm run typecheck:backend-tests` | ⚠️ **not run** — OOMs on this box (exit 134). CI `pr.yml:39` covers it |
| `npm run test:ci` | ⚠️ **not run.** Checked, not assumed: `lessondrawncount.ts` gates on `severity === 'error'`, so three new `warning` findings are invisible to it |
| `npm run catalog:examples` / `catalog:merge:check` | ⚠️ **not run** — no corpus, example or port edit |

🔴 **The two red tests are NOT this session's, and that was measured rather than argued.**
`provision.test.ts` + `projectOwnsBackend.test.ts` fail **identically at HEAD (3 failed / 20 passed)**
with this session's five source files swapped back; `projectOwnsBackend` alone passes **12/12** both at
HEAD and with these changes; the failing *set moves between runs*; and neither suite imports anything
changed here. ⚠️ **A peer session was editing this checkout's editor/schema code (P80 DEF-035/036)
throughout** — a plausible holder of the durable backend state these two contend on. The handoff before
this one documented the same pair. **If you see it, run the pair at HEAD before believing it is yours.**

## Standing cautions

- 🔴 **No proxy closes a task.** If you notice yourself grading JSON, stop and render.
- 🔴 **Legible and operable is the floor, not a grade** (Richard, 2026-08-31).
- 🔴 **Never raise a viewport to make content fit.**
- 🔴 **A backtick in a comment inside `measureExpression` ends the template literal.**
- 🔴 **A NEW EXAMPLE OR A NEW PORT OWES `npm run catalog:merge:check`.**
- 🔴 **ASK THE DOOR WHETHER THE KIT ALREADY CAN — and whether the door can SEE the answer.** Both.
- 🔴 **RE-DERIVE A ROW FROM ITS PREDICATE**, description included.
- 🔴 **A change to `DEFAULT_TOKENS`, `STYLE_COMPOSITIONS`, a tool description, what is installed in a
  project, or the example corpus owes the noodl-mcp suite.**
- 🔴 **Rebuild the viewer before a Judge run that depends on a runtime change.**
- 🔴 **`render-from-disk` reads tokens BY REGEX** — a comment between `name:` and `value:` deletes a
  token from every Judge photograph.
- ⚠️ Node ids are unique **project-wide**, not per component.
- ⚠️ Shared checkout: **P80 was active in this tree today.** Commit by pathspec, `git add` untracked
  first, never stash, never `git checkout --` over live work.
