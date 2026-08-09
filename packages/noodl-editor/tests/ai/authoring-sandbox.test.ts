/**
 * AIX-008 — the sandbox preview's editor half: what data the graph expects,
 * and the export a preview window is fed.
 *
 * The invariant these exist to defend is the one AIX-002 built the whole
 * staging contract around: building a preview must not touch the project.
 * Everything else here is about never showing an empty screen — a class with
 * no described fields still gets records, and a component with nothing visual
 * says so instead of rendering white.
 */

import { buildCandidate } from '../../src/editor/src/models/AiAssistant/authoring/candidate';
import {
  buildSandboxDataset,
  codeFields,
  discoverDataShape,
  unknownShapeNotice
} from '../../src/editor/src/models/AiAssistant/authoring/sandboxData';
import {
  buildSandboxExport,
  candidateComponent,
  candidateIsRenderable,
  componentClosure
} from '../../src/editor/src/models/AiAssistant/authoring/sandboxExport';
import type { AuthoringRequest, ComponentFiles, SubmitPayload } from '../../src/editor/src/models/AiAssistant/authoring/types';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';
import type { SandboxDataset } from '@noodl/runtime/src/sandbox/types';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

const REQUEST: AuthoringRequest = {
  description: 'A book list.',
  componentPath: 'Pages/Books'
};

function loadProject(): ProjectModel {
  return ProjectModel.fromJSON(JSON.parse(JSON.stringify(gitRepoUtf8)));
}

function files(payload: SubmitPayload): ComponentFiles {
  const result = buildCandidate(REQUEST, payload);
  expect(result.errors).toEqual([]);
  return result.files!;
}

/** The same, for a second component — AIB-004's siblings need distinct paths. */
function filesAt(componentPath: string, payload: SubmitPayload): ComponentFiles {
  const result = buildCandidate({ ...REQUEST, componentPath }, payload);
  expect(result.errors).toEqual([]);
  return result.files!;
}

/** A page that queries a collection and shows two of its fields. */
function bookListPayload(): SubmitPayload {
  return {
    nodes: [
      { id: 'group', type: 'Group' },
      { id: 'query', type: 'DbCollection2', parameters: { collectionName: 'Books' } },
      { id: 'record', type: 'DbModel2', parameters: { collectionName: 'Books' } },
      { id: 'text', type: 'Text', parent: 'group' }
    ],
    connections: [
      { fromId: 'record', fromProperty: 'prop-title', toId: 'text', toProperty: 'text' },
      { fromId: 'record', fromProperty: 'prop-coverImageUrl', toId: 'text', toProperty: 'visible' }
    ],
    visualRoots: ['group']
  };
}

/**
 * The shape a real model actually produces for a list, found by running AIX-008
 * against a live provider: the collection goes straight into an `Expression`
 * and the field names live inside the code string, on no wire at all. Six of
 * nine data-reading candidates bound their data this way.
 */
function ordersPayload(): SubmitPayload {
  return {
    nodes: [
      { id: 'root', type: 'Group' },
      { id: 'query', type: 'DbCollection2', parameters: { collectionName: 'Orders' } },
      {
        id: 'rows',
        type: 'Expression',
        parameters: {
          expression:
            "orders.slice().sort((a,b) => a.total - b.total)" +
            ".map(o => (o.orderNumber || '') + ' — ' + o.customerName + ' $' + o.total.toFixed(2)).join('\\n')"
        }
      },
      { id: 'text', type: 'Text', parent: 'root' }
    ],
    connections: [
      { fromId: 'query', fromProperty: 'items', toId: 'rows', toProperty: 'orders' },
      { fromId: 'rows', fromProperty: 'asString', toId: 'text', toProperty: 'text' }
    ],
    visualRoots: ['root']
  };
}

