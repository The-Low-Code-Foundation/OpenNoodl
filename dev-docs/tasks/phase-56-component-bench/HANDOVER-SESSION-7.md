# Phase 56 — handover after session 7 (2026-08-09)

**What ran:** **BEN-007**, the acceptance pass the phase closes on. Twelve of its thirteen criteria
were driven on a live editor and every one of them has a number or a screenshot behind it. The
thirteenth — §C, the disorientation test — is **a human gate and is not mine to close**; the two
cropped screenshots it needs are committed and the measured half of R2 is recorded.

**Phase 56 is complete: BEN-001…007, 7 of 7.** No source file changed this session. What changed is
the register: **B3 and B8 are closed with measurements**, **B1 and B16 are updated**, and five new
rows (**B28–B32**) carry what the drive found — including two things that happened **once each** and
that two hypotheses apiece failed to reproduce.

Read [HANDOVER-SESSION-6.md](HANDOVER-SESSION-6.md) and
[HANDOVER-SESSION-5.md](HANDOVER-SESSION-5.md) first. B10 and B24 governed every click here and both
held; B18 governed the gate.

✅ **No second session was live.** `git log --since="6 hours ago"` held only session 5's and session
6's commits at the start and before the commit, and every file in `git status` was this session's.
**Check again next session rather than inheriting this.**

## What is on the branch

| Commit | What |
|---|---|
| (this one) | **BEN-007 driven** — register B1/B3/B8/B16 updated, B28–B32 added, two §C screenshots, TASKS/README status, this file. **No source change** |

## The run, criterion by criterion

Fixture: *Puppy test 3* — `/Components/PuppyCard`, `/Components/BenchProbe` (session 5's three
scenarios and its unwired `Ghost` port), `/Components/BenchEmitter`, `/Pages/Landing`.

### A — the human path

| # | Criterion | Evidence |
|---|---|---|
| 1 | Open a card from the panel via right-click → **Preview in isolation** | `data-preview-mode` `app` → `bench`, `[data-test=component-bench]` present, **2** webviews. Screenshot: `PuppyCard — isolated component, not the app`, `768 × 150`, `5 inputs, 0 outputs` |
| 2 | Type three input values | `Title` → `.ndl-visual-text[0]` reads **`Adoption day`**; `Align` → `textAlign: center`; `Accent` → `color: rgb(59, 130, 246)` — all read out of the **sandbox document**, not the rail |
| 2 | …and the preview did not reload | marker `mk-5ojmgu` **and** a planted `#ben007-marker` node survived all three, and every frame change after them |
| 3 | Fire an input signal; click something in the component | `Send Bump` → read-out `Count — → 1`, component DOM `1`. Clicking **Press me** *inside* the bench → **`+18s Pressed`** in the signals log and `Count 2`. **B12 is live at last** — the two-update signal fires and rearms |
| 4 | Frame 320, and stretch both ways | 320 → document **320**, first text **288**. Stretch on → read-out `744 × 150 · stretched`, document **744**, text **712**. Off → **320**/288 again. **B28**, and it closes B3 and B8 |
| 5 | Save two scenarios and switch between them | `Blue centred` (320) and `Plain wide` (768) are in `component.json`'s bytes with `"Accent": "var(--blue-500)"`. Switching renders each — `Adoption day` @320 centred blue, `Plain and wide` @768 |
| 5 | …and no reload | bench marker **and** app marker both survive both switches, and the counter keeps the value it had. ⚠️ True *because* nothing had to be cleared: `applyValueSet` remounts only when a name being dropped has no derived default (B21), so B21's case still reloads on purpose |
| 6 | Switch back to **App** — route and typed form state | app at `#/admin-login` holding `r3-0`/`r3-1` and a JS marker; app → bench → app; **all three intact**. Reproduced twice, once with no reads in between. The *bench* is unmounted on the way back (webviews 2 → 1) and the app never is — **B7's asymmetry, confirmed as designed** |

⚠️ **One earlier round trip lost the marker and the typed values** — `navigation` type `reload`,
`timeOrigin` two seconds after the pre-switch screenshot. **B29**, unattributed: two hypotheses were
tested and refuted. Note what it means for the criterion — *the route is in the URL and survives a
reload*, so "does not lose the route" would have read green while the page state was gone. The
marker is the only thing that caught it.

### B — the AI path

Both closed, on a clean editor, with every string read out of the sandbox webview's DOM.

| # | Criterion | Evidence |
|---|---|---|
| 7 | Change a name, set the row count to 1, Apply | a **60-character** name typed into the `name` cell reads back **verbatim** in the render; texts 24 → **16**, exactly **one** card, toolbar `Sample data — 1 Puppy (yours)` |
| 8 | Fill a class flagged **Fields unknown** by hand | 3 rows typed as JSON → `Biscuit / Marlow / Pip` with breed, age and description, page chrome intact, **20 literal `Text` → 0** |

⚠️ **B26 reproduced verbatim** before the fill: 32 rendered texts, **20** of them the literal word
`Text`. It is still AIX-008's to fix and BEN-006 is still what makes it survivable.

⚠️ **B30 — one Apply in four came back broken** and every later Apply then moved the toolbar and not
the render, while still reloading the window. Unreproduced; two hypotheses refuted.

### C — the disorientation test

**Not closed. It needs a human who did not build this**, and that is the point of it.

What is done: `screenshots/ben007-app-mode.png` and `screenshots/ben007-bench-mode.png`, both cropped
to the preview surface with the window chrome removed, ready to show to someone.

