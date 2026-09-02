# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

🔴 **Standing rule, set by Richard 2026-08-30 — read
[`dev-docs/guidelines/PHASE-EXECUTION.md`](../../guidelines/PHASE-EXECUTION.md) first:**

> **A defect becomes the next session's first job ONLY if it blocks an acceptance criterion.**
> Otherwise it is filed with an owner, and **the next session builds the next task.**

---

## 🟢 THE BOARD — re-derived from the task FILES, 2026-09-02 (s46)

| task | state, read off its own file |
|---|---|
| SBR-001 | ✅ closed s2 — owns **D49** and **D50** (neither blocking) |
| SBR-002 | ✅ closed s4 — owns **D40**, which s46 escalated (see below) |
| SBR-003 | 🟡 built s4 — owes the `var(--token)` dimension-port probe; owns **D38**, now **confirmed** |
| SBR-004 | ✅ built s5, driven s8b — **and rendered anonymously s46** |
| SBR-005 | 🟡 built s36 — **AC1 is 4 of 5** (no gallery pictures); AC3's failure control ⬜ |
| SBR-006 | ✅ closed s33 |
| SBR-007 | 🟡 **AC3 ⬜** (D15, and now also the picker path); AC2 met by drag with **D53** |
| SBR-008 | ✅ AC1–AC5 met; s45 fixed the health loop, s46 confirmed the page save end to end |
| SBR-009 | 🟢 **AC1 and AC2 driven s46**; AC1's live half ⬜ to SBR-011 |
| SBR-010 | ✅ built s38, **driven s46** — the owner read a stranger's message |
| SBR-011 | 🟡 built s39 — **AC3 open; D46 fixed s42, drive still owed**; owns step 5's live half |
| SBR-012 | ✅ built s35 |
| SBR-013 | ✅ closed s41 |
| **SBR-014** | 🟡 **step 6 of 8. Steps 7 and 8 are the job** |
| SBR-015 | ✅ built s13 |
| SBR-016 | ✅ fixed and driven s15 |
| SBR-017 | ✅ built and driven s14 |

---

## 🔴 FIRST JOB: **SBR-014 steps 7 and 8.** Nothing blocks them

Read **[`notes/sbr014/SBR-014-DRIVE-2026-09-02-s46.md`](notes/sbr014/SBR-014-DRIVE-2026-09-02-s46.md)**
before starting — it carries the instrument, the traps and what each step actually measured.

- **Step 7 — deploy → retitle on the deployed panel → the deployed site shows it (SBR-008).**
  This also owes **AC3's third screenshot**, the only one still missing. `scripts/devtools/drive-deployed.js`
  and `build-deploy-from-disk.mjs` exist and were not used this run.
- **Step 8 — the negative arcs (SBR-002 / SBR-011).** Anonymous cannot see a draft; the no-backend
  sentence; unsubscribe silence beside the firing twin. ⚠️ s44 recorded that anonymous reads of
  `Section`/`Page`/`SiteSettings` returned `{"results":[]}` **HTTP 200 on an empty database**, so
  *refused* and *empty* were indistinguishable. **The database is no longer empty** — there are now
  published pages, five sections with content, a theme and a contact message — so this arc is
  finally measurable, and it was not before.

**Collect on the way:** SBR-011 AC3 and the D46 drive; SBR-005 AC3's failure-line negative control;
SBR-007 AC3 via `DOM.setFileInputFiles` (see below).

---

## ✅ The fixture is READY and much richer than s45 left it — do not rebuild it

`sbr014-drive` (in `NodeGX test projects/`), backend `backend_mtkip2rjf20ct` on port **8604**,
owner `owner@sbr014.test` / `DriveMe123!`. Sign in at `/admin/signin`.

It now holds **four** pages and a working site:
- `Our Studio` / **`home`** — **published**, five sections with real content, in the order
  hero → cta → gallery → richText → contact. This is what `/` serves.
- `Bootstrap Proof` / `bootstrap-proof` — **published** (the CTA's destination).
- 🔴 **The two nameless rows from s44 are still there. Keep them** — they are the before-arm of
  SBR-008's control and cost a whole drive to produce.
- `Theme` is saved as **Night**; `ContactMessage` holds one message from `Ada Kessler`.

⚠️ **The fixture's `SectionRow` is hand-patched to match the regenerated template** (D52). A newly
created project gets the same graph from the template; this one was patched in place so the drive
could continue. If you need a pristine arm, make a new project rather than trusting this one.

---

## 🔴 The instrument — build on it, do not repeat its dead end

🔴 **`Emulation.setDeviceMetricsOverride` on the preview webview DOES NOT WORK, despite being the
documented route.** It moves `innerWidth`/`innerHeight` to 1440×900 and then
`Page.captureScreenshot` returns the **old 988×313 surface tiled** across the bigger frame — every
number reads correct and the picture is an artefact. `captureBeyondViewport: true` is byte-identical.
**Do not spend the session on it again.**

✅ **What works**: a plain headless Chrome on its own CDP port with its own profile, pointed at the
same `:8574` the editor serves. Three scripts in s46's scratchpad — `drive.js` (persistent,
signed-in, verbs `goto/look/click/clickat/clicknth/fill/fillnth/drag/dragxy/wheel/eval/dom`),
`anon.js` and `contact.js` (one-shot, no session). **They are in a session scratchpad and will be
gone** — they are ~150 lines each and worth rewriting, or promote them into `scripts/devtools/`.

**Traps s46 paid for:**
- 🔴 **The viewer mints a fresh `input-<uuid>` on every re-render** — an id read before adding a
  section is stale by the time the section exists. **Address inputs by DOM order.**
