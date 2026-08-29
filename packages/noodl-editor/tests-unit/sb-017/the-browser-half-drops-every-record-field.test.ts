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
 * ## 🔴 s16 (P77 SBR-008 §5): "the browser deploy drops" is the wrong subject
 *
 * This file says the 23 warnings are *"wires the browser deploy drops"*, and three later
 * sessions inherited that framing and filed **preview** observations under a deploy-only
 * defect. `exportComponent` has **three** callers, not one: the viewer's component bundles
 * (`editorapi.js:88` → `exportComponentBundle`), incremental preview updates
 * (`ViewerConnection.ts:993`), and the full export and deploy (`json.ts:159`/`:178`,
 * `deployer.ts:108`). **Preview is behind the same filter.** Nothing in this file's
 * measurements changes — it counts ports, and the count stands — but "the deploy" should be
 * read as "any export" everywhere above.
 *
 * 🔴 And the filter does not consult the port set this file measures.
 * `getConnectionHealth` reads `WarningsModel` and returns `healthy: true` when no warning is
 * recorded — which is also the answer before the debounced health pass has run, and no
 * export caller forces it to settle. So "which ports exist" and "which wires a build keeps"
 * are two questions, and only the first is measured here. That is P77 **D13**.
 *
 * ⚠️ The §5.2-style prediction below — that `Page` and `Section` can never resolve because
 * only this panel writes them — **was contradicted in the field**: P77's `SBR-016 Arrive
 * Drive` created a `Page` row carrying `title` and `slug` into a class that had no such
 * columns. The prediction was correctly marked unmeasured; it is now marked *doubted*.
 *
 * 🔴 **s16: this file's central assertion had never run.** `dbmodelcrudbase.ts` carried no
 * `/// <reference>` to `noodl-runtime/src/globals.d.ts`, so required from THIS package's
 * jest program it threw `TS2304` at require time for six of the seven Record nodes — and
 * ts-jest renders that `TSError` with an **empty message**, so the red looked like a flake
 * and said nothing. The `toEqual([])` below was passing on an array the harness never
 * filled. ⚠️ **The known-firing control two tests down could not have caught it**: it was
 * put there for exactly this failure mode, and it passes because `storageFetch` and
 * `in-`/`out-` come from modules that compile. A control must be scoped to the population
 * the rule is ABOUT. Fixed in `dbmodelcrudbase.ts`; all seven nodes now answer, and the
 * answer is the one asserted.
 *
 * ⚠️ This file measures **which ports exist**, not the export. The editor-side
 * assertion — that `exportComponent` really drops these wires — is the cloud
 * half's `tests/cloud/sb017-deploy-connection-parity.test.ts`, and it cannot be
 * repeated for the browser half in this repository: there is no browser node
 * library artefact on disk (`cloud-node-library.json` has no twin, and
 * `tests-unit/cn-003/fixtures/kit-app.editor-nodelibrary.json` records built-in
 * entries by name only). The browser library comes from the viewer at run time.
 */

