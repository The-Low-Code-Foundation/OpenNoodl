# BCN-003b — Notes

**One filter builder, and the port name a wire is already attached to.**

Read alongside [BCN-003b-ONE-FILTER-BUILDER.md](./BCN-003b-ONE-FILTER-BUILDER.md),
whose premises §1 corrects, and [BCN-003-NOTES.md](./BCN-003-NOTES.md) §8, whose
first unfinished item was this task's live QA.

> ⚠️ **The headline finding is not about this task.** The Parse-family visual
> filter has been **unreachable in the editor since WF-007** — for every project,
> not just this one. See §3. It is what the live QA ran into, and it is unowned.

---

## 1. Premises that were wrong

Three, and the first two change what the task is.

### 1.1 ⚠️ "A pure UI retirement — this task changes no data format at all"

> *"BCN-003 did the half that makes this cheap: the saved format already moved
> … So this task changes no data format at all — it is a pure UI retirement."*

That is true of the **BYOB** saved format, which is what BCN-003 moved. It is not
true of the Parse-family one, which is the format this task is retiring.

`QueryEditor` saved `{combinator, rules:[{property, operator: 'equal to', input}]}`.
The surviving builder saves `{id, type, conditions:[{field, operator, valuePortName}]}`.
Converging them **changes what is in a user's project file**, and the runtime
reads that file in two more places than the spec accounts for:

| Reader | What it does with the saved filter |
|---|---|
| `convertVisualFilter` | translates it to a Parse `where` |
| `_collectInputs` (both nodes) | **builds the dynamic `qp-`/`fp-` input ports from it** |
| the editor's property panel | renders the builder |

So the runtime reads **both shapes** now, exactly as BCN-003 made it migrate
BYOB's operator names in both the editor and the runtime: the editor rewrites the
old shape when a project is opened, and *a deployed app never opens the editor*.
An app whose filters stopped working the day its author upgraded is not "migrate
rather than break".

### 1.2 ⚠️ `neutralToSavedFilter` cannot be written, and writing it would have silently destroyed connected values

> Implementation step 1: *"Write `neutralToSavedFilter` beside the two existing
> converters."*

The mirror of `savedFilterToNeutral` does not exist as a function, because the
neutral model is lossy in exactly the direction this task needs.
`visualQueryToNeutral` **resolves** `input: 'term'` into whatever value the port
supplied. By the time a filter is neutral, the fact that its value came from a
port — and the port's name — is gone.

Round-tripping a saved filter through the neutral model would therefore have
turned every connected rule into whichever literal happened to be on the wire
when the project was opened, or dropped it. It would have looked correct on any
filter with no connected values, which is most test fixtures.

The two saved formats convert to each other **directly** (`visualQueryToSaved`),
and the neutral model stays what it is for: describing a query, not a builder's
state.

### 1.3 ⚠️ "`QueryEditor` and `QueryFilterType.ts` are deleted, not deprecated"

`QueryEditor/` also holds the **sorting** editor — `QuerySortingEditor`,
registered against the `query-sorting` port — and the spec's own Out of Scope
says *"Sorting. `convertVisualSorting` and the sorting UI are untouched."* The
two instructions contradict each other and deleting the directory would have
taken the sorting UI with it.

What happened instead: the filter half is deleted (nine component directories
plus `QueryFilterType.ts` and the filter half of `utils.ts`), and the directory
is **renamed `QuerySorting/`** so what it holds and what it is called are the
same thing. `QueryRulePopup`, `RuleDropdown` and `RuleInput` survive because
sorting uses them.

### 1.4 The count of `QueryEditor` sub-directories *(known, from the handover)*

15, not the "7 components" the spec's Current State says. Already recorded in the
handover into this task and confirmed.

---

## 2. The thing this task could have broken silently

**`QueryEditor` stored a parameter *name*; the builder stores a port name whole.**

