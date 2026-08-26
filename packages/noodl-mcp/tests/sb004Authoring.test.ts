/**
 * SB-004 — the publish flow, authored through the real MCP surface.
 *
 * This is the phase's dogfood. SB-001 made cloud components authorable and
 * SB-002 taught the idiom, but s1 closed leaving one debt in those words: *the
 * plan door has never driven a cloud target end to end*. Both doors are
 * exercised here — `create_component` and `create_plan`/`stage`/`apply` — on a
 * real server (`helpers.ts` → `createServer` from `src`), so a rejection here is
 * a rejection an agent would get.
 *
 * The shapes, per SB-004 §5 — all five, endpoints and the helpers they compose:
 *   site/SetSectionAccess  — the Run Tasks worker: ACL rules for ONE section
 *   site/CopySectionToPage — the Run Tasks worker: clone ONE section onto a page
 *   site/ContactRecipient  — the Settings idiom: SiteSettings + Secret → an address
 *   publishPage            — Request → Query sections → build items → Run Tasks
 *                            → Update the Page → Response
 *   duplicatePage          — Request → read the page → Create the copy → Query its
 *                            sections → Run Tasks → Response
 *   submitContactForm      — Request (no auth) → ContactRecipient → Create Record
 *                            → Send Email → Response
 *
 * ⚠️ Assertions go to the registry key and the component file's `path`, never
 * through `store.resolve` — SB-001's trap.
 *
 * ⚠️ And the standing limit, which the door itself states: every run returns
 * `dynamic-port-skipped` over exactly the parameters carrying the security model
 * (`collectionName`, `acl-*`, `ptype-*`/`preq-*`), because those ports come from
 * the class schema and the catalog cannot see them. Green here means the graph is
 * well-formed. It is NOT evidence that the publication invariant holds — only
 * SB-004 §7's real-backend run, with `devOpen: false`, can be that.
 */
import * as fs from 'fs';
import * as path from 'path';

import type { TestSession } from './helpers';
import { call, connect, copyFixture } from './helpers';

interface Diag {
  code: string;
  severity: string;
  message: string;
}

interface CreateResponse {
  created: string;
  legacyName: string;
  type: string;
  validation: { summary: { errors: number; warnings: number; infos: number }; diagnostics?: Diag[] };
}

interface ErrorResponse {
  error: { code: string; message: string; details?: { readable?: string[]; newErrors?: Diag[] } };
}

type Either = CreateResponse & ErrorResponse;

interface PlanOp {
  id: string;
  target: string;
}
interface CreatePlanResponse {
  planId: string;
  operations: PlanOp[];
}
interface StageResponse {
  validation?: { diagnostics?: Diag[]; summary?: Record<string, number> };
  error?: ErrorResponse['error'];
}

interface RegistryFile {
  components: Record<string, { type?: string; path?: string }>;
}

const readJson = <T>(dir: string, rel: string): T =>
  JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf-8')) as T;

/**
 * The two ACL rules that ARE the publication state (SB-004 §3).
 *
 * `-target` is `allowEditOnly` so it is a parameter; `-read`/`-write` are plain
 * boolean ports, which is exactly what lets ONE graph both publish and
 * unpublish — `acl-world-read` is wired, not set.
 */
