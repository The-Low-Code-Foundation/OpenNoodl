# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

🔴 **Standing rule, set by Richard 2026-08-30 — read
[`dev-docs/guidelines/PHASE-EXECUTION.md`](../../guidelines/PHASE-EXECUTION.md) first:**

> **A defect becomes the next session's first job ONLY if it blocks an acceptance criterion.**
> Otherwise it is filed with an owner, and **the next session builds the next task.**

---

## 🟢 THE BOARD — re-derived from the task FILES, 2026-09-05 (s49)

| task | state, read off its own file |
|---|---|
| SBR-001 | ✅ closed s2 — owns **D49**, **D50** (neither blocking) |
| SBR-002 | ✅ closed s4 — owns **D40**, fixed s47, confirmed s48 |
| SBR-003 | 🟡 built s4 — **AC5 CLOSED s51** (the probe is a gate: `sb008` §7, 31/31); owns **D38** |
| SBR-004 | ✅ built s5, driven s8b, re-driven on the deploy s47 |
| SBR-005 | 🟡 built s36 — every AC 🟢 **except AC1's LOOK**, which is Richard's |
| SBR-006 | ✅ closed s33 |
| SBR-007 | ✅ **CLOSED s49 — ALL FIVE ACs MET.** AC3's drop gesture built and driven |
| SBR-008 | ✅ AC1–AC5 met; driven end to end on the DEPLOYED artefact s47 |
| SBR-009 | 🟡 built s37 — AC1's live half driven s47. **D54 is FIXED** (P82 REL-011b) |
| SBR-010 | ✅ built s38, driven s46 |
| SBR-011 | ✅ **ALL FIVE ACs MET s50** — AC2 and AC5 read, **D46's owed drive taken and D46 CLOSED**. ⬜ AC2/AC5 have no *deployed-artefact* reading (coverage gap, not an unmet AC) |
| SBR-012 | ✅ built s35 |
| SBR-013 | ✅ closed s41 |
| SBR-014 | ✅ **CLOSED s47** — all 8 steps |
| SBR-015 | ✅ closed s34 · SBR-016 ✅ s15 · SBR-017 ✅ s14 |

---

## 🔴 READ THIS BEFORE PICKING ANYTHING UP — the last two hand-offs were both stale

**s48's hand-off named D54 as the first job. D54 had already been diagnosed and fixed** the same day
by P82 REL-011b, and its own row in `DEFECTS-…` said so in the headline. s49 lost nothing to it only
because the row was opened before the work started.

**s49's own first job came from doing the same check one level deeper**: `SBR-007 AC3` had been
"blocked on D15, unowned" for three sessions. **D15 was re-measured and had MOVED** — P80's DEF-029
shipped the capability. Nobody had told this phase, because **nobody owns a row owned by `NONE`.**

✅ **So: re-measure the blocker before you inherit it.** Both of the last two first-jobs were rows
that somebody else had already closed.

---

## 🟢 WHAT s49 DID — SBR-007 AC3, the last buildable AC in the phase

Record: **[`SBR-007-THE-PAGE-EDITOR.md` §36–§41](SBR-007-THE-PAGE-EDITOR.md)**.

`/Admin/SectionRow` gained a drop zone that feeds the **same `Upload File` the picker feeds**.
Driven on a running app against the `sbr014-drive` backend with security ENFORCED:

| run | file | requests | on screen |
|---|---|---|---|
| A | `drop-me.png` | upload → `PUT` `{"images":[{"url":…}]}` → `GET` the file | `1 picture`, `<img>` **naturalWidth 64** |
| B | `reject-me.pdf` | **none** | *"That file is not an image…"*, count unchanged, A's picture untouched |
| C | png, `--no-drop` | none | **"Let go to upload"** read mid-drag |
| D | png | the full chain | refusal **gone mid-drag**, count `3 → 4` |

Anonymously, after the panel's own `Publish`: **4 distinct pictures, all decoded, 2 per row over 2
rows.** Pictures in [`notes/sbr007/`](notes/sbr007/).

🔴 **The drive found a defect in the work, and it is the interesting part.** The hover was two
`Text`s swapping `mounted`. It renders correctly, passed all fourteen structural checks, and left
the zone reading **"Let go to upload" with no drag on screen** — `dragenter` **2**, `dragleave`
**1**, because the label the pointer was inside got *unmounted* and an element that leaves the DOM
never fires its balancing leave. **It self-heals on any drop**, so every arm that ended in a drop
read clean; only the `--no-drop` arm could see it. Fixed to one `Text` whose words change. The
general rule — **anything that mounts or unmounts a child of a drop zone in response to the drag
breaks the runtime's depth counter** — is **[D55](DEFECTS-THE-SITE-BUILDER-FOUND.md#d55)**, owner
`NONE`, a viewer row.

