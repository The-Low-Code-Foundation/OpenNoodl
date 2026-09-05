/**
 * The relation verbs and their neighbours (EXP-002-RECORD-VERBS-TARGET-OUTPUT §17):
 * `AddDbModelRelation`, `RemoveDbModelRelation`, the `Record` node (`DbModel2`) and `PageInputs`.
 *
 * ⚠️ **Nothing here translated until EXP-011 §62**, and the corpus shape still does not: the corpus's only Add Record Relation
 * names no relation property, so the runtime's `validateInputs` answers *"No relation property
 * specified"*, `setError` fires and the backend is never called — the node fails on every pulse.
 * Its `Record` neighbour reads an Id from a `PageInputs` on a component no Router routes. So the
 * slice this file covers is a set of **named deferrals**, replacing three `logic node (…)`
 * catch-alls with the verdict the runtime itself reaches.
 *
 * Every gate is built here rather than found, because the corpus stops at the second one — the
 * "build the caller" discipline. That is also what proves the well-formed cases fall through to
 * the designed-not-built reason instead of to something wrong.
 */
import * as fs from 'fs';
import * as path from 'path';

import { Catalog, CatalogIndex } from '../src/catalog';
import { planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { ComponentIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

const FIXTURE = path.join(__dirname, 'fixtures', 'puppy-test-3');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const baseIr = parseProject(FIXTURE, catalog);

/** A routed page (the Router lists it) and a component nothing routes — PageInputs needs both. */
const ADMIN = 'Pages/Admin';
const UNROUTED = 'Components/Custom text';

const cloneIr = (): ExportIR => structuredClone(baseIr);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR =>
  source.components.find((c) => c.path === componentPath)!;
const lit = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value });

const addNode = (
  source: ExportIR,
  componentPath: string,
  id: string,
  type: string,
  parameters: Record<string, ParamValue> = {}
): NodeIR => {
  const node: NodeIR = {
    id,
    type,
    catalogRef: type,
    parameters: Object.entries(parameters)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
    declaredPorts: [],
    portKnowledge: 'partial'
  };
  componentOf(source, componentPath).nodes.push(node);
  return node;
};

const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else {
    node.parameters.push({ name, value });
    node.parameters.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
};
const dropParam = (node: NodeIR, name: string) => {
  node.parameters = node.parameters.filter((p) => p.name !== name);
};

const wire = (
  source: ExportIR,
  componentPath: string,
  fromId: string,
  fromProperty: string,
  toId: string,
  toProperty: string,
  kind: 'value' | 'signal' = 'value'
) => {
  componentOf(source, componentPath).connections.push({
    key: `${fromId}:${fromProperty}->${toId}:${toProperty}`,
    fromId,
    fromProperty,
    toId,
    toProperty,
    kind
  });
};
const unwire = (source: ExportIR, componentPath: string, key: string) => {
  const component = componentOf(source, componentPath);
  component.connections = component.connections.filter((c) => c.key !== key);
};

/** The deferral reason the planner recorded for one node, or undefined when it did not defer. */
const reasonFor = (source: ExportIR, componentPath: string, nodeId: string): string | undefined => {
  const project = planProject(source, new CatalogIndex(catalog));
  const plan = project.plans.find((p) => p.path === componentPath)!;
  const disposition = plan.dispositions[nodeId] as { kind: string; reason?: string };
  return disposition?.kind === 'deferred' ? disposition.reason : undefined;
};

/**
 * The corpus's own graph, rebuilt on the fixture: a Create whose `Id` and `done` drive an Add
 * Record Relation, whose Target Record Id comes from a `Record` node — `Puppy test`'s Puppy
 * Detail page, node for node. `relationProperty` is left unauthored **exactly as the corpus
 * leaves it**; the tests that need it well-formed set it themselves.
 */
const withRelationGraph = (): ExportIR => {
  const source = cloneIr();
  addNode(source, ADMIN, 'puppyModel', 'DbModel2', {
    collectionName: lit('Puppy'),
    idSource: lit('explicit'),
    modelId: lit('seed-id')
  });
  addNode(source, ADMIN, 'linkInquiry', 'AddDbModelRelation', { collectionName: lit('Inquiry') });
  wire(source, ADMIN, 'createRecord', 'id', 'linkInquiry', 'modelId');
  wire(source, ADMIN, 'createRecord', 'done', 'linkInquiry', 'store', 'signal');
  wire(source, ADMIN, 'puppyModel', 'id', 'linkInquiry', 'targetId');
  return source;
};

