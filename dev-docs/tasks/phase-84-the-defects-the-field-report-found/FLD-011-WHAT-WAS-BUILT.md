# FLD-011 — what was built

**Sessions 7 and 12, 2026-09-10 and 2026-09-11.** Session 7 built two of the task's three scope
items; session 12 built the third — parallelise by tab — and with it AC3 and AC6. Everything below
is a measurement taken on this machine, with the command that produced it. §§2–5 are session 7's;
§§6–9 are session 12's.

## 1. State against the acceptance criteria

| AC | what it asks | state |
|---|---|---|
| AC1 | `out_dir` returns paths, response carries no base64 | ✅ **met** — 8 specs + a reverted arm |
| AC2 | wall time recorded **before and after**, same fixture, same machine | ✅ **met** — 20 projects, three pairs of arms |
| AC3 | console errors attributed correctly **under parallelism** | ✅ **met** — s12, 8-page fixture, **two** reverted arms |
| AC4 | findings identical serial and parallel | ✅ **met** — s12, 20/20 IDENTICAL, both arms run twice |
| AC5 | `out_dir` unset ⇒ behaviour byte-identical to HEAD | ✅ **met** — argv asserted element by element |
| AC6 | the orphan reaper still reaps under the parallel path | ✅ **met** — s12, a real orphan, plus the safety arm |

⚠️ **AC4 has two readings and both are recorded, because the task changed twice.** Session 7 could
only grade *fixed timers vs settle budget* (§3) — there was no parallel path to compare. Session 12
graded the AC as written, *serial vs parallel* (§7). Neither reading replaces the other: the first
says the settle budget did not move the findings, the second says the lane count does not either.

## 2. `out_dir` — AC1, AC5

The CLI half already existed: HLS-007 built `measure-from-disk.js --out-dir`, which writes one image
per page per viewport and stamps the path onto the page row. What was missing was any way for an
agent to ask for it, so `render_report` inlined base64 unconditionally.

- `render.ts` — `outDir` on `RenderOptions`; when set, `--out-dir <dir>` is pushed and
  `--inline-screenshots` is **not**. The two are exclusive *here* although the CLI accepts both:
  writing the files and also inlining them pays exactly the cost the flag exists to avoid.
- `renderTools.ts` — `out_dir`, resolved to an absolute path once so the string handed to the CLI
  and the string handed back to the caller are the same one. The response gains a **manifest**
  naming each page and viewport with its file, read off the report's own rows rather than by listing
  the directory — a listing would also report images a previous run left behind.
- `RenderReportPayload.pages` is now **declared**. It has been in every report since UNI-010 §8.2 and
  was never in the type; the manifest is the first thing here to read it, and a cast would have left
  the next reader believing the field does not exist.

`tests/fld011OutDir.test.ts`, 8 specs. The two that carry the weight:

- **AC5 asserts the whole argv, element by element** — `[projectDir, '--json', '--screenshot',
  'full', '--inline-screenshots', '--scale', '0.4']`. A `toContain` cannot see an **extra** flag, and
  an extra flag is exactly the drift that would make the default path start writing files.
- **AC1's "no base64" is asserted beside a control** that proves the default response *does* carry an
  image block. An absence with no known-firing signal next to it is indistinguishable from a tool
  that never returns pictures at all.

**Reverted arm:** with `render.ts` textually restored to `args.push('--inline-screenshots')`, four
AC1 arms go red and AC5 plus the control stay green. The specs can fail.

## 3. The settle budget — AC2, AC4

`BOOT_MS = 3500`, `REFLOW_MS = 1200`, `PAGE_NAV_MS = 2000` were bare `await wait(ms)`. Nothing
observed the page. They are now **ceilings**: `settleExpression()` runs one `Runtime.evaluate` that
waits for the document to load, the fonts to be ready, no image to be in flight, two animation
frames, finite CSS animations to finish, and then `QUIET_MS = 150` with the DOM not mutating —
whichever comes first, bounded by the old constant.

🔴 **The ceiling is unchanged, so this can never be slower than what it replaces, and at the ceiling
it *is* what it replaces.** `report.settle.atCeiling` counts the settles that ran out of budget:
those waited the full old timer and read what the old code read. Across the corpus it was **0 of 98**.

### AC2 — before and after, same fixtures, same machine

`node dev-docs/tasks/phase-84-.../demo/fld-011-arms.js --corpus`

| fixture | pages | fixed | settled | speedup |
|---|---|---|---|---|
| `templates/members-area` | **11** | 53.8s | **10.3s** | **5.21x** |
| `templates/landing-pages` | 3 | 18.4s | 4.2s | 4.35x |
| 18 single-page lessons | 1 | ~7.4s each | ~2.2s each | ~3.3x |
| **whole corpus** | 32 | **205.1s** | **55.0s** | **3.73x** |

