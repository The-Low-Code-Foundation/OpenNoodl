# Proposed new library content

**My list first (2026-08-13). Richard's additions go in [§ Richard's list](#richards-list) — nothing
in there has been vetted by me yet.**

Every proposal below is checked against the 175 node types in
[`node-catalog.json`](../../../packages/noodl-types/src/node-catalog.json) and the 58 entries
already in `library/`, so none of it re-authors something that exists. Two constraints held
throughout, both inherited from phase 21 and both worth keeping: **no vendor API keys, no hosted
backend**, and **one good entry beats five thin ones**.

---

## Prefabs — Tier 1: the set that makes a first app possible

The honest test for this tier: *can a builder get from a new project to a working app without
hand-assembling the same four things every time?* Today they cannot, and none of these four exists.

| # | Prefab | What it is | Why it is missing today |
|---|---|---|---|
| 1 | **Auth Pages** | Sign in / sign up / forgot password / reset, as four page components behind a Router, on the built-in `Log In`, `Sign Up`, `Request Password Reset`, `Reset Password`, `User` nodes | The only auth flow in the library is **inside the supabase prefab**, tied to Supabase. Nothing ships auth on *our own* backend. This is the single highest-leverage entry in the list — nearly every app starts here and every builder rebuilds it. |
| 2 | **App Shell** | Sidebar + top bar + content outlet, responsive collapse, active-route highlighting | `navigation-menu` is a menu, not a shell. Nothing ships the frame an app lives inside. |
| 3 | **CRUD Screen** | List + search + pagination + create/edit panel + delete confirm, over `Query Records` / `Create Record` / `Update Record` / `Delete Record` | The most-repeated screen in software, assembled by hand every time. Also the best possible demonstration that the phase-34 backend contract works. |
| 4 | **States Kit** | Loading, Empty, Error and Skeleton — the four states every list has and almost no built list shows | Absorbs `loading-spinner`, which today is a full-screen popup with no tokens at all. Directly attacks [[render-report-clean-means-nothing-drawn]]: a screen that renders nothing should say so. |
| 5 | **Form Fields** | Labelled input / select / checkbox / textarea / date, each with helper text, error text and a disabled state, on the current design tokens | Distinct from the `form` prefab, which is a whole dynamic form *builder*. This is the component set you reach for when writing one form by hand — the level almost every builder actually works at. |
| 6 | **Page Header** | Title, subtitle, breadcrumb, actions slot | Trivial, universal, absent. |
| 7 | **Card & Card Grid** | A styled card and a responsive grid of them | `list-with-icons` is the only list primitive in the library. Note [[flex-wrap-wraps-before-it-shrinks]] when authoring the grid. |
| 8 | **Confirm Dialog** | "Are you sure?" with a real outcome contract — `Confirmed` / `Cancelled` signals, per ERG-001 | `popup-modal` is close but predates the outcome contract and NDA-010 §3's popup-policy context. Re-author rather than patch. |

## Prefabs — Tier 2

| # | Prefab | Note |
|---|---|---|
| 9 | **Stepper / Wizard** | Multi-step form, per-step validation, progress indicator |
| 10 | **File Upload** | `Open File Picker` → `Upload File` → `Cloud File`, with preview, progress and error. The nodes exist; the assembly is fiddly and nobody should do it twice |
| 11 | **Accordion / Disclosure** | Universal, absent |
| 12 | **Search Bar** | Debounced, with clear + result count. `filters` is heavyweight and query-record-coupled; this is the light one |
| 13 | **Settings Page** | Sectioned form with dirty tracking and a save bar |
| 14 | **User Menu** | Avatar + dropdown + sign out. Pairs with #1 |
| 15 | **Chart Cards** | Line / bar / donut, pre-styled, over the existing chart-js module — so a builder never hand-configures Chart.js. **Blocked on LBR-004 proving chart-js works at all** |
| 16 | **Onboarding Checklist** | The education wedge (LEARN-001) — completion state, progress, a place for confetti |
| 17 | **Command Palette** | ⌘K quick switcher. Differentiating, cheap over core nodes |
| 18 | **Data Grid** | Sortable/resizable columns — **or** fold into the `table` repair in LBR-003. Decide after `table` is opened |

## Modules — Tier 1: the dead ends

Each of these is somewhere a builder currently *cannot get to* from the node set. That is the bar
for this tier — not "would be nice", but "there is no path".

| # | Module | Dependency | Why |
|---|---|---|---|
| 1 | **Clipboard** | none (`navigator.clipboard`) | Copy to clipboard. Absent. Perhaps twenty lines. Wanted in every app that shows an id, a link or a code |
| 2 | **File Download** | none (Blob + object URL) | `To CSV` exists and **nothing can download the result**. A genuine dead end sitting next to a node that implies otherwise. Add JSON and text while there |
| 3 | **Intl Format** | none (`Intl.*`) | Relative time ("3 hours ago"), currency, number, plural, list. `Date To String` does not do relative time, and every app wants it |
| 4 | **Rich Text Editor** | TipTap (MIT) | Every content app needs one and nothing close ships. The biggest single capability gap in the module library |
| 5 | **Virtual List** | none | `Repeater` over ten thousand rows is a real ceiling, hit early by anyone with real data |
| 6 | **Drag to Reorder** | none | `Drag` exists; sortable-list reorder is a hard hand-build on top of it |
| 7 | **MapLibre GL** | maplibre-gl (BSD-3) | Replaces `mapbox` — same capability, no vendor token, no proprietary redistribution question. See LBR-007 |

## Modules — Tier 2

| # | Module | Dependency | Note |
|---|---|---|---|
| 8 | **Signature Pad** | none (canvas) | Forms, approvals, delivery apps |
| 9 | **Print / Export to PDF** | html2pdf (MIT) | "Print this screen" is asked for constantly in low-code |
| 10 | **Calendar / Scheduler** | FullCalendar — **verify licence before authoring** | High demand, large surface |
| 11 | **Speech to Text** | none (Web Speech API) | Free, no key, surprisingly delightful |
| 12 | **Audio Record & Play** | none (MediaRecorder) | `web-camera` covers video; audio has nothing |
| 13 | **Scroll Reveal** | none (IntersectionObserver) | Cheap polish, high perceived quality |
| 14 | **Keyboard Shortcuts** | none | Pairs with the Command Palette prefab |
| 15 | **Barcode Generator** | vendored, MIT | Companion to `qr-code`; only worth it if asked for |
| 16 | **Local Persistence** | none | **Audit `Global Store` and `Subscribe to Store` first** — this may already exist and I have not checked |

---

## Deliberately not proposed

Recorded so nobody re-derives them:

- **Anything needing a vendor API key** — phase 21 policy, and the reason three existing modules are
  up for retirement in LBR-006.
- **Charts, markdown, Lottie, an icon set beyond Material** — all four already exist
  (chart-js, markdown, lottie, font-awesome ×2 + lucide-icons). Audit them, do not re-author them.
  This was phase 21's finding and it still holds.
- **A toast prefab** — `toast` exists and is already tokenised. Repair.
- **Auth for a third-party backend** — xano and supabase already connect; #1 is about *our* backend.

## Sequencing note

Tier-1 prefabs 1–4 are worth more than everything else on this page combined, because they are the
difference between a library of widgets and a library you can build an app out of. If only one
thing ships from this document, ship **Auth Pages**.

But none of them should be authored before **LBR-001**, and none before **LBR-008** if it can be
helped: a prefab the AI cannot see gets rebuilt from Groups by the assistant anyway, and then there
are two date pickers in the world instead of one.

---

## Richard's list

<!-- Richard: add here. Nothing below this line has been checked against the node catalog or the
     existing 58 entries yet — I will vet it and fold it into the tiers above. -->
