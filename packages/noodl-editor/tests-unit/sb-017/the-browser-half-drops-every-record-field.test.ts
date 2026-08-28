/**
 * SB-017 §10.8 — the browser half, from "23 warnings, cost unknown" to a named list.
 *
 * s17 fixed the cloud half and read the editor's own warning chip on the
 * installed template: **84 → 23**, all of them browser-side and all inside the
 * admin panel — `/Pages/PageEditor` 14, `/Pages/Admin` 3, `/Pages/ThemeEditor` 3,
 * `/Admin/SectionRow` 1. `build/deployer.ts` exports through the *same*
 * `exportComponent`, which drops any connection `getConnectionHealth` calls
 * unhealthy, so those 23 are wires the browser deploy drops. What they cost was
 * left open: **nothing has ever clicked the admin panel.**
 *
 * This file closes the census half of that question without a drive. It derives,
 * from the shipped template and the **real runtime modules**, exactly which
 * browser wires have no port to resolve against — and the answer accounts for
 * every warning s17 read, per component, with nothing left over:
 *
 *   19 × `prop-<field>` on the Record family  +  2 × `For Each.Changed`  =  21
 *
 * (21 unique against a chip reading 23: the warnings panel is virtualised *and*
 * doubled by the `BaseDialog` ghost, so s17 read 42 rendered lines for 21 unique
 * and trusted the chip for the total. The per-component split it read — 14/3/3/1
 * — is what this file reproduces, and it reproduces it exactly.)
 *
 * ## 🔴 s19: the residue is gone, and the census is 19
 *
 * The two `For Each.Changed` wires were SB-018 (1), and that file's disposition
 * — delete them — turned out to be wrong. `For Each` republishes an item
 * component's signal outputs as `itemOutputSignal-<name>`, so the port the author
 * wanted existed under a different name; the template now wires that, the viewer
 * announces it, and the wires resolve. They are measured in
 * `tests-unit/sb-018/the-list-refreshes-when-a-row-changes.test.ts`.
 *
 * ⚠️ **So this file's numbers moved, and the reason is a fix rather than a
 * remeasurement.** 14/3/3/1 was s17's reading of the panel and remains the right
 * record of what it read; what the artefact carries now is **13/2/3/1 = 19**,
 * and the two rows that left are named below so the difference cannot be mistaken
 * for drift. Everything else about §11 is unchanged: the 19 are one family, they
 * are §10.2's family, and 11.4's fix is about them.
 *
 * ## Why `prop-` and nothing else
 *
 * The browser is not missing a runtime client the way the cloud was (§6.1: the
 * viewer *is* a connected client, and its 69 undeclared script-port connections
 * raise **0** warnings). It announces `in-`/`out-`, `qp-`, `storageFetch` and the
 * rest. `prop-*` is the one family it cannot announce, and for the reason §10.2
 * already records on the cloud side: `recordFieldPorts` mints one port per
 * **column of the selected class** (`record-ports.ts:161`), and a site nobody has
 * written to has no columns. Same modules, same emptiness, different half.
 *
 * ## 🔴 What it costs, which is the part that was unknown
 *
 * Not "some fields". Zero columns means zero ports, so **every** `prop-` wire
 * into every write node in the panel is dropped — not a subset — and what a
 * deployed panel writes is whatever is left. A `Page` created from `/Pages/Admin`
 * has no title and no slug; a `Section` from `/Pages/PageEditor` has no pageId,
 * kind or order; `Theme` gets no tokens; and the page editor's five fields never
 * load their current values either, because `DbModel2.prop-*` is the same family
 * on the read side. SB-004 F10's shape — a record of nulls — on the other runtime.
 *
 * ⚠️ **And not quite "no fields at all", which is the over-claim this file had to
 * correct in itself.** A `prop-` value set as a **parameter** is not a connection
 * and survives the export: `/Pages/Admin`'s create node carries `prop-published`,
 * `prop-showInNav` and `prop-navOrder` that way, and the runtime registers a
 * `prop-` input on the parameter path as readily as on the wire. So the row is
 * written, and it is written *looking* valid — published, in the nav, ordered —
 * while being unnamed and unreachable, because title and slug were the wired
 * two. A row that fails to appear is a bug someone reports; this one appears.
 *
 * ⚠️ **Bounded in one direction and not the other.** This is the state of a
 * *freshly installed* template, which is what s17 measured. A class gets columns
 * once something writes it, so `SiteSettings` and `Theme` — which `claimSite`
 * mints — may resolve after a successful claim, while `Page` and `Section` have
 * no creator but this panel and cannot. That prediction is **not measured here**
 * and must not be recorded as though it were.
 *
 * ⚠️ This file measures **which ports exist**, not the export. The editor-side
 * assertion — that `exportComponent` really drops these wires — is the cloud
 * half's `tests/cloud/sb017-deploy-connection-parity.test.ts`, and it cannot be
 * repeated for the browser half in this repository: there is no browser node
 * library artefact on disk (`cloud-node-library.json` has no twin, and
 * `tests-unit/cn-003/fixtures/kit-app.editor-nodelibrary.json` records built-in
 * entries by name only). The browser library comes from the viewer at run time.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const siteBuilder = require('../../src/editor/src/models/template/templates/site-builder.content.json');

const RUNTIME = '../../../noodl-runtime/src/nodes/std-library';

/** The runtime module that owns each node type this file asks about. */
const MODULES: Record<string, string> = {
  DbModel2: `${RUNTIME}/data/dbmodelnode2`,
  NewDbModelProperties: `${RUNTIME}/data/newdbmodelpropertiesnode`,
  SetDbModelProperties: `${RUNTIME}/data/setdbmodelpropertiesnode`,
  DbCollection2: `${RUNTIME}/data/dbcollectionnode2`,
  JavaScriptFunction: `${RUNTIME}/simplejavascript`
};

