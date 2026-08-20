# 000 — Initial scope

_Recorded 2026-08-20T07:40:27.090Z, from the scoping conversation held before this project was created._

## What was asked for

> Author the solution project for TUT-003, the first community tutorial: a one-page "log a thing" app where a Visual Function validates and shapes the typed entry, fans out on send signal to Create Record, and a Query Records feeds the list back through a Repeater.

## What was decided

**The app.** A one-page log: type a line, press Log it, and it is saved to the built-in database and appears in the list below. It exists to teach one rule — the Visual Function computes, the canvas does the async work, and the signal wire is the await.

**Who it is for.** A builder taking their first NodeGX tutorial, who has asked (or is about to ask) "how do I call the database from blocks?"

**Pages.**

- Home — The whole app: a text field, a Log it button, a status line, and the list of saved entries.

**Records.**

- LogEntry — One line the builder typed and saved. — title

**Backend.** One collection, created by the LEARNER in the Data browser rather than shipped with the bundle - a lesson bundle is a project directory and cannot carry a database.

**Rules for this project.**

- The Repeater's row template is its own component - parameters.template names a component, so a list is always two components
- Every node a lesson step addresses carries a label, so conditions can be written as #Label rather than %Type (F3)
- Collection name LogEntries is spelt identically in the graph, in lesson.json and in the step prose

## What was considered and rejected

This is the section with the longest shelf life. It is what stops the next reader — or the next
assistant — helpfully rebuilding something that was deliberately left out.

- **Shipping the LogEntries collection pre-made inside the bundle** — rejected: R3, answered 2026-08-20: a bundle is a project directory, a backend lives at ~/.noodl/backends/<id>, and nothing in the editor seeds one. Pre-made was unimplemented mechanism, not a pedagogy choice. The learner creates it, which is also the half TUT-002's collectionExists verb was built to grade.
- **Adding data blocks (create record / query) to the Visual Function** — rejected: README section 0: the Visual Function compiles with a synchronous new Function, and all five block families that would need async already have canvas nodes. Async lives on the canvas; blocks are synchronous computation.
- **Wiring Create Record's terminal signal as Success** — rejected: ERG-001 collapsed created and its three siblings into one displayed Done. The Visual Function's terminal signal is Success and Create Record's is Done; both names are right and both are on this canvas.

## Deliberately out of scope

- Editing or deleting an entry - the tutorial teaches the create/read composition and stops there
- Sign-in or per-user entries
- Any second page; a Router with one route is enough to make the page reachable
- Async blocks inside the Visual Function - this project exists to teach that they are deliberately absent

## Still open

> TODO: R2 - what provenance a community bundle installs under - is still owed by Richard and blocks TUT-004 AC3, not this project

## Proposed build plan

Produced from the scope above and handed over unexecuted — no components were authored during
scoping. Review it before building.

1. **provision `App backend`** — Give this project a built-in backend that runs on this computer. Collections: LogEntries. The conversation said: One collection, created by the LEARNER in the Data browser rather than shipped with the bundle - a lesson bundle is a project directory and cannot carry a database.
2. **update `Pages/Home`** — The whole app: a text field, a Log it button, a status line, and the list of saved entries. Follow docs/CONVENTIONS.md; docs/BRIEF.md says what this app deliberately does not do.

<!-- The same plan, for the editor to read back if it is offered again. Safe to delete. -->

```json nodegx-plan
{
  "version": 1,
  "plan": {
    "request": "Author the solution project for TUT-003, the first community tutorial: a one-page \"log a thing\" app where a Visual Function validates and shapes the typed entry, fans out on send signal to Create Record, and a Query Records feeds the list back through a Repeater.",
    "operations": [
      {
        "id": "op-1",
        "kind": "provision",
        "target": "App backend",
        "intent": "Give this project a built-in backend that runs on this computer. Collections: LogEntries. The conversation said: One collection, created by the LEARNER in the Data browser rather than shipped with the bundle - a lesson bundle is a project directory and cannot carry a database.",
        "provision": {
          "name": "App backend",
          "collections": [
            {
              "name": "LogEntries",
              "columns": [
                {
                  "name": "title",
                  "type": "String"
                }
              ]
            }
          ],
          "needsAuth": false
        }
      },
      {
        "id": "op-2",
        "kind": "update",
        "target": "Pages/Home",
        "intent": "The whole app: a text field, a Log it button, a status line, and the list of saved entries. Follow docs/CONVENTIONS.md; docs/BRIEF.md says what this app deliberately does not do."
      }
    ],
    "scroll": "page"
  }
}
```

## Transcript

_(no transcript was captured)_