What is measured (**B32**): in app mode the app webview **is** the surface — `916 × 518`, flush on
all four sides. In bench mode the component is `768 × 150` inset in that same `916 × 518` dark stage.
⚠️ At the **default** frame the horizontal inset is 16px and the frame runs to the inputs rail, so
what reads as "inset" is mostly the vertical letterboxing; at Small (320) it is unmistakable. If the
human half fails, that is the first thing to look at.

### D — regressions

| # | Criterion | Evidence |
|---|---|---|
| 11 | The AI preview is unchanged for a build touching none of the new controls | summary `Sample data — 1 Puppy (yours), signed in as a sample user` ⇄ `… signed out`, toggle label flips `Sign out` ⇄ `Sign in`, and the user's own records survive the toggle's reload |
| 12 | A node property still updates the app preview live | `setParameter` on `/Pages/Landing`'s hero title → `Find Your New Best Friend — BEN-007` in the app preview's DOM, marker intact. **BEN-002's targeted `modelUpdate` did not break the broadcast path** |
| 13 | Design tokens resolve in all three surfaces | identical token values in all three (`--surface #fafafa`, `--foreground #18181b`, `--blue-500 #3b82f6`), computing to `rgb(250,250,250)` / `rgb(24,24,27)` / `rgb(59,130,246)`; **90** elements use `var()` in the app preview |

⚠️ **12 cost three commands to a trap that is now in B16**: the read is **one edit behind** until a
frame is forced. `model = Third value`, `DOM = the previous one`. It reads exactly like "the revert
did not work".

## ⚠️ Traps, for whoever drives next

- **B10 held, twice, in two different components.** The context menu rendered *"Preview in
  isolation"* **twice** and only the second one's handler fires; the core-ui `Select` returned **6**
  option nodes for a 3-option enum and **166** for the colour picker. Click the last copy.
- **`.click()` does not open a core-ui `Select`.** Two empty `OptionsContainer`s is what that looks
  like — the same "the select will not open" symptom B10 records. `npm run cdp -- click` (a real
  trusted click) opens it; then drive the options with `element.click()`.
- **`cdp click` reported the *same* coordinates for two different rows** of the inputs rail
  (`1233,349` for both the Align select and the Accent picker). Both happened to open the right
  control, but that is B24's race showing up again and it is not to be trusted — measure and click in
  one `eval`.
- **A backgrounded `npm run test:ci` behind a shell `&` dies with the shell.** The log stopped at 723
  spec-starts with no `Jasmine:` line, which is indistinguishable from a hang. Run it as a background
  *task*, redirect to a file, and grep the file (B18).
- **`--target=viewer` is ambiguous once the bench is up**: both webviews are on `localhost:8574`, so
  a substring match lands on whichever the target list returns first. Match the *absence* of
  `noodl-sandbox=` for the app preview, and its presence for the bench or the AI preview. One read in
  this session went to the wrong window before that was fixed.
- **The AI preview is still one click from unreachable (B27)** and session 6's recipe is still the
  only way in: run `scripted-session.js`, close the review, **Reject**, then click **Update it**
  yourself. It worked three times here. The candidate was `/Pages/Landing`'s three v2 files stitched
  into one JSON — reproducible in one `python3` line.

## Fixtures

`/Components/BenchProbe` gained two more scenarios — **`Blue centred`** (320, centred, `blue-500`)
and **`Plain wide`** (768) — beside session 5's `Loaded` / `Empty` / `Narrow`. Both are BEN-007
evidence and are worth keeping: they are the only scenarios in the corpus that carry a colour token
and an enum, which is what made the "switching renders both" check mean anything.

Nothing else in the fixture changed. The hero-title edits made for criterion 12 were reverted and
the file has **0** occurrences of `BEN-007`.

## Gates

- `npm run test:ci`: **`Jasmine: 2574 specs, 6 failures`** — identical to session 6's `2574 / 6`,
  which is what a session that changed no source should produce. The 6 are the same inherited pair of
  files, **confirmed by name in the log** rather than by arithmetic: 4 `AIX-006 style vocabulary`,
  2 `AI model registry`. Compare the count, not the summary (B18).
- ⚠️ **This task file's own gate list is wrong about the jest runner.** It says `npx jest`
  (tests-main + tests-unit); run bare at the repo root that command reports **584 failed suites of
  600** and `Tests: 218` — it is picking up files it cannot run, and it is not a gate. The gate is
  **`npm run test:main`**, which is what the two directories are actually behind:
  **80 suites, 1085 tests, all passing.** A future reader comparing against `npx jest` would be
  comparing against noise.
- `typecheck:editor`, `typecheck:editor-tests`: clean.
- No `eslint` run and none owed — **no source file changed**.
- `catalog:examples` not owed — nothing under `docs/node-catalog/` was touched.

## What to do next

1. **§C's human half.** Show `screenshots/ben007-app-mode.png` and `ben007-bench-mode.png` to someone
   who did not build this and ask which is which, and which is the real app. It is the one criterion
   in the phase that a machine cannot close, and B32 says where to look if it fails.
2. **B29 and B30** are both single occurrences with refuted hypotheses. Neither blocks anything;
   both deserve a `timeOrigin` read the moment anyone sees a preview behaving oddly, because a stale
   preview and one reloading into the wrong export are indistinguishable without it.
3. **B26 belongs to AIX-008** and is the largest thing this phase found that this phase did not own:
   the commonest data-driven shape in the product previews as `Fields unknown`.
4. **B23 belongs to AWP-002** — a v2 save still deletes `description`, and the bench is a surface
   that triggers it.