| | Saved | Port the node declares |
|---|---|---|
| `QueryEditor` | `input: 'MyRecordId'` | `qp-MyRecordId` / `fp-MyRecordId` |
| `ByobFilterBuilder` | `valuePortName: 'filter_status_c1'` | that name, verbatim |

A migration that regenerated the port name — which is what adding a new row does,
via `generateFilterPortName` — **renames a port that may already have a wire
attached to it**, and a connection to a port that no longer exists is dropped
without a word. Nothing would have reported it.

So `visualQueryToSaved` takes `valuePortPrefix` as a **required** parameter
rather than defaulting it: there is no prefix that is right for both nodes
(`qp-` on Query Records, `fp-` on Filter Records, `filter_` on BYOB Query Data),
and guessing is the failure. The prefix is declared on the port itself, by the
node, beside the schema.

Two tests pin it — one in `@noodl/backend-contract` on the converter, one in the
editor's Jasmine suite on `generateFilterPortName` — and the live pass confirmed
the port survives a real save (§4).

### The affordance that was nearly lost with it

`QueryEditor` let the user **type** the parameter name, so two rules naming the
same one shared a single input port. Auto-generated names cannot do that. Rather
than lose it, the builder's port indicator is now a text input, for every filter
— BYOB users gain an affordance they did not have.

---

## 3. ⚠️ The Parse-family filter builder is unreachable in the editor, and has been since WF-007

**Not this task's, not fixable inside it, and it blocks more than this task.**

`SchemaHandler._fetch()` is a stub. WF-007 retired the master-key schema
introspection it used to do, and what replaced it is:

```ts
_fetch() {
  return new Promise<void>((resolve) => {
    this.dbCollections = [];
    this.systemCollections = [];
    this.haveCloudServices = false;   // ← only ever assigned `false`
    this._store();                     //    so `_store` always takes the else branch
    resolve();
  });
}
```

`_store()` therefore writes `setMetaData('dbCollections', undefined)` on every
window focus, forever. And **both Parse-family data nodes read that metadata to
decide what ports to declare**:

| Consequence | Where |
|---|---|
| The **Class dropdown is empty** — a user cannot pick a collection | `dbcollectionnode2.ts:702` |
| The **visual filter port is never declared** | `dbcollectionnode2.ts:805`, `filterdbmodelsnode.ts:508` |
| The **visual sorting port is never declared** | same guard |

Verified three ways: the source (`haveCloudServices` has one assignment in the
whole tree, and it is `false`), the running editor (`getMetaData('dbCollections')`
returns `undefined` on a project with a live backend), and the saved project file
(no `dbCollections` key after opening).

So Query Records and Filter Records currently have **no class picker, no visual
filter and no visual sort** in the editor. The Data Browser still lists
collections because it asks the backend directly through Backend Services — a
different path, which is why this is not obvious.

**BCN-004 or BCN-009 is the natural owner**: the schema a filter builder needs is
the same schema a converged backend adapter already fetches. Recorded in the
carried-forward table.

---

## 4. The live QA — the deliverable

Run in the real editor against a real `nodegx-backend`, with the §3 blocker
temporarily neutralised (one local edit to `SchemaHandler._fetch`, reverted
before committing; it is scaffolding, not a fix).

**Setup.** A `Person` collection on the built-in backend with four records —
Ada Lovelace (London, 36), Adam Smith (Edinburgh, 67), Grace Hopper (New York,
85, inactive), Alan Turing (London, 41). A Query Records node carrying a filter
in the **`QueryEditor` format**, written into `project.json` by hand so the
migration was exercised against real project data rather than a fixture:

```json
{"combinator":"and","rules":[
  {"property":"city","operator":"equal to","value":"London"},
  {"property":"name","operator":"contain","input":"SearchTerm"},
  {"combinator":"or","rules":[
    {"property":"age","operator":"greater than","value":40},
    {"property":"active","operator":"exist"}]}]}
```

### What it showed

