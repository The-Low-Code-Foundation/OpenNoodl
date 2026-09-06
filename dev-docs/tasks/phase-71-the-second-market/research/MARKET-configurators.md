# Market brief — Product configurators (and why not CPQ)

**Researched 2026-08-18.** Status in [Phase 71](../README.md): **survives screening, re-aimed, gated
on [SM-002](../SM-002-TWO-REAL-RULE-SETS.md).**

---

## 1. What this actually is

A manufacturer makes something that comes in variants. Not a fixed catalogue of ten products — a
*space* of possible products.

A conveyor: 12 belt widths × 6 drive options × 4 frame materials × 3 motor positions × a guard package
× a control panel. An electrical enclosure: size, material, IP rating, door type, cutouts, mounting
plate, cable glands. A window: frame material, glazing, opening style, colour inside, colour outside,
handle, trickle vent, sizes to the millimetre.

The customer says "I want one like *this*". Somebody has to work out:

1. **Is that combination even possible?** (You can't have the wide belt with the small motor. That
   colour isn't available in that material.)
2. **What does it cost?** (Price varies with almost every choice, plus quantity, plus customer
   discount, plus region.)
3. **What do we actually build?** (A parts list — a Bill of Materials — and often a drawing.)
4. **What do we send the customer?** (A quote document, usually a PDF.)

**A product configurator is the software that answers those four questions.** At its simplest it's a
web page with dropdowns that greys out impossible options and shows a running price. At its most
complex it's a constraint solver driving a CAD system to generate manufacturing drawings.

### The acronym you'll see everywhere: CPQ

**CPQ = Configure, Price, Quote.** It's the enterprise category name — big systems that do the
configuration *and* the pricing rules *and* the approval workflow *and* the quote document *and* the
CRM integration. Salesforce CPQ, Oracle CPQ, Tacton, Configit, PROS, Conga.

**We are explicitly not entering CPQ.** §5 explains why, and the evidence is unusually harsh.

---

## 2. What the market uses today, and what it costs

The category splits into three tiers that barely acknowledge each other.

### The bottom — e-commerce options apps, effectively free

Shopify's app store. I pulled the entire English sitemap (25,174 apps) and filtered to
quiz/finder/configurator/selector patterns, then fetched 115 listings:

- **115 of 115 offer a free plan or are free to install.** The floor is literally zero.
- **Median lowest paid tier: $19/month.**
- **73 of 115 (63%) have zero reviews.** It is a graveyard.
- Only 7 have ≥100 reviews. The biggest, Easify Custom Product Options, has 2,916 at $9.99–$99.99.

Telling detail: **Combeenation — a €697/month European platform — lists a Shopify app at $200/month
and it has one review.** The reach-down into SMB isn't working.

### The middle — published, and this is where we were wrong before

I previously told Richard "nobody publishes a price between $13/month Shopify apps and €697/month
platforms." **That was wrong and it's corrected here.**

| Vendor | Published price |
|---|---|
| **Roomle** | **€100/mo** viewer · €280 material config · €650 room designer · **€850 basic variant config (up to 15 parameters)** · **€1,450 full logic** · Enterprise custom |
| **Combeenation** | **€697/mo** simple · €1,600 medium · €2,400 complex — **plus one-off implementation €10,000 / €30,000 / €70,000**, range stated as "€10,000 to €100,000 or more" |
| **Zakeke** | $69.90 / $129.90 / $299.90 per month + 1.5–1.9% transaction fee |
| **Cyncly Design Flex** (kitchen/bath CAD) | $1,895–$2,995 per seat per year |

**Look at Roomle's ladder specifically: €850 for basic variant configuration up to 15 parameters,
€1,450 for full logic.** The *logic tier is the price ladder*. That's the single most encouraging
data point in this market — it says rule expressiveness is what commands price.

### The top — enterprise CPQ, no prices at all

Tacton, Configit, Threekit, Epicor CPQ, PROS, Conga, encoway, camos, Sofon, Zoovu: **contact sales,
every one.** Salesforce Revenue Cloud is the exception at $150–$200 per user per month, and it
requires the underlying CRM licence.

---

## 3. Who builds these, and who we'd actually sell to

**Not the manufacturer.** A mid-size manufacturer does not have the people to build a configurator.
They hire someone — and that someone is our customer.

The delivery population is small, nameable and countable:

| Tier | Who | Count |
|---|---|---|
| **CAD resellers (VARs)** | The SOLIDWORKS/Autodesk channel — GoEngineer, TriMech, Hawk Ridge, Solid Solutions, Visiativ, Cadmes, PLM Group, Bechtle. They already sell **DriveWorks**, a configurator that plugs into SOLIDWORKS. | ~165 listings globally, **~48–52 distinct groups in US+EU**. The entire UK channel is **four firms**. |
| **Dedicated configurator boutiques** | DriveWorks' named Authorized Services/Solutions Partners — firms that *"provide expertise on integration… including creating plugins using the DriveWorks API"*, i.e. they demonstrably employ developers | **9 named, 8 in US/EU** |
| **Vendor-network agencies** | Combeenation names **13** partner agencies (NETFORMIC, Basilicom, SHOPMACHER, MONOBUNT…); camos names **8**; Zoovu names 6+ SIs | ~60–125 |
| **General e-commerce/PIM agencies** advertising "Produktkonfigurator" | Mostly DACH | 300–800, **unverified** |

**Addressable: ~400–900 firms. High-intent core: ~90–160, every one nameable from a public page.**
This is a direct-sales motion, not a marketplace.

**Combeenation describes our buyer verbatim on its own site:** digital agencies *"use our development
platform to develop their own configurators."* A competitor wrote our positioning statement.

### The economics for that buyer

A DACH implementer bills roughly **€700–1,300/day**. A typical single configurator project runs
**€10,000–35,000**. Published German agency rates: junior €55–75/hr, senior €85–130, certified
specialist €120–160.

**So a kit that removes 5–15 build days from a project is worth €5,000–20,000 of margin to them, per
project.** That is the entire commercial argument, and it's why the pitch is "your delivery costs
less" rather than "our editor is nicer".

---

## 4. Where NodeGX fits, and the hard ceiling

### The good news: rule authoring is genuinely an engineering job

This was the question that could have killed the market outright — if configurator rules were
authored by product managers in spreadsheet-like UIs, a node graph would be irrelevant. It isn't:

- **camos** runs two separate four-day courses: *"Modeller Training"* (developing elements, product
  structures and rules) and a distinct *"Developer Training"*.
- **Combeenation's rule language, Hive, is a statically typed textual DSL** — *"It is a statically
  typed language, unlike JavaScript for example"* — with syntax like
  `if myValue > 10 then 10 else myValue end`. **No visual editor is offered at all.**
- **Live job ads** for CPQ configuration specialists require *"interpret engineering drawings,
  technical specifications, and product data"* and *"Ensure CPQ outputs align with ERP systems and
  Bill of Materials (BOM) structures"*.
- encoway's customers carry standing job titles like **"Head of Product Configuration"**.

**The person authoring these rules reads BOMs and engineering drawings. A node graph is a real
improvement over a typed DSL for that person.**

### The bad news: a measured ceiling, and it's low

The **Renault Mégane configuration model** is the canonical industrial benchmark, published with a
2002 *Artificial Intelligence* paper. I downloaded it (26 MB, 195,298 lines) and tested every rule.

The test: for each rule, is any variable *functionally determined* by the others? Because a dataflow
node needs an input side and an output side — if you know the inputs, you compute the output. A rule
where no variable can be derived from the rest isn't a function at all. It's a **relation**: a flat
table of allowed combinations.

| Measurement | Result |
|---|---|
| Variables / rules | 101 / 113 |
| **Rules with NO functionally determined variable** | **70 of 113 — 62%** |
| High-arity rules (≥5 variables) with none | **44 of 68** |
| Largest rule | 6 variables, **48,721 allowed tuples**, zero functional direction |
| Total allowed tuples | 194,838 |

**Crucially, size is not the problem.** 195,000 tuples is a few MB of JSON — trivially shippable to a
browser. **Shape is the problem.** You cannot compile a relation into a forward assignment in any
direction. Faking it with filter nodes costs roughly **700 nodes for 113 rules**, and each filter only
looks one step ahead — it can't grey out an option that becomes impossible three constraints away.

### The twenty-year natural experiment

**Linux Kconfig** — the menu system you use to configure a kernel build — *is* a pure
forward-propagation configurator at industrial scale, and has been for two decades. Its own
specification admits the failure:

> *"select will force a symbol to a value **without visiting the dependencies**. By abusing select
> you are able to select a symbol FOO **even if FOO depends on BAR that is not set**… avoid the
> **illegal configurations all over**."*

I counted **74 live instances** of that hazard across 15 subsystem files. And the ConfigFix research
paper measured the human cost: **a fifth of surveyed users spent "roughly a few dozen minutes"
resolving conflicts**, in a tool that *"does not even show which parts of the constraint are unmet"*.

**Forward propagation at scale doesn't just fail to prevent dead ends — it manufactures silently
invalid states.**

### The honest operating envelope

> **~100 options, ~100 mostly-low-arity rules, in a product where "you can reach a dead end and must
> back up" is an acceptable user experience.**

Inside that, a node graph handles it natively: formula pricing, derived dimensions, defaults,
show/hide gating, numeric ranges, closed-form engineering sizing.

Outside it — free selection order over high-arity relations, "can this partial configuration still be
completed?", explaining *why* an option disappeared, cheapest-valid-configuration (which is **NP-hard
even over a pre-compiled decision diagram**) — it stops being honest.

