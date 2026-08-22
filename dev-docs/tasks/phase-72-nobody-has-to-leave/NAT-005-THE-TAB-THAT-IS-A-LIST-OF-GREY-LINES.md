# NAT-005 — The tab that is a list of grey lines

| Field | Value |
|---|---|
| **Tier** | 1 |
| **Effort** | M |
| **Surface** | `core-ui`, `editor` |
| **Rulings** | ✅ D1 · inherits **P67 D15** and **D21** |
| **Depends on** | **NAT-002**, **NAT-003** (it renders on the fixed palette). Precedes the Tier-3 surfaces, which copy its shapes |

> 🔴 **Revised 2026-08-22 by FB-006 / D6 — the page, not the vocabulary.** The three stacked
> sections are now four tabs (**Bench · Tutorials · Replays · People**), one on screen at a time,
> because Richard asked for the web's structure: *"not everything on one page in a big list that
> will one day be unmanageable"*. Everything this task built — the card, the row, the four states,
> the required per-section empty line, the health readout — is reused unchanged, and
> `tests-unit/nat-005/launcher-community-render.test.ts` now names the tab each assertion stands
> in. ⚠️ AC4 (Storybook) is untouched and still open.

## The job

Fix the tokens and the launcher Community tab is still three headings and some rows. Read
[`Community.tsx`](../../../packages/noodl-core-ui/src/preview/launcher/Launcher/views/Community.tsx):
every visual decision is an inline `style` object, there are exactly two of them (`shy` and
`rowStyle`), the whole page is one column of 13px text, and the only structure is `marginBottom: 28`.

There is nothing wrong with it that a designer would call a bug and nothing about it that invites
you in. It reads as a status readout because that is literally what it is.

Give it the shape of a place: real hierarchy, cards that sit on the ground NAT-003 built, rows that
show *who* and *when* and not only a title, and a first screen that says what this is for.

⚠️ **This task is the pattern the Tier-3 surfaces are built from.** People, jobs, coaching and
University all need the same list/row/empty/error vocabulary. Build it once here, as components, or
four tasks will each invent it.

## Acceptance criteria

1. The four section states — `loading`, `items`, `empty`, `unreachable` — are all still distinct
   and all still reachable, and each is **rendered and looked at**. 🔴 UNI-011 paid for `loading`
   being its own case (an empty list for 300ms tells every user on every open that the community is
   dead); a redesign that collapses them re-buys that bug.
2. Rows carry the metadata the API already returns and the current UI throws away — `createdAt`,
   `firstReplyMinutes` on threads, `summary` and `kind` on articles, `heldOn` and `description` on
   replays. All of it is in the view model today and none of it is drawn.
3. `emptyLine` stays **required and per-section**, saying what the section is *for*. No shared
   default. The four honest empty states do not become one shrug.
4. The reusable pieces are extracted as core-ui components with stories, not left as inline styles.
   Storybook renders them with no editor present — the tab must still degrade to "not available in
   this preview" when `communityMirror` is absent.
5. **D15 is intact:** `surface: 'hidden'` draws **nothing** — not a heading, not a frame, not a
   skeleton. Asserted with a **not-hidden control beside it**, because an assertion that nothing
   was drawn passes just as well when the component never ran.
6. Every pair the new layout introduces is added to NAT-001's PAIRS table. A redesign that
   introduces a new grey without a row is the same bug in a nicer shape.
7. No `dangerouslySetInnerHTML`, anywhere. This file renders **text children only** — the launcher
   is `pages/ProjectsPage` inside the same `nodeIntegration: true` window as the editor.

## Traps

- 🔴 **`Community.tsx` lives in core-ui and is imported by the editor's rail panel too.** That path
  looks wrong and is deliberate: core-ui cannot import the editor, so the renderer owns the type.
  Two view models would be the defect. Anything extracted here must serve **both** surfaces.
