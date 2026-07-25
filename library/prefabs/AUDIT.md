# Prefab Audit — LIB-002

Static audit of all 29 prefabs under `library/prefabs/<slug>/`, produced by reading each
`library.json` + `project/project.json` headlessly (no live editor). It is the plan-of-record
for the live repair/restyle pass that must follow, and it records what was already done here.

- **Scope of this pass:** inventory, triage, style-charter, metadata hygiene (applied), collision /
  namespacing analysis, folder-hygiene findings, retirement / consolidation proposals, `library:check`.
- **Explicitly NOT done here** (physically impossible in an isolated worktree — see the per-prefab
  *Live residual* and the work-log at the bottom): opening each prefab in the current editor,
  exercising interactive paths, applying the restyle, re-saving in current format, live-installing
  into a fresh project with a zero-console-error check, and verifying on the React 18/19 pairing.

## Verdict summary

| Verdict | Count | Meaning |
|---------|-------|---------|
| **keep** | 14 | Content already clean — proper style-token usage or no visual surface. Only the live re-save + install/console verification remains. |
| **fix**  | 15 | Keep the prefab, but it carries hard-coded colours (and/or misleading metadata, now fixed) that the live restyle pass must tokenise. |
| **retire** | 0 | Nothing is broken-beyond-repair. Redundancy exists (email senders, pagination pair, multi-select trio) — raised as **consolidation proposals** below, decision left to the orchestrator, nothing deleted. |

`library:check`: **29/29 prefabs OK, 0 warnings each** (before and after the metadata edits). The 48
total warnings the gate reports are all on out-of-scope `modules/*`, not prefabs. Asset integrity:
**every** font/SVG referenced by a text-style or node param resolves to a shipped file — no missing
or dangling assets in any prefab.

---

## Style charter (the plan the live restyle pass applies mechanically)

Derived from the two best-behaved prefabs (date-picker, progress-circle) plus the palette the set
already shares. Apply these uniformly so restyled prefabs read as one system:

**Colour**
- All solid fills, text colours, borders and icon colours reference a **named colour token**, never a
  raw hex. The set already shares a coherent palette — reuse these token names so prefabs adopt a
  host project's theme on install:
  - Greys: `Grey - 100 … Grey - 900` (light→dark). Common: `#E9E9E9` (300), `#CECECE` (400),
    `#4C4C4C` (700), `#1F1F1F` (900).
  - Brand: `Primary` (`#5836F5`), `Primary Dark`, `Primary Light`, `Primary Subtle`.
  - Semantic: `Success` (`#49AD7F`), `Danger` (`#F75A4F`), `Notice` (`#F2C441`), `White`.
- **The token system covers solid colour + text only.** Box-shadow colours, semi-transparent scrims
  (`#000000A5`), overlay tints (`#FFFFFF7F`), fully-transparent placeholders (`#5836F500`) are *not*
  expressible as tokens and may stay literal — but a literal that is a **tint of a token** (e.g.
  `#5836F533` = Primary at 20% α, `#F75A4F3F` = Danger at 25% α) is a hazard: if the host redefines
  `Primary`/`Danger`, the token followers change and the hard-coded tint does not, so they visually
  diverge. Where a tint tracks a token, prefer an alpha applied to the token over a frozen hex.

**Text**
- Text nodes reference a **named text style** (`Label Small`, `Body Medium`, `Title Medium`, …), never
  an inline font/size. Text styles reference the bundled Roboto weights (all shipped and resolving).

**Spacing & radius**
- Spacing on an 8px rhythm (4 for tight inline gaps): 4 / 8 / 12 / 16 / 24.
- Corner radius: 4px inputs/cells, 8px cards/containers, pill = full. Keep one radius per role per prefab.

**Structure**
- One clear root component per prefab named for the prefab; children nested one folder deep under it
  (`/Date Picker`, `/Table/Row`). No redundant double-nesting, no trailing spaces, no components that
  duplicate another prefab's public name (see folder-hygiene findings).

