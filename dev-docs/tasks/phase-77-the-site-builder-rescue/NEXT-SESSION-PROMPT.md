# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

🔴 **Standing rule, set by Richard 2026-08-30 — read
[`dev-docs/guidelines/PHASE-EXECUTION.md`](../../guidelines/PHASE-EXECUTION.md) first:**

> **A defect becomes the next session's first job ONLY if it blocks an acceptance criterion.**
> Otherwise it is filed with an owner, and **the next session builds the next task.**

---

## 🟢 THE BOARD — re-derived from the task FILES, 2026-09-03 (s47)

| task | state, read off its own file |
|---|---|
| SBR-001 | ✅ closed s2 — owns **D49** and **D50** (neither blocking) |
| SBR-002 | ✅ closed s4 — AC4 met s4b (all three states); s47 re-drove the no-backend state on the **deploy**. Owns **D40**, now **FIXED** |
| SBR-003 | 🟡 built s4 — owes the `var(--token)` dimension-port probe; owns **D38**, confirmed s46 |
| SBR-004 | ✅ built s5, driven s8b, rendered anonymously s46, re-driven on the deploy s47 |
| SBR-005 | 🟡 built s36 — **AC1 is 4 of 5** (no gallery pictures); AC3's failure control ⬜ |
| SBR-006 | ✅ closed s33 |
| SBR-007 | 🟡 **AC3 ⬜** (D15, and the picker path); AC2 met by drag with **D53** |
| SBR-008 | ✅ AC1–AC5 met; **driven end to end on the DEPLOYED artefact s47** |
| SBR-009 | 🟡 built s37 — **AC1's live half is now driven** (s47, on the deploy). Owns the new **D54** |
| SBR-010 | ✅ built s38, driven s46 |
| SBR-011 | 🟢 **AC1, AC3, AC4 all DRIVEN s47.** ⬜ **AC2 and AC5**; **D46**'s drive still owed |
| SBR-012 | ✅ built s35 |
| SBR-013 | ✅ closed s41 |
| **SBR-014** | 🟢 **CLOSED s47 — all 8 steps, AC1+AC2+AC3 all met** |
| SBR-015 | ✅ closed s34 |
| SBR-016 | ✅ fixed and driven s15 |
| SBR-017 | ✅ built and driven s14 |

---

## 🔴 THE PHASE'S GATE IS MET. Read this before picking anything up

**SBR-014 was the end condition and it is green.** Its own AC1/AC2/AC3 are all met, driven against
the **deployed artefact** rather than the editor's preview. Record:
**[`notes/sbr014/SBR-014-DRIVE-2026-09-03-s47.md`](notes/sbr014/SBR-014-DRIVE-2026-09-03-s47.md)**.

⚠️ **What is left is not a task. It is two LOOKS that only Richard can give**, and no session can
substitute for either:

1. **The five section kinds** (SBR-005 AC1) — still **4 of 5**: the gallery is empty, because
   `Choose image` opens a native file picker and `DOM.setFileInputFiles` has never been built.
2. **The rebuilt theme editor** (SBR-009 AC1).

Both now have pictures: `s47-step7-deployed-public-retitled-full.png`,
`s46-step4-public-studio-full.png`, `s46-step5-theme-night-unsaved.png`,
`s47-step8-deployed-theme-editor.png`.

---

## 🔴 FIRST JOB — pick ONE, in this order

### 1. Confirm D40's fix on a WIZARD-CREATED project (small, and it closes a loop)

