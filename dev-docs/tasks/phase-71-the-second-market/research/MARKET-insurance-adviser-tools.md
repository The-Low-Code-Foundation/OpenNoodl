# Market brief — Insurance and financial-adviser tools

**Researched 2026-08-18.** Status in [Phase 71](../README.md): **qualified, not scheduled.** Behind
[SM-003](../SM-003-THE-CONFORMANCE-CLAIM.md) and [SM-004](../SM-004-THE-DOCUMENT-NODE.md); revisit at
ruling **D6**.

---

## 1. What this actually is

Two different things sit under this heading and they have very different economics.

**The enterprise core.** A general insurer or an MGA (Managing General Agent — a firm that
underwrites on an insurer's behalf) runs a *policy administration system*: the software that holds
products, rates, policies, claims, renewals, documents and regulatory reporting. INSTANDA, Socotra,
EIS, Acturis, Open GI. These are multi-year, multi-million-pound platform replacements.

**The intermediary layer.** Underneath, there are thousands of smaller regulated firms — insurance
brokers, IFAs (Independent Financial Advisers), mortgage brokers, employee-benefit consultants — who
need customer-facing and adviser-facing *journeys*:

- A quote-and-buy flow on a broker's website
- A risk-profiling questionnaire that produces a customer's attitude-to-risk score
- A fact-find that captures a client's circumstances before advice is given
- A suitability report — the document explaining *why* this product was recommended
- An eligibility or triage flow ("can we even cover this?")

**That second layer is the market.** It's small, regulated, and — unusually — publishes prices.

---

## 2. What they use, and what it costs

### The enterprise core publishes nothing. Six for six.

| Vendor | Pricing page |
|---|---|
| INSTANDA | `/pricing` **404** |
| Socotra | `/pricing` **404** |
| EIS Group | `/pricing` **404** |
| Novidea | page exists, **zero numbers** |
| Acturis | none (850 partners, £18.5bn premium/yr in the UK) |
| Open GI | none (600+ customers, *"over 150 solution providers"*) |

**Unanimity across six independent vendors is a structural fact, not a sampling artefact.** This is a
sales-led, RFP-and-implementation business. INSTANDA's headline claims are *implementation
timescales* — "8 weeks to launch 30 products", "same-day form and rate changes" — and when a vendor
advertises how fast the *project* goes, the project is the product.

**We are not entering that.** The moat is procurement, reference logos and vendor due diligence, not
technology.

### The adviser layer does publish — and this is the finding

**Dynamic Planner** (risk profiling and cash-flow planning for IFAs), read from its own page:

| Tier | Price |
|---|---|
| Profiling | **£60 per adviser per month** (discounted from £80) |
| Review | **£124 per adviser per month** |
| Review Plus (adds cash-flow planning) | **£179 per adviser per month** |
| Tram | £8 per client per year |
| Setup | **£130 per adviser, one-off** |

A transparent, per-seat, mid-market price with **no visible race to the bottom** — which almost
nothing else in the 26-market study can say.

---

## 3. The regulatory bit — and why it's the *reason* to be interested

This is the one market in the entire study where the node graph has an argument that isn't about
developer taste. It comes from the FCA Handbook, read directly.

**PERG 5** is the FCA's guidance on what counts as regulated insurance distribution. Three passages
matter:

> **PERG 5.8.21(6)** — advice can be given *"through the provision of an **interactive software
> system**"*. The medium is explicitly enumerated alongside face-to-face and telephone.

> **PERG 5.8.22** — *"the use of **electronic decision trees** does not present any novel problem.
> **The same principles apply as with a paper version.**"*

> **PERG 5.8.18(2)** — pre-purchase questioning that *"lead[s] to the identification of one or more
> particular contracts of insurance"* crosses from generic information into regulated **advice**.

Put together: **when a firm builds a decision flow that routes a customer to a named product, that
decision logic *is* the regulated act.** Not the software vendor — the *firm* is authorised, not us
— but the logic they run is the thing the regulator examines.

**And that has a practical consequence.** A compliance officer must be able to read, approve, and
later *defend* that logic to the FCA. Incumbents express it in configuration screens, rate tables and
spreadsheets — formats that are hard to review as a whole and impossible to diff.

**A node graph is a legible, reviewable, version-controlled artefact of exactly the thing the
regulator cares about.** That is a genuine, articulable advantage, and it is the only place in 26
markets where one was found.

### The honest caveat

**The buyer of record is procurement, not the compliance officer.** Under SYSC 8.1 an authorised firm
*"remains fully responsible for discharging all of its obligations"* when it outsources, and must
exercise *"due skill and care and diligence"* in selecting a provider, monitor performance, and retain
the ability to terminate immediately. In practice that means: **they will ask for SOC 2 and ISO 27001
before they ask about rule authoring.** The advantage is real, and it is second in the buying order.

*(EU equivalent: IDD Article 2(1)(1) explicitly captures website journeys where a customer selects by
criteria and can conclude a contract — so the same logic applies across the EEA.)*

---

## 4. Where NodeGX fits, and what's missing

### What a project would look like

*Illustrative.* A mid-size broker wants a commercial-combined quote journey on their site.

- A multi-step fact-find: trade, turnover, premises, claims history, cover levels.
- Eligibility and referral rules — some risks are declined, some route to a human underwriter.
- Rating: premium calculated from the answers, with the workings inspectable.
- Output: a quote summary PDF, an IPID (Insurance Product Information Document), and a record of
  exactly which version of the decision logic ran, for the audit file.
- Roles: adviser view versus customer view; supervisor approval on referred cases.

NodeGX's existing per-record ACL, roles, scoped API keys and audit trail — already built, per
[Phase 53](../../phase-53-trust-and-compliance/README.md) — are genuinely well-suited to the audit
requirement.

### What's missing, and it's not small

| Requirement | Status |
|---|---|
| **PDF generation** | ❌ **Absent.** Quote summaries, IPIDs, suitability reports are *mandatory regulated artefacts*. Covered by [SM-004](../SM-004-THE-DOCUMENT-NODE.md) |
| **Accessibility conformance** | ❌ **Absent.** A Consumer Duty firm will require it of a customer-facing journey. Covered by [SM-003](../SM-003-THE-CONFORMANCE-CLAIM.md) — which is itself behind Phase 41 |
| **SOC 2 Type 2 / ISO 27001** | ❌ Not in scope anywhere. This is an organisational programme, not a feature — months and real money |
| **Immutable rule versioning** | ⚠️ Partial. Plain-file projects are diffable, which is a good start; "which version ran for this quote" needs designing |
| **E-signature** | ⚠️ Likely needed, unverified |
| Offline / camera / GPS | ✅ Not required |

**That's why this market is qualified but not scheduled.** Two Tier-1 capabilities have to land first,
and the third (SOC 2) is a business decision nobody has taken.

---

## 5. The channel

**Open GI connects its 600+ broker customers to *"over 150 solution providers"*** and runs a dedicated
Partner Network — and explicitly sells *"quote-and-buy websites"* as a line item. That is a recruitable
route to the same buyers.

**Acturis reports 850 partners but mentions no reseller programme** — a large ecosystem it doesn't
open.

INSTANDA, Socotra, EIS and Novidea show no partner programme on the pages fetched *(weak evidence —
homepages only)*.

---

## 6. Risks

- 🔴 **SOC 2 before features.** Every enterprise-adjacent regulated buyer gates on security evidence.
  Compare: SOC 2 Type 2 is literally what unlocks involve.me's $499/month tier in an adjacent market.
- 🔴 **A regulated buyer is a slow buyer.** Long procurement, vendor due diligence, exit plans, DR
  testing. This is not a self-serve motion.
- ⚠️ **Two named vendors were never reached** — Genasys returned 403, Applied Systems UK failed to
  connect. The competitive picture has holes.
- ⚠️ **SYSC 8.1's precise application to insurance intermediaries is unverified** — the rule text was
  read, but the trace through SYSC 1 Annex 1 to confirm which firm types it binds was not completed.
  Direction is safe; precision isn't.
- ⚠️ **Nothing here is validated with a real broker or IFA.** Desk research only.

---

## 7. The one-paragraph version

Beneath the enterprise insurance platforms — where **six of six vendors publish no price at all** and
the moat is procurement rather than product — sits a layer of intermediary and adviser tools that
**does** publish: Dynamic Planner at **£60–£179 per adviser per month plus a £130 setup fee**, with no
visible price competition. **The FCA's own guidance makes the decision logic the regulated artefact**
— *"electronic decision trees… the same principles apply as with a paper version"* — and a compliance
officer has to read, approve and defend it, which is the one place in 26 markets where a legible,
diffable node graph is a genuine argument rather than a developer preference. **Open GI routes 600+
brokers to "over 150 solution providers"**, so a channel exists. But entry needs **PDF generation and
an accessibility conformance claim before anything else**, plus SOC 2 to clear procurement — which is
why this is qualified and parked behind SM-003 and SM-004 rather than scheduled.