**The upgrade path the literature validates is not "add a solver".** It's compile the rule set offline
into a Binary Decision Diagram and ship that artefact, which a dataflow graph can consume as a node
without ever learning to search. That's a credible v2 and is explicitly out of scope for now.

**[SM-002](../SM-002-TWO-REAL-RULE-SETS.md) tests two real mid-market rule sets against that
envelope**, because Renault is a car with industrial-strength constraint modelling and a conveyor
might be almost entirely forward-propagating. Nobody knows yet.

---

## 5. Why not CPQ — the market is sicker than it looks

The analyst reports claim 15–21% annual growth. **The statutory filings say otherwise**, and filings
don't market:

| Company | Filed reality |
|---|---|
| **Configit** (Danish pure-play) | **Gross profit down 26.8%** in FY2025; pre-tax profit −60%; headcount flat at 74 |
| **Tacton** (Swedish pure-play) | SEK 494.9M revenue (~**$47M**), **104 employees** |
| **PROS** | $330M revenue, **net loss $20.5M**; taken private by Thoma Bravo for $1.4bn, Sept 2025, B2B assets merging into Conga |
| **Salesforce CPQ** | **End-of-sale 27 March 2025.** Migration to Revenue Cloud described by consultancies as a full 18–24 month reimplementation |
| **Logik.ai** | Acquired by ServiceNow — `logik.io` now redirects to servicenow.com |

