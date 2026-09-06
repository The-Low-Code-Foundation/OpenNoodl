# SM-009 — The first vertical kit

| Field | Value |
|---|---|
| **Tier** | 3 |
| **Effort** | **L+ — slice before starting** |
| **Surface** | `kit`, `templates`, `docs` |
| **Rulings** | 🔴 **D1 — which market?** *"Neither"* is a legitimate answer and closes this task unbuilt |
| **Depends on** | **D1**, SM-001, SM-002, SM-006; SM-005 if the kit is sold; SM-004 for quote documents |

> 📖 **Read the brief for whichever market D1 named** —
> [industrial HMI](research/MARKET-industrial-hmi.md) or
> [configurators](research/MARKET-configurators.md).

## The job

Ship the second market's kit, template and delivery playbook — aimed at **implementers, not end
organisations**.

🔴 **Do not start this task before D1.** It exists to be built once, against a market that survived a
probe designed to kill it. The failure mode this whole phase is designed against is committing to a
vertical and discovering the ceiling afterwards — which the research already did twice on paper
(kiosk upgraded then reversed; the configurator "empty middle" turned out to be an artefact of
comparing Shopify apps to enterprise CPQ, since Roomle publishes a full €100–€1,450/month ladder).

## If D1 names configurators

**The shape**: a kit of option/rule/pricing nodes, a template project, and a written delivery playbook
— sold to the ~90–160 nameable high-intent firms, by name, as a direct-sales motion.

The channel is countable and describes itself. Combeenation's own site: digital agencies *"use our
development platform to develop their own configurators."* Named populations: **8 DriveWorks services
partners** (who demonstrably employ developers — they build plugins against the DriveWorks API),
**13 Combeenation agencies**, **8 camos partners**, **~20–30 CAD VARs with genuine dev practices**
(the entire UK reseller channel is four firms). Economics: a DACH implementer sells at ~€700–1,300/day
against a €10–35k project, so a kit that removes 5–15 build days is worth **€5–20k of margin per
project**.

**Hard constraints, all measured:**

- 🔴 **Stay under the envelope**: ~100 options, ~100 mostly-low-arity rules, "reach a dead end and back
  up" as the stated UX contract. **62% of Renault's rules have no functional direction**; the moment a
  target customer's rule set looks like that, decline the project rather than shipping a graph that
  manufactures invalid states — which is exactly what Kconfig's `select` does, by its own spec.
- 🔴 **2D only. No 3D.** Verified negative: Signomatic ships 55× `fabricJson` and zero "3D"; all five
  trade-print sites zero; Misumi zero; and **Signs.com owns a three.js configurator and emits
  `threeDData = 0`** per SKU. ⚠️ **Discount competitors' "3D" marketing until you have looked at the
  page source** — two of the four packaging firms advertising 3D turn out to mean *a rendered image a
  human sends you after you email a dieline*, not a configurator preview (Refine Packaging: *"dieline
  file. We'll then prepare a 2D and 3D rendering"*; ARKA: *"dieline and send a digital proof"*). The
  gap between what this category says and what it ships is wide, and it is a positioning opportunity.
- 🔴 **The data seam matters more than the rule editor** (SM-006). encoway: *"rules can very often
  already be mapped using standard product characteristics"*.
- ⚠️ **encoway already sells our pitch** — *"non-experts can create product logic easily and
  intuitively"*, *"clicked together by drag-and-drop"*. Being better is necessary, not sufficient.
- ⚠️ **Half the ecosystem is hostile.** Elfsquad sells explicitly *against* consultants and custom
  code — *"your knowledge stays yours, not locked away in consultants"*. The playbook is the thing
  they are beating.

## If D1 names industrial HMI

**The shape**: a dashboard/HMI kit and template aimed at Ignition integrators, positioned as the
operator-facing layer over data that already exists — never as a SCADA or protocol product.

- 🔴 **SM-001's answer defines the scope.** If the probe said the app must speak OPC-UA/Modbus, this
  task does not exist.
- 🔴 **Node-RED is free, flow-based, and pre-loaded on Opto 22 controllers.** The pitch must survive
  the question *"why not the thing already on the box?"* — and the honest answer has to be about the
  produced app, not the editor.
- ⚠️ **On-prem and air-gapped is a strength here**, not a constraint: static React deploys fine.

## Acceptance criteria (either market)

1. **Aimed at the implementer, and the playbook says so.** Time-to-deliver against a named baseline,
   client handoff, and what the implementer keeps. Not a features page.
2. **Built on the existing surfaces** — P69's kit contract, plain files, all four gate registrations
   plus the lockfile. If we need core changes to build a vertical, the claim that a user could have
   built it is false.
3. **The envelope is enforced by the product, not the docs.** Where a rule set exceeds what the graph
   can honestly express, the tooling says so at author time. 🔴 Silent partial support is the Kconfig
   failure.
4. **A real project, from a real implementer's real brief**, end to end — the caller and the
   regression fixture.
5. **Priced per D5**, and if sold, entitled per SM-005.
6. **A named first customer before the kit is finished.** The channel is small enough to name
   individually; building for an unnamed one is how this task becomes shelfware.

## Traps

- 🔴 **Do not lead with the authoring capability** (P2, and the phase's operating rule). Every market
  examined either absorbs authoring into whoever owns the outcome or cedes it to agencies who charge
  for content.
- 🔴 **Slice before starting.** L+ means this is not one task; a session that opens it without a slice
  plan will produce a half-kit.
- ⚠️ **If D1 said "neither", this phase closes cleanly at eight tasks.** That is a success, not a
  failure — the Tier 1 capabilities stand on their own and the Tier 0 probes cost two sessions.