/** The same graph with every gate satisfied — the shape the corpus does not have. */
const wellFormedRelation = (): ExportIR => {
  const source = withRelationGraph();
  const link = componentOf(source, ADMIN).nodes.find((n) => n.id === 'linkInquiry')!;
  setParam(link, 'relationProperty', lit('puppy'));
  return source;
};

describe('§17 — Add Record Relation: the gates, in the order validateInputs reaches them', () => {
  it('the corpus shape — no relation property — defers with the runtime\'s own verdict', () => {
    expect(reasonFor(withRelationGraph(), ADMIN, 'linkInquiry')).toBe(
      'no relation property is named, so the runtime answers Failure with "No relation property specified" and never calls the backend'
    );
  });

  it('no class named is refused first, before the relation property is even looked at', () => {
    const source = withRelationGraph();
    dropParam(componentOf(source, ADMIN).nodes.find((n) => n.id === 'linkInquiry')!, 'collectionName');
    expect(reasonFor(source, ADMIN, 'linkInquiry')).toBe(
      'no class is named, so the runtime answers Failure with "No class specified" and never calls the backend'
    );
  });

  it('an unwired Target Record Id is named, and only after the relation property is set', () => {
    const source = wellFormedRelation();
    unwire(source, ADMIN, 'puppyModel:id->linkInquiry:targetId');
    expect(reasonFor(source, ADMIN, 'linkInquiry')).toBe(
      'no Target Record Id is wired, so the runtime answers Failure with "No target record Id ... specified" and never calls the backend'
    );
  });

  it('a node with no record of its own to put the relation on is named', () => {
    const source = wellFormedRelation();
    unwire(source, ADMIN, 'createRecord:id->linkInquiry:modelId');
    expect(reasonFor(source, ADMIN, 'linkInquiry')).toBe(
      'it names no record to put the relation on, so the runtime answers Failure with "No record Id specified" and never calls the backend'
    );
  });

  /**
   * NDA-012's check, statically. `Model.get` mints a record on read, so an id from a text input
   * resolves to a record whose class is `undefined` — and the *failing* write is what burns the
   * relation column into the class schema as `Relation<undefined>` for the life of the class.
   * The runtime refuses it; so does this.
   */
  it('a Target Record Id from something that never loaded a record is refused by class, not by id', () => {
    const source = wellFormedRelation();
    unwire(source, ADMIN, 'puppyModel:id->linkInquiry:targetId');
    wire(source, ADMIN, 'idInput', 'onTextChanged', 'linkInquiry', 'targetId');
    expect(reasonFor(source, ADMIN, 'linkInquiry')).toBe(
      "its Target Record Id comes from net.noodl.controls.textinput rather than a Record or Query Records output, so the target's class is unknown and the runtime refuses the write"
    );
  });

  /**
   * EXP-011 §62 built the pair (`tests/relation-pair.test.ts`), so the designed-not-built reason is gone. What
   * this graph pins now is the corpus's own wall: the verb's Do is fired by a Create whose Id it consumes, and
   * that Create is **gate 11** — and the verb, compiled from the wire side, names the same wall from its own
   * side rather than being built on a refused chain. §4c's chain-local `created.id` is the increment that would move both.
   */
  it("a well-formed relation fed a Create's Id names §4c's unbuilt chain-local read — the pre-flight passed", () => {
    expect(reasonFor(wellFormedRelation(), ADMIN, 'linkInquiry')).toBe(
      "its Id is the Id output of a record verb — that value exists only inside the verb's own done chain, and the chain-local read RECORD-VERBS-TARGET §4c designs is not built"
    );
  });

  /** Zero corpus instances, so this is target-output-only — and it must not be a hole. */
  it('Remove Record Relation is gated identically, though the corpus has none', () => {
    const source = withRelationGraph();
    componentOf(source, ADMIN).nodes.find((n) => n.id === 'linkInquiry')!.type = 'RemoveDbModelRelation';
    expect(reasonFor(source, ADMIN, 'linkInquiry')).toBe(
      'no relation property is named, so the runtime answers Failure with "No relation property specified" and never calls the backend'
    );
  });
});