/** Two collections on one page — BEN-006 exists to override one and not the other. */
function twoClassPayload(): SubmitPayload {
  return {
    nodes: [
      { id: 'root', type: 'Group' },
      { id: 'products', type: 'DbCollection2', parameters: { collectionName: 'Products' } },
      { id: 'product', type: 'DbModel2', parameters: { collectionName: 'Products' } },
      { id: 'categories', type: 'DbCollection2', parameters: { collectionName: 'Categories' } },
      { id: 'category', type: 'DbModel2', parameters: { collectionName: 'Categories' } },
      { id: 'text', type: 'Text', parent: 'root' },
      { id: 'label', type: 'Text', parent: 'root' }
    ],
    connections: [
      { fromId: 'product', fromProperty: 'prop-name', toId: 'text', toProperty: 'text' },
      { fromId: 'product', fromProperty: 'prop-price', toId: 'text', toProperty: 'visible' },
      { fromId: 'category', fromProperty: 'prop-label', toId: 'label', toProperty: 'text' }
    ],
    visualRoots: ['root']
  };
}

/** A page that queries a class and reads nothing off any record, anywhere. */
function shapelessPayload(): SubmitPayload {
  return {
    nodes: [
      { id: 'root', type: 'Group' },
      { id: 'query', type: 'DbCollection2', parameters: { collectionName: 'Orders' } },
      { id: 'text', type: 'Text', parent: 'root' }
    ],
    connections: [{ fromId: 'query', fromProperty: 'count', toId: 'text', toProperty: 'text' }],
    visualRoots: ['root']
  };
}

describe('AIX-008 fields read inside code', () => {
  it('reads field names out of an Expression, and not the language around them', () => {
    const found = codeFields({
      parameters: {
        expression: "o.orderNumber + ' ' + o.customerName + ' ' + o.total.toFixed(2) + items.length"
      }
    } as never);

    expect([...found].sort()).toEqual(['customerName', 'orderNumber', 'total']);
  });

  it('ignores the runtime’s own surfaces, so Inputs.items is not a field called items', () => {
    const found = codeFields({
      parameters: {
        functionScript:
          'var rows = Inputs.items || [];\n' +
          'Outputs.list = rows.map(function (it) { return it.title + Math.round(it.rating); });'
      }
    } as never);

    expect([...found].sort()).toEqual(['rating', 'title']);
  });

  it('ignores the Script node’s lower-case inputs/outputs too', () => {
    // `Function` scripts read `Inputs.x`; `Script` nodes are written as
    // `define({ run: function (inputs, outputs) { … } })`. Missing the
    // lower-case pair put fields called `items` and `text` on every record.
    const found = codeFields({
      parameters: {
        code:
          "define({ inputs: { items: 'array' }, outputs: { text: 'string' }, run: function (inputs, outputs) {" +
          '  var rows = inputs.items || [];' +
          '  outputs.text = rows.map(function (i) { return i.title + i.savedAt; }).join();' +
          '} });'
      }
    } as never);

    expect([...found].sort()).toEqual(['savedAt', 'title']);
  });

  it('does not mistake a URL in a string literal for a field', () => {
    // The `//` in `https://` used to be read as a line comment, which ate the
    // rest of the line — including the only real field on it.
    const found = codeFields({
      parameters: { code: "var url = 'https://example.com/orders'; Outputs.value = row.reference;" }
    } as never);

    expect([...found]).toEqual(['reference']);
  });

  it('does not mistake an apostrophe in a comment for a string either', () => {
    const found = codeFields({
      parameters: { expression: "// don't count the ones we skip\nrow.reference + row.amount" }
    } as never);

    expect([...found].sort()).toEqual(['amount', 'reference']);
  });

  it('reads through a template literal to the expressions inside it', () => {
    const found = codeFields({
      parameters: { expression: 'items.map(o => `${o.title} — ${o.author} (https://x.example/y)`)' }
    } as never);

    expect([...found].sort()).toEqual(['author', 'title']);
  });

  it('attributes them to the collection wired into the code node', () => {
    const { component } = candidateComponent(files(ordersPayload()));
    const shape = discoverDataShape([component]);

    expect([...(shape.byClass.get('Orders') ?? [])].sort()).toEqual(['customerName', 'orderNumber', 'total']);
    // Attributed, so nothing had to fall back to the unattributed pool.
    expect([...shape.codePooled]).toEqual([]);
  });

  it('follows the collection through a chain of code nodes', () => {
    // A live candidate sorted in one Expression and fed that into two more, so
    // the two that named four of the five fields were two hops from the node
    // that says "Orders". A one-hop walk recovered one field of five.
    const { component } = candidateComponent(
      files({
        nodes: [
          { id: 'root', type: 'Group' },
          { id: 'query', type: 'DbCollection2', parameters: { collectionName: 'Orders' } },
          { id: 'sorted', type: 'Expression', parameters: { expression: '[...items].sort((a,b) => a.placedAt - b.placedAt)' } },
          { id: 'rows', type: 'Expression', parameters: { expression: "items.map(o => o.orderNumber + o.status).join('')" } },
          { id: 'text', type: 'Text', parent: 'root' }
        ],
        connections: [
          { fromId: 'query', fromProperty: 'items', toId: 'sorted', toProperty: 'items' },
          { fromId: 'sorted', fromProperty: 'result', toId: 'rows', toProperty: 'items' },
          { fromId: 'rows', fromProperty: 'asString', toId: 'text', toProperty: 'text' }
        ],
        visualRoots: ['root']
      })
    );

    expect([...(discoverDataShape([component]).byClass.get('Orders') ?? [])].sort()).toEqual([
      'orderNumber',
      'placedAt',
      'status'
    ]);
  });

  it('fills the records a code-bound list reads, which is the whole point', () => {
    const dataset = buildSandboxDataset({ components: [candidateComponent(files(ordersPayload())).component] });
    const first = dataset.classes.Orders.records[0];

    expect(dataset.classes.Orders.records.length).toBe(5);
    expect(dataset.classes.Orders.fields.sort()).toEqual(['customerName', 'orderNumber', 'total']);
    // What matters is that every field the code reads has *a* value; which
    // shape each one takes is `synthesizeValue`'s business, and it reads
    // `orderNumber` as a number because the name ends in "number".
    expect(first.orderNumber === undefined).toBe(false);
    expect(typeof first.customerName).toBe('string');
    expect(typeof first.total).toBe('number');
    expect(dataset.unknownShape).toEqual([]);
  });

  it('adds nothing to a class the wires already described', () => {
    // The guarantee the code scan is only allowed to keep: strictly more
    // coverage, never a different answer where there already was one.
    const withoutCode = buildSandboxDataset({ components: [candidateComponent(files(bookListPayload())).component] });

    const payload = bookListPayload();
    payload.nodes.push({
      id: 'unrelated',
      type: 'Expression',
      parameters: { expression: 'anything.inventedField + 1' }
    });
    const withCode = buildSandboxDataset({ components: [candidateComponent(files(payload)).component] });

    expect(withCode.classes.Books.fields.sort()).toEqual(withoutCode.classes.Books.fields.sort());
    expect(withCode.classes.Books.fields.indexOf('inventedField')).toBe(-1);
  });
});

