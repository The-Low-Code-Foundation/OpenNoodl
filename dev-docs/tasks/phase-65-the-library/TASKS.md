# Phase 65 tasks — Track LBR

Ordered. **LBR-001 gates everything**: content that is never served is not shipped, and eight
months of phase-21 repair work proves how easy that is to forget.

Status vocabulary: Not started · In progress · Built–not driven · Complete · Superseded

| # | ID | Title | Status | Why it is here |
|---|---|---|---|---|
| 1 | **LBR-001** | **Publish, and prove it from the editor** | ✅ **Published 2026-08-22** — twice (repaired content, then the post-blitz 65 entries). Origin verified at payload level: live sendgrid zip has 0 `DbConfig`, live table zip has 0 Roboto. verify-origin re-baselined. **The editor-install half is folded into LBR-003** (no live drive yet). | The live CDN serves 2024 content with a deleted node type in it. Copy `library-dist/` to `nodegx-content/static/library/`, then install SendGrid + Table + one module **from the real origin** in a fresh project and confirm zero console errors and no `DbConfig` placeholder. Add a gate that compares the live index against `library/` and fails when they diverge — the whole finding is that nothing noticed for eight months. |
| 2 | **LBR-002** | **The gate that will not say what is wrong** | ✅ **Done 2026-08-15** (uncommitted) | `check.ts` counted 49 warnings and discarded every message. It now prints them by default — exit code and 58/58 unchanged, nothing newly gated. **The result changes the triage: there were never 49 problems.** See below. |
| 3 | **LBR-003** | **Open all 29 prefabs** | Not started | The residual phase 21 never reached. Open, exercise every interactive path, apply spacing/radius (never attempted — not readable from JSON), confirm the two deliberate colour shifts, regenerate icons (three size families ship today; media-query is a 1326×674 outlier), install each into a fresh project console-clean. **Verdicts in the table below are provisional until this runs.** |
| 4 | **LBR-004** | **Exercise all 29 modules, both React pairings** | Not started | 0 of 29 have ever run. Priority is the four nobody has run by any means — **avatar, chart-js, mapbox, simple-tooltips**. Preview *and* a deploy build. |
| 5 | **LBR-005** | **Re-author wave 1 — the merges** | ✅ **Built 2026-08-22, not driven** — multi-select 1.0.0, pagination 2.0.0, confirm-dialog 1.0.0 (ERG-001), states-kit 1.0.0. 6 entries became 4. | Multi-select trio → one; pagination pair → one; Confirm Dialog on the ERG-001 outcome contract; a States Kit absorbing loading-spinner. 6 entries become 4 better ones. |
| 6 | **LBR-006** | **Un-bundle, re-type, retire** | ✅ **Built 2026-08-22** — Richard's rulings applied: 3 integrations retired, supabase 2.0.0 connector-only (example app deleted), 3 entries re-typed to prefabs, avatar+pdf-viewer unbundled, avatar's subtree trio fixed. | material-icons is bundled **4× in 2 incompatible glyph sets** (2122 vs 1865, neither a subset — installing one rewrites the other's picker in both directions). custom-html is bundled twice. Three "modules" register zero nodes. Apply the rulings from README §Open rulings. |
| 7 | **LBR-007** | **Licence sweep, and MapLibre** | ✅ **Done 2026-08-22** — 22 LICENSE texts across 14 entries, no GPL/proprietary found; maplibre 1.0.0 (maplibre-gl 4.7.1 vendored, BSD-3) replaces mapbox. | ~9 modules vendor large third-party libs with no licence text. **mapbox-gl v2+ is proprietary.** Recommendation: re-author as `maplibre` (BSD-3, drop-in, no vendor token) — a legal problem becomes a better module. |
| 8 | **LBR-008** | **The library the AI can see** | ✅ **Built 2026-08-22** (per the D7 rescope — shelf only, no catalog spine) — list_library / get_library_entry / install_prefab in noodl-mcp's deferred explore group at **zero resident token cost** (8255/8280 before and after; ⚠️ headroom is **25 tokens**, not the 57 CN-006 recorded). 14 specs on a fixture library, package suite 665/665, typecheck:mcp clean. Never exercised from a live MCP client. | 🔴 **Do NOT build the catalog spine here.** [P69 / CN-003](../phase-69-the-node-you-write-yourself/RULINGS.md) owns "**this project**" — the exact, complete overlay of the module node types a project has *installed*, because validation depends on it. **LBR-008 keeps "the shelf"**: cheap discovery of the ~58 entries you could *install*, plus `install_prefab`, layered on top of CN-003. Original text: 0 references to prefabs in `noodl-mcp`, 0 module node types in the catalog; give `list_node_types`/`find_tools` the library. Note [[mcp-node-docs-are-the-token-budget]] — 58 entries must cost tokens like an index, not like 58 `get_node_type` calls. |
| 9 | **LBR-009** | **New content, wave 1** | ✅ **Built 2026-08-22, not driven** — all 15 Tier-1 entries: 8 prefabs (auth-pages, app-shell, crud-screen, states-kit, form-fields, page-header, card-grid, confirm-dialog) + 7 modules (clipboard, file-download, intl-format, rich-text-editor, virtual-list, drag-to-reorder, maplibre). Monogram placeholder icons (verify-dist requires an icon — ModuleCard destructures it unguarded). | The eight Tier-1 prefabs and seven Tier-1 modules in [PROPOSED-CONTENT.md](PROPOSED-CONTENT.md). |
| 10 | **LBR-010** | **New content, wave 2** | Not started | Tier 2, re-prioritised after 009 ships and Richard's list lands. |
| — | **LBR-0xx** | Every import writes `IMPORT-REPORT.md` into your project | ✅ **Done 2026-08-22** — one shared predicate (`shouldWriteImportReport`, legacy/verdict.ts) now gates both report files with the UI banner's intent; proceed-clean installs write nothing. 5 specs; test:main 4992/4992. | Filed 2026-08-03, still open: [`apply.ts:227`](../../../packages/noodl-editor/src/editor/src/utils/import-engine/apply.ts#L227) gates the write on `if (legacyReport)` while `ResultStage` gates its banner on `recommendation !== 'proceed'`. A first-party prefab install leaves two files in a fresh project claiming it was legacy salvage. Same intent, applied to the UI and not the files. Cheap; do it inside 001. |

---

## ✅ LBR-002 result — the 49 warnings were one hole reported 48 times

`scripts/library/check.ts` now captures the warning diagnostics instead of only
`summary.warnings`, and prints them under their entry. Gate behaviour is untouched: **exit 0,
58/58 clean**, warnings still not gated. Full breakdown:

| Code | Count | Where |
|---|---|---|
| `unknown-node-type` | **48** | `modules/avatar` (47 × `"Avatar"`), `modules/pdf-viewer` (1 × `"module.inlineHtml"`) |
| `repeated-sibling-subtree` | **1** | `modules/avatar` — `/#Avatar Components/Sample` |

**Two findings, both of which redirect work:**

1. **Only 2 of 58 entries carry a single warning between them.** The other 56 are silent. "49
   warnings across the library" implied a broad content-quality problem and was quoted that way in
   phase 21; it is nothing of the sort. The library's *content* is in better shape than the count
   suggested — the audit's real gaps are the unexercised half, not warning debt.
2. **48 of the 49 are the catalog gap, not defects.** The validator does not know module-registered
   node types, so a module's *own* node reads as unknown inside its *own* entry. That is the same
   hole as LBR-008 / P69 CN-003, and it means the gate currently cries wolf on precisely the
   entries that are working correctly. **Do not "fix" avatar or pdf-viewer** — fix the catalog, and
   these 48 disappear on their own. Whoever takes CN-003 should use this as a fixture: 48 warnings
   going to 0 with no content change is a clean acceptance signal.

The one genuine content finding is the `repeated-sibling-subtree` in avatar's `Sample` component —
three structurally identical 9-node subtrees that should be one component instantiated three times,
or a Repeater. Minor, real, and shipped. Fold into LBR-006's avatar work.

---

## Provisional verdicts — 29 prefabs

⚠️ **Provisional.** Derived from [`library/prefabs/AUDIT.md`](../../../library/prefabs/AUDIT.md)
plus today's spot checks — **not** from opening them. LBR-003 can overturn any row, and the six
marked *audit-first* are expected to.

| Verdict | Count | Entries |
|---|---|---|
| **Repair** | 14 | date-picker\*, time-picker\*, table\*, tags, toast, toggle-switch, rating, progress-circle, tab-bar, list-with-icons, navigation-menu, media-query (drop its Debugger component), mail-gun, send-grid |
| **Repair — cloud, just fixed** | 5 | email-verification (make it *depend* on send-grid, not embed a copy), oauth2, totp, xano, supabase (connector only) |
| **Re-author / merge** | 6 → 4 | multi-choice + multi-choice-with-pills + selection-pills → **one Multi Select**; pagination + pages-and-rows → **one Pagination**; popup-modal → **Confirm Dialog**; loading-spinner → folded into the **States Kit** |
| **Audit first, then rule** | 2 | **form** (13 comps) and **filters** (10 comps) — both data-bound, both predate the phase-34 backend contract. Do not rule from JSON. |
| **Split** | 2 | **stripe** — 25 comps of cloud + a full subscription UI in one entry. **supabase** — connector vs its 25-component example app, which is an example project, not a prefab. |

\* carries a `Javascript2` engine (date-picker 14.5 KB, time-picker 6.4 KB, table 14.5 KB) — check
whether the current node set has made any of it unnecessary before repairing it.

## Provisional verdicts — 29 modules

| Verdict | Count | Entries |
|---|---|---|
| **Keep — audit only** | 17 | chart-js†, custom-html, data-context, form-validation, geospatial-analysis, lottie, markdown, marquee, material-icons, font-awesome-brands, font-awesome-solid, lucide-icons, mqtt-module, qr-scanner, qr-code, confetti, web-camera |
| **Repair** | 4 | **pdf-viewer** (ships a second copy of custom-html — depend on it), **avatar**† (ships a 1865-glyph material-icons that fights the standalone 2122), **graphql**, **simple-tooltips**† |
| **Re-type to prefab** | 3 | **image-cropper**, **panning-and-zooming-control** (no `index.js` at all — their whole `noodl_modules` is an iconset), **shake-detector** (no `noodl_modules` folder whatsoever). Verified on disk today. All three are prefabs wearing a module label; `type` also drives install routing, so this is a real change. |
| **Retire / park — ruling needed** | 3 | google-sheets, google-analytics, parse-cloud-function (overlaps our own backend) |
| **Re-author** | 1 | **mapbox**† → **maplibre** (BSD-3, no vendor token) |
| **Check against phase 47** | 1 | **i18next-translation** — may be superseded by the internationalisation work |

† one of the four whose registration is **unknown by any means**. Run these first in LBR-004.

## Success criteria

1. A user installing SendGrid from the shipped library gets working secrets and no red placeholder.
2. The live index and `library/` cannot diverge silently again — a gate says so.
3. Every one of the 58 entries has been opened or run by a person, on both React pairings, with the
   result written down per entry.
4. `library:check` names its warnings.
5. An AI asked to build a date picker offers the library one instead of rebuilding it.
6. Wave 1 of the new content ships, and the eight Tier-1 prefabs cover a first app end to end
   without the builder hand-assembling auth, a shell, or a CRUD screen.

---

## 2026-08-22 — the blitz (Fable, one session, 24-agent fan-out)

Everything except LBR-003/004/010 landed in one session. Commits: library surgery+content, icons,
LBR-008 shelf, LBR-0xx fix, LBR-002 gate (all pathspec, on `cline-dev`); two publishes pushed to
`nodegx-content` main. Gates at close: `library:check` **65/65** (warnings 183→135),
`verify-dist` installable-shaped, `verify-origin` green on an **empty** baseline, `typecheck:mcp`
+ `typecheck:editor` clean, `test:main` 4992/4992, noodl-mcp suite 665/665.

**Entry ledger:** 59 → **65** (35 prefabs + 30 modules). Deleted: google-sheets, google-analytics,
parse-cloud-function, multi-choice, multi-choice-with-pills, selection-pills, pages-and-rows,
popup-modal, loading-spinner, mapbox. Added: multi-select, confirm-dialog, states-kit, maplibre,
auth-pages, app-shell, crud-screen, form-fields, page-header, card-grid, clipboard, file-download,
intl-format, virtual-list, drag-to-reorder, rich-text-editor. Moved modules→prefabs: image-cropper,
panning-and-zooming-control, shake-detector.

### Follow-ups (distilled from all 24 agent reports)

1. 🔴 **LBR-003/004 are now the whole residual** — all 65 entries undriven, including the 16 new
   ones. Per-entry drive asks recorded by their authors: crud-screen's `collectionName` connections
   (runtime-supported, editor QueryRecordsAdapter shows Class as edit-only enum); form-fields' JS
   `type="date"` flip surviving React re-renders; rich-text-editor toolbar + Changed signal;
   drag-to-reorder pointer capture; app-shell responsive collapse; confirm-dialog/states-kit
   `var(--token)` resolution on node params; maplibre actually rendering the demo style; avatar's
   Size Row refactor; pdf-viewer + standalone custom-html resolving `module.inlineHtml`.
2. 🔴 **verify-origin still checks coverage by label only.** Its own header says the next step:
   payload-hash published zips against a fresh build. Now that publishes exist, build it.
3. **Cross-entry dependency needs a first-class mechanism.** pdf-viewer keeps a README-only
   `noodl_modules/` dir purely to stay inside check.ts's `providesNodes` tolerance; verify-dist
   separately notes it is now prefab-shaped in the modules tab (overwrite-vs-keep-yours install
   semantics). schema.json has no dependency field; nothing reads manifest `dependencies`.
4. **MCP shelf**: packaged-editor source is unbuilt (no `library/` on disk in a packaged app —
   needs the CDN transport ModuleLibraryModel already uses; `NODEGX_LIBRARY_DIR` overrides today).
   ⚠️ Budget headroom is **25 tokens, not 57** — CN-009 competes for it; re-measure before any
   resident spend. The explore group's purpose line still says "example library".
5. **Icons**: 15 monogram placeholders (generated, deliberate) — a bespoke icon pass would lift the
   cards; pagination's seeded icon no longer depicts its rows-per-page half.
6. **Docs site**: no pages exist for the 16 new slugs; old pages for the 10 deleted slugs
   (modal, pagesandrows, multi-choice…, gsheets, google-analytics, parse-cloud-function, mapbox)
   should be retired/redirected; supabase's page still describes the example app.
7. **noodl-mcp importReportTool** reads `import-report.json`; clean installs now leave none — its
   "authored in NodeGX rather than imported" copy should be checked for clean *imports*.
8. **a11y**: drag-to-reorder is pointer-only (relevant to P71 SM-003's markets); material-icons +
   two kept iconsets load `fonts.googleapis.com` at runtime (vendoring + privacy decision).
9. **Small content debts**: supabase Setup Client's `window.createClient` shim could be inlined
   (2.0.1); its Example Request still queries a hardcoded `companies` table; shake-detector Text
   uses bare `Helvetica`; avatar keeps one #FFFFFF raw hex; confetti's bundle banner says MIT but
   upstream is ISC; mqtt's small transitives not individually licensed; old Mapbox node types don't
   auto-migrate to `nodegx.maplibre.map`.
10. **Not done from the table**: the i18next-translation vs phase-47 check (nobody was assigned);
    LBR-010 (Tier 2) untouched; avatar's 41 unknown-"Avatar" warnings remain the CN-003 fixture.


---

## 2026-09-05 — LBR-003/004: the shelf was rendered, and it had been drawing the wrong thing

**LBR-003/004 were the whole residual and they are now largely closed.** `npm run library:render`
(`scripts/library/render-check.js`) renders every entry into a real page — an `/App` with a Router
and a `Page` holding an instance of the entry — seeded with the Inter + Lucide modules a new
project ships, and measures painted boxes, texts, controls, broken images, console errors and
icons that rendered as their own name. Entry ledger: 65 → **68** (39 prefabs + 29 modules).

### What was actually broken

| Finding | Size | Fixed by |
|---|---|---|
| **Prefabs named an icon set no project has.** `class: "material-icons"` against a Lucide starter (POL-006). The ligature falls back to its literal name, so `rating` drew `starstar_borderstar_border…`, `pagination` drew `chevron_left`/`chevron_right` over its page numbers, `app-shell`'s sidebar read `space_dashboard / home / folder / settings` | 44 params across 16 entries, **plus 4 built inside `functionScript` strings** | `scripts/library/remap-icons.js` — measured **17 → 0** ligature names on screen |
| **Borders that could never draw.** `borderStyle` defaults to `none` and gates width and colour — Tab Bar's active underline, Table's cell/header rules, Multi Select's dropdown outline, Date Picker's field outline | 16 nodes / 10 entries (39 more skipped: module-provided types, whose border semantics are their own) | `scripts/library/fix-invisible-borders.js` — `inactive-conditional-parameter` **49 → 18** |
| **Two prefabs shipped a Material manifest that was a `<link>` to `fonts.googleapis.com`** — a network dependency and a request per app | image-cropper, panning-and-zooming-control | deleted (Richard's ruling 2026-09-05) |
| **`avatar` is dead on React 19.** Its 2018 bundle reaches into `__SECRET_INTERNALS…ReactCurrentDispatcher`; the kit fails to load and every `Avatar` node renders nothing. No source in the repo | whole module, 9.6MB | retired; re-authored as **`prefabs/avatar` 2.0.0** from core nodes (Richard's ruling) |
| **`pdf-viewer` fails on `module.inlineHtml`** — depends on `custom-html` by README convention and nothing installs it | 1 entry | 🔴 **OPEN** — this is follow-up #3 (no dependency mechanism), now with a measurement |

### 🔴 Two findings were the harness's, and the controls are what caught them

Recorded because both would otherwise have been filed as library defects, and one nearly was.

1. **`Outputs.X is not a function` against table, form, filters and pagination.** A Function's
   `out-*` ports are dynamic; the editor derives them and `exportNode` writes them into `ports`,
   while the on-disk `dynamicports` are never read by the runtime. An A/B whose simplest arm was a
   Function calling `Outputs.Done()` on its own run threw identically — **no library content can
   explain that.** The harness now reproduces the export contract, and `--self-test` locks it in
   with a **known-bad floor that must still fail**. 34 of 40 console errors were this.
2. **Every icon failing, Lucide included**, when rendering into a bare directory. Seeding the
   starter modules is what makes a missing Material glyph mean anything.

### New content (Tier 2 / LBR-010, first four)

`avatar` 2.0.0, `search-bar` 1.0.0, `accordion` 1.0.0, `stepper` 1.0.0 — each **rendered and
driven** before being called done. Every one of the three new ones failed its first drive while
looking completely correct on screen:

- **search-bar**: `Timer`'s `Duration` is a plain number of milliseconds. Given the `{value, unit}`
  shape every *dimension* port takes, it stores the object, measures it as zero, and fires
  `Finished` on every `Restart` — the bar emitted once per keystroke and looked like a debounce.
- **accordion**: a Function that toggles a remembered boolean must know whether it has ever run,
  and it has not — with no input ever arriving it never runs at load, so the **first click on each
  header was silently consumed as the missing boot run**. The drive had to click twice. Now a
  `Counter`, which arrives at 0 on load.
- **stepper**: `Advance` reads the Counter it increments; with *Run on value change* ticked it
  re-runs on its own effect and one click walks to the end. Both boxes unticked, and the drive
  counts steps **per click** rather than checking where it ended up.

`scripts/library/make-monogram-icon.js` is new: the phase-65 blitz generated fifteen placeholder
icons and never committed the generator, so the next person to add an entry met a failing
`verify-dist` with no way to satisfy it.

### Still open

1. 🔴 **pdf-viewer / custom-html** — the cross-entry dependency mechanism (follow-up #3) is now a
   measured failure, not a design note.
2. **`form`, `tags`, `table` render blank on install** — `For Each` over data with no samples.
   `card-grid`'s "a connected array wins over the samples" contract is the fix, and the four new
   entries all use it.
3. **494 `raw-spacing-literal` warnings** across the older entries. The new ones are token-clean;
   `var(--space-N)` is proven to resolve on node parameters (form-fields renders correctly, and the
   spacing survived the search-bar's drive unchanged).
4. **`modules/material-icons` still loads from `fonts.googleapis.com`** — inherent to that module,
   but a vendoring decision nobody has made.
5. **LBR-010 Tier 2 remainder**: File Upload, User Menu, Settings Page, Command Palette, Data Grid;
   modules Signature Pad, Speech to Text, Keyboard Shortcuts, Scroll Reveal.
6. `verify-origin` still compares by label only (follow-up #2, unchanged).
