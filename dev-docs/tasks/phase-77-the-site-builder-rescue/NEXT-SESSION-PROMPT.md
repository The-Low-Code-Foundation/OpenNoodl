# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

🔴 **Standing rule, set by Richard 2026-08-30 — read
[`dev-docs/guidelines/PHASE-EXECUTION.md`](../../guidelines/PHASE-EXECUTION.md) first:**

> **A defect becomes the next session's first job ONLY if it blocks an acceptance criterion.**
> Otherwise it is filed with an owner, and **the next session builds the next task.**

---

## 🟢 THE BOARD — re-derived from the task FILES, 2026-09-03 (s48)

| task | state, read off its own file |
|---|---|
| SBR-001 | ✅ closed s2 — owns **D49** and **D50** (neither blocking) |
| SBR-002 | ✅ closed s4 — AC4 met s4b (all three states); s47 re-drove the no-backend state on the **deploy**. Owns **D40**, **FIXED s47 and CONFIRMED s48** |
| SBR-003 | 🟡 built s4 — owes the `var(--token)` dimension-port probe; owns **D38**, confirmed s46 |
| SBR-004 | ✅ built s5, driven s8b, rendered anonymously s46, re-driven on the deploy s47 |
| SBR-005 | 🟡 built s36 — **AC1 is 4 of 5** (no gallery pictures); AC3's failure control ⬜ |
| SBR-006 | ✅ closed s33 |
| SBR-007 | 🟡 **AC3 ⬜** (D15, and the picker path); AC2 met by drag with **D53** |
| SBR-008 | ✅ AC1–AC5 met; driven end to end on the DEPLOYED artefact s47 |
| SBR-009 | 🟡 built s37 — AC1's live half driven s47 on the deploy. Owns **D54**, which is now the phase's sharpest open row |
| SBR-010 | ✅ built s38, driven s46 |
| SBR-011 | 🟢 AC1, AC3, AC4 driven s47. ⬜ **AC2 and AC5**; **D46**'s drive still owed |
| SBR-012 | ✅ built s35 |
| SBR-013 | ✅ closed s41 |
| SBR-014 | ✅ **CLOSED s47 — all 8 steps, AC1+AC2+AC3** |
| SBR-015 | ✅ closed s34 |
| SBR-016 | ✅ fixed and driven s15 |
| SBR-017 | ✅ built and driven s14 |

---

## 🔴 THE PHASE'S GATE IS MET. Read this before picking anything up

**SBR-014 was the end condition and it is green**, driven against the **deployed artefact** rather
than the editor's preview: **[`notes/sbr014/SBR-014-DRIVE-2026-09-03-s47.md`](notes/sbr014/SBR-014-DRIVE-2026-09-03-s47.md)**.

⚠️ **What is left is not a task. It is two LOOKS that only Richard can give**, and no session can
substitute for either:

1. **The five section kinds** (SBR-005 AC1) — still **4 of 5**: the gallery is empty, because
   `Choose image` opens a native file picker and `DOM.setFileInputFiles` has never been built.
2. **The rebuilt theme editor** (SBR-009 AC1).

Both have pictures: `s47-step7-deployed-public-retitled-full.png`, `s46-step4-public-studio-full.png`,
`s46-step5-theme-night-unsaved.png`, `s47-step8-deployed-theme-editor.png`.

---

## ✅ WHAT s48 DID — D40's confirming arm, and it is CLOSED

s47's own write-up named the arm it had not run: the runtime consequence was measured on a deploy
built from a **patched project directory**, so the claim was *"the template carries the setting"*,
not *"a new project scrolls"*.

**That arm ran and it reverses.** Record:
**[`notes/d40/D40-CONFIRMING-ARM-2026-09-03-s48.md`](notes/d40/D40-CONFIRMING-ARM-2026-09-03-s48.md)**.
The wizard was clicked through end to end; the project it wrote (`NodeGX test projects/d40-wizard-drive`)
was served by the **editor's own preview server** at **1440×313**; one variable, the **Body Scroll**
checkbox in the product's settings panel:

| | **ON** (as the wizard made it) | **OFF** | **ON again** |
|---|---|---|---|
| `#root` overflow / position | `visible` / `static` | **`clip` / `fixed`** | `visible` / `static` |
| doc `scrollHeight` vs `clientHeight` | **387 > 313** | 313 = 313 | **387 > 313** |
| `scrollTop` at the bottom | **74** | **0** | **74** |
| `Home` `top`, before → after | 322 → **248** | 322 → **322** | 322 → **248** |
| `elementFromPoint` at its centre | **`SPAN\|Home`** | **`null`** | **`SPAN\|Home`** |

