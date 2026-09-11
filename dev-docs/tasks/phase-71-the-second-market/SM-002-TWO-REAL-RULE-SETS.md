# SM-002 — Two real rule sets

| Field | Value |
|---|---|
| **Tier** | 0 |
| **Effort** | S/M |
| **Surface** | research, `runtime` (a throwaway harness only) |
| **Rulings** | Feeds **D1**. Shapes SM-006's schema |
| **Depends on** | Nothing. Run with SM-001, first |

> 📖 **Read [research/MARKET-configurators.md](research/MARKET-configurators.md) first** — what a
> configurator is, the three price tiers, who actually builds them, the measured ceiling, and why the
> incumbent is a PIM rather than a CPQ.

## The job

Decide whether the configurator market sits **under or over** the measured expressiveness ceiling —
using two real manufacturers' rule sets, not a hypothetical.

The ceiling is already measured and is not in dispute. The **Renault Mégane** benchmark (CLib, 26 MB,
195,298 lines) was parsed and every rule tested: **70 of 113 (62%) have no functionally determined
variable in any direction**, and **44 of the 68 high-arity rules have none**. Those are relations; a
dataflow node needs an input side and an output side. Faking them costs ~700 one-step-deep filter
nodes.

**What is genuinely unknown is whether a mid-market configurator looks like that.** Renault is a car
with 101 variables and industrial-strength constraint modelling behind it. A conveyor with 12 belt
widths, 6 drive options and 4 frame materials may be almost entirely forward-propagating. The whole
market thesis rests on the answer.

So: **obtain two real option matrices** — from a published product catalogue, a spec sheet, an
inspectable live configurator's client payload, or (best) a manufacturer willing to share one — and
measure them the same way Renault was measured.

**Target segments**, chosen because 3D is a verified negative there and rules dominate: industrial
machinery, conveyors and materials handling, electrical enclosures, fluid handling, HVAC components,
windows and doors.

## Acceptance criteria

1. **Two rule sets from two different manufacturers**, with provenance recorded — where each came
   from, when, and whether it is complete or a published subset. A subset is acceptable if labelled.
2. **The same measurement applied as to Renault**: variable count, rule count, arity distribution,
   and — the deciding number — **the proportion of rules with no functionally determined variable**.
   Report the method so the number is reproducible.
3. **A verdict against the pre-registered envelope** (~100 options, ~100 mostly-low-arity rules, with
   "reach a dead end and back up" acceptable). State the threshold *before* measuring.
4. **A throwaway harness, not a product.** Express one of the two rule sets as an actual node graph
   and drive it. The AC is the *count of nodes required* and whether the resulting UX is one a buyer
   would accept — not that it renders.
5. **The dead-end experience is described honestly.** Pick a selection order that leads to an
   impossible state and record what the user sees. If the answer is "nothing — the option is still
   offered and fails later", that is the finding.
6. **A stated data-shape recommendation for SM-006**: what the import format has to carry. This task
   is SM-006's requirements-gathering whether or not the market survives.

## Traps

- 🔴 **The Excel premise is only half-verified, and the half that matters is the weak half.**
  Job-shop *estimating* on spreadsheets is abundantly evidenced. Product *option configuration* on
  spreadsheets is not — roughly five clean primary instances across 307 posts, and those
  practitioners reach for a **PIM** (Akeneo, Pimcore, Airtable). **The incumbent to displace is a PIM
  plus a spreadsheet, not a CPQ.** Do not let this task quietly re-assume the CPQ framing.
- 🔴 **Drop "the person who built the spreadsheet left"** — hunted across four routes, zero primary
  support, it is vendor marketing. The real pattern is that these sheets are *borrowed and unowned*.
- 🔴 **A published catalogue matrix is not the rule set.** Catalogues show valid combinations;
  configurators encode why the invalid ones are invalid. Note which you actually obtained — an
  extensional table of allowed tuples *is* a legitimate answer, and is exactly what Renault turned
  out to be.
- 🔴 **Live configurators are mostly unreachable** — Tesla 403, igus/Dorner behind logins,
  Grundfos/Interroll/VELUX/Rittal dead or 403. Budget for that; a public spec sheet may be the
  realistic source.
- ⚠️ **encoway already sells our pitch**: *"even non-experts can create product logic easily and
  intuitively"*, *"clicked together by drag-and-drop"*. A node graph is a genuine improvement over
  Combeenation's statically typed Hive DSL and camos Develop — but it is **not a differentiated
  claim**. If this task concludes "the graph is better", that is necessary and not sufficient.
- ⚠️ **This probe is designed to return negative.** Pre-register the threshold and honour it.
