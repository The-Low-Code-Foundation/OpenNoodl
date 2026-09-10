# HLS-007 — what was built

**Session 12, 2026-09-10.** `nodegx render <project> [--out-dir dir] [--viewports list] [--scale n]`
— every routed page of an app, at every viewport asked for, photographed and graded, with a
non-zero exit naming any page that did not render. **3 of 3 acceptance criteria**, plus the two
halves of register row **C40** that this command needed.

> A pipeline renders every page of an app at three viewport widths and keeps the images, without a
> person opening anything.

---

## 1. 🔴 The first ten minutes, which changed the task

The task file says *"the smallest of the four commands, because the machinery exists"* and asks
whether [#40](https://github.com/The-Low-Code-Foundation/NodeGX/issues/40) landed first, in which
case this is a thin wrapper. **It has not landed, and this was not a thin wrapper.** Measured
before a line was written, on `Puppy test 3` (five routed pages, two viewports):

| | before | after |
|---|---|---|
| pages measured | **5** | 5 |
| **images written** | **2** | **10** |
| wall clock | 27.5s | 27.4s |

`renderReport` visited every routed page and captured screenshots **only for the start page** —
`--out shot` wrote `shot-desktop.png` and `shot-phone.png` for a five-page app. The sweep
(UNI-010 §8.2) added the *measurements* of the other pages and never added their pictures, so for
five sessions `render_report` has been able to say page four has a defect and has never been able
to show it.

Two costs were measured before the shape was chosen, because they decide it:

- a whole-project run is **27.5s** for 5 pages × 2 viewports; a single-page run (`--page`) is
  **9.2s**. So the boot is ~7s and a page-viewport is ~2s. **One browser with N navigations**, not
  N browsers — which is also why this task did not take #40's *"render pages in parallel"* half.
  Composing `--page` per page would have cost 5 × 9.2 = 46s serially, or five Chromes at once.
- adding eight captures to the existing loop cost **nothing measurable** (27.5s → 27.4s).

## 2. The shape

**One capture site, two loops.** `renderReport`'s screenshot block was extracted into a `capture()`
closure and the routed-page sweep now calls the same one. Two capture sites with the options spelled
twice is how the start page gets `captureBeyondViewport` and page four gets a 900px crop of a
3,000px page, and neither picture looks wrong on its own.

**`screenshotPages: 'start' | 'all'`, defaulting to `'start'`.** 🔴 The default is the historical
behaviour on purpose. `render_report` returns its screenshots to a model *as image content*;
turning the sweep on by default would hand an agent ten pictures where it asked for two, for every
project with five pages. `--out-dir` is the caller that wants `all` and it writes them to disk
rather than into a context window. **Measured after the change**: `render_report`'s exact
invocation (`--json --inline-screenshots`) on the five-page project still returns **2** screenshots
and writes **no** files.

**`measure-from-disk.js --out-dir <dir>`** writes `<page-slug>-<viewport>.png` and records each
path on the page's own row. `--out <prefix>` is untouched and still writes the start page only:
every caller that has ever passed it expects exactly one file per viewport, and five pages under a
name keyed only by viewport would have overwritten each other twice.

**`nodegx render` is a front door onto a harness that lives elsewhere** — see §3.

**The grading is a pure function.** `gradeRender(report, routes, viewportCount, wantImages)` returns
an exit code and its sentences and touches no browser, filesystem or clock. That split matters more
here than in `nodegx export`, because the interesting failures of this command are the ones where
**the renderer succeeded and the answer is still wrong**: a page the router registers that the sweep
never visited, a page reached and blank, a page whose image was never written. All three are
invisible in the harness's own exit code, **which is 0 whatever it finds** — deliberately, because
in `render_report` a finding is the product and not a crash. A pipeline gating on the harness gates
on nothing, and `gradeRender` is the whole of what this command adds over a shell alias.

## 3. 🔴 The published package cannot render, and the refusal is the shipped behaviour

`@nodegx/export` publishes `dist` and `README.md`. Rendering needs a browser, the editor's 14MB
viewer bundle and two node catalogs, none of which is in that tarball — and putting them there
would make this package's build depend on the editor's, which the task file puts out of scope
(*"no new rendering"*). So `npm i -g @nodegx/export && nodegx render app` **refuses, with exit 8,
naming every path it looked in and the `NODEGX_RENDER_CLI` escape hatch.**

That makes the refusal the most-executed branch of this command and the one easiest to ship broken,
because in a checkout it never runs. **This is C72's class, and it was driven rather than reasoned
about** — §4 arm C.

⚠️ The two checkout candidates in `renderHarness.ts` resolve **by coincidence of directory depth**
(three levels up from `dist/`, four from `src/cli/`), and the file says so. It is deliberately
**not** `noodl-mcp`'s resolver: that one also reads inside an `app.asar` and re-execs the app's own
Electron binary, because that sidecar runs inside a packaged NodeGX install and this binary does
not. The one thing the two share is the variable name, which means the same thing in both.

## 4. The drive — four arms, each with its control

[`tests/hls007-drive.ts`](../../../packages/nodegx-export/tests/hls007-drive.ts), re-runnable,
**48s**, exit 0. ⚠️ **It is a `.ts` and not a `.test.ts`, and calling it a CI gate would be this
phase's own C46/C47 mistake** — it needs Chrome and the viewer bundle, and a jest row that skipped
when Chrome was absent would be a gate with a hole exactly the shape of the machine that lacks one.

| arm | asserts | its control |
|---|---|---|
| **A** clean 3-page project, `--out-dir` | exit 0, **6 DISTINCT** images | B is the same project failing |
| **B** one page emptied | **exit 7**, naming `/Pages/Mood`, good pages still ✓ in the same run | A is the same project passing |
| **C** the built bundle, no `packages/` above it | **exit 8**, names where it looked | D |
| **D** C plus `NODEGX_RENDER_CLI` | exit 0, all three pages | C |

🔴 **Arm A asserts the hashes are DISTINCT, not that six files exist.** A capture racing its
navigation writes six files, all correctly named, all pictures of one page. The mutant that does
exactly that (§6) fails **only** that check.

**AC1 was also read, not just counted.** Three of the ten images from the five-page drive were
opened: `page-home` shows *Hello World!*, `pages-thank-you` shows *Thank you! Your adoption inquiry
has been sent*, `pages-landing` is the landing page. ⚠️ The **person** half of AC1 — Richard opening
an output directory himself — is five minutes and is his.

## 5. 🔴 What the drive found that the numbers had been hiding

On `Puppy test 3`, **`pages-admin-desktop.png` and `pages-admin-login-desktop.png` came back byte
identical.** Two routed pages with visibly different graphs (Admin has a header, a list card and a
form card; Admin Login has one centred card) producing one picture is exactly what a capture racing
its navigation looks like.

**It is not.** A control — a *fresh browser, one navigation straight to `/#admin`, nothing measured
before it* — produced the **same md5**. The app's own auth gate sends a logged-out visitor from
`/#admin` to the login page, and the image is a true picture of that URL.

Two things follow, and both are in the product rather than only here:

- 🔴 **This command photographs URLS, not components.** A reader who expects one image per
  *component* will misread every redirect in every app. It is in `--help`, in `render.ts`'s module
  note and in the register.
- ⚠️ **The measurement had this property all along and nobody could see it.** `render_report` has
  been reporting *"Rendered clean, 2 texts"* for `/Pages/Admin` while measuring the login page,
  since UNI-010 §8.2. A picture surfaced in one run what five sessions of numbers did not.

## 6. The gates, and the mutants that prove they bite

**CI gates** (`test:packages` scopes `@nodegx/export`, so these run):

- [`hls007-render-grading.test.ts`](../../../packages/nodegx-export/tests/hls007-render-grading.test.ts) — **14 rows**, every branch of `gradeRender`.
- [`hls007-harness.test.ts`](../../../packages/nodegx-export/tests/hls007-harness.test.ts) — **16 rows**, the resolver at both depths, the refusal, and the argument parse.

⚠️ **The fixtures are shapes recorded off a real run**, not written from the TypeScript interface —
the harness is plain JS in another directory that `tsc` cannot check the interface against, so a
fixture written from the claim would agree with the claim and say nothing about the harness.

**All 30 rows and all four drive arms were green on the first run, which is when to distrust them.
Six mutants, each fires:**

| mutant | what failed |
|---|---|
| the per-page capture removed (**C40 reverted**) | drive arm A: **exit 7**, 2 images of 6 |
| the capture moved **before** the navigation | drive arm A: `every image is distinct` — **5 of 6** — and nothing else |
| `blank-render` no longer graded | 2 rows |
| the router cross-check removed | 1 row (**AC3's**) |
| the image count made a total rather than per-page | 2 rows |
| a missing `NODEGX_RENDER_CLI` falls back instead of refusing | 2 rows |

## 6b. 🔴 The suite caught the drive, and the gate that caught it was this phase's own

The first full `nodegx-export` run came back **1 failed of 3,328**, in
`hls001-catalog-cardinality.test.ts` — *"exactly one file in the package names the catalog
artefact"*. The offender was `hls007-drive.ts`, which copied `node-catalog.json` beside the bundle
for arm C **by typing the filename**.

HLS-001 AC4 built that gate because twenty-five files each computed their own path to the catalog,
and C72 is what happens when one of them is wrong in an artefact no in-repo run exercises. Fixed
the way HLS-008 fixed it: `path.basename(catalogPath())`, so the drive copies whatever the accessor
resolves. ✅ **A drive that hardcodes the name keeps passing on the day the accessor changes it,
and then copies nothing** — which would have turned arm C from *"the bundle has no harness"* into
*"the bundle has no catalog"* while still exiting 8.

## 7. 🔴 The compiler found a defect the union was there to find

Adding a `render` arm to `ParsedArgs` **without** the matching branch in `run.ts` made
`nodegx render app --out-dir shots` fall through to the export path — where `projectDir` is a
project and `outDir` is an image directory, so it would have **written an exported React app into
the screenshots folder**. `tsc` caught it as two TS2339s (`force`, `dryRun`) the moment the union
stopped being total. That is what the discriminated union is for, and the branch that fixes it says
so rather than looking like decoration.

⚠️ A peer session hit those same two errors in `npm run typecheck:editor-tests` while they were in
my working tree and reported them as HEAD's. They were mine and uncommitted; `typecheck:editor-tests`
is clean at the end of this task. **HLS-008's warning holds in a second form: a shared file in
several compilers is also a shared file in several sessions' gate runs.**

## 7b. The gate sweep, on the settled tree

- **`@nodegx/export`** — **96/96 suites, 3,327 passed**, 1 skipped, 3,328 total (was 94/94 / 3,297
  at s11; +2 suites, +30 rows are this task's).
- **`noodl-mcp`** — 98/100 suites, **1,408/1,411**. The 3 reds are **C52 unchanged**: 2 in
  `sbr009ThemeEditorDrive`, 1 in `def018-def020-layout-drive`. ⚠️ **Verified rather than matched**:
  the layout one was re-run on its own and is `D28`'s width assertion (`Expected > 0, Received 0`),
  which has nothing to do with screenshots. A count agreeing with a recorded baseline is not the
  same as knowing which rows are red.
- **`tsc --noEmit`** clean: root, `noodl-editor`, `noodl-editor/tsconfig.tests.json`,
  `nodegx-export`, `noodl-mcp`.
- **`hls007-drive.ts`** — 4 arms, 20 checks, exit 0, 48s.
- **Back-compat, measured not argued**: `render_report`'s exact invocation on a five-page project
  still returns **2** screenshots and writes **0** files; `--out` still writes one file per
  viewport; `--page quiz --out` and `--page quiz --out-dir` both still write the focused page.

⚠️ The field the filename is keyed on is `subject`, **not** `isStart`, and the difference is
`--page`. The subject is whichever page the report is *about* — the start page normally, the focused
one under `--page`. Naming it `isStart` would have been **false** for a focused page and silently
stopped `--out --page quiz` writing anything. Caught by reading my own diff, not by a gate.

## 8. Acceptance criteria

| # | criterion | state |
|---|---|---|
| 1 | *(person)* one image per page per viewport, each showing that page | ✅ **MET** — 10 images for 5 pages × 2 viewports on `Puppy test 3`, 6 distinct on `cheer`; three read and verified. Richard's five minutes remain |
| 2 | a page that cannot render exits non-zero and names it, beside a good one in the same run | ✅ **MET** — drive arm B, exit 7, `/Pages/Mood` named, `/Pages/Home` and `/Pages/Notes` ✓ in the same run; arm A is the reverted arm |
| 3 | `render_report` sees **every** page, count asserted against the **router's** list | ✅ **MET** — `gradeRender` compares `report.pages` against routes read by the **exporter's own parse**, a second reader of the same files. A count from `report.pages` agrees with itself whatever the sweep drops |

## 9. What this leaves the next session

- **`screenshotPages: 'all'` exists and nothing but `--out-dir` asks for it.** C40's other half —
  `render_report` itself writing screenshots to disk, and rendering pages in parallel — is
  untouched and still owned by **NONE**.
- **A four-arm drive recipe for a command that spawns a harness**, including the packaged arm.
- **C74 filed** (open, `NONE`): the render sweep reports a redirected route under the component
  name that was asked for, so a routed page behind an auth gate is measured and reported as itself.
  Nothing is wrong with the picture; the *label* is a claim the report cannot support.