🔴 **Do not restate this more strongly than it is.** Three things are still open and the record says
so: **VIB-001's `unreachablePx` sweep was NOT re-run** (its contradiction with the judge line stands);
a **packaged Electron window** is still unmeasured; and the propagation fact is narrow — the
**settings-panel** route reaches a running preview with no reload, while the **disk** route
(editing `nodegx.project.json` under a live editor) is *untested, not disproved*.

Also from s48, and worth carrying: **a wizard-created project is written in the v2 on-disk format —
`nodegx.project.json` + `components/`, and there is NO `project.json`.** Any check that greps
`project.json` in a new project finds nothing and reads as an absence.

---

## 🔴 FIRST JOB — **[D54](DEFECTS-THE-SITE-BUILDER-FOUND.md#d54)**, the theme presets are dead on the deploy

Owner **SBR-009**. This is the sharpest open row in the phase and it is a real hole in its story:
the theme screen's first block tells the person *"Picking one fills every field below"* — and on
their published site it fills nothing.

`Studio` / `Press` / `Night` each clicked on the deployed theme editor; **0 of 7 fields changed,
0 requests**, on enabled buttons with `onclick`, with `elementFromPoint` returning the button
itself — while **`Save theme` on the same screen fires its `PUT`**. s46 drove this same screen
through the editor's preview and recorded `Night` *"filled every field"*.

**So it works in preview and is inert in the deploy — SBR-008's family.** ⚠️ **Not diagnosed**, and
the obvious suspect is already excluded: `droppedByHealthFilter` was **0** and the `--sabotage`
control proved that filter alive.

### The remaining ⬜ rows, none blocking

**SBR-011 AC2** (section edit live) and **AC5** (hub unreachable) · **D46**'s owed drive ·
**SBR-005 AC3**'s failure-line control · **SBR-007 AC3** via `DOM.setFileInputFiles` ·
**SBR-003**'s `var(--token)` dimension-port probe · SBR-002 AC4's other two states on a *deploy*
(✅ against the preview — a coverage gap, not an unmet AC).

---

## ✅ THE INSTRUMENT IS IN THE REPO — do not write it a third time

**`scripts/devtools/drive-page.js`**.

```
DRIVE_STATE=/tmp/a.json node scripts/devtools/drive-page.js start http://127.0.0.1:8791/ --width 1440 --height 900
DRIVE_STATE=/tmp/a.json node scripts/devtools/drive-page.js click 'Save page' --button
DRIVE_STATE=/tmp/a.json node scripts/devtools/drive-page.js stop
```

Verbs: `start goto look dom click clickish clickat fill eval shot resize requests errors stop`.
`DRIVE_STATE` gives you **independent browsers** — s47 held four at once.

🔴 **`eval` takes a FUNCTION BODY, not an expression — it needs a `return`.** s48 lost a call to
this: an IIFE passed as a statement returns `{}` and reads exactly like a page that has not
rendered. (The editor's `npm run cdp -- eval` is the opposite — an expression, and a `return` there
is `SyntaxError: Illegal return statement`. Two tools, two conventions.)

Other traps, each one paid for:

- 🔴 **`--button`, always, for anything you mean to press.** `Sign in` matched the **heading** and
  the button, heading first, and the click reported reachable, successful, and did nothing.
- 🔴 **`document.body.scrollHeight` is `0` on a viewer page** (`#root` is `position: fixed`) — it
  crops every full-page shot to one viewport, silently. The tool measures the tallest `scrollHeight`
  in the tree instead.
- 🔴 Inputs by **DOM order**, never by id (the viewer mints a fresh `input-<uuid>` per re-render).
- ⚠️ **A request captured in a later invocation is a different attachment and sees nothing.**
- ⚠️ `resize` exists **only** to get past D40, and says so in its own source.

**The deploy side:** `scripts/devtools/build-deploy-from-disk.mjs` → `deploy-from-disk.cjs`, then
`drive-deployed.js <dir> --port N --hold` serves it.

🔴 **Run the deploy from `packages/noodl-editor` as cwd** (`getAppPath()` is `process.cwd()`).
🔴 **Always pair a deploy with `--sabotage`** — a health pass that never ran and one that found
nothing produce byte-identical bundles.

