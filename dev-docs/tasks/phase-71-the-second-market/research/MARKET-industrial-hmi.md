# Market brief — Industrial HMI, SCADA screens and plant dashboards

**Researched 2026-08-18.** Status in [Phase 71](../README.md): **survives screening, gated on
[SM-001](../SM-001-THE-PROTOCOL-QUESTION.md).**

---

## 1. What this actually is

Start with a factory floor. Or a water treatment works, a brewery, a packaging line, a wind farm, a
cold store, a car plant.

Everywhere in that building there is machinery doing physical things — motors turning, valves
opening, tanks filling, conveyors moving, temperatures rising. Each of those is controlled by a small
industrial computer called a **PLC** (Programmable Logic Controller). A PLC is a ruggedised box bolted
inside a metal cabinet that reads sensors and switches things on and off, thousands of times a second,
forever. It has no screen. It is not meant to have one.

So there is a second layer of software whose entire job is **to show a human what the machinery is
doing, and let them intervene.** That layer is what this market sells.

It has two overlapping names:

- **HMI — Human-Machine Interface.** Usually the screen bolted to the machine itself, or on the wall
  next to it. An operator standing at the line looks at it.
- **SCADA — Supervisory Control And Data Acquisition.** The bigger picture: a control-room screen, or
  a manager's dashboard, showing the whole plant or several sites at once.

In practice the boundary is fuzzy and the same product often does both.

### What's actually on the screen

Concretely, this is what an industrial visualisation project produces:

- **A mimic diagram** — a schematic of the plant drawn as a picture, with live values on it. A tank
  that fills up as the real tank fills. A pipe that turns from grey to blue when liquid is flowing. A
  motor symbol that goes green when running and red when faulted.
- **Alarm lists** — "Pump 3 overload, 14:32:07, unacknowledged". Operators acknowledge them; the
  system records who did, and when. This is often a regulatory record.
- **Trends** — a temperature over the last eight hours, plotted, so you can see it drifting before it
  breaches.
- **Setpoint entry** — the operator types 62.5 °C and presses set, and something physical changes.
- **Shift reports and OEE dashboards** — how much did we make, how long were we down, why.
- **Batch records** — for food, pharma and brewing: what went into this batch, at what temperature,
  signed off by whom.

If you have ever seen a photo of a control room with wall screens full of schematic diagrams and
coloured blobs, that is this market.

### Why it's interesting for a web-app builder

Because **most of it is, functionally, a data-driven web application.** It's a page that reads values,
renders them, updates them live, records what a human did, and writes some values back. Take away the
industrial context and you have a dashboard with forms and a websocket.

That's the whole thesis. The counter-argument is in §6, and it's serious.

---

## 2. The incumbent, and the number that made us look

**Ignition, by Inductive Automation, is the reference product.** It is the one that changed how this
market is priced, and it publishes a full list price — which almost nobody else in this research does.

| Ignition module | Price |
|---|---|
| Ignition platform (base) | **$1,200** |
| **Perspective** (the modern web/mobile visualisation module) | **$11,225** |
| **Vision** (the older desktop-client visualisation module) | **$8,330** |
| SQL Bridge | $2,300 |
| Historian (time-series storage) | $3,500 |
| Edge IIoT | $945 |
| OPC COM driver | $885 |
| Siemens Enhanced driver | $300 |
| SECS/GEM driver (semiconductor) | $1,060 |

Source: `inductiveautomation.com/pricing/list`, read 2026-08-18. Verified first-hand.

**Two things make this remarkable.**

**It's perpetual and unlimited.** You buy Perspective once, for $11,225, and you get *unlimited tags,
unlimited clients, unlimited devices, unlimited screens*. No per-seat, no per-tag metering. That
pricing model is why Ignition took the market from the traditional vendors, who charged per tag and
per client and made every expansion a negotiation.

**It's the highest verified price floor in the entire 26-market study.** Nothing else came close.
Compare: field-inspection apps at $10–55/seat/month, kiosk signage at $8–36/screen/month, internal
tool builders free for unlimited self-hosted users.

### The rest of the field

- **Rockwell FactoryTalk, Siemens WinCC, Wonderware/AVEVA** — the traditional vendors. Enterprise
  sales, no public pricing, deeply tied to their own PLC hardware.
- **Grafana** — free tier, Pro from $19/month, **Enterprise minimum $25,000/year** (verified). Very
  widely used for plant dashboards, but it's a *read-only observability* tool. It shows you graphs; it
  doesn't do setpoint entry, alarm acknowledgement or operator workflows.