---

## The silent-drop policy & namespacing (bundled-style dependency risk)

On **prefab** install, `packages/noodl-editor/src/editor/src/models/modulelibrarymodel.ts`
(`installPrefab`, the drop logic is at **lines ~198–227** in the current file; the spec cites the
older 106–136 range) only ever prompts-to-overwrite for **component** collisions. Any colliding
**style (colour/text), variant, resource or module is silently removed from the import** — the
prefab's version never lands and the host project's same-named item is used instead.

Consequences, grounded in the files:
- A **fresh** NodeGX project ships **no** colour/text styles (`hello-world.template.ts` `metadata: {}`),
  so on the common install path **nothing collides and every prefab's palette lands intact** — the
  prefabs are safe there.
- Installing into an **already-styled** project is where the drop bites. For the shared **generic
  palette tokens** (`Primary`, `White`, the `Grey - N` scale) the drop is *desirable*: the prefab
  adopts the host theme, which is exactly the "adopt or expose the palette coherently" goal.
- The real breakage is narrow and is the live pass's target: (a) prefabs that hard-code a **tint of a
  token** (toast, supabase, multi-choice-with-pills) — the token adopts, the frozen tint doesn't; and
  (b) a prefab-specific token whose exact value is **load-bearing** and would look wrong adopting a
  host's same-named value.

