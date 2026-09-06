# SM-006 — The data-in seam

| Field | Value |
|---|---|
| **Tier** | 1 |
| **Effort** | M |
| **Surface** | `editor`, `backend` |
| **Rulings** | none |
| **Depends on** | SM-002 (its AC6 delivers the required data shape) |

## The job

Let a project **import a product catalogue or option matrix** — from CSV, a PIM export, or an ERP
extract — into project data that a graph can drive, and re-import it when the source changes without
rebuilding the graph.

**Why this and not a better rule editor.** The research reversed the obvious priority. The incumbent
a mid-market configurator displaces is **a PIM plus a spreadsheet, not a CPQ** — practitioners with
option-matrix problems reach for Akeneo, Pimcore and Airtable, and three independent voices in one
thread converged on exactly that. And encoway, the DACH category specialist with 25 years and 300+
staff, states it plainly:

> *"Configuration rules can very often already be mapped using standard product characteristics"* —
> while the real burden is *"a clean and comprehensive database… and high-quality texts, images and
> documents"*.

Zoovu prices on **catalogue size and complexity**, not rule complexity, and bundles "Product Data
Enrichment" with every plan. Combeenation's implementation runs **€10k–100k against a €697/month
licence** — the data and integration work *is* the project.

So the rules layer, which is our natural strength, is the cheap part of somebody's job. The data seam
is the expensive part, and we have nothing.

**Scope.** Import, map, refresh, and a legible failure when the source changes shape. Not a PIM. Not
enrichment. Not ERP write-back.

## Acceptance criteria

1. **A CSV or spreadsheet of options and constraints imports into project data** and is addressable
   from a graph without hand-transcription.
2. **Re-import is non-destructive to the graph.** A changed source updates the data; it does not
   orphan the nodes reading it. This is the property that makes the seam worth building.
3. **A shape change is a loud, specific error** naming the column and the row — not a silent
   truncation. 🔴 Intuiface's Excel asset *"will not display content after 10 empty rows"*; a gap in a
   spreadsheet silently truncating a product catalogue is precisely the failure to design against.
4. **Scale is stated and tested.** Import a catalogue at least an order of magnitude larger than the
   demo, record where it degrades, and write the ceiling down. 🔴 The backend is **SQLite**; large
   multi-tenant product data was named a fatal gap in guided selling, and this AC is where that gets
   measured rather than assumed.
5. **The mapping is inspectable and diffable** — plain files, reviewable in a pull request, like the
   rest of a project.
6. **Build the caller**: SM-002's real rule set imports end-to-end and drives a working configurator
   graph. If SM-002 returned negative, use its data anyway — the seam outlives the market.

## Traps

- 🔴 **Do not build a PIM.** Enrichment, media, localisation and workflow are somebody else's product
  and a decade of work. The seam is import, map, refresh.
- 🔴 **The count identity trap.** A round-trip that preserves row counts is not a round-trip that
  preserves meaning. Assert on values, never on totals.
- 🔴 **Per-connection and per-row fields get dropped by clone *and* by zod** (recorded in P69's
  lineage). Any import that survives a count check can still lose fields silently.
- ⚠️ **This task is worth doing even if D1 says "neither".** Every data-driven vertical wants it, and
  P70's quiz-bank-as-rows already depends on the same idea. It is a Tier 1 capability precisely
  because it is not hostage to a market verdict.