describe('AIX-008 sandbox data discovery', () => {
  it('finds the classes a graph queries and the fields it reads', () => {
    const { component } = candidateComponent(files(bookListPayload()));
    const shape = discoverDataShape([component]);

    expect([...shape.byClass.keys()]).toContain('Books');
    expect([...(shape.byClass.get('Books') ?? [])].sort()).toEqual(['coverImageUrl', 'title']);
  });

  it('never leaves a queried class without records', () => {
    const dataset = buildSandboxDataset({ components: [candidateComponent(files(bookListPayload())).component] });

    expect(dataset.classes.Books.records.length).toBe(5);
    expect(typeof dataset.classes.Books.records[0].title).toBe('string');
    expect(String(dataset.classes.Books.records[0].coverImageUrl)).toContain('data:image/svg+xml');
  });

  it('prefers the agent’s sample records and fills the fields it left out', () => {
    const dataset = buildSandboxDataset({
      components: [candidateComponent(files(bookListPayload())).component],
      sampleData: { Books: [{ title: 'The Left Hand of Darkness' }] }
    });

    expect(dataset.classes.Books.records.length).toBe(1);
    expect(dataset.classes.Books.records[0].title).toBe('The Left Hand of Darkness');
    expect(String(dataset.classes.Books.records[0].coverImageUrl)).toContain('data:image/svg+xml');
  });

  it('always signs the preview in as someone', () => {
    const dataset = buildSandboxDataset({ components: [] });
    expect(String(dataset.user.email)).toContain('@example.com');
    expect(dataset.summary).toBeTruthy();
  });

  it('follows component instances when collecting what to sample', () => {
    const project = loadProject();
    const existing = project.getComponents()[0];
    const { component } = candidateComponent(
      files({
        nodes: [
          { id: 'group', type: 'Group' },
          { id: 'child', type: existing.name, parent: 'group' }
        ],
        visualRoots: ['group']
      })
    );

    expect(componentClosure(project, component).map((c) => c.name)).toContain(existing.name);
  });
});

