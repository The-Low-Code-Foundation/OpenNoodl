# Worker D — NDA-005 C1 for the Record family (NDA-012, Data)

**Scope:** port `description` sentences only, for the six Record-family nodes in
`packages/noodl-runtime/src/nodes/std-library/data/`. No behaviour changes. Every defect below is
**filed, not fixed.**

---

## 1. Stale premises

### (a) It is six nodes, not seven — `Remove Object From Array` is in another package

The brief names seven nodes and then lists six, and the seventh is not reachable from this
territory. `Remove Object From Array` is `CollectionRemove`, whose source is
[`packages/noodl-viewer-react/src/nodes/std-library/data/collectionnode-remove.ts`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/collectionnode-remove.ts)
over `collection-failure.ts` — the worksheet says so itself at `audit/data.md:546-547`. None of my
eight files touch it.

Its C1 row (`audit/data.md:559`) still reads `⚠️ 0% (0/6) ⬜ Owed` and **this batch does not close it.** It belongs with
the Array family (whose four siblings share the rotting `shortDesc` DA-iv filed), not with the
Record family. ⚠️ **The orchestrator must not read "Data C1 done" off six green rows.**

### (b) NDA-005 §2's boilerplate census is stale after phase 34

§2 states that 11 nodes sit on the generic runtime-discovered boilerplate and that *"only 3 of the
11 are in the node picker — `Config`, `Array Filter`, `Subscribe To Changes` — so the author-facing
part of this is three nodes."*

Measured against the current catalog, **three more picker-visible nodes are on that boilerplate**:
`AddDbModelRelation`, `RemoveDbModelRelation` and `DeleteDbModelProperties` all carry

> "Declares conditional/expandable port groups whose visibility depends on parameter values (see
> declaredPortGroups). Some ports are discovered at runtime from user code, parameters or connected
> components, and are pushed to the editor per instance; the static port list below is incomplete
> for such instances."

and all three are `inNodePicker: true` and not deprecated. So §2(b)'s "three nodes" is **six**, and
the three new ones are the Record verbs an author reaches for first. Cause: phase 34 gave these
nodes a `Backend` picker and schema-driven `Class` ports they did not have when §2 was measured, and
`dynamic-port-notes.js` has no entry for them. See defect **WD-2**.

### (c) The six C1 figures in the brief are correct — verified, not inherited

This is the check the brief asked to start with, and it came back clean. Read out of
`packages/noodl-types/src/node-catalog.json` at HEAD, and independently re-derived from source by
compiling each definition through `nodedefinition.defineNode`:

| Node | Brief says | Catalog says | Static ports counted from source |
|---|---|---|---|
| `AddDbModelRelation` | 1/9 | 1/9 (`idSource`) | 9 |
| `RemoveDbModelRelation` | 1/9 | 1/9 (`idSource`) | 9 |
| `NewDbModelProperties` | 0/7 | 0/7 | 7 |
| `SetDbModelProperties` | 1/11 | 1/11 (`idSource`) | 11 |
| `DeleteDbModelProperties` | 1/8 | 1/8 (`idSource`) | 8 |
| `FilterDBModels` | 0/9 | 0/9 | 9 |

53 static ports, exactly as the brief estimated. **The four "documented" ports were all the same
port** — `idSource`, the one port in the family with a `tooltip`, counted through NDA-005 §0's
flattening fallback rather than through a sentence anyone wrote. The family's real authored-C1
baseline was **0/53**.

---

## 2. Deviations, with reasoning

1. **Thirty sentences cover fifty-three ports, because seven of them are on the mixins.**
   `dbmodelcrudbase.ts` contributes `failure`, `error`, `idSource`, `repeaterComponent`, `modelId`,
   `id`, `targetId` and `accessControl`, so a sentence written once lands on up to five nodes. That
   forced the wording to be true of *every* consumer — hence `id`'s "…which on Create Record is the
   Id the backend assigned" rather than two different sentences that could drift.
   ⚠️ Checked before writing: **nothing outside my five node files applies these mixins.**
   `dbmodelnode2.ts` and `dbcollectionnode2.ts` name `dbmodelcrudbase` only in comments.

2. **I extended `nda-005-port-description.test.ts` with a C1 ratchet rather than only writing
   prose.** C1 is measured out of a catalog regenerated on someone else's schedule, so a mixin that
   silently stops carrying `description` would un-document five nodes with nothing in this
   repository noticing. The rows pin **both** the coverage and the port *count*, because raising
   coverage by shrinking the denominator is exactly the failure §2 names. 8 new tests.