describe('§17 — the Record node', () => {
  /**
   * ⚠️ **The feeder is `To CSV`, and the node it used to be is why.** This row was written with a
   * `Unique Id` and EXP-011 §37 translated that node, so the assertion started reading a reason
   * about a *resolved* read — the second time this test has lost its example, after Tier 2.5 took
   * `PageInputs` (see the note below).
   *
   * 🔴 The replacement is drawn from the ledger's **`deliberately out of scope`** set rather than
   * its `scheduled` set. A scheduled node is one some later session translates, and this row then
   * fails for a reason that has nothing to do with what it is testing. `net.noodl.ToCSV` is one
   * nobody is waiting on, so the example stops being a moving target.
   */
  it('a Record whose Id is fed by an untranslated node names that feeder', () => {
    const source = cloneIr();
    addNode(source, ADMIN, 'toCsv', 'net.noodl.ToCSV', {});
    addNode(source, ADMIN, 'puppyModel', 'DbModel2', {
      collectionName: lit('Puppy'),
      idSource: lit('explicit')
    });
    wire(source, ADMIN, 'toCsv', 'text', 'puppyModel', 'modelId');
    expect(reasonFor(source, ADMIN, 'puppyModel')).toBe(
      'its Id is fed by net.noodl.ToCSV, which has no statically known source'
    );
  });

  /**
   * EXP-011 Tier 2.5 moved this one. `PageInputs` was this file's example of an untranslated
   * feeder — a Record whose Id came from a url parameter deferred *naming Page Inputs*, and the
   * assertion above used to read `its Id is fed by PageInputs`. Now that a `pm-` read resolves,
   * the Record falls through to its own wall.
   *
   * 🔴 **Kept as a test rather than deleted, because it is the more useful assertion of the
   * two.** "The feeder is named" is tested above with a feeder that really is untranslated; what
   * this pins is that closing one gate does not silently open the node behind it. The reason it
   * now gives is the well-formed Record's reason, identical to the last test in this file — so a
   * future slice that builds single-record reads will see both move together, and a slice that
   * accidentally lets a Record through will see exactly this line fail.
   */
  it('a Record whose Id is a Page Inputs parameter clears the feeder gate and hits the Record wall', () => {
    const source = cloneIr();
    addNode(source, ADMIN, 'pageInputs', 'PageInputs', { pathParams: lit('id') });
    addNode(source, ADMIN, 'puppyModel', 'DbModel2', {
      collectionName: lit('Puppy'),
      idSource: lit('explicit')
    });
    wire(source, ADMIN, 'pageInputs', 'pm-id', 'puppyModel', 'modelId');
    // EXP-011 §43 built the single-record read: with `Fetch` unwired the node is an effect keyed
    // on the page parameter, so there is no reason left to give — the row below pins that the
    // module export exists, which is the positive half of what this test used to pin negatively.
    expect(reasonFor(source, ADMIN, 'puppyModel')).toBeUndefined();
    expect(emitApp(source, catalog).files['src/api/puppies.ts']).toContain('export async function fetchPuppyById(id: string): Promise<Puppy>');
  });

  it('a Record bound to the enclosing repeater row hits the row-identity wall by name', () => {
    const source = withRelationGraph();
    setParam(componentOf(source, ADMIN).nodes.find((n) => n.id === 'puppyModel')!, 'idSource', lit('foreach'));
    expect(reasonFor(source, ADMIN, 'puppyModel')).toBe(
      "its Id Source is the enclosing repeater's row — row identity is not statically knowable in this slice"
    );
  });

  it('a Record with no class named is refused before its Id is looked at', () => {
    const source = withRelationGraph();
    dropParam(componentOf(source, ADMIN).nodes.find((n) => n.id === 'puppyModel')!, 'collectionName');
    expect(reasonFor(source, ADMIN, 'puppyModel')).toBe('no class is named, so the node has no collection to read a record from');
  });

  it('a Record naming no record at all is named, the way the runtime binds to nothing', () => {
    const source = withRelationGraph();
    dropParam(componentOf(source, ADMIN).nodes.find((n) => n.id === 'puppyModel')!, 'modelId');
    expect(reasonFor(source, ADMIN, 'puppyModel')).toBe('it names no record, so the runtime binds to nothing and never reads one');
  });

  it('two wires into one Id is the last-writer-wins rule again', () => {
    const source = withRelationGraph();
    wire(source, ADMIN, 'idInput', 'onTextChanged', 'puppyModel', 'modelId');
    wire(source, ADMIN, 'nameInput-2', 'onTextChanged', 'puppyModel', 'modelId');
    expect(reasonFor(source, ADMIN, 'puppyModel')).toBe('two wires feed its Id — last-writer-wins is not statically ordered');
  });

  it('a well-formed Record translates (EXP-011 §43) — the reason this row used to pin is gone, and the read is in the module', () => {
    const source = withRelationGraph();
    expect(reasonFor(source, ADMIN, 'puppyModel')).toBeUndefined();
    expect(emitApp(source, catalog).files['src/api/puppies.ts']).toContain('export async function fetchPuppyById(id: string): Promise<Puppy>');
  });
});