describe('AIX-008 sandbox export', () => {
  it('renders the candidate as root without adding it to the project', () => {
    const project = loadProject();
    const before = JSON.stringify(project.toJSON());

    const result = buildSandboxExport({ project, files: files(bookListPayload()) });

    expect(result.json).toBeTruthy();
    expect(result.json!.rootComponent).toBe('/Pages/Books');
    expect(result.json!.components.some((c) => c.name === '/Pages/Books')).toBe(true);

    // The one invariant AIX-002 is built on: nothing crossed into the project.
    expect(project.getComponentWithName('/Pages/Books')).toBeFalsy();
    expect(JSON.stringify(project.toJSON())).toBe(before);
  });

  it('ships the dataset in the metadata the runtime reads', () => {
    const result = buildSandboxExport({ project: loadProject(), files: files(bookListPayload()) });
    expect((result.json!.metadata!.sandbox as SandboxDataset).classes.Books.records.length).toBe(5);
    expect(result.summary).toContain('Books');
  });

  it('ships no dataset when the preview is pointed at the real backend', () => {
    const result = buildSandboxExport({
      project: loadProject(),
      files: files(bookListPayload()),
      useSampleData: false
    });
    expect(result.json!.metadata!.sandbox).toBeUndefined();
    expect(result.summary).toContain('Real backend');
  });

  it('replaces the live component when the candidate revises one', () => {
    const project = loadProject();
    const existing = project.getComponents()[0];
    const result = buildSandboxExport({
      project,
      files: files({ nodes: [{ id: 'group', type: 'Group' }], visualRoots: ['group'] })
    });

    const named = result.json!.components.filter((c) => c.name === existing.name);
    expect(named.length).toBe(1);
  });

  it('says the fields are unknown rather than serving plausible blanks', () => {
    // The failure this exists to prevent: five records with nothing on them,
    // rendering as five empty rows under a heading that claims five results —
    // which reads as a broken component rather than as an unguessable shape.
    const result = buildSandboxExport({ project: loadProject(), files: files(shapelessPayload()) });

    expect(result.json).toBeTruthy();
    expect((result.json!.metadata!.sandbox as SandboxDataset).unknownShape).toEqual(['Orders']);
    expect(result.notice).toContain('Orders');
    expect(result.notice).toContain('layout, not the data');
  });

  it('carries no caveat when the fields were found', () => {
    const result = buildSandboxExport({ project: loadProject(), files: files(ordersPayload()) });
    expect(result.notice).toBeUndefined();
  });

  it('says nothing when there is nothing to say', () => {
    expect(unknownShapeNotice([])).toBeUndefined();
    expect(unknownShapeNotice(undefined)).toBeUndefined();
  });

  it('says so rather than rendering white when there is nothing visual', () => {
    const result = buildSandboxExport({
      project: loadProject(),
      files: files({
        nodes: [{ id: 'in', type: 'Component Inputs', ports: [{ name: 'Trigger', plug: 'output', type: '*' }] }]
      })
    });

    expect(result.json).toBeUndefined();
    expect(result.unrenderable).toContain('nothing to render');
  });
});

/**
 * AIB-004 — a plan's operations reference each other, and until the whole plan
 * is applied NONE of them is in the project. A preview of one that splices only
 * itself boots a page whose child component does not exist, which is a blank
 * frame — the exact failure the preview was wired in to answer.
 */
