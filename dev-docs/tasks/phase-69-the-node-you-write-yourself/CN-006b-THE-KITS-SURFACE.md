# CN-006b — The kits surface

| Field | Value |
|---|---|
| **Tier** | 2 |
| **Effort** | M |
| **Surface** | `editor` |
| **Rulings** | ✅ **D1** — first-class, **with provenance shown** · ✅ **D6** (provenance is what consent hangs on) |
| **Depends on** | CN-003 for the type/port data; CN-006 for the create command it launches |

## Why this exists

Ruling D1 made kits a first-class project concept rather than a folder convention. Today a
`noodl_modules/<kit>/` folder is **completely invisible in the product** — no panel lists it, and the
only way to learn a kit exists is to look at the filesystem. Open somebody else's project and you
cannot tell which nodes are custom, which kit they came from, or what version.

## P1, as narrowed — read this before designing anything

> **P1 — a custom node is a node: there is no *capability* difference.** Provenance **display** is
> explicitly allowed and wanted.

The distinction is the whole design brief. **Never** gate, badge-as-lesser, warn about, or
visually demote a kit node for being a kit node. **Do** answer "where did this come from?" on demand,
because when a node misbehaves that is the first question, and because ✅ **D6** makes provenance the
thing a consent decision is recorded against.

A useful test for any pixel in this task: *does this help a user find the author, or does it tell
them this node is worth less?* The first is D1; the second violates P1.

## What to build

1. **A kits list.** Natural home is beside ERG-002's Libraries section in project settings — same
   family, adjacent concept, and it already has the card/list/empty-state patterns
   (`sections.module.scss`, `VariableCard`, `ButtonRow`). Each row: kit name, version, the nodes it
   provides (count, expandable to names), provenance (local / library / URL), and remove.
2. **A create entry point** that calls CN-006's generator and opens `index.js`.
3. **Provenance in the property panel.** Selecting a kit node shows which kit and version it came
   from, with a link to its docs — the `docs` field already exists on `ReactNodeDefinition` and is
   already carried through `nodelibraryexport.ts`.
4. **Reuse `ProjectModel.listModules`** rather than adding a read path. `projectmodules.ts` is the
   single scanner (LIB-003) and CN-001 has already moved its core into a shared package.

## Acceptance criteria

1. A project with a kit lists it, with the right node count and version, without opening a terminal.
2. Selecting a kit node names its kit in the property panel; selecting a built-in shows no
   provenance row (there is nothing to attribute) and is **otherwise identical** — same groups, same
   controls, same affordances.
3. Removing a kit removes its folder and the nodes leave the picker without a restart.
4. **The P1 check, done deliberately:** screenshot the property panel of a kit node and a built-in
   side by side. Any difference other than the provenance row is a finding.

## Traps

- 🔴 **Measure the element you claim about.** The components panel is a live example: its tree rows
  measure **0×0 mid-expand**, so a probe run immediately after a click reads a hidden or unsettled
  box. Re-measure before asserting.
- 🔴 **`BaseDialog` renders every dialog twice** — filter `:not([class*=MeasuringContainer])` or a
  DOM assertion will match the measuring copy.
- ⚠️ **State that rides on a save is lost for a reader.** If kit metadata is only persisted through
  `toJSON`, someone opening the project without saving sees nothing. There is a recorded case of
  exactly this that no spec caught, because the spec had a save in it.
- ⚠️ **Opening a project already writes three files.** Do not make listing kits a fourth write.

## Out of scope

- Install/publish flows (CN-016) and the trust gate (CN-017). This task **displays** provenance;
  CN-017 decides what provenance permits.
