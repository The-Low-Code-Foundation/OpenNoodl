/**
 * AIX-008 — Sandbox preview: what data does this graph expect?
 *
 * The dataset is assembled here, in the editor, because this is where the graph
 * is. The runtime only serves what it is given (plus a generic fallback for a
 * class nobody predicted).
 *
 * Four sources, in this order of authority:
 *
 * 0. **The user's own records** (BEN-006) — the only source that is not a
 *    guess. Everything below infers what the data probably looks like; this one
 *    is a person saying what they want to see. It wins over all of them, per
 *    class: overriding `Products` must leave `Categories` exactly as inference
 *    built it, because a user who edits one collection has said nothing at all
 *    about the others.
 * 1. **The authoring model's `sample_data`** — it knows it built a book list,
 *    so it can say "The Left Hand of Darkness" where inference can only say
 *    "Northern Atlas 1". Wins over everything it is asked about except the
 *    user.
 * 2. **The graph itself** — every `prop-<field>` connection endpoint names a
 *    field something reads, and every `collectionName`/`collection` parameter
 *    names a class. Fields are attributed to a class when the node carrying
 *    them declares one, and pooled across all classes when it does not: a
 *    repeated item's fields are read inside a child component that has no idea
 *    which collection it came from, and a preview that renders a filled card is
 *    worth more than a preview that is provably right about attribution.
 * 3. **The code the graph runs** — `Expression`, `Function`, `Script` and the
 *    rest of the `codeeditor: javascript` parameters. This one was added after
 *    a live-provider run (see AIX-008-NOTES.md): asked for an orders page,
 *    `claude-sonnet-5` wires `Query Records.items` straight into an Expression
 *    and reads `o.orderNumber` *inside the code string*. Six of nine
 *    data-reading candidates bound their data that way, and for every one of
 *    them sources 1 and 2 found the class and **not one field** — so the
 *    preview served five records carrying nothing and rendered five blank rows
 *    under a heading that said "5 orders". That is the "still renders populated
 *    lists with no backend" criterion failing while looking like it passed.
 *
 * The code scan is deliberately **additive**: it can only contribute names the
 * wire scan did not find, and a class that already has attributed fields is
 * left exactly as it was. It cannot make an existing preview worse, only a
 * blank one populated.
 *
 * @module AiAssistant/authoring/sandboxData
 */

import { completeRecord, sandboxUser, synthesizeRecords } from '@noodl/runtime/src/sandbox/synth';
import type { SandboxClass, SandboxDataset, SandboxRecord } from '@noodl/runtime/src/sandbox/types';

import type { ComponentModel } from '../../componentmodel';
import type { NodeGraphNode } from '../../nodegraphmodel';
import type { AgentSampleData } from './types';

/** How many records a class gets when nothing better is supplied. */
const RECORDS_PER_CLASS = 5;

/** Parameters that name a backend collection, across the Parse and BYOB node families. */
const CLASS_PARAMETERS = ['collectionName', 'collection', 'className', 'table'];

/** Ports that look like fields but are not: reserved names the graph reads off any record. */
const NOT_A_FIELD = new Set(['objectId', 'id', 'createdAt', 'updatedAt', 'ACL']);

const USER_NODE_PREFIX = 'net.noodl.user.';

/**
 * Node parameters that hold JavaScript. This is every input the node catalog
 * declares with `type.codeeditor === 'javascript'`; regenerate with
 *
 *   node -e "const c=require('./packages/noodl-types/src/node-catalog-enriched.json');
 *   …flatMap(n => n.inputs).filter(p => p.type?.codeeditor === 'javascript')"
 *
 * Listed rather than read from the catalog because this module is deliberately
 * catalog-free — it runs against a detached candidate whose types may not be
 * registered, and a missing catalog must degrade to "no code fields" rather
 * than to a throw.
 */
const CODE_PARAMETERS = [
  'expression', // Expression
  'functionScript', // Function
  'code', // Script
  'mapScript', // Array Map
  'templateScript', // For Each
  'generatedCode', // Logic Builder
  'requestScript', // REST
  'responseScript' // REST
];

