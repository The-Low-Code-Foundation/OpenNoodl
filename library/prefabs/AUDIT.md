# Prefab Audit — LIB-002

> **2026-09-05 (later) — the three blank entries, and two product defects they uncovered.**
>
> - **`form` / `tags` / `table`** were each a `For Each` over data with **no source**, so a fresh
>   install drew nothing at all. All three now carry the `card-grid` contract — a `Static Data` node
>   of sample rows plus a `Choose items` Function where a connected non-empty array wins over the
>   samples. **Measured drawing after the change** (form 10 texts / 3 controls, table 19 texts,
>   tags 6 pills). `table` additionally *threw*: `Extract Headers` called `Inputs.Items.forEach`
>   with nothing connected.
> - **`form`**: `/Form/Text Input` and `/Form/Text Area` had `label` wired from the field descriptor
>   with `useLabel` left at its default of `false`, so **every text field rendered unlabelled**. No
>   rule covers a connected-but-inactive port — `label-not-a-click-target` and
>   `inactive-conditional-parameter` both only look at *parameters*. Same class as the four toggles
>   in `filters` and `multi-select` that shipped as unlabelled boxes.
> - 🔴 **PRODUCT, worth a rule. Owner: NONE.** `net.noodl.controls.options` opts into a default
>   `solid` / `2px` / `#000000` border (`noodl-viewer-react/src/nodes/controls/options.ts:259`) while
>   every sibling control defaults to `borderStyle: none`, and its content is an empty `<span>` until
>   something is selected or a placeholder is set. Under any content-driven size mode the wrapper
>   therefore measures **zero** and the node renders as a 4px black rule across the page — a collapse
>   that reads as a broken node, and which shipped in `form` looking exactly like a styling choice.
>   A "dropdown with no declared height" diagnostic would have caught it.
> - 🔴 **PRODUCT, diagnostics. Owner: NONE.** A throw inside a `Noodl.Events` listener is reported
>   against the node that **emitted**, not the node that threw. `emit` is synchronous
>   (`noodl-runtime/src/events.js`, `ReflectApply`), so the listener's frame unwinds into the
>   emitting script's `try/catch` and wears its name. This cost **two measured render rounds** here:
>   `JavaScriptFunction (/Form/Set Form Value): Cannot set properties of undefined (setting 'Name')`
>   was thrown by `/Form`'s `Receive Value Changed`, in a different component. The message should
>   name the script whose frame actually threw, or say "via" the emitter.
> - 🔴 **PRODUCT, ordering. Owner: NONE.** A repeated child component mounts **before** its parent
>   Group's `Did Mount` fires, so any state a prefab initialises on the parent's `Did Mount` is
>   `undefined` for the first value a child publishes. `form` had exactly this (`HaveValues`) —
>   guarded in one reader and not the other, which is the usual shape of the bug. Worth a
>   diagnostic: state written on `Did Mount` and read by a descendant is a race. Fixed in `form`
>   0.10.0 by creating the map lazily in the listener; **measured afterwards at zero console errors**.
> - 🔴 **`table` — OPEN, not fixed. Owner: NONE.** A column's `Width` never reaches the cell.
>   `Extract Headers` hands each column the string `'1%'`, and the dimension port's setter
>   (`react-component-node.ts:627`) **deletes the prop** for any value without a `.value` — so a
>   declared width does not merely fail to apply, it is removed, and every table lays out by content.
>   Visible at 1280px as the first column taking most of the width. Fixing it means emitting
>   dimension objects, which switches on a width path that **has never executed** in this prefab, on
>   a `display: table` composition, for every column of every table. Deliberately declined without a
>   render beside it; the workaround (`CSS Style`) is in the entry's README.