describe('§17 — PageInputs: a page parameter with no route to carry it', () => {
  it('an unrouted component reading page parameters says so, and names them', () => {
    const source = cloneIr();
    addNode(source, UNROUTED, 'pageInputs', 'PageInputs', { pathParams: lit('id') });
    expect(reasonFor(source, UNROUTED, 'pageInputs')).toBe(
      'it reads the page parameters "id", but no Router routes this component, so there is no URL to read them from'
    );
  });

  /**
   * EXP-011 Tier 2.5 added this row. The old shape of the reason asked only about `pathParams`,
   * which read as a claim that a node declaring only *query* parameters was fine off a route —
   * and it is not: the Router feeds a Page Inputs by walking the page's own node scope, so off a
   * route neither list is ever filled.
   */
  it('the same is true of a component reading only query parameters', () => {
    const source = cloneIr();
    addNode(source, UNROUTED, 'pageInputs', 'PageInputs', { queryParams: lit('sort') });
    expect(reasonFor(source, UNROUTED, 'pageInputs')).toBe(
      'it reads the page parameters "sort", but no Router routes this component, so there is no URL to read them from'
    );
  });

  /**
   * The control the reason above needs: on a component the Router *does* route, the same node
   * does **not** give the no-route reason. Without this row, "no Router routes this component"
   * would read as true of every PageInputs, which is the claim it is not making.
   *
   * ⚠️ The reason it gives instead moved in Tier 2.5, and the new one is about *this node* rather
   * than about the slice: a routed Page Inputs nothing reads is inert in the running app too.
   */
  it('a routed page whose parameters nothing reads is inert, and says that instead', () => {
    const source = cloneIr();
    addNode(source, ADMIN, 'pageInputs', 'PageInputs', { pathParams: lit('id') });
    expect(reasonFor(source, ADMIN, 'pageInputs')).toBe(
      'nothing reads any of its parameters, so it contributes no value to the page'
    );
  });

  it('a PageInputs declaring nothing off a route still names the route as the problem', () => {
    const source = cloneIr();
    addNode(source, UNROUTED, 'pageInputs', 'PageInputs');
    expect(reasonFor(source, UNROUTED, 'pageInputs')).toBe(
      'it is a Page Inputs on a component no Router routes, so there is no URL to read from'
    );
  });
});

describe('§17 — the sweep replaces the catch-all and nothing else', () => {
  /**
   * The load-bearing control, and it failed usefully when it was first written the lazy way —
   * as "adding the relation graph moves nothing". It moves exactly one thing, and that one thing
   * is the corpus's third deferral: wiring `Id` into the relation verb is **gate 11**, so the
   * Create beside it stops collapsing into its button and defers by name. Update and Delete,
   * which the relation graph does not touch, must not move at all.
   *
   * Asserting the whole row rather than "nothing changed" is what keeps this honest: the sweep
   * sits immediately before the `logic node (…)` catch-all so it cannot pre-empt an earlier
   * pass, and these three verbs are dispositioned much earlier.
   */
  it('the relation graph moves the Create to gate 11 and leaves Update and Delete untouched', () => {
    const planOf = (source: ExportIR) => {
      const project = planProject(source, new CatalogIndex(catalog));
      return project.plans.find((p) => p.path === ADMIN)!;
    };
    const before = planOf(cloneIr());
    const after = planOf(withRelationGraph());

    expect(JSON.stringify(before.dispositions['createRecord'])).toBe('{"kind":"collapsed","into":"addBtn"}');
    expect(reasonFor(withRelationGraph(), ADMIN, 'createRecord')).toBe(
      'its Id output is consumed — the record it names exists only inside the invoking chain, which the relation verbs would need'
    );

    for (const id of ['updateRecord', 'deleteRecord']) {
      expect(JSON.stringify(after.dispositions[id])).toBe(JSON.stringify(before.dispositions[id]));
    }
  });

  /**
   * `Counter` was the first pick here and it does **not** fall to the catch-all — it has a reason
   * of its own. A control that never reaches the thing it controls for proves nothing, so this
   * uses a type the audit shows genuinely landing on `logic node (…)`.
   */
  it('a node the sweep does not know still falls to the catch-all', () => {
    const source = cloneIr();
    addNode(source, ADMIN, 'someLogic', 'net.noodl.WebSocket');
    expect(reasonFor(source, ADMIN, 'someLogic')).toBe('logic node (net.noodl.WebSocket)');
  });
});