| Claim | What was observed |
|---|---|
| One builder renders for a Parse `query-filter` port | The `ByobFilterBuilder` modal opened on a Query Records node. `QueryEditor` is gone from the tree |
| The old format is read | The property row read **"4 conditions, 1 group"** and the modal showed all four rules with the nested OR intact |
| The connected value keeps its port | The row showed **`SearchTerm`**, in an editable field, with `qp-` stripped for display |
| The wire survives a save | After **Save Filter**, `valuePortName` was `"qp-SearchTerm"` and the node still declared the `qp-SearchTerm` input port |
| Ids are stable | Saved as `q-0`, `q-1`, `q-2`, `q-2-0`, `q-2-1` — derived from position, so opening a project twice does not dirty it |
| Relations are reachable | **"Add Relation"** appeared (the schema had `relations: {Team:[{property:'members'}]}`) and added a rule with collection + relation-property dropdowns |
| The operator dropdown is gated | The string list offered all 18 operators with no caveats — correct for `nodegx`, which is the one backend where every one of them is `supported` |
| The runtime asks the right question | See below |

### The request the runtime actually sent

Captured off the viewer's own network stack:

```json
{"_method":"GET","where":{"$and":[
  {"city":{"$eq":"London"}},
  {"$or":[{"age":{"$gt":40}},{"active":{"$ne":null}}]}]},"count":true}
```

Three things are visible in that one document:

1. **The `name contains` rule is absent** — its `qp-SearchTerm` port is
   unconnected, and an unconnected filter port has always meant "do not filter by
   this". That behaviour survived the format change, which is what
   `dropUnresolvedConnected` exists for (§5).
2. `active exists` became `{"$ne":null}`, not `{"$exists":true}` — BCN-003's
   correction, arriving through the new path.
3. The nested OR is intact.

**Rows returned: Ada Lovelace and Alan Turing.** The two Londoners; not
Edinburgh, not New York.

### What the live pass did *not* cover

- **The BYOB side was not driven with a mouse.** `byob-filter` goes through the
  same type view and the same builder, and its unit tests and the editor suite
  pass, but no BYOB backend was configured in the rig for this run. The spec asks
  for a Directus pass; it is owed.
- **A connected filter value was never wired to a real source**, so the
  *resolved* branch of `dropUnresolvedConnected` was proved by test rather than
  by mouse. The dropped branch was proved live, and it is the one that changes
  what a query returns.
- **`relatedTo` was added but not executed.** The rule appears and saves; no
  record with a relation existed in the corpus to query. BCN-005 owns relations.

---

## 5. The decision worth arguing with

**The two builders disagreed about an unresolved connected value, and both were
right for their own nodes — so it is a parameter, not a choice.**

- `QueryEditor` **dropped the rule.** A Query Records node with an unconnected
  "search term" input is meant to return everything, and every Parse-family graph
  in every project relies on it.
- `ByobFilterBuilder` **keeps the last literal typed**, because its connected
  values are opt-in on a row that already had one.

Picking either one globally would have silently changed what an existing app
queries for, in a way no test in either package would have caught — the failure
class this phase exists to close. `SavedToNeutralOptions.dropUnresolvedConnected`
carries it, the Parse-family nodes pass `true`, and BYOB does not.

---

## 6. Where the capability gate reads a floor

`getOperatorsForType(type, capabilities)` filters the dropdown by the resolved
backend's descriptor and attaches a `degraded` cell's `reason` verbatim as the
row's caveat — the same string the translator throws, which is the whole reason
BCN-003 put the declaration in the descriptor rather than in each translator.

Two honest limits:

- **The Parse-family port declares `QueryUtils.backendType()`, which is a floor.**
  `CloudStore._handle()` still answers `nodegx` unconditionally (BCN-009's step 4,
  unstarted), so a project pointed at an upstream Parse Server is gated against
  our own backend's table. That is the *more permissive* of the two, so it can
  only fail to gate an operator — never gate one off that the backend could have
  answered. The reverse would be harmful; this is not.