// 🔴 This file declares `siteBuilder` at top level and has no `import`/`export`,
// which makes it a global SCRIPT to TypeScript rather than a module — and
// ts-jest typechecks all of `tests-unit/` in one program. Five spec files spell
// the same `const siteBuilder`, so whichever pair landed in one worker's program
// failed with TS2451 "Cannot redeclare block-scoped variable" and the whole
// SUITE failed to run: `test:main` reported 2 failed suites with 0 failed tests,
// which reads like a flake and is not one. `export {}` makes this a module and
// scopes the name to the file.
export {};

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
function runtimePortsFor(
  typename: string,
  node: TemplateNode,
  connections: readonly TemplateConnection[] = []
): { name: string }[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeModule = require(MODULES[typename]);
  const announced: { name: string }[] = [];

  // 🔴 Renamed on the way in. The template file spells a wire the EDITOR's way
  // (`fromId`/`fromProperty`); every runtime receives it through
  // `utils/exporter/util.ts` `exportConnection`, which renames all four. A runtime
  // module handed the editor's spelling reads `undefined` off every wire and derives
  // nothing — silently, and looking exactly like "there was nothing to derive". That
  // is SBR-008 §6.6, which cost a session by reading as confirmation.
  const wires = connections.map((c) => ({
    sourceId: c.fromId,
    sourcePort: c.fromProperty,
    targetId: c.toId,
    targetPort: c.toProperty
  }));

  const runtimeNode = {
    id: node.id,
    parameters: node.parameters,
    component: {
      name: '/Pages/spec',
      getConnectionsTo: (id: string) => wires.filter((c) => c.targetId === id),
      getConnectionsFrom: (id: string) => wires.filter((c) => c.sourceId === id),
      on: () => undefined
    },
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
  /** The node that owns the port — what `unresolvedWires` asks the runtime about. */
  nodeId?: string;
  port: string;
  /** The class the dropped write lands in, for the Record family. */
  collection?: string;
}

/**
 * The **population**: every `prop-<field>` wire in the browser components, plus the
 * `For Each.Changed` residue SB-018 (1) fixed away.
 *
 * 🔴 Renamed from `unresolvedWires` by SBR-008, and the rename is the finding. Its
 * docblock said *"a wire is counted when the node that owns the port does not announce
 * it"* — and **it never asked**. Every `prop-` wire was counted unconditionally. That was
 * the right number for as long as the runtime announced no `prop-` port at all, so it read
 * as a measurement for four sessions while being an assumption spelled as one. The moment
 * the runtime started answering, this function would have gone on reporting 19 for ever.
 *
 * What asks is {@link unresolvedWires}, below. This is its denominator.
 */
function recordWires(): Unresolved[] {
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
          nodeId: target.id,
          port: wire.toProperty,
          collection: String(target.parameters.collectionName ?? target.parameters.collectionId ?? '')
        });
      } else if (wire.fromProperty.startsWith('prop-')) {
        found.push({
          component: component.name,
          ownerType: source.type,
          nodeId: source.id,
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

/**
 * The census that asks: a `prop-` wire whose owning node does not announce the port.
 *
 * One `setup()` run per node, with that node's own component wires, exactly as the viewer
 * runs it — and with `getMetaData` answering `undefined` for every key, which is a
 * **stated schema state**: this template has no `dbCollections`, no columns, and cannot
 * have any until something writes one.
 *
 * 🔴 That last sentence is why the number below is safe to pin and the editor's chip is
 * not. SBR-008 §6.5: in one live session, with nothing edited, the editor's own census
 * read 32, then 13, then 4 — it moves with how much of the backend schema has been
 * introspected and whether the window has focused. Here there is no backend, so the only
 * thing that can move this number is the derivation.
 */
function unresolvedWires(): Unresolved[] {
  const announcedByNode = new Map<string, Set<string>>();

  for (const component of browserComponents()) {
    for (const node of component.nodes) {
      if (!MODULES[node.type]) continue;
      announcedByNode.set(
        `${component.name}:${node.id}`,
        new Set(runtimePortsFor(node.type, node, component.connections).map((port) => port.name))
      );
    }
  }

  return recordWires().filter((row) => {
    if (!row.port.startsWith('prop-')) return true;
    return !announcedByNode.get(`${row.component}:${row.nodeId}`)?.has(row.port);
  });
}

describe('SB-017 §10.8: what the browser deploy drops, and what it costs', () => {
  it('accounts for the editor`s 23 warnings, per component, with nothing left over', () => {
    // 🔴 The claim this file exists to make. s17 read these four numbers off the
    // warnings panel of the real editor with the template installed; they are
    // re-derived here from the artefact and the runtime, and they agree exactly.
    // A census that landed near them would be a coincidence — one that lands on
    // all four is the same population.
    const perComponent: Record<string, number> = {};
    for (const row of recordWires()) {
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

    // 🔴 **SBR-007 GREW this population by 8, and growth is not the same as
    // regression.** The rebuilt page editor reads the record in five more places
    // — `headline` takes `prop-title`, `status` takes `prop-published`, `preview`
    // takes `prop-slug`, and the unsaved-changes comparison takes all five loaded
    // fields — so there are 8 more `record.prop-*` wires than s17 counted.
    //
    // ⚠️ Pinned as arithmetic on top of s17's panel reading, in the style this
    // block already used, so the ORIGINAL measurement stays visible and a number
    // that moves for any other reason still reddens. What must NOT move is the
    // census in the AC2 case below: 8 more wires of the same family must still
    // all resolve, or SBR-007 has re-opened SBR-008's defect on a new screen.
    const addedBySbr007: Record<string, number> = { '/Pages/PageEditor': 8 };

    expect(perComponent).toEqual({
      '/Pages/PageEditor':
        s17PanelReading['/Pages/PageEditor'] - fixedBySb018['/Pages/PageEditor'] + addedBySbr007['/Pages/PageEditor'],
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
    const rows = recordWires();

    // 19 → 27: SBR-007's eight, see the per-component case above.
    expect(rows.filter((r) => r.port.startsWith('prop-')).length).toBe(27);

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
    expect(rows.length).toBe(27);
    expect(rows.every((r) => r.port.startsWith('prop-'))).toBe(true);
  });

  it('🔴 the SCHEMA half still announces no `prop-` port — the circularity is not fixed, it is bypassed', () => {
    // The mechanism, from the module that owns it rather than from its source text.
    // `recordFieldPorts` emits one port per column of the selected class, and a site
    // nobody has written to has no columns. SBR-008's fix does not change that and was
    // never going to: it adds a SECOND producer beside it. Kept as a live assertion
    // because if this ever turns green on its own, the number in the next case stops
    // being evidence about the wire-derived half.
    //
    // Isolated by emptying BOTH of the other producer's inputs — the wires here, and the
    // node's own saved `prop-*` parameters, which feed it too.
    let asked = 0;

    for (const component of browserComponents()) {
      for (const node of component.nodes) {
        if (!['DbModel2', 'NewDbModelProperties', 'SetDbModelProperties'].includes(node.type)) continue;
        asked++;
        const bare = { ...node, parameters: { collectionName: node.parameters.collectionName } };
        expect(runtimePortsFor(node.type, bare).filter((port) => port.name.startsWith('prop-'))).toEqual([]);
      }
    }

    // A loop over nothing passes. This template's admin panel holds Record nodes.
    expect(asked).toBeGreaterThan(0);
  });

  it('🟢 SBR-008 AC2 — given the wires, every one of the 19 resolves. Census 19 → 0', () => {
    // The number AC2 asks for, pinned where it is safe to pin: this harness states its
    // schema (`getMetaData` → `undefined`, no columns, no backend), so nothing but the
    // derivation can move it. §6.5 is why that qualifier is load-bearing — the editor's
    // own chip read 32, 13 and 4 in one session with nothing edited.
    // 19 → 27 (SBR-007's eight). 🔴 **The `toBe` is the POPULATION and the
    // `toEqual([])` is the CLAIM** — growing the first without the second staying
    // empty is precisely how a new screen would re-open SBR-008's defect while
    // this file went on reporting a tidy zero.
    expect(recordWires().filter((row) => row.port.startsWith('prop-')).length).toBe(27);
    expect(unresolvedWires()).toEqual([]);
  });

  it('🔴 …and the census can still report a miss — the zero above is not the instrument', () => {
    // 🔴 The negative control, and it is not optional. `unresolvedWires()` returning `[]`
    // has two readings — "every wire resolves" and "the census stopped finding anything"
    // — and they are indistinguishable from the zero alone. SBR-008 §6.6 is that mistake
    // already paid for once at full price: a census filtered on the wrong field names
    // reported 0 `prop-` wires on a graph that had 19, and it read as confirmation.
    //
    // So: ask the same instrument about a port the runtime really does not announce.
    const admin = browserComponents().find((c) => c.name === '/Pages/Admin')!;
    const create = admin.nodes.find((node) => node.type === 'NewDbModelProperties')!;

    const announced = runtimePortsFor(create.type, create, admin.connections).map((port) => port.name);

    // Present, via the wire — the half the fix adds.
    expect(announced).toContain('prop-title');
    // Absent — no wire, no parameter, no column. The instrument can still say no.
    expect(announced).not.toContain('prop-nothingIsWiredToThis');
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

  it('🟢 the loss WAS total per write node — and is now zero on every one of them', () => {
    // The cost §10.8 left open, kept as the shape it had rather than deleted: zero
    // columns meant zero ports, so this was never a few fields going missing — for
    // every write node in the panel, **every** `prop-` wire into it was dropped.
    //
    // Asserted per node rather than as a total, because "19 of 19" and "every node
    // loses all of its wired fields" are different claims, and only the second one says
    // the panel cannot work at all. The same per-node shape now says the opposite, which
    // is a stronger statement than one total reaching zero: a fix that repaired most
    // nodes and missed one would pass a total and fail here.
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

    // The population is still there — the wires were never the problem.
    expect(Object.keys(byOwner).length).toBeGreaterThan(0);
    const wiredTotal = Object.values(byOwner).reduce((total, ports) => total + ports.length, 0);
    // 19 → 27: SBR-007's eight new `record.prop-*` reads on the rebuilt page
    // editor. The line below is the one that matters and it is unchanged at 0.
    expect(wiredTotal).toBe(27);

    // Before the fix this read `toBe(wiredTotal)` — every wired field on every node,
    // lost. Now none of them is.
    expect(dropped.length).toBe(0);

    // And the classes those writes land in, named — so this reads as a product and not
    // as a number. They are the four the fieldless writes used to corrupt; the list is
    // kept because it is what says the fix covers all four and not just `Page`, which is
    // the only one the s17 drive touched.
    //
    // ⚠️ s19 note: `/Admin/PageRow`'s title and slug carry a standing `text`
    // (SB-018 (3)), so a deployed panel listed these fieldless rows as blank rather than
    // as the literal word `Text`. That changed what the failure LOOKED like and nothing
    // about what it was.
    const classesWired = [
      ...new Set(recordWires().filter((r) => r.port.startsWith('prop-')).map((r) => r.collection))
    ].sort();
    expect(classesWired).toEqual(['Page', 'Section', 'SiteSettings', 'Theme']);
    expect([...new Set(dropped.map((r) => r.collection))]).toEqual([]);
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
