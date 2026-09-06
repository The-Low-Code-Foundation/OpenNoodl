# Phase 71 — The Second Market

**Created:** 2026-08-18, out of a market-research exercise with Richard (*"what other areas of
professional software could we target, and where could we sell training?"*). **Prefix:** `SM`.
**Surfaces:** `runtime`, `editor`, `kit`, `catalog`, `docs`, `platform`.

> **The concept, in one sentence.** eLearning is the first market; this phase finds and equips the
> second — but it starts from the finding that **the single highest-value action is not a market at
> all**, and that every market candidate must be *disproved cheaply before it is built for*.

**📁 The research lives in [`research/`](research/README.md) — read it before the tasks.** One brief
per market, written to be understood from zero: what the market actually is, what they use today, what
it costs, who buys, where NodeGX fits, what a project would concretely look like, and what would kill
it. Plus [REJECTED-MARKETS.md](research/REJECTED-MARKETS.md) (the twenty that failed, each with its
deciding fact) and [THE-TRAINING-BUSINESS.md](research/THE-TRAINING-BUSINESS.md) (the monetisation
evidence).

**Formatted report for reading and sharing:**
<https://claude.ai/code/artifact/c3f5ff4b-1360-43dd-bbde-08da8f7be224>
(26 markets, primary sources, dated 2026-08-18).

---

## 1. What the research actually found

Twenty-six markets were tested against primary sources — SEC filings, Danish and Swedish company
registries, gov.uk, eCFR, EUR-Lex, the FCA Handbook, TED and USAspending procurement APIs, the CLib
configuration benchmark library, and vendor pricing pages and APIs.

**Three findings drive this phase.**

### F1 — One rendering defect blocks four markets simultaneously

Accessibility is the binding constraint in **UK public sector, US state and local government, NHS
non-device work, and EU e-commerce**. The GOV.UK service manual names, as WCAG 2.2 AA requirements,
making it *"easy for keyboard users to see the item their keyboard or assistive technology is
currently focused on"* and ensuring *"your code lets assistive technologies know what every user
interface component is for"*. Those are not near-misses against adjacent criteria — they are
**precisely the two things this runtime fails** (one ARIA attribute in the whole package, zero
`role=`, nine `outline: none`).

This is [Phase 41](../phase-41-accessibility/README.md)'s work and **this phase does not duplicate
it**. What this phase adds is the artefact that turns the fix into a *sale*: a conformance report
(SM-003). Phase 41 specs ACC-001..ACC-022 and owns none.

### F2 — "A better authoring tool" is not a defensible position anywhere

Six of the first eight markets died for the same reason: **the technical barrier is low, which reads
as opportunity and is actually the problem**. A conformant Veeva CLM package is `index.html` plus a
thumbnail in a zip — it has been that easy for fifteen years. Nobody failed to cross it. The
incumbents won on relationships, process integration and offshore cost bases.

Authoring, examined across markets, either gets **absorbed** by whoever owns the outcome (AI-roleplay
vendors now bundle it; Veeva ceded it) or **ceded to agencies** who charge for content instead
(property CGI, exhibit builds). Both ends are someone else's business.

> **The operating rule for this phase: never lead with the authoring capability. Lead with what the
> output *is* — a real app with a database — and ship the interop quietly as the price of entry.**

### F3 — Two markets survive, and both need a cheap disproof before any build

| Market | Why it survived | The question that decides it |
|---|---|---|
| **Industrial HMI / dashboards** | Highest verified price floor found anywhere: Ignition **Perspective $11,225, Vision $8,330, perpetual, unlimited users**, with an integrator programme *ranked by resale revenue*. Triggers **none** of our capability gaps. | Does the operator-facing app have to speak OPC-UA/Modbus itself, or does process data already land in MQTT/historian/SQL? ⇒ **SM-001** |
| **Product configurators — as a kit for implementers** | Rule authoring is genuinely an *engineering* job (camos runs a 4-day "Modeller Training"; Combeenation's Hive is a statically typed DSL; live job ads require reading engineering drawings and BOMs). Channel is ~90–160 **nameable** firms. 3D is a **verified** negative. | Do two real manufacturers' rule sets fit under the measured expressiveness ceiling? ⇒ **SM-002** |

Two further markets are **qualified but not scheduled here**: insurance/adviser intermediary tools
(Dynamic Planner publishes £60–179/adviser/month; FCA **PERG 5.8.22** makes the decision tree itself
the regulated artefact — the one place a legible graph is a genuine argument) and associations
(Wild Apricot pays **10% for two years and routes leads**). Both are behind SM-003 and SM-004.

### The measured ceiling — the number that bounds SM-002 and SM-009

The **Renault Mégane** configuration model (CLib, 26 MB, 195,298 lines) was parsed first-hand and
every rule tested for whether any variable is functionally determined by the others:

- **70 of 113 rules (62%) have no functionally determined variable in any direction.** They are
  *relations*; a dataflow node needs an input side and an output side.
- **44 of the 68 high-arity rules have none at all.**
- Size is **not** the wall — 195k tuples is a few MB of JSON. **Shape is.**
- Faking relations with filters costs **~700 nodes for 113 rules**, each only one step deep.

**Linux Kconfig is the twenty-year natural experiment.** Its own specification admits `select` forces
values *"without visiting the dependencies"*, producing *"illegal configurations all over"* — 74 live
instances counted across 15 subsystem files. ConfigFix measured the human cost: a fifth of surveyed
users spent tens of minutes on conflicts they were never shown the cause of.

> **Honest operating envelope: ~100 options, ~100 mostly-low-arity rules, in a product where "you can
> reach a dead end and must back up" is an acceptable UX contract.** Beyond that — free selection
> order over high-arity relations, "can this partial configuration still be completed?", explaining
> *why* an option vanished, cheapest-valid-configuration (NP-hard even over a compiled MDD) — it
> stops being honest. The upgrade path the literature validates is **compile offline to a BDD and
> ship the artefact**, which a dataflow graph can consume as a node without ever learning to search.
> That is a credible v2 and is explicitly out of scope here.

---

## 2. The three principles

Acceptance criteria, not sentiment.

**P1 — Disprove before you build.** Every market task in Tier 3 is gated on a Tier 0 probe that can
*kill* it for the price of a session. A task that starts building a vertical before its probe has
reported has failed P1. The probes are designed to come back negative; that is their job.

**P2 — Build the capability, not the vertical.** SM-003 (conformance), SM-004 (documents), SM-005
(entitlement) and SM-006 (data-in) each unlock **more than one** market and are worth doing even if
every vertical is abandoned. Anything that only serves one market waits behind its probe.

**P3 — The channel is the customer.** In every surviving market the buyer of the *tool* is a delivery
firm — an integrator, an implementation shop, a small studio — not the end organisation. Combeenation
describes this buyer verbatim: agencies *"use our development platform to develop their own
configurators"*. Pricing, packaging and docs are aimed there. ⚠️ **But the kiosk downgrade is the
counter-case and must be read before assuming it generalises** (§3).

---

## 3. What was rejected, and the one that reversed

**Kiosk / signage / exhibits was upgraded then downgraded**, and the reversal is the most instructive
result in the research. Four independent methods agreed:

- Four exhibition design practices, **218 named staff, zero software developers** (Atelier Brückner
  hired 21 named disciplines and skipped software engineering).
- Five AV integrators, **237 open requisitions, zero application-development roles**. Across 162
  AVI-SPL descriptions: `react` 0, C#/.NET 0, `crestron` 40.
- UK public procurement shows **two entirely separate supplier tiers with zero overlap** — design
  firms and production studios never bid for each other's work.
- Intuiface's own marketing is written for firms without developers: *"Lack the time, headcount or
  desire to create your own interactive content?"* / *"no developers needed"*. Diversified, a top-two
  global integrator, adopted it specifically to *"streamline a content delivery process formerly
  dependent upon custom coding"*.

**The squeeze, precisely: the no-code half appeals to firms that have no developers — who want
finished work, not a tool — while the real-React half appeals to developers, who already write React
by hand and whose differentiated skill is Unity/Unreal/TouchDesigner.** It competes with the agency
for the work while depending on the agency's staff to adopt the tool. Scale confirmed it: UK museum
interactive software totalled **£6.1m across 40 awards over twelve years**.

**Read P3 against this.** "Sell to the delivery layer" is a hypothesis that held in configurators
(engineers author rules) and failed in kiosk (the budget-holders employ nobody who would operate a
builder). **SM-001 and SM-002 both test the same underlying question for their own market: is there
somebody there who would actually use this?**

Also rejected, each on one deciding fact: pharma CLM · field capture · demos and digital adoption ·
legal automation · clinical EDC · property (twelve housebuilders across two countries, **zero
third-party selector vendors** — all bespoke in-house, and a development's CGI package exceeds the
annual software licence) · interactive calculators (billed in *impressions*, *visits* and *leads* —
an advertising category) · trades estimating (quoting bundled at every entry tier; offline, camera,
PDF and e-signature all mandatory) · franchise ops (Bindy's homepage names four of our five gaps in
one sentence) · internal tools · government · events · NGO field data · client portals · sports ·
branching video.

---

## 4. Prior-art reconciliation — read before starting anything

Four phases own adjacent ground. **This phase defers to all four and duplicates none.**

| Phase | Owns | This phase's relationship |
|---|---|---|
| **[P41 Accessibility](../phase-41-accessibility/README.md)** | ACC-001..ACC-022 — the renderer fix itself: focus rings, `<a>` as anchor, operable Group, route announcement, document shell, semantic defaults, the rule set, the agent's knowledge | 🔴 **SM-003 is blocked on P41 and must not re-spec any of it.** SM-003 produces only the *conformance report*, which P41 does not own. If P41 is not moving, escalating it is D4's decision — not this phase's licence to fork it. |
| **[P69 Custom nodes](../phase-69-the-node-you-write-yourself/)** | The kit substrate, packaging, install routes, the catalog | SM-005 (entitlement) and SM-009 (a vertical kit) sit **on top of** P69's contract. 🔴 CN-012 binds: **no kit nodes server-side**. |
| **[P70 The course is an app](../phase-70-the-course-is-an-app/README.md)** | eLearning: the learning kit, templates, SCORM, the LMS starter | Sibling, not competitor. P70 is the *first* market. SM-007's partner ladder and SM-008's pricing posture apply to both; a conflict between them is D3's to resolve. |
| **[P20 Ecosystem](../phase-20-ecosystem/)** | ECO-002 Marketplace, ECO-004 Hosted Platform — both **gated Horizon-3 specifications** requiring an explicit commercial decision | 🔴 **SM-005 is deliberately narrower than ECO-002.** It builds an *entitlement primitive* (can this project use this kit?), not a marketplace, not payments, not hosting. If D2 says "we are not selling kits", SM-005 is cut, not descoped into ECO-002. |

Also relevant: **[P53 Trust & Compliance](../phase-53-trust-and-compliance/README.md)** already
documents the backend's per-record ACL, roles, scoped API keys and audit trail — which is why access
control is *not* a gap in any market above, and should not be re-litigated here.

---

## 5. The rulings queue (Richard — one sitting; D1 and D4 block Tier 3)

| # | Ruling | Why it blocks | Recommendation |
|---|---|---|---|
| **D1** | **Which market do we commit to after Tier 0 reports?** Industrial HMI, configurators, both, or neither. | Blocks SM-009 entirely. Both probes can return negative; "neither" is a real and acceptable answer. | Decide **after** SM-001 and SM-002, not before. Committing early is the failure mode this phase exists to prevent. |
| **D2** | **Do we sell kits at all?** | Blocks SM-005. If kits are always free, entitlement is dead work and the channel model changes shape. | Lean yes — SM-009's whole premise is that a kit is a product. But it is a commercial decision, not a technical one. |
| **D3** | **Do we want a channel business, or direct sales?** | Blocks SM-007. A partner ladder is a permanent operational commitment (cf. ECO-004's warning). | Lean channel — every surviving market's buyer is a delivery firm. But start with the credential, not the commission. |
| **D4** | **Is the accessibility fix escalated?** P41 is specced and unstarted. | Blocks SM-003, and through it insurance and associations. | Escalate. It is one defect blocking four markets and it is the only investment on this page that pays off more than once. |
| **D5** | **Pricing posture — publish or quote?** | Blocks SM-008. | Publish. Intuiface, Poppulo, PADS4, encoway, camos, Zoovu, Sofon and every property vendor are quote-only. Publishing a real number is a differentiator that costs nothing. |
| **D6** | **Do we act on the insurance/adviser finding at all?** It is the one market where the node graph has a *regulatory* argument (PERG 5.8.22), but entry needs SOC 2 and PDF generation. | Nothing in Tier 0–2; would become a Tier 3 sibling of SM-009. | Defer. Revisit once SM-003 and SM-004 land. |

---

## 6. Instruments that lied during this research — carry these forward

Recorded here because they will bite the next person who tries to size a market.

- 🔴 **Contracts Finder's OCDS `keyword` parameter is accepted and silently discarded.** A nonsense
  control returned a **byte-identical** release set to a real query — 100/100 overlap on extracted
  IDs. Reproduced independently by two agents. **Find a Tender rejects `keyword` outright (400).**
  ✅ TED v3 and USAspending *do* filter (nonsense → 0 results).
- 🔴 **freelancermap's `query=` is a no-op** — nonsense, "SAP" and "CPQ" all returned an identical
  `12.936 Projekte`.
- 🔴 **LinkedIn's guest API has no zero state** — always exactly ten cards. "Combeenation" returned a
  handyman; "encoway" a concrete engineer.
- 🔴 **Reddit is reachable only via `.rss`** (JSON 403s, proxies 403/429), and throttles at ~40
  requests.
- ✅ **Always run a nonsense-query control before trusting a search endpoint.** Two routes were
  abandoned on this basis rather than reported.
- 🔴 **An empty result from a killed process is not a measured absence.** This nearly produced a false
  negative during the research: a grep job was killed mid-run, its last two section headers came back
  blank, and the blanks read exactly like "this vendor does not use 3D". The classification survived
  only because the same thing had been measured independently by another method. ✅ **Reconcile a
  run's exit status against its output before reading any absence from it** — and prefer an absence
  asserted beside a known-firing signal in the same run.
- 🔴 **Every analyst market forecast in these categories is unusable.** CPQ CAGR estimates span
  6.71%–20.9% with one publisher contradicting itself year-over-year; two houses differ 67% on 2026
  digital signage; eLearning authoring shows an 8.2× spread on one base year. **Use statutory
  filings** — Configit's gross profit fell 26.8%, Tacton is a $47M company with 104 staff.
- 🔴 **Drop "the person who built the spreadsheet left and nobody understands it"** from any pitch.
  Hunted across four independent routes: **zero primary support**. It is Configure One marketing. The
  real pattern is the opposite — the sheets are borrowed and unowned (*"an excel spreadsheet that was
  given to me by another shop owner"*).

---

## 7. Suggested order

1. **SM-001 and SM-002 first, in parallel, before anything else.** They are cheap, they are designed
   to kill their own markets, and D1 cannot be answered without them.
2. **SM-003 → SM-004 → SM-006** — the market-agnostic capabilities, in that order. SM-003 is behind
   P41 and may be the long pole; SM-004 unblocks the most markets per unit of work.
3. **SM-005 and SM-007** only after D2 and D3.
4. **SM-008** any time after D5 — it is a docs-and-pricing task, not an engineering one.
5. **SM-009 last**, and only if D1 named a market.
