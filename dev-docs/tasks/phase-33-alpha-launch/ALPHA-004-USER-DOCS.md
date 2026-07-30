# ALPHA-004: Documentation for someone who is not us

## Metadata

| Field | Value |
|-------|-------|
| **ID** | ALPHA-004 |
| **Phase** | Phase 33 — Alpha Launch (Track R) |
| **Tier** | 2 — makes the alpha worth running |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium — the writing is easy; not writing the node reference twice is the discipline |
| **Estimated Time** | 1–1.5 wks |
| **Prerequisites** | **Phase 30 Tier 1**, and NDA-005 far enough along that port descriptions are real |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** — this decides a vocabulary the product, the AI prompts and the lessons all reuse |

## Objective

A person who has downloaded NodeGX and never seen a node graph can build something
that works, without asking us.

## Current state

Everything under `docs/` is developer or runtime reference:

```
docs/format/MIGRATING-TO-V2.md
docs/node-catalog/{SCHEMA,ENRICHMENT,ACCEPTANCE}.md, patterns.md, examples/
docs/research/rise-assessment.md
docs/runtime/  (16 files: BACKEND-*, REALTIME, RENDERING-MODES, TRIGGERS, …)
```

Excellent documents, all of them written for someone who already knows what NodeGX
is. There is no "what is a node", no "what is a component", no "why does this wire
not do anything", no getting-started. `README.md` and `CONTRIBUTING.md` address
contributors, not users.

## The rule that shapes this task

**Derive, never author twice.**

Phase 30 exists partly because 95% of 2,650 ports were undocumented, and NDA-005 is
writing those descriptions into the node definitions themselves — where the editor,
the node catalog, the AI authoring loop and the semantic validator all read them.

**The node reference must be generated from that**, not written by hand. A
hand-written node reference is stale the day a port is renamed, and it competes with
the catalog for authority — which is precisely the failure phase 30 is fixing one
level down.

So this task writes the part that cannot be derived: the concepts, the path through
them, and the first project. It *generates* the rest.

## Scope

### 1. The concept set (authored)

Small and finished, not a wiki. The terms a user must hold to read anything else:

- node, port, wire, signal vs value — **the signal/value distinction is the single
  highest-value paragraph in this entire document**, and it is where the runtime's
  own contracts live (`REACTIVITY-CONTRACT.md`, `PORT-TYPE-CONTRACT.md`)
- component, and why a component is also a node
- the canvas, sheets, and the visual tree
- preview vs deployed
- data: collections, records, variables
- what runs in the browser and what runs on the backend — NodeGX is one of the few
  tools that knows, and a user who does not will put an API key on a frontend node

Written once, in the product's actual vocabulary, and reused by the AI prompts and
the Learn curriculum rather than re-invented by each.

### 2. Getting started (authored)

One path, start to finish, that produces something real. Not a tour. It ends with a
working app the user made, and it uses the same fixture path ALPHA-001 walks, so the
two tasks pressure-test each other.

### 3. The node reference (generated)

From the enriched catalog NDA-005 produces. Per node: what it is for, its ports with
descriptions and types, its failure outputs, and its contract notes. A build step,
with a CI check that it is not stale — the same shape as the existing
`cloud-library:check` gate, and for the same reason: a silent regeneration is how a
node quietly appears or disappears.

### 4. Troubleshooting (authored, harvested)

The known-issue list is already written, scattered across
`dev-docs/reference/COMMON-ISSUES.md` and thirty task NOTES files. Harvest the
user-facing subset. Start with the ones that have already bitten real users:

- an Icon node rendering the raw text `dehaze` — the project has no iconset module
  installed, and nothing warns (diagnosed during phase 24, still unowned)
- what to do when a preview does not update
- where projects live on disk

## Acceptance criteria

1. A user who has read only the concept set and getting-started can build a working
   two-page app with data — demonstrated by **a person who has not seen NodeGX
   before**, not asserted.
2. The node reference is generated, and a CI check fails when it is stale.
3. No node's ports are documented in two places. If prose duplicates the catalog,
   the prose is wrong by construction and must be deleted.
4. The concept vocabulary is the same one the AI prompts and the Learn curriculum
   use; where it differs today, one of them changes and the record says which.
5. Every document says which NodeGX version it describes.

## Relationship to Phase 17 (Learn)

This is not the curriculum. LEARN-002 is a designed 12-lesson progression with
assessment, waiting on Richard as learning designer. This is reference material and
one linear path — what a lesson would assume you could look up. They should share
the concept vocabulary and nothing else; if this task starts producing lessons, it
has escaped its scope.