> **2026-09-05 (later) — the nine "drew nothing" prefabs, ruled once so nobody re-derives them.**
> The render sweep reported 10 entries drawing nothing. Reading each project graph against
> `card-grid` (the shelf's self-demo standard: an unconditional root `Group` with ink, and a
> `Static Data` node feeding the `For Each` through a `Choose items` guard so a connected input
> wins) settles **8 as invisible-by-design and 1 as genuinely broken**:
>
> | Entry | Verdict | The evidence that settles it |
> |---|---|---|
> | `confirm-dialog` | invisible-by-design | Root `Group` "Dialog layer" is `mounted: false`, driven by a `Switch` whose `onFromStart` defaults false and whose only `on` source is the `Open` component input. The open path exists; it is closed at rest. |
> | `media-query` | invisible-by-design | The picked showcase has **zero visual node types** — `Component Inputs`/`Outputs` and a `Javascript2` wrapping `window.matchMedia`. Its `Media Query Debugger` *would* draw. |
> | `oauth2` | invisible-by-design | Zero visual nodes in any of its 5 components; showcase is a `CloudFunction2` plus a `Noodl.Users.become` function. |
> | `shake-detector` | invisible-by-design | Showcase is `DeviceMotionEvent` `Javascript2` + two `String` nodes used as comments. Its `Shake Detector Example` sibling *would* draw. |
> | `supabase` | invisible-by-design | Zero visual nodes across 12 components; showcase is one `JavaScriptFunction` calling `.from('companies').select('*')`. |
> | `toast` | invisible-by-design | Showcase is a `NavigationShowPopup` fired only by the `Do` input. The popup chain resolves (target exists; `For Each` `templateScript` + `States` default `Normal` → `/Show Toast/Normal`, which exists) — a trigger component at rest, not a dangling target. |
> | `totp` | invisible-by-design | Zero visual nodes across 11 components; 9 are under `/#__cloud__/`. |
> | `xano` | invisible-by-design | Zero visual nodes across 10 components; showcase is a `JavaScriptFunction` over `Noodl.Variables.xano[...]`. |
> | **`tags`** | **BROKEN** | Root `Group` has no `backgroundColor` or `border` (no ink of its own) and its only child is a `For Each` fed **solely** by the `Items` input — the project contains **no `Static Data` node at all**, so it repeats zero times. Fixed this session with the `card-grid` contract. |
>
> **And the harness was manufacturing six of those blanks.** `pickShowcase` filtered candidates on
> `c.roots.length > 0` — which counts **nodes, not ink**. A component of pure `JavaScriptFunction` /
> `CloudFunction2` logic has roots, so it was picked as the "showcase" and then reported as drawing
> nothing; worse, for `media-query` and `shake-detector` it *out-ranked a sibling component that
> would have drawn*. The variable was even named `visual`, so this was a bug against the file's own
> stated intent. Fixed: the pick now narrows to components containing a node the runtime reports as
> visual, read from `isVisual` in the generated `packages/noodl-types/src/node-catalog.json` rather
> than a hand-listed set here — a second copy of "what draws" is the copy that goes stale. An
> **unknown type counts as visual**, because module-provided node types are absent from the core
> catalog and demoting a real visual component to `no-visual` would *hide* a broken entry, which is
> the expensive direction to be wrong in. Entries with nothing drawable now report `no-visual` — a
> fact about the entry — instead of `drew nothing`, which reads as a defect. `For Each` is
> `isVisual: true`, so `tags` stays correctly reported as broken.