3. **I did not add `description` to any dynamic port, although `RuntimeDiscoveredPort` would accept
   it.** The interface has an `[extra: string]: unknown` index signature, so the field would compile
   and travel — and be read by nobody. Writing sentences into a channel with no consumer is NDA-005
   §0 repeated on purpose. That is §2(c)'s work and it needs the editor side first.

4. **`shortDesc` untouched** (FINDINGS DA-iv). Confirmed still pointless for this family: all six
   have an enrichment file under `docs/node-catalog/enrichment/`, so `enriched?.summary ??
   node.shortDesc` never reaches the fallback.

5. **No enrichment files added.** All six already exist. See defect **WD-3** — they are a *third*
   port-documentation channel and one of them now disagrees with the code.

---

## 3. Could not verify

- **Nothing was driven against the live rig this session.** Every per-backend claim below is read
  from the descriptor cells in `packages/nodegx-backend-contract/src/descriptors/` and from
  `RestDataAdapter.ts`, not measured. The DA-ii / DA-iii measurements they rest on were made last
  session, not re-run.
- **The catalog was not regenerated** (out of bounds), so `NODE-REGISTER.md` and `audit/data.md`'s
  `Pre-filled` column still read the old numbers. My "after" figures are measured from source by the
  new test rows. ⚠️ Until the orchestrator regenerates, the validator and the AI authoring loop see
  none of these sentences.
- **Not confirmed in the running editor** that the sentences render in the property and connection
  panels. No editor was launched (batch rule: one at a time).
- **Not confirmed that the `data.acl` capability gate visibly disables the `accessControl` port**
  in the editor. `NODE_CAPABILITIES` binds it (`nodeCapabilities.ts:92-93`); whether the property
  panel renders the reason was not checked, and my sentence for that port is written to stand alone
  if it does not.
- **`Filter Records`' `Sorting` port name.** My `items` output sentence names "Sorting", which is
  the `displayName` of the dynamic `visualSorting` port. It is only offered when a Class is
  selected, so on a node with no Class the sentence names a port the author cannot see.

---

## 4. C1 coverage — static, and the dynamic gap counted separately

**Static ports** are the ones the catalog measures and the only ones a `description` can reach.

| Node | Static before | Static after | Fixed-name dynamic ports with **no description channel** | Author/schema-named dynamic families |
|---|---|---|---|---|
| `Add Record Relation` `AddDbModelRelation` | 1/9 (11%) | **9/9 (100%)** | 3 — `backendId`, `collectionName`, `relationProperty` | — |
| `Remove Record Relation` `RemoveDbModelRelation` | 1/9 (11%) | **9/9 (100%)** | 3 — `backendId`, `collectionName`, `relationProperty` | — |
| `Create Record` `NewDbModelProperties` | 0/7 (0%) | **7/7 (100%)** | 2 — `backendId`, `collectionName` | `prop-<field>` (per column), `acl-<ruleId>-{target,userid\|role,read,write}` (4 per rule) |
| `Update Record` `SetDbModelProperties` | 1/11 (9%) | **11/11 (100%)** | 2 — `backendId`, `collectionName` | `prop-<field>`, `acl-<ruleId>-…` |
| `Delete Record` `DeleteDbModelProperties` | 1/8 (13%) | **8/8 (100%)** | 2 — `backendId`, `collectionName` | — |
| `Filter Records` `FilterDBModels` | 0/9 (0%) | **9/9 (100%)** | 7 — `backendId`, `collectionName`, `filterEnableLimit`, `filterLimit`, `filterSkip`, `visualFilter`, `visualSorting` | `fp-<name>` (per filter parameter) |
| **Family** | **4/53 (7.5%)** | **53/53 (100%)** | **19** | 3 families across 3 nodes |

⚠️ **No node in this family reads `n/a`** — every one has static ports, so 100% here is a real
hundred percent and not `0/0`. The `n/a` rule still bites elsewhere in Data: `Config` (`DbConfig`)
is the case §2 names and it is not in my territory.

⚠️ **The 19 are the honest gap and they are not author-named.** `Backend` and `Class` are the two
most consequential inputs on five of these six nodes — `Class` decides which `prop-*` ports even
exist — and neither can carry a sentence today. `sendSchemaPorts` /`sendDynamicPorts` have no
`description` field and `schema-ports.ts` contains the string zero times. That is NDA-005 §2(c),
unchanged by this pass, and it is why the family's true author-facing coverage is 53/72, not 53/53.

---

