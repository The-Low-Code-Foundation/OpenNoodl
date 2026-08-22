# Phase 65 tasks — Track LBR

Ordered. **LBR-001 gates everything**: content that is never served is not shipped, and eight
months of phase-21 repair work proves how easy that is to forget.

Status vocabulary: Not started · In progress · Built–not driven · Complete · Superseded

| # | ID | Title | Status | Why it is here |
|---|---|---|---|---|
| 1 | **LBR-001** | **Publish, and prove it from the editor** | Not started | The live CDN serves 2024 content with a deleted node type in it. Copy `library-dist/` to `nodegx-content/static/library/`, then install SendGrid + Table + one module **from the real origin** in a fresh project and confirm zero console errors and no `DbConfig` placeholder. Add a gate that compares the live index against `library/` and fails when they diverge — the whole finding is that nothing noticed for eight months. |
| 2 | **LBR-002** | **The gate that will not say what is wrong** | ✅ **Done 2026-08-15** (uncommitted) | `check.ts` counted 49 warnings and discarded every message. It now prints them by default — exit code and 58/58 unchanged, nothing newly gated. **The result changes the triage: there were never 49 problems.** See below. |
| 3 | **LBR-003** | **Open all 29 prefabs** | Not started | The residual phase 21 never reached. Open, exercise every interactive path, apply spacing/radius (never attempted — not readable from JSON), confirm the two deliberate colour shifts, regenerate icons (three size families ship today; media-query is a 1326×674 outlier), install each into a fresh project console-clean. **Verdicts in the table below are provisional until this runs.** |
| 4 | **LBR-004** | **Exercise all 29 modules, both React pairings** | Not started | 0 of 29 have ever run. Priority is the four nobody has run by any means — **avatar, chart-js, mapbox, simple-tooltips**. Preview *and* a deploy build. |
| 5 | **LBR-005** | **Re-author wave 1 — the merges** | Not started | Multi-select trio → one; pagination pair → one; Confirm Dialog on the ERG-001 outcome contract; a States Kit absorbing loading-spinner. 6 entries become 4 better ones. |
| 6 | **LBR-006** | **Un-bundle, re-type, retire** | Not started | material-icons is bundled **4× in 2 incompatible glyph sets** (2122 vs 1865, neither a subset — installing one rewrites the other's picker in both directions). custom-html is bundled twice. Three "modules" register zero nodes. Apply the rulings from README §Open rulings. |
| 7 | **LBR-007** | **Licence sweep, and MapLibre** | Not started | ~9 modules vendor large third-party libs with no licence text. **mapbox-gl v2+ is proprietary.** Recommendation: re-author as `maplibre` (BSD-3, drop-in, no vendor token) — a legal problem becomes a better module. |
| 8 | **LBR-008** | **The library the AI can see** | Not started — 🔴 **RESCOPED 2026-08-15 by phase 69 ruling D7** | 🔴 **Do NOT build the catalog spine here.** [P69 / CN-003](../phase-69-the-node-you-write-yourself/RULINGS.md) owns "**this project**" — the exact, complete overlay of the module node types a project has *installed*, because validation depends on it. **LBR-008 keeps "the shelf"**: cheap discovery of the ~58 entries you could *install*, plus `install_prefab`, layered on top of CN-003. Original text: 0 references to prefabs in `noodl-mcp`, 0 module node types in the catalog; give `list_node_types`/`find_tools` the library. Note [[mcp-node-docs-are-the-token-budget]] — 58 entries must cost tokens like an index, not like 58 `get_node_type` calls. |
| 9 | **LBR-009** | **New content, wave 1** | Not started | The eight Tier-1 prefabs and seven Tier-1 modules in [PROPOSED-CONTENT.md](PROPOSED-CONTENT.md). |
| 10 | **LBR-010** | **New content, wave 2** | Not started | Tier 2, re-prioritised after 009 ships and Richard's list lands. |
| — | **LBR-0xx** | Every import writes `IMPORT-REPORT.md` into your project | Not started | Filed 2026-08-03, still open: [`apply.ts:227`](../../../packages/noodl-editor/src/editor/src/utils/import-engine/apply.ts#L227) gates the write on `if (legacyReport)` while `ResultStage` gates its banner on `recommendation !== 'proceed'`. A first-party prefab install leaves two files in a fresh project claiming it was legacy salvage. Same intent, applied to the UI and not the files. Cheap; do it inside 001. |

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
