# DEF-036 — the Record family keeps its wires without a schema; the User family does not

**Status:** ⬜ **open — measured, unbuilt.** Owner: **phase 80**.
**Found by:** DEF-035's AC5 drive (2026-08-31, s34), §6.3.
**Who it bites:** every app whose sign-up or profile screen wires a custom column on the
accounts table — **271 wires across 21 of the 118 corpus projects.**

---

## 1. The person sentence

**Your sign-up form quietly stops writing the fields you added to it, and your build is
the first place you find out.** Nothing is reported: the wires are on the canvas, they
are absent from the artefact, and the artefact does not say what it dropped.

## 2. The mechanism

Both families mint their `prop-<column>` ports from the introspected schema through
`resolveSchemaPortContext`. Only one of them has a second producer for when there is no
schema to read.

⚠️ **The User family is not one code path but two**, and neither has a net. Naming both
matters: a fix applied to one leaves the other exactly as it is.

| | Record family | User family — path 1 | User family — path 2 |
| --- | --- | --- | --- |
| nodes | `DbModel2`, `NewDbModelProperties`, `SetDbModelProperties` | `net.noodl.user.User`, `net.noodl.user.SetUserProperties` | `net.noodl.user.SignUp` |
| where | `noodl-runtime/…/data/` | `noodl-runtime/…/user/user-ports.ts` | `noodl-viewer-react/…/user/signup.ts` |
| schema-half producer | `recordFieldPorts` | `userPropertyPorts` via `userSchemaContext` | an inline loop in `updatePorts` |
| reads | the introspected schema | `ctx.selectedCollection` | **`systemCollections` metadata**, looking for `_User` |
| gives up when it is empty | — | `if (!ctx.selectedCollection) return ports` (`user-ports.ts:242`) | `if (c && c.schema && c.schema.properties)` never enters (`signup.ts:215`) |
| **wire-half producer** | **`recordWiredFieldPorts`** — `dbmodelcrudbase.ts:392`, `dbmodelnode2.ts:554` | **none** | **none** |
| ports with the schema empty | every field a wire names, typed `'*'` | **none at all** | **none at all** |

🔴 `_store()` writes `dbCollections` **and** `systemCollections` in the same act, so one
wipe takes out both paths at once — which is why the drive lost wires on `User` and on
`SignUp` in the same export.

`recordWiredFieldPorts` (`record-ports.ts:312`, built by P77 **SBR-008** for the deploy
path) walks the node's own connections and mints `prop-<field>` for any field a wire
names that the schema half did not cover. Its docblock states the rule plainly: **"the
wire is the declaration."**

`user-ports.ts` has no such call. `userSchemaContext` resolves the accounts table out of
`base.collections`; with the schema cache empty that list is empty, `selectedCollection`
is `undefined`, and the node offers no `prop-*` port. The wires into and out of it are
then `con-no-target-port` / `con-no-source-port`, both **`level: 'error'`** — and
DEF-034 established that an error is exactly what still deletes a wire from an export.

⚠️ **This is not DEF-035.** DEF-035 stopped the cache being *wiped over an answer we did
not get*. This is what happens on a read that is genuinely empty, or before the first
successful read of a project's life — a case DEF-035 deliberately leaves alone, because
"the backend says it has no tables" is an answer and must be recorded as one.

## 3. The measurement

Driven, not derived — DEF-035 §6. A copy of `LearnBook`, real editor, real export:
with the schema cache emptied, **14 wires left the build and all 14 were
`net.noodl.user.*`.** No Record wire moved. The corpus predicate agrees on the same
fixture at 14, and over all 118 projects splits the population:

| | wires | projects |
| --- | ---: | ---: |
| Record family — protected by `recordWiredFieldPorts` | 3,579 | — |
| **User family — unprotected** | **271** | **21** |

Worst: `emdashdev` 53 · `Resourceful` 33 · `30d29729-…` 26 · `SuntappedX` 16 ·
`LearnBook` 14.

🔴 **The corpus is a regression net, not a ranking.** These are the projects on this
machine; the product surface is every app anyone builds a sign-up form in.

## 4. Acceptance criteria

- **AC1** — a User-family node with an empty schema still offers a `prop-<field>` port
  for every field one of its own wires names, so the wire survives an export.
- **AC2** — where the schema *is* available, the schema half still wins: one port per
  name, keeping the narrowed column type. Asserted by cardinality, not by presence —
  two producers meeting is how a double gets shipped green.
- **AC3** — the account columns each path already refuses stay refused:
  `USER_INPUT_IGNORE_PARSE_BROWSER` / `USER_OUTPUT_IGNORE_PARSE` / the REST pair on path
  1, and `signup.ts`'s `_ignoreKeys` (`authData`, `password`, `username`, `createdAt`,
  `updatedAt`, `emailVerified`, `email`) on path 2. **A net that resurrects a port from
  a wire must not resurrect one of these** — a wire naming `prop-password` is the case
  to write the spec around.
- **AC4** — driven: the `LearnBook` copy exports its 14 User wires with the cache cold.
- **AC5** — `test:ci` returns to its known floor.

## 5. What to read first