`members-area` is the ten-page fixture AC2 asks for, and it is the one that answers #40 directly:
the reporter measured **37.0s wall for ~5.3s of CPU on ten pages**.

### AC4 — finding stability: 17 identical, 3 explained

**All three differences are the same rule (`flat-type-scale`) on the same viewport (phone), in three
lesson projects.** They are **not** a regression, and the reason is measured, not argued:

`lessons/snacks` shows a **"Feed me." caption about five seconds after boot**, on a timer in the
lesson. Sampling the page every 400ms shows it flip between 4.9s and 6.1s and stay flipped. The old
sleeps reach the phone measurement at 3500 + 1200 + 1200 = **5.9s** — straddling that boundary — and
the settle budget reaches it at **~0.8s**. So the old arm counts 10 visible text elements where the
new one counts 9, and `flat-type-scale` gates at **>= 10**.

🔴 **The control that settles it: the OLD mechanism with the sleeps HALVED reproduces the NEW
arm's reading exactly** — 9 elements and no finding on `snacks` and on `it-gets-demanding/solution`,
12 elements on `snacks/solution` (where the finding still fires, with a different count):

```
full-timers (3500/1200/2000)  snacks  phone textEls=10  flat-type-scale: fires
half-timers (1750/ 600/1000)  snacks  phone textEls= 9  flat-type-scale: ABSENT
```

The finding is therefore a function of **how long you happen to wait**, not of the settle mechanism.
It was manufactured by the specific constants on this machine and would flip on a slower one.
Neither reading is "correct" — a page that changes on a timer has no single true snapshot — but the
old one was accidental, and nobody chose 5.9s to catch a lesson's timer.

⚠️ **What the instrument got wrong first, so nobody re-learns it.** The arms script originally ran
only the *settled* arm twice, controlling the new code against itself. That control cannot see this
case: **both** arms are internally deterministic — fixed sleeps land on the same side of the timer
every run — so the corpus reported `0 old-arm-unstable` and three flat `CHANGED` verdicts. A
self-agreement control detects **nondeterminism**, not **time-dependence**, and only the halved-timer
arm distinguishes them. Both arms are now run twice; the halved-timer control is the one that
actually answered the question.

⚠️ And the first diagnosis was wrong: a CSS fade-in was assumed, and a wait for finite
`document.getAnimations()` was added on that assumption. It did not move the result — sampling
showed the element stable at `opacity: 0` for 1.5s, not mid-transition. **The animation wait was
kept** because it is correct for real transitions and costs nothing when there are none, but it is
**not** what fixed this and nothing here is evidence that it works.

## 4. 🔴 The MCP tool surface is full — this is bigger than FLD-011

Adding one optional parameter to `render_report` **broke `toolDisclosure`'s budget gate**: 8374
tokens against a budget of **8280**. Measured at HEAD by removing the parameter again, the resident
surface has **7 tokens of headroom**, and the gate's own comment records that the budget has been
renegotiated twice and *"there should not be a third."*

`out_dir` was paid for, not waived:

- its `describe` is one short sentence, and the "READ the ones you need" doctrine lives in the
  **response manifest** instead — charged only to a caller who asked for files, not to every turn;
- `render_report`'s per-viewport enumeration is reduced to its gist, which is AWP-006's own stated
  principle applied to the clause it left standing (the response names every rule it ran, in full);
- **`Takes ~8s` was corrected to `~2s a page`** — this task made the old figure wrong by 4x, and it
  is the number an agent budgets by.

Net: **8275 tokens, 5 under.** Headroom went from 7 to 5.

