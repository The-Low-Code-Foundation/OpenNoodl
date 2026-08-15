# LB-009 — the program as a sellable

**Surface:** platform · **Tier 3** · **Effort:** M · 🔴 **Blocked on E2** (does a program join
D7's Paddle catalogue? — recommendation: yes, as a D7 amendment) · consumes UNI-004's booking rows

## Premise

The money seam. D7 ruled Paddle as merchant of record with **coaching sessions** the only
sellable; UNI-004 built offer → booking → payment. This task connects a *purchase* to a *space*:
buying a program (or completing a session booking that includes one) grants the buyer coachee
access to an instantiated program. Until E2 is ruled and this task lands, **the manual path is
the product and it is fine**: booking ends in an email (UNI-004's standing v0) and the coach
attaches the space by hand — LearnBook works unpaid-gated from LB-001 onward.

## Scope (v1)

- **The attachment**: a UNI-004 booking/purchase row can reference a program (LB-001 left the
  nullable reference ready). On payment confirmation (Paddle webhook, UNI-004's machinery), the
  platform instantiates the offer's linked template (LB-008) — or attaches to a coach-chosen
  existing program — and adds the buyer as participant. Notification (LB-003) to both parties.
- **Offer → template linkage**: a UNI-003/004 coaching offer can name a LB-008 template as "what
  you get"; the offer page shows the program outline (module titles only — the template privacy
  boundary holds even in marketing).
- **Failure honesty**: webhook retries, idempotent instantiation (one purchase, one program, no
  matter how many webhook deliveries), and a clear admin view of purchases whose provisioning
  failed. Payments code earns the paranoia.
- **Refund posture**: a Paddle refund revokes participant access (LB-001 criterion 4 semantics)
  but never deletes the exchange — E5's exit rules govern what the ex-participant can still
  export. Stated in the offer terms.
- **The platform takes no cut in v1** — UNI-004's rule restated: rails first.

## Acceptance criteria

1. Sandbox end-to-end: offer with template → purchase → webhook → program instantiated →
   buyer lands in it → both parties notified. Replayed webhook creates nothing twice.
2. Failed provisioning (template deleted between offer and purchase) surfaces in the admin view
   and to the coach, and never silently swallows a paid order.
3. Refund revokes access within the webhook's processing, recorded with attribution.
4. The manual path still works after this lands — a coach can attach a space to an email-v0
   booking by hand; the paid rail is additive (D13's "payment can be absent" rule survives).

## Not in v1

Take-rate, subscriptions/instalments, coupons, seat-based group pricing, invoicing UI (Paddle's
receipts suffice), payouts to coaches beyond Paddle's own flows.
