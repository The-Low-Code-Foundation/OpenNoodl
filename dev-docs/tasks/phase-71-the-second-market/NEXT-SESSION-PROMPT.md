# Next session — Phase 71

**Written:** 2026-08-18, at the close of the market-research session that created this phase.

## State

Phase 71 is **scoped and unstarted**. Nine tasks, no code, no rulings answered.

The research behind it is complete and lives in two places: the full report at
<https://claude.ai/code/artifact/c3f5ff4b-1360-43dd-bbde-08da8f7be224> (26 markets, primary sources)
and the condensed version in [README.md](README.md). **Read README §1 (what the research found) and
§4 (prior-art reconciliation) before touching anything.**

## Start here

**Run SM-001 and SM-002. Nothing else.**

They are single-session research tasks, they are designed to return negative, and **D1 cannot be
answered without them** — which means SM-009 is forbidden until they report. Both have pre-registration
requirements: write the classification rule (SM-001) and the threshold (SM-002) *before* looking at
any evidence, and state them in the finding. A session that reads the evidence first and then decides
what would have counted has not done the task.

If both come back negative, that is a clean result. The phase closes at eight tasks, the Tier 1
capabilities (SM-003, SM-004, SM-006) remain worth building on their own merits, and two sessions
bought the answer instead of a quarter.

## What needs Richard, and when

**D1 must be answered *after* Tier 0, not before** — committing early is the exact failure this phase
exists to prevent. The other five can be taken in one sitting whenever convenient:

- **D4** (escalate the accessibility fix?) is the one with the widest consequences — it blocks SM-003,
  and through it the insurance and associations markets. Recommendation in the README is *escalate*:
  one rendering defect blocks four markets, and it is the only investment identified anywhere in the
  research that pays off more than once.
- **D2** (do we sell kits?) blocks SM-005. **D3** (channel or direct?) blocks SM-007. **D5** (publish
  or quote?) blocks SM-008. **D6** (act on insurance at all?) can wait.

## Traps that will bite this phase specifically

- 🔴 **Do not re-spec Phase 41.** ACC-001..ACC-022 own the accessibility fix. SM-003 owns only the
  conformance report, which P41 does not have. If SM-003 finds itself designing a focus ring, it has
  strayed.
- 🔴 **Do not merge SM-005 into ECO-002.** If D2 says no, cut it. ECO-002 is a gated Horizon-3
  marketplace spec and should not inherit live entitlement code it never asked for.
- 🔴 **CN-012 binds SM-004**: no kit nodes server-side. The document node is a built-in plus a backend
  capability, and a cloud function must be able to call it.
- 🔴 **"A better authoring tool" is not a position.** Every market examined either absorbs authoring
  into whoever owns the outcome, or cedes it to agencies who charge for content instead. Lead with
  what the output *is*.
- 🔴 **The channel thesis is not universal.** It held in configurators (rules are authored by
  engineers) and failed in kiosk (218 named staff across four exhibition practices, zero developers).
  Before recruiting into any vertical, confirm somebody there would actually operate the tool.

## Research hygiene, if any market gets re-sized

Four search endpoints silently lied during this work and will lie again:

- **Contracts Finder's OCDS `keyword` is accepted and discarded** — a nonsense control returned a
  byte-identical release set to a real query. **Find a Tender rejects it outright (400).** TED v3 and
  USAspending do filter correctly.
- **freelancermap's `query=` is a no-op**; **LinkedIn's guest API has no zero state** (always ten
  cards); **Reddit is reachable only via `.rss`**, throttling at ~40 requests.
- ✅ **Run a nonsense-query control before trusting any search endpoint.** Two routes were abandoned on
  that basis rather than reported.
- 🔴 **Analyst market forecasts in these categories are unusable** — 3.1× CAGR spreads, publishers
  contradicting themselves year-over-year. Use statutory filings.

## Do not carry forward

**"The person who built the spreadsheet left and nobody understands it."** It is Configure One
marketing, hunted across four independent routes with zero primary support. The real pattern is the
opposite — the sheets are borrowed and unowned: *"an excel spreadsheet that was given to me by another
shop owner."*