### Driving the EDITOR, if you need the wizard or a settings toggle (s48)

`npm run dev:debug -- --quiet`, then `npm run cdp -- …`. Announce the launch to the other
`opennoodl-*` sessions and announce the teardown to the same list.

- ✅ **Stamp, then click.** `el.setAttribute('data-drive', 'x')` then `npm run cdp -- click
  "[data-drive=x]"`. Every step s48 drove was verified by its **consequence** — the template card's
  `TemplateCard--selected` class, the checkbox's `aria-checked` — never by the click's own report.
- 🔴 **The settings panel scrolls, and its controls start below the fold.** `Body Scroll` sat at
  `y = 2156` in a 781px window and `elementFromPoint` returned `null` — the D40 signature, in the
  editor. `scrollIntoView({block:'center', behavior:'instant'})` first; **`behavior: 'smooth'`
  leaves `scrollTop` at 0**.
- ✅ A settings change reaches the running preview **live, with no reload**. `#root`'s computed
  style is the cheap tell for which arm is actually live.

---

## ✅ The fixtures

**`d40-wizard-drive`** (new, s48) — a **wizard-made** Site Builder project, never claimed, no
backend. This is the one to reach for when the question is *"what does a person actually receive"*.

**`sbr014-drive`** — backend `backend_mtkip2rjf20ct` on port **8604**, owner
`owner@sbr014.test` / `DriveMe123!`. Start the backend standalone — **no editor needed**:

```
node packages/nodegx-backend/bin/nodegx-backend.js serve \
  --data-dir ~/.noodl/backends/backend_mtkip2rjf20ct --port 8604
```

⚠️ `serve --help` **hangs** (it starts a server); read `src/cli.ts` for the flags instead.

**Pages now:** `Our Studio`/`home` (published, 5 sections), `PUBLISHED CANARY S47`/`bootstrap-proof`
(published), `The Bindery Journal`/`bindery-journal` (published by s47 **through the panel**, so it
carries a real public-read ACL), and **one** nameless draft (s47 consumed the other).
Theme is **Night** (`--primary #d9a441`).

---

## 🔴 The trap worth carrying, from s47 — and s48 is the same shape inverted

**The instrument was wrong and the product was right, and it looked exactly like a defect.**
Publishing a page by writing `published: true` over REST did not add it to the open site's nav.
Every reading fitted *"live propagation is broken"*. It was the **ACL**:

| published via | ACL |
|---|---|
| the panel's `Publish` (`POST /functions/publishPage`) | `{"role:admin": …, "*": {"read": true}}` |
| a bare REST write | `{"role:admin": …}` — **admin only** |

✅ **Drive the product's own path before calling a difference a defect** — and when a negative result
fits your hypothesis, ask what else it fits.

**s48's inverse**: a fix can look confirmed for the same bad reason. A single green arm on a fixed
product is satisfied by an instrument that cannot see the defect at all. **Build the reverted arm on
the same page, in the same browser, with the same verb** — and take the original reading again
afterwards, which is what rules out drift between two measurements minutes apart.

---

## ⚠️ Gates, and uncommitted work that is NOT this lane's

**`test:main` (the editor's `tests-unit`) is red at HEAD and has been for several sessions.**
Re-measured s48: **`3 failed, 401 passed` suites / `4 failed, 6647 passed` tests, `EXIT=1`** — the
same three suites TASKS.md already tables (`sb-018` ×2, `aib-007`), on **committed** code, owner
`NONE`. **That is the floor. A run that shows these three and nothing else has told you nothing
new; a fourth suite is yours.**

🔴 **s45's six product files are still uncommitted** (they were at s47 too):

```
packages/noodl-runtime/src/nodedefinition.ts
packages/noodl-runtime/src/nodelibraryexport.ts
packages/noodl-runtime/src/nodes/std-library/data/dbmodelcrudbase.ts
packages/noodl-runtime/src/nodes/std-library/data/dbmodelnode2.ts
packages/noodl-types/src/runtime/node-definition.d.ts
packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphModel.ts
```

plus the untracked spec `packages/noodl-runtime/test/nodelibraryexport.wire-declared-ports.test.ts`
(**`git add` it explicitly — a pathspec commit skips untracked files silently**). **Every drive
since s45 depends on them being present.**
