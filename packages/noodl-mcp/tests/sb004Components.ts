/**
 * SB-004's seven cloud components, as the arguments the MCP door is given.
 *
 * These lived in `sb004Authoring.test.ts` until SB-004 §7 needed a second
 * caller: the real-backend run in
 * `nodegx-backend/tests/sb004-publication-invariant.test.ts` authors the SAME
 * components through the SAME door and then deploys what the door wrote. §7
 * acceptance 8 is explicit that the run must drive **this task's output, not a
 * hand-written twin of it** — and a twin is exactly what a second copy of these
 * constants would become on the first edit that only reached one of them
 * (`measure-the-artefact-before-believing-the-task-file`).
 *
 * So this file is data, not a suite: node lists and wire lists, and the prose
 * that says why each one is shaped the way it is. Nothing here calls a tool.
 * The two suites that import it decide what to do with them.
 */

/**
 * Two rules every `JavaScriptFunction` node below obeys, both found by SB-004 §7's
 * real-backend run and neither visible to any authoring check.
 *
 * 🔴 **1. A custom signal output must be DECLARED as a port.** `Outputs.x()` is a
 * call, and it only works if `out-x` is on the node's model as a `signal` port —
 * `_isSignalType` reads `model.outputPorts[name].type` and nothing else
 * (`simplejavascript.ts:634-636`). In the editor that port is derived by parsing
 * the script, but the derivation lives in the node module's `setup()`, which
 * returns immediately unless `context.editorConnection.isRunningLocally()`
 * (`:772-775`) — and a deployed backend has no editor connection. The editor
 * saves what it derived (`exportDynamicPorts: true`), so an editor-drawn graph
 * carries the ports; the MCP door derives nothing, so an authored one does not.
 * Deployed, `Outputs.built()` then throws `is not a function`, no Response node
 * is ever reached, and the request 504s after thirty seconds. Every custom
 * signal below is therefore declared, which is also what the editor would have
 * written.
 *
 * 🔴 **2. A code node fed by TWO producers must guard on its inputs.** A value
 * queued on a node is drained one input name per update pass, so a code node
 * triggered by a signal can run *before* the values wired into it have arrived.
 * Measured on a real backend: a node taking `Query Records.items`, a Request
 * parameter and a `Secret` value, triggered by that query's `fetched`, saw
 * `{empty}` on its first run, `{empty, items}` on its second and everything only
 * on its third. Signal and value are not synchronised — the trigger is not a
 * promise that the values beside it are there.
 *
 * The guard is `return` — not a `Failure` — because `runOnValueChange` defaults
 * to ticked (`run-on-value-change.ts:186-189`: absent means ticked), so a late
 * value re-runs the node by itself and the guarded run costs one no-op. Acting
 * on the incomplete first run is what cannot be undone: in `claimSite` it
 * refused a correct setup token, and the refusal was indistinguishable from a
 * wrong one by design.
 *
 * ⚠️ Only the two-producer nodes carry a guard. A code node whose values come
 * from the SAME node as its trigger does not need one — those are flagged dirty
 * in the same pass — and `duplicatePage`'s `newProps` is deliberately left
 * unguarded for that reason and because an absent `title` is a legitimate value
 * there, not a missing one.
 */

/**
 * The two ACL rules that ARE the publication state (SB-004 §3).
 *
 * `-target` is `allowEditOnly` so it is a parameter; `-read`/`-write` are plain
 * boolean ports, which is exactly what lets ONE graph both publish and
 * unpublish — `acl-world-read` is wired, not set.
 */
export const ACCESS_RULES = {
  accessControl: [
    { id: 'admin', label: 'Admin' },
    { id: 'world', label: 'World' }
  ],
  'acl-admin-target': 'role',
  'acl-admin-role': 'admin',
  'acl-admin-read': true,
  'acl-admin-write': true,
  'acl-world-target': 'everyone',
  'acl-world-write': false
};

/**
 * A record born a draft (SB-004 §3): the admin rule and NOTHING else.
 *
 * Not `ACCESS_RULES` with `acl-world-read: false` — that would be the same
 * enforced state by a longer road, and it would leave a world row on the record
 * for a later author to flip by hand. The point of §3 is that only `publishPage`
 * ever adds the world rule, so a draft simply has no world row at all.
 *
 * 🔴 The rule must be present, not absent: `canAccessRecord` reads an ABSENT ACL
 * as public (`model.ts:701-718`), so a record created with no rules is
 * world-readable from the instant `find` goes public.
 */
export const ADMIN_ONLY_RULES = {
  accessControl: [{ id: 'admin', label: 'Admin' }],
  'acl-admin-target': 'role',
  'acl-admin-role': 'admin',
  'acl-admin-read': true,
  'acl-admin-write': true
};

/**
 * `SiteSettings` is read by the PUBLIC site (§4 gives it `find`/`get: public`),
 * so its row carries a world READ rule as well as the admin rule — unlike a
 * draft Page, whose whole point is that the world rule arrives only on publish.
 *
 * 🔴 See §6 F8: this is why `contactRecipient` must not live in this row.
 */
export const SITE_SETTINGS_RULES = {
  accessControl: [
    { id: 'admin', label: 'Admin' },
    { id: 'world', label: 'World' }
  ],
  'acl-admin-target': 'role',
  'acl-admin-role': 'admin',
  'acl-admin-read': true,
  'acl-admin-write': true,
  'acl-world-target': 'everyone',
  'acl-world-read': true,
  'acl-world-write': false
};

/**
 * "The sections of this page", as Query Records actually expresses it.
 *
 * Read out of the runtime rather than guessed: `getStorageFilter`
 * (`dbcollectionnode2.ts:903-925`) uses `visualFilter` whenever
 * `storageFilterType` is unset or `'simple'`, and `collectFilterParameters`
 * (`queryutils.ts:198-225`) mints one input port per `input:` name under the
 * prefix this node declares — `qp-`. So the rule below is what creates the
 * `qp-pageId` port that the wire lands on; without the parameter there is no
 * port, and without the port there is no filter.
 *
 * 🔴 **This rule used to say `points to` on a Pointer field, and §7's run is
 * where that bet LOST.** SB-004 §2 named the bet and named its fallback in the
 * same paragraph — *"a plain `pageId` String would be the safe choice, and if
 * the pointer-equality path in Query Records defects, that is the fallback"* —
 * so this is that fallback being taken, on a measurement rather than a worry.
 *
 * What was measured, in a cloud function on a real backend: a `pointsTo` filter
 * returned **every row in the class**. The column really was created as a
 * `Pointer` (`inferColumnType` read the `__type` tag correctly), so the write
 * side of the bet was fine. The read side is not: `pointsTo` is the one
 * operator that needs the collection schema (`parse.ts:219-231` — it must know
 * the `targetClass`), the schema comes from `CloudStore._collections`
 * (`queryutils.ts:106-121`), and **nothing in the cloud runtime ever populates
 * that cache**. The translator does the right thing and refuses; the refusal
 * reaches a caller with no `options.error`, where the documented behaviour is
 * that "the old silent failure is preserved"; a filter that could not be built
 * is `undefined`; and an undefined filter is a query with no `where`.
 *
 * ⚠️ §6b finding 2 predicted this would fail *loudly* — "the one mercy here".
 * It does not. It fails silently, in the direction that returns MORE rows than
 * were asked for, into a flow whose next step rewrites access control on
 * everything it was handed. Publishing one page flipped every Section on the
 * site: three pages' worth, including a page nobody had named.
 *
 * `equal to` on a String needs no schema, which is the whole of why it works.
 */
export const SECTIONS_OF_PAGE_FILTER = {
  combinator: 'and',
  rules: [{ property: 'pageId', operator: 'equal to', input: 'pageId' }]
};

/**
 * The worker. Its interface is Component Inputs — Run Tasks pushes each item KEY
 * onto a declared input of the same name (`runtasks.ts:419-432`), which is why
 * `objectId` and `isPublic` arrive. A worker is NOT an endpoint: no Request
 * node, so after SB-003 it 404s as a function name.
 */
export const WORKER_NODES = [
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'The section, and whether it goes public',
    ports: [
      { name: 'objectId', type: 'string', plug: 'output' },
      { name: 'isPublic', type: 'boolean', plug: 'output' },
      { name: 'Do', type: 'signal', plug: 'output' }
    ]
  },
  {
    id: 'write',
    type: 'SetDbModelProperties',
    label: 'Write the section access rules',
    parameters: {
      collectionName: 'Section',
      idSource: 'explicit',
      storeProperties: 'specified',
      ...ACCESS_RULES
    }
  },
  {
    id: 'outputs',
    type: 'Component Outputs',
    label: 'Task result',
    // Run Tasks matches these two by STRING. Name them anything else and the
    // run hangs for ever with no warning (`runtasks.ts` NDA-004 note).
    ports: [
      { name: 'Success', type: 'signal', plug: 'input' },
      { name: 'Failure', type: 'signal', plug: 'input' }
    ]
  }
];

export const WORKER_WIRES = [
  { fromId: 'inputs', fromProperty: 'objectId', toId: 'write', toProperty: 'modelId' },
  { fromId: 'inputs', fromProperty: 'isPublic', toId: 'write', toProperty: 'acl-world-read' },
  { fromId: 'inputs', fromProperty: 'Do', toId: 'write', toProperty: 'store' },
  { fromId: 'write', fromProperty: 'done', toId: 'outputs', toProperty: 'Success' },
  { fromId: 'write', fromProperty: 'failure', toId: 'outputs', toProperty: 'Failure' }
];