- **ThingsBoard** — free under Apache 2.0, cloud $749/month, perpetual from $4,999.
- **Node-RED** — free, open source, and the serious problem. See §6.

---

## 3. Who buys, and how the money moves

**This is the part that made the market survive screening.** The buyer is not the factory.

Industrial visualisation is overwhelmingly delivered by **system integrators** — engineering firms
who specify, build, commission and support control systems for plants. A food manufacturer doesn't
employ people to write SCADA screens; it hires an integrator.

**Inductive Automation runs a formal Integrator Program, and — unusually — publishes a
Top-Selling Integrators ranking.** To appear on it, per their own wording, *"total direct-to-end-user
sales of Ignition need to be high enough to rank among the program's top 100 qualified system
integrators."*

Read that carefully: **the integrators resell the licences, and are ranked by how much they sell.**
That means the channel is real, commercially motivated, and countable — the programme is materially
larger than the 100 firms visible in the ranking.

This matters because in most of the 26 markets researched, no such channel existed. Field-inspection
vendors kept delivery in-house on purpose. Property vendors do the same. Kiosk's delivery firms turned
out to employ no developers at all. **Here there is a named population of engineering firms whose
business is building this software for other people, who already pay for tools, and who are already
organised into a programme.**

The budget is **OT capex** — the plant's capital expenditure for operational technology, attached to a
project ("we're putting in a new line"), not an IT software subscription line. That's why Ignition's
perpetual model fits: capex buyers prefer to buy a thing once.

---

## 4. Why NodeGX might fit

This is the only market in the study that **triggers none of NodeGX's known capability gaps.**

| NodeGX gap | Does this market care? |
|---|---|
| No offline/PWA | **No.** Plant screens are on a wired industrial network. If the network is down, the plant is down. |
| No camera/GPS/barcode/signature | **No.** Not part of the job. |
| No accessibility conformance | **No.** No public-sector procurement gate; these are private industrial sites. |
| No PDF generation | **Partly** — shift reports and batch records are often PDFs. [SM-004](../SM-004-THE-DOCUMENT-NODE.md) covers it. |
| SQLite backend | **Mostly no.** Process data usually lives in a separate historian or SQL database, not in the app's own store. |
| No kit licensing | Relevant only if we sell a kit — [SM-005](../SM-005-A-KIT-CAN-BE-SOLD.md). |

And on-premise, air-gapped deployment — a hard requirement here, since many plants are deliberately
not on the internet — is a **strength**, because NodeGX emits a static React app that can be served
from a box on the plant network with no cloud dependency.

### What a NodeGX project would concretely look like

*Illustrative — this is a worked example of the shape, not an observed customer.*

An integrator is commissioning a new bottling line for a regional brewery. The PLC work is done in
the vendor's own software. Now they need the operator interface.

They open NodeGX and build:

- **A line overview page.** A drawn schematic of the filler, capper, labeller and palletiser. Each
  machine is a component with inputs for `state`, `speed`, `faultCode`. The graph wires a data source
  to those inputs; the component renders green/amber/red and shows the current rate.
- **A data source.** The line's PLCs already publish to an **MQTT broker** the integrator installed —
  or a historian, or a SQL table updated by an existing SCADA. NodeGX subscribes and the values flow
  into the graph. *(This is the crux — see §6.)*
- **An alarms page.** A table over a backend collection. Operator taps Acknowledge; a record is
  written with the user, timestamp and alarm ID. The per-record ACL and audit trail NodeGX already has
  are exactly right for this — it's an auditable record of who silenced what.
- **A setpoint form.** Number input, validation, role-gated so only a supervisor can change it, writing
  back to the broker or an API the PLC layer reads.
- **A shift report.** A page that queries the last eight hours and renders totals and downtime
  reasons — and, with SM-004, exports a PDF the shift manager signs.
- **Deployment.** Static export, served from a small box on the plant network. Runs in Chrome on a
  panel PC, on a tablet on the line, and on the plant manager's phone over the site wifi.

The pitch to the integrator is not "a better authoring tool". It is: **"the operator interface is a
real web app you own, that you can put in Git, review in a pull request, and hand to the customer —
instead of a binary project file locked to one vendor's runtime."** That is a genuine difference and
it is about the *output*, not the editor.

---

## 5. What we'd have to build

Modest, and mostly already scheduled:

1. **A live-data seam.** Subscribe to MQTT, or poll a SQL/historian/REST endpoint, and push values
   into the graph continuously. This is the one genuinely new piece.