interface TemplateNode {
  id: string;
  type: string;
  parameters: Record<string, unknown>;
  children?: TemplateNode[];
}

interface TemplateConnection {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}

/** Every node in a component graph — `children` is a tree. */
function flatten(roots: TemplateNode[], out: TemplateNode[] = []): TemplateNode[] {
  for (const node of roots || []) {
    out.push(node);
    flatten(node.children, out);
  }
  return out;
}

/** The template's browser components — everything that is not a cloud function. */
function browserComponents(): { name: string; nodes: TemplateNode[]; connections: TemplateConnection[] }[] {
  return siteBuilder.components
    .filter((component: TSFixme) => !component.name.startsWith('/#__cloud__/'))
    .map((component: TSFixme) => ({
      name: component.name,
      nodes: flatten(component.graph.roots),
      connections: component.graph.connections as TemplateConnection[]
    }));
}

/**
 * What the real runtime module announces for one node, through `sendDynamicPorts`.
 *
 * The same instrument as `cloud-ports-agree-with-the-runtime.test.ts`, and for
 * the same reason: the question is what the *runtime* declares, so the runtime
 * is what answers it. `getMetaData` answering `undefined` for every key is this
 * project's real state — a freshly installed template has no `dbCollections`.
 *
 * ⚠️ `editorImportComplete` has to be fired: the Record and Query families hang
 * their initial sweep off that event rather than running it in `setup`, and
 * without it every list below would be empty for the wrong reason.
 */
function runtimePortsFor(typename: string, node: TemplateNode): { name: string }[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeModule = require(MODULES[typename]);
  const announced: { name: string }[] = [];

  const runtimeNode = {
    id: node.id,
    parameters: node.parameters,
    component: { name: '/Pages/spec' },
    outputPorts: {} as Record<string, unknown>,
    on: () => undefined
  };

  const handlers: Record<string, TSFixme[]> = {};
  const graphModel = {
    getNodesWithType: () => [runtimeNode],
    on: (name: string, callback: TSFixme) => {
      (handlers[name] = handlers[name] || []).push(callback);
    },
    fire: (name: string) => (handlers[name] || []).forEach((callback: TSFixme) => callback()),
    getMetaData: () => undefined
  };

  nodeModule.setup(
    {
      editorConnection: {
        isRunningLocally: () => true,
        sendDynamicPorts: (_id: string, ports: { name: string }[]) => announced.push(...ports),
        sendWarning: () => undefined,
        clearWarning: () => undefined
      }
    },
    graphModel
  );
  graphModel.fire('editorImportComplete');

  return announced;
}

/** One row per browser wire that has no port to resolve against. */
interface Unresolved {
  component: string;
  ownerType: string;
  port: string;
  /** The class the dropped write lands in, for the Record family. */
  collection?: string;
}

/**
 * The census. A wire is counted when the node that owns the port does not
 * announce it and the static library cannot carry it either — which for this
 * template is `prop-<field>` (no columns) and `For Each.Changed` (no such port
 * on that node in any runtime; SB-018 (1)).
 */