export const ENDPOINT_NODES = [
  {
    id: 'req',
    type: 'noodl.cloud.request',
    label: 'publishPage(pageId, publish)',
    parameters: {
      // A cloud FUNCTION's interface is this stringlist, NOT Component Inputs
      // (SB-002's correction). A stringlist is one comma-separated STRING — an
      // array is rejected, because the editor calls .split(',') on it.
      // Declared types make a bad call a 400 before the graph runs (CWF-014).
      params: 'pageId,publish',
      'ptype-pageId': 'string',
      'preq-pageId': true,
      'ptype-publish': 'boolean',
      'preq-publish': true,
      allowNoAuth: false
    }
  },
  {
    id: 'prep',
    type: 'JavaScriptFunction',
    label: 'Hold the request until both parameters are here',
    ports: [{ name: 'out-ready', plug: 'output', type: 'signal' }],
    parameters: {
      // 🔴 This node exists because of what §7's run measured, and it is the
      // sharpest form of rule 2 at the top of this file.
      //
      // `pm-pageId → sections.qp-pageId` with `receive → sections.storageFetch`
      // reads as safe: both come from the Request node, and `receive` is
      // documented to fire "after every parameter output has been updated". That
      // is a promise about the REQUEST node, not about the query — a value
      // queued on a consumer is drained an input at a time, so the query ran
      // with `qp-pageId` still in flight. `collectFilterParameters` then DROPS a
      // rule whose value is undefined (`saved.ts`, deliberately — that is how an
      // optional filter port works), and a dropped rule is a query that matches
      // every Section in the site.
      //
      // Measured, not reasoned: publishing one page flipped the access rules on
      // all seven Sections across three pages, including two on a page that was
      // never named. F5 fixed the missing filter; this is the same defect
      // arriving by a second road, and no assertion on the authored graph can
      // see it — the filter IS there, and it is discarded at run time.
      //
      // The fix is a rule about wiring: **the port that carries a query's filter
      // and the port that fires its `Do` must come from the SAME node**, so the
      // value and the signal are flagged in one pass. Everything downstream is
      // therefore driven from here rather than from the Request.
      functionScript:
        'if (Inputs.pageId === undefined || Inputs.isPublic === undefined) return;\n' +
        'Outputs.pageId = Inputs.pageId;\n' +
        'Outputs.isPublic = Inputs.isPublic;\n' +
        'Outputs.ready();'
    }
  },
  {
    id: 'sections',
    type: 'DbCollection2',
    label: "This page's sections",
    // 🔴 The filter is load-bearing and was MISSING when this graph was first
    // authored (s2): an unfiltered Query Records returns every Section in the
    // site, so publishing one page would have flipped the access rules on all
    // of them. The door cannot catch it — an absent `visualFilter` is a legal
    // "match everything" — which is why it is written down here and in §6 F5.
    parameters: {
      // 🔴 `runOnChange-*` off. Both of these are ticked by default
      // (`run-on-value-change.ts:186-189` — absent means ticked), and both are
      // set from PARAMETERS at node creation: `setCollectionName` and
      // `setVisualFilter` each call `scheduleFetch` (`dbcollectionnode2.ts:564`,
      // `:1050`). So a Query Records node fetches ONCE, UNFILTERED, the moment
      // the graph is built — before any `qp-` value can possibly exist — and
      // fires `fetched` with every row in the class. That first result is the
      // one the rest of the graph acts on, and for a publish flow it means the
      // access rules of every Section on the site.
      //
      // With them off there is exactly one trigger left: `setQueryParameter`,
      // whose own checkbox is ticked (`:1069`). The filter value arriving IS the
      // fetch, which is the one ordering that cannot go wrong — a query cannot
      // be triggered by its own parameter before that parameter exists. `Do` is
      // therefore deliberately UNWIRED.
      'runOnChange-collectionName': false,
      'runOnChange-querySettings': false,
      collectionName: 'Section',
      visualFilter: SECTIONS_OF_PAGE_FILTER
    }
  },
  {
    id: 'withFlag',
    type: 'JavaScriptFunction',
    label: 'Carry isPublic onto every item',
    ports: [{ name: 'out-built', plug: 'output', type: 'signal' }],
    parameters: {
      // Run Tasks pushes item KEYS onto the worker's inputs and only those, so
      // `publish` has to ride INSIDE each item. `Array Map` cannot do it: its
      // only inputs are items/mapScript/refresh, so its script closes over
      // nothing. Once a step needs code at all, all of it goes in ONE code node.
      functionScript:
        // Two producers: `sections` from the query that also triggers this node,
        // `isPublic` from the Request. See rule 2 at the top of this file — the
        // first run arrives with only the query's own value on it. `false` is a
        // real answer here, so the test is `undefined` and not falsiness.
        'if (Inputs.sections === undefined || Inputs.isPublic === undefined) return;\n' +
        'const flag = Inputs.isPublic;\n' +
        'Outputs.tasks = (Inputs.sections || []).map((s) => ({ objectId: s.id, isPublic: flag }));\n' +
        'Outputs.built();'
    }
  },
  {
    id: 'tasks',
    type: 'RunTasks',
    label: 'Set access on every section',
    parameters: {
      taskTemplate: '/#__cloud__/site/SetSectionAccess',
      stopOnFailure: true
    }
  },
  {
    id: 'page',
    type: 'SetDbModelProperties',
    label: 'Write the page: mirror + access rules',
    parameters: {
      collectionName: 'Page',
      idSource: 'explicit',
      storeProperties: 'specified',
      ...ACCESS_RULES
    }
  },
  {
    id: 'res',
    type: 'noodl.cloud.response',
    label: 'Answer',
    parameters: { params: 'pageId,published' }
  },
  {
    id: 'deny',
    type: 'noodl.cloud.response',
    label: 'Could not publish',
    parameters: {
      status: 'failure',
      // SBR-015. Unlike `claimSite`'s single message, there is nothing to
      // conceal here — the caller is already an admin holding this page's id.
      // The message is still one string because the node cannot carry a
      // per-edge one; *which* node failed belongs in the execution log, and
      // that it is not there yet is SBR-015 AC4.
      errorMessage: 'This page could not be published.'
    }
  }
];

