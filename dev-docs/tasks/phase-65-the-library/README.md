# Phase 65 — The library nobody can install (Track LBR)

**Created:** 2026-08-13
**Origin:** Richard, 2026-08-13 —

> *"Can we start a project to audit each one of the prefabs and modules, decide what needs to be
> done to fix them or if we should just build them from scratch, and also add a bunch more that
> would be useful for NodeGX builders?"*

**Status:** 🟡 Specced, nothing built. Tasks are **[TASKS.md](TASKS.md)**; the new-content proposal
is **[PROPOSED-CONTENT.md](PROPOSED-CONTENT.md)** (Richard's additions go there).

## The premise, in one sentence

Phase 21 audited and repaired all 58 library entries in `library/`, and **not one byte of that has
ever reached a user** — the editor still downloads the 2024-era Noodl content, which contains a
node type this editor deleted.

## 🔴 The three findings that reshape the task

Measured today, 2026-08-13, on the tip of `cline-dev`. Each is a check anyone can re-run.

### 1. The published library is not the repaired library — and it is broken on install

`getContentEndpoint()` was repointed at `nodegx-content/static` today (ALPHA-006 B5, after the
2026-08-07 repo rename left it 404ing since). Both indexes now answer **200**. What they serve is
the *pre-phase-21* content:

| | Live CDN | `library/` in this repo |
|---|---|---|
| Prefabs | 29 | 29 |
| Modules | **26** | **29** (lucide-icons, qr-code, confetti never published) |
| Index shape | legacy `label/desc/icon/project/docs/tags` | + `type`, `version`, `minEditorVersion`, `runtimeVersion` |
| Zip naming | `date-picker-1-3.zip` | `date-picker-1.4.0.zip` (versioned, cache-correct) |
| Date Picker `desc` | *"A date picker component."* | *"A date picker input with a pop-up calendar…"* |

The divergence is not cosmetic. Two spot checks, both downloaded from the live CDN:

- **`sendgrid-0-2.zip` still contains a `DbConfig` node.** That node type was **deleted** (FH-018).
  Installing SendGrid from the shipped library today paints a red dashed placeholder, logs *"The
  node type of this instance DbConfig is missing"*, and the API key never arrives. FH-023 fixed all
  nine of these across four prefabs — in `library/`, which nobody serves.
- **`table-0-6.zip` ships Roboto** and twelve raw hexes on node parameters. The local `table` ships
  neither. `library:check` now *fails* any entry naming Roboto (68b26715) — so the gate rejects the
  content the product actually ships.

**Nothing else in this phase matters until the publish path works.** Repairing content that is
never served is the most expensive way to change nothing.

### 2. The audits are real, but almost nothing has been exercised

Both audits are unusually good — [`library/prefabs/AUDIT.md`](../../../library/prefabs/AUDIT.md)
and [`library/modules/AUDIT.md`](../../../library/modules/AUDIT.md) — and both say plainly that
they are headless. The tail is exactly the part that decides repair-vs-rebuild:

- **Prefabs: 1 of 29 has ever been installed live** (`table`, 2026-08-03, verified on *disk*, never
  seen rendered). Zero have been opened and exercised. Spacing and radius were never touched at all
  — "numeric parameters whose visual role cannot be read from JSON".
- **Modules: 0 of 29 exercised, on either React pairing, in preview or deploy.** Four —
  **avatar, chart-js, mapbox, simple-tooltips** — could not even be run headlessly; what they
  register is unknown by any means. Chart.js is the one the whole charting story leans on.
- `library:check` is green **58/58** and reports **49 warnings it never prints**
  ([`check.ts:392`](../../../scripts/library/check.ts) keeps `summary.warnings` as a count and
  discards the messages). A gate that says forty-nine things are wrong and refuses to name one.

### 3. The AI cannot see the library at all

Verified: `packages/noodl-mcp/src` contains **zero** references to prefabs or the module library,
and `node-catalog.json` contains **zero** module-registered node types (the generator never
executes `defineModule` — re-confirmed twice in phase 21).

So `list_node_types` cannot offer a Date Picker, and every AI-authored NodeGX app re-derives one
out of Groups and Text Inputs. Phases 55, 57 and 58 are all about the AI write path; a library the
AI cannot reach is half a library, and it is the half that is growing.

## The rubric — repair or re-author

The question Richard asked needs an answer that is the same for every entry. This is it, applied in
[TASKS.md](TASKS.md):

**Re-author from scratch when two or more hold:**
1. Its visual surface was styled against the pre-DSG-006 palette *and* it has more than a handful of
   components (a restyle is then a rebuild wearing a diff).
2. It duplicates another entry (the multi-select trio, the pagination pair).
3. Its data path predates the phase-34 one-backend contract.
4. It registers no nodes and is a prefab wearing a module label.
5. Its third-party dependency cannot be redistributed (mapbox-gl v2+).

**Repair when:** it is logic with no visual surface (the cloud prefabs — FH-023 just fixed them
properly), or it is already token-clean and small (progress-circle, rating, tab-bar).

**Audit before ruling when:** the entry is large *and* data-bound and nobody has opened it —
`form`, `filters`, `table`, `date-picker`, `time-picker`, and the four unrunnable modules. Six of
the phase's rulings genuinely cannot be taken from JSON, and guessing them is how this register's
most expensive mistakes have started.

## Open rulings — Richard's calls, not mine

Recorded here so a task does not quietly decide one.

1. **Publish access.** Is `the-low-code-foundation/nodegx-content` writable from here, and is
   copying `library-dist/` into it the publish step forever? Everything is blocked on this.
2. **Integration modules.** Phase 21 policy is *"no integration library, permanently"*, and four
   modules predate it: google-sheets, google-analytics, parse-cloud-function (overlaps our own
   backend), mapbox. Retire, park, or grandfather?
3. **Third-party backend connectors.** xano and supabase are pure logic and harmless, but supabase
   also bundles a **25-component example app** (10 pages, a Router, full auth flows) — the largest
   thing in the library. Connector yes; example app inside a prefab?
4. **Licence.** ~9 modules vendor substantial third-party libraries with no licence text anywhere.
   **mapbox-gl v2+ is proprietary** — redistributing it is a legal question independent of the
   API-key policy. My recommendation is to replace it with MapLibre GL (BSD-3, drop-in fork, works
   without a vendor token), which turns a legal problem into a better module.

## What this phase is not

Not a fidelity project for legacy Noodl content. [`COMPATIBILITY-POLICY.md`](../../reference/COMPATIBILITY-POLICY.md)
already settled that NodeGX is a fresh start. The library is *our* shipped content, held to the
current design system and the current node set — where those disagree with 2024 Noodl, 2024 Noodl
loses.