2. **PDF output** for shift and batch reports — [SM-004](../SM-004-THE-DOCUMENT-NODE.md), already Tier 1.
3. **A dashboard/HMI kit** — gauges, trend charts, alarm tables, mimic primitives, state indicators.
   This is [SM-009](../SM-009-THE-FIRST-VERTICAL-KIT.md) and it is deliberately *not* started until
   SM-001 reports.
4. **Nothing about protocols, if SM-001 comes back the right way.** Which is the whole question.

---

## 6. What kills it — and this is serious

### 6a. Node-RED is free, is exactly our shape, and is already on the hardware

**Node-RED is a flow-based visual programming tool** — you drag nodes onto a canvas and wire them
together. That is NodeGX's exact interaction model. It is free, open source, and enormously
established in this industry.

Measured from the npm registry, month to 2026-08-15:

| Package | Downloads |
|---|---|
| `node-red` | **151,791** |
| `node-red-contrib-modbus` | **44,650** |
| `node-red-contrib-opcua` | **38,285** |

Roughly a quarter to a third of Node-RED installs are talking directly to industrial equipment. For
free.

**And hardware vendors ship it pre-installed.** Opto 22's groov EPIC controller — a industrial
controller you buy for the plant floor — comes with *"pre-loaded CODESYS, Node-RED"*. The customer has
already bought the box; the flow-based tool is already on it, at zero marginal cost.

Any pitch here has to survive the question *"why not the thing that's already on the controller?"* —
and the honest answer has to be about the produced application (a real, reviewable, deployable React
app with proper auth and a database) rather than about the editor, because on editor-versus-editor
Node-RED wins on price and incumbency.

### 6b. Ignition's price list is substantially a driver catalogue

Look again at §2. OPC COM $885, Siemens Enhanced $300, SECS/GEM $1,060. **A large part of what
Ignition sells is the ability to talk to specific industrial hardware protocols** — OPC-UA, Modbus,
Ethernet/IP, Profinet and dozens of vendor-specific dialects.

Those protocols are not web protocols. They are binary, stateful, often over serial or industrial
Ethernet, with decades of vendor quirks. Implementing them is a specialist, unglamorous,
never-finished job. NodeGX has none of it and building it would be an enormous detour.

**So the entire market hinges on one question**, which is why [SM-001](../SM-001-THE-PROTOCOL-QUESTION.md)
exists and why nothing gets built before it reports:

> **Does the operator-facing app have to speak OPC-UA or Modbus *itself*? Or has the data already been
> collected into MQTT, a historian, or a SQL database by something else — so the visualisation layer
> just reads from a normal, web-friendly source?**

If it's the second, the protocol gap is an integration detail the integrator supplies once, with
hardware or software they already own, and we compete on the quality of the produced application
against an $11,225 module.

If it's the first, protocol support *is* the product, Node-RED already occupies the free tier of that
exact niche, and **this market collapses for the same reason kiosk did** — we'd be selling a tool into
a job we can't actually do.

### 6c. Honest unknowns

- **We have not spoken to a single integrator.** Everything above is desk research.
- **Safety-critical and regulated contexts** (pharma batch records under GxP, anything touching a
  safety instrumented system) carry validation burdens not researched here.
- **Ignition's ecosystem is sticky** — integrators have years of accumulated templates and expertise.
  Switching cost is real and unmeasured.
- **The market-size numbers are unusable.** As everywhere in this study, analyst forecasts for
  industrial software span implausible ranges. There is no credible TAM figure here; the argument
  rests on the published price floor and the existence of a countable channel, not on a market size.

---

## 7. The one-paragraph version

Industrial HMI is the software that shows a human what a factory is doing and lets them intervene —
mimic diagrams, alarm lists, trends, setpoints, shift reports. The reference product, Ignition, sells
its web visualisation module for **$11,225 perpetual with unlimited users**, which is the highest
verified price floor in the whole study, and it sells through a **channel of system integrators who
resell licences and are publicly ranked by how much they sell** — a countable, commercially motivated
buyer population, which most markets in this study lacked. It triggers none of NodeGX's capability
gaps, and air-gapped on-premise deployment is a strength rather than a problem. **But a large part of
what Ignition actually sells is industrial protocol drivers, and Node-RED — a free flow-based tool
with the same interaction model as NodeGX — is already installed on the controllers.** Whether this
market is enterable comes down to one measurable question about where the data already lives, which
is what SM-001 answers before anything is built.
