# SM-007 — The partner ladder

| Field | Value |
|---|---|
| **Tier** | 2 |
| **Effort** | L |
| **Surface** | `platform`, `docs` |
| **Rulings** | 🔴 **D3 — do we want a channel business at all?** Also touches D2 (if tiers gate kit access) |
| **Depends on** | D3; SM-005 if entitlement gates tiers. Coordinate with P70 — **one ladder, not two** |

> 📖 **Read [research/THE-TRAINING-BUSINESS.md](research/THE-TRAINING-BUSINESS.md) first** — the
> full certification and channel evidence, the corporate delivery rates, and the operators who got it
> wrong.

## The job

Build the structure that makes a certification worth paying for, and a channel worth joining.

**The evidence is unusually clear on what separates the vendors who can charge from those who
cannot**, and it is not exam quality. It is whether a *commercial privilege* depends on holding the
credential.

| Vendor | Exam | Certified staff required for a tier | What the tier pays |
|---|---|---|---|
| **Odoo** | €220 | **1 / 3 / 6** for Ready / Silver / Gold | 10/15/20% on Enterprise **including renewals**; 50% on hosting |
| **Unity** | $259 | 10 for Authorized; **45 + 15** for Gold | Rebates, MDF, leads — **$15,540 of exam fees for Gold alone** |
| **Frappe** | $200 | 2 at every tier | 10–25% cloud discount |
| **HashiCorp** | $70.50 | — | Sells the exam directly, outsources teaching to *"a couple of partners"* |
| **Grafana · n8n · Make · Airtable · Retool · Strapi · Softr · Glide** | **Free** | **None** | Referral only, or nothing |

Grafana passed **$400M+ ARR** and still states all academy content is available at no cost. Retool
announced a credential for 2024 and never shipped it. **Zapier closed its expert certification and
left it shut for four and a half years.** None of them attached a consequence, so none could charge.

**Three design details worth copying exactly:**

1. **The credential version-decays.** Odoo requires certification on one of the last three releases
   and ships annually — so the certified stock re-buys itself roughly every three years. A one-off
   becomes an annuity without raising the price.
2. **Commission includes renewals** (Odoo), while renewals do *not* count toward tier. That is the
   mechanism that makes a partner stay.
3. **Gate on retention, not only revenue.** Odoo's 70%/80% retention criterion prices out
   churn-and-burn resellers. 🔴 **Bubble's revenue-threshold ladder produced documented resentment on
   its own forum** — small agencies concluded it was unwinnable — and Bubble has since bolted on two
   anti-gaming patches, one of which is currently switched off.

**Give the courseware away.** Every vendor with a working paid credential publishes free learning
material and charges only for the assessment; every vendor that tried to charge for the content ended
up making it free. The observed band for a functional credential is **€70–220**.

## Acceptance criteria

1. **A written tier specification**: entry requirements in *certified headcount* (not revenue alone),
   a retention criterion, what each tier receives, and how tier is reviewed and lost.
2. **The exam exists and is gated**, priced in the €70–220 band, sold to customers and partners
   rather than the open market — the Camunda posture, which is how a credential stays scarce.
3. **Version-decay is designed in from the first release**, not retrofitted. Retrofitting an expiry
   onto an existing credential is a trust event.
4. **A directory that routes leads, not just a list.** Wild Apricot's programme is the best found
   anywhere — 10% of all payments for two years *plus* explicit lead routing, partners receiving
   *"qualified organizations directed to you by our Onboarding team"*. A directory that does not route
   work is worth very little: FlutterFlow has 3.3M users, a directory, no commission — and **341 hires
   ever across 71 experts**.
5. 🔴 **A stated operational commitment**, honestly scoped: who reviews applications, on what cadence,
   who runs the exam, who pays commission and when. [ECO-004](../phase-20-ecosystem/ECO-004-HOSTED-PLATFORM.md)'s
   warning applies — *"a project that has been dormant… cannot casually acquire those obligations."*
6. **One ladder across P70 and P71.** If eLearning and the second market each grow a partner
   programme, both are worth less.

## Traps

- 🔴 **Certification without a consequence prices to zero — every time, no exceptions in the data.**
  If D3 produces a ladder with no commercial privilege attached, do not also charge for the exam;
  give it away and call it marketing, which is what it would be.
- 🔴 **Expect the listed-partner count to be roughly half the claimed one.** Odoo claims 10,000 and
  lists **4,325**; the difference is a paying-but-invisible Learning tier. That invisibility is itself
  the upsell — worth designing deliberately rather than discovering.
- 🔴 **Plan for dozens, not hundreds.** OutSystems sustains **36 UK contract vacancies** and Mendix
  **13**. Glide lists 58 experts worldwide; Zapier 517; the entire countable certified-partner
  population across five comparable vendors is ~627 organisations. A model assuming thousands is
  assuming something nobody in this category has achieved.
- ⚠️ **Kiosk is the counter-case to P3.** The channel thesis held where the delivery firms employ
  engineers and failed where they do not. Before recruiting into a vertical, confirm somebody there
  would operate the tool.