- 🔴 **The health readout is a *readout*, not a gate** (D21 reversed D16 on 2026-08-19). Nothing may
  branch on it. It carries its `required` and its `n` because *"a median over three staff-answered
  threads is a true statement about nothing"* — a redesign that drops `n` to make the number look
  tidy deletes the only thing making it honest.
- ⚠️ **`BaseDialog` renders every dialog twice** — any spec that counts rendered nodes in this area
  must filter `:not([class*=MeasuringContainer])` or it double-counts.
- ⚠️ Do not add a "0 of 20 threads" progress bar. The threshold stopped being a gate; drawing it as
  one puts it back.

---

## Status — 2026-08-19 (session 7)

**Six of seven acceptance criteria are closed. AC4 is half-closed and the blocker is not this
task's code.** The shared vocabulary exists, both surfaces draw from it, and the metadata the view
model has carried since the first commit is on the screen.

| AC | State | Where |
|---|---|---|
| 1 — four states distinct, reachable, **looked at** | ✅ | `nat-005/launcher-community-render.test.ts` + screenshots of all four in both themes at both densities |
| 2 — rows carry `createdAt`, `firstReplyMinutes`, `summary`, `kind`, `heldOn`, `description` | ✅ | `communityMeta.ts`, drawn by both surfaces, asserted by name |
| 3 — `emptyLine` required and per-section | ✅ | three empties assert as three *different* sentences, plus a source check for a default |
| 4 — extracted as core-ui components **with stories** | 🟡 | components + `Community.stories.tsx` written. 🔴 **Storybook cannot start in this repo and could not before this task** — see below |
| 5 — D15 draws nothing, with a not-hidden control | ✅ | both arms out of one call to one component |
| 6 — every new pairing in NAT-001's PAIRS table | ✅ | 12 rows added, **5 rows corrected**, 2 claims moved to the elevation test |
| 7 — no `dangerouslySetInnerHTML` | ✅ | five files, comments stripped, verified red |

Gates, re-measured on the committed tree: `typecheck:editor` and `typecheck:editor-tests` clean ·
`test:main` **263 suites / 4210 tests / 0 failures** · core-ui jest **28 suites / 521 tests /
0 failures**. New here: **28** tests in `tests-unit/nat-005/` and **23** in
`packages/noodl-core-ui/tests/nat-005/`.

### What was built

`@noodl-core-ui/components/community` — `CommunityRow`, `CommunitySectionBody`,
`CommunitySection`, `communityMeta.ts`, one stylesheet in two densities (`Page` for the launcher's
card-on-canvas, `Panel` for the rail). 🔴 **The vocabulary is the deliverable.** The four Tier-3
surfaces need exactly this list/row/empty/error and now import it rather than inventing it.

⚠️ **The rail panel's rows lost their leading icon**, deliberately. `common/Icon` uses webpack's
`require.context`, so anything importing it **cannot be loaded by this repo's jest at all** — a
shared row with an icon in it is a shared row no runner can grade, and grading it is how AC5 gets
its control. The section headings already say which list a row is in.

### 🔴 The finding worth carrying: this runner CAN grade a React component

The standing assumption in `tests-unit/` is that jest here has no DOM, therefore components are
ungradeable, therefore **source analysis** — read the `.tsx` as text and match strings. That is
what `uni-011/launcher-community-tab.test.ts` does, and it is blind to a rename and cannot tell a
component that drew nothing from one that was never called — which is precisely AC5's question.

A React **element** is a plain object and a hook-free component is a plain function from props to
elements. `tests-unit/support/renderElements.ts` walks one. No DOM, no `react-dom`, no jsdom.
✅ **This is the instrument NAT-007..011 should reach for**, and the cost of it is one design
constraint worth paying: keep the surface's pure half separate from the half that reads context
(`CommunityTab` vs `Community`), because a hook throws under it.