Meanwhile analyst CAGR estimates for CPQ span **6.71% to 20.9%** — a 3.1× spread — with one publisher
contradicting itself year-over-year and two near-identically-named firms differing by 28%.

**A top-tier pure-play shrank 27% while every report claimed the market grows 15–21%.** Use the
filings.

Public procurement confirms the thinness: across all of EU procurement in ten years, roughly **seven
genuine CPQ purchases**, four with published values (Ørsted awarded €2.26M against a €3.3M ceiling;
ESB €12M to Reply). Buyers are utilities and postal operators. *"Product configurator"* is essentially
absent from procurement language — buyers write "CPQ".

---

## 6. Two things that closed favourably

### 3D is a verified negative — not an assumption

The instinct is that a configurator needs 3D. For the segments that matter, **it demonstrably doesn't.**
I fetched live configurators and grepped their actual page source for 3D library markers:

- **Signomatic** (signage): **55 occurrences of `fabricJson`** — Fabric.js, a 2D canvas library —
  server-rendered SVG previews, and **zero occurrences of "3D"**.
- **Trade print** (Vistaprint UK, Printed.com, Helloprint, Saxoprint, Flyeralarm): **zero 3D markers
  across all five.** The job is upload → preflight → proof; 3D would render a flat sheet.
- **Misumi** — millions of parametric SKUs, the purest option configurator in the set — **ships no
  3D.** It sells on part numbers and 2D drawings.
- **The sharpest single artefact: Signs.com owns a three.js configurator and emits
  `threeDData = 0`** on its banner products. A company that *has* 3D switches it off per SKU.