- `packages/noodl-runtime/src/nodes/std-library/data/record-ports.ts:312` —
  `recordWiredFieldPorts`, including the cost its own docblock states: a mistyped
  `prop-titel` writes a `titel` column instead of warning. **The same cost transfers**,
  and it is Richard's call whether the accounts table should accept it — a stray column
  on `_User` is not the same kind of accident as one on an app table.
- `packages/noodl-runtime/src/nodes/std-library/user/user-ports.ts:237` —
  `userPropertyPorts`, whose first line is the give-up; its callers are
  `user.ts:492` and `setuserproperties.ts:257`.
- `packages/noodl-viewer-react/src/nodes/std-library/user/signup.ts:203` — the second
  path, in a different package, keyed on a different metadata key. ⚠️ **It is not
  reachable from `user-ports.ts` and will not be fixed by fixing that file.**
- P77 `SBR-008-THE-DEPLOY-KEEPS-THE-PANELS-WIRES.md` §the-writers-table — the design
  that already exists, and the reason it was only ever pointed at one family.

🧭 **A decision, not only a fix.** AC1 is straightforward; whether the accounts table
should get the same "the wire is the declaration" rule as an app table is a product
judgement, and this row should not be built as if it were not.

---

## 6. 🔴 Part 3 measured before building — 2026-08-31, s38. **The canvas half already ships.**

The ruling's *"what to check before building"* asked whether a missing schema field reaches the
dashed state or goes straight to `level: 'error'` and silent deletion. **Checked at HEAD, and the
answer splits the sentence in two.** Read from source, not driven — see the boundary at the end.

| Richard's clause | today | where |
| --- | --- | --- |
| *"it would remain"* on the canvas | ✅ **already true** | nothing prunes it — see below |
| *"but be a dotted line"* | ✅ **already true** | `NodeGraphEditorConnection.ts:960` |
| *"the errors would flag that the port doesn't exist anymore"* | ✅ **already true** | `con-no-target-port`, `level: 'error'`, `showGlobally: true` |
| dropped from the **build** | 🔴 **true, and this is the whole gap** | `exporter/util.ts`, `{ levels: ['error'] }` |

**The three readings.**

1. **Nothing prunes the connection.** `removeConnection` is reached only from
   `removeConnectionsForNode` (a node being deleted) and explicit gestures.
   `evaluateConnectionHealth` *records a warning* and never deletes. A wire whose port vanished
   stays in `comp.graph.connections`.
2. **It is already dashed, and for the error level specifically.**
   `NodeGraphEditorConnection.paint` reads `if (!this.getHealth().healthy) ctx.setLineDash([5])`.
   🔴 **The canvas passes no `levels` narrowing** — that argument is `exportComponent`'s alone —
   so an `error` verdict dashes exactly like a `warning` one. DEF-034's own note says so in
   passing: *"The dash comes free either way — `getConnectionHealth` turns any unhealthy verdict
   into `setLineDash([5])` in every paint path."*
3. **The export is the only place the wire disappears.** `exportComponent` asks with
   `{ levels: ['error'] }` and pushes only `health.healthy` connections.

### 🔴 So the ruling's sentence *"today they are dropped, not dashed"* is HALF right

**Dropped from the build: yes. Not dashed: no — they are already dashed and already flagged.**
That phrasing entered this file from the ruling summary and I am correcting it here rather than
leaving two documents disagreeing. ⚠️ **A session that took it literally would go looking for a
dash that already exists and would report the work as done without changing anything.**

### 🧭 What is left is a DECISION, and it should not be guessed at

The only thing part 3 could still change is **whether such a wire survives the export**, and that
is not obviously what Richard asked for:

- His sentence is about the **canvas** — *"it would remain … and the errors would flag"* — which
  is the surface that already behaves that way. Read narrowly, **part 3 is already satisfied and
  the correct action is to close it, not build it.**
- Read as *"and it should also still be in the build"*, it **contradicts DEF-034**, which was
  ruled deliberately: an `error` means *"this cannot work at all"* and still deletes. Under
  Ruling B the column genuinely does not exist, so an exported wire would deliver a value to
  nothing — and the runtime has no port to receive it.

⚠️ **Ask before building.** The cheap, non-contradicting reading is that part 3 is already met,
and the remaining value in this row is **parts 1 and 2** — which the ruling itself calls the part
that closes the person-sentence: *"an empty schema today produces no ports **and no
explanation**."* The explanation is still missing, and nothing measured here changes that.

### ⚠️ The boundary on this measurement

**Read at HEAD, not driven.** The three readings above are source; no wire to a deleted schema
field was watched being painted in a running editor this session. What would settle it is opening
a project with a `net.noodl.user.*` node, emptying the schema cache (DEF-035 §6's recipe), and
looking at the canvas — the dash and the Problems-panel entry are both observable there.

## 7. 🔴 The ACs in §4 were written for Option A and Richard overruled it

**AC1 says** *"a User-family node with an empty schema still offers a `prop-<field>` port for
every field one of its own wires names"* — **that is Option A**, the wire declaring the column,
which the 2026-08-31 ruling rejected on product shape. **AC2 and AC3 are Option A's cardinality
and ignore-list criteria and go with it.**

**They must be rewritten before anyone builds against them**, exactly as DEF-037's AC3 had to be.
🔴 **Do not try to satisfy both** — a session that reads §4 top-down and starts building will
build the thing that was overruled. AC4 (driven) and AC5 (`test:ci` floor) survive unchanged.