> **2026-09-05 — LBR-003 ran, and the shelf had been drawing the wrong thing for six weeks.**
> `npm run library:render` renders every entry into a page seeded with the Inter + Lucide modules a
> real new project ships (`starterAssets.ts`, POL-006), then measures what reaches the DOM.
>
> **The finding: sixteen prefabs named an icon set no project has.** They set
> `iconIconSource: { class: "material-icons", … }`. A project made by this editor ships **Lucide**.
> A missing icon font does not render as nothing — the ligature falls back to its own literal name,
> so `rating` drew the words `starstar_borderstar_borderstar_borderstar_border` in gold, `pagination`
> drew `chevron_left` and `chevron_right` across its page numbers, and `app-shell`'s sidebar read
> `space_dashboard / home / folder / settings`. The library was seeded (LIB-001, 2026-07-25) from
> live Noodl content, where Material Icons *was* the default; POL-006 changed the default and
> nothing re-measured. **44 icon parameters across 16 entries, plus four prefabs that build an icon
> source inside a `functionScript` string** — invisible to any JSON rewrite, the same hiding place
> FH-006 found a font family in. Fixed by `scripts/library/remap-icons.js`; measured 17 → **0**
> ligature names on screen.
>
> `image-cropper` and `panning-and-zooming-control` bundled their own Material manifest, which was
> only a `<link>` to **`fonts.googleapis.com`** — a network dependency and a request per app.
> Removed (Richard's ruling, 2026-09-05); both now use Lucide like everything else.
>
> **Second finding: 16 nodes across 10 entries drew a border that could never appear.** `Group`'s
> `borderStyle` defaults to `none` and gates width and colour, so the Tab Bar's active-tab
> underline, the Table's cell and header rules, the Multi Select dropdown outline and the Date
> Picker field outline were all set, all visible in the property panel, and all absent on screen.
> Fixed by `scripts/library/fix-invisible-borders.js` (catalog-driven — it refuses to write the port
> onto module-provided node types, which was 39 of the 55 candidates).
> `inactive-conditional-parameter` warnings: 49 → **18**.
>
> **New this session:** `avatar` 2.0.0 (re-authored from the dead module), `search-bar`, `accordion`,
> `stepper` — each rendered *and driven* through a behavioural harness before being called done.
> Still open: `form`, `tags` and `table` render blank on install because they are `For Each` over
> data with no samples; `card-grid`'s "connected wins over samples" pattern is the fix.

> **2026-08-22 — phase-65 blitz supersedes parts of this record.** The prefab set is now **35
> entries**, and every consolidation proposal below has been EXECUTED: multi-choice +
> multi-choice-with-pills + selection-pills → **multi-select** 1.0.0; pagination + pages-and-rows →
> **pagination** 2.0.0; popup-modal → **confirm-dialog** 1.0.0 (ERG-001 outcome contract);
> loading-spinner → absorbed into **states-kit** 1.0.0. **supabase** is 2.0.0 connector-only (the
> 25-component example app deleted, Richard's ruling). Moved IN from modules/ (re-typed, they
> register no nodes): image-cropper 1.6.0, panning-and-zooming-control 1.2.0, shake-detector 1.1.0.
> NEW wave-1 entries: auth-pages, app-shell, crud-screen, form-fields, page-header, card-grid (all
> 1.0.0, token-clean, README'd, monogram placeholder icons). The live-drive residual (LBR-003) still
> stands for everything, old and new. See `dev-docs/tasks/phase-65-the-library/TASKS.md`.

Static audit of all 29 prefabs under `library/prefabs/<slug>/`, produced by reading each
`library.json` + `project/project.json` headlessly (no live editor). It is the plan-of-record
for the live repair/restyle pass that must follow, and it records what was already done here.

- **Scope of this pass:** inventory, triage, style-charter, metadata hygiene (applied), collision /
  namespacing analysis, folder-hygiene findings, retirement / consolidation proposals, `library:check`.
- **Explicitly NOT done here** (physically impossible in an isolated worktree — see the per-prefab
  *Live residual* and the work-log at the bottom): opening each prefab in the current editor,
  exercising interactive paths, applying the restyle, re-saving in current format, live-installing
  into a fresh project with a zero-console-error check, and verifying on the React 18/19 pairing.

> **Everything below describes the 2026-07-25 static pass and is preserved as written.** A second
> headless pass on 2026-08-02 then **applied** the colour tokenisation, the namespacing and all five
> folder-hygiene fixes — the per-prefab findings below name defects that no longer exist. Read
> [§ 2026-08-02 — headless repair pass](#2026-08-02--headless-repair-pass-isolated-worktree-wt-lib-002)
> at the bottom for current state, corrections to this record, and the real live residual.

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
  an inline font/size. Text styles reference the bundled Inter weights (all shipped and resolving).
  Inter replaced Roboto across the whole library in FH-006 — Roboto is a retired family and
  `library:check` now fails any entry that ships or names one.

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

### 2026-08-02 — headless repair pass (isolated worktree `wt-lib-002`)

The 2026-07-25 pass classified its whole tail as "live". Much of it was not: a hard-coded
colour, a folder-hygiene defect and a collision-risky component name are **file edits**, not
canvas operations. This pass did all of them. The editor was never opened (another session held
the single-instance lock), so everything below was read out of and written into `project.json`
and gated with `library:check` after each prefab.

**`library:check`: 58/58 entries clean, prefabs 29/29 OK with 0 warnings** — unchanged from the
baseline, re-run after each group of edits.

#### 1. Hard-coded colours → tokens (29 values across 13 prefabs)

| Prefab | Change |
|--------|--------|
| date-picker | `borderColor #999` → `Grey - 400` |
| filters | `borderColor #999` → `Grey - 400`; `iconColor #666` → `Grey - 700` |
| form | `borderColor #999` → `Grey - 400`; `iconColor #666` → `Grey - 700`; `backgroundColor #FFFFFF` → `White` |
| multi-choice | `backgroundColor #FFFFFF` → `White` (+ `White` added to palette) |
| multi-choice-with-pills | 2× `#FFFFFF` → `White`; `Text.color #FFFFFF` → `White`; `iconColor #3E3E3E` → `Grey - 700` (+ `White`) |
| selection-pills | `backgroundColor`/`Text.color #FFFFFF` → `White` (+ `White`) |
| time-picker | **2×** `borderColor #999` → `Grey - 400`; `#FFFFFF` → `White` (+ `Grey - 400`, `White`) |
| table | `borderBottomColor #B4B4B4` → `Grey - 400`; `iconColor #666` → `Grey - 700`; `borderRightColor #000000` → `Grey - 900` |
| toggle-switch | States `value-false-border color #4C4C4C` → `Grey - 700` (exact value match; + `Grey - 700`) |
| stripe | JS inputs `#49AD7F`/`#F75A4F`/`#000000` → `Success`/`Danger`/`Grey - 900` (+ `Success`, `Danger`) |
| supabase | 5× `#FFFFFF` → `White`; header tint → `Supabase/Header Tint` |
| rating | `Notice` → **`Rating/Star`** (namespaced) |
| toast | 3 tinted backgrounds → **`Toast/Danger Tint`**, **`Toast/Success Tint`**, **`Toast/Notice Tint`** |

A token absent from a prefab's own palette was **added at its canonical value** (the value the
other 28 prefabs already agree on). This is required, not cosmetic: `resolveColor` returns the
raw string when a name is unknown, so an unresolved `Grey - 700` reaches CSS as garbage.

**Result: zero opaque hex colours remain on any node parameter in any of the 29 prefabs.** The
12 that remain all carry an alpha channel and are exactly the class the charter permits:

- 5 fully-transparent placeholders (`#5836F500`, `#FFFFFF00`) — multi-choice-with-pills,
  popup-modal, tags ×2, toggle-switch.
- 2 scrim/overlay — loading-spinner `#FFFFFF7F`, popup-modal `#000000A5`.
- 5 black shadows — popup-modal `#00000026`; toast `#00000033`/`#00000026`/`#00000019`/`#00000033`.

#### 2. Folder hygiene — all five named defects fixed

`/Tab Bar` → `/Stripe/Tab Bar` (stripe); `/#Supabase Prefab/Supabase Prefab/…` →
`/#Supabase Prefab/…` (supabase, 145 refs); xano's trailing space trimmed; `#XanoPrefab` →
`#Xano Prefab`; `/Selection Pills/Pill item` → `/…/Pill Item`.

Renames rewrote **every** reference, not just `components[].name` — instance node `type` and
Repeater `template` parameters also carry component paths. A tree walk and a raw substring count
were cross-checked per prefab before rewriting (supabase 145 × 2 = 290 raw; stripe 6; xano 20)
to prove no reference hides in a script or a setting.

Verified afterwards across all 29: no duplicate component names, no dangling `type`/`template`
reference, no leading/trailing space in any path segment. Asset integrity re-verified **both
ways** — every referenced font/SVG resolves *and* every shipped asset is referenced (no orphans).

#### 3. Corrections and additions to the 2026-07-25 record

1. **`#999` → `Grey - 400` is right, but not for the reason a reader would assume.** `Grey - 500`
   (`#A5A5A5`) is numerically far closer to `#999999` than `Grey - 400` (`#CECECE`). The mapping
   holds on *sibling* evidence: filters carried both `Grey - 400` and `#999` on `borderColor`, so
   the tokenised sibling names the intent and the hex is the straggler. Same for `#666` vs the
   `Grey - 700` date-picker and time-picker already use. Recorded so this is not "corrected" later.
2. **time-picker has two `#999` borders**, not one.
3. **`/Table/Row borderRightColor` is inert** — the node has `borderWidth: 0px` and no
   `borderRightWidth`, so that border is never drawn. Tokenised for consistency, but the honest
   fix is to delete the parameter; left for the live pass to confirm in the property panel.
4. **stripe's `in-DefaultColor` is a dead input** — the Plan Picker Detail script reads
   `Inputs.SuccessColor` and `Inputs.FailureColor` only; `Inputs.DefaultColor` appears nowhere.
   Not previously recorded. Left in place (removing a port is a graph edit).
5. **email-verification vs send-grid is a hard name collision, not just redundancy.** Both define
   `/#__cloud__/SendGrid/Send Email` and `/#__cloud__/SendGrid/Settings`. Diffed: functionally
   identical apart from node ids and a stale `dynamicports` snapshot, so co-installing produces
   an overwrite prompt rather than data loss — the consolidation proposal stands, but it is now
   graded as benign.
6. **`DbConfig` `dynamicports` enums are stale snapshots and are inert.** They are recomputed at
   load from the host project's `dbConfigSchema` metadata. send-grid ships `MailGunAPIKey` and
   `MailGunDomainName` in its dropdown and mail-gun ships `SendGridAPIKey` — leakage from a shared
   authoring project. Deliberately **not** stripped: the values never reach a user.

   ⚠️ **Superseded 2026-08-06 (FH-018): the `DbConfig` node type has been deleted.** Four prefabs
   still contain one — `send-grid` (1), `email-verification` (3), `mail-gun` (2), `stripe` (3), all
   inside a `…/Settings` cloud-function component that fed an API key to a Component Output. Those
   nodes now load as an **unknown type**: the editor paints a red dashed placeholder and an
   "The node type of this instance DbConfig is missing." warning, the runtime logs and skips them,
   and nothing else in the prefab breaks. Left loud on purpose rather than rewired to a String
   node, which would have shipped an empty API key that looks like it works. The replacement is
   CWF-009's `Secret` node (server-side, `SecretsStore`); these prefabs should be rewired onto it
   in the same pass that node lands.

   ✅ **Closed 2026-08-06 (FH-023).** All nine are now `noodl.cloud.secret`, each `…/Settings`
   component is a fetcher (`Fetch` in, `Ready`/`Failure` out) and all 14 consumers sequence it.
   Corrections to the record above: it was **not** nine API keys — four are credentials and five are
   per-deployment configuration (a Mailgun domain, two Stripe checkout URLs, a verification domain
   and a From address), and all nine were read *server-side*, so no browser path ever existed.
   `/#__cloud__/Sign Up/Actions/Format Email` had to be restructured rather than rewired: it carried
   no signal at all, so there was nothing to trigger a fetch from. Each of the four prefabs now
   ships a `README.md` naming its secrets, and `library:check` gained the missing-type rule that
   would have caught this on the day it landed. See
   [FH-023](../../dev-docs/tasks/phase-42-first-hour/FH-023-THE-PREFABS-LOST-THEIR-KEYS.md).
7. **The charter's "apply an alpha over the token" is not expressible.** `resolveColor` is a
   name→value dictionary lookup with no alpha form, so a tint genuinely cannot track its token.
   Tokenising the tint (`Toast/* Tint`, `Supabase/Header Tint`) is the best available fix: it does
   not make the tint follow `Danger`, it makes the pair editable in one place and survives install.
   **A real α-over-token form is a styles-system feature request, not a prefab defect.**
8. **Text styles cannot reference colour tokens.** `setStyles` emits `styles.text[*].color`
   straight to CSS without `resolveColor` (only some consumers, e.g. `Text.tsx`, resolve it
   afterwards). So the charter's colour rule applies to node parameters only. Every prefab's text
   styles still hold `#000000`; changing them headlessly would have been unsafe.

#### 4. Live residual after this pass

The charter's colour and folder rules are now **fully applied**. What is left genuinely needs the
canvas or a running runtime:

- **All 29** — open + re-save in the current format (SUB-010 first-save normalisation); install
  into a fresh project with a zero-console check; React 18/19 render check.
- **All 29 — visual confirmation of this pass.** Tokenisation was verified structurally (every
  edited port is `type: 'color'`, so it passes through `resolveColor`) but **never seen rendered**.
  Two edits deliberately shift a colour and need an eye: `#B4B4B4` → `Grey - 400` (table cell
  divider, slightly lighter) and `#3E3E3E` → `Grey - 700` (pills icon, slightly lighter).
  `#4C4C4C` → `Grey - 700` and stripe's `#49AD7F`/`#F75A4F` are exact-value swaps.
- **Icons — all 29.** Three inconsistent size families ship today: 680×384/385 (22 prefabs),
  768×570 (the six cloud prefabs), and media-query at **1326×674 / 101 KB**, a clear outlier.
  Regeneration is SUB-009 `noodl-preview` work.
- **toast** — the four shadows use three different alphas (`33`/`26`/`19`) with no visible
  rationale; `#00000033` is simply the node default. Normalising to one value is a judgement that
  should be made looking at them.
- **popup-modal / loading-spinner** — scrim and overlay alphas are charter-permitted but unreviewed.
- **loading-spinner** — confirm `Rolling-1s-200px.svg` renders under the current runtime.
- **table** — confirm `/Table/Row borderRightColor` is truly dead, then delete the parameter.
- **stripe** — remove the dead `DefaultColor` input.
- **Re-layout / spacing / radius.** The charter's 8px-rhythm and radius rules were **not** applied.
  Spacing and radius live in per-node numeric parameters whose visual role cannot be read
  reliably from JSON; changing them blind risks breaking layouts. Untouched by design.
- **Interaction paths** — no prefab was exercised.

**Orchestrator decisions still open** (unchanged, nothing deleted): the three consolidation
proposals, and dropping media-query's `Debugger` component.

#### 5. Could not verify

- That any prefab **renders** — no editor, no runtime, no screenshot.
- That the renamed component trees look right **in LIB-005's import tree**.
- That an install into a fresh project is console-clean.
- Whether the two deliberate colour shifts (`#B4B4B4`, `#3E3E3E`) read correctly.
- Behaviour in a **themed** host project — the adopt-vs-drop behaviour is argued from
  `installPrefab` and `resolveColor` source, not observed.