---

> ### ✅ DONE s50, 2026-09-05 — SBR-011 is closed and D46 with it
>
> **All five ACs met.** `sbr011-live-preview-drive` **10/10 EXIT=0 twice** (AC1–AC4, the cardinality
> trap and the mutant), `sbr011-hub-unreachable-drive` **3/3** for AC5 re-read against the pooled
> transport, `sbr011LivePreview` **6/6**, `realtime-transports` **88/88**, both tsc clean.
> **D46 is CLOSED**: streams for three subscribing queries went **6/15 → 2**, registration POSTs
> **3-across-four-cycles → 1**, and that POST **`queued 15007ms` → `queued 0ms`**.
>
> 🔴 **The first job below was aimed at the wrong thing, and the mis-aim is the lesson.** AC2 was
> never unmet — it passed in s39 and passes now. And AC3's blocker was **not D46**: the drive's
> warm-up POSTed a *second* `Theme` row while `buildThemeApplierScript` reads `rows[0]` and
> `claimSite` seeds a deliberately-empty singleton there. Every event had been delivered correctly
> the whole time. **No product change was needed for AC3 — only the drive changed.**
>
> 🔴 **The pool fix is what exposed it.** While all three collections were dead this was invisible;
> s40 read `{Page: false, Section: false, Theme: false}` and concluded *"there is nothing
> `Theme`-specific here"* — right about D46, wrong about the theme. When `Page` and `Section` came
> alive and `Theme` did not, it fit *"one dead subscription"* perfectly, which is a defect with the
> **opposite fix**. ✅ **Drive the product's own path** — the panel saves the singleton through
> `theme.firstItemId`, so the drive now does too, with `toHaveLength(1)` as the guard.
>
> ⬜ **The one real gap left**: AC2 and AC5 are measured only on the **in-process** drive. s47 drove
> AC1/AC3/AC4 on the **deployed** artefact; these two have no deployed reading. That is what the
> `⬜ AC2 / AC5` on the old board was actually pointing at.
>
> Full record: [SBR-011 §s50](SBR-011-LIVE-PREVIEW-OVER-THE-REALTIME-HUB.md).