describe('AIB-004 sandbox export with sibling candidates', () => {
  const CARD = 'Components/BookCard';
  const LIST = 'Pages/BookList';

  function cardFiles(): ComponentFiles {
    return filesAt(CARD, {
      nodes: [
        { id: 'card_root', type: 'Group' },
        { id: 'card_title', type: 'Text', parent: 'card_root', parameters: { text: 'A book' } }
      ],
      visualRoots: ['card_root']
    });
  }

  /** A page whose only child is the component another operation authored. */
  function listFiles(): ComponentFiles {
    return filesAt(LIST, {
      nodes: [
        { id: 'list_root', type: 'Group' },
        { id: 'list_card', type: `/${CARD}`, parent: 'list_root' }
      ],
      visualRoots: ['list_root']
    });
  }

  it('splices every staged candidate in, so a page that instantiates a sibling renders', () => {
    const project = loadProject();
    const before = JSON.stringify(project.toJSON());

    const result = buildSandboxExport({ project, files: listFiles(), siblings: [cardFiles()] });

    const names = result.json!.components.map((c) => c.name);
    expect(result.json!.rootComponent).toBe(`/${LIST}`);
    expect(names).toContain(`/${LIST}`);
    // Without this the runtime boots a Group whose only child is a component
    // type it has never heard of.
    expect(names).toContain(`/${CARD}`);
    // The whole point of splicing rather than applying: still nothing written.
    expect(JSON.stringify(project.toJSON())).toEqual(before);
  });

  it('never lets a sibling produce a second component under the subject’s own name', () => {
    // A sibling naming the subject is what an `update` operation on the page
    // being previewed looks like; two components with one name in an export is
    // a runtime coin toss.
    const result = buildSandboxExport({
      project: loadProject(),
      files: listFiles(),
      siblings: [listFiles(), cardFiles(), cardFiles()]
    });

    const names = result.json!.components.map((c) => c.name);
    expect(names.filter((n) => n === `/${LIST}`).length).toBe(1);
    expect(names.filter((n) => n === `/${CARD}`).length).toBe(1);
  });

  it('samples data for what a sibling candidate reads, not for what the project has', () => {
    // The closure has to follow the instance into the *candidate*: the project
    // has no /Components/BookCard at all, so a closure built from project
    // components alone stops at the page.
    const project = loadProject();
    const { component } = candidateComponent(listFiles());
    const { component: card } = candidateComponent(cardFiles());

    expect(componentClosure(project, component).map((c) => c.name)).toEqual([`/${LIST}`]);
    expect(componentClosure(project, component, [card]).map((c) => c.name)).toEqual([`/${LIST}`, `/${CARD}`]);
  });

  it('answers "is there anything to render" without building an export', () => {
    // The review document has to choose Preview or Changes before any preview
    // window exists, and the two must never disagree.
    const logicOnly = files({
      nodes: [{ id: 'in', type: 'Component Inputs', ports: [{ name: 'Trigger', plug: 'output', type: '*' }] }]
    });
    expect(candidateIsRenderable(logicOnly)).toBe(false);
    expect(buildSandboxExport({ project: loadProject(), files: logicOnly }).json).toBeUndefined();

    expect(candidateIsRenderable(listFiles())).toBe(true);
    expect(buildSandboxExport({ project: loadProject(), files: listFiles() }).json).toBeDefined();
  });
});

/**
 * BEN-006 — the fourth source, and the only one that is not a guess.
 *
 * Sources 1–3 all infer what the data *probably* looks like. This one is a
 * person saying what they want to see, which is why it outranks them — and why
 * it has to be surgical: a user who edits `Products` has said nothing at all
 * about `Categories`, and blanking the second because they touched the first is
 * how an editing feature becomes one people stop using.
 */