⚠️ What it cannot see: effects, layout, paint, legibility. A green run here does not close a
looking-shaped question.

### 🔴 The PAIRS table rejected two rows, and it was right

NAT-005 moves most of the launcher tab **up a ground** — the sections are cards on `bg-1` now, not
a flat column on `bg-0`. So five existing rows were asserting a ground nothing paints any more,
with foregrounds so familiar that appending new rows would have looked like the diligent move.
✅ **The trigger for editing a row is the same as for adding one: a new pairing.**

Two card-boundary claims were then added at `min: 1.09` and `every row names a bar it stated on
purpose` went red: that table grades **words at 4.5 and shapes at 3**, and an elevation step is
neither. A third bar would have loosened the guard for every future row. They moved to the
elevation ramp test, where the measurement that chose the token also lives:

🔴 **`border-subtle` on `bg-0` is 1.29 dark but 1.03 light.** A card that relies on it has no edge
at all in light — less of a line than the fill step beside it. The card uses `border-default`
(1.46 / 1.12) *and* the `bg-1` fill (1.16 / 1.13); the fill is the larger half in light.

### ⚠️ AC4: Storybook has not run in this repo for some time, in at least four ways

`npm run start:storybook` fails before serving anything. Found and **fixed** three:

1. `.storybook/main.ts` rebuilt `__dirname` from `import.meta.url`, which makes esbuild-register
   emit an ES module that Node's CJS loader then refuses. `__dirname` was already defined.
2. `.storybook/manager.ts` imported `@storybook/addons`, gone since Storybook 7.
3. The `*.stories.mdx` glob pointed at three MDX1 design-token files Storybook 8 cannot parse.

🔴 **The fourth is unfixed and I did not narrow it.** All 99 `.stories.tsx` fail with
`Module parse failed: Unexpected token (1:12)` at their first `import type`, having passed through
only the csf and export-order loaders — the framework's TypeScript rule is not reaching them. A
`webpackFinal` helper that *replaced* an absent `include` rather than widening it looked like the
answer and was fixed; it is a real defect and **it was not the cause**. The comment in that file
says so, in both halves.

⚠️ **The cost of this is bigger than one AC.** 99 stories exist in this package and none of them
could be opened — which is how the Community tab spent a whole phase as two inline style objects
without anyone seeing it outside the running app. **A story nobody can render is a story nobody
wrote**, and Tier 3 is about to write four surfaces' worth.

**What was looked at instead**: a purpose-built esbuild harness rendering the *real* components
against the *real* compiled stylesheets and token files, screenshotted headlessly in both themes —
all four states, both densities, plus the `hidden` case drawing literally nothing beside the others
as its control. That answers AC1. It does not answer AC4's actual claim, which is that these
components render *with no editor present in a tool a designer opens*, and that stays open.

### Verified red — 6 of 6, and the harness lied once

Every assertion above was handed its defect back: D15 drawing a heading, the loading pulse removed,
`emptyLine` given a default, thread metadata dropped, the row returned to a `div`, and a
`dangerouslySetInnerHTML` added. **All six fired, by name.**

🔴 **The fifth read as GREEN on the first pass and the spec was fine — my verification harness was
not.** It counted failures by regexing `Tests: N failed` out of jest's output; a mutation that left
the file unparseable makes the *suite fail to run*, that line never appears, and the harness
reported **zero failures** — which is the same output as *"the spec passed the defect"*. ✅ **A
red-verification harness needs its own control: an unparseable file and a clean pass must not
render identically.** Re-run as valid code, it failed by name.

🔴 **And AC7 went red the first time on a comment** — the sentence *"No `dangerouslySetInnerHTML`,
ever"* in the module note of a file that does not use it. Comments are stripped now
(`stripComments`, shared). The same hole in the other direction is the dangerous one: a file that
both uses the construct and documents the prohibition reads identically to a checker that cannot
tell prose from code, and the prose is what makes it look reviewed.