/**
 * Identifiers that are namespaces, not records. A read off one of these says
 * nothing about the shape of a row.
 */
const NOT_A_RECORD = new Set([
  'Math',
  'JSON',
  'Object',
  'Array',
  'String',
  'Number',
  'Boolean',
  'Date',
  'RegExp',
  'Promise',
  'Error',
  'console',
  'window',
  'document',
  'globalThis',
  'process',
  'this',
  // The runtime's own surfaces: `Inputs.items` is the collection, not a field of
  // it. Both casings are needed and that is not tidiness — `Function` scripts
  // read `Inputs.x`, while `Script` nodes are written as
  // `define({ run: function (inputs, outputs) { … } })` and read `inputs.x`.
  // Missing the lower-case pair put a field called `items` on every record.
  'Inputs',
  'Outputs',
  'inputs',
  'outputs',
  'Noodl',
  'Component',
  'Signals'
]);

/** How far upstream to look for the node that names the collection. */
const MAX_UPSTREAM_HOPS = 6;

/**
 * Properties that are language, not data. Kept deliberately broad: a false
 * negative costs one unfilled field, a false positive puts a nonsense key on
 * every record the preview serves.
 */
const NOT_A_RECORD_FIELD = new Set([
  'length','prototype','constructor','__proto__','name','call','apply','bind','valueOf','hasOwnProperty',
  'slice','splice','sort','reverse','map','filter','reduce','reduceRight','forEach','find','findIndex',
  'some','every','flat','flatMap','join','concat','push','pop','shift','unshift','includes','indexOf',
  'lastIndexOf','at','fill','keys','values','entries','from','of','isArray','assign','freeze','create',
  'split','replace','replaceAll','trim','trimStart','trimEnd','toString','toLowerCase','toUpperCase',
  'charAt','charCodeAt','substring','substr','match','matchAll','search','padStart','padEnd','repeat',
  'startsWith','endsWith','normalize','localeCompare','toFixed','toPrecision','parse','stringify',
  'floor','ceil','round','abs','min','max','random','pow','sqrt','sign','trunc','log','warn','error',
  'now','getTime','getFullYear','getMonth','getDate','getDay','getHours','getMinutes','getSeconds',
  'getMilliseconds','toISOString','toJSON','toLocaleDateString','toLocaleTimeString','toLocaleString',
  'toDateString','then','catch','finally','next','done','value','default','undefined','null'
]);

export interface Discovery {
  /** Fields attributed to a specific class. */
  byClass: Map<string, Set<string>>;
  /** Fields read off a record whose class could not be determined. */
  pooled: Set<string>;
  /** Fields read off the signed-in user. */
  user: Set<string>;
  /**
   * Fields read inside code on a node whose upstream class could not be
   * determined. Kept apart from `pooled` because pooled fields are merged into
   * *every* class: a guess from a regex over user code earns a narrower blast
   * radius than a `prop-<field>` endpoint, and is only used for a class that
   * would otherwise have no fields at all.
   */
  codePooled: Set<string>;
}

