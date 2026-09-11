# The training and channel business — what the evidence supports

**Researched 2026-08-18.** Feeds [SM-007](../SM-007-THE-PARTNER-LADDER.md) and
[SM-008](../SM-008-THE-PUBLISHED-PRICE.md), and rulings **D2**, **D3**, **D5**.

The original question was "where could I sell training to companies or freelancers?" The answer the
evidence supports is **not the obvious one**, and three findings overturn it.

---

## Finding 1 — Certification only sells when something requires it

This is the clearest structural result in the whole study. Across every comparable vendor examined,
one thing separates those who can charge for a credential from those who can't — and it isn't exam
quality. **It's whether a commercial privilege depends on holding it.**

| Vendor | Exam price | Certified staff required for a partner tier | What the tier pays |
|---|---|---|---|
| **Odoo** | **€220** | **1 / 3 / 6** for Ready / Silver / Gold | 10 / 15 / 20% on Enterprise **including renewals**; **50% on hosting** |
| **Unity** | **$259** | 10 for Authorized; **45 + 15** for Gold | Rebates, marketing funds, leads |
| **Frappe** | **$200** ($500 developer) | 2 at every tier | 10–25% cloud discount |
| **HashiCorp** | **$70.50** Associate / **$295** Professional | — | Sells the exam directly, outsources teaching to *"only a couple of partners"* |
| **GitLab** | ~$150 *(unverified)* | 3 course completions for Open tier; 4+2+1 for Select | Margins, deal registration |
| **Grafana** | **Free** | None | — |
| **n8n, Make, Airtable, Retool, Strapi, Softr, Glide, Bubble⁺** | **Free** | None | Referral only, or nothing |

**Do the arithmetic on Unity Gold: 60 exams × $259 = $15,540 in exam fees alone**, before licences.
That is not a training business — it's a toll gate on a partner ladder, and the ladder is what sells
seats.

**The negative cases are just as clear:**

- **Grafana passed $400M+ ARR** and still states plainly that all its academy content is *"currently
  available at no cost"*. No public partner programme page exists at all — four candidate URLs 404.