const ACCESS_RULES = {
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
const ADMIN_ONLY_RULES = {
  accessControl: [{ id: 'admin', label: 'Admin' }],
  'acl-admin-target': 'role',
  'acl-admin-role': 'admin',
  'acl-admin-read': true,
  'acl-admin-write': true
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
 * `'points to'` (→ neutral `pointsTo`) is the Pointer operator, which is SB-004
 * §2's one unhedged bet. It is also the one that fails LOUDLY when the bet is
 * wrong: `parse.ts:219-232` refuses when the class schema has no `targetClass`
 * for the field, rather than emitting `className: undefined` and answering with
 * an empty result set. That refusal is a runtime event, so authoring cannot see
 * it — SB-004 §7's run is where this is settled.
 */
const SECTIONS_OF_PAGE_FILTER = {
  combinator: 'and',
  rules: [{ property: 'page', operator: 'points to', input: 'pageId' }]
};

/**
 * The worker. Its interface is Component Inputs — Run Tasks pushes each item KEY
 * onto a declared input of the same name (`runtasks.ts:419-432`), which is why
 * `objectId` and `isPublic` arrive. A worker is NOT an endpoint: no Request
 * node, so after SB-003 it 404s as a function name.
 */
const WORKER_NODES = [
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

const WORKER_WIRES = [
  { fromId: 'inputs', fromProperty: 'objectId', toId: 'write', toProperty: 'modelId' },
  { fromId: 'inputs', fromProperty: 'isPublic', toId: 'write', toProperty: 'acl-world-read' },
  { fromId: 'inputs', fromProperty: 'Do', toId: 'write', toProperty: 'store' },
  { fromId: 'write', fromProperty: 'done', toId: 'outputs', toProperty: 'Success' },
  { fromId: 'write', fromProperty: 'failure', toId: 'outputs', toProperty: 'Failure' }
];

const ENDPOINT_NODES = [
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
    id: 'sections',
    type: 'DbCollection2',
    label: "This page's sections",
    // 🔴 The filter is load-bearing and was MISSING when this graph was first
    // authored (s2): an unfiltered Query Records returns every Section in the
    // site, so publishing one page would have flipped the access rules on all
    // of them. The door cannot catch it — an absent `visualFilter` is a legal
    // "match everything" — which is why it is written down here and in §6 F5.
    parameters: { collectionName: 'Section', visualFilter: SECTIONS_OF_PAGE_FILTER }
  },
  {
    id: 'withFlag',
    type: 'JavaScriptFunction',
    label: 'Carry isPublic onto every item',
    parameters: {
      // Run Tasks pushes item KEYS onto the worker's inputs and only those, so
      // `publish` has to ride INSIDE each item. `Array Map` cannot do it: its
      // only inputs are items/mapScript/refresh, so its script closes over
      // nothing. Once a step needs code at all, all of it goes in ONE code node.
      functionScript:
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
  }
];

const ENDPOINT_WIRES = [
  // The filter value, then the trigger. `receive` fires "after every parameter
  // output has been updated" (catalog), so it is the ONLY trigger that
  // guarantees `qp-pageId` is already set when the query runs — the previous
  // `pm-pageId → storageFetch` relied on wire order for that.
  { fromId: 'req', fromProperty: 'pm-pageId', toId: 'sections', toProperty: 'qp-pageId' },
  { fromId: 'req', fromProperty: 'receive', toId: 'sections', toProperty: 'storageFetch' },
  { fromId: 'sections', fromProperty: 'items', toId: 'withFlag', toProperty: 'in-sections' },
  { fromId: 'req', fromProperty: 'pm-publish', toId: 'withFlag', toProperty: 'in-isPublic' },
  { fromId: 'sections', fromProperty: 'fetched', toId: 'withFlag', toProperty: 'run' },
  { fromId: 'withFlag', fromProperty: 'out-tasks', toId: 'tasks', toProperty: 'items' },
  { fromId: 'withFlag', fromProperty: 'out-built', toId: 'tasks', toProperty: 'run' },
  { fromId: 'tasks', fromProperty: 'completed', toId: 'page', toProperty: 'store' },
  { fromId: 'req', fromProperty: 'pm-pageId', toId: 'page', toProperty: 'modelId' },
  { fromId: 'req', fromProperty: 'pm-publish', toId: 'page', toProperty: 'prop-published' },
  { fromId: 'req', fromProperty: 'pm-publish', toId: 'page', toProperty: 'acl-world-read' },
  // The Response node's `params` mints `pm-<name>` INPUTS (catalog
  // `parameterEncoding`), and a declared parameter with nothing wired to it is
  // simply absent from the body. Declaring `pageId,published` and wiring
  // neither — as this graph first did — answers 200 with `{}`.
  { fromId: 'req', fromProperty: 'pm-pageId', toId: 'res', toProperty: 'pm-pageId' },
  { fromId: 'req', fromProperty: 'pm-publish', toId: 'res', toProperty: 'pm-published' },
  { fromId: 'page', fromProperty: 'done', toId: 'res', toProperty: 'send' }
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
const COPY_WORKER_NODES = [
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
    label: 'The pointer to the new page',
    parameters: {
      // A Pointer is a TAGGED object on the wire — `inferColumnType` reads
      // `__type === 'Pointer'` to type the column (`LocalSQLAdapter.ts:1251`),
      // and `prop-<field>` stores whatever it is given verbatim
      // (`dbmodelcrudbase.ts:650-652`). Write a bare id string here and the
      // column is created as String on first write, after which SB-004 §2's
      // `pointsTo` filter has no `targetClass` and refuses. The Pointer bet is
      // won or lost on this line.
      functionScript:
        "Outputs.page = { __type: 'Pointer', className: 'Page', objectId: Inputs.newPageId };\n" +
        'Outputs.built();'
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

const COPY_WORKER_WIRES = [
  { fromId: 'inputs', fromProperty: 'newPageId', toId: 'link', toProperty: 'in-newPageId' },
  // Do → build the pointer → write. The write is triggered by the code node's
  // own signal, never by `Do` directly: `prop-page` has to be set before
  // `store` fires, and two wires off one signal do not promise that order.
  { fromId: 'inputs', fromProperty: 'Do', toId: 'link', toProperty: 'run' },
  { fromId: 'link', fromProperty: 'out-page', toId: 'create', toProperty: 'prop-page' },
  { fromId: 'inputs', fromProperty: 'kind', toId: 'create', toProperty: 'prop-kind' },
  { fromId: 'inputs', fromProperty: 'order', toId: 'create', toProperty: 'prop-order' },
  { fromId: 'inputs', fromProperty: 'data', toId: 'create', toProperty: 'prop-data' },
  { fromId: 'link', fromProperty: 'out-built', toId: 'create', toProperty: 'store' },
  { fromId: 'create', fromProperty: 'done', toId: 'outputs', toProperty: 'Success' },
  { fromId: 'create', fromProperty: 'failure', toId: 'outputs', toProperty: 'Failure' }
];

const DUPLICATE_NODES = [
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
    id: 'source',
    type: 'DbModel2',
    label: 'The page being copied',
    parameters: { collectionName: 'Page', idSource: 'explicit' }
  },
  {
    id: 'newProps',
    type: 'JavaScriptFunction',
    label: 'Name the copy',
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
    id: 'sections',
    type: 'DbCollection2',
    label: "The source page's sections",
    parameters: { collectionName: 'Section', visualFilter: SECTIONS_OF_PAGE_FILTER }
  },
  {
    id: 'tasks',
    type: 'JavaScriptFunction',
    label: 'One task per section, each carrying the new page id',
    parameters: {
      // The same constraint publishPage hit: Run Tasks pushes only an item's OWN
      // keys, and `Array Map` cannot close over anything (its inputs are
      // items/mapScript/refresh). So `newPageId` rides inside every item, and
      // the whole payload is built in one code node — doctrine §8.
      functionScript:
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
  }
];

const DUPLICATE_WIRES = [
  { fromId: 'req', fromProperty: 'pm-pageId', toId: 'source', toProperty: 'modelId' },
  { fromId: 'req', fromProperty: 'receive', toId: 'source', toProperty: 'fetch' },
  { fromId: 'source', fromProperty: 'prop-title', toId: 'newProps', toProperty: 'in-title' },
  { fromId: 'source', fromProperty: 'prop-slug', toId: 'newProps', toProperty: 'in-slug' },
  { fromId: 'source', fromProperty: 'fetched', toId: 'newProps', toProperty: 'run' },
  { fromId: 'newProps', fromProperty: 'out-title', toId: 'copy', toProperty: 'prop-title' },
  { fromId: 'newProps', fromProperty: 'out-slug', toId: 'copy', toProperty: 'prop-slug' },
  // `sourceObjectId` is `allowConnectionsOnly` — a wire, never a parameter. Here
  // it IS safe: the `source` node above fetched the page into this component's
  // own model scope a moment ago, which is the seeding this port documents.
  { fromId: 'req', fromProperty: 'pm-pageId', toId: 'copy', toProperty: 'sourceObjectId' },
  { fromId: 'newProps', fromProperty: 'out-built', toId: 'copy', toProperty: 'store' },
  { fromId: 'req', fromProperty: 'pm-pageId', toId: 'sections', toProperty: 'qp-pageId' },
  { fromId: 'copy', fromProperty: 'done', toId: 'sections', toProperty: 'storageFetch' },
  { fromId: 'sections', fromProperty: 'items', toId: 'tasks', toProperty: 'in-sections' },
  { fromId: 'copy', fromProperty: 'id', toId: 'tasks', toProperty: 'in-newPageId' },
  { fromId: 'sections', fromProperty: 'fetched', toId: 'tasks', toProperty: 'run' },
  { fromId: 'tasks', fromProperty: 'out-tasks', toId: 'run', toProperty: 'items' },
  { fromId: 'tasks', fromProperty: 'out-built', toId: 'run', toProperty: 'run' },
  { fromId: 'copy', fromProperty: 'id', toId: 'res', toProperty: 'pm-pageId' },
  { fromId: 'run', fromProperty: 'completed', toId: 'res', toProperty: 'send' }
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
const RECIPIENT_NODES = [
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
    parameters: {
      functionScript:
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

const RECIPIENT_WIRES = [
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
const RECIPIENT_TYPE = '/#__cloud__/site/ContactRecipient';

const CONTACT_NODES = [
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
    id: 'res',
    type: 'noodl.cloud.response',
    label: 'Answer the visitor',
    parameters: { params: 'received' }
  }
];

const CONTACT_WIRES = [
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
  { fromId: 'save', fromProperty: 'done', toId: 'mail', toProperty: 'send' },
  // `completed`, so a bounced or unconfigured mail service still answers the
  // visitor. `send` "can only happen once" (catalog), so the two paths cannot
  // both fire: `mail.completed` covers success and failure alike, and
  // `save.failure` is the case where `mail.send` never ran at all.
  { fromId: 'mail', fromProperty: 'completed', toId: 'res', toProperty: 'send' },
  { fromId: 'save', fromProperty: 'failure', toId: 'res', toProperty: 'send' },
  { fromId: 'compose', fromProperty: 'out-built', toId: 'res', toProperty: 'pm-received' }
];

/** Print whatever the door said, so a rejection is evidence rather than a red. */
function say(label: string, res: { isError: boolean; data: Either & StageResponse }): void {
  const readable = res.data?.error?.details?.readable;
  // eslint-disable-next-line no-console
  console.log(
    `\n[${label}] isError=${res.isError}` +
      (res.data?.validation?.summary ? ` summary=${JSON.stringify(res.data.validation.summary)}` : '') +
      (res.data?.error ? `\n  ${res.data.error.code}: ${res.data.error.message}` : '') +
      (readable ? `\n  ${readable.join('\n  ')}` : '') +
      (res.data?.validation?.diagnostics?.length
        ? `\n  ${res.data.validation.diagnostics.map((d) => `${d.severity} [${d.code}] ${d.message}`).join('\n  ')}`
        : '')
  );
}

interface GraphFile {
  nodes: Array<{ id: string; type: string; parameters?: Record<string, unknown> }>;
}
interface WireFile {
  connections: Array<{ fromId: string; fromProperty: string; toId: string; toProperty: string }>;
}

/**
 * The two defects the authoring door structurally CANNOT catch, asserted here
 * instead — on what was written to disk, not on what was sent.
 *
 * Both are legal graphs. An absent `visualFilter` means "every record in the
 * class", and a Response parameter with no wire means "omit it from the body".
 * Neither is an error to a validator; both were in the first authored
 * publishPage; and the first one would have flipped the access rules on every
 * section in the site. So they are pinned by assertion, and a future author who
 * drops either gets a red rather than a silent regression.
 */
function expectQueryFilteredOn(dir: string, key: string, nodeId: string, property: string): void {
  const graph = readJson<GraphFile>(dir, `components/${key}/nodes.json`);
  const node = graph.nodes.find((n) => n.id === nodeId);
  expect(node?.type).toBe('DbCollection2');

  const filter = node?.parameters?.visualFilter as { rules?: Array<{ property?: string; input?: string }> };
  const rule = (filter?.rules ?? []).find((r) => r.property === property);
  expect(rule).toBeDefined();

  // The rule alone is not the filter: `collectFilterParameters` mints `qp-<input>`
  // from the rule's `input`, and an unsupplied value is DROPPED rather than
  // failing (`saved.ts` — "a rule whose value is undefined is removed"). A rule
  // with no wire to its port narrows nothing and says nothing.
  const wires = readJson<WireFile>(dir, `components/${key}/connections.json`);
  const port = `qp-${rule?.input}`;
  expect(wires.connections.some((c) => c.toId === nodeId && c.toProperty === port)).toBe(true);
}

/** Every parameter a Response declares has something wired to its `pm-` input. */
function expectEveryResponseParameterWired(dir: string, key: string): void {
  const graph = readJson<GraphFile>(dir, `components/${key}/nodes.json`);
  const wires = readJson<WireFile>(dir, `components/${key}/connections.json`);
  const responses = graph.nodes.filter((n) => n.type === 'noodl.cloud.response');
  expect(responses.length).toBeGreaterThan(0);

  for (const node of responses) {
    // A stringlist is one comma-separated STRING (§6a finding 1), so this is a
    // split, not an array read.
    const declared = String(node.parameters?.params ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    expect(declared.length).toBeGreaterThan(0);
    for (const name of declared) {
      const wired = wires.connections.some((c) => c.toId === node.id && c.toProperty === `pm-${name}`);
      expect(`${name}:${wired}`).toBe(`${name}:true`);
    }
  }
}

/** Both components landed under the editor-canonical cloud key, typed cloud. */
function expectLandedAsCloud(dir: string, key: string): void {
  const registry = readJson<RegistryFile>(dir, 'components/_registry.json');
  expect(registry.components[key]?.type).toBe('cloud');
  expect(registry.components[`#${key}`]).toBeUndefined();
  const component = readJson<{ path: string; type: string }>(dir, `components/${key}/component.json`);
  expect(component.path).toBe(`/#${key}`);
  expect(component.type).toBe('cloud');
}

describe('SB-004: the publish flow through create_component', () => {
  let session: TestSession;
  let dir: string;

  beforeAll(async () => {
    dir = copyFixture();
    session = await connect(dir);
  });
  afterAll(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("authors the Run Tasks worker: one section's access rules", async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/site/SetSectionAccess',
      nodes: WORKER_NODES,
      connections: WORKER_WIRES
    });
    say('worker: site/SetSectionAccess', res);
    expect(res.isError).toBe(false);
    expect(res.data.legacyName).toBe('/#__cloud__/site/SetSectionAccess');
    expectLandedAsCloud(dir, '__cloud__/site/SetSectionAccess');
  });

  it('authors the endpoint: publishPage', async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/publishPage',
      nodes: ENDPOINT_NODES,
      connections: ENDPOINT_WIRES
    });
    say('endpoint: publishPage', res);
    expect(res.isError).toBe(false);
    expectLandedAsCloud(dir, '__cloud__/publishPage');
  });

  it('publishes only THIS page\'s sections, and answers with a body', () => {
    expectQueryFilteredOn(dir, '__cloud__/publishPage', 'sections', 'page');
    expectEveryResponseParameterWired(dir, '__cloud__/publishPage');
  });
});

describe('SB-004: duplicate and contact, through create_component', () => {
  let session: TestSession;
  let dir: string;

  beforeAll(async () => {
    dir = copyFixture();
    session = await connect(dir);
  });
  afterAll(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /**
   * The control, and it has to run FIRST — before `site/ContactRecipient` is
   * authored — because what it measures is an absence.
   *
   * SB-009 says a component named through a `component`-typed PARAMETER
   * (`RunTasks.taskTemplate`) is accepted `0/0/0` even when nothing of that name
   * exists. This is the other half of that sentence: the same helper composed as
   * an INSTANCE, where the name is the node's `type`, IS resolved. Without this
   * arm, SB-009's clean result would be indistinguishable from a gate that
   * simply never runs on this fixture.
   */
  it('refuses an instance of a helper that does not exist yet (the control SB-009 needs)', async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/submitContactForm',
      nodes: CONTACT_NODES,
      connections: CONTACT_WIRES
    });
    say('CONTROL: submitContactForm before its helper exists', res);
    expect(res.isError).toBe(true);
    // Named by CODE, not by "it errored": the arm is worthless if the rejection
    // could be a bad port or a malformed script. `unresolved-component-ref` is
    // precisely the check SB-009 found has no counterpart on the parameter side.
    const refused = res.data.error?.details?.newErrors ?? [];
    expect(refused.map((d) => d.code)).toContain('unresolved-component-ref');
    expect(refused.find((d) => d.code === 'unresolved-component-ref')?.message).toContain(RECIPIENT_TYPE);
    // And nothing was written: a refused create leaves no component behind.
    expect(fs.existsSync(path.join(dir, 'components/__cloud__/submitContactForm'))).toBe(false);
  });

  it('authors the duplicate worker: one section, cloned onto a page', async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/site/CopySectionToPage',
      nodes: COPY_WORKER_NODES,
      connections: COPY_WORKER_WIRES
    });
    say('worker: site/CopySectionToPage', res);
    expect(res.isError).toBe(false);
    expect(res.data.legacyName).toBe('/#__cloud__/site/CopySectionToPage');
    expectLandedAsCloud(dir, '__cloud__/site/CopySectionToPage');
  });

  it('authors the endpoint: duplicatePage', async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/duplicatePage',
      nodes: DUPLICATE_NODES,
      connections: DUPLICATE_WIRES
    });
    say('endpoint: duplicatePage', res);
    expect(res.isError).toBe(false);
    expectLandedAsCloud(dir, '__cloud__/duplicatePage');
  });

  it('authors the settings helper: site/ContactRecipient', async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/site/ContactRecipient',
      nodes: RECIPIENT_NODES,
      connections: RECIPIENT_WIRES
    });
    say('helper: site/ContactRecipient', res);
    expect(res.isError).toBe(false);
    expectLandedAsCloud(dir, '__cloud__/site/ContactRecipient');
  });

  it('authors the endpoint: submitContactForm, now that the helper exists', async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/submitContactForm',
      nodes: CONTACT_NODES,
      connections: CONTACT_WIRES
    });
    say('endpoint: submitContactForm', res);
    expect(res.isError).toBe(false);
    expectLandedAsCloud(dir, '__cloud__/submitContactForm');
  });

  /**
   * The three endpoints are functions; the three helpers are not. SB-003 made
   * that a runtime boundary (a helper 404s as a function name); here it is the
   * authored shape the boundary reads — a Request node, or none.
   */
  it('gives every endpoint a Request node and every helper none', () => {
    // The graph lives in `nodes.json` beside `component.json`, not inside it —
    // read from disk rather than from the create response, so this says what a
    // deploy would find.
    const hasRequest = (key: string): boolean => {
      const graph = readJson<{ nodes: Array<{ type: string }> }>(dir, `components/${key}/nodes.json`);
      return graph.nodes.some((n) => n.type === 'noodl.cloud.request');
    };
    expect(hasRequest('__cloud__/duplicatePage')).toBe(true);
    expect(hasRequest('__cloud__/submitContactForm')).toBe(true);
    expect(hasRequest('__cloud__/site/CopySectionToPage')).toBe(false);
    expect(hasRequest('__cloud__/site/ContactRecipient')).toBe(false);
  });

  it('copies only the source page\'s sections, and both endpoints answer with a body', () => {
    expectQueryFilteredOn(dir, '__cloud__/duplicatePage', 'sections', 'page');
    expectEveryResponseParameterWired(dir, '__cloud__/duplicatePage');
    expectEveryResponseParameterWired(dir, '__cloud__/submitContactForm');
  });
});