- 🔴 **A substring text-match clicked `Published` when asked for `Publish`** — the status label, not
  the action button, and it reported a reachable, successful click on the wrong element. **Match
  button text exactly.** Same family as `onDrop` matching `onDropped`.
- 🔴 **`<title>` matches every text query and has zero area** — it won a "smallest element"
  tie-break and then reported itself unreachable. Filter to rendered `body` elements.
- 🔴 **Assert nothing from a silence without a control that fires.** Both of s46's key findings
  needed one: the wheel (proved on a tall `file://` page) and the request capture (proved by
  `Save page`'s own `PUT`). Without them, "nothing scrolls" and "nothing sends" were unmeasured.
- ✅ **Read the record, not the input's echo.** This is the arm that found all three of this phase's
  blockers, and the only one that would have.

---

## 🔴 The register's open rows

- **[D40](DEFECTS-THE-SITE-BUILDER-FOUND.md#d40)** — 🔴 **ESCALATED s46.** Nothing scrolls, and it is
  **the product, not the harness** — s46 measured it through a different server, a different harness
  and a different app surface, with a wheel proved firing on a control page. **It now bounds the
  admin panel too**: at 1440×900, 3 of 5 section `Save` buttons are unreachable, so **a person on a
  laptop cannot author a five-section page.** Owner SBR-002. ⚠️ Phase 81 VIB-001's contradicting
  `unreachablePx = 0` is still unreconciled, and a **packaged** Electron window is still unmeasured.
  🔴 **This is the strongest candidate for the next thing to fix after the drive.**
- **[D38](DEFECTS-THE-SITE-BUILDER-FOUND.md#d38)** — 🟢 **CONFIRMED s46**, every predicted value.
  Night's `colorOnPrimary` is `#191713` on the fixed black scrim: **10.60:1** at the top of the band,
  **1.42:1** at the bottom. Owner SBR-003. ⚠️ Measured with **no image** in the hero.
- **[D53](DEFECTS-THE-SITE-BUILDER-FOUND.md#d53)** — 🆕 s46. A dragged section cannot be dropped into
  first position (`Move up` can). Owner SBR-007. ⚠️ One drag also fired **two** `reorderSection`
  calls — possibly SBR-010's *"double write shipping since SB-004"*, visible here.
- **[D52](DEFECTS-THE-SITE-BUILDER-FOUND.md#d52)** — ✅ **FIXED s46** (see below).
- **[D51](DEFECTS-THE-SITE-BUILDER-FOUND.md#d51)** — 🔴 **narrowed twice more in s46; do not
  re-derive it.** The **font arm is inert for both shipped templates**: neither asks for Inter —
  they use `var(--font-sans)`/`var(--font-serif)`, and `siteTheme.ts` (site builder) and the
  members-area's own custom token both overwrite those with platform stacks. Confirmed by this
  run's Studio/Night control pair. Owner SBR-014; **not blocking and no longer bounding.** The
  description that made three sessions believe otherwise is a **product** defect in
  `StyleTokensModel.ts:161`, now **[REL-010 §6.12 R8](../phase-82-0.2.2-the-first-row-on-the-shelf/REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md),
  owner phase 81** — D51 points at it and does not carry it.
- **[D49](DEFECTS-THE-SITE-BUILDER-FOUND.md#d49)** / **[D50](DEFECTS-THE-SITE-BUILDER-FOUND.md#d50)**
  — owner SBR-001, unchanged. D50 still means the claim needs a hand-provisioned secret.
- **[D48](DEFECTS-THE-SITE-BUILDER-FOUND.md#d48)** — owner `NONE`. **[D45](DEFECTS-THE-SITE-BUILDER-FOUND.md#d45)** — 🟡 half closed.
  **[D43](DEFECTS-THE-SITE-BUILDER-FOUND.md#d43)** — owner `NONE`.

---

## ⚠️ Uncommitted work

**s46 committed its own work** (the D52 generator fix, the regenerated template, and this phase's
docs) — see the tip of `cline-dev`. ⚠️ The regenerate **preserved a peer's three uncommitted
`realtime: true` lines**, which live in `sb006Components.ts`; that peer's lane still owns them.

🔴 **s45's six product files were still uncommitted when s46 started and s46 did NOT commit them** —
they are another lane's to land:

```
packages/noodl-runtime/src/nodedefinition.ts
packages/noodl-runtime/src/nodelibraryexport.ts
packages/noodl-runtime/src/nodes/std-library/data/dbmodelcrudbase.ts
packages/noodl-runtime/src/nodes/std-library/data/dbmodelnode2.ts
packages/noodl-types/src/runtime/node-definition.d.ts
packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphModel.ts
```

plus the untracked spec `packages/noodl-runtime/test/nodelibraryexport.wire-declared-ports.test.ts`
(**`git add` it explicitly — a pathspec commit skips untracked files silently**). **The drive above
depends on them being present**; if title/slug ever go missing again, check these six first.

---

## 🔴 The phase's end condition

**SBR-014 is still the gate.** The distance is now **steps 7 and 8**, plus SBR-011's owed D46 drive.
That is the distance — not the length of the register.

⚠️ **SBR-007 AC3 cannot be met by file drop** (D15), and s46 adds that the **picker** path is also
undriven — `DOM.setFileInputFiles` is the route and it was not built.

⚠️ **Richard still owes two looks**, and no session can substitute: the five section kinds
(SBR-005 AC1) and the rebuilt theme editor (SBR-009 AC1). 🟢 **Both now have pictures for the first
time** — `notes/sbr014/s46-step4-public-studio-full.png`, `s46-step5-theme-night-unsaved.png` and
`s46-step5-public-night-full.png`. ⚠️ The section-kinds look is **4 of 5**: the gallery is empty.
