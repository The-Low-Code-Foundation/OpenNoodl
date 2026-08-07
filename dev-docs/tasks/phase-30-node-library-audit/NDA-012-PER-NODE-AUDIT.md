# NDA-012: Per-Node Audit — all 155, one at a time

## Metadata

| Field | Value |
|-------|-------|
| **ID** | NDA-012 |
| **Phase** | Phase 30 — Node Library Audit & Remediation (Track O) |
| **Tier** | 3 — **optional**, and explicitly resumable |
| **Priority** | 🟡 Medium — nothing depends on it, but it is the only thing that bounds the unknown |
| **Difficulty** | 🟢 Low per node, 🟠 Medium in aggregate — the work is repetitive, not hard |
| **Estimated Time** | ~20–40 minutes per node. 155 nodes ≈ 8–12 weeks solo; far less batched by category |
| **Prerequisites** | None to start. Best value after NDA-002/003 define the contracts to audit *against* |
| **Branch** | commit directly to `cline-dev`, one commit per category |
| **Recommended executor** | 🟢 **Sonnet 5** per node once the protocol is settled; 🟠 **Opus 4.8** for Data and Cloud Services |

## Objective

Read every node in the library once, against a fixed checklist, and record a verdict. The output is
155 filled-in worksheet entries and 155 non-blank `Verdict` cells in
[`NODE-REGISTER.md`](./NODE-REGISTER.md).

## Why this is worth doing, and why it is optional

The calibration is the argument. The first pass swept all 155 *structurally* — ports, signals,
documentation coverage — and read only the 8 nodes Richard named. He then listed 5 more defects from
memory; 4 confirmed immediately, and confirming one of them exposed an entire missing contract
(defect class E, the type dead ends) that the structural sweep had no way to see.

**Five real defects in the next six nodes anyone looked at closely.** If that rate is even roughly
representative, the 142 unread nodes hold a lot. Nobody knows how much, and that is the point: this
task exists to convert an unbounded unknown into a bounded list.

It is optional because nothing else in the phase depends on it, and because the honest expected value
declines as it goes — the first categories audited will find most of what there is to find. **Stop
when the find rate drops**, and say so in `PROGRESS.md`. Do not treat 155/155 as the goal if the last
40 nodes produce nothing; the goal is knowing what is there.

## The protocol

Twelve checks, derived from the six defect classes in [`FINDINGS.md`](./FINDINGS.md). Each is
answered ✅ pass · ⚠️ defect · 🔵 by design, document it · ⬜ not audited.

| # | Check | Class |
|---|---|---|
| A1 | Every mutation path notifies — including mutations from a Function node or workflow | reactivity |
| A2 | An explicit Refresh / re-run input re-reads the source, not a cached copy | reactivity |
| A3 | No change is swallowed: not the first, and not one coalesced away inside a frame | reactivity |
| G1 | `null` clears, `undefined` abstains, neither is coerced to a string or `0` | empty values |
| B1 | If it can fail, it has a Failure/Error output — not just an editor warning | failure |
| B2 | Failure information exists at runtime (deployed, cloud, export), not editor-only | failure |
| B3 | Every signal input has a terminating signal output so downstream can sequence | failure |
| C1 | Every port has a `description` | documentation |
| D1 | No contract matched by bare string without validation | string contracts |
| E1 | Declared port types connect to something; the accurate type is not worse than `*` | types |
| F1 | An implicitly-resolved target can also be named, and the resolution is visible | binding |
| H1 | Survives unmount/remount and delete; its declared SSR compat is honest | lifecycle |

A1, A2 and F1 are frequently `n/a` — most nodes hold no state and target nothing. Mark them `n/a`
rather than ✅; a blanket ✅ makes the register look audited where nothing was checked.

## The worksheets

`node scripts/node-audit/worksheets.js` generates one file per category under
[`audit/`](./audit/), pre-filling every check that the catalog can answer (B1, B3, C1, E1, H1) so
nobody starts from a blank page. **It never overwrites an existing file** — delete one to regenerate.