export const ENDPOINT_WIRES = [
  // The Request feeds exactly one node, and everything else is driven from that
  // node's outputs. See `prep`'s own note: this is what keeps the query's filter
  // and the query's trigger in one update pass, and it is the difference between
  // publishing one page and flipping every Section in the site.
  { fromId: 'req', fromProperty: 'pm-pageId', toId: 'prep', toProperty: 'in-pageId' },
  { fromId: 'req', fromProperty: 'pm-publish', toId: 'prep', toProperty: 'in-isPublic' },
  { fromId: 'req', fromProperty: 'receive', toId: 'prep', toProperty: 'run' },

  // 🔴 `Do` is deliberately UNWIRED. See `prep`'s note: with `storageFetch`
  // wired, the trigger and the filter value are two inputs on this node and the
  // signal is drained first, so the query runs ONCE UNFILTERED — returning every
  // Section in the site — and only then re-runs narrowed when the value lands.
  // The first result is what reaches Run Tasks, so publishing one page flipped
  // the access rules on all of them. `setQueryParameter` schedules a fetch by
  // itself when `runOnValueChange` is ticked (`dbcollectionnode2.ts:1065-1070`,
  // and absent means ticked), so the parameter arriving IS the trigger — one
  // fetch, and it has its filter.
  { fromId: 'prep', fromProperty: 'out-pageId', toId: 'sections', toProperty: 'qp-pageId' },

  { fromId: 'sections', fromProperty: 'items', toId: 'withFlag', toProperty: 'in-sections' },
  { fromId: 'prep', fromProperty: 'out-isPublic', toId: 'withFlag', toProperty: 'in-isPublic' },
  { fromId: 'sections', fromProperty: 'fetched', toId: 'withFlag', toProperty: 'run' },
  { fromId: 'withFlag', fromProperty: 'out-tasks', toId: 'tasks', toProperty: 'items' },
  { fromId: 'withFlag', fromProperty: 'out-built', toId: 'tasks', toProperty: 'run' },
  // 🔴 SBR-015 — this was `completed`, and `completed` is the ONE outcome port
  // that cannot mean success: "Fires after every invocation, whatever the
  // outcome" (`outcome.ts`, COMPLETED_WITH_OTHER_OUTCOMES). Wired to `store`
  // it marked the page published after a Run Tasks that FAILED to set a single
  // section's access rules — a publish that answers 200 having published
  // nothing readable. `done` is the port that means the work happened: every
  // task completed without failing, or the list was empty.
  { fromId: 'tasks', fromProperty: 'done', toId: 'page', toProperty: 'store' },
  { fromId: 'prep', fromProperty: 'out-pageId', toId: 'page', toProperty: 'modelId' },
  { fromId: 'prep', fromProperty: 'out-isPublic', toId: 'page', toProperty: 'prop-published' },
  { fromId: 'prep', fromProperty: 'out-isPublic', toId: 'page', toProperty: 'acl-world-read' },
  // The Response node's `params` mints `pm-<name>` INPUTS (catalog
  // `parameterEncoding`), and a declared parameter with nothing wired to it is
  // simply absent from the body. Declaring `pageId,published` and wiring
  // neither — as this graph first did — answers 200 with `{}`.
  { fromId: 'prep', fromProperty: 'out-pageId', toId: 'res', toProperty: 'pm-pageId' },
  { fromId: 'prep', fromProperty: 'out-isPublic', toId: 'res', toProperty: 'pm-published' },
  { fromId: 'page', fromProperty: 'done', toId: 'res', toProperty: 'send' },

  // 🔴 SBR-015. Every one of these was unwired, and that is the whole defect:
  // this graph had exactly one way out — `page.done` — so ANY error anywhere
  // became a thirty-second 504 with no status, no message and no node named.
  // Measured on the SBR-006 drive: publish took 30004ms, wrote nothing, and
  // said nothing, while `claimSite` — five failure edges into a `Refused`
  // response, in this same file — answered in 29ms. The disagreement between
  // publish and duplicate was never two causes; it is where each graph's write
  // sits relative to the point it stalls at.
  //
  // ⚠️ The two code nodes are here for a specific reason as well as the general
  // one: a `JavaScriptFunction` fires `failure` when its script THROWS, and the
  // documented deployed failure mode of these nodes is `Outputs.built is not a
  // function` when a custom signal port was not declared (rule 1 at the top of
  // this file). That is precisely the error these edges would have named.
  // A guarded `return` is NOT a failure and does not fire this — the guards
  // stay silent, as they should.
  { fromId: 'prep', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  { fromId: 'sections', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  { fromId: 'withFlag', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  // ⚠️ The outcome ports, and deliberately NOT `aborted`. `aborted` is an event
  // that fires *alongside* an outcome, not instead of one — an author-requested
  // abort is `Done` — so wiring it here would race a second Response against the
  // first for the same run. `done` / `unchanged` / `failure` are exhaustive and
  // mutually exclusive, which is exactly the property this fix needs.
  { fromId: 'tasks', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  // `unchanged` means the run never happened, so the section rules were never
  // written — refusing is the honest answer, not a quiet success.
  { fromId: 'tasks', fromProperty: 'unchanged', toId: 'deny', toProperty: 'send' },
  { fromId: 'page', fromProperty: 'failure', toId: 'deny', toProperty: 'send' }
];

// ── duplicatePage, and the worker it composes ────────────────────────────────

/**
 * The duplicate worker: one Section, cloned onto a new page.
 *
 * 🔴 **Deliberately NOT `sourceObjectId`.** `Create Record` seeds from
 * `(this.nodeScope.modelScope || Model).get(id).data`
 * (`newdbmodelpropertiesnode.ts:106`) — a LOCAL lookup, not a backend read. It
 * seeds `{}` in silence when the record was never fetched into that scope, and
 * whether a Run Tasks task component shares its creator's model scope is a
 * runtime question authoring cannot answer. So the endpoint sends each
 * section's fields inside the item and the worker writes them explicitly: no
 * scope assumption, and nothing that can fail quietly.
 *
 * `data` is a field name AND the Model accessor, which is why the endpoint's
 * builder below reads `s.data.data`. Ugly, and the alternative is renaming a
 * field in the published spec, which is worse.
 */
export const COPY_WORKER_NODES = [
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'One section, and the page it is being copied onto',
    // Run Tasks pushes an item's keys onto DECLARED inputs of the same name
    // (`runtasks.ts:419-432`). Undeclared keys are dropped without a word, so
    // this list IS the worker's interface.
    ports: [
      { name: 'kind', type: 'string', plug: 'output' },
      { name: 'order', type: 'number', plug: 'output' },
      { name: 'data', type: '*', plug: 'output' },
      { name: 'newPageId', type: 'string', plug: 'output' },
      { name: 'Do', type: 'signal', plug: 'output' }
    ]
  },
  {
    id: 'link',
    type: 'JavaScriptFunction',
    label: 'The page this copy belongs to',
    // Rule 1: `Outputs.built()` is dead at run time without this.
    ports: [{ name: 'out-built', plug: 'output', type: 'signal' }],
    parameters: {
      // This node used to build a tagged Pointer — `{__type:'Pointer', …}` — and
      // it was right about the write: `prop-<field>` stores what it is given
      // verbatim (`dbmodelcrudbase.ts:650-652`) and `inferColumnType` reads the
      // tag to make a real Pointer column (`LocalSQLAdapter.ts:1251`). §7's run
      // found the bet lost on the READ side instead; see
      // `SECTIONS_OF_PAGE_FILTER` for the measurement.
      //
      // It stays a code node rather than a wire straight from Component Inputs
      // because what it really provides is ORDER: `prop-pageId` must be set
      // before `store` fires, and two wires off one signal do not promise that.
      functionScript: 'Outputs.pageId = Inputs.newPageId;\n' + 'Outputs.built();'
    }
  },
  {
    id: 'create',
    type: 'NewDbModelProperties',
    label: 'Write the copied section',
    parameters: {
      collectionName: 'Section',
      // Born a draft: admin-only, because the copy is a draft even when the
      // page it was copied from is published (SB-004 §7 acceptance 4).
      ...ADMIN_ONLY_RULES
    }
  },
  {
    id: 'outputs',
    type: 'Component Outputs',
    label: 'Task result',
    ports: [
      { name: 'Success', type: 'signal', plug: 'input' },
      { name: 'Failure', type: 'signal', plug: 'input' }
    ]
  }
];

export const COPY_WORKER_WIRES = [
  { fromId: 'inputs', fromProperty: 'newPageId', toId: 'link', toProperty: 'in-newPageId' },
  // Do → set the link → write. The write is triggered by the code node's own
  // signal, never by `Do` directly: `prop-pageId` has to be set before `store`
  // fires, and two wires off one signal do not promise that order.
  { fromId: 'inputs', fromProperty: 'Do', toId: 'link', toProperty: 'run' },
  { fromId: 'link', fromProperty: 'out-pageId', toId: 'create', toProperty: 'prop-pageId' },
  { fromId: 'inputs', fromProperty: 'kind', toId: 'create', toProperty: 'prop-kind' },
  { fromId: 'inputs', fromProperty: 'order', toId: 'create', toProperty: 'prop-order' },
  { fromId: 'inputs', fromProperty: 'data', toId: 'create', toProperty: 'prop-data' },
  { fromId: 'link', fromProperty: 'out-built', toId: 'create', toProperty: 'store' },
  { fromId: 'create', fromProperty: 'done', toId: 'outputs', toProperty: 'Success' },
  { fromId: 'create', fromProperty: 'failure', toId: 'outputs', toProperty: 'Failure' }
];

export const DUPLICATE_NODES = [
  {
    id: 'req',
    type: 'noodl.cloud.request',
    label: 'duplicatePage(pageId)',
    parameters: {
      params: 'pageId',
      'ptype-pageId': 'string',
      'preq-pageId': true,
      allowNoAuth: false
    }
  },
  {
    id: 'prep',
    type: 'JavaScriptFunction',
    label: 'Hold the request until the page id is here',
    ports: [{ name: 'out-ready', plug: 'output', type: 'signal' }],
    parameters: {
      // The same node, for the same reason, as `publishPage`'s — see its note.
      // Both the Record fetch's `modelId` and the section query's `qp-pageId`
      // are id ports whose trigger must arrive in the same pass as their value,
      // and driving them from the Request directly makes that a matter of luck.
      functionScript:
        'if (Inputs.pageId === undefined) return;\n' + 'Outputs.pageId = Inputs.pageId;\n' + 'Outputs.ready();'
    }
  },
  {
    id: 'source',
    type: 'DbModel2',
    label: 'The page being copied',
    parameters: { collectionName: 'Page', idSource: 'explicit' }
  },
  {
    id: 'newProps',
    type: 'JavaScriptFunction',
    label: 'Name the copy',
    ports: [{ name: 'out-built', plug: 'output', type: 'signal' }],
    // ⚠️ No readiness guard, deliberately: both values come from the `source`
    // Record node that also fires the trigger, and an absent `title` on a page
    // that has none is a real answer here rather than a value still in flight.
    parameters: {
      functionScript:
        "const title = Inputs.title || 'Untitled';\n" +
        "const slug = Inputs.slug || 'page';\n" +
        "Outputs.title = 'Copy of ' + title;\n" +
        // Uniqueness is the caller's problem to notice, not ours to fake: the
        // suffix keeps the copy from colliding with its source, and the admin
        // panel renames it. A slug the user cannot see is worse than a clumsy
        // one they can.
        "Outputs.slug = slug + '-copy-' + Math.random().toString(36).slice(2, 8);\n" +
        'Outputs.built();'
    }
  },
  {
    id: 'copy',
    type: 'NewDbModelProperties',
    label: 'Create the draft copy',
    parameters: {
      collectionName: 'Page',
      // `published: false` and a cleared `publishedAt`, written as parameters
      // because they are constants. `Object.assign({}, sourceData, inputValues)`
      // (`newdbmodelpropertiesnode.ts:105-108`) puts these OVER whatever
      // `sourceObjectId` seeded, which is what clears a published source's date.
      'prop-published': false,
      'prop-publishedAt': null,
      ...ADMIN_ONLY_RULES
    }
  },
  {
    id: 'afterCopy',
    type: 'JavaScriptFunction',
    label: 'The copy exists — now go and find what to put on it',
    ports: [{ name: 'out-ready', plug: 'output', type: 'signal' }],
    parameters: {
      // 🔴 A second gathering node, and §7's run is why it is not optional.
      //
      // The section query used to be started from `prep` at the same time as the
      // page fetch, so `tasks` below was left holding a result from one branch
      // and an id from another and had to wait for whichever was late. Measured,
      // that copied ONE of the source's two sections — a partial result, which
      // is the worst of the three outcomes because it looks like a success.
      //
      // Here the graph is a chain instead: nothing downstream starts until the
      // copy has an id, so every consumer's values are at least one hop older
      // than its trigger. The guard stays anyway — it costs one no-op run and it
      // is the only thing standing between a race and a silent partial copy.
      functionScript:
        'if (Inputs.sourcePageId === undefined || Inputs.newPageId === undefined) return;\n' +
        'Outputs.sourcePageId = Inputs.sourcePageId;\n' +
        'Outputs.newPageId = Inputs.newPageId;\n' +
        'Outputs.ready();'
    }
  },
  {
    id: 'sections',
    type: 'DbCollection2',
    label: "The source page's sections",
    // The same two, for the same reason — see publishPage's query node.
    parameters: {
      'runOnChange-collectionName': false,
      'runOnChange-querySettings': false,
      collectionName: 'Section',
      visualFilter: SECTIONS_OF_PAGE_FILTER
    }
  },
  {
    id: 'tasks',
    type: 'JavaScriptFunction',
    label: 'One task per section, each carrying the new page id',
    ports: [{ name: 'out-built', plug: 'output', type: 'signal' }],
    parameters: {
      // The same constraint publishPage hit: Run Tasks pushes only an item's OWN
      // keys, and `Array Map` cannot close over anything (its inputs are
      // items/mapScript/refresh). So `newPageId` rides inside every item, and
      // the whole payload is built in one code node — doctrine §8.
      functionScript:
        // Two producers again: `sections` from the query that triggers this,
        // `newPageId` from the Create Record above it. Without the guard the
        // first run copies every section onto `undefined`.
        'if (Inputs.sections === undefined || Inputs.newPageId === undefined) return;\n' +
        'const pageId = Inputs.newPageId;\n' +
        'Outputs.tasks = (Inputs.sections || []).map((s) => {\n' +
        // `items` is the collection's Models (`dbcollectionnode2.ts:389-396`),
        // so the fields live under `.data`; the `|| s` keeps a plain-object
        // array working too. Which one the cloud runtime actually hands a code
        // node is a §7 question.
        '  const d = s.data || s;\n' +
        '  return { kind: d.kind, order: d.order, data: d.data, newPageId: pageId };\n' +
        '});\n' +
        'Outputs.built();'
    }
  },
  {
    id: 'run',
    type: 'RunTasks',
    label: 'Copy every section',
    parameters: {
      taskTemplate: '/#__cloud__/site/CopySectionToPage',
      stopOnFailure: true
    }
  },
  {
    id: 'res',
    type: 'noodl.cloud.response',
    label: 'Answer with the new page id',
    parameters: { params: 'pageId' }
  },
  {
    id: 'deny',
    type: 'noodl.cloud.response',
    label: 'Could not duplicate',
    parameters: {
      status: 'failure',
      // ⚠️ The message says "may exist" because it may. `copy` writes the new
      // page before the sections are gathered, so a failure after that point
      // leaves a real, empty page behind — which the SBR-006 drive saw happen
      // (`Copy of Untitled` / `page-copy-np3ui4`, created while the call
      // answered nothing). A message claiming nothing was created would be a
      // lie the admin can disprove by reloading the list.
      errorMessage: 'This page could not be duplicated. A partial copy may exist.'
    }
  }
];

export const DUPLICATE_WIRES = [
  { fromId: 'req', fromProperty: 'pm-pageId', toId: 'prep', toProperty: 'in-pageId' },
  { fromId: 'req', fromProperty: 'receive', toId: 'prep', toProperty: 'run' },
  { fromId: 'prep', fromProperty: 'out-pageId', toId: 'source', toProperty: 'modelId' },
  { fromId: 'prep', fromProperty: 'out-ready', toId: 'source', toProperty: 'fetch' },
  { fromId: 'source', fromProperty: 'prop-title', toId: 'newProps', toProperty: 'in-title' },
  { fromId: 'source', fromProperty: 'prop-slug', toId: 'newProps', toProperty: 'in-slug' },
  { fromId: 'source', fromProperty: 'fetched', toId: 'newProps', toProperty: 'run' },
  { fromId: 'newProps', fromProperty: 'out-title', toId: 'copy', toProperty: 'prop-title' },
  { fromId: 'newProps', fromProperty: 'out-slug', toId: 'copy', toProperty: 'prop-slug' },
  // `sourceObjectId` is `allowConnectionsOnly` — a wire, never a parameter. Here
  // it IS safe: the `source` node above fetched the page into this component's
  // own model scope a moment ago, which is the seeding this port documents.
  { fromId: 'prep', fromProperty: 'out-pageId', toId: 'copy', toProperty: 'sourceObjectId' },
  { fromId: 'newProps', fromProperty: 'out-built', toId: 'copy', toProperty: 'store' },
  // 🔴 `Do` unwired here too, and for the same reason — see publishPage's wires.
  // The query is started from `afterCopy`, so the whole graph is one chain:
  // fetch the page, write the copy, then find the sections. See `afterCopy`.
  { fromId: 'prep', fromProperty: 'out-pageId', toId: 'afterCopy', toProperty: 'in-sourcePageId' },
  { fromId: 'copy', fromProperty: 'id', toId: 'afterCopy', toProperty: 'in-newPageId' },
  { fromId: 'copy', fromProperty: 'done', toId: 'afterCopy', toProperty: 'run' },
  { fromId: 'afterCopy', fromProperty: 'out-sourcePageId', toId: 'sections', toProperty: 'qp-pageId' },
  { fromId: 'sections', fromProperty: 'items', toId: 'tasks', toProperty: 'in-sections' },
  { fromId: 'afterCopy', fromProperty: 'out-newPageId', toId: 'tasks', toProperty: 'in-newPageId' },
  { fromId: 'sections', fromProperty: 'fetched', toId: 'tasks', toProperty: 'run' },
  { fromId: 'tasks', fromProperty: 'out-tasks', toId: 'run', toProperty: 'items' },
  { fromId: 'tasks', fromProperty: 'out-built', toId: 'run', toProperty: 'run' },
  { fromId: 'afterCopy', fromProperty: 'out-newPageId', toId: 'res', toProperty: 'pm-pageId' },
  // 🔴 SBR-015 — was `completed`, which fires whatever the outcome; see
  // publishPage's note. Answering the new page id after a section copy that
  // FAILED is the partial-copy-reported-as-success that `afterCopy`'s own
  // comment calls the worst of the three outcomes.
  { fromId: 'run', fromProperty: 'done', toId: 'res', toProperty: 'send' },

  // 🔴 SBR-015 — the same defect as publishPage's, and this is the graph that
  // showed why "they disagree" was the wrong reading. Duplicate creates its
  // copy BEFORE the barrier it stalls at, publish writes AFTER one; the same
  // silent stall therefore left a copy on disk here and nothing at all there,
  // and both answered with a thirty-second timeout.
  //
  // 🔴 **Every failure refuses — including the ones after the copy exists.**
  // The tempting alternative is `claimSite`'s: once the contract has been met,
  // answer success and let a later convenience step fail quietly. It does not
  // apply here, and `afterCopy`'s own note says why — a copy carrying some of
  // its sections is "a partial result, which is the worst of the three
  // outcomes because it looks like a success". Answering `res` on a
  // section-copy failure would manufacture exactly that. The response says a
  // partial copy may exist instead, which is the true statement.
  { fromId: 'prep', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  { fromId: 'source', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  { fromId: 'newProps', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  { fromId: 'copy', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  { fromId: 'afterCopy', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  { fromId: 'sections', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  { fromId: 'tasks', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  // The outcome ports only — see publishPage's note on why `aborted` is not here.
  { fromId: 'run', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  { fromId: 'run', fromProperty: 'unchanged', toId: 'deny', toProperty: 'send' }
];

// ── reorderSection, and the worker it composes ───────────────────────────────

/**
 * SBR-007 AC2. **The write half of drag-to-reorder, and the reason it needed a
 * cloud function rather than an afternoon.**
 *
 * `order` has been on `Section` since SB-004 and nothing has ever written it
 * except `addSection`, which sets it to the current count. Moving a section is
 * not a write to that section: it renumbers its **siblings**, and the browser
 * cannot do that. A `SectionRow` is a `For Each` template — it knows its own
 * `id`, `kind`, `order` and `data` and nothing about the row above it — and
 * there is no loop node in the browser runtime, so a panel that wanted to write
 * N records would need N authored `Set Record`s for an N nobody knows.
 *
 * `Run Tasks` is that loop, it is cloud-only, and this is what it is for.
 *
 * 🔴 **The worker carries NO access rules**, for the module header's second
 * panel reason and not by omission. Reordering the sections of a *published*
 * page is an ordinary edit; adding `ADMIN_ONLY_RULES` here would revoke the
 * world's read on every section it touched while `Page.published` stayed
 * `true` — the publication invariant broken in the direction its mirror cannot
 * show, by a node whose author was only moving a row up.
 */
export const ORDER_WORKER_NODES = [
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'The section, and where it lands',
    // Run Tasks pushes each item KEY onto a declared input of the same name
    // (`runtasks.ts:419-432`), so these two names are the item's two keys.
    ports: [
      { name: 'objectId', type: 'string', plug: 'output' },
      { name: 'order', type: 'number', plug: 'output' },
      { name: 'Do', type: 'signal', plug: 'output' }
    ]
  },
  {
    id: 'write',
    type: 'SetDbModelProperties',
    label: 'Write this section its new order',
    // 🔴 No access rules. See the component note above — this is the same
    // omission `/Admin/SectionRow`'s `save` makes, for the same invariant.
    parameters: { collectionName: 'Section', idSource: 'explicit', storeProperties: 'specified' }
  },
  {
    id: 'outputs',
    type: 'Component Outputs',
    label: 'Task result',
    // Matched by STRING, like every other worker in this file — see
    // `WORKER_NODES`' note on what a rename costs.
    ports: [
      { name: 'Success', type: 'signal', plug: 'input' },
      { name: 'Failure', type: 'signal', plug: 'input' }
    ]
  }
];

export const ORDER_WORKER_WIRES = [
  { fromId: 'inputs', fromProperty: 'objectId', toId: 'write', toProperty: 'modelId' },
  { fromId: 'inputs', fromProperty: 'order', toId: 'write', toProperty: 'prop-order' },
  { fromId: 'inputs', fromProperty: 'Do', toId: 'write', toProperty: 'store' },
  { fromId: 'write', fromProperty: 'done', toId: 'outputs', toProperty: 'Success' },
  { fromId: 'write', fromProperty: 'failure', toId: 'outputs', toProperty: 'Failure' }
];

/**
 * The endpoint. `reorderSection(pageId, sectionId, toIndex)` — the signature
 * SBR-007 §8 named, and `toIndex` is a **position in the order-sorted list**,
 * not an `order` value.
 *
 * That distinction is the whole of why the endpoint sorts rather than
 * arithmetic-ing. Nothing has ever guaranteed `order` is contiguous: sections
 * are born at `sections.count`, and deleting the middle one of three leaves
 * `0, 2`. A caller that computed `order - 1` to move a row up would, on that
 * page, ask for position 1 when it meant position 0. Sorting and splicing
 * removes the assumption instead of documenting it — and because the write
 * renumbers every moved sibling to its index, `order` **is** contiguous
 * afterwards, for every page a person has ever reordered.
 */
export const REORDER_NODES = [
  {
    id: 'req',
    type: 'noodl.cloud.request',
    label: 'reorderSection(pageId, sectionId, toIndex)',
    parameters: {
      // A stringlist is one comma-separated STRING — see `publishPage`'s note.
      params: 'pageId,sectionId,toIndex',
      'ptype-pageId': 'string',
      'preq-pageId': true,
      'ptype-sectionId': 'string',
      'preq-sectionId': true,
      'ptype-toIndex': 'number',
      'preq-toIndex': true,
      allowNoAuth: false
    }
  },
  {
    id: 'prep',
    type: 'JavaScriptFunction',
    label: 'Hold the request until all three parameters are here',
    // Rule 1 — a custom signal port must be DECLARED or `Outputs.ready()` is
    // `not a function` once this bundle is served without an editor attached.
    ports: [{ name: 'out-ready', plug: 'output', type: 'signal' }],
    parameters: {
      // Rule 2, and `publishPage`'s `prep` is the measurement behind it: the
      // port carrying the query's filter and the port firing its fetch must
      // leave the SAME node, or the query runs once unfiltered against every
      // Section on the site. Here that would renumber another page's sections.
      //
      // `toIndex` may legitimately be `0`, so the test is `undefined` and not
      // falsiness — the same trap `withFlag` records for a `false` flag.
      functionScript:
        'if (Inputs.pageId === undefined || Inputs.sectionId === undefined) return;\n' +
        'if (Inputs.toIndex === undefined) return;\n' +
        'Outputs.pageId = Inputs.pageId;\n' +
        'Outputs.sectionId = Inputs.sectionId;\n' +
        'Outputs.toIndex = Inputs.toIndex;\n' +
        'Outputs.ready();'
    }
  },
  {
    id: 'sections',
    type: 'DbCollection2',
    label: "This page's sections",
    parameters: {
      // 🔴 Both boxes off, and `Do` deliberately unwired below. See
      // `publishPage`'s query: a Query Records node fetches ONCE, UNFILTERED,
      // the moment the graph is built, and that first result is the one the rest
      // of the graph acts on. For this endpoint that is every Section on the
      // site renumbered into one page's ordering.
      'runOnChange-collectionName': false,
      'runOnChange-querySettings': false,
      collectionName: 'Section',
      visualFilter: SECTIONS_OF_PAGE_FILTER
    }
  },
  {
    id: 'plan',
    type: 'JavaScriptFunction',
    label: 'Sort, move, and renumber what actually moved',
    ports: [{ name: 'out-built', plug: 'output', type: 'signal' }],
    parameters: {
      // Two producers: `sections` from the query that also triggers this node,
      // `sectionId`/`toIndex` from `prep`. Rule 2 — the first run arrives with
      // only the query's own value on it.
      functionScript:
        'if (Inputs.sections === undefined) return;\n' +
        'if (Inputs.sectionId === undefined || Inputs.toIndex === undefined) return;\n' +
        // `items` is the collection's Models (`dbcollectionnode2.ts:389-396`),
        // so the fields live under `.data`; the `|| s` keeps a plain-object
        // array working too — the same shape `duplicatePage`'s builder uses.
        'const rows = (Inputs.sections || []).map((s) => ({ id: s.id, order: (s.data || s).order }));\n' +
        // 🔴 The tie-break is not tidiness. Two sections may share an `order` —
        // `addSection` writes `sections.count`, and a page whose count was stale
        // by one write has a duplicate — and `Array.prototype.sort` is only
        // stable with respect to the array it was GIVEN. That array is a query
        // result whose row order the backend does not promise, so without the
        // second key the same request could renumber two ways on two calls.
        'rows.sort((a, b) => (a.order - b.order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));\n' +
        'const from = rows.findIndex((r) => r.id === Inputs.sectionId);\n' +
        // A section that is not on this page is not a 500 and not a silent
        // success: it is a request that cannot be honoured, so it throws into
        // the `failure` edge that `deny` is wired to.
        "if (from < 0) throw new Error('That section is not on this page.');\n" +
        'let to = Math.round(Number(Inputs.toIndex));\n' +
        'if (!isFinite(to)) to = from;\n' +
        // Clamping rather than refusing: a drop past the end of the list means
        // "last", which is what a person doing it meant.
        'to = Math.max(0, Math.min(rows.length - 1, to));\n' +
        'const moved = rows.splice(from, 1)[0];\n' +
        'rows.splice(to, 0, moved);\n' +
        // Only the rows whose number actually changed are written. On a ten
        // section page a one place move is two writes, not ten.
        //
        // ⚠️ A move to where the section already is therefore builds an EMPTY
        // list, and `Run Tasks` fires `Done` on one deliberately — *"an empty
        // list is a run that completed, not a run that found nothing to
        // change"* (`runtasks.ts:664-668`). So a no-op answers 200 with the
        // position it is already at, which is the true statement. It is not
        // refused, and `unchanged` below is not that case.
        'Outputs.tasks = rows\n' +
        '  .map((r, i) => ({ objectId: r.id, order: i, was: r.order }))\n' +
        '  .filter((t) => t.was !== t.order)\n' +
        '  .map((t) => ({ objectId: t.objectId, order: t.order }));\n' +
        'Outputs.movedTo = to;\n' +
        'Outputs.built();'
    }
  },
  {
    id: 'tasks',
    type: 'RunTasks',
    label: 'Renumber every section that moved',
    parameters: {
      taskTemplate: '/#__cloud__/site/SetSectionOrder',
      stopOnFailure: true
    }
  },
  {
    id: 'res',
    type: 'noodl.cloud.response',
    label: 'Answer with where it landed',
    parameters: { params: 'sectionId,order' }
  },
  {
    id: 'deny',
    type: 'noodl.cloud.response',
    label: 'Could not reorder',
    parameters: {
      status: 'failure',
      // Like `publishPage`'s, there is nothing to conceal — the caller is an
      // admin already holding this page's id — and one string because the node
      // cannot carry a per-edge one.
      errorMessage: 'These sections could not be reordered.'
    }
  }
];

export const REORDER_WIRES = [
  // The Request feeds exactly one node. See `publishPage`'s wires for what the
  // alternative measured.
  { fromId: 'req', fromProperty: 'pm-pageId', toId: 'prep', toProperty: 'in-pageId' },
  { fromId: 'req', fromProperty: 'pm-sectionId', toId: 'prep', toProperty: 'in-sectionId' },
  { fromId: 'req', fromProperty: 'pm-toIndex', toId: 'prep', toProperty: 'in-toIndex' },
  { fromId: 'req', fromProperty: 'receive', toId: 'prep', toProperty: 'run' },

  // 🔴 `Do` deliberately UNWIRED — the filter value arriving IS the fetch.
  { fromId: 'prep', fromProperty: 'out-pageId', toId: 'sections', toProperty: 'qp-pageId' },

  { fromId: 'sections', fromProperty: 'items', toId: 'plan', toProperty: 'in-sections' },
  { fromId: 'prep', fromProperty: 'out-sectionId', toId: 'plan', toProperty: 'in-sectionId' },
  { fromId: 'prep', fromProperty: 'out-toIndex', toId: 'plan', toProperty: 'in-toIndex' },
  { fromId: 'sections', fromProperty: 'fetched', toId: 'plan', toProperty: 'run' },

  { fromId: 'plan', fromProperty: 'out-tasks', toId: 'tasks', toProperty: 'items' },
  { fromId: 'plan', fromProperty: 'out-built', toId: 'tasks', toProperty: 'run' },

  // 🔴 `done`, never `completed` — SBR-015's rule, and `publishPage`'s comment
  // is the reason: `completed` fires whatever the outcome, so it would answer
  // 200 after a run that renumbered nothing.
  { fromId: 'prep', fromProperty: 'out-sectionId', toId: 'res', toProperty: 'pm-sectionId' },
  { fromId: 'plan', fromProperty: 'out-movedTo', toId: 'res', toProperty: 'pm-order' },
  { fromId: 'tasks', fromProperty: 'done', toId: 'res', toProperty: 'send' },

  // SBR-015 — every node in this endpoint that can fail has somewhere to fail
  // to. `plan` is the one that raises on purpose: an unknown `sectionId`.
  { fromId: 'prep', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  { fromId: 'sections', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  { fromId: 'plan', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  // The outcome ports only — see publishPage's note on why `aborted` is not here.
  { fromId: 'tasks', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  // 🔴 `unchanged` here is NOT the empty-list case — that is `Done`, above. It
  // is a run that never started: an absent `Items` (*"a wiring mistake"*,
  // `runtasks.ts:625`) or a `Do` that raced a run already in flight. Neither
  // wrote anything, so refusing is the honest answer.
  { fromId: 'tasks', fromProperty: 'unchanged', toId: 'deny', toProperty: 'send' }
];

// ── submitContactForm, and the settings helper it composes ───────────────────

/**
 * `site/ContactRecipient` — SB-004 §5's "Settings-component idiom", which is a
 * real component in the shipped Stripe prefab (`/#__cloud__/Stripe/Settings`):
 * Component Inputs `Fetch` in, secrets read in a chain, values and a `Ready`
 * signal out.
 *
 * One deliberate departure from that prefab. Stripe wires each Secret's
 * `failure` straight to `Failure`, because a Stripe function with no API key
 * cannot do anything. Here the secret is only a FALLBACK for an unset
 * `SiteSettings.contactRecipient`, so the picker runs on `completed` — "fires
 * after every invocation, whatever the outcome" — and this component reports
 * `Failure` only when neither source produced an address. A missing optional
 * secret must not take down a form that was configured properly.
 */
export const RECIPIENT_NODES = [
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'Ask for the address',
    ports: [{ name: 'Fetch', type: 'signal', plug: 'output' }]
  },
  {
    id: 'settings',
    type: 'DbCollection2',
    label: 'SiteSettings (one row)',
    // No filter: SiteSettings is a singleton row by construction (§2), so the
    // unfiltered query IS the query. Written down because an unfiltered Query
    // Records is exactly the defect F5 records on publishPage — the difference
    // is intent, and intent has to be visible.
    //
    // ⚠️ The `runOnChange-*` checkboxes are left TICKED here — measured, not
    // assumed. Switching them off left this node reporting `isEmpty: true` for
    // a collection that had a row in it, because **this node has no
    // `storageFetch` wire**: with the boxes off and nothing triggering it by
    // hand, it never fetches at all. On a FILTERED node the same setting is
    // what stops a query running before its filter exists; here there is no
    // filter to be early for.
    //
    // 🔴 That is the whole rule, and `claimSite`'s copy of this node is the
    // other half of it: boxes OFF *and* `storageFetch` wired, which fetches
    // exactly once and in an order. Boxes on with a `storageFetch` wire fetches
    // twice and runs everything downstream twice (SB-013). The two settings are
    // alternatives, never a belt and braces.
    parameters: { collectionName: 'SiteSettings' }
  },
  {
    id: 'fallback',
    type: 'noodl.cloud.secret',
    label: 'CONTACT_RECIPIENT_EMAIL',
    parameters: { name: 'CONTACT_RECIPIENT_EMAIL' }
  },
  {
    id: 'pick',
    type: 'JavaScriptFunction',
    label: 'Settings first, then the secret',
    ports: [
      { name: 'out-ready', plug: 'output', type: 'signal' },
      { name: 'out-failed', plug: 'output', type: 'signal' }
    ],
    parameters: {
      functionScript:
        // `rows` comes from a query that finished BEFORE the secret was even
        // fetched, so on the trigger run it is still in flight (rule 2). Only
        // `rows` is guarded: `fallback` comes from the same Secret node that
        // fires `completed`, and an unprovisioned secret legitimately produces
        // no value at all — guarding on it would wait for something that is
        // never coming.
        'if (Inputs.rows === undefined) return;\n' +
        'const rows = Inputs.rows || [];\n' +
        'const first = rows[0] ? rows[0].data || rows[0] : {};\n' +
        'const address = first.contactRecipient || Inputs.fallback;\n' +
        'if (address) {\n' +
        '  Outputs.recipient = address;\n' +
        '  Outputs.ready();\n' +
        '} else {\n' +
        '  Outputs.failed();\n' +
        '}'
    }
  },
  {
    id: 'outputs',
    type: 'Component Outputs',
    label: 'The address',
    ports: [
      { name: 'recipient', type: 'string', plug: 'input' },
      { name: 'Ready', type: 'signal', plug: 'input' },
      { name: 'Failure', type: 'signal', plug: 'input' }
    ]
  }
];

export const RECIPIENT_WIRES = [
  { fromId: 'inputs', fromProperty: 'Fetch', toId: 'settings', toProperty: 'storageFetch' },
  { fromId: 'settings', fromProperty: 'fetched', toId: 'fallback', toProperty: 'fetch' },
  { fromId: 'settings', fromProperty: 'items', toId: 'pick', toProperty: 'in-rows' },
  { fromId: 'fallback', fromProperty: 'value', toId: 'pick', toProperty: 'in-fallback' },
  // `completed`, not `done` — see the note above. An unprovisioned secret is a
  // Failure on that node and still reaches the picker here.
  { fromId: 'fallback', fromProperty: 'completed', toId: 'pick', toProperty: 'run' },
  // A query that never returned is a different matter, and stays fatal.
  { fromId: 'settings', fromProperty: 'failure', toId: 'outputs', toProperty: 'Failure' },
  { fromId: 'pick', fromProperty: 'out-recipient', toId: 'outputs', toProperty: 'recipient' },
  { fromId: 'pick', fromProperty: 'out-ready', toId: 'outputs', toProperty: 'Ready' },
  { fromId: 'pick', fromProperty: 'out-failed', toId: 'outputs', toProperty: 'Failure' }
];

/** The legacyName a component instance uses as its node TYPE. */
export const RECIPIENT_TYPE = '/#__cloud__/site/ContactRecipient';

export const CONTACT_NODES = [
  {
    id: 'req',
    type: 'noodl.cloud.request',
    label: 'submitContactForm(name, email, message, pageSlug)',
    parameters: {
      params: 'name,email,message,pageSlug',
      'ptype-name': 'string',
      'preq-name': true,
      'ptype-email': 'string',
      'preq-email': true,
      'ptype-message': 'string',
      'preq-message': true,
      'ptype-pageSlug': 'string',
      'preq-pageSlug': false,
      // 🔴 The one public door in the template (§4). It is safe only because
      // `ContactMessage.create` is `nobody` for everyone else and this function
      // runs as system — and F3 still stands: nothing here rate-limits a bot.
      allowNoAuth: true
    }
  },
  {
    id: 'recipient',
    // A helper composed as an INSTANCE rather than through a `taskTemplate`
    // parameter — and therefore a component reference SB-001's
    // `checkRuntimeContext` does see. The control below proves it.
    type: RECIPIENT_TYPE,
    label: 'Who the mail goes to'
  },
  {
    id: 'save',
    type: 'NewDbModelProperties',
    label: 'Record the message',
    parameters: {
      collectionName: 'ContactMessage',
      'prop-handled': false,
      // Admin-only from creation. Nobody else can read this row, and §4's
      // `create: 'nobody'` means nobody else could have written one.
      ...ADMIN_ONLY_RULES
    }
  },
  {
    id: 'compose',
    type: 'JavaScriptFunction',
    label: 'The message body',
    ports: [{ name: 'out-built', plug: 'output', type: 'signal' }],
    // No guard: every input comes from the Request node that also fires the
    // trigger, and `receive` is documented to fire after every parameter output
    // has been updated (§6b finding 3).
    parameters: {
      functionScript:
        "Outputs.subject = 'New enquiry from ' + (Inputs.name || 'a visitor');\n" +
        'Outputs.text = [\n' +
        "  'From: ' + (Inputs.name || '') + ' <' + (Inputs.email || '') + '>',\n" +
        "  'Page: ' + (Inputs.pageSlug || '(unknown)'),\n" +
        "  '',\n" +
        "  Inputs.message || ''\n" +
        "].join('\\n');\n" +
        'Outputs.built();'
    }
  },
  {
    id: 'mail',
    type: 'noodl.cloud.sendemail',
    label: 'Tell the site owner',
    parameters: { template: 'none' }
  },
  {
    id: 'stored',
    type: 'JavaScriptFunction',
    label: 'The answer the visitor gets',
    // 🔴 SB-018 (5), fixed s19, and the fix is NOT the one that file proposed.
    //
    // `received` used to come from `compose.out-built`, a **signal**, wired into
    // `res.pm-received`, a **value** parameter port. `canCastPortTypes` allows
    // that cast, so nothing warned. What it produced was not "the port never got
    // a value": a pulse into a value port is delivered as `true` and then
    // `false` in the same drain pass (`node.ts:686-692`), so the port was SET
    // TWICE and settled on the falling edge. The endpoint answered
    // `{"received": false}` about a message it had stored — measured over real
    // HTTP in SB-017 §10.5.
    //
    // 🔴 And "publish a value instead of a signal" — SB-018 (5)'s own suggested
    // fix — would only have swapped one constant for another. `compose` runs on
    // `req.receive`, BEFORE anything is stored, so a `true` published there is
    // true on the failure path as well: the visitor whose message was lost would
    // be told it arrived. That is worse than the bug, not better.
    //
    // So the flag is raised where the outcome is actually known — after the row
    // is written — and the `false` case is a parameter on the Response node
    // itself rather than an unset port (see `res` below). `save.failure ->
    // res.send` is the only other route to a response, and it does not pass
    // through here.
    ports: [{ name: 'out-ready', plug: 'output', type: 'signal' }],
    parameters: {
      functionScript: 'Outputs.received = true;\n' + 'Outputs.ready();'
    }
  },
  {
    id: 'res',
    type: 'noodl.cloud.response',
    label: 'Answer the visitor',
    // 🔴 SB-018 (5)'s other half. `pm-received: false` as a PARAMETER, so the
    // failure path answers `{"received": false}` rather than dropping the key:
    // `responseParameters` starts `{}` and only a port that is set puts anything
    // in the body, so without this the two paths would answer with different
    // SHAPES, and a caller would have to tell `false` from absent.
    //
    // A parameter, not a wire, and that distinction is SB-017 §11's: a parameter
    // is copied verbatim by the export and the runtime registers the input on
    // that path (`response.ts:212-220`) with no dynamic port needed. So this
    // survives a deploy whatever happens to `pm-`'s port list, which is the
    // property the wire above does not have on its own.
    parameters: { params: 'received', 'pm-received': false }
  }
];

export const CONTACT_WIRES = [
  { fromId: 'req', fromProperty: 'receive', toId: 'recipient', toProperty: 'Fetch' },
  { fromId: 'req', fromProperty: 'receive', toId: 'compose', toProperty: 'run' },
  { fromId: 'req', fromProperty: 'pm-name', toId: 'compose', toProperty: 'in-name' },
  { fromId: 'req', fromProperty: 'pm-email', toId: 'compose', toProperty: 'in-email' },
  { fromId: 'req', fromProperty: 'pm-message', toId: 'compose', toProperty: 'in-message' },
  { fromId: 'req', fromProperty: 'pm-pageSlug', toId: 'compose', toProperty: 'in-pageSlug' },
  { fromId: 'req', fromProperty: 'pm-name', toId: 'save', toProperty: 'prop-name' },
  { fromId: 'req', fromProperty: 'pm-email', toId: 'save', toProperty: 'prop-email' },
  { fromId: 'req', fromProperty: 'pm-message', toId: 'save', toProperty: 'prop-message' },
  { fromId: 'req', fromProperty: 'pm-pageSlug', toId: 'save', toProperty: 'prop-pageSlug' },
  // The row is written whether or not there is anywhere to mail it. Losing the
  // enquiry because a secret is unset would be the worst failure this template
  // has, so the record comes first and the mail hangs off it.
  { fromId: 'recipient', fromProperty: 'Ready', toId: 'save', toProperty: 'store' },
  { fromId: 'recipient', fromProperty: 'Failure', toId: 'save', toProperty: 'store' },
  { fromId: 'recipient', fromProperty: 'recipient', toId: 'mail', toProperty: 'to' },
  { fromId: 'compose', fromProperty: 'out-subject', toId: 'mail', toProperty: 'subject' },
  { fromId: 'compose', fromProperty: 'out-text', toId: 'mail', toProperty: 'text' },
  // 🔴 SB-018 (5). `stored` sits IN the success chain rather than hanging off
  // `save.done` beside `mail.send`, so the ordering is written down instead of
  // depending on whether `sendemail` can answer `completed` synchronously.
  // `res.pm-received` is set before `res.send` can be reached, on the one path
  // where it is true.
  { fromId: 'save', fromProperty: 'done', toId: 'stored', toProperty: 'run' },
  { fromId: 'stored', fromProperty: 'out-received', toId: 'res', toProperty: 'pm-received' },
  { fromId: 'stored', fromProperty: 'out-ready', toId: 'mail', toProperty: 'send' },
  // `completed`, so a bounced or unconfigured mail service still answers the
  // visitor. `send` "can only happen once" (catalog), so the two paths cannot
  // both fire: `mail.completed` covers success and failure alike, and
  // `save.failure` is the case where `mail.send` never ran at all.
  { fromId: 'mail', fromProperty: 'completed', toId: 'res', toProperty: 'send' },
  { fromId: 'save', fromProperty: 'failure', toId: 'res', toProperty: 'send' },
  // 🔴 SBR-015 — the third silent exit, and the worst-placed one: this is the
  // template's ONE public endpoint. `stored` is the only thing that fires
  // `mail.send`, and `mail.completed` is the only thing that answers, so a throw
  // in `stored` reaches neither and a visitor watches the form hang for thirty
  // seconds. Its script is two lines and cannot realistically throw on its own —
  // but `Outputs.ready is not a function`, the documented deployed failure of an
  // undeclared signal port (rule 1 at the top of this file), is exactly a throw
  // here, and that is the bug this graph has already had once.
  //
  // ⚠️ It answers `{"received": false}` via the Response's parameter default,
  // and by this point `save.done` HAS fired, so the message really was stored.
  // That is pessimistic rather than wrong-in-the-dangerous-direction: a visitor
  // who sends twice costs a duplicate row, a visitor who hangs is told nothing
  // at all and the message is lost to them either way.
  { fromId: 'stored', fromProperty: 'failure', toId: 'res', toProperty: 'send' }
];

// ── claimSite: the function that makes the first admin (§6 F7) ───────────────

/**
 * F7's fix. Every rule in §3 and §4 names `role:admin`, and **nothing creates
 * it** — `role:<name>` is a `_Role` row, the backend-admin principal is a
 * credential, and they share a word and nothing else. A fresh deploy of this
 * template is un-authorable until somebody mints the role.
 *
 * ✅ No admin token and no `/admin/*` route are needed, because
 * `Add User To Role` carries **`Create Role If Missing`** and
 * `SystemRoles.ts:203-213` honours it with `roles.ensure(name)`. The node's own
 * header names this exact case: *"a function deployed to a fresh backend where
 * nobody has opened the Permissions panel yet."* It is off by default so a typo
 * cannot mint a role no rule grants through — here it is deliberately on.
 *
 * **The gate is two independent conditions, and it FAILS CLOSED** (Richard's
 * ruling, s3):
 *
 *  1. a `SITE_SETUP_TOKEN` secret must match. `Secret` fires `failure` when the
 *     secret is not provisioned — *"a missing credential is loud here rather
 *     than an empty string that becomes a 401 from somebody else an hour
 *     later"* — so an unprovisioned backend refuses rather than opening.
 *  2. the site must be unclaimed, i.e. no `SiteSettings` row.
 *
 * ⚠️ (2) alone is check-then-write and **not atomic**; (1) is what actually
 * closes the window, which is why it is not optional.
 *
 * The grantee is the CALLER, taken from the Request node's `userId` output —
 * the session the backend resolved, never a parameter. `Add User To Role`
 * refuses to fall back to the caller by design, and this is the honest way to
 * supply it: the owner signs up through the ordinary public `signup` first, so
 * this function never handles a password.
 */
export const CLAIM_NODES = [
  {
    id: 'req',
    type: 'noodl.cloud.request',
    label: 'claimSite(setupToken)',
    parameters: {
      params: 'setupToken',
      'ptype-setupToken': 'string',
      'preq-setupToken': true,
      // Auth required: the whole function is "make the CALLER an admin", so
      // there has to be a caller. `userId` is blank for an unauthenticated
      // request, and a blank user id is a Failure on the grant node.
      allowNoAuth: false
    }
  },
  {
    id: 'secret',
    type: 'noodl.cloud.secret',
    label: 'SITE_SETUP_TOKEN',
    parameters: { name: 'SITE_SETUP_TOKEN' }
  },
  {
    id: 'settings',
    type: 'DbCollection2',
    label: 'Has this site been claimed?',
    // 🔴 SB-013. The boxes are OFF, so the explicit `storageFetch` below is the
    // only fetch this node performs — one `fetched` pulse, one run of the
    // gate → grant → mark chain, one row. With them on it fetched twice (once
    // at graph-build time, once on the wire) and one claim left TWO identical
    // `SiteSettings` rows for two readers that both take `rows[0]`.
    //
    // ⚠️ Turning them off is the half that used to open the door, and the
    // reason is `isEmpty`: it is `true` before the first query has run
    // (`dbcollectionnode2.ts:410-421`), indistinguishable from a real empty
    // collection. Losing the load-time fetch means the gate's FIRST reading is
    // the pre-fetch one — which on an already-claimed site says "unclaimed".
    // SB-013 §6 measured that arm: the outsider became an admin. What makes it
    // safe here is the pair below — the gate runs only on `fetched`, and its
    // script returns unless `items` says a query has actually answered.
    parameters: {
      collectionName: 'SiteSettings',
      'runOnChange-collectionName': false,
      'runOnChange-querySettings': false
    }
  },
  {
    id: 'gate',
    type: 'JavaScriptFunction',
    label: 'Token matches AND site unclaimed',
    ports: [
      { name: 'out-ok', plug: 'output', type: 'signal' },
      { name: 'out-denied', plug: 'output', type: 'signal' }
    ],
    // 🔴 SB-013. `Run` is purely ADDITIVE (`run-on-value-change.ts` §1): wiring
    // it adds a trigger and unticks nothing, and every input is ticked by
    // default. So a `Run` wired from `fetched` did NOT mean "decides after the
    // query" — the node also re-ran on each input value arriving, and the run
    // that arrived with the secret decided on a pre-fetch `isEmpty`. Off, this
    // node runs when a query has answered and at no other time.
    parameters: {
      'runOnChange-in-expected': false,
      'runOnChange-in-supplied': false,
      'runOnChange-in-unclaimed': false,
      'runOnChange-in-rows': false,
      functionScript:
        // 🔴 The readiness guard, and on this node it is a safety property, not
        // tidiness. `expected` (the Secret) and `supplied` (the Request) are
        // both produced before the query that triggers this node, so a run can
        // arrive with neither — and a run that DECIDES refuses a correct setup
        // token, in a message deliberately indistinguishable from a wrong one.
        // §7's run measured exactly that before the guard existed. The two ways
        // an input can never arrive — an unprovisioned secret, a query that
        // failed — both answer through the `deny` Response on their own edge.
        //
        // 🔴 And the first line is SB-013's half, which is the one that is a
        // BOUNDARY. `isEmpty` cannot tell "the query matched nothing" from "no
        // query has run" — both are `true` — so it is not safe to decide on. Of
        // this node's outputs only `items` can: it is `undefined` until a fetch
        // assigns the collection. Returning here is what makes the refusal
        // structural rather than a race the load-time fetch happens to win.
        'if (Inputs.rows === undefined) return;\n' +
        'if (Inputs.expected === undefined || Inputs.supplied === undefined) return;\n' +
        "const expected = Inputs.expected || '';\n" +
        "const supplied = Inputs.supplied || '';\n" +
        '// Constant-time compare. A plain === leaks the matching prefix length\n' +
        '// through timing, and this is the one door in the template that mints\n' +
        '// an admin — the three extra lines are cheaper than the argument.\n' +
        'let diff = expected.length ^ supplied.length;\n' +
        'const n = Math.max(expected.length, supplied.length);\n' +
        'for (let i = 0; i < n; i++) {\n' +
        '  diff |= (expected.charCodeAt(i) || 0) ^ (supplied.charCodeAt(i) || 0);\n' +
        '}\n' +
        '// An empty expected token is never a match: an unprovisioned secret\n' +
        '// must not let a caller in with an empty string.\n' +
        'const tokenOk = expected.length > 0 && diff === 0;\n' +
        'if (tokenOk && Inputs.unclaimed === true) {\n' +
        '  Outputs.claimed = true;\n' +
        '  Outputs.ok();\n' +
        '} else {\n' +
        '  Outputs.denied();\n' +
        '}'
    }
  },
  {
    id: 'grant',
    type: 'noodl.cloud.addusertorole',
    label: 'Make the caller an admin',
    parameters: {
      role: 'admin',
      // 🔴 Deliberately on, and this is the only node in the template that
      // turns it on: without it the very first call fails `role/not-found` on
      // a backend where the role has never existed, which is every backend
      // this template is deployed to.
      createRole: true
    }
  },
  {
    id: 'mark',
    type: 'NewDbModelProperties',
    label: 'Write the SiteSettings singleton — the site is now claimed',
    parameters: {
      collectionName: 'SiteSettings',
      'prop-siteName': 'My site',
      'prop-homeSlug': 'home',
      ...SITE_SETTINGS_RULES
    }
  },
  {
    id: 'seedTheme',
    type: 'NewDbModelProperties',
    label: 'Write the Theme singleton — the row the theme editor edits',
    // 🔴 SB-014. Nothing in the template created a `Theme` record, and the theme
    // editor saves through `SetDbModelProperties` with the id from
    // `theme.firstItemId` — `undefined` on an empty collection. So Save wrote
    // nowhere and said nothing, on a screen whose whole purpose is to write.
    // A template with two singletons mints both in the same place.
    //
    // 🔴 The tokens are EMPTY on purpose, and that is a deliberate non-decision.
    // `applyTheme` only overrides a custom property when the value is truthy
    // (`sb006Components.ts`), so an empty set is exactly the palette the site
    // already ships — seeding it changes nothing a visitor sees and gives the
    // editor a row to write to. It is byte-for-byte the shape `buildTokens`
    // produces from a form the author saved with every field blank, so the
    // seeded state and the authored state are the same state.
    //
    // All twelve SBR-003 contract keys are written rather than left out: a
    // missing key and an empty one are different things to a reader doing
    // `tokens.colorText`. (Keys single-sourced in the editor's `siteTheme.ts`;
    // `sb004Authoring.test.ts` holds this literal to that list.)
    parameters: {
      collectionName: 'Theme',
      'prop-tokens': {
        colorPrimary: '',
        colorOnPrimary: '',
        colorBackground: '',
        colorSurface: '',
        colorText: '',
        colorTextSoft: '',
        colorBorder: '',
        colorAccentSoft: '',
        radius: '',
        fontDisplay: '',
        fontUi: '',
        measure: ''
      },
      // The public site reads the theme as an anonymous visitor, so this row
      // carries the same world-read rule as `SiteSettings` and for the same
      // reason.
      ...SITE_SETTINGS_RULES
    }
  },
  {
    id: 'res',
    type: 'noodl.cloud.response',
    label: 'Claimed',
    parameters: { params: 'claimed' }
  },
  {
    id: 'deny',
    type: 'noodl.cloud.response',
    label: 'Refused',
    parameters: {
      status: 'failure',
      // One message for every refusal path on purpose: "wrong token" and
      // "already claimed" must not be distinguishable, or this endpoint
      // answers "is this site claimed yet?" to anyone who asks.
      errorMessage: 'This site cannot be claimed.'
    }
  }
];

export const CLAIM_WIRES = [
  // The secret first, so an unprovisioned backend never reaches the query.
  { fromId: 'req', fromProperty: 'receive', toId: 'secret', toProperty: 'fetch' },
  { fromId: 'secret', fromProperty: 'done', toId: 'settings', toProperty: 'storageFetch' },
  { fromId: 'secret', fromProperty: 'value', toId: 'gate', toProperty: 'in-expected' },
  { fromId: 'req', fromProperty: 'pm-setupToken', toId: 'gate', toProperty: 'in-supplied' },
  // ⚠️ `isEmpty` is documented as true BEFORE the first query has run, so the
  // gate must be triggered by `fetched` and never by anything earlier — an
  // "unclaimed" reading taken too early is indistinguishable from a real one.
  { fromId: 'settings', fromProperty: 'isEmpty', toId: 'gate', toProperty: 'in-unclaimed' },
  // 🔴 SB-013's readiness wire. `items` is the only output of this node that
  // separates "matched nothing" from "has not run" — see the gate's script.
  { fromId: 'settings', fromProperty: 'items', toId: 'gate', toProperty: 'in-rows' },
  { fromId: 'settings', fromProperty: 'fetched', toId: 'gate', toProperty: 'run' },
  { fromId: 'gate', fromProperty: 'out-ok', toId: 'grant', toProperty: 'add' },
  { fromId: 'req', fromProperty: 'userId', toId: 'grant', toProperty: 'userId' },
  // `done` AND `unchanged`: already being in the role is the post-condition
  // already holding, by explicit contract, so a re-run must not go red. It is
  // reachable — a role created by hand, with the owner already in it, and no
  // SiteSettings row yet.
  { fromId: 'grant', fromProperty: 'done', toId: 'mark', toProperty: 'store' },
  { fromId: 'grant', fromProperty: 'unchanged', toId: 'mark', toProperty: 'store' },
  { fromId: 'gate', fromProperty: 'out-claimed', toId: 'res', toProperty: 'pm-claimed' },
  // SB-014: the second singleton, after the first.
  { fromId: 'mark', fromProperty: 'done', toId: 'seedTheme', toProperty: 'store' },
  { fromId: 'seedTheme', fromProperty: 'done', toId: 'res', toProperty: 'send' },
  // ⚠️ …and its failure answers `res`, NOT `deny`. By this point the role is
  // granted and the settings row is written — the site IS claimed, and telling
  // the caller "This site cannot be claimed" would send an admin away believing
  // they are not one, with no second claim possible. The theme row is a
  // convenience; the claim is the contract. Same shape as `submitContactForm`,
  // where two edges answer one Response that can only send once.
  { fromId: 'seedTheme', fromProperty: 'failure', toId: 'res', toProperty: 'send' },
  // Every way this can refuse, into the one indistinguishable answer.
  { fromId: 'secret', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  { fromId: 'settings', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  { fromId: 'gate', fromProperty: 'out-denied', toId: 'deny', toProperty: 'send' },
  // 🔴 SBR-015 — `out-denied` is the gate's *decision*, not its *failure*. If the
  // script throws, neither custom signal fires and this function hangs exactly as
  // publishPage did. The one silent exit left in the endpoint that was otherwise
  // the template's model for answering everything, and it went unnoticed because
  // the node has two hand-written signal outputs that look exhaustive.
  { fromId: 'gate', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  { fromId: 'grant', fromProperty: 'failure', toId: 'deny', toProperty: 'send' },
  { fromId: 'mark', fromProperty: 'failure', toId: 'deny', toProperty: 'send' }
];

// ── The set, in an order the door will accept ────────────────────────────────

/** One `create_component` call: what to send, and where it lands. */
export interface Sb004Component {
  /** `create_component`'s `path` argument. */
  path: string;
  /** The registry key it lands under, which is also its directory under `components/`. */
  key: string;
  /** The legacy name — a component instance uses this as its node `type`. */
  legacyName: string;
  nodes: unknown[];
  connections: unknown[];
}

/**
 * ⚠️ **The order is load-bearing, and only for the instance references.**
 * `submitContactForm` names `site/ContactRecipient` as a node **type**, and that
 * reference IS resolved at the door — authoring the endpoint first is refused
 * `unresolved-component-ref` (the control in `sb004Authoring.test.ts`). The
 * `taskTemplate` references are *not* checked (SB-009), so `publishPage` would
 * have applied before its worker existed; the helpers still come first here,
 * because the order that is true for one reference should not be accidental for
 * the other.
 */
export const SB004_COMPONENTS: Sb004Component[] = [
  {
    path: '#__cloud__/site/SetSectionAccess',
    key: '__cloud__/site/SetSectionAccess',
    legacyName: '/#__cloud__/site/SetSectionAccess',
    nodes: WORKER_NODES,
    connections: WORKER_WIRES
  },
  {
    path: '#__cloud__/site/CopySectionToPage',
    key: '__cloud__/site/CopySectionToPage',
    legacyName: '/#__cloud__/site/CopySectionToPage',
    nodes: COPY_WORKER_NODES,
    connections: COPY_WORKER_WIRES
  },
  {
    path: '#__cloud__/site/ContactRecipient',
    key: '__cloud__/site/ContactRecipient',
    legacyName: RECIPIENT_TYPE,
    nodes: RECIPIENT_NODES,
    connections: RECIPIENT_WIRES
  },
  {
    path: '#__cloud__/publishPage',
    key: '__cloud__/publishPage',
    legacyName: '/#__cloud__/publishPage',
    nodes: ENDPOINT_NODES,
    connections: ENDPOINT_WIRES
  },
  {
    path: '#__cloud__/duplicatePage',
    key: '__cloud__/duplicatePage',
    legacyName: '/#__cloud__/duplicatePage',
    nodes: DUPLICATE_NODES,
    connections: DUPLICATE_WIRES
  },
  {
    path: '#__cloud__/submitContactForm',
    key: '__cloud__/submitContactForm',
    legacyName: '/#__cloud__/submitContactForm',
    nodes: CONTACT_NODES,
    connections: CONTACT_WIRES
  },
  {
    path: '#__cloud__/claimSite',
    key: '__cloud__/claimSite',
    legacyName: '/#__cloud__/claimSite',
    nodes: CLAIM_NODES,
    connections: CLAIM_WIRES
  },
  {
    path: '#__cloud__/site/SetSectionOrder',
    key: '__cloud__/site/SetSectionOrder',
    legacyName: '/#__cloud__/site/SetSectionOrder',
    nodes: ORDER_WORKER_NODES,
    connections: ORDER_WORKER_WIRES
  },
  {
    path: '#__cloud__/reorderSection',
    key: '__cloud__/reorderSection',
    legacyName: '/#__cloud__/reorderSection',
    nodes: REORDER_NODES,
    connections: REORDER_WIRES
  },
];