## 5. Worksheet C1-row updates for `audit/data.md`

Drop-in replacements for the `| C1 | … |` row of each node's table. Rows are unchanged elsewhere.

**`### Add Record Relation` `AddDbModelRelation`** (replaces `audit/data.md:80`)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| C1 | ⚠️ **11%** (1/9) | ✅ | **9/9 static.** The one pre-existing "documented" port was `idSource`, counted through NDA-005 §0's tooltip-flattening fallback rather than a written sentence — authored baseline was 0/9. Seven of the nine come from `dbmodelcrudbase`'s mixins and are documented there, so the sentences also land on the four siblings. `targetId` encodes DA-ii's **fixed** behaviour ("must come from a Query Records or Record output so that its class is known") rather than the defect. ⚠️ **3 dynamic ports carry no sentence and cannot** — `backendId`, `collectionName`, `relationProperty` — NDA-005 §2(c). |

**`### Remove Record Relation` `RemoveDbModelRelation`** (replaces `audit/data.md:588`)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| C1 | ⚠️ **11%** (1/9) | ✅ | **9/9 static**, same mixin sentences as the Add sibling. `Success` says what the Add sibling's cannot: the backend accepting a removal *is also* what happens when the relation was not there — Parse's `RemoveRelation` and Directus' junction `DELETE` (204 on a pair that never existed, `descriptors/directus.ts:104`) are both idempotent, so the port cannot mean "something was removed". ⚠️ 3 dynamic ports with no description channel. |

**`### Create Record` `NewDbModelProperties`** (replaces `audit/data.md:283`)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| C1 | ⚠️ **0%** (0/7) | ✅ | **7/7 static.** `Source Object Id` states the precedence that reading the port name cannot give you — the source record's data seeds the new one and the property inputs are applied *over* it (`newdbmodelpropertiesnode.ts:93-97`) — and its blank behaviour. `Access Control Rules` carries the per-backend caveat: rules are written with the record on Parse-family and NodeGX backends and **ignored** on Directus, Supabase and PocketBase (`nodeCapabilities.ts:92`, `RestDataAdapter.ts:1032-1039`). ⚠️ 2 fixed-name dynamic ports undocumentable (`backendId`, `collectionName`), plus the `prop-<field>` and `acl-<ruleId>-…` families, whose documentable unit is the family (§2). |

**`### Update Record` `SetDbModelProperties`** (replaces `audit/data.md:963`)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| C1 | ⚠️ **9%** (1/11) | ✅ | **11/11 static** — the largest static surface in the family, and the one where rule 7 does the most work: `Properties to store`, `Do` and `Success` all name `Store to`, because the enum silently re-points the whole node at memory (`setdbmodelpropertiesnode.ts:60-62`) and `Properties to store` is not even offered in that mode. `Access Control Rules` shares Create Record's per-backend caveat. ⚠️ 2 fixed-name dynamic ports plus the `prop-`/`acl-` families. |

**`### Delete Record` `DeleteDbModelProperties`** (replaces `audit/data.md:308`)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| C1 | ⚠️ **13%** (1/8) | ✅ | **8/8 static**, seven of them from the mixins. `Success` names the second half of what the node does — `internal.model.notify('delete')` tells everything bound to the record it is gone (`deletedbmodelpropertiesnode.ts:71`), which is the part an author wiring this cannot infer. ⚠️ 2 dynamic ports with no description channel. ⚠️ The standing `nodeScope.ModelScope` capital-M defect is **not** mentioned in any sentence: it is unfixed, and a description that documented it would be this phase's own worst failure mode. |

**`### Filter Records` `FilterDBModels`** (replaces `audit/data.md:333`)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| C1 | ⚠️ **0%** (0/9) | ✅ | **9/9 static**, and the node with the highest information-per-sentence in the family because three of its ports do something the name denies. `Filter` (signal) records that *wiring* it switches the node out of reactive mode entirely — every setter here guards on `isInputConnected('filter')`. `Enabled` off passes records through **unchanged** rather than emptying the result (`filterdbmodelsnode.ts:366`). `Count` counts the result **after** Skip and Limit, not the match count. ⚠️ 7 fixed-name dynamic ports with no description channel — the most in the family, and they include `Filter`/`Sorting`/`Limit`/`Skip`, i.e. everything the node is actually configured with — plus the `fp-<name>` family. **The static number is 100% and the node is not documented**; this row is the sharpest case in Data for §2(c) after Navigation. |

---

## 6. Defects found and FILED (not fixed)

### WD-1 — `Error` is never cleared by a later success, on all six nodes