function classOfNode(node: NodeGraphNode): string | undefined {
  const parameters = (node.parameters ?? {}) as Record<string, unknown>;
  for (const key of CLASS_PARAMETERS) {
    const value = parameters[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function isUserNode(node: NodeGraphNode): boolean {
  // `node.type` resolves through the NodeLibrary; `typename` is the raw string
  // and is the only one available for a node whose type is not registered.
  return String(node.typename ?? '').startsWith(USER_NODE_PREFIX);
}

function fieldFromPort(port: string | undefined): string | undefined {
  if (!port || !port.startsWith('prop-')) return undefined;
  const field = port.slice('prop-'.length);
  return field && !NOT_A_FIELD.has(field) ? field : undefined;
}

function add(map: Map<string, Set<string>>, key: string, values: Iterable<string>) {
  const set = map.get(key) ?? new Set<string>();
  for (const value of values) set.add(value);
  map.set(key, set);
}

/** `{{title}}` in a text parameter reads a field just as surely as a connection does. */
function templateFields(node: NodeGraphNode, into: Set<string>) {
  for (const value of Object.values((node.parameters ?? {}) as Record<string, unknown>)) {
    if (typeof value !== 'string' || !value.includes('{{')) continue;
    for (const match of value.matchAll(/\{\{\s*([A-Za-z_$][\w$]*)\s*\}\}/g)) {
      if (!NOT_A_FIELD.has(match[1])) into.add(match[1]);
    }
  }
}

/**
 * Code with its string literals and comments blanked out.
 *
 * Without this, `'https://example.com/x'` contributes a field called `com`.
 *
 * A left-to-right scan rather than a chain of replaces, because the two hazards
 * are mutually recursive and a chain has to pick a loser. Stripping comments
 * first eats the rest of any line holding a URL, since `//` inside
 * `'https://…'` reads as a line comment — that is a real defect a spec caught.
 * Stripping strings first eats the rest of any line holding `// don't`. One
 * pass has neither problem, because whichever opens first consumes the other.
 *
 * Template literals keep their `${…}` expressions: a model writes
 * `` `${o.title} — ${o.author}` `` as readily as it writes `+`, and blanking
 * the whole literal would lose both field names.
 *
 * Still not a tokenizer: a regex literal containing an unpaired quote can
 * confuse it. The cost of that is a junk field name, which is why everything it
 * produces still has to survive the stop lists.
 */
function withoutLiterals(code: string): string {
  let out = '';
  let at = 0;

  while (at < code.length) {
    const char = code[at];
    const next = code[at + 1];

    if (char === '/' && next === '/') {
      while (at < code.length && code[at] !== '\n') at++;
      out += ' ';
      continue;
    }
    if (char === '/' && next === '*') {
      at += 2;
      while (at < code.length && !(code[at] === '*' && code[at + 1] === '/')) at++;
      at += 2;
      out += ' ';
      continue;
    }
    if (char === '"' || char === "'") {
      at++;
      while (at < code.length && code[at] !== char) at += code[at] === '\\' ? 2 : 1;
      at++;
      out += '""';
      continue;
    }
    if (char === '`') {
      at++;
      while (at < code.length && code[at] !== '`') {
        if (code[at] === '\\') {
          at += 2;
          continue;
        }
        // `${` opens an expression, and expressions are exactly what we want.
        if (code[at] === '$' && code[at + 1] === '{') {
          let depth = 1;
          at += 2;
          out += ' ';
          while (at < code.length && depth > 0) {
            if (code[at] === '{') depth++;
            else if (code[at] === '}') depth--;
            if (depth > 0) out += code[at];
            at++;
          }
          out += ' ';
          continue;
        }
        at++;
      }
      at++;
      continue;
    }

    out += char;
    at++;
  }

  return out;
}

/** `o.orderNumber`, `it?.savedAt` — a member read that plausibly names a field. */
const MEMBER_READ = /([A-Za-z_$][\w$]*)\s*\??\.\s*([A-Za-z_$][\w$]*)/g;

/**
 * Field names read off records inside one node's code parameters.
 *
 * Deliberately not clever: no computed access (`row[key]` names nothing this
 * can serve), no scope analysis, no attempt to work out *which* variable holds
 * a record. Anything that survives the two stop lists is offered as a field
 * name, and the caller decides which class it belongs to.
 */
export function codeFields(node: NodeGraphNode): Set<string> {
  const found = new Set<string>();
  const parameters = (node.parameters ?? {}) as Record<string, unknown>;

  for (const parameter of CODE_PARAMETERS) {
    const source = parameters[parameter];
    if (typeof source !== 'string' || !source) continue;

    const code = withoutLiterals(source);
    for (const match of code.matchAll(MEMBER_READ)) {
      const [, object, property] = match;
      if (NOT_A_RECORD.has(object)) continue;
      if (NOT_A_RECORD_FIELD.has(property) || NOT_A_FIELD.has(property)) continue;
      found.add(property);
    }
  }

  return found;
}

/**
 * Walk components for the classes they query and the fields they read.
 * `components` should be the candidate plus everything it instantiates.
 */
export function discoverDataShape(components: ComponentModel[]): Discovery {
  const discovery: Discovery = {
    byClass: new Map(),
    pooled: new Set(),
    user: new Set(),
    codePooled: new Set()
  };

  for (const component of components) {
    const nodes = new Map<string, NodeGraphNode>();
    // NB: returning truthy from this callback ABORTS the walk (forEachNode
    // propagates the return value as "stop"). Return nothing.
    component.graph.forEachNode((node: NodeGraphNode) => {
      nodes.set(node.id, node);
      const className = classOfNode(node);
      if (className) add(discovery.byClass, className, []);
      templateFields(node, discovery.pooled);
    });

    const fieldsByNode = new Map<string, Set<string>>();
    const note = (nodeId: string, port: string | undefined) => {
      const field = fieldFromPort(port);
      if (!field) return;
      const set = fieldsByNode.get(nodeId) ?? new Set<string>();
      set.add(field);
      fieldsByNode.set(nodeId, set);
    };

    const connections = component.graph.connections ?? [];
    for (const connection of connections) {
      note(connection.fromId, connection.fromProperty);
      note(connection.toId, connection.toProperty);
    }

    for (const [nodeId, fields] of fieldsByNode) {
      const node = nodes.get(nodeId);
      if (!node) continue;
      if (isUserNode(node)) {
        for (const field of fields) discovery.user.add(field);
        continue;
      }
      const className = classOfNode(node);
      if (className) add(discovery.byClass, className, fields);
      else for (const field of fields) discovery.pooled.add(field);
    }

    // The code pass. A code node names no class itself, so the class comes from
    // whatever is wired *into* it — `Query Records.items → Expression.orders`
    // is how a list reaches an expression.
    //
    // The walk is transitive, not one hop, because a model chains them: a live
    // candidate sorted in one Expression and then fed *that* into two more, so
    // the two that read `o.orderNumber` were two hops from the node that says
    // "Orders". A one-hop version found one field of five.
    const incoming = new Map<string, string[]>();
    for (const connection of connections) {
      incoming.set(connection.toId, [...(incoming.get(connection.toId) ?? []), connection.fromId]);
    }

    const classesUpstreamOf = (nodeId: string, seen: Set<string>, depth: number): Set<string> => {
      const found = new Set<string>();
      if (depth > MAX_UPSTREAM_HOPS) return found;
      for (const sourceId of incoming.get(nodeId) ?? []) {
        if (seen.has(sourceId)) continue;
        seen.add(sourceId);
        const source = nodes.get(sourceId);
        if (!source) continue;
        // A node that names a class is where the walk stops: whatever it does
        // to the records, they are still that class's records.
        const className = classOfNode(source);
        if (className) found.add(className);
        else for (const name of classesUpstreamOf(sourceId, seen, depth + 1)) found.add(name);
      }
      return found;
    };

    for (const [nodeId, node] of nodes) {
      const fields = codeFields(node);
      if (fields.size === 0) continue;

      const upstreamClasses = classesUpstreamOf(nodeId, new Set([nodeId]), 0);
      if (upstreamClasses.size > 0) {
        for (const className of upstreamClasses) add(discovery.byClass, className, fields);
      } else {
        for (const field of fields) discovery.codePooled.add(field);
      }
    }
  }

  return discovery;
}

/**
 * @param exact BEN-006 — the supply is the user's, so it is the answer and not
 *   a starting point. An agent that ships `{ Products: [] }` has told us
 *   nothing and gets the usual five synthesized rows; a *user* who deletes
 *   every row has asked to see the empty state, which is one of the states most
 *   worth looking at and the one no preview has ever been able to show.
 */
function recordsFor(
  fields: string[],
  supplied: Array<Record<string, unknown>> | undefined,
  exact = false
): SandboxRecord[] {
  if (!supplied || (supplied.length === 0 && !exact)) return synthesizeRecords(fields, RECORDS_PER_CLASS);
  // Supplied values win; inference only fills the gaps they left.
  return supplied.map((partial, index) => completeRecord(partial, fields, index));
}

export interface BuildSandboxDatasetOptions {
  /** The candidate plus every component it instantiates. */
  components: ComponentModel[];
  /** `sample_data` from the authoring model, when it supplied any. */
  sampleData?: AgentSampleData;
  /**
   * BEN-006 — records the user typed, layered above the agent's.
   *
   * Per class, and replacing rather than merging: a user who writes two rows of
   * `Products` gets two rows of `Products`, not two of theirs merged into five
   * of the agent's. A merge would put rows on screen that the user did not
   * write and cannot account for, which is the failure this whole feature
   * exists to end.
   *
   * Preview state, never project state (R5). Nothing here is written anywhere.
   */
  userData?: AgentSampleData;
  /**
   * POL-008 — whether the preview runs as the sample user or signed out.
   *
   * The dataset is built either way; only the summary and the seeded session
   * change. Defaults to `true`, which is the decision: a profile page has to
   * work with no clicks, and signed-out is the branch you go and ask for.
   */
  signedIn?: boolean;
  /**
   * FIX-013 ruling 1(c) — serve **no rows at all**, so the component shows its
   * real empty state and the user feeds it through its inputs instead.
   *
   * The graph walk still runs and the class list is still shipped: a class the
   * dataset *names* is served empty, which is what the store does with an empty
   * `records` array anyway. What changes is that nothing is synthesized, here or
   * in the runtime — hence `synthesizeMissing: false`, without which a class the
   * walk missed would come back with five invented rows and the empty state
   * would be a lie on exactly the components most likely to want one.
   *
   * ⚠️ **This is not "no sample data mode".** The network shim stays installed
   * and the sandbox user is still seeded; only the rows go. Turning the shim
   * *off* is `useSampleData: false`, which is a different thing entirely — it
   * lets the preview reach the project's real backend.
   */
  emptyState?: boolean;
}

/**
 * The dataset shipped in the preview export's metadata.
 *
 * Never empty: a graph that queries nothing still gets a signed-in user, and a
 * class the graph names but nothing describes still gets five records.
 */
export function buildSandboxDataset({
  components,
  sampleData,
  userData,
  signedIn = true,
  emptyState = false
}: BuildSandboxDatasetOptions): SandboxDataset {
  const discovery = discoverDataShape(components);

  const classNames = new Set<string>([
    ...discovery.byClass.keys(),
    ...Object.keys(sampleData ?? {}),
    ...Object.keys(userData ?? {})
  ]);
  const classes: Record<string, SandboxClass> = {};
  const unknownShape: string[] = [];
  const overridden: string[] = [];

  for (const className of classNames) {
    const attributed = discovery.byClass.get(className) ?? new Set<string>();
    // BEN-006: the user's records replace the agent's for this class, and only
    // for this class. `??` and not `||`, so an empty array is a real answer —
    // "show me this collection with no rows" is one of the states worth seeing.
    const fromUser = userData?.[className];
    const supplied = fromUser ?? sampleData?.[className];
    if (fromUser) overridden.push(className);
    const suppliedFields = new Set((supplied ?? []).flatMap((record) => Object.keys(record)));
    // Unattributed code reads are a last resort, used only for a class that
    // would otherwise be served empty. This is what keeps the code scan
    // strictly additive: a class with fields already keeps exactly those.
    const rescue =
      attributed.size === 0 && discovery.pooled.size === 0 && suppliedFields.size === 0
        ? discovery.codePooled
        : new Set<string>();
    // What the *graph* was found to read, kept apart from what the records
    // happen to carry. Both go into `fields` — the dataset has to serve every
    // key either way — but only this half answers "what will this component
    // look at", which is the question the data editor's column caption asks.
    const inferred = [...new Set([...attributed, ...discovery.pooled, ...rescue])].filter(
      (field) => !NOT_A_FIELD.has(field)
    );
    const fields = [...new Set([...inferred, ...suppliedFields])].filter((field) => !NOT_A_FIELD.has(field));

    // FIX-013 1(c): the notice exists because fieldless records render as blank
    // rows under a heading claiming results. With no rows there is nothing to
    // misread, so saying it anyway would be a caveat about data that is not
    // there — noise on precisely the components an empty state is built for.
    if (fields.length === 0 && !emptyState) unknownShape.push(className);

    // BEN-006 risk row: a user's records will not carry every field the graph
    // reads, and `completeRecord` fills the rest in — which is right, or the row
    // renders half-blank. But filling in silently is how a preview starts
    // lying about whose data it is showing, so name them and let the panel say
    // so. Only for a class the user actually wrote: for the agent's own data
    // this would be noise on every class, every time.
    const completed =
      fromUser && !emptyState
        ? fields.filter((field) => !fromUser.every((record) => record[field] !== undefined))
        : [];

    classes[className] = {
      fields,
      inferred,
      // FIX-013 1(c) — named, so the store serves the class empty rather than
      // inventing it, and so the field list survives for anything that reads it.
      records: emptyState ? [] : recordsFor(fields, supplied, fromUser !== undefined),
      ...(completed.length > 0 ? { completed } : {})
    };
  }

  const user = sandboxUser();
  for (const field of [...discovery.user, ...discovery.pooled]) {
    if (!(field in user)) user[field] = synthesizeRecords([field], 1)[0][field];
  }
  // A supplied record for the _User class stands in for the session user. The
  // user's own wins over the agent's, the same way it does for every other
  // class — but it is merged onto `sandboxUser()` rather than replacing it,
  // because the session needs `objectId` and `sessionToken` to exist whatever
  // anyone typed.
  const suppliedUser =
    userData?._User?.[0] ?? userData?.User?.[0] ?? sampleData?._User?.[0] ?? sampleData?.User?.[0];
  if (suppliedUser) Object.assign(user, suppliedUser);

  // ⚠️ **The strip must say which auth state the preview is in.** POL-008's
  // whole finding was a toolbar promising "signed in as a sample user" over a
  // preview that was not signed in; a strip that keeps saying it while the user
  // has *asked* to be signed out is the same defect with the sign reversed.
  // BEN-006: say which counts are the user's. A toolbar that reads the same
  // whether you are looking at inference or at what you typed is the POL-008
  // defect again — the strip has to say what state the preview is actually in.
  const yours = new Set(overridden);
  const counts = Object.entries(classes).map(
    ([name, klass]) => `${klass.records.length} ${name}${yours.has(name) ? ' (yours)' : ''}`
  );
  const who = signedIn ? 'signed in as a sample user' : 'signed out';

  // FIX-013 1(c) — (b)'s one-line caption, taken where the ruling said to take
  // it: an empty frame that says nothing reads as a broken bench, and this is
  // the only place the bench gets to say the emptiness is the point.
  if (emptyState) {
    const names = Object.keys(classes);
    return {
      classes,
      user,
      summary:
        names.length > 0
          ? `No sample data — ${names.join(', ')} served empty, ${who}`
          : `No sample data — ${who}`,
      unknownShape,
      synthesizeMissing: false
    };
  }

  const summary = counts.length > 0 ? `Sample data — ${counts.join(', ')}, ${who}` : `Sample data — ${who}`;

  return { classes, user, summary, unknownShape };
}

/**
 * The line the preview says out loud when it could not work out what a record
 * looks like.
 *
 * A preview that quietly serves five fieldless records renders five blank rows
 * under a heading that claims five results — which reads as "the component is
 * broken" when the truth is "the sandbox could not guess". The spec already
 * establishes this shape for a logic-only candidate; the same rule applies to
 * data whose shape is unknowable, and for the same reason.
 */
export function unknownShapeNotice(unknownShape: string[] | undefined): string | undefined {
  if (!unknownShape || unknownShape.length === 0) return undefined;
  const names = unknownShape.join(', ');
  const subject = unknownShape.length === 1 ? `${names} is` : `${names} are`;
  return (
    `${subject} read in a way this preview cannot infer fields from, so those records are empty — ` +
    'what you see is the layout, not the data. Ask the agent for sample data, or switch to the real backend.'
  );
}
