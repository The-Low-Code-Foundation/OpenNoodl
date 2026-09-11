# The markets we rejected, and exactly why

**Researched 2026-08-18.** Twenty markets that did not survive screening, plus the one that was
upgraded and then reversed.

Keep this file. Its value is that it stops the same market being re-proposed in six months, and the
reasons are more useful than the verdicts — several are patterns that will recur.

---

## The reversal, first — kiosk, signage and interactive exhibits

**This one was given a qualified go on the first pass and downgraded on the second.** It is the most
instructive result in the study.

### What the market is

Touchscreen experiences in museums, visitor attractions, retail, corporate lobbies, trade stands and
exhibitions. Someone walks up to a screen and interacts with it.

### Why it looked good

**Intuiface is the closest structural analogue that exists** — a visual composer for touch experiences
with data feeds and analytics. Its pricing, pulled from its own pricing API, showed:

- Platform €1,035–€3,743/year
- **Additional interactive player €332 per screen, per year, forever**
- **"Additional View" (web deployment) €3,795/year — more than the Enterprise platform itself**

A vendor charging per-screen rent forever, and pricing *web* deployment as its most expensive SKU,
against a product whose native output *is* a web app. That looked like a clean wedge.

*(⚠️ Those prices are now historical — on re-verification Intuiface's pricing page is 183KB with zero
currency symbols and eight instances of "Contact us". They have gone fully quote-gated.)*

### Why it died

**One question decided it: do the firms holding the budget employ developers?** Four independent
methods said no.

| Evidence | Counted | Software developers |
|---|---|---|
| Four exhibition design practices (Atelier Brückner, Casson Mann, Kossmanndejong, Nissen Richards) | **218 named staff** | **Zero.** Atelier Brückner hired 21 named disciplines and skipped software engineering |
| Five AV integrators (AVI-SPL, Solutionz, Kinly, Electrosonic, GV Multimedia) | **237 open requisitions** | **Zero.** Across 162 AVI-SPL job descriptions: "react" 0, C#/.NET 0, "crestron" 40 |
| UK public procurement | 40 awards | **Two entirely separate supplier tiers with zero overlap.** Design firms and production studios never bid for each other's work |
| Intuiface's own marketing | — | *"Lack the time, headcount or desire to create your own interactive content?"* / *"no developers needed"* |

**The squeeze, precisely.** NodeGX's no-code half appeals to firms without developers — but they want
finished work, not a tool, and Intuiface already sells them exactly that. Its real-React half appeals
to developers — but the studios that employ developers already write React by hand, and their
*differentiated* skill is Unity, Unreal and TouchDesigner, where NodeGX can't follow.

**So it competes with the agency for the work while depending on the agency's staff to adopt the
tool.**

The clincher: **Diversified, a top-two global AV integrator, adopted Intuiface specifically to
"streamline a content delivery process formerly dependent upon custom coding."** A major integrator
publicly framing custom development as a cost to escape.

Scale confirmed it. UK museum interactive software: **£6.1m across 40 awards over twelve years**,
median £78,358, at £14k–49k per interactive. That implies a **£1–3m ARR ceiling** before competing
with free React.

### The lesson worth keeping

**"Sell to the delivery layer" is a hypothesis, not a law.** It held in configurators (rules are
authored by engineers) and failed here. Before entering any vertical: *confirm somebody in the
delivery layer would actually operate the tool.*

---

## The other nineteen

### Pharma eDetailing / Veeva CLM

Interactive sales presentations that pharma reps show doctors on iPads, packaged for Veeva's CRM.

**Why not:** a conformant package is `index.html` + `thumb.png` in a zip — the barrier has been that
low for fifteen years and nobody failed to cross it. The incumbents won on pharma relationships, MLR
process integration and an offshore cost base (**Indegene runs at ~$53k revenue per head**). Worse,
CLM's runtime is offline, serverless, single-file, on a WebView Veeva itself documents as running
JavaScript at **under 10% of desktop speed** — which strips out SSR, the backend and dynamic data,
three of NodeGX's four differentiators.

**Worth remembering:** the compliance moat everyone assumes protects this market **doesn't exist for
authoring tools**. Part 11 attaches to predicate-rule records; promotional material's rule is
post-hoc submission with no pre-approval; and Veeva's own guide tells content creators to use a
screen-capture app and an image editor. If Snagit needs no validation, neither does a visual builder.

