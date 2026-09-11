# Market brief — Associations and membership organisations

**Researched 2026-08-18.** Status in [Phase 71](../README.md): **qualified, not scheduled.** Behind
[SM-003](../SM-003-THE-CONFORMANCE-CLAIM.md).

---

## 1. What this actually is

A professional body, trade association, chamber of commerce, alumni network, sports governing body,
learned society, union branch, or charity with members.

They all have the same operational shape and the same software problem:

- **A membership register** — who is a member, what grade, since when, are they in good standing.
- **Renewals and dues** — annual invoicing, chasing, lapsing, reinstating. Often the organisation's
  entire revenue.
- **Events** — conferences, CPD sessions, AGMs, local branch meetings. Booking, payment, attendance,
  certificates.
- **A member directory** — searchable, often the main member benefit.
- **Committees and chapters** — regional groups, special-interest groups, each with their own
  officers and their own small budget.
- **Communications** — newsletters, segmented mailings, member-only content.
- **CPD tracking** — for professional bodies, recording that a member has done their required hours.

This is unglamorous administrative software, and there are tens of thousands of these organisations.

---

## 2. What they use, and what it costs

| Vendor | Published price |
|---|---|
| **Glue Up** | **Essential $3,000–$6,500/year · Advanced $8,000–$18,500/year** |
| **Wild Apricot** | **$66/month at 100 contacts** ($56.10 on 2-year prepay), scaling by contact count |
| **MemberSpace** | $24 / $99 / custom per month, **plus 5% / 2% / 1% transaction fees** |
| **Circle** | $89 / $199 per month |
| **Mighty Networks** | $79 / $179 per month |
| **Hivebrite** | **Publishes nothing** — `/pricing/` 404s on both hosts |
| **Novi AMS** | Bands by association revenue, **no figures** |

**The important number is Glue Up's $8,000–$18,500/year.** In a study where most markets bottomed out
at free or $10/seat/month, this is one of very few with a **verified five-figure ceiling and a floor
that isn't zero**.

The buyer is an executive director or membership director, spending from an operating budget with
board sign-off, on an annual renewal cycle. Not a self-serve credit-card purchase, but not a
twelve-month enterprise procurement either.

---

## 3. Why this market scored well — the channel

**Wild Apricot runs the best partner programme found anywhere in the 26-market study.** Two
programmes, both live:

- **A referral programme paying 10% of all payments for two years.**
- **A Service Partner Programme explicitly for *"a consultant, a designer, an IT firm, or an
  agency"*** — with a public directory filterable across 50 US states, 10 Canadian provinces,
  Australia and Ireland.

And the part that matters most, in their own words: partners get ***"qualified membership-based
organizations directed to you by our Onboarding team."***

**That is commission *plus* lead routing.** Almost nothing else in the study does both. For contrast,
FlutterFlow has 3.3 million users, a directory, and no commission — and has produced **341 hires ever
across 71 experts.** A directory that doesn't route work is worth very little.

Memberstack publishes a certified-expert directory too (15 experts, $51–$200/hour). Circle's
`/experts` and Glue Up's `/partners` both 404 — no channel there.

---

## 4. Where NodeGX fits

### What a project would look like

*Illustrative.* A professional body with 4,000 members, currently on a spreadsheet plus a WordPress
site plus Mailchimp plus Eventbrite.

- **Member records** in the backend, with the per-record ACL doing real work: a member sees their own
  record, a branch officer sees their branch, the executive sees everything.
- **A renewals flow** — invoice generation, payment, grade transitions, lapse handling.
- **An events module** — sessions, booking, capacity, attendance marking, and (with
  [SM-004](../SM-004-THE-DOCUMENT-NODE.md)) a CPD certificate PDF.
- **A member directory** — searchable, with member-controlled visibility.
- **A committee area** per chapter, using roles rather than a separate system.

This is squarely a data-driven web application with authentication, roles and workflows. It is
**exactly what NodeGX already builds**, with no exotic requirements.

### What's missing

| Requirement | Status |
|---|---|
| **Accessibility** | ⚠️ **The blocker, but a softer one than elsewhere.** In the US, ADA Title III applies to private and non-profit sites but **sets no technical standard** — so this is procurement *preference* and litigation risk, not statutory exclusion. **In the EU it hardens**: an association running e-commerce falls under the European Accessibility Act from 28 June 2025 above the microenterprise threshold (under 10 staff *and* ≤€2m). |
| **PDF generation** | ❌ Absent — certificates, invoices, membership cards. [SM-004](../SM-004-THE-DOCUMENT-NODE.md) |
| **Payments** | ⚠️ Not researched. Dues collection is the core money flow; how NodeGX handles recurring payment is an open question |
| SQLite backend | ✅ Fine at the 100–5,000 contact band this market lives in |
| Offline / camera / GPS | ✅ Not required |

---

## 5. Risks

- 🔴 **Payments and dues are the whole business for these organisations**, and that was not researched.
  If recurring billing, dunning and reconciliation are hard in NodeGX, this market is much less
  attractive than it looks. **This is the biggest unmeasured gap in the brief.**
- 🔴 **The accessibility question is the deciding one, and it's cheap to answer**: will an association
  board or its insurer accept a member-facing portal shipped without a WCAG 2.1 AA conformance
  statement? Every other factor reads favourably, so this single answer changes the decision.
- ⚠️ **Incumbents are entrenched and switching is painful.** Migrating a membership register mid-year,
  with renewals in flight, is a genuinely risky operation for a small organisation with one
  administrator.
- ⚠️ **Wild Apricot's exact partner count is unverified** — the directory loads over AJAX.
- ⚠️ **Nothing validated with a real association.** Desk research only.

---

## 6. The one-paragraph version

Associations, professional bodies and membership organisations all run the same administrative
software problem — a register, renewals, events, a directory, committees, CPD — and it is squarely a
data-driven web app with roles, which is what NodeGX already builds with no exotic requirements.
**Glue Up runs $3,000–$18,500/year**, a verified five-figure ceiling with a floor that isn't zero, and
**Wild Apricot operates the best channel found in the whole study — 10% of all payments for two years
*plus* explicit lead routing** to partner consultancies. The blockers are softer than elsewhere:
accessibility is procurement preference rather than statute in the US (though it hardens in the EU
under the Accessibility Act), and PDF generation is already scheduled. **The genuinely unmeasured
risk is payments** — dues collection is these organisations' entire revenue, and how NodeGX handles
recurring billing was never researched.