/**
 * s1's named debt: the plan door had never driven a cloud target end to end.
 * Two cloud operations in ONE plan — the worker and the endpoint that composes
 * it — staged and applied.
 */
describe('SB-004: the same flow through the plan door', () => {
  let session: TestSession;
  let dir: string;

  beforeAll(async () => {
    dir = copyFixture();
    session = await connect(dir);
  });
  afterAll(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('plans, stages and applies two cloud components', async () => {
    const plan = await call<CreatePlanResponse & ErrorResponse>(session, 'create_plan', {
      request: 'Publishing: flip a page and its sections between draft and public',
      operations: [
        {
          kind: 'create',
          target: '#__cloud__/site/SetSectionAccess',
          intent: 'Run Tasks worker: write one section\'s access rules.'
        },
        {
          kind: 'create',
          target: '#__cloud__/publishPage',
          intent: 'The endpoint: publish or unpublish a page and all its sections.'
        }
      ]
    });
    say('create_plan (two cloud targets)', plan as never);
    expect(plan.isError).toBe(false);

    const [workerOp, endpointOp] = plan.data.operations;

    const stagedWorker = await call<StageResponse & Either>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: workerOp.id,
      nodes: WORKER_NODES,
      connections: WORKER_WIRES
    });
    say('stage worker', stagedWorker);
    expect(stagedWorker.isError).toBe(false);

    const stagedEndpoint = await call<StageResponse & Either>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: endpointOp.id,
      nodes: ENDPOINT_NODES,
      connections: ENDPOINT_WIRES
    });
    say('stage endpoint', stagedEndpoint);
    expect(stagedEndpoint.isError).toBe(false);

    const applied = await call<Either>(session, 'apply_plan', { plan_id: plan.data.planId });
    say('apply_plan', applied);
    expect(applied.isError).toBe(false);

    // The whole point: through THIS door too, both land as cloud components
    // under the editor's spelling — not in the browser bundle.
    expectLandedAsCloud(dir, '__cloud__/site/SetSectionAccess');
    expectLandedAsCloud(dir, '__cloud__/publishPage');
  });

  /**
   * The question the publishPage pair cannot answer, and SB-005/006 will need
   * the answer to.
   *
   * publishPage names its worker through a `taskTemplate` PARAMETER, which
   * SB-009 measured as unchecked — so that plan would have applied whether or
   * not the worker existed, and it says nothing about ordering. Here the
   * endpoint names its helper as a node TYPE, which the control above proves IS
   * resolved. So this asks something real: staged in one plan, does the
   * endpoint's stage see a SIBLING that has not been applied yet?
   */
  /**
   * The known-firing arm for the test below, and it has to come first.
   *
   * Without it, "the endpoint staged cleanly beside its unapplied sibling"
   * cannot be told apart from "`stage_plan_operation` never resolves component
   * references at all" — the same green, opposite meanings. Same nodes, same
   * wires, one variable changed: whether the helper is in the plan.
   */
  it('CONTROL: staging that endpoint with NO sibling helper is refused', async () => {
    const plan = await call<CreatePlanResponse & ErrorResponse>(session, 'create_plan', {
      request: 'Contact: the endpoint alone, with nothing to resolve its helper',
      operations: [
        {
          kind: 'create',
          target: '#__cloud__/submitContactForm',
          intent: 'The endpoint on its own — the helper is deliberately absent.'
        }
      ]
    });
    expect(plan.isError).toBe(false);

    const staged = await call<StageResponse & Either>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: plan.data.operations[0].id,
      nodes: CONTACT_NODES,
      connections: CONTACT_WIRES
    });
    say('CONTROL: stage endpoint with no sibling helper', staged);
    expect(staged.isError).toBe(true);
    // ⚠️ The two doors report a refusal differently, and an agent parsing them
    // has to know: `create_component` returns structured `details.newErrors`
    // (asserted by code above), while `stage_plan_operation` carries only
    // `details.readable` prose (`planTools.ts:795-801`). The code is in the
    // line, so that is what this reads — but it is read, not merely counted.
    const readable = (staged.data.error?.details?.readable ?? []).join('\n');
    expect(readable).toContain('unresolved-component-ref');
    expect(readable).toContain(RECIPIENT_TYPE);

    await call(session, 'discard_plan', { plan_id: plan.data.planId });
  });

  it('holds a helper and the endpoint that instantiates it in one plan', async () => {
    const plan = await call<CreatePlanResponse & ErrorResponse>(session, 'create_plan', {
      request: 'Contact: take a message from the public site and mail it on',
      operations: [
        {
          kind: 'create',
          target: '#__cloud__/site/ContactRecipient',
          intent: 'Settings helper: where contact mail goes.'
        },
        {
          kind: 'create',
          target: '#__cloud__/submitContactForm',
          intent: 'Public endpoint: record an enquiry and mail it to the site owner.'
        }
      ]
    });
    say('create_plan (helper + its caller)', plan as never);
    expect(plan.isError).toBe(false);

    const [helperOp, endpointOp] = plan.data.operations;

    const stagedHelper = await call<StageResponse & Either>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: helperOp.id,
      nodes: RECIPIENT_NODES,
      connections: RECIPIENT_WIRES
    });
    say('stage helper', stagedHelper);
    expect(stagedHelper.isError).toBe(false);

    // The load-bearing call. Its helper exists only as an unapplied sibling.
    const stagedEndpoint = await call<StageResponse & Either>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: endpointOp.id,
      nodes: CONTACT_NODES,
      connections: CONTACT_WIRES
    });
    say('stage endpoint naming an UNAPPLIED sibling', stagedEndpoint);
    expect(stagedEndpoint.isError).toBe(false);

    const applied = await call<Either>(session, 'apply_plan', { plan_id: plan.data.planId });
    say('apply_plan (helper + its caller)', applied);
    expect(applied.isError).toBe(false);

    expectLandedAsCloud(dir, '__cloud__/site/ContactRecipient');
    expectLandedAsCloud(dir, '__cloud__/submitContactForm');
    expectEveryResponseParameterWired(dir, '__cloud__/submitContactForm');
  });
});