/**
 * 🔴 The hole the mutation check found, and the reason this describe block exists.
 *
 * A component with no visual root dispositions every node and **returns early**, long before the
 * sweep at the bottom of `planComponent` runs. A relation verb sitting in such a component
 * therefore fell straight to `logic node (…)` — the sweep looked complete and was not. Nothing in
 * the corpus exhibits it (its only relation graph lives on a page with a Group root), so no
 * coverage number would ever have moved to say so.
 */
describe('§17 — a component with no visual root gets the named reasons too', () => {
  const LOGIC_ONLY = 'Components/LogicOnly';

  /** A component holding nothing that renders — the early-return path, built rather than found. */
  const withLogicOnlyComponent = (): ExportIR => {
    const source = cloneIr();
    source.components.push({
      id: 'logic-only-id',
      path: LOGIC_ONLY,
      role: 'component',
      nodes: [],
      connections: [],
      intent: componentOf(source, UNROUTED).intent
    });
    return source;
  };

  it('the component really does take the early return — the control this needs', () => {
    const source = withLogicOnlyComponent();
    addNode(source, LOGIC_ONLY, 'someLogic', 'net.noodl.WebSocket');
    const project = planProject(source, new CatalogIndex(catalog));
    const plan = project.plans.find((p) => p.path === LOGIC_ONLY)!;
    expect(plan.skipReason).toBe('no visual root — logic-only components defer to EXP-003');
    expect(reasonFor(source, LOGIC_ONLY, 'someLogic')).toBe('logic node (net.noodl.WebSocket)');
  });

  it('a relation verb there is named, not swept into the catch-all', () => {
    const source = withLogicOnlyComponent();
    addNode(source, LOGIC_ONLY, 'linkInquiry', 'AddDbModelRelation', { collectionName: lit('Inquiry') });
    expect(reasonFor(source, LOGIC_ONLY, 'linkInquiry')).toBe(
      'no relation property is named, so the runtime answers Failure with "No relation property specified" and never calls the backend'
    );
  });

  it('an unrouted PageInputs there is named', () => {
    const source = withLogicOnlyComponent();
    addNode(source, LOGIC_ONLY, 'pageInputs', 'PageInputs', { pathParams: lit('id') });
    expect(reasonFor(source, LOGIC_ONLY, 'pageInputs')).toBe(
      'it reads the page parameters "id", but no Router routes this component, so there is no URL to read them from'
    );
  });

  /**
   * There is no expression vocabulary on this path, and saying so is the honest answer rather
   * than a fudge: in a component that translates nothing, a wired Id has no statically known
   * source by construction.
   */
  it("a Record's wired Id names its feeder, with no expression vocabulary to consult", () => {
    const source = withLogicOnlyComponent();
    addNode(source, LOGIC_ONLY, 'pageInputs', 'PageInputs', { pathParams: lit('id') });
    addNode(source, LOGIC_ONLY, 'puppyModel', 'DbModel2', {
      collectionName: lit('Puppy'),
      idSource: lit('explicit')
    });
    wire(source, LOGIC_ONLY, 'pageInputs', 'pm-id', 'puppyModel', 'modelId');
    expect(reasonFor(source, LOGIC_ONLY, 'puppyModel')).toBe('its Id is fed by PageInputs, which has no statically known source');
  });
});
