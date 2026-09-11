# SM-001 — The protocol question

| Field | Value |
|---|---|
| **Tier** | 0 |
| **Effort** | S |
| **Surface** | research |
| **Rulings** | Feeds **D1**. Blocks nothing; **blocks D1 from being answered** |
| **Depends on** | Nothing. Run with SM-002, first |

> 📖 **Read [research/MARKET-industrial-hmi.md](research/MARKET-industrial-hmi.md) first** — it
> explains what this market is from zero, what Ignition sells, who the integrators are, and what a
> NodeGX project would concretely look like.

## The job

Decide whether industrial HMI is enterable at all, for the price of one session.

Ignition is the incumbent and its published price list is the highest floor found in the whole
research: **Perspective $11,225, Vision $8,330, perpetual, unlimited tags/users/devices**, with an
integrator programme *ranked by resale revenue* — a channel that is both real and commercially
motivated. It triggers none of our capability gaps: no offline requirement, no camera, no
accessibility gate, and on-prem/air-gapped deployment is fine because we ship static React.

**But Ignition's price list is substantially a driver catalogue** (OPC COM $885, Siemens Enhanced
$300, SECS/GEM $1,060). If protocol support *is* the product, we cannot enter — and Node-RED already
occupies the free tier of exactly this niche, with **151,791 downloads last month, ~83,000 of them
Modbus and OPC-UA nodes**, and **Opto 22 ships it pre-loaded on the groov EPIC controller**. A
flow-based visual programming tool, our exact shape, free on the hardware the customer already
bought.

So the question is narrow and answerable:

> **What fraction of industrial visualization projects are built for sites where process data
> *already* lands in MQTT, a historian, or SQL — so the operator-facing app never speaks OPC-UA or
> Modbus itself?**

If that fraction is large, the protocol gap is an integration detail an integrator supplies once, and
we compete on produced-app quality against an $11,225 module. If it is small, protocol support is the
product, and this market collapses for the same reason kiosk did.

**Method.** Sample **20–30 firms from the Ignition integrator directory** (including the Top-100
ranking) and classify their published case studies: greenfield PLC connection versus a layer over
existing infrastructure. Record the classification rule *before* reading any case study. Where a
study is ambiguous, count it as greenfield — bias against our own thesis.

## Acceptance criteria

1. **The classification rule is written down before the first case study is read**, and is stated in
   the finding. A rule invented while reading is a rationalisation.
2. **A named sample of ≥20 integrator firms**, with the directory URL and access date, and the
   classification of each case study — not a summary count. Somebody must be able to re-derive the
   number.
3. **An explicit ambiguity count.** How many were unclassifiable, and which way they were forced.
4. **A stated negative threshold, fixed in advance**: below what fraction do we call this market
   closed? Write the number before you have the answer.
5. **The Node-RED counterfactual is addressed directly**, not waved at: for a site where data already
   lands in MQTT/SQL, what does Node-RED's dashboard *not* do that we would? If the honest answer is
   "nothing the buyer would pay $8,330 for", say so and close the market.
6. **The finding names what would change the verdict** — the one piece of evidence that would flip it.

## Traps

- 🔴 **Case studies are marketing.** An integrator writes up the impressive greenfield job, not the
  seventh dashboard over an existing historian. This biases *against* our thesis, which is the right
  direction — but say so, and do not correct for it silently.
- 🔴 **Do not confuse "Ignition sells drivers" with "the project needed drivers".** Ignition sells
  drivers because it is the SCADA layer. The question is about the *visualization* project on top.
- 🔴 **The directory is client-rendered.** The Top-100 ranking page enumerates; the general directory
  may not. Record which one the sample came from.
- ⚠️ **This probe is designed to return negative.** A session that concludes "promising, needs more
  research" has not done the task. Force the call against the pre-registered threshold.