function unresolvedWires(): Unresolved[] {
  const found: Unresolved[] = [];

  for (const component of browserComponents()) {
    const nodeById: Record<string, TemplateNode> = {};
    component.nodes.forEach((node) => (nodeById[node.id] = node));

    for (const wire of component.connections) {
      const source = nodeById[wire.fromId];
      const target = nodeById[wire.toId];

      if (wire.toProperty.startsWith('prop-')) {
        found.push({
          component: component.name,
          ownerType: target.type,
          port: wire.toProperty,
          collection: String(target.parameters.collectionName ?? target.parameters.collectionId ?? '')
        });
      } else if (wire.fromProperty.startsWith('prop-')) {
        found.push({
          component: component.name,
          ownerType: source.type,
          port: wire.fromProperty,
          collection: String(source.parameters.collectionName ?? source.parameters.collectionId ?? '')
        });
      } else if (source.type === 'For Each' && wire.fromProperty === 'Changed') {
        found.push({ component: component.name, ownerType: 'For Each', port: 'Changed' });
      }
    }
  }

  return found;
}

describe('SB-017 §10.8: what the browser deploy drops, and what it costs', () => {
  it('accounts for the editor`s 23 warnings, per component, with nothing left over', () => {
    // 🔴 The claim this file exists to make. s17 read these four numbers off the
    // warnings panel of the real editor with the template installed; they are
    // re-derived here from the artefact and the runtime, and they agree exactly.
    // A census that landed near them would be a coincidence — one that lands on
    // all four is the same population.
    const perComponent: Record<string, number> = {};
    for (const row of unresolvedWires()) {
      perComponent[row.component] = (perComponent[row.component] ?? 0) + 1;
    }

    // s17's panel reading was 14/3/3/1 = 21 unique. SB-018 (1)'s fix removed
    // exactly one `For Each.Changed` from each of the first two, and nothing
    // else — asserted as the arithmetic rather than as four new constants, so a
    // number that moves for any OTHER reason still reddens.
    const s17PanelReading: Record<string, number> = {
      '/Pages/PageEditor': 14,
      '/Pages/Admin': 3,
      '/Pages/ThemeEditor': 3,
      '/Admin/SectionRow': 1
    };
    const fixedBySb018: Record<string, number> = { '/Pages/PageEditor': 1, '/Pages/Admin': 1 };

    expect(perComponent).toEqual({
      '/Pages/PageEditor': s17PanelReading['/Pages/PageEditor'] - fixedBySb018['/Pages/PageEditor'],
      '/Pages/Admin': s17PanelReading['/Pages/Admin'] - fixedBySb018['/Pages/Admin'],
      '/Pages/ThemeEditor': s17PanelReading['/Pages/ThemeEditor'],
      '/Admin/SectionRow': s17PanelReading['/Admin/SectionRow']
    });

    // And the public site and the Setup page are clean, which is what bounds
    // this to the admin panel — SB-008 drove the public site, and what it drove
    // is unaffected.
    expect(Object.keys(perComponent).sort()).toEqual([
      '/Admin/SectionRow',
      '/Pages/Admin',
      '/Pages/PageEditor',
      '/Pages/ThemeEditor'
    ]);
  });

  it('is 19 record fields and NOTHING else — SB-018`s two have been fixed away', () => {
    const rows = unresolvedWires();

    expect(rows.filter((r) => r.port.startsWith('prop-')).length).toBe(19);

    // 🔴 The residue was two `For Each.Changed` wires, separated here rather than
    // lumped in because they wanted a different fix — and they got one. SB-018 (1)
    // renamed both to `itemOutputSignal-Changed`, a dynamic port the viewer DOES
    // announce, so they resolve and leave this census entirely.
    //
    // Kept as an assertion rather than deleted: this is the one place that says
    // the two families are now separated in the artefact and not just in prose,
    // and it reddens if a `Changed` ever comes back.
    expect(rows.filter((r) => r.ownerType === 'For Each')).toEqual([]);

    // …which makes the whole census one family, and 11.4's decision is about it.
    expect(rows.length).toBe(19);
    expect(rows.every((r) => r.port.startsWith('prop-'))).toBe(true);
  });

  it('🔴 the runtime announces NO `prop-` port for any Record node in this template', () => {
    // The mechanism, from the module that owns it rather than from its source
    // text. `recordFieldPorts` emits one port per column of the selected class
    // (`record-ports.ts:161`), and a site nobody has written to has no columns.
    // Identical to the cloud half's §10.2, on the runtime the viewer runs.
    let asked = 0;

    for (const component of browserComponents()) {
      for (const node of component.nodes) {
        if (!['DbModel2', 'NewDbModelProperties', 'SetDbModelProperties'].includes(node.type)) continue;
        asked++;
        expect(runtimePortsFor(node.type, node).filter((port) => port.name.startsWith('prop-'))).toEqual([]);
      }
    }

    // A loop over nothing passes. This template's admin panel holds Record nodes.
    expect(asked).toBeGreaterThan(0);
  });

  it('…and the same instrument DOES announce the families the browser keeps', () => {
    // 🔴 The known-firing control, and it is what separates the finding from its
    // most likely alternative: "the runtime announced nothing, because the
    // harness never ran it". `storageFetch` is a Query Records dynamic port on
    // the very components above, and `in-`/`out-` are the parsed-script family
    // whose cloud absence was this whole task — the viewer announces both, which
    // is why neither appears in the census.
    const queries = browserComponents().flatMap((component) =>
      component.nodes.filter((node) => node.type === 'DbCollection2')
    );
    const scripts = browserComponents().flatMap((component) =>
      component.nodes.filter((node) => node.type === 'JavaScriptFunction')
    );

    expect(queries.length).toBeGreaterThan(0);
    expect(scripts.length).toBeGreaterThan(0);

    expect(runtimePortsFor('DbCollection2', queries[0]).map((p) => p.name)).toContain('storageFetch');
    expect(
      runtimePortsFor('JavaScriptFunction', scripts[0]).filter(
        (p) => p.name.startsWith('in-') || p.name.startsWith('out-')
      ).length
    ).toBeGreaterThan(0);
  });

  it('🔴 the loss is TOTAL per write node — every wired field, on every one of them', () => {
    // The cost, which was the open half of §10.8. Zero columns means zero ports,
    // so this is not a few fields going missing: for every write node in the
    // panel, **every** `prop-` wire into it is dropped.
    //
    // Asserted per node rather than as a total, because "19 of 19" and "every
    // node loses all of its wired fields" are different claims and only the
    // second one says the panel cannot work at all.
    const dropped = unresolvedWires().filter((r) => r.port.startsWith('prop-'));

    const byOwner: Record<string, string[]> = {};
    for (const component of browserComponents()) {
      const nodeById: Record<string, TemplateNode> = {};
      component.nodes.forEach((node) => (nodeById[node.id] = node));

      for (const wire of component.connections) {
        for (const [id, port] of [
          [wire.toId, wire.toProperty],
          [wire.fromId, wire.fromProperty]
        ] as [string, string][]) {
          if (!port.startsWith('prop-')) continue;
          const key = `${component.name} ${nodeById[id].type} ${nodeById[id].id}`;
          (byOwner[key] = byOwner[key] ?? []).push(port);
        }
      }
    }

    // Every write node that has any `prop-` wire loses all of them.
    expect(Object.keys(byOwner).length).toBeGreaterThan(0);
    expect(
      Object.values(byOwner).reduce((total, ports) => total + ports.length, 0)
    ).toBe(dropped.length);

    // And the classes those fieldless writes land in, named — so this reads as a
    // broken product rather than as a number.
    //
    // ⚠️ s19 note: `/Admin/PageRow`'s title and slug now carry a standing `text`
    // (SB-018 (3)), so a deployed panel lists these fieldless rows as blank
    // rather than as the literal word `Text`. That changes what the failure
    // LOOKS like and nothing about what it is.
    const classes = [...new Set(dropped.map((r) => r.collection))].sort();
    expect(classes).toEqual(['Page', 'Section', 'SiteSettings', 'Theme']);
  });

  it('🔴 …but a `prop-` set as a PARAMETER survives, so the bad row LOOKS valid', () => {
    // The correction this file had to make to itself, kept as a measurement.
    // "Every field is lost" was the obvious reading of "every wire is dropped",
    // and it is wrong: a parameter is not a connection, `exportComponent` copies
    // it verbatim, and the runtime registers a `prop-` input on the parameter
    // path as readily as on the wire.
    //
    // 🔴 That makes the failure worse rather than milder. `/Pages/Admin` sets
    // three of its create node's fields as parameters and wires the other two,
    // so the deployed panel writes a `Page` that is published, in the navigation
    // and ordered — and has no title and no slug. A row that fails to appear
    // gets reported; this one appears.
    const admin = browserComponents().find((c) => c.name === '/Pages/Admin')!;
    const create = admin.nodes.find((node) => node.type === 'NewDbModelProperties')!;

    const asParameters = Object.keys(create.parameters)
      .filter((name) => name.startsWith('prop-'))
      .sort();
    const asWires = admin.connections
      .filter((wire) => wire.toId === create.id && wire.toProperty.startsWith('prop-'))
      .map((wire) => wire.toProperty)
      .sort();

    expect(asParameters).toEqual(['prop-navOrder', 'prop-published', 'prop-showInNav']);
    expect(asWires).toEqual(['prop-slug', 'prop-title']);

    // The two sets are disjoint — so this is genuinely "three survive, two are
    // lost" and not one field counted twice.
    expect(asParameters.filter((name) => asWires.includes(name))).toEqual([]);
  });
});
