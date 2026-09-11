# FIX-024 — the launcher opens on the Learning section, not on your projects

**Filed:** 2026-08-17, from Richard, using the app.

> *"I think you should see your projects first when you open the launcher, not the learning bit
> which takes up the whole top of the launcher when you open it. Put that into its own tab in the
> launcher please."*

Not a phase-67 item despite arriving in a phase-67 session: UNI-007 put the section there, but the
complaint is about the **launcher's opening screen**, which is this phase's territory — the same
shape as every other row here, a built mechanism the user meets at the wrong moment.

## What was actually there

🔴 **The tab affordance already existed and did not need building.** `LauncherHeader` renders
`HEADER_TABS` — Projects / Templates / GitHub — with an accent underline, `aria-current`, a
`data-test` hook per tab, a persisted active tab (`usePersistentTab` → localStorage) and a deep-link
parser. So this was one entry in a table plus a view, not "tabs in the launcher" arriving early.

⚠️ **Phase 37 (project tabs) is still scoped and unbuilt, and this does not touch it.** That phase
is about tabs *inside a project*; this is the launcher's own header nav, which shipped with PAR-001.

## The trap in the naming — the only part of this worth reading twice

There were already **two** things called learning, and they are not the same feature:

| id | component | what it is |
|---|---|---|
| `'learn'` | `views/LearningCenter` | POL-002's **retired** catalogue of hosted lessons. The content predates every project-format change since LEARN-001, so the lessons no longer play. Deliberately kept compiled, reachable from nothing |
| `'learning'` | `components/LearningSection` | UNI-007 / D5's **installed** lessons — the ones on this machine, with their own progress, score and feedback. This is the live feature and the new tab |

🔴 **Reusing `'learn'` for the new tab would have put the dead catalogue behind it.** The two ids are
one letter apart and `usePersistentTab.isValidPageId` is the single place a *stored string* decides
which page you land on — it rejects `'learn'` (so anyone whose last pre-POL-002 session ended there
lands on the default) and must accept `'learning'`. Both directions are asserted in the spec,
because a spec that only checked `'learning'` is accepted would pass just as happily with `'learn'`
accepted too.

## What was built

- `views/Learning.tsx` + `.module.scss` — the tab. It draws **no page title**: `LearningSection`
  already owns its heading, lesson count and *Install a lesson…* button, and a `LauncherPage` title
  above it would print "Learning" twice. Padding matches `LauncherPage`'s so it sits on the same
  margins as Projects and Templates.
- `LauncherHeader` — `{ id: 'learning', label: 'Learning' }`, second, right after Projects.
- `Launcher.tsx` — `case 'learning'`, and `parseDeepLink` accepts it. `case 'learn'` untouched.
- `LauncherContext` — `'learning'` added to `LauncherPageId`, with the table above as a comment.
- `views/Projects.tsx` — the section removed, along with the four context fields only it used.
- `usePersistentTab` — `isValidPageId` accepts `'learning'`, still rejects `'learn'`, and is now
  **exported** (noodl-core-ui has no test runner; same convention as `shouldWriteDeepLinkUrl`).
- `Launcher.stories.tsx` — `LearningTab` and `LearningTabEmpty`; `LearnTab` kept and labelled as the
  retired catalogue.

**D5 is not weakened.** Its ruling chose the *visible* option because visible progress motivates,
and a permanent header tab is visible. What it does not survive is being the launcher's opening
screen, which is what Richard hit.

## Acceptance — driven 2026-08-17, dev stack, CDP

The observation was written before the drive, because *"the component moved"* and *"you see your
projects first"* are different claims.

1. ✅ **The consequence.** With the launcher on Projects, the first heading in the content area is
   `H1: Recent projects` at **y=81**, immediately under the 52px header, and
   `elementFromPoint(centre, headerBottom+40)` lands on `LauncherPage HeadRow`. Project cards are on
   screen without scrolling.
2. ✅ **The absence is real, not a dead selector.** `[data-test=launcher-learning-section]` is
   **absent** on Projects and **present** on the Learning tab — the same selector firing on the
   other tab is what makes the absence evidence rather than a typo.
3. ✅ **The tab.** Header renders four tabs — Projects / Learning / Templates / GitHub — with
   `aria-current="page"` following the click.
4. ✅ **The section works there.** Clicking Learning renders the section at the top of the page with
   its heading, `1 lesson`, the install button and the real installed lesson (*State on a page*,
   33%, from disk); *Recent projects* is gone.
5. ✅ **It persists.** localStorage holds `learning` and a full reload comes back on the Learning
   tab — the `isValidPageId` path in the real app, not just in the spec.

## Gates

- `test:main` — `tests-unit/launcher/persistent-tab.test.ts`, **3 specs, pass**.
  ✅ **Control run, proved to bite:** with `isValidPageId` also accepting `'learn'`, **1 of 3 fails**
  on exactly the assertion that names it. Reverted.
- `tsc --noEmit -p tsconfig.tests-main` — **31 errors, the same pre-existing count**, none in these
  files.
- eslint clean on the editor spec. ⚠️ **noodl-core-ui cannot be linted at all** — its
  `eslintConfig` extends `react-app`, which is not installed; every file in the package fails the
  same way, confirmed against an untouched control file (`views/Templates.tsx`). Pre-existing, and
  worth its own row somewhere.

## Left undone, deliberately

⚠️ **`LearningSection`'s heading is 15px**, sized as a subsection beside the project grid. As a
page's only heading it is smaller than the 24px "Recent projects" it now sits parallel to. Moving
the section was the ask; resizing its type is a design change, so it is flagged rather than taken.