`dbmodelcrudbase.ts:96-99` — the `error` getter returns `this._internal.error`, and nothing anywhere
resets it. `checkWarningsBeforeCloudOp` (`dbmodelcrudbase.ts:132-142`) calls `clearWarnings`, which
only clears the *editor's* warning, not the port. So a Record node that fails once and then succeeds
forever keeps serving the failure message on `Error`.

`filterdbmodelsnode.ts:409` has the same shape and is more interesting, because it shows the
distinction was *seen*: a successful run re-arms `lastReportedError` (the raise-dedup) and
deliberately leaves `lastError` (the port) alone.

⚠️ **Filed rather than fixed, and it changed what I wrote.** The obvious sentence — *"Why the last
operation failed, cleared when the next one succeeds"* — is false. Both `error` ports now read
"…kept after a later attempt succeeds", which is accurate and is also the sentence that will need
changing the day someone fixes this. Affects `Add Record Relation`, `Remove Record Relation`,
`Create Record`, `Update Record`, `Delete Record`, `Filter Records`.

### WD-2 — the `dynamicPorts.description` prose for this family is stale after phase 34

[`scripts/node-catalog/lib/dynamic-port-notes.js:57-58`](../../../scripts/node-catalog/lib/dynamic-port-notes.js#L57-L58)

```js
SetDbModelProperties: 'Property input ports follow the selected cloud database class schema.',
NewDbModelProperties: 'Property input ports follow the selected cloud database class schema.',
```

Two things are now wrong. **(a)** BCN-004 step 5 made the ports come from *whichever backend the
`Backend` picker names*, introspected — the phrase "the cloud database class schema" describes the
pre-merge world and names the wrong source. **(b)** The prose describes only the `prop-*` family and
omits the `Backend` and `Class` ports themselves, which are also dynamic and are what *decides* the
`prop-*` set — so the sentence is incomplete about the port that governs it.

`AddDbModelRelation`, `RemoveDbModelRelation` and `DeleteDbModelProperties` have **no entry at all**
and fall onto §2's generic boilerplate, which is stale premise **(b)** above.

`FilterDBModels`' entry (*"Filter input ports are generated by the editor from the visual filter
definition (FilterRecordsAdapter) and the selected class schema"*) omits `Backend`, `Class`,
`Use limit`, `Limit` and `Skip` — five of its seven fixed-name dynamic ports.

Belongs to NDA-005 §2(b). Not touched: the file is outside my territory and the catalog is the
orchestrator's.

### WD-3 — enrichment `ports` is a third port-documentation channel, and it now disagrees with the code

`docs/node-catalog/enrichment/adddbmodelrelation.json` carries its own per-port prose:

```json
"ports": {
  "modelId": "Id of the owner record (the one whose relation field gains a link).",
  "targetId": "Id of the record being linked.",
  ...
}
```

So a port can now be described in **three** places — `tooltip` (editor popup), `description` (this
pass), and enrichment `ports` (SUB-005) — with no rule saying which wins. Two concrete problems:

- `targetId`'s enrichment sentence carries **none** of the DA-ii constraint. An author or a model
  reading it learns "id of the record being linked" and writes exactly the graph that used to burn
  the class schema. My `description` says the constraint; whichever channel the AI loop reads first
  decides which one it acts on.
- Several enrichment summaries still say "cloud database" (all three I sampled), which is the same
  phase-34 staleness as WD-2.

⚠️ **This is NDA-005 §0's shape a third time** — a field an author is invited to write, competing
with two others, with no documented precedence. Worth a decision from the orchestrator before the
next category pass writes 200 more sentences into one of the three.

### WD-4 — a dropped ACL is reported only to the browser console

[`RestDataAdapter.ts:1032-1039`](../../../packages/noodl-runtime/src/api/backends/RestDataAdapter.ts#L1032-L1039)

```ts
if (options.acl && !this.allows(handle, 'data.acl')) {
  const acl = this.capability(handle, 'data.acl');
  console.warn(`[RestDataAdapter] ACL ignored on ${handle.type}. ...`);
}
```

The record is created **with no access control** and the node's `Failure`/`Error` ports, the NDA-004
bus, `On App Error` and a deployed console all hear nothing. The adapter's own comment argues the
case (*"Not fatal — the record is still created… Dropping it silently would be the failure; saying
so is not"*), and per-record ACLs genuinely are a Parse-family idea. But `console.warn` is precisely
the class NDA-012's **B2** check exists to catch — the Record family was moved off
`editorConnection.sendWarning` in NDA-004 §2 for this exact reason, and this is the same escape
hatch one layer down.

⚠️ **Filed, not fixed: it is a deliberate design decision recorded in a comment, and changing it is
a behaviour change.** It is also the reason my `accessControl` sentence ends "…backends that have no
per-record access control ignore them" — that clause is currently the *only* place in the product an
author can learn this before it happens. Affects `Create Record` and `Update Record` on Directus,
Supabase and PocketBase.

---

## 7. Per-backend caveats encoded, and the one that would not fit

Read from `NODE_CAPABILITIES` (`nodeCapabilities.ts:92-100`) and the descriptor cells, per the
brief's first hard point.

| Port | Capability | Encoded as | Why it fitted |
|---|---|---|---|
| `accessControl` (Create, Update) | `data.acl` — supported on Parse + NodeGX, **unsupported** on Directus / Supabase / PocketBase | "…backends that have no per-record access control ignore them" | The split is binary and the consequence is one clause. See WD-4. |
| `relationRemoved` (Remove Relation) | `relations.addRemove` | "…which is also what happens when the relation was not there to begin with" | Idempotence is true on *every* backend that supports the capability, so one sentence carries it. |
| `error`, `failure` (all six) | — | "…kept after a later attempt succeeds" | Backend-independent; see WD-1. |

### The one that did not fit: `targetId` and `store` on the relation nodes

`relations.addRemove` is not two-valued. It is **`supported`** on Parse and NodeGX (`__op
AddRelation`/`RemoveRelation`), and **`degraded` for two different reasons** elsewhere:

- **Directus** (`descriptors/directus.ts:102-105`) — a relation is a join-table row, duplicates are
  possible, so `addRelation` reads before it writes and two simultaneous adds can still double.
- **Supabase** (`descriptors/supabase.ts:79-82`) — works only where the join table's primary key is
  the *pair*; with a surrogate `id` column the relation is invisible and no request recovers it.
- **PocketBase** (`descriptors/pocketbase.ts:109-111`) — `supported`, but with a real sting: on a
  relation that holds a single record, `"+"` **replaces** and `"-"` **clears**, whichever id you
  name.

⚠️ **No single sentence carries that, and I did not try.** A description that said "behaves
differently on some backends" would be worse than blank — it looks answered (style rule 3's failure
mode applied to a caveat). The descriptor already carries all four reasons in author-facing prose
and `NODE_CAPABILITIES` binds them at the **node** level, so the editor's gate is the right surface
and it already exists. **Recommendation for the orchestrator: nothing to write here — but the
PocketBase single-record `"+"`/`"-"` behaviour is a data-loss shape that currently lives only in a
descriptor cell, and it is worth checking that the gate actually renders it on the node.**

---

## 8. Gate numbers

Run as `(cd packages/noodl-runtime && …)` throughout. `dist-types` built first
(`npm run build:types`) or four corpus suites do not start. Full runs use a minimal custom reporter
— a bare `npx jest` dies in `@jest/reporters/getResultHeader` with `Cannot find module
'terminal-link'` and reports a meaningless "1 of 23".

| Gate | Before | After |
|---|---|---|
| `npx jest` (full, min reporter) | **90/91 suites, 1683/1696 tests, 0 failed** | **90/91 suites, 1691/1704 tests, 0 failed** |
| `npx jest test/corpus/nda-005-port-description.test.ts` | 1 suite, **5 passed** | 1 suite, **13 passed** |
| `npx tsc --noEmit -p tsconfig.json` | exit 0, no output | **exit 0, no output** |

+8 tests, all passing; no suite changed state. (The 91st suite is skipped, before and after; the 13
non-passing tests are the same pending ones in both runs.)

**Diff shape:** 7 source files, +151/−8, and every added line is a `description:` field or its
continuation — verified by filtering the diff. `git diff` on the source shows no changed
expression, condition or call.

---

## 9. For the orchestrator

1. ⚠️ **Regenerate the catalog** — none of these 53 sentences reaches the validator, the property
   panel or the AI authoring loop until `node scripts/node-catalog/generate.js` runs. Expect Data's
   C1 to move by 49 newly-covered port instances across six nodes.
2. ⚠️ **`Remove Object From Array` is still owed** and is not in this batch's territory (§1a).
3. **Decide the three-channel precedence** (WD-3) before the next category pass.
4. §2(b) has **six** picker-visible boilerplate nodes, not three (§1b), and `dynamic-port-notes.js`
   needs three new entries and two rewrites (WD-2).