**The one real opening, unpursued:** Veeva CRM support ends 2029-12-31, forcing roughly **585 CLM
content re-platforming events** in a 40-month window.

### Field data capture and inspection apps

Mobile forms for inspectors — construction, facilities, utilities, EHS.

**Why not:** the disqualifiers are commercial, not technical. A **$10–55/seat/month price floor with
free tiers** (Mitti claims 2M users at $24/seat with free-to-10-seats; AppSheet is $10 and free inside
Workspace). **Every differentiated pricing position is already occupied** — flat-team by TrueContext,
per-submission by MoreApp, unlimited-by-volume by Procore. And **no channel exists to recruit**:
incumbents kept delivery in-house deliberately (Fulcrum sells its own professional services;
TrueContext's partner page 404s).

**Correction worth noting:** offline is *not* the blocker. PowerSync sells Postgres→SQLite delta sync
from $49/month; Fulcrum's actual state of the art is field-level merge with last-write-wins.

**Best competitive fact found:** **Power Apps offline is Dataverse-only, and Dataverse is excluded
from the entitlement bundled with M365** — so "free with Microsoft 365" and "works offline" are
mutually exclusive. The M365 F1 frontline SKU, the licence you'd most want on a field technician, gets
nothing at all.

### Interactive demos and digital adoption

Navattic, Storylane, Walnut (demos); WalkMe, Pendo, Whatfix (onboarding).

**Why not: wrong artefact entirely.** These tools build a convincing *fake* of software you already
own — screenshots or a cloned DOM with tooltips over it. NodeGX builds real software, so every
strength is dead weight. Entry is **$38–50/month with universal free tiers**, a full agency demo build
is a **$1,000–5,000 engagement**, and Navattic, Storylane and Supademo **all ship MCP servers already**
— AI authoring is table stakes there, not a wedge.

### Legal and compliance decision automation

Bryter, Neota, Josef, Checkbox — "lawyers build apps".

**Why not: seven companies just walked away from this exact proposition.** Bryter raised **$90M** and
planned 120→200 staff on "lawyers build workflows visually", then downsized — with genAI named as the
cause — and by 2026 sells conversational building instead. Afterpattern was absorbed by NetDocuments.
Checkbox raised a $23M Series A on a thesis of *removing* the need to build anything. The only
pure-play publishing prices sells to solo practitioners at **$83/month**.

### Clinical EDC / ePRO

Software for capturing clinical trial data.

**Why not:** the barrier is smaller than feared — **FDA certifies no vendor**; validation is the
sponsor's obligation — and CDISC ODM v2.0 is a free, JSON-serialisable interchange standard, a real
SCORM analogue. But **the buyer is purchasing auditability and indemnity, not authoring speed**, and
nobody in the category publishes a price. The genuinely underserved seam — **8,382 REDCap institutions
each independently validating a system Vanderbilt explicitly refuses to validate for them** — is a
compliance-services business, not an app builder. Real money, wrong shape.

### Property and real estate selectors

Unit/plot selectors for new-build developments, kitchen and interior configurators.

**Why not — and this is the cleanest primary evidence in the study.** Twelve housebuilders were
fingerprinted from page source: six UK (Barratt, Taylor Wimpey, Bellway, Crest Nicholson, Redrow,
Berkeley) and six German prefab (WeberHaus, Bien-Zenker, Hanse Haus, Baufritz, SchwörerHaus, Huf
Haus). **Not one carried a third-party plot-selector vendor.** Every implementation is first-party, on
a CMS the builder already licenses — Sitecore, TYPO3, Azure.

**And the money is content, not software.** Anewgo's own quote calculator, recovered from its
production JavaScript bundle, prices the **interactive site plan at $250–$450 one-off or $1 per lot**,
against **$2,000 per visualizer** and **$6,500 for a virtual tour** — with the software subscription at
**$125/month**. A builder with 20 elevations spends $8,000–9,500 on renders against $1,500/year on the
app. **3DPlans won't even sell its interactive site map without an existing site map** — you buy the
content first, then subscribe to the app wrapped around it.

### Interactive calculators and quote tools

ConvertCalculator, Outgrow, involve.me, Calconic, Typeform.

**Why not — and the diagnostic here is reusable.** Look at what each vendor *meters*: Calconic bills
**impressions**, ConvertCalculator bills **visits**, Outgrow bills **leads per year**, involve.me bills
**live funnels**. Those are advertising metrics. **A genuine business-logic category meters seats,
records or transactions.** Confirmed by the feature gates: **Typeform sells logic at its cheapest paid
tier ($28/mo annual)** and Paperform sells calculations, scoring and custom pricing rules at $24.
Nobody pays more for better rules; the premium tiers sell SOC 2, seats, volume and PDFs.

**Worth keeping though: the channel is real and already paid.** Jotform gives resellers up to 30% and
lets them set their own margin; Paperform productised an agency tier at $190/month; Outgrow pays 20%
upfront plus 20% recurring.

### Trades and services estimating

Roofing, solar, plumbing quote tools.

**Why not:** **quoting is bundled free at every entry tier** — Jobber $49, Housecall Pro $79, Fergus
$53, Powered Now £28/user, all include it. Where advanced quoting *is* unbundled, the suite vendor
charges for it. The independents are free (**OpenSolar, 28,000+ active professionals, $0**),
hardware-owned (Solargraf, by Enphase) or shrinking (**Aurora Solar cut ~20% of staff in January
2024**). The standalone money is **aerial measurement data** — EagleView $24–$90 per report, Roofr $19,
Hover $9–$139 per property — which is a photogrammetry business, not an app builder. And **offline,
camera capture, PDF and e-signature are all table stakes**, four of which we lack.

**Correcting a common assumption:** payments is *not* the business. ServiceTitan's FY2026 10-K shows
subscription **$712.3M** against usage **$213.1M**, with usage share flat-to-declining at ~22%.

### Franchise and multi-site operations

**Why not — the single cleanest disqualification in the study.** Bindy's homepage advertises, as core
features: *"Work on any device, online or offline"*, *"Attach photos to forms, inspections, tasks"*,
*"Capture 90-second live HD videos"*, *"Geofencing, routes, weather-tagging, signatures, photos, and
videos"*. **That is four of NodeGX's five capability gaps in one sentence**, for 140 brands across 21
countries — at a **$10/user/month floor** (GoAudits), against Mitti's free tier.

### Internal tools and admin panels

Retool, Budibase, Appsmith, ToolJet.

**Why not:** **Budibase's self-hosted plan is free indefinitely with *unlimited users***, and Appsmith
and ToolJet Community are the same. Three live competitors at **28,000–40,000 GitHub stars** (for
scale: `noodlapp/noodl` is 549, last pushed 2024). And **no channel** — Retool's partner page lists only
AWS and Databricks; Appsmith's and ToolJet's render the homepage.

### Government and civic service journeys

**Why not: statutorily excluded today.** The GOV.UK service manual requires WCAG 2.2 AA and names,
specifically, making it *"easy for keyboard users to see the item their keyboard is currently focused
on"* and ensuring *"your code lets assistive technologies know what every user interface component is
for"* — **precisely the two things this runtime fails**. Plus **12,743 services already listed on
G-Cloud 14 Lot 2 alone**, and no published price to undercut.

### Event and conference apps

**Why not: the market bifurcated and the surviving half is the one we can't serve.** Virtual-only
died — Hopin went from a $7.7bn valuation to selling its events business for **$15M upfront**.
In-person recovered hard — Cvent, taken private at $4.6bn, spent ~$700M in December 2025 alone buying
Goldcast and ON24. But Whova advertises as core: *"Offline? no worries"*, *"Scan leads directly from
mobile"*, *"Interactive Maps"*, and native App Store download. **Four advertised core features, four
NodeGX gaps.**

### NGO impact reporting and beneficiary data

**Why not: KoboToolbox is free for exactly this buyer** — free to all nonprofits under its Community
Plan — **and offline-first by design** (*"Collect data offline or online, on any device"*). Field
beneficiary collection is offline-first by definition, plus GPS and photo evidence.

### Client and member portals (professional services)

**Why not: the incumbent bundles the deliverable free.** Karbon lists client portal access under "All
Plans Include" at $59–$89/user. The standalone floor is **SuiteDash at $19/month for unlimited staff,
clients and portals, white-labelled on every tier.** And PDF generation plus e-signature are table
stakes — engagement letters, invoices, signed statements. Document handling *is* the portal's job.

### Healthcare patient-facing (non-clinical) — WEAK, not dead

**The regulatory line is navigable and sharper than assumed.** Read from MDCG 2019-11 and the MHRA
guidance directly: software is only a candidate device if it acts on data *beyond* "storage, archival,
communication, simple search"; and qualification turns on **intended purpose, not risk**. Safe:
appointment prep, admin flows, generic pathway explainers, patient education, **raw PROM collection
transmitted unchanged to a clinician**. **Not safe:** MDCG's own worked example says software
*"intended for scoring depression based on inputted data on a patient's symptoms"* is **class IIb** —
notified-body territory. Collection is fine; the moment you score, interpret or triage, you're
regulated.

**Why weak:** nobody publishes a price (Cemplicity, DrDoctor, Vinehealth, Aparito all 404 on
`/pricing`), and **NHS DTAC makes accessibility its only *scored* section** — so the renderer blocks
the safe side of the line anyway. *(That DTAC claim is secondary-sourced; digital.nhs.uk hard-403s.
Re-verify before relying on it.)*

### Marketplaces and directories — WEAK

Sharetribe $39–$299/month, Brilliant Directories $40–$120. A genuine agency channel exists but
**measures exactly 20 firms** at the reference vendor. And the missing piece is regulated: split
payments, escrow and KYC, which Sharetribe's own guidance calls non-negotiable — *"PCI DSS, PSD2 &
SCA, GDPR… a legal requirement for handling any form of payment on your platform."*

### Sports, coaching and performance

**Why not: a barbell with nothing in the middle.** Free at the volume end (Spond is free; Clubforce
£25–40/month for a whole club), relationship-sold at the value end (Kitman Labs, Premier League and
MLS clients, publishes nothing). And the profitable middle — **Hudl at $500–$2,500 per team per
year** — is a video storage and analysis business.

### Branching video and scenario tools for sales enablement / compliance

**Why not: the buyer pays for content, not capability — in its purest form.** Traliant publishes
**$13.95–$30.95 per learner per year** and its tiers are literally "how much of our catalogue do you
want". KnowBe4 is $1.63–$3.75 per seat per month. Meanwhile branching authoring **has no price at
all**: it's a **free H5P content type** and a bullet inside Articulate's $1,449–$1,749/seat suite.

**And the practice budget moved.** AI-roleplay vendors took it — Hyperbound raised $15M after two
consecutive months adding $1M+ ARR; Second Nature raised $22M with Zoom participating; Zenarate $15M.
**Quantified already ships "self-authoring" as one of six bundled agents** — authoring absorbed as a
feature. Wirewax, the flagship interactive-video company, no longer serves a website at all.

### Behavioural research instruments — WEDGE ONLY

**The technical question is settled in our favour.** Bridges et al. (*PeerJ*, 2020) measured
browser-based experiment timing: PsychoJS response-time variability **0.39ms**, jsPsych 0.66ms, with
the authors concluding *"online methods can be suitable for a wide range of studies"*. And the
incumbents tax the researcher's core activity — **Prolific takes 33.3% academic / 42.8% commercial on
participant pay**; Testable 10–30% recruitment commission; Pavlovia £0.24 per participant credit.

**But PsychoPy and jsPsych are free, excellent and community-owned**, and willingness to pay is low.
Gorilla's retreat from published per-token pricing to "book a call" suggests self-serve doesn't
sustain a company here. **Enter for credibility and teaching adoption; do not model it as revenue.**

---

## Patterns worth carrying forward

Five reasons recur, and any future market proposal should be checked against them:

1. **The technical barrier is low — which reads as opportunity and is actually the problem.** If it's
   been easy for fifteen years and nobody did it, the market isn't contested on tooling. *(Pharma,
   demos, branching video.)*
2. **The price floor is already at or near zero.** *(Field capture, internal tools, calculators, NGO,
   portals, sports.)*
3. **Incumbents kept delivery in-house on purpose**, so there's no channel to recruit — because
   delivery *is* their margin. *(Field capture, property, trades.)*
4. **The buyer pays for content or data, not software.** *(Property CGI, compliance course libraries,
   aerial measurement, PIM catalogues.)*
5. **A required capability we lack is advertised as a core feature by the incumbent.** *(Franchise ops,
   events, NGO, trades.)*

And one meta-pattern: **"we are a better authoring tool" is not a defensible position in any market
examined.** Authoring either gets absorbed by whoever owns the outcome, or ceded to agencies who
charge for the content instead. Lead with what the output *is*.
