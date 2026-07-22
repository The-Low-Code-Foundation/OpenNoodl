# ECO-002: Component & Adapter Marketplace

## Metadata

| Field | Value |
|-------|-------|
| **ID** | ECO-002 |
| **Phase** | Phase 20 — Ecosystem (Revival Horizon 3) |
| **Status** | 🔒 **Gated — do not start before Gate G3 and evidence of community critical mass** |
| **Scale** | 2–3 months |
| **Prerequisites** | SUB-001, SUB-004 (Phase 13); RUN-003 (UBA adapters); LEARN-002 (lesson packs) |
| **Recommended executor** | 🟠 **Opus 4.8** — conventional platform engineering; the hard parts are trust, moderation, and versioning policy rather than novel technique. |

*This is a specification, not an implementation plan. See the [phase PROGRESS notes](./PROGRESS.md) for why.*

## What this is

A registry where the community shares reusable units: Noodl components, UBA backend adapters, and lesson packs.

## Why it might matter

The decomposition work in Phase 13 makes sharing genuinely feasible for the first time. A component is now a small directory of files with a declared interface, described in a machine-readable catalog — a portable unit rather than a fragment of someone's monolithic project. UBA adapter configurations are already data. Lesson packs, once LEARN-001's content format exists, are documents.

Beyond the mechanics, a marketplace is how a tool stops depending entirely on its maintainers for breadth. Every backend someone wants supported, every UI pattern, every curriculum module becomes something a community member can add without a core change. For a project whose entire history is one person's capacity being the constraint, that is strategically significant.

## Why it is gated on community, not just on G3

A marketplace with nothing in it is worse than no marketplace: it signals abandonment more loudly than absence would. This needs a community producing things worth sharing *before* the infrastructure to share them is built — which means it follows adoption rather than causing it.

The honest sequencing test: are people already sharing components informally, by sending each other files or posting them in a forum? If yes, build the registry. If not, building it will not create the behaviour.

## Open questions to resolve first

- **What are the shareable unit types**, and do they need different treatment? A component, an adapter config, and a lesson pack have quite different trust and versioning profiles.
- **Trust and safety.** A shared component can contain Function nodes running arbitrary JavaScript. What is the review, sandboxing, or warning model? This is the hardest question here, and it is more serious for the education audience than for professionals.
- **Versioning and compatibility.** Components depend on node types that change; the catalog gives a way to express requirements, but the policy needs deciding.
- **Hosting.** Git-based (a repository index), a purpose-built registry, or reuse of npm?
- **Curation.** Fully open, curated, or tiered?
- **Licensing** of shared content, and how it is expressed and enforced.

## Rough shape of the work

Package format and manifest; publish and install flows in the editor; a registry backend or Git-based index; search and discovery; versioning and dependency resolution against the catalog; trust/safety review process; licensing metadata.

## Dependencies

- SUB-001 (portable component files), SUB-004 (catalog for compatibility declarations)
- RUN-003 (adapter configs as shareable artifacts), LEARN-001/002 (lesson packs)
- Possibly ECO-004 for hosting
- Gate G3, plus evidence of informal sharing already happening

## Scale

2–3 months for the mechanism. The ongoing cost — moderation, curation, and support — is permanent and should be budgeted before starting.