- **Retool announced a credential for 2024** ("our goal in 2024 is to provide access to content that
  will be tied to digital badges") — and **never shipped it**.
- **Zapier paused its expert certification in August 2020 and left it closed for four and a half
  years**, only relaunching in January 2025. The market leader shut its certification programme and
  left it shut.
- **n8n's Education Partner programme is still listed as "coming soon"**, and its expert directory is
  a **closed pilot with 49 partners** — against a forum with **172,141 users and 558,691 posts**. That
  is a **~3,500:1 ratio of free-help participants to certified experts.**

### Three design details worth copying exactly

1. **Make the credential version-decay.** Odoo requires certification on one of the last three
   releases and ships annually — so the certified stock **re-buys itself roughly every three years**.
   A one-off becomes an annuity without raising the price.
2. **Pay commission on renewals** (Odoo does; renewals don't count toward *tier*, but they do pay).
   That's what makes a partner stay rather than churn.
3. **Gate on retention, not only revenue.** Odoo's 70%/80% retention criterion prices out
   churn-and-burn resellers. 🔴 **Bubble's revenue-threshold ladder produced documented resentment on
   its own forum** — small agencies concluded it was unwinnable — and Bubble has since bolted on two
   anti-gaming patches, one of which is currently switched off.

**The observed price band for a functional credential is €70–220.** And every vendor with a working
paid credential **gives the courseware away and charges only for the assessment**; every vendor that
tried to charge for the learning content ended up making it free.

---

## Finding 2 — Paid training accrues to difficulty, not popularity

This is the uncomfortable one, and it's a direct question mark over training for a visual builder.

| Tool | Users / installs | Largest third-party course |
|---|---|---|
| **Unity** | Far fewer than Elementor | **496,739 students** |
| **Elementor** | 10M installs, 22M sites | **39,342 students** |
| **FlutterFlow** | **3.3M users** | **1,310 students** |

**A 379× gap between Unity and FlutterFlow — with FlutterFlow having the larger user base.**

Elementor is the sharpest case: 22 million sites, **no academy, no certification, and its expert
directory has been retired** (every `experts.elementor.com` URL now 301s to the homepage). It replaced
the directory with a pure affiliate programme paying **45–55%**.

**If a tool is easy, the training market does not form no matter how many users it has.** Paid
training accrues to difficulty. A visual node-graph builder sits on the wrong side of that line —
*unless* the curriculum targets something genuinely hard, which points at the AI/governance framing in
Finding 4.

---

## Finding 3 — Recorded content is worth ~$14. Scheduled human contact is worth $259–£5,100

The same vendor, same subject, 65× price differential:

| GameDev.tv product | Price |
|---|---|
| Recorded Unity course | **$12–16** (list $49–195) |
| Beginner bundle | $29–49 |
| **Live 8-week cohort, same subject** | **$999** |

And Unity itself proved it in reverse: it made Learn Premium **free forever in June 2020**, then in
2026 reintroduced paid training as **Unity Academy at $600–800 per seat per year**, aimed at
organisations. Free content didn't destroy paid training — it destroyed **one format** and pushed all
margin into cohorts, proctored exams, conferences and enterprise seats.

### The corporate delivery numbers are the healthiest in the study

| Offer | Price |
|---|---|
| **MongoDB private training day** (≤12 people) | **£5,100/day** |
| **Business Training Works, US** (≤12) | **$5,800/day** |
| **Learning Tree, Power Platform** | £835 (1 day) – £2,620 (5 days) ≈ **£520–835 per delegate-day** |
| **MHR Analytics onsite** (≤8) | **£2,250/day** |
| **MongoDB public seat** | **£700/seat/day** |
| **Trainer cost base, UK** | **£450–500/day** (ITJobsWatch contract medians) |

**A 4–10× gross margin on delivered days.** And US corporate spend on *outside* training products and
services is **$16bn, up 29% year on year** — the fastest-growing line in the Training Industry Report,
against total US training expenditure of $102.8bn and $874 spent per learner.

### The eLearning-adjacent proof that the gap is real

For the existing wedge specifically: **ATD sells an Articulate Storyline Certificate at
$2,125–$2,425 — priced above its own flagship CPTD credential.** Yukon Learning, Articulate's *sole
named certified training partner*, charges **$8,000 for a two-day onsite** (≤15 learners) and $250/hour
for one-to-one. IDOL Academy's $4,997 bootcamp has 3,300+ graduates since 2018 (≈$2M/year from one
bootcamp).

Meanwhile the commodity tier is thin: **total lifetime enrolment across the visible Udemy Storyline
catalogue is ~32,000, with 79% of it in a single course.** And crucially — **there is no Articulate
practitioner certification at all.** Articulate certifies *partners*, not designers.

**The gap between "a $12 video doesn't do it" and "$2,425 to ATD" is the market.**

---

## Finding 4 — What the counter-evidence says, taken seriously

The failure cases here are unusually well documented and they specify the plan rather than killing it.

- **Write of Passage closed on its own economics.** ~100,000 subscribers, a $3,995–6,995 price,
  ~$2M/year — shut August 2024. The founder's own words: *"We've built something worth celebrating in
  every way, except for the economics of the business."* Causes: revenue arriving in two annual spikes
  against year-round staff cost, and *"the main thing we were missing was a dependable flow of new
  students."*
- **Section4 said live production was too expensive.** Laid off 25% in 2022, stating its
  two-to-three-week professor-led courses were *"too costly to produce"*. Today it sells a **$41–82
  per month** AI-skills subscription plus custom enterprise. It walked away from exactly this model.
- **Skillsoft's instructor-led segment is the one dying** — Global Knowledge fell **13%**, is
  loss-making and under strategic review, while its scalable-platform segment held flat.
- **The marketplace base rates are brutal.** On Gumroad, July 2025: of 37,006 creators who made *any*
  money, **1,536 cleared $1,000 and only 110 cleared $10,000** — **0.3%**. On Udemy, **1,600 of
  ~90,000 instructors** earn a national-average income (**1.8%**) — and Udemy cut the subscription-pool
  instructor share from **25% to 15% in three years** without instructor consent, while total
  instructor payouts fell from $209.5M (2023) to **$168.0M (2025)**.
- **genAI has eaten the beginner segment specifically.** Bryter's downsizing was attributed to genAI
  superseding rule-based no-code. **SAP retired Build Apps on 23 March 2026 — announced the same day
  it took effect** — stranding every consultant who had invested in it. The independent no-code
  training layer is visibly collapsing toward AI-assisted coding: **Momentum Academy's $2,495 Bubble
  bootcamp is discontinued** and its page now reads *"The Archive — our Bubble-era writing"*;
  **Buildcamp repositioned to "Become a Claude Code and Cursor expert"** with zero mentions of Bubble
  on its pricing page; Planet No Code made its 500-video library free.

### But the survivor tells you the shape

**Flux Academy — the flagship independent Webflow training business — did not close.** It moved from
selling courses to selling **membership at $597, $1,497 and $4,997 per year**, under the banner *"Build
a Design Business in the Age of AI"*. Individual masterclasses are now membership-gated with no
standalone price.

**Every operator in that cohort who kept selling recorded courseware exited. The one that converted to
access, mentorship and positioning survived at a $5,000 top tier.**

And the demand side supports the framing: Upwork's 2026 data shows **AI Integration demand up 178%**
and AI-referencing skills up 109%, with **77% of business leaders reporting rising need for
specialised, fractional talent**. The growth is in *supervising and productionising* AI — not in
learning a builder.

---

## The recommended structure, with price anchors

Every price below is anchored to a verified comparable rather than chosen.

| Layer | Offer | Price | Anchored to |
|---|---|---|---|
| **0** | Docs, video, self-paced academy | **Free** | Camunda, Odoo, HashiCorp, Frappe all give courseware away |
| **1** | Certified Builder exam | **£165 / $200** | Odoo €220, Frappe $200, HashiCorp $70.50. **Gate it to customers and partners**, as Camunda does |
| **1** | Certified Architect exam | **£250 / $300** | HashiCorp Professional $295 |
| **2** | Private / onsite day, ≤12 delegates | **£4,500 · quote only** | Between MHR £2,250 and MongoDB £5,100 |
| **2** | Public virtual course, 2 days | **£995/seat** | Undercuts MongoDB's £700/seat/day while staying premium |
| **3** | Practitioner membership — **mentorship and access, not a video library** | **£600–1,500/yr** | Flux $597/$1,497. ⚠️ **Content-only memberships cap at $150–390** (egghead $150, ByteByteGo $150, Pragmatic Engineer $150, ZTM $299, Master.dev $390) |
| **4** | Partner tiers — Certified / Silver / Gold | **1 / 3 / 6 certified staff** | Odoo exactly; commission **including renewals**; version-decaying credential; retention gate |
| **5** | Kit marketplace split to creators | **90–95%** | Webflow moved to **95/5**; **Bubble's 25% take is the uncompetitive end** |

### Three pricing mechanics the successful operators disclose

- **Tiering is a measured multiplier, not a hunch.** Adam Wathan published his own counterfactual:
  three tiers produced an **average selling price of $67.84 against $29** for a single price — *"less
  than half the revenue for a lot more than half the work."*
- **Regional pricing halves headline ASP.** Josh Comeau: *"roughly half the purchases are for Regional
  Licenses, which can reduce the price by up to 75%."* Any model built on list price × units
  overstates by ~2×.
- **Treat list prices as fiction.** Wes Bos was displaying a "BLACK FRIDAY 50% off — SKILL UP IN 2025!"
  banner in August 2026. Zero To Mastery shows a 33% flash-sale code and a 49%-off price card
  simultaneously. **The discount is the price.**

### And the upside case, for calibration

The margins for a solo operator are genuinely extraordinary, and disclosed twice with consistent cost
figures: **Josh Comeau ran ~$5,000/month of operating cost** against a business that did **$550,000 in
a single launch week** and has sold ~15,000 copies since. **Adam Wathan's *Refactoring to Collections*
took nine weeks to build and returned $138,835 in eleven months**, itemised day by day. Price ceilings
have risen too — Comeau's top tier is $599, and Kent C. Dodds sells a *self-paced* product at $1,200.

---

## What to expect from a channel — plan for dozens, not thousands

| Vendor | Listed experts / partners |
|---|---|
| Zapier | **517** |
| Camunda | **204** |
| Airtable | **61** |
| Glide | **58** |
| n8n | **49** (closed pilot) |
| Figma | **10** |
| Sharetribe | **20** |
| Elementor | **0 — directory retired** |

**The entire countable certified-partner population across five comparable vendors is ~627
organisations.** And for context on the labour market: **OutSystems sustains 36 UK contract vacancies
and Mendix 13** — the two best-capitalised independent low-code platforms on earth, 49 roles between
them. Low-code rates sit *below* pro-code and are falling: React £525/day and rising, Power Apps
Developer £448 and **−28% permanent** year on year.

**Also expect the listed count to be roughly half the claimed one.** Odoo claims 10,000 partners and
lists **4,325** — the difference is a paying-but-invisible Learning tier. That invisibility is itself
the upsell, and worth designing deliberately.

---

## The one-paragraph version

**Don't sell courses.** Certification only commands a price when a commercial privilege depends on
holding it — Odoo gates partner tiers on 1/3/6 certified staff and pays commission including renewals;
where nothing requires a credential it is free, every time, including at a $400M-ARR company.
**Paid training accrues to difficulty, not popularity** (Unity's top course has 496,739 students,
FlutterFlow's has 1,310 from a larger user base), which is a real question mark over a visual builder
unless the curriculum targets something genuinely hard. **Recorded content is worth ~$14 and scheduled
human contact is worth $259–£5,100** — so give the courseware away, charge €165–220 for a gated exam,
sell delivery days at £4,500 against a £450–500 cost base, and build a partner ladder where the
credential is the toll gate. Expect a channel of **dozens**, not thousands. And the survivors of the
recent shakeout sold **membership, mentorship and positioning** — Flux at $597–$4,997 — not video
libraries.
