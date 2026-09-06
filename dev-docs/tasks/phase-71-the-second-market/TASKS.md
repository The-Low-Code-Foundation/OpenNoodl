# Phase 71 — the tasks (SM: the second market)

**Created:** 2026-08-18 out of [README.md](README.md). Read the three principles first — **P1**
disprove before you build; **P2** build the capability, not the vertical; **P3** the channel is the
customer, *with the kiosk counter-case attached*. All three are acceptance criteria.

> 🔴 **Read [README §4 Prior-art reconciliation](README.md) before starting any task.** Four phases
> own adjacent ground. One-line version: **P41 owns the accessibility fix itself — SM-003 adds only
> the conformance report and must not re-spec ACC-001..022**; **P20's ECO-002 owns "marketplace" —
> SM-005 is deliberately narrower and is cut, not merged, if D2 says no**; P69 is the kit substrate
> and its **CN-012** binds (no kit nodes server-side); P70 is the *first* market and a sibling.

> ⚠️ **The rulings queue (README §5, D1–D6) is OPEN.** **D1 blocks SM-009 entirely and must be
> answered *after* Tier 0, not before.** D4 blocks SM-003. D2 blocks SM-005. D3 blocks SM-007. D5
> blocks SM-008.

**Tiers:** 0 = probes that can kill a market · 1 = capabilities that unlock several markets ·
2 = the channel · 3 = the first vertical.

**Effort:** S ≈ a session · M ≈ 2–3 · L ≈ a week+ · L+ ≈ needs slicing before it starts.

| Task | One line | Surface | Tier | Effort | Depends on / must honour |
|---|---|---|---|---|---|
| **[SM-001](SM-001-THE-PROTOCOL-QUESTION.md)** ⭐ | **The protocol question.** Does an industrial operator-facing app have to speak OPC-UA/Modbus itself, or does the data already land in MQTT/historian/SQL? Sample the Ignition integrator directory and count. **Designed to return negative.** | research | **0** | S | none — **first, with SM-002**. 🔴 Node-RED is pre-loaded on Opto 22 controllers; if protocol support *is* the product, this market collapses |
| **[SM-002](SM-002-TWO-REAL-RULE-SETS.md)** ⭐ | **Two real rule sets.** Obtain two actual manufacturers' option matrices and test them against the measured ceiling (~100 options, ~100 low-arity rules). **Designed to return negative.** | research / runtime | **0** | S/M | none — **first, with SM-001**. 🔴 62% of Renault's rules have no functional direction; the test is whether *real mid-market* rule sets look like that or not |
| **[SM-003](SM-003-THE-CONFORMANCE-CLAIM.md)** ⭐ | **The conformance claim.** An honest, publishable accessibility conformance report for generated apps. **P41 fixes the renderer; this turns the fix into a sellable artefact.** | docs / runtime | **1** | M | **P41 (ACC-001..022)**, D4. 🔴 Must not re-spec P41. 🔴 A report written against today's runtime would be false — the AC is *truthful*, not *favourable* |
| **[SM-004](SM-004-THE-DOCUMENT-NODE.md)** | **The document node.** Server-side PDF generation as a first-class node. Table stakes in insurance, portals, quoting, exhibits and eLearning certificates. | runtime / backend | **1** | M | 🔴 **CN-012: no kit nodes server-side** — this is a built-in or a backend capability, never a kit node |
| **[SM-005](SM-005-A-KIT-CAN-BE-SOLD.md)** | **A kit can be sold.** An entitlement primitive: can *this project* use *this kit*? Not a marketplace, not payments, not hosting. | kit / catalog / editor | **1** | M | **D2**. 🔴 Deliberately narrower than **ECO-002**; if D2 says no, **cut it, do not merge it** |
| **[SM-006](SM-006-THE-DATA-IN-SEAM.md)** | **The data-in seam.** Import a product catalogue / option matrix from PIM, CSV or ERP into project data. **The configurator's real incumbent is a PIM plus a spreadsheet, not a CPQ.** | editor / backend | **1** | M | SM-002's findings shape the schema. 🔴 encoway: *"rules can very often already be mapped using standard product characteristics"* — the data is the burden, not the rules |
| **[SM-007](SM-007-THE-PARTNER-LADDER.md)** | **The partner ladder.** Odoo-shaped: certified-staff counts gate tiers, commission includes renewals, the credential version-decays. **The ladder is the product; the exam is the toll gate.** | platform / docs | **2** | L | **D3**, and SM-005 if tiers gate kit access. 🔴 A permanent operational commitment — read ECO-004's warning first |
| **[SM-008](SM-008-THE-PUBLISHED-PRICE.md)** | **The published price.** Publish real numbers where every incumbent is quote-only. A differentiator that costs nothing but a decision. | docs | **2** | S | **D5**. Coordinate with P70 — one pricing posture, not two |
| **[SM-009](SM-009-THE-FIRST-VERTICAL-KIT.md)** ⭐ | **The first vertical kit.** Whichever market D1 named, as a kit + template + delivery playbook aimed at implementers. | kit / templates / docs | **3** | **L+** | **D1**, SM-001/002, SM-006, and SM-005 if sold. **Slice before starting.** 🔴 Do not start before D1 |

---

## Suggested order

1. **SM-001 and SM-002 together, immediately.** Both are single-session research tasks whose purpose
   is to *fail fast*. Until they report, D1 is unanswerable and SM-009 is forbidden.
2. **SM-003** — behind P41, likely the long pole, and it gates two further markets (insurance,
   associations) that are not otherwise scheduled.
3. **SM-004**, then **SM-006** — the two capabilities with the widest reach per unit of work.
4. **SM-005** and **SM-007** after D2 and D3. **SM-008** any time after D5.
5. **SM-009** last, and only if D1 named a market. *"Neither"* is a legitimate answer to D1 and this
   phase closes cleanly at eight tasks if that is the ruling.

## The failure mode this phase is designed against

Committing to a vertical because it sounded good, then discovering the ceiling afterwards. The
research already produced two examples of exactly that — kiosk was upgraded on pricing evidence and
then reversed on headcount evidence, and the configurator "empty middle" turned out to be an artefact
of comparing Shopify apps to enterprise CPQ (Roomle publishes a full €100–€1,450/month ladder).
**Tier 0 exists so the third example happens on paper instead of in code.**