- **The BYOB port declares `directus` unconditionally**, matching what
  `byob-query-data` actually sends for every BYOB backend type. Making the other
  three real is BCN-004's; declaring the resolved type here would gate against a
  table describing a request we do not send.

An operator a backend cannot express is **not offered**, but a filter saved when
it could be **keeps its row and keeps it selected**, with the reason underneath.
Silently rewriting a saved rule into a different operator would be worse than
either.

---

## 7. Evidence

| Claim | How it is evidenced |
|---|---|
| One builder | `QueryEditor/`'s filter half deleted; `query-filter` and `byob-filter` both resolve to `ByobFilterType` |
| A pre-BCN-003b Parse filter asks for the same thing | Acceptance test: `visualQueryToNeutral → toParseWhere` and `visualQueryToSaved → savedFilterToNeutral → toParseWhere` produce the *same* document, over a corpus with nested groups, a pointer, a relation, presence and an unconnected port |
| The port name survives | Unit test on `visualQueryToSaved`; live, `qp-SearchTerm` still declared after a real save |
| Ids do not dirty a project | Test: the same input twice gives the same output |
| Both saved shapes are read at runtime | `convertVisualFilter` and `collectFilterParameters` tests, both shapes |
| The gate reads the descriptor | Editor spec: an `unsupported` cell is not offered, a `degraded` cell's own sentence becomes the caveat |
| The whole chain works | §4 — legacy filter → migrated → saved → translated → real backend → the right two rows |

| Package | Result |
|---|---|
| `@noodl/backend-contract` | 98 passed |
| `@noodl/runtime` | 1365 passed, 13 skipped |
| `@noodl/noodl-editor` (Jasmine) | **1923 specs, 0 failures** |
| `@noodl/nodegx-backend` | 729 passed, 10 skipped |
| `@noodl/noodl-viewer-react` | 367 passed |
| `@noodl/noodl-viewer-cloud` | 57 passed |
| `@noodl/noodl-core-ui` / `@noodl/preview` | 44 / 14 passed |
| `@noodl/mcp` | 101 passed, **1 pre-existing failure** (`tools.test.ts`, unowned) |

---

## 8. Carried forward

| Item | Owner |
|---|---|
| ⚠️ **`SchemaHandler` never populates `dbCollections`, so Query Records has no class picker, no visual filter and no visual sort in the editor.** Since WF-007 | **unowned — BCN-004 or BCN-009** |
| A live pass on the BYOB side of the converged builder, against Directus | BCN-004 |
| `relatedTo` executed against a backend, not only authored | BCN-005 |
| `CloudStore._handle()` answers `nodegx` unconditionally, so the operator gate reads a floor | BCN-009 step 4 |
| The `byob-filter` port declares `directus` because that is what the node sends | BCN-004 |
| A dialect picker for a `custom` backend | BCN-009 |
| Proximity *sorting* for `nearSphere` on the built-in backend | — |

---

## 9. For whoever drives the editor next

- **The property panel silently drops every port from the first one whose type
  view is missing onward.** `_getPorts` filters on `viewClassForPort(p) !== undefined`,
  so a broken registration looks exactly like a stale panel. Reproduce the
  classification directly — `Ports.prototype.viewClassForPort.call({}, port)` —
  before assuming a refresh problem.
- **Check how many nodes of the type you think you are inspecting exist.** Two
  `DbCollection2` nodes in one component cost this session an hour: the one on
  screen had six ports and the one being reasoned about had nine.
- **The built-in backend is a child process of the editor** and dies with it, so
  a project that opens before the backend is up never gets its metadata. Run
  `node bin/nodegx-backend.js serve --data-dir ~/.noodl/backends/<id> --port <p>`
  standalone first if you need it reachable at launch.
- The editor's `webpackChunknoodl_editor` gives access to every loaded module:
  `push([['probe'],{},req => cache = req.c])`. That is how `ProjectModel`,
  `NodeLibrary` and the node's real port list were read here, and it is far more
  reliable than driving chrome.