🔴 **FLD-014 cannot be built against this budget.** Its scope is *"accept snake-case aliases for the
98 camelCase inputs in `backendTools.ts`"* — that **adds** to the resident surface. At 5 tokens of
headroom it does not fit, and the gate is a real one. This needs a ruling or a `$ref` fix (which the
gate's own comment names as the honest answer) **before** FLD-014 is started. Register row added.

## 5. Gates

- `packages/noodl-mcp` — **2 suites / 3 tests red, and they are NOT ours.** `def018-def020-layout-drive`
  and `sbr009ThemeEditorDrive`. ⚠️ Session 6's argument for these being pre-existing was *"they use
  `withRenderedPage` but never `measureExpression`"* — **that argument does not cover this task**,
  which changed `withRenderedPage` itself. Re-proved with a control: `git show HEAD:` over
  `render-report.js`, those two suites re-run, **identical 3 failed / 15 passed**, snapshot `cp`ed
  back and md5-verified both ways. Never `git stash` here.
- `npx lerna run test --scope @nodegx/render-measure` — 2 suites / 13 tests, exit 0.
- `npm run test:main` — see the session note.

## 6. Parallelise by tab — what was built (session 12)

`withRenderedPage` grew two calls, `openTab(label)` and `closeTab(tab)`, and the per-tab plumbing it
already had for one tab was extracted into `attachTab` so the primary tab and every helper are built
by the **same** function. One Chrome, one server, N tabs — `PAGE_TABS = 4`, overridable per call as
`concurrency` and on the CLI as `--concurrency`.

🔴 **`concurrency: 1` is the serial sweep navigation for navigation**, which is what makes every
number below an arm of the same build against itself rather than a build against a `git show HEAD:`
copy. The report says which it did: `sweep: { pages, tabs }`, absent when there was nothing to sweep.

- **AC3 — attribution.** `attachTab` gives each tab its **own** `consoleErrors` array. The old shape
  was one array sliced by index around each measurement, which is a claim that nothing else appended
  in between: true of a serial loop, false the moment two pages are live, and **silent** when false.
- **AC6 — the reaper is untouched, because tabs are not processes.** `reapOrphanedRenderProcesses`
  still runs at the start of every drive and still only kills `ppid === 1`.
- ⚠️ **No MCP tool parameter was added.** `toolDisclosure` has **5 tokens** of headroom (P25), so the
  lane count is a default and not a question an agent is asked. The win arrives without being priced.

## 7. 🔴 Three things the drive said that reading the code could not

**(a) In one headless Chrome, opening a second tab BACKGROUNDS the first, and a backgrounded page
does not render.** The very first parallel arm came back **slower and wrong**: `templates/landing-pages`
took 10.1s against 4.2s serial, and `/Pages/Business` — measured on the primary tab while a helper
tab booted — reported **two `blank-render` findings**, its navigation settle taking **2,953ms** and
both viewport settles running out of budget (`quiet: false`) against **308ms and a clean read** on the
same page in the same build with one lane. `requestAnimationFrame` is not serviced for a hidden tab,
so the viewer never finished mounting and the settle correctly reported a page that never settled.

✅ Fixed by `Emulation.setFocusEmulationEnabled` plus `Page.setWebLifecycleState` on **every** tab
including the primary, sent when the first helper is opened. That is the same call
[[cdp-keys-need-focus-emulation-on-the-same-connection]] records for keyboard input, for the same
reason, and with the same constraint: **per session**, so it goes on the connection that measures.
After it: 18 findings against 18, and 3.57s against 3.82s.

**(b) A fresh tab's first navigation is a document load, so it needs the BOOT ceiling.** Handing it
`PAGE_NAV_MS` budgets a whole viewer boot against a hash change; the settle then runs out of budget
rather than observing quiescence, and the page is measured mid-boot. The ceiling is a parameter of
`goto` for exactly this reason, and lane 0 — the already-booted primary — is never "first".

**(c) 🔴 The report was dropping every console error a page logged while LOADING, and the fixture is
what found it.** `loggedBefore` was read **after** the navigation, so the window a page's errors were
attributed by began after the errors had already arrived. Both shouting pages came back **silent**,
and so did every boot error on every start page — `console-error` is the one rule whose entire
evidence is that array. The window now opens **before** the navigation (and at **0** on the start
page, which is what the comment there already claimed) and **closes at each read**, so the windows
are disjoint: nothing is dropped and nothing is counted twice.

⚠️ **This is a hole shaped like the rule that hides it, and it was invisible from both the report and
the code.** The only reason it surfaced is that AC3's fixture has a known-firing signal in it — see
[[assert-an-absence-with-a-known-firing-signal-beside-it]]. Without the "heard both pages shout"
control, four assertions about *which page* an error landed on would all have passed on a report that
contained no errors at all.

### What (c) costs: 13 findings the corpus had been hiding

| project | findings before | after | what appeared |
|---|---|---|---|
| `templates/members-area` | 61 | **71** | a `console-error` on the start page and on **nine** of its ten routed pages |
| `templates/landing-pages` | 18 | **20** | the start page and `/Pages/Business` |
| `lessons/log-a-thing/solution` | 5 | **6** | the start page |

The errors themselves, read off a real drive of `members-area` — three classes, and only one of them
is noise this task created:

- **×11 rows: three `starter-imagery` images that 404.** `people-cafe.webp`, `people-market.webp`,
  `work-potter.webp`, referenced by `/Members/InsideTile`. A **real defect in a shipped template**,
  already reported by the `broken-image` rule and apparently never acted on.
- **×6 rows: `CloudFunction2 (/Members/Standing): No cloud services defined in this project.`**
- **×8 rows: `TypeError: Cannot read properties of undefined (reading 'results')`** inside the
  runtime — `ParseWireAdapter.query`'s success path (`:359`; `distinct` has the same shape at `:454`)
  reading `response.results` on a response that has none.

⚠️ **The last two are a property of rendering a cloud project with NO backend**, which is how
`render_report` renders. 🔴 **It is NOT established that a deployed app can reach them** — the
harness's own `/__backend` proxy, with no upstream, may be the only producer, and saying otherwise
would be [[a-client-property-read-as-a-fact-about-the-source]]. Registered, not chased.

🔴 **The decision this forces, stated rather than made quietly:** the fix is correct — a report that
silently drops the errors its own rule exists to report is broken — but it makes `render_report`
noisier on exactly one shape of project, one that FLD-012 spent a session making quieter. Shipped as
the correctness fix, with the noise named: **a project with cloud services rendered without a
backend now earns a `console-error` per page.** Suppressing it needs its own task and a ruling on
what "rendered without a backend" ought to report; inventing one at the end of a session is how a
real signal gets lost.

## 8. AC2 and AC4 — serial vs parallel, both arms run twice, 20 projects

`node dev-docs/tasks/phase-84-.../demo/fld-011-arms.js --tabs --corpus`

| fixture | pages | serial | parallel | speedup | findings |
|---|---|---|---|---|---|
| `templates/members-area` | **11** | 9,330ms | **6,127ms** | **1.52x** | 71, IDENTICAL |
| `templates/landing-pages` | 3 | 3,534ms | 3,480ms | 1.02x | 20, IDENTICAL |
| 18 single-page lessons | 1 | ~1,760ms | ~1,765ms | **1.00x** | IDENTICAL |
| **whole corpus** | 32 | **44.6s** | **41.4s** | 1.08x | **20/20 IDENTICAL** |

**0 CHANGED, 0 parallel-unstable, 0 serial-unstable.** Both arms self-agree on all twenty before
they are compared to each other, which is the control §3 explains at length and needs more here, not
less: a lane count changes *when* each page is read as well as how fast.

Measured twice, an hour apart and across the attribution fix: **1.53x then 1.52x** on `members-area`.

🔴 **And the honest reading of that table: tabs buy 1.5x on the one many-page project in the corpus
and nothing at all on the other nineteen.** Eighteen have no routed pages to sweep, so `sweep` is
absent and the two arms are the same code — which is the control that the default changes nothing
where there is nothing to change. The fixed cost of a drive (~1.76s of server spawn, Chrome spawn and
port polling) is what a single-page project is made of, and no number of tabs touches it.

⚠️ **Session 7 predicted this and it was right**: *"the settle budget has removed most of what
parallelism was going to buy… the case for tabs is now strongest on many-page projects, and weaker
elsewhere than the task file assumed."* The end-to-end number for #40's own fixture is what makes it
worth having anyway: **53.8s → 10.3s → 6.13s, 8.8x**, for eleven pages.

Lane counts measured on `members-area` before 4 was chosen: **1 → 9.53s, 2 → 6.65s, 4 → 6.20s,
6 → 6.77s.** Six is *slower* than four. The report is byte-identical at all four lane counts once the
clock fields and the ephemeral server port are removed — **92,793 bytes, one md5 across all of them**.

## 9. Gates, and the two instruments that lied on the way

- `packages/noodl-mcp` — `tests/fld011ParallelTabs.test.ts` **11 tests**, `tests/fld011OutDir.test.ts`
  8, exit 0. Two reverted arms in the new file, one per half of the fix.
- The rest of the suite, `tsc --noEmit`, and the pre-existing proof: see the session note.

⚠️ **`execFile` resolves when the child's STDIO CLOSES, not when it exits.** AC6's orphan is made by
`sh -c 'node … & echo $!'`, and the backgrounded sleeper inherits `sh`'s stdout — so without
`>/dev/null 2>&1` on it the helper waits out the entire sleep. The suite sat at 0% CPU for five
minutes and looked exactly like a hung drive.

⚠️ **An assertion written from the shape of the loop instead of from the fixture.** The first version
of *"counted each shout"* expected one error **per viewport**, because two viewports are measured —
but the page loads once, so the error is logged once. It failed, and the assertion was what was
wrong. It now asserts **exactly once, in the window that holds the navigation**, which is the half of
the fix the "landed on the right page" assertions cannot see.

## 10. What is still owed on this task

**Nothing.** All six ACs are met and the task is 🟢. Two things it leaves for somebody else, both
registered:

- 🔴 the three 404ing `starter-imagery` images in `templates/members-area`, which are a real defect
  in a shipped template;
- 🔴 what `render_report` should say about a cloud project rendered with no backend, which is now a
  `console-error` per page and was silence before.
