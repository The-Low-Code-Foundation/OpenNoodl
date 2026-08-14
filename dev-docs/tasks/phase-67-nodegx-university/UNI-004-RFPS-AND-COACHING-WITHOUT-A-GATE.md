# UNI-004 — RFPs and coaching, without a gate

**Surface:** platform · **Tier 1 (R1, R3)** · **Effort:** L · **Blocked on:** D7 (merchant of record), D8 (listing + moderation policy)

## Premise

Two marketplaces on one rail. **RFPs** (the Bubble pattern): a user posts a request for work;
listed devs respond; responses reach the poster through **our email relay** so nobody's address
is exposed and nobody gets spammed. **Coaching**: listed devs (Richard first — R3, "eating my own
dog food", explicitly *not* exclusive to him) offer bookable, payable sessions. Both hang off
UNI-003's professional flags. This is the phase's first real revenue rail, and it gates nothing
(README principle 2).

## Scope (v1)

- **RFP board**: post (title, description, budget band, timeline), browse/filter, close.
  Posting requires an account; no fee.
- **The response relay**: a dev responds through the platform; the poster receives it by email
  from our system with a reply channel that keeps both addresses masked until the poster chooses
  to connect. Per-RFP response caps and a report button are the spam defence in both directions.
- **Coaching offers**: an offer belongs to a profile — description, duration, price. Booking v0
  is a request form that ends in scheduled email confirmation; calendar automation (Cal.com or
  similar — bought, not built) and payment through the D7 merchant of record follow in the same
  task once D7 is ruled. **The platform takes no cut in v1** — rails first, take-rate is a later
  conversation for non-Richard providers.
- **Moderation**: admin remove/ban, report flows on RFPs, responses, and offers.

## Acceptance criteria

1. An end-to-end RFP round trip with both addresses provably absent from every email header and
   body until the poster opts to connect.
2. A coaching booking round trip: offer → request → confirmation → (once D7 lands) paid receipt
   from the merchant of record.
3. Response caps and reporting demonstrably stop a flood (spec-level, simulated).
4. Richard's own coaching offer is created through the same public flow as anyone else's — no
   admin backdoor listing.

## Not in v1

Platform take-rate, escrow/milestones, dev reviews/ratings, featured listings, the certification
badge on offers.