**Namespacing recommendation** (`Prefab/Token`, survives the drop because the name can't collide) — use
it *only* for load-bearing, prefab-specific values; leave the generic palette un-namespaced so it adopts:
- **rating** — `Notice` is the star-fill colour. Namespace to `Rating/Star` so a host's unrelated
  `Notice` can't recolour the stars.
- **toast** — keep `Success`/`Danger`/`Notice` adopting, but **tokenise the tinted backgrounds** (the
  `…3F` alphas) as `Toast/Success Tint` etc. so they can't diverge from the icon/label colour.
- **media-query** — `Primary Subtle` is only used by the throwaway debugger; not worth namespacing
  (see consolidation note — drop the debugger instead).
- All other UI prefabs: **do not namespace** the generic palette; let it adopt.

---

## Per-prefab audit (100% coverage — 29/29)

Format per entry: **verdict** — what it does · functional read · style hygiene · metadata · collision
risk · folder hygiene · **Live residual**. "Live residual" is identical in kind for every kept prefab
(open → exercise → restyle → re-save current format → `library:check` → fresh-project install with a
zero-console check → React 18/19 render) and is only spelled out where a prefab adds something specific.

### UI prefabs

**date-picker** — **fix**. Calendar-dropdown date input (1 comp, 11 nodes, one 14.5KB `Javascript2`
calendar engine). Functionally self-contained; no dangling refs. Style: clean token usage (Primary/Grey
scale + `Label Small`) except one hard-coded `Group.borderColor=#999` → should be `Grey - 400`.
Metadata: **fixed** — desc was "A date picker component."; tags `["UI"]` → `["UI","Form","Input"]`.
Collision: generic palette, adopts fine. Folder: clean (`/Date Picker`).

**time-picker** — **fix**. Hours/minutes picker (2 comps, 6.4KB JS engine). Hard-coded `#999` border +
`#FFFFFF` background → `Grey - 400` / `White`. Metadata **fixed** (parallel to date-picker). Collision:
adopts fine. Folder: clean.

**filters** — **fix**. Filter-control set for query records (10 comps: checkbox, date, multi/single
choice, range, slider, text search; 79 nodes). Rich token usage. Hard-coded `Group.borderColor=#999`
and `icon.iconColor=#666` → `Grey - 400`/`Grey - 700`. Metadata **fixed**: tags `["UI"]`→`["UI","Data"]`
(honest — it drives query records). Collision: adopts fine. Folder: clean, well nested under `/Filters`.

**form** — **fix**. Dynamic form builder (13 comps, 82 nodes) bound to a data model. Hard-coded `#999`,
`#666`, `#FFFFFF` → tokens. Uses `Danger` token for errors (good). Metadata **fixed**: tags
`["UI","Data"]`→`["UI","Form","Data"]`. Collision: `Danger` adopts (fine). Folder: clean under `/Form`.

**multi-choice** — **fix**. Checkbox group multi-select (2 comps). Hard-coded `Group.backgroundColor=#FFFFFF`
→ `White`. Metadata **fixed**: tags → `["UI","Form","Input"]`. Overlaps selection-pills /
multi-choice-with-pills (consolidation note). Folder: clean.

**multi-choice-with-pills** — **fix**. Multi-select dropdown rendering picks as pills (3 comps, 33 nodes).
Hard-coded `#FFFFFF`, icon `#3E3E3E`, text `#FFFFFF`, and a transparent-button `#5836F500` (Primary at
0 α — the fully-transparent placeholder is acceptable, but note it's a Primary tint). Metadata **fixed**
→ `["UI","Form","Input"]`. Collision: watch the `#3E3E3E` icon vs the `Grey - 700` it should be. Folder: clean.

**selection-pills** — **fix**. Single/multi pill selector (2 comps). Hard-coded `Group.backgroundColor=#FFFFFF`
and `Text.color=#FFFFFF` → `White`. Metadata **fixed** → `["UI","Form","Input"]`. Overlaps the two
multi-choice prefabs. Folder: clean, but child is `/Selection Pills/Pill item` — **lowercase "item"**,
inconsistent with the `/…/Item` casing used everywhere else; normalise in the live pass.

**rating** — **keep**. Interactive star rating (2 comps, 25 nodes, no scripts — pure node graph). No
hard-coded colours. Uses a single `Notice` token for star fill → **namespace to `Rating/Star`** (see
above) so it can't adopt a host's unrelated `Notice`. Metadata **fixed**: tags → `["UI","Form","Input"]`.
Folder: clean.

**toggle-switch** — **fix**. Animated toggle (1 comp, States-driven). Hard-coded
`States.value-false-border color=#4C4C4C` (→ `Grey - 700`) and a transparent `checkbox.iconColor=#FFFFFF00`
(acceptable placeholder). Metadata **fixed** → `["UI","Form","Input"]`. Folder: clean.

**tags** — **fix**. Tag list with auto-generated per-tag colours (2 comps). The 12-hue palette lives in a
`JavaScriptFunction` (`Outputs.Colors = [ "#E47915", … ]`) — this is **data, not styling**; leaving it
literal is fine, but document it (it won't theme). Other literals: `#FFFFFF00`, `#5836F500` (transparent
placeholders). Metadata **fixed**: tags → `["UI","Data"]`. Folder: clean.

**list-with-icons** — **keep**. Simple icon+label list (2 comps). Token-clean (`Grey - 900`/`Grey - 300`).
Metadata **fixed**: tags → `["UI","Data"]`. Folder: clean (`/List With Icons`, `/…/Item`).

**navigation-menu** — **keep**. Nav menu bound to a data model, uses `PageStackNavigateToPath` (2 comps).
Token-clean (Primary/Grey-900). Metadata **fixed**: tags → `["UI","Navigation"]`. Folder: clean.

**tab-bar** — **keep**. Tab navigation (2 comps). Token-clean. Metadata **fixed**: tags →
`["UI","Navigation"]`. Folder: clean — **but note stripe bundles a duplicate `/Tab Bar`** (see stripe /
folder hygiene): if both are installed the names collide.

**pagination** — **keep**. Page-number pager with ellipsis (3 comps, 33 nodes). Token-clean
(`Grey - 900`/`Grey - 500`). Metadata **fixed**: tags → `["UI","Data"]`. Folder: clean. Overlaps
pages-and-rows (consolidation note).

**pages-and-rows** — **keep**. Page + rows-per-page picker (1 comp, 22 nodes). Token-clean. Metadata
**fixed**: tags → `["UI","Data"]`. Folder: clean. Overlaps pagination.

**progress-circle** — **keep**. Animated % progress ring (1 comp, `animatetovalue` + `Number Remapper`,
no scripts). Token-clean, exemplary — a charter reference. `Primary` = arc colour, adopts fine. Metadata
**fixed**: tags → `["UI","Feedback"]`. Folder: clean.

**popup-modal** — **fix**. Confirm-dialog modal via `NavigationShowPopup` (2 comps). Hard-coded
`Group.backgroundColor=#000000A5` (scrim — acceptable literal), `boxShadowColor=#00000026` (shadow —
acceptable), and a transparent `button.backgroundColor=#5836F500` (placeholder). The only "true" fixes
are minor; classified **fix** because the scrim/shadow set should be reviewed against the charter.
Metadata **fixed**: tags → `["UI","Feedback"]`. Folder: clean.

**loading-spinner** — **fix**. Full-screen spinner popup (2 comps, ships `Rolling-1s-200px.svg`).
Hard-coded `Group.backgroundColor=#FFFFFF7F` (semi-transparent overlay — acceptable literal). No text/
colour tokens at all. Metadata **fixed**: tags → `["UI","Feedback"]`. Folder: clean. Live residual adds:
confirm the SVG spinner renders under the current runtime.

**toast** — **fix**. Toast messages: Success/Warning/Error/Normal (6 comps, Timer-dismissed). **Highest
style-hygiene debt:** six hard-coded colours, all **token tints** — `#F75A4F3F` (Danger 25%), `#49AD7F3F`
(Success), `#F2C4413F` (Notice) backgrounds + three shadow alphas. Per the charter these tints must be
tokenised (`Toast/Success Tint`, …) or applied as α over the semantic token, else they diverge from the
adopting `Success`/`Danger`/`Notice` icon+label colours. Metadata **fixed**: tags → `["UI","Feedback"]`.
Folder: clean (`/Show Toast/*`).

**table** — **fix**. Data table with typed cells (11 comps: Base/Boolean/Date/Image/Number/String/Header
cells, Row, 83 nodes, a `CSS Definition` node + 14.5KB `Javascript2`). Hard-coded
`Group.borderBottomColor=#B4B4B4`, `icon.iconColor=#666`, `Group.borderRightColor=#000000` → Grey tokens.
Otherwise strong token usage incl. `Success`/`Primary Light`. Metadata already good (`["UI","Data"]`,
unchanged). Collision: adopts fine. Folder: clean, well-organised under `/Table`.

### Cloud / logic prefabs (no visual surface)

**email-verification** — **keep**. Cloud functions for email verification + password reset (12 comps, 49
nodes, 6 JS functions), **bundles its own SendGrid Send Email + Settings**. No styles, no colours — pure
logic. Metadata **fixed**: tags `["Cloud"]` → `["Cloud","Auth","Email"]`. Folder: clean `/#__cloud__/…`
namespacing. Note it re-implements the send-grid prefab's components internally (consolidation note).

**mail-gun** — **keep**. Send email via Mailgun (2 comps: Send Email + Settings, `DbConfig`). Pure logic,
no styles. Metadata **fixed**: tags → `["Cloud","Email"]`. Folder: clean `/#__cloud__/MailGun/*`.

**send-grid** — **keep**. Send email via SendGrid (2 comps). Pure logic. Metadata **fixed**: tags →
`["Cloud","Email"]`. Folder: clean. Overlaps mail-gun (same shape, different provider) and the copy inside
email-verification (consolidation note).

**oauth2** — **keep**. OAuth2 auth cloud functions + one `/OAuth2/Log In` front-end helper (5 comps, a
`CloudFunction2`). Pure logic, no styles. Metadata **fixed**: tags → `["Cloud","Auth"]`. Folder: clean,
consistent cloud/front-end split.

**totp** — **keep**. TOTP (Google-Authenticator-style) auth cloud functions + 2 front-end helpers (11
comps, 47 nodes). Pure logic. Metadata **fixed**: tags → `["Cloud","Auth"]`. Folder: clean.

**xano** — **keep**. Xano backend connector: queries, users, authTokens (10 comps, 62 nodes). Pure logic.
Metadata **fixed**: tags `["Data"]` → `["Data","Auth","Backend"]`; author credit in desc kept. Folder:
mostly clean under `/#XanoPrefab/Xano/*` **but has a trailing-space bug**: component
`/#XanoPrefab/Xano/User/Auth/Xano - authToken - Check ` ends with a space → **trim in the live pass**
(trailing spaces break the LIB-005 import tree and path matching). Also note the hidden-root convention
`#XanoPrefab` (no space) is inconsistent with supabase's `#Supabase Prefab` (space).

**media-query** — **keep**. Responsive-interface helpers: 4 comps (Match / Match-Custom / Setup /
**Debugger**). Mostly logic (Variable2/Or/Javascript2); the Debugger comp is the only visual surface and
uses `Primary Subtle`/`Grey - 900`. Metadata unchanged (`["UI","Utility"]` — honest). Folder: clean.
**Recommendation:** the "Media Query Debugger" is a dev tool that shouldn't ship into a user's project on
install — drop it from the prefab (or gate it) in the live pass; then this prefab has no visual surface at all.

### Hybrid (cloud + substantial UI)

**stripe** — **fix**. Stripe payments + subscriptions: **25 comps, 154 nodes** — cloud functions
(`/#__cloud__/Stripe/*`) **and** a full front-end (`/Stripe/Subscriptions/Plan Picker`, Buy Products,
Current Plan Badge, checkout). Hard-coded colours are JS input defaults `#49AD7F`/`#F75A4F`/`#000000`
(Success/Danger/Grey-900 equivalents) → wire to tokens. Metadata **fixed** — was **misleading** ("Some
helpers to make cloud functions…" with tags `["Cloud"]` despite shipping a whole UI): now "Cloud
functions and UI for Stripe payments and subscriptions…", tags `["Cloud","UI","Payments"]`.
**Folder-hygiene defect:** it bundles `/Tab Bar` and `/Tab Bar/Tab Bar Item` at the root — a **duplicate
of the standalone tab-bar prefab**. On install the component name `Tab Bar` collides with any existing
`Tab Bar`; the live pass should either namespace it (`/Stripe/Tab Bar`) or drop it and depend on the
tab-bar prefab. Also mixes cloud + front-end trees (expected for this prefab, but the deepest tree of all).

**supabase** — **fix**. Supabase connector + a full auth example app: **25 comps, 210 nodes** (Router,
10 Pages, header, login/signup/reset/magic-link flows, user CRUD). Hard-coded `Group.backgroundColor=#FFFFFF`
(→ White) plus `borderBottomColor=#5836F533` / `boxShadowColor=#5836F533` — **Primary tints** that will
diverge if the host redefines `Primary` (charter hazard; apply α over `Primary`). Otherwise good token
usage. Metadata **fixed**: tags `["Data"]` → `["Data","Auth","Backend"]`; author credit kept.
**Folder-hygiene defect:** every component is under `/#Supabase Prefab/Supabase Prefab/…` — the folder
name is **repeated twice**; collapse the redundant nesting in the live pass. Largest prefab by node count.

---

## Consolidation proposals (no deletions made — decision left to the orchestrator)

None of these are broken, so none are retired here. They are redundancy/quality flags for a product
decision:

1. **Email senders — mail-gun vs send-grid vs the copy inside email-verification.** Three near-identical
   "Send Email + Settings" cloud shapes. Options: keep both providers as first-class, and have
   email-verification *depend on* send-grid rather than embed its own copy.
2. **Pagination pair — pagination vs pages-and-rows.** Overlapping concept, different UX (page-number
   switcher vs page+rows-per-page picker). Consider merging into one prefab with a mode, or clearly
   differentiating names/descriptions so users can choose.
3. **Multi-select trio — multi-choice vs multi-choice-with-pills vs selection-pills.** Heavy overlap
   (checkbox group / dropdown-with-pills / pill selector). Consider a single "Multi Select" prefab with
   presentation variants.
4. **media-query "Debugger" component** should not install into user projects — drop/gate it.
5. **stripe's bundled `Tab Bar`** duplicates the tab-bar prefab — namespace or drop.

## Folder-hygiene defects (for LIB-005 import-tree UX)

| Prefab | Defect |
|--------|--------|
| xano | trailing space in `…/Xano - authToken - Check ` |
| supabase | redundant double-nesting `#Supabase Prefab/Supabase Prefab/…` |
| stripe | bundles `/Tab Bar` duplicating the tab-bar prefab; deepest mixed cloud+front-end tree |
| selection-pills | child `Pill item` uses lowercase `item` vs the `/…/Item` convention elsewhere |
| xano vs supabase | inconsistent hidden-root convention (`#XanoPrefab` no space vs `#Supabase Prefab` with space) |

## `library:check` results

`npm run library:check` **ran successfully** in the worktree (pure ts-node; root+editor `node_modules`
are symlinked in — no `lerna`/`nx`). Result: **all 29 prefabs `OK`, 0 warnings each**, unchanged after
the metadata edits. (Full run also covers 26 `modules/*` which are out of this task's scope; their 48
warnings are not prefab warnings.) The SUB-006 semantic validator this gate runs checks node-type /
port-reference validity, **not** style hygiene — which is why the hard-coded-colour and collision issues
above are invisible to the gate and had to be read out of `project.json` by hand.

---

## Work log

### 2026-07-25 — static audit pass (headless, isolated worktree `OpenNoodl-lib002`)

**Done (all achievable without the live editor):**
- Inventoried all 29 prefabs; read every `library.json` + `project/project.json` (node graphs, style
  metadata, scripts, shipped assets).
- Built the verdict triage (**keep 14 / fix 15 / retire 0**) with per-prefab findings covering: function,
  style hygiene (hard-coded colours enumerated per prefab), metadata honesty, silent-drop/collision risk,
  and folder-structure hygiene — 100% coverage, nothing dropped or silently kept.
- Wrote the style charter and the namespacing recommendations.
- Verified asset integrity across all 29 (no missing/dangling fonts or SVGs).
- **Applied metadata hygiene** to 27 `library.json` files (tags enriched to an honest functional
  taxonomy; date-picker/time-picker thin descriptions rewritten; **stripe's misleading cloud-only
  description/tags corrected**). Provenance blocks and all other fields left intact; field order and
  2-space formatting preserved. Re-ran `library:check` → still 29/29 clean.
- Recorded folder-hygiene defects and consolidation proposals for LIB-004/005 and the orchestrator.

**Live residual (CANNOT be done in this worktree — requires the editor from the primary checkout; this
is the entire per-prefab tail from the spec's Success Criteria):**
1. Open each of the 29 prefabs in the current editor; exercise every interactive path.
2. Apply the restyle per the charter — replace the enumerated hard-coded colours with tokens; tokenise
   toast's tint backgrounds; apply the namespacing recommendations (`Rating/Star`, `Toast/* Tint`).
3. Fix the folder-hygiene defects (trim xano's trailing space; collapse supabase's double-nesting;
   namespace/drop stripe's `Tab Bar`; normalise `selection-pills/Pill item`; drop media-query's Debugger).
4. Re-save every prefab in the current format (launders first-save normalisation + the optional-parameters
   v2 shape per SUB-010).
5. Regenerate icons/screenshots (SUB-009 `noodl-preview` headless render where practical).
6. Live-install each into a **fresh** project with a **zero-console-error** check; verify render on the
   **React 18 and 19** pairing (RUN-001 corpus item).
7. Take the consolidation decisions (email senders, pagination pair, multi-select trio) and apply any
   retirements to the index with a reason line here.
8. Publish the full library build via the LIB-001 pipeline and verify one end-to-end install from the
   published site.