**[D40](DEFECTS-THE-SITE-BUILDER-FOUND.md#d40) is FIXED and the fix is verified — but on the wrong
population.** The runtime before/after was measured on a deploy built from a **patched project
directory**, and the **template artefact** was verified to carry `bodyScroll: true`. What was NOT
re-driven is a project the **wizard** creates, opened in the editor.

That is the confirming arm, it is cheap, and until it runs the claim is *"the template now carries
the setting"*, not *"a new project scrolls"*. **Do not restate it more strongly than that.**

### 2. **[D54](DEFECTS-THE-SITE-BUILDER-FOUND.md#d54)** — the theme presets are dead on the deploy

Owner **SBR-009**. `Studio` / `Press` / `Night` each clicked on the deployed theme editor;
**0 of 7 fields changed, 0 requests**, on enabled buttons with `onclick`, with `elementFromPoint`
returning the button itself — while **`Save theme` on the same screen fires its `PUT`**. s46 drove
this same screen through the editor's preview and recorded `Night` *"filled every field"*.

**So it works in preview and is inert in the deploy — SBR-008's family.** ⚠️ **Not diagnosed**, and
the obvious suspect is already excluded: `droppedByHealthFilter` was **0** and the `--sabotage`
control proved that filter alive.

⚠️ **This is a real hole in the phase's own story.** The theme screen's first block tells the person
*"Picking one fills every field below"* — on their published site, it fills nothing.

### 3. The remaining ⬜ rows, none blocking

**SBR-011 AC2** (section edit live) and **AC5** (hub unreachable) · **D46**'s owed drive ·
**SBR-005 AC3**'s failure-line control · **SBR-007 AC3** via `DOM.setFileInputFiles` ·
**SBR-003**'s `var(--token)` dimension-port probe · SBR-002 AC4's other two states on a *deploy*
(they are ✅ against the preview — a coverage gap, not an unmet AC).

---

## ✅ THE INSTRUMENT IS NOW IN THE REPO — do not write it a third time

**`scripts/devtools/drive-page.js`** — s46 wrote these scripts, lost them to a scratchpad, and s47
wrote them again. They are now committed.

```
DRIVE_STATE=/tmp/a.json node scripts/devtools/drive-page.js start http://127.0.0.1:8791/ --width 1440 --height 900
DRIVE_STATE=/tmp/a.json node scripts/devtools/drive-page.js click 'Save page' --button
DRIVE_STATE=/tmp/a.json node scripts/devtools/drive-page.js stop
```

Verbs: `start goto look dom click clickish clickat fill eval shot resize requests errors stop`.
`DRIVE_STATE` gives you **independent browsers** — s47 held four at once.

**Traps built in, each one paid for:**

- 🔴 **`--button`, always, for anything you mean to press.** `Sign in` matched the **heading** and
  the button, heading first, and the click reported reachable, successful, and did nothing. Same
  family as s46's `Published` winning a query for `Publish`.
- 🔴 **`document.body.scrollHeight` is `0` on a viewer page** (`#root` is `position: fixed`).
  Taking page height from it **crops every full-page shot to one viewport, silently** — s47's first
  step-7 picture was cropped at 813 of 1604px and looked perfectly fine. The tool measures the
  tallest `scrollHeight` in the tree instead.
- 🔴 Inputs by **DOM order**, never by id (the viewer mints a fresh `input-<uuid>` per re-render).
- ⚠️ **A request captured in a later invocation is a different attachment and sees nothing** — the
  action verbs report the requests *they* caused, in their own call.
- ⚠️ `resize` exists **only** to get past D40 so the thing behind it can be measured, and says so
  in its own source. It is a workaround a person does not have.

**The deploy side:** `scripts/devtools/build-deploy-from-disk.mjs` → `deploy-from-disk.cjs`, then
`drive-deployed.js <dir> --port N --hold` serves it.

🔴 **Run the deploy from `packages/noodl-editor` as cwd.** `getAppPath()` is `process.cwd()`
(`platform-node.ts:8`), so from the repo root it looks for `<repo>/src/external/deploy/index.json`
and dies. No symlink needed — just the cwd.

🔴 **Always pair a deploy with `--sabotage`.** A health pass that never ran and one that found
nothing produce byte-identical bundles; the sabotage arm drops exactly 1 wire and names it.

---

## ✅ The fixture, and what s47 left in it

`sbr014-drive` (in `NodeGX test projects/`), backend `backend_mtkip2rjf20ct` on port **8604**,
owner `owner@sbr014.test` / `DriveMe123!`.

Start the backend standalone — **no editor needed**:

```
node packages/nodegx-backend/bin/nodegx-backend.js serve \
  --data-dir ~/.noodl/backends/backend_mtkip2rjf20ct --port 8604
```

⚠️ `serve --help` **hangs** (it starts a server); read `src/cli.ts` for the flags instead.

**Pages now:** `Our Studio`/`home` (published, 5 sections), `PUBLISHED CANARY S47`/`bootstrap-proof`
(published — this is the old `Bootstrap Proof`, retitled twice by the step-7 drive),
`The Bindery Journal`/`bindery-journal` (**published by s47 through the panel**, so it carries a
real public-read ACL), and **one** nameless draft.

⚠️ **s47 consumed one of the two nameless draft rows** to drive SBR-011 AC1 the person's way. One
remains. ⚠️ s47 also found `bootstrap-proof`'s title reading `Bootstrap P EDITEDroof` on arrival —
an **unrecorded s46 edit** (`updatedAt` 21:48Z, mid-s46), not caused by s47.

Theme is back to **Night** (`--primary #d9a441`) — s47 changed it to `#3ba55d` to drive AC3 and
restored it.

---

## 🔴 The trap s47 paid for, and it is the one worth carrying

**The instrument was wrong and the product was right, and it looked exactly like a defect.**

Publishing a page by writing `published: true` over REST did **not** add it to the open site's nav —
not live, and not after a reload. Every reading fitted *"live propagation is broken"*.

It was not. Reading the **ACLs** settled it:

| published via | ACL |
|---|---|
| the panel's `Publish` (`POST /functions/publishPage`) | `{"role:admin": …, "*": {"read": true}}` |
| a bare REST write | `{"role:admin": …}` — **admin only** |

`published` is a flag; the **ACL** is the gate, and `publishPage` sets both. ✅ **Drive the
product's own path before calling a difference a defect** — and when a negative result fits your
hypothesis, ask what else it fits.

The same shape bit twice more in one session: a `Save theme` that produced **0** repaints (the
`PUT` carried the *unchanged* palette, because the preset click had done nothing — **D54**), and a
`--full` screenshot that cropped at one viewport while every number read correct.

---

## ⚠️ Uncommitted work that is NOT this lane's

🔴 **s45's six product files were still uncommitted at s47 and s47 did NOT commit them:**

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
since s45 depends on them being present**; if title/slug ever go missing again, check these six
first.