> ### 🟢 THE TOKEN LANE, 2026-09-05 (s51) — added beside the other lanes, not over them
>
> **SBR-003 AC5 is closed: the `var(--token)` dimension-port probe is a GATE.** `sb008` §7, seven
> specs, **31/31 EXIT=0** (24 pre-existing readings unchanged), `typecheck:mcp` **0**. Committed
> `1e415037` + `c21c9df0`.
>
> | arm, 1280×900, anonymous, enforcement on | `--site-measure` | shell `max-width` | shell | frame |
> |---|---|---|---|---|
> | shipped graph | `44rem` | **`704px`** | **704** | 1280 |
> | `var(--sbr003-no-such-token)` | `44rem` | **`none`** | 1232 | 1280 |
>
> The clamp **binds** (704 inside 1280, not a box that was that size anyway), and the token is
> **defined on `:root` in both arms** — the control varies what the port *references*, never what
> the token *is*, which is what makes it a probe of the port.
>
> 🔴 **THE READING WAS NOT NEW AND THIS SESSION BELIEVED IT WAS.** s5 took it on 2026-08-28
> (`SBR-004` §140–141, and `TASKS.md`'s s5 entry says *"✅ SBR-003's carried probe answered"*).
> **SBR-003 §5 still said "still owed" and was never updated; this session read §5 and not
> `TASKS.md`.** The re-measure check WAS run — against *"does a spec exist?"*, which was the wrong
> question. ✅ **When two files in a phase disagree about whether something is owed, the task file's
> status section is the one most likely to be stale.** What was genuinely missing is what AC5
> actually asks for — a standing spec with a control — and that is now what exists.
>
> 🔴 **[D57](DEFECTS-THE-SITE-BUILDER-FOUND.md#d57) — REGISTERED, OWNER `NONE`, and it fooled the
> probe first.** §7's opening run read `max-width: none` in **both** arms, which fits *"the
> dimension port drops `var(--token)`"* perfectly — the exact defect being hunted. It is a
> **fixture** fact: `authorSiteTemplate` never performs the editor's design-token install, and
> `render-from-disk` takes CUSTOM tokens from `metadata.designTokens` alone. So every token the
> template **overrides** still resolves (the page looks correctly themed) and only the one it
> **mints** — `--site-measure` — is absent. `applyTemplateDesignTokens` was **private to
> `vib001-site.look.ts` and that was its only caller**: the look harness's photographs were right,
> and the thirteen drives beside it were not looking at the same page.
> ✅ **Fixed at the seam** — exported from `helpers/site-drive.ts`, the look file imports it, no
> second copy. ⬜ **The other twelve drives are untouched**, deliberately: folding the install into
> `authorSiteTemplate` moves readings in all of them at once (`customTokens` carries the whole
> Studio palette, not just the minted token), so it is a sweep with its own before/after.
> ⚠️ **Do not restate D57 as "the drives are wrong"** — for every claim they actually make the
> missing token changes nothing. The row is that **no drive but the look harness can see a width,
> a gap or a measure.**
>
> ⚠️ **Two assertions were PREDICTED wrong and RECONCILED, not edited to fit**: the control was
> predicted to fill the frame at 1280 and measures **1232**, the pair at 576px and is **528**.
> `shell` states `width: 100%`, so unclamped it fills its parent's *content* box and `frame` carries
> 48px padding. The probe gained `framePaddingX` and the control now asserts the equation
> `shell = frame − padding` rather than a literal a later session could quietly re-fit.
>
> ⚠️ **NOT committed by this lane, and both carry a peer's uncommitted hunks**:
> `DEFECTS-THE-SITE-BUILDER-FOUND.md` (D57 is appended there, alongside two SBR-011 hunks that are
> not this lane's) and this file. **A pathspec commit on either would sweep the peer's edit.**
> Whoever commits them next is carrying D57 and this lane block with them.
>
> ⚠️ **Not run**: `typecheck:backend-tests` (unrunnable on this box) — and ts-jest here is
> `isolatedModules: true`, **so a green suite is NOT a typecheck** of the two backend-test files
> this touched. `vib001-site.look.ts` loads and collects its 2 tests after the refactor, but its
> **photographs were not re-taken**; the change is import-only, which is an argument, not a render.

## ~~🔴 FIRST JOB — **SBR-011 AC2 and AC5**~~ ✅ DONE s50 — kept below for the reasoning, not as a queue

Owner **SBR-011**. AC2 is *a section edited in one browser appears in another without a reload*;
AC5 is *the hub unreachable, and the app says so rather than going quiet*. **D46**'s owed drive sits
with them. AC1/AC3/AC4 were driven s47 on the deployed artefact, so the harness and the fixture both
exist — this is the smallest remaining piece of real work in the phase.

⚠️ **Take AC5 beside a known-firing signal.** §4 of that task already records the trap: a silence
from a dead subscription and a silence from an unreachable hub are the same reading with opposite
fixes. s47 proved the subscription alive FIRST (`POST /realtime/subscriptions`, principal
`anonymous`, in the backend log for that page load) — do that again before believing any silence.

### After that, in order

- **SBR-005 AC3**'s failure-line control · ~~**SBR-003**'s `var(--token)` dimension-port probe~~
  ✅ **done s51** · SBR-002 AC4's other two states on a *deploy* (✅ against the preview — a coverage gap, not an
  unmet AC).
- **[D56](DEFECTS-THE-SITE-BUILDER-FOUND.md#d56)** wants ONE drive: *does a project the WIZARD
  creates deploy?* s49 measured that an **MCP-door-built** project has no `rootNodeId` and
  `deployToFolder` refuses it as a bare `[object Object]`. ⚠️ **Do not restate that as "a wizard
  project cannot be deployed"** — that is the question it raises, not one it answers.

---

## ⚠️ THE TWO LOOKS ONLY RICHARD CAN GIVE — and one of them just got its missing picture

1. **The five section kinds** (SBR-005 AC1). It was *"4 of 5, the gallery is empty because
   `Choose image` opens a native file picker and `DOM.setFileInputFiles` has never been built."*
   🟢 **The drop path goes around that entirely** — s49 authored a four-picture gallery through the
   panel with no file dialog at all. `notes/sbr007/s49-public-gallery-anonymous.png`.
2. **The rebuilt theme editor** (SBR-009 AC1): `s47-step8-deployed-theme-editor.png`.

---

## ✅ THE INSTRUMENTS

**`scripts/devtools/drive-page.js`** — `start goto look dom click clickish clickat **dropfile** fill
eval shot resize requests errors stop`. `DRIVE_STATE` gives independent browsers.

🆕 **`dropfile <selector|x,y> <file>[,<file>…] [--probe=…] [--leave-to=…] [--no-drop]`**, added s49
(the deploy driver had no drag verb; `cdp.js` has had `dropfile` since DEF-029).

- 🔴 **A file drag is NOT a mouse drag and nothing built on `dispatchMouseEvent` can fake it.** A
  file drag has no mousedown in the page; the browser process populates `dataTransfer.files`. And a
  synthetic `new DragEvent(...)` is *worse than nothing*: it skips the `preventDefault`-on-`dragover`
  contract, so it lands whether or not the page opted in — which is half of what a drop zone has to
  get right.
- ✅ **`--probe` reads the page WHILE THE DRAG IS HOVERING**, on the same connection. A separate
  `eval` arrives after the drag ended, when hover state is always false.
- 🆕 `flag()` now accepts **both** `--x value` and `--x=value`. It took only the first; the `=` form
  fell through to the default, so the hover probe returned `undefined` and read exactly like a probe
  that had evaluated to nothing — **an argument-parser fact wearing the shape of a page fact.**

🔴 **`eval` takes a FUNCTION BODY and needs a `return`** — `npm run cdp -- eval` is the opposite.
🔴 **`--button` is not enough**: `Sign in` matched the `H1` *and* the `BUTTON`, and the H1 was
classed actionable and won. Locate by census and use `clickat`.
🔴 `document.body.scrollHeight` is `0` on a viewer page. Inputs by **DOM order**, never by id.

**The deploy side:** `build-deploy-from-disk.mjs` → `deploy-from-disk.cjs`, then `drive-deployed.js`.
Run it from `packages/noodl-editor` as cwd; **always pair with `--sabotage`**. ⚠️ It needs
`rootNodeId` in the project file — see D56.

---

## ✅ Fixtures

**`sbr014-drive`** — backend `backend_mtkip2rjf20ct`, port **8604**, owner `owner@sbr014.test` /
`DriveMe123!` (verified s49 against the backend directly). Start standalone, no editor:

```
node packages/nodegx-backend/bin/nodegx-backend.js serve \
  --data-dir ~/.noodl/backends/backend_mtkip2rjf20ct --port 8604
```

⚠️ `serve --help` **hangs**. Read `src/cli.ts` for flags.

**Pages now:** `Our Studio`/`home`, `PUBLISHED CANARY S47`/`bootstrap-proof` (s49 added a **gallery
section with 4 pictures** and re-published it through the panel), `The Bindery Journal`, one draft.

🔴 **To render a fresh MCP-built project you need three things it does not have**: `rootNodeId`,
`metadata.cloudservices` pointing at the backend, **and** `render-from-disk --backend-port`. The
`/__backend/` proxy defaults to **8581** — with the flag missing, a correct sign-in returns *"That
email and password did not match"*, which is a fact about the proxy wearing the shape of a fact
about the credentials.

---

## ⚠️ Gates, and uncommitted work

**`test:main` floor**: `3 failed, 401 passed` suites / `4 failed, 6647 passed` tests, `EXIT=1` —
`sb-018` ×2, `aib-007`, on committed code, owner `NONE`. **A run showing these three and nothing
else has told you nothing new; a fourth suite is yours.** Not re-measured at s49.

🔴 **s45's six product files are still uncommitted** (they were at s47 and s48 too), plus the
untracked spec `packages/noodl-runtime/test/nodelibraryexport.wire-declared-ports.test.ts`
(**`git add` it explicitly — a pathspec commit skips untracked files silently**). Every drive since
s45 depends on them.

**s49's own changes**, none committed:
`packages/noodl-mcp/tests/sb005Components.ts` · `packages/noodl-mcp/tests/sbr007FileDrop.test.ts`
(untracked) · `packages/noodl-mcp/tests/sb005AdminPanel.test.ts` (census 28→29) ·
`scripts/devtools/drive-page.js` · the regenerated `site-builder.content.json` ·
`dev-docs/tasks/phase-77-the-site-builder-rescue/notes/sbr007/` (untracked).

⚠️ The box **rebooted mid-session** during a full-suite run (`EXIT=144`, empty log, `up 5 mins`).
Everything above was re-run afterwards and is a post-reboot reading.
