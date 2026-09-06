# Phase 71 — the research

**Researched 2026-08-18**, out of a question from Richard: *"where else could NodeGX go after the
eLearning wedge, and where could we sell training?"*

Twenty-six markets were tested. This folder is the reasoning; the files above it
([TASKS.md](../TASKS.md), the `SM-*` files) are what to do about it.

**Full report, formatted for reading and sharing:**
<https://claude.ai/code/artifact/c3f5ff4b-1360-43dd-bbde-08da8f7be224>

---

## Start here

| File | What it's for |
|---|---|
| **[MARKET-industrial-hmi.md](MARKET-industrial-hmi.md)** | Factory and plant operator screens. **Highest verified price floor in the study** ($11,225 perpetual), a channel of integrators ranked by resale revenue, and none of our capability gaps. Explained from zero — what a PLC is, what's on the screen, why it matters. |
| **[MARKET-configurators.md](MARKET-configurators.md)** | Made-to-order product configuration. Survives **re-aimed** — a kit for the ~90–160 firms who build configurators for manufacturers, not a CPQ product. Contains the measured expressiveness ceiling. |
| **[MARKET-insurance-adviser-tools.md](MARKET-insurance-adviser-tools.md)** | Quote journeys and adviser tools. **The only market in 26 where the node graph has a *regulatory* argument** — the FCA treats a decision tree as the regulated artefact. |
| **[MARKET-associations.md](MARKET-associations.md)** | Professional bodies and membership organisations. **The best channel economics found anywhere** — 10% for two years *plus* lead routing. |
| **[REJECTED-MARKETS.md](REJECTED-MARKETS.md)** | The twenty that failed, each with its one deciding fact — plus kiosk, which was upgraded and then reversed. **Read the patterns at the end.** |
| **[THE-TRAINING-BUSINESS.md](THE-TRAINING-BUSINESS.md)** | The monetisation answer, which is *not* selling courses. Certification economics, corporate delivery rates, and what killed the operators who got it wrong. |

---

## The three findings that shaped the phase

**1. One rendering defect blocks four markets at once.** Accessibility is the binding constraint in
UK public sector, US state and local government, NHS non-device work, and EU e-commerce. The GOV.UK
service manual names, as WCAG 2.2 AA requirements, visible keyboard focus and machine-readable
component roles — **precisely the two things this runtime fails** (one ARIA attribute in the whole
package, zero `role=`, nine `outline: none`). Fixing the renderer unlocks all four simultaneously. It
is the only investment identified anywhere in this research that pays off more than once.

**2. "A better authoring tool" is not a defensible position in any market examined.** Six of the first
eight died because the technical barrier was *low* — which reads as opportunity and is actually the
problem. It has been low for years; nobody failed to cross it; the incumbents won on something else.
Authoring gets absorbed by whoever owns the outcome, or ceded to agencies who charge for content
instead. **Lead with what the output *is* — a real app with a database — and ship the interop quietly
as the price of entry.**

**3. Two markets survive, and both need a cheap disproof before any build.** Hence
[SM-001](../SM-001-THE-PROTOCOL-QUESTION.md) and [SM-002](../SM-002-TWO-REAL-RULE-SETS.md), which are
designed to return negative and cost a session each.

---

## How this was researched, and how much to trust it

**Method.** Parallel research agents working from primary sources — SEC filings, Danish and Swedish
company registries, gov.uk, eCFR, EUR-Lex, the FCA Handbook, TED and USAspending procurement APIs, the
CLib configuration benchmark library, npm and GitHub APIs, and vendor pricing pages and APIs — plus a
read-only audit of the NodeGX source tree for the capability claims.

**Every claim is marked verified, estimated or unverified in the source reports.** Where an agent
could not confirm something, it is recorded as unverified rather than estimated. Two research routes
were abandoned mid-study rather than reported, because control tests showed they were returning
artefacts.

### What to distrust — including things published earlier in this work

- 🔴 **Contracts Finder's OCDS `keyword` parameter is accepted and silently discarded.** A nonsense
  control query returned a **byte-identical** release set to a real query — 100/100 overlap on
  extracted IDs. Reproduced independently by two agents. **Find a Tender rejects `keyword` outright
  (400).** ✅ TED v3 and USAspending *do* filter correctly (nonsense → 0 results).
- 🔴 **freelancermap's `query=` is a no-op** — nonsense, "SAP" and "CPQ" all returned an identical
  `12.936 Projekte`.
- 🔴 **LinkedIn's guest API has no zero state** — it always returns exactly ten cards. "Combeenation"
  returned a handyman; "encoway" a concrete project engineer.
- 🔴 **Reddit is reachable only via `.rss`** (JSON 403s, proxies 403/429), throttling at ~40 requests.
- 🔴 **An empty result from a killed process is not a measured absence.** This nearly produced a false
  negative: a grep job was killed mid-run, its last section headers came back blank, and the blanks
  read exactly like "this vendor doesn't use 3D". The classification survived only because the same
  thing had been measured independently by another method.
- ✅ **Always run a nonsense-query control before trusting a search endpoint.**

### Numbers that failed verification

- **The $47.4bn "eDetailing market"** lists AstraZeneca, Pfizer and Novartis as the market's *vendors*
  rather than its buyers, and is ~8× total US prescriber detailing spend. Unsound on its face.
- **Every analyst market forecast in these categories.** CPQ CAGR estimates span **6.71%–20.9%**, with
  one publisher contradicting itself year-over-year; two houses differ **67%** on 2026 digital
  signage; eLearning authoring shows an **8.2× spread on one base year**. **Use statutory filings** —
  Configit's gross profit fell 26.8% while every report claimed 15–21% growth.
- **"Grafana Certified Professional, $199"** could not be reproduced on any Grafana page; it exists
  only in AI-generated summaries and third-party training marketing.
- **Maker School's "$217,720/month"** fails its own arithmetic: 2,094 members × $184 = $385,296.
- **My own earlier claims, corrected here:** the Intuiface €332/screen and €3,795 web-deployment prices
  are now historical (they have gone fully quote-gated); *"nobody publishes a price in the configurator
  middle"* was **too strong** — Roomle publishes €100–€1,450/month and the logic tier *is* the ladder;
  and *"the person who built the spreadsheet left and nobody understands it"* has **zero primary
  support** across four independent search routes — it is vendor marketing, and the real pattern is
  the opposite.

### What none of this includes

**Not one customer conversation.** This is entirely desk research. Every market brief ends with the
same caveat, and it is the honest limit of the whole exercise: it tells you which markets are worth
*talking to someone about*, and nothing more.