| Category | Nodes | Audited |
|---|---|---|
| [Data](./audit/data.md) | 46 | 0 |
| [Visual](./audit/visual.md) | 29 | 0 |
| [Cloud Services](./audit/cloud-services.md) | 22 | **22** |
| [Component Utilities](./audit/component-utilities.md) | 8 | **8** |
| [Navigation](./audit/navigation.md) | 8 | **8** |
| [Utilities](./audit/utilities.md) | 8 | **8** |
| [Logic](./audit/logic.md) | 7 | **7** |
| [CustomCode](./audit/customcode.md) | 5 | **5** |
| [Animation](./audit/animation.md) | 4 | **4** |
| [Variables](./audit/variables.md) | 4 | **4** |
| [Cloud](./audit/cloud.md) | 3 | **3** |
| [String Manipulation](./audit/string-manipulation.md) | 3 | **3** |
| [Events](./audit/events.md) | 2 | **2** |
| [Interpolation](./audit/interpolation.md) | 2 | **2** |
| [Math](./audit/math.md) | 2 | **2** |
| [Javascript](./audit/javascript.md) | 1 | **1** |
| [Sensors](./audit/sensors.md) | 1 | **1** |

Variables was filled in first, from the first-pass findings, as the worked example of what a completed
entry looks like. **15 of 17 categories are complete as of 2026-07-30 — 80 of 155 nodes.** The two
remaining are **Data (46)** and **Visual (29)**, which the suggested order below ranks first and
third: the small tractable categories are done, and what is left is the bulk.

**Nothing is blocked.** `Logic Builder` was the last one and was never really blocked — see
[`audit/customcode.md`](./audit/customcode.md) for the misdiagnosis, and §3 of the handover for the
rule it produced: read `git log --oneline -- <path>` before believing any claim about who owns a
file.

## Suggested order

Not by size. By where defects are most likely and most costly:

1. **Data (46)** — the largest category and the one every reported reactivity defect lives in.
   Contains the Array/Collection family, the Repeater, and the Object nodes. Highest expected yield.
2. **Component Utilities (8)** — small, and already known to contain defect class F.
3. **Visual (29)** — Columns, Icon and Text are already known bad; `Layout.size` is shared by all of
   them, so audit the layout helper once and apply the result across the category.
4. **Cloud Services (22)** — 13 of the library's `object`-typed outputs are here, all near-unconnectable.
5. **Navigation (8)** — popups and the component stack.
6. Everything else, smallest first, until the find rate drops.

## Batching, and a warning about it

Auditing a whole category in one pass is much faster than node-by-node, because nodes in a category
share helpers — `modelcrudbase`, `node-shared-port-definitions`, `Layout`, `dbmodelcrudbase`. Read the
helper once, then each node is minutes.

⚠️ **The trap is the same sharing.** A defect in a shared helper is one defect, not 29. Record it once
against the helper and cross-reference it from each node's row, or the register will report a defect
count that is really a usage count, and the phase will look far worse than it is.

## Success criteria

1. Every audited node has all twelve checks marked, with `n/a` used honestly.
2. Every ⚠️ carries a file:line citation. An uncited ⚠️ is a suspicion, and should be marked 🔵 with a
   note saying what would confirm it.
3. `NODE-REGISTER.md` has a non-blank `Verdict` for every audited node; `node scripts/node-audit/register.js`
   preserves those across regeneration.
4. Defects found in shared helpers are recorded once and cross-referenced, not duplicated.
5. `PROGRESS.md` records the running find rate per category, so the stop decision is evidence-based.

## Out of scope

Fixing anything. This task produces verdicts and citations. Anything it finds that is large enough to
need its own work becomes a new NDA task; anything small enough to be obvious gets a line in the
register and waits for a cleanup slice.