describe('BEN-006 the user’s own sample data', () => {
  function twoClasses() {
    return [candidateComponent(files(twoClassPayload())).component];
  }

  it('overrides the class the user wrote and leaves the others exactly as they were', () => {
    const components = twoClasses();
    const before = buildSandboxDataset({ components });
    const after = buildSandboxDataset({
      components,
      userData: { Products: [{ name: 'Enamel mug' }, { name: 'Cast iron pan' }] }
    });

    expect(after.classes.Products.records.length).toBe(2);
    expect(after.classes.Products.records[0].name).toBe('Enamel mug');
    expect(after.classes.Products.records[1].name).toBe('Cast iron pan');
    // The untouched class is byte-for-byte what inference built.
    expect(JSON.stringify(after.classes.Categories)).toEqual(JSON.stringify(before.classes.Categories));
  });

  it('outranks the agent’s sample_data for the same class', () => {
    const dataset = buildSandboxDataset({
      components: twoClasses(),
      sampleData: { Products: [{ name: 'Northern Atlas' }, { name: 'Quiet Signal' }] },
      userData: { Products: [{ name: 'Enamel mug' }] }
    });

    // Replaced, not merged: one row, and none of the agent's survive. A merge
    // would put rows on screen the user did not write and cannot account for.
    expect(dataset.classes.Products.records.length).toBe(1);
    expect(dataset.classes.Products.records[0].name).toBe('Enamel mug');
  });

  it('leaves the agent’s data alone for a class the user did not touch', () => {
    const dataset = buildSandboxDataset({
      components: twoClasses(),
      sampleData: { Products: [{ name: 'Northern Atlas' }], Categories: [{ label: 'Kitchen' }] },
      userData: { Products: [{ name: 'Enamel mug' }] }
    });

    expect(dataset.classes.Products.records[0].name).toBe('Enamel mug');
    expect(dataset.classes.Categories.records.length).toBe(1);
    expect(dataset.classes.Categories.records[0].label).toBe('Kitchen');
  });

  it('changes nothing at all when the user has written none', () => {
    // The criterion this whole task is allowed to keep: additive, exactly as
    // the code scan was. Byte-identical, both with and without agent data.
    const components = twoClasses();
    const sampleData = { Products: [{ name: 'Northern Atlas' }] };

    expect(JSON.stringify(buildSandboxDataset({ components, userData: undefined }))).toEqual(
      JSON.stringify(buildSandboxDataset({ components }))
    );
    expect(JSON.stringify(buildSandboxDataset({ components, sampleData, userData: undefined }))).toEqual(
      JSON.stringify(buildSandboxDataset({ components, sampleData }))
    );
  });

  it('fills the fields the user left out, and says which ones it filled', () => {
    // Completing is right — a row missing `price` renders half-blank otherwise.
    // Doing it silently is not: the panel has to be able to say which values on
    // screen are the user's and which the editor made up.
    const dataset = buildSandboxDataset({
      components: twoClasses(),
      userData: { Products: [{ name: 'Enamel mug' }] }
    });

    expect(dataset.classes.Products.records[0].name).toBe('Enamel mug');
    expect(dataset.classes.Products.records[0].price === undefined).toBe(false);
    expect(dataset.classes.Products.completed).toEqual(['price']);
  });

  it('does not synthesize over a value the user actually wrote', () => {
    // `completeRecord` is documented as "supplied values win"; this pins it for
    // the user's half, including a deliberately empty string, which is a real
    // answer and not a missing one.
    const dataset = buildSandboxDataset({
      components: twoClasses(),
      userData: { Products: [{ name: '', price: 0 }] }
    });

    expect(dataset.classes.Products.records[0].name).toBe('');
    expect(dataset.classes.Products.records[0].price).toBe(0);
    expect(dataset.classes.Products.completed).toBeUndefined();
  });

  it('serves one row when the user asks for one row', () => {
    // "What does this look like with a single result" is the question that
    // finds every layout that quietly assumed three.
    const dataset = buildSandboxDataset({
      components: twoClasses(),
      userData: { Products: [{ name: 'Enamel mug' }] }
    });

    expect(dataset.classes.Products.records.length).toBe(1);
    expect(dataset.classes.Categories.records.length).toBe(5);
  });

  it('serves no rows when the user deletes them all, which the agent’s empty array does not', () => {
    // An agent shipping `[]` has told us nothing and gets the usual five. A
    // *user* deleting every row has asked for the empty state — the one state
    // no preview in this product has ever been able to show.
    const components = twoClasses();

    expect(buildSandboxDataset({ components, sampleData: { Products: [] } }).classes.Products.records.length).toBe(5);
    expect(buildSandboxDataset({ components, userData: { Products: [] } }).classes.Products.records.length).toBe(0);
  });

  it('lets a class whose shape could not be inferred be filled in by hand', () => {
    // The "Fields unknown" chip turns from a warning into an invitation: this
    // is precisely the case where inference failed and a human knows the answer.
    const components = [candidateComponent(files(shapelessPayload())).component];

    expect(buildSandboxDataset({ components }).unknownShape).toEqual(['Orders']);

    const filled = buildSandboxDataset({
      components,
      userData: { Orders: [{ orderNumber: 'A-1001', customerName: 'Ada Beck' }] }
    });
    expect(filled.unknownShape).toEqual([]);
    expect(filled.classes.Orders.fields.sort()).toEqual(['customerName', 'orderNumber']);
    expect(filled.classes.Orders.records[0].orderNumber).toBe('A-1001');

    // …and filling it in does not turn the user's own keys into a claim about
    // the graph. `fields` is what the dataset serves; `inferred` is what was
    // actually found in the graph, and here that is still nothing. The data
    // editor captions its column list from this one — see the note on
    // `SandboxClass.inferred`.
    expect(filled.classes.Orders.inferred).toEqual([]);
  });

  it('keeps what the graph reads apart from what the records happen to carry', () => {
    // Driven live on `/Pages/Landing` 2026-08-09: the caption read "Read by the
    // graph: createdAt, updatedAt" on a class nothing had been inferred about,
    // because it was sourced from `fields` — which is inference *plus* every
    // key the served records carry.
    const components = twoClasses();

    const inferredOnly = buildSandboxDataset({ components });
    expect(inferredOnly.classes.Products.inferred?.sort()).toEqual(['name', 'price']);
    expect(inferredOnly.classes.Products.inferred).toEqual(inferredOnly.classes.Products.fields);

    const withSupplied = buildSandboxDataset({
      components,
      userData: { Products: [{ name: 'Enamel mug', sku: 'MUG-1' }] }
    });
    // `sku` is served, so it is a field…
    expect(withSupplied.classes.Products.fields).toContain('sku');
    // …but nothing in the graph reads it, so it is not inference.
    expect(withSupplied.classes.Products.inferred?.sort()).toEqual(['name', 'price']);
  });

  it('serves a class the graph never named, because the user asked for it', () => {
    const dataset = buildSandboxDataset({
      components: twoClasses(),
      userData: { Wishlist: [{ title: 'Later' }] }
    });

    expect(dataset.classes.Wishlist.records[0].title).toBe('Later');
  });

  it('says in the toolbar which counts are the user’s', () => {
    // A strip that reads identically whether you are looking at inference or at
    // what you typed is POL-008 again: the preview has to say what state it is
    // actually in.
    const summary = buildSandboxDataset({
      components: twoClasses(),
      userData: { Products: [{ name: 'Enamel mug' }] }
    }).summary!;

    expect(summary).toContain('1 Products (yours)');
    expect(summary).toContain('5 Categories');
    expect(summary.indexOf('Categories (yours)')).toBe(-1);
  });

  it('lets the user stand in for the signed-in user, over the agent’s version', () => {
    const dataset = buildSandboxDataset({
      components: twoClasses(),
      sampleData: { _User: [{ name: 'Agent User' }] },
      userData: { _User: [{ name: 'Richard' }] }
    });

    expect(dataset.user.name).toBe('Richard');
    // Merged onto the sandbox user, not replacing it: the seeded session needs
    // these to exist whatever anyone typed.
    expect(dataset.user.objectId).toBe('sandbox-user');
    expect(String(dataset.user.sessionToken)).toContain('sandbox');
  });

  it('carries the user’s records into the export the preview window is fed', () => {
    const project = loadProject();
    const before = JSON.stringify(project.toJSON());
    const result = buildSandboxExport({
      project,
      files: files(twoClassPayload()),
      userData: { Products: [{ name: 'Enamel mug' }] }
    });

    const shipped = (result.json!.metadata as Record<string, SandboxDataset>).sandbox;
    expect(shipped.classes.Products.records[0].name).toBe('Enamel mug');
    // Handed back too, so the data editor prefills with what is actually being
    // served rather than an empty box.
    expect(result.dataset).toEqual(shipped);
    // R5: preview state, never project state.
    expect(JSON.stringify(project.toJSON())).toEqual(before);
  });

  it('has nothing to edit against a real backend', () => {
    const result = buildSandboxExport({
      project: loadProject(),
      files: files(twoClassPayload()),
      userData: { Products: [{ name: 'Enamel mug' }] },
      useSampleData: false
    });

    expect(result.dataset).toBeUndefined();
    expect((result.json!.metadata as Record<string, unknown>).sandbox).toBeUndefined();
  });
});
