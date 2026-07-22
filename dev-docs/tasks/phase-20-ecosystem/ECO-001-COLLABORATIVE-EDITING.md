# ECO-001: Real-Time Collaborative Editing

## Metadata

| Field | Value |
|-------|-------|
| **ID** | ECO-001 |
| **Phase** | Phase 20 — Ecosystem (Revival Horizon 3) |
| **Status** | 🔒 **Gated — do not start before Gate G3** |
| **Scale** | 4–6 months |
| **Prerequisites** | SUB-001, SUB-007 (Phase 13); Gate G3 |
| **Recommended executor** | 🔵 **Fable 5** — CRDT design for a graph with semantic constraints is genuinely hard research-adjacent work, and the data model decisions are effectively permanent. |

*This is a specification, not an implementation plan. See the [phase PROGRESS notes](./PROGRESS.md) for why.*

## What this is

Multiple people editing the same Noodl project simultaneously and seeing each other's changes live — the node-graph equivalent of collaborative document editing.

## Why it might matter

Two quite different audiences want this, which is unusual and makes it the strongest Horizon 3 candidate regardless of how Gate G3 resolves:

**For education (Phase 17's wedge):** a teacher watching twenty-five student graphs update live is a genuinely new teaching capability, not a convenience. It makes the invisible visible — who is stuck, who has wired something backwards, who has stopped. Classroom software that offers this tends to become the tool teachers insist on. This is plausibly the single highest-value feature in the entire Horizon 3 set for the education case.

**For teams (the professional wedge):** collaborative editing is table stakes in modern design and development tools. Its absence is a reason teams do not adopt a tool at all.

The designs differ, though, which is a reason to wait for G3 rather than guess: the classroom case wants observation and light intervention across many projects, while the team case wants symmetric co-editing of one project with presence and conflict avoidance. Building for the wrong one first would be expensive.

## Why v2 makes this feasible

Real-time collaboration on a monolithic project JSON would be close to impractical — every change touches one enormous document, and conflict resolution has no natural boundaries. The decomposed v2 format changes that: per-component files give a natural granularity for both synchronisation and conflict scope, and SUB-007's semantic diff work will already have established how graph changes are represented and reconciled.

That is a real dependency rather than a convenient framing. This task should not be attempted without SUB-001 and SUB-007 complete.

## Open questions to resolve first

- **CRDT or OT, and at what granularity?** Per-component, per-node, or per-property. Finer granularity means better concurrent editing and much more complexity.
- **How are semantic constraints preserved under concurrent edits?** Two users can each make a valid change that is invalid in combination — a connection to a node the other deleted. CRDTs guarantee convergence, not validity. SUB-006's semantic validator likely has a role here.
- **Server or peer-to-peer?** A sync server implies infrastructure and pushes toward ECO-004; peer-to-peer avoids that but complicates classroom scenarios on managed networks.
- **What does presence look like on a canvas?** Cursors, selections, viewport indicators — and how does it stay legible with twenty-five participants rather than three?
- **Offline and reconnection.** Especially relevant to classrooms with unreliable networks.
- **How does this interact with Git?** Two different models of collaboration; they must coexist coherently rather than fight.

## Rough shape of the work

Data model and CRDT design; a synchronisation layer; presence; canvas UI for remote participants; conflict and validity handling; offline/reconnect; classroom-specific observation views if the education wedge wins G3.

## Dependencies

- SUB-001 (per-component files), SUB-007 (graph change representation), SUB-006 (validity checking)
- Possibly ECO-004 if a sync server is required
- Gate G3 for the design direction

## Scale

4–6 months, and genuinely so — this is the largest single item in Horizon 3. Do not start it as a side project.
