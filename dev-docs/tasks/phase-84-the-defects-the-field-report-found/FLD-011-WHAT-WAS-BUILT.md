# FLD-011 — what was built

**Session 7, 2026-09-10.** Two of the task's three scope items are built and measured. The third —
parallelising by tab — is **not built**, and with it AC3 and AC6 are **not met**. Everything below
is a measurement taken on this machine today, with the command that produced it.

## 1. State against the acceptance criteria

| AC | what it asks | state |
|---|---|---|
| AC1 | `out_dir` returns paths, response carries no base64 | ✅ **met** — 8 specs + a reverted arm |
| AC2 | wall time recorded **before and after**, same fixture, same machine | ✅ **met** — 20 projects, both arms |
| AC3 | console errors attributed correctly **under parallelism** | ⬜ **not met** — no parallel path exists |
| AC4 | findings identical serial and parallel | ⚠️ **re-read as fixed-vs-settled** — 17/20 identical, 3 differ and are explained below |
| AC5 | `out_dir` unset ⇒ behaviour byte-identical to HEAD | ✅ **met** — argv asserted element by element |
| AC6 | the orphan reaper still reaps under the parallel path | ⬜ **not met** — no parallel path exists |

🔴 **AC4 is answered about the change that was actually made.** The AC is written against
*serial vs parallel*; there is no parallel path, so it is graded as *fixed timers vs settle budget*,
which is the substitution the settle work actually needs. It is not the AC as written, and the
parallel version of it is still owed.

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

## 6. What is still owed on this task

- **Parallelise by tab** (`Target.createTarget`, a per-tab client, a **per-tab console buffer**),
  with AC3 and AC6 against it. AC3 is the arm that matters: `page.consoleErrors` is one shared array
  attributed by index slicing, and interleaving would misattribute every console error.
- 🔴 **Do not parallelise by process.** Each `withRenderedPage` is a Chrome plus a server at ~260MB.
- ⚠️ The settle budget has removed most of what parallelism was going to buy on small projects — the
  corpus is now 55s where it was 205s. The case for tabs is now strongest on **many-page** projects
  (`members-area` at 10.3s), and weaker elsewhere than the task file assumed.