And a caution for competitive positioning: **two of four packaging firms advertising "3D" turn out to
mean a rendered image a human emails you** after you send a dieline (Refine Packaging: *"dieline
file. We'll then prepare a 2D and 3D rendering"*). Discount competitors' 3D marketing until you've
read their page source.

Where 3D genuinely *is* required: furniture and interiors (Roomle, Cylindo), apparel and promotional
personalisation, and consumer-facing home goods. Those we don't enter.

### The buyer objection is on record

A configurator freelancer, unprompted, on r/smallbusiness:

> *"I'm a freelancer, and I help businesses to implement product configurators… Every client that I
> had **does not want to pay an additional subscription to third-party software**. So I've built a
> product configurator on my own based on playcanvas, where a client **purchases once and has it
> forever**."*

That is simultaneously the market opportunity and the pricing constraint, stated by exactly the person
we'd sell to.

---

## 7. What closed badly — and it moves the target

**The "manufacturers run configuration on spreadsheets" premise splits in two, and only half survives.**

I gathered 307 unique practitioner posts across Reddit, plus forum snippets, and read them.

- ✅ **Job-shop *estimating* on spreadsheets: verified abundantly.** *"All pricing management is done
  either on paper or with a separate excel document… We handle roughly **2000 bids a year for a team
  of 2 estimators**"*. Dozens of these, 2013–2026.
- ⚠️ **Product *option configuration* on spreadsheets: weakly supported.** Roughly **five clean primary
  instances across 307 posts.** And critically, the people with option-matrix problems reach for a
  **PIM** — Product Information Management. Three independent voices in one thread converged on
  Akeneo, Pimcore and Airtable.

**So the incumbent we'd displace is a PIM plus a spreadsheet, not a CPQ.** That reframes the product:
**it needs a data-in seam far more than a clever rule editor** — which is why
[SM-006](../SM-006-THE-DATA-IN-SEAM.md) exists as a Tier 1 capability.

encoway, the DACH specialist with 25 years and 300+ staff, says the same thing outright:

> *"Configuration rules can very often already be mapped using standard product characteristics"* —
> while the real burden is *"a clean and comprehensive database… and high-quality texts, images and
> documents."*

**Also: drop "the person who built the spreadsheet left and nobody understands it".** I relayed that
earlier from vendor marketing. Hunted across four independent routes: **zero primary support.** The
real pattern is the opposite — these sheets are *borrowed and unowned*: *"an excel spreadsheet that
was given to me by another shop owner."*

---

## 8. Risks

- 🔴 **encoway already sells our pitch.** *"Even non-experts can create product logic easily and
  intuitively with minimal training"*, *"clicked together by drag-and-drop"*, plus a WYSIWYG editor and
  an expert-mode escape hatch. A node graph is genuinely better than Hive or camos Develop — but
  "visual, no-code, for non-experts" is **not a differentiated claim** to a buyer who has heard it.
- 🔴 **Half the ecosystem is structurally hostile.** Combeenation recruits agencies onto its platform;
  **Elfsquad sells explicitly *against* consultants** — *"Your knowledge stays yours, not locked away
  in consultants or custom code."* Our playbook is the thing they're beating.
- 🔴 **The money is in data and 3D, which we don't touch.** Zoovu prices on catalogue size and bundles
  "Product Data Enrichment" with every plan. Combeenation's implementation is 1–3× the annual licence.
- ⚠️ **Nobody publishes an implementation price.** Not DriveWorks, not one VAR, not encoway, camos,
  Elfsquad or Combeenation. That's our opening ([SM-008](../SM-008-THE-PUBLISHED-PRICE.md)) and their
  margin.
- ⚠️ **The freelance pool is tens, not hundreds** — and not who you'd expect. DriveWorks: 5 profiles on
  Malt (2 genuine). Tacton: 1. camos, encoway, Elfsquad, Configit, Combeenation: **zero freelancers
  each**. `DriveWorks solidworks` returns **zero GitHub repos** — a closed ecosystem. The recruitable
  population is **generic web developers who ship configurators as a deliverable**, at €220–800/day —
  which for a visual builder is arguably the *right* pool, with no platform lock-in to unlearn.

---

## 9. The one-paragraph version

A product configurator answers four questions about a made-to-order product: is this combination
possible, what does it cost, what do we build, what do we send the customer. **We would not sell a
configurator product — the pure-play CPQ market is shrinking (Configit −26.8%, Tacton $47M, Salesforce
killed its own).** We would sell **a kit and a delivery playbook to the ~90–160 nameable firms who
build configurators for manufacturers**, where removing 5–15 build days from a €10–35k project is worth
€5–20k of their margin. The decisive question came back in our favour — **rule authoring genuinely is
an engineering job**, done in typed DSLs by people who read BOMs — and **3D is a verified negative** in
the segments that matter. But there is a **measured expressiveness ceiling** (62% of real industrial
rules have no functional direction, so ~100 options and ~100 low-arity rules is the honest envelope),
and **the incumbent to displace is a PIM plus a spreadsheet, not a CPQ**, which means the data-in seam
matters more than the rule editor.
