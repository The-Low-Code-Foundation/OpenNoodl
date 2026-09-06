# SM-008 — The published price

| Field | Value |
|---|---|
| **Tier** | 2 |
| **Effort** | S |
| **Surface** | `docs` |
| **Rulings** | **D5 — publish or quote?** |
| **Depends on** | D5. Coordinate with P70 — one posture, not two |

## The job

Publish real numbers, in public, where essentially every incumbent refuses to.

**The opacity is near-total and was verified vendor by vendor.** Quote-only, with no figure anywhere:
Intuiface (now 183KB of pricing page with **zero currency symbols and eight instances of "Contact
us"**), Poppulo, PADS4, encoway, camos, Zoovu, Sofon, Revalize, Tacton, Configit, Threekit, Expivi,
INSTANDA, Socotra, EIS, Novidea, Acturis, Docebo, Cornerstone, Absorb, Litmos, Anewgo's software
line, Outhouse, Unlatch, Prompto, Higharc, ServiceTitan, Simpro, Commusoft, Workiz. **Not one
DriveWorks reseller, and no CPQ vendor, publishes an implementation price** — a third-party review
states it outright.

**Where prices do exist, they are the exception and they are memorable**: Combeenation's €697/mo plus
€10k–100k implementation; Roomle's €100–€1,450/mo ladder where the *logic tier is the price ladder*;
Ignition's Perspective at $11,225 perpetual; Dynamic Planner at £60–179/adviser/month; Anewgo's
$125/month software beside $2,000 visualizers.

Publishing is a differentiator that costs nothing but a decision. It also disciplines the product:
a price you can publish is a scope you have decided.

**The counter-argument, stated fairly.** Camunda publishes no training price at all, and that is
deliberate — for enterprise buyers, price is discovered in a sales conversation, and **publishing a
low number caps the deal size**. The resolution used by the vendors who do both: **publish the
self-serve and public-course prices; quote the private, enterprise and implementation work.**

## Acceptance criteria

1. **A published price page** covering whatever D5 rules is publishable, with the unit stated
   unambiguously — per seat, per project, per screen, perpetual or recurring. 🔴 The *metering unit*
   is the most informative thing on a pricing page: calculators bill impressions, visits and leads,
   which is how the research identified them as an advertising category rather than a logic one.
2. **A stated posture for what is *not* published**, and why — so quote-only reads as deliberate
   rather than evasive.
3. **One posture across P70 and P71.** Two pricing pages with different logics is worse than either.
4. **Currency and tax handling is explicit.** Intuiface adds 5% on card purchases outside USD/EUR
   without saying so on the price card; MoodleCloud bills in AUD while displaying five other
   currencies. Both are avoidable own-goals.
5. **No permanent-discount theatre.** Wes Bos was displaying a "BLACK FRIDAY 50% off — SKILL UP IN
   2025!" banner in August 2026; Zero To Mastery shows a 33% flash-sale code and a 49%-off price card
   simultaneously. If the discount is permanent it is the price — say so.
6. 🔴 **Regional pricing, if offered, is modelled before it is published.** Josh Comeau: *"roughly half
   the purchases are for Regional Licenses, which can reduce the price by up to 75%."* Any revenue
   model built on list price × units overstates by roughly 2×.

## Traps

- 🔴 **Do not publish an implementation price without knowing the delivery cost.** Nobody in the CAD
  VAR or CPQ channel publishes one, and opacity is *their margin*. Undercutting a number you have not
  measured wins deals you lose money on.
- ⚠️ **Tiering is a measured multiplier, not a hunch.** Adam Wathan published his own counterfactual:
  three tiers produced an average selling price of **$67.84 against $29** for a single price — *"less
  than half the revenue for a lot more than half the work."* Every comparable operator now runs three.
- ⚠️ **Content subscriptions cluster at $150–390/year** (egghead, ByteByteGo, Pragmatic Engineer, ZTM,
  Master.dev). A content-only tier cannot clear more than that; mentorship and access can (Flux at
  $597–$4,997). Do not blend the two in one SKU.
