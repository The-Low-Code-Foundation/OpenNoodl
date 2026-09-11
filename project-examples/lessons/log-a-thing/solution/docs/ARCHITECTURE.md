# Architecture

## Page map

- **Home** (`Pages/Home`) — The whole app: a text field, a Log it button, a status line, and the list of saved entries.

## Data model

### LogEntry

One line the builder typed and saved.

Fields:
- title

## Backend contracts

One collection, created by the LEARNER in the Data browser rather than shipped with the bundle - a lesson bundle is a project directory and cannot carry a database.

## Decisions

Considered during scoping and deliberately not done:

- **Shipping the LogEntries collection pre-made inside the bundle** — R3, answered 2026-08-20: a bundle is a project directory, a backend lives at ~/.noodl/backends/<id>, and nothing in the editor seeds one. Pre-made was unimplemented mechanism, not a pedagogy choice. The learner creates it, which is also the half TUT-002's collectionExists verb was built to grade.
- **Adding data blocks (create record / query) to the Visual Function** — README section 0: the Visual Function compiles with a synchronous new Function, and all five block families that would need async already have canvas nodes. Async lives on the canvas; blocks are synchronous computation.
- **Wiring Create Record's terminal signal as Success** — ERG-001 collapsed created and its three siblings into one displayed Done. The Visual Function's terminal signal is Success and Create Record's is Done; both names are right and both are on this canvas.

Left open:

> TODO: R2 - what provenance a community bundle installs under - is still owed by Richard and blocks TUT-004 AC3, not this project

_Scoping record: `docs/decisions/000-initial-scope.md`._
