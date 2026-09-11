/**
 * CN-003 — the project catalog overlay, pure half.
 *
 * The fixture is a **captured** node-library payload: the five cashflow-kit node
 * types as `generateNodeLibrary` actually exported them after the kit was
 * executed against a live register. It is not hand-written, and that is on
 * purpose — two specs in this phase named controls that had never been run and
 * both were dead (CN-001's cashflow render target, CN-002's single-pipeline
 * assumption).
 *
 * Several tests below carry a **control**: an assertion that the same call fails
 * when the mechanism under test is removed. A test that would pass just as well
 * against a missing mechanism measures nothing.
 */
const {
  KIT_PROVENANCE,
  normalizePortType,
  catalogNodesFromNodeLibrary,
  mergeOverlay,
  compareOverlays,
  describeComparison
} = require('../src/index');

const payload = require('./fixtures/cashflow-kit-nodelibrary.json');

/** Port counts the editor's own `NodeLibrary.instance` reported for this kit. */
const EDITOR_PORT_COUNTS = {
  'nodegx.cashflow.Lane': { inputs: 9, outputs: 11 },
  'nodegx.cashflow.Pill': { inputs: 23, outputs: 14 },
  'nodegx.cashflow.BalanceStrip': { inputs: 16, outputs: 10 },
  'nodegx.cashflow.DayAxis': { inputs: 12, outputs: 8 },
  'nodegx.cashflow.DangerBanner': { inputs: 19, outputs: 9 }
};

describe('catalogNodesFromNodeLibrary', () => {
  it('turns every kit node type in the payload into an overlay entry', () => {
    const { nodes } = catalogNodesFromNodeLibrary(payload);
    expect(nodes.map((n) => n.typeName).sort()).toEqual(Object.keys(EDITOR_PORT_COUNTS).sort());
  });

  it.each(Object.entries(EDITOR_PORT_COUNTS))(
    'gives %s the port counts the editor reports',
    (typeName, expected) => {
      const { nodes } = catalogNodesFromNodeLibrary(payload);
      const node = nodes.find((n) => n.typeName === typeName);
      expect({ inputs: node.inputs.length, outputs: node.outputs.length }).toEqual(expected);
    }
  );

  /**
   * ✅ **D10, 2026-08-18.** `docs` is prose on a kit node and a URL on a shipped
   * one, so a kit that also has a real page got a second field.
   *
   * 🔴 **The reason it is tested HERE and not only at the producer:** three
   * consecutive tasks in this phase found the same defect — the author's field
   * was carried all the way into the overlay and then dropped (`docs` in
   * CN-008, `summary` in CN-009, `dp.note` in CN-010). This mapping is the
   * place that drop happens, so a new field gets a row on the way in.
   */
  it('carries a kit node’s docsUrl, and leaves it absent when there is none', () => {
    const withUrl = {
      nodetypes: [
        {
          name: 'k.WithPage',
          category: 'Visual',
          module: 'K',
          ports: [],
          docs: 'Prose about the node.',
          docsUrl: 'https://example.com/k'
        },
        { name: 'k.NoPage', category: 'Visual', module: 'K', ports: [], docs: 'Prose only.' }
      ]
    };
    const { nodes } = catalogNodesFromNodeLibrary(withUrl);
    const page = nodes.find((n) => n.typeName === 'k.WithPage');
    const noPage = nodes.find((n) => n.typeName === 'k.NoPage');

    expect(page.docsUrl).toBe('https://example.com/k');
    // Both survive independently — the panel renders one as help text and the
    // other as a link, so collapsing them would break whichever it kept.
    expect(page.docs).toBe('Prose about the node.');
    expect('docsUrl' in noPage).toBe(false);
    expect(noPage.docs).toBe('Prose only.');
  });

  it('marks provenance so a consumer can tell a kit node from a shipped one', () => {
    const { nodes } = catalogNodesFromNodeLibrary(payload);
    for (const node of nodes) {
      expect(node.providedBy).toBe(KIT_PROVENANCE);
      expect(node.kitModule).toBe('Cashflow Kit');
    }
  });

  it('classifies kit visual nodes from their category rather than a heuristic', () => {
    // CN-003 acceptance 5: `visualRoots.ts` falls back to `componentIsVisual()`
    // — a heuristic meant for project components — whenever the catalog has no
    // entry. With an entry, `isVisual` is the category, same rule as built-ins.
    const { nodes } = catalogNodesFromNodeLibrary(payload);
    expect(nodes.every((n) => n.isVisual)).toBe(true);
    expect(nodes.every((n) => n.category === 'Visual')).toBe(true);
    expect(nodes.every((n) => n.allowAsChild === true)).toBe(true);
  });

  it('keeps the port metadata a check needs, not just the names', () => {
    const { nodes } = catalogNodesFromNodeLibrary(payload);
    const lane = nodes.find((n) => n.typeName === 'nodegx.cashflow.Lane');
    const cssClass = lane.inputs.find((p) => p.name === 'cssClassName');
    expect(cssClass.type.name).toBe('string');
    expect(cssClass.plug).toBe('input');
    expect(cssClass.group).toBe('Advanced HTML');
    expect(cssClass.isSignal).toBe(false);
  });

  it('identifies signal ports, which is what a connection check reads', () => {
    const { nodes } = catalogNodesFromNodeLibrary(payload);
    const signals = nodes.flatMap((n) => n.outputs.filter((p) => p.isSignal));
    expect(signals.length).toBeGreaterThan(0);
    for (const p of signals) expect(p.type.name).toBe('signal');
  });

  /**
   * ✅ **CN-010, s27.** `node-catalog.d.ts` states the invariant: `parameterEncoding`
   * is non-null for **exactly** the nodes with a `dynamicPorts` block. It holds
   * without exception across the 175 shipped types — all 87 with no `dynamicPorts`
   * read `null`, and none anywhere pairs an absent `dynamicPorts` with `known: false`.
   *
   * 🔴 **What this row used to assert, and why it locked in the defect.** It ran
   * `expect(known).toBe(false)` over every node in `payload` — and all five of them
   * declare no `dynamicports` whatsoever. So the assertion covered exactly the
   * population the claim is wrong for, and there was no node in it that could have
   * distinguished the two cases. The reasoning in its comment ("a gap must not pass
   * for nothing to say") is sound for a node WITH dynamic ports and false for one
   * without: `known: false` says the names could not be determined, and a node whose
   * every port is declared computes no names to determine.
   *
   * Both arms below fire against real data, so neither can pass vacuously.
   */
  it('leaves parameterEncoding null on a static kit node — there are no key formulas to derive', () => {
    const { nodes } = catalogNodesFromNodeLibrary(payload);
    // Control FIRST: the arm is only meaningful because these nodes really do
    // declare no dynamic ports. If that ever changes this row is measuring nothing.
    expect(nodes.length).toBe(5);
    expect(nodes.every((n) => n.dynamicPorts === null)).toBe(true);

    for (const node of nodes) expect(node.parameterEncoding).toBeNull();
  });

  it('still states known:false on a kit node that DOES declare dynamic ports', () => {
    // The other arm, and the one that keeps the module header honest: the formulas
    // come from driving the hook, which a node-library payload cannot express.
    const withDynamic = {
      nodetypes: [
        { name: 'k.Panel', module: 'K', category: 'Visual', ports: [], dynamicports: [{ name: 'g', inputs: ['itemCount'] }] }
      ]
    };
    const node = catalogNodesFromNodeLibrary(withDynamic).nodes[0];
    expect(node.dynamicPorts).not.toBeNull();
    expect(node.parameterEncoding.known).toBe(false);
    expect(node.parameterEncoding.reason).toMatch(/CN-010/);
  });

  it('the invariant itself: parameterEncoding is non-null for exactly the nodes with dynamicPorts', () => {
    const mixed = {
      nodetypes: [
        { name: 'k.Static', module: 'K', category: 'Visual', ports: [] },
        { name: 'k.Dynamic', module: 'K', category: 'Visual', ports: [], dynamicports: [{ name: 'g', inputs: ['a'] }] }
      ]
    };
    const { nodes } = catalogNodesFromNodeLibrary(mixed);
    // Both states present in one run, so the pairing is asserted rather than assumed.
    // Sorted because the overlay orders its output; this row is about the pairing.
    const pairing = nodes
      .map((n) => [n.typeName, n.dynamicPorts !== null, n.parameterEncoding !== null])
      .sort((a, b) => a[0].localeCompare(b[0]));
    expect(pairing).toEqual([
      ['k.Dynamic', true, true],
      ['k.Static', false, false]
    ]);
  });

  it('ignores built-in entries — they are already in the shipped catalog', () => {
    const withBuiltin = {
      nodetypes: [...payload.nodetypes, { name: 'Text', category: 'Visual', ports: [] }]
    };
    const { nodes } = catalogNodesFromNodeLibrary(withBuiltin);
    expect(nodes.map((n) => n.typeName)).not.toContain('Text');
    // Control: the entry is excluded because it has no `module`, not because
    // the name is special-cased. Give it one and it is picked up.
    const asKit = { nodetypes: [{ name: 'Text', category: 'Visual', module: 'Rogue Kit', ports: [] }] };
    expect(catalogNodesFromNodeLibrary(asKit).nodes.map((n) => n.typeName)).toEqual(['Text']);
  });

  it('reports a kit shadowing a shipped type instead of overriding it', () => {
    const shadowing = {
      nodetypes: [{ name: 'Text', category: 'Visual', module: 'Rogue Kit', ports: [] }]
    };
    const { nodes, collisions } = catalogNodesFromNodeLibrary(shadowing, { builtinTypeNames: ['Text', 'Group'] });
    expect(nodes).toHaveLength(0);
    expect(collisions).toEqual([{ typeName: 'Text', kitModule: 'Rogue Kit' }]);

    // Control: without the built-in list there is nothing to collide with, so
    // the same input merges. A passing collision test with the option always
    // supplied could not tell "reported" from "never reached".
    expect(catalogNodesFromNodeLibrary(shadowing).nodes).toHaveLength(1);
  });

  /**
   * 🔴 **This row has now been REPLACED TWICE, never deleted** (CN-002's rule),
   * and the two replacements are worth reading together because they point in
   * opposite directions.
   *
   * 1. It began as `toEqual(['cloud'])` — the manifest's wish restated as fact.
   *    CN-012 measured what a cloud-declared kit actually did: the browser
   *    injector skipped it and nothing loaded it server-side, so it ran in **no**
   *    runtime. The assertion became `[]`, and the title with it.
   * 2. ✅ **CN-013 / D18 built the cloud loader**, so `['cloud']` is now a
   *    statement of fact again — for a different reason than the original one.
   *    `noodl-viewer-cloud/src/kitModules.ts` registers a cloud-enabled kit's
   *    logic nodes, and the same cloud function that timed out with a kit node
   *    now answers `200` with its arithmetic, measured through the esbuild
   *    bundle over real HTTP.
   *
   * ⚠️ **The title changed with the fact, and that is the point.** A row whose
   * name outlives its assertion is how a suite comes to assert the opposite of
   * what it says — the failure class this phase keeps finding. `ssr` is the row
   * that still reads `[]`, and it stays empty even though CN-013 later built an
   * SSR kit loader: that loader runs the scripts the injector put in the page,
   * i.e. the **browser** set, so `browser` is what reaches a server render and
   * `ssr` names no loader at all
   * (`noodl-viewer-react/tests/ssr-kit-modules.test.js`).
   */
  it('reports a cloud-only kit as running in the cloud, now that a loader exists', () => {
    const { nodes } = catalogNodesFromNodeLibrary(payload, {
      moduleRuntimes: { 'Cashflow Kit': ['cloud'] }
    });
    expect(nodes[0].availableIn).toEqual(['cloud']);
    // Asked-for and got: nothing to explain, so no `declaredRuntimes`. Its
    // presence has always meant "this kit asked for something it does not get".
    expect(nodes[0].declaredRuntimes).toBeUndefined();

    // Control: the default is browser, so the assertion above is about the
    // option and not about the default happening to match.
    expect(catalogNodesFromNodeLibrary(payload).nodes[0].availableIn).toEqual(['browser']);
    expect(catalogNodesFromNodeLibrary(payload).nodes[0].declaredRuntimes).toBeUndefined();
  });

  it('a kit declaring browser AND cloud is now loaded in both', () => {
    const { nodes } = catalogNodesFromNodeLibrary(payload, {
      moduleRuntimes: { 'Cashflow Kit': ['browser', 'cloud'] }
    });
    // No longer over-claimed: both halves have a loader, so both are fact.
    expect(nodes[0].availableIn).toEqual(['browser', 'cloud']);
    expect(nodes[0].declaredRuntimes).toBeUndefined();
  });

  /**
   * 🔴 The row that keeps `availableIn` a statement of fact rather than a copy.
   *
   * Without it, the two rows above would be equally satisfied by a function that
   * simply echoed the manifest — which is precisely what this field used to do
   * and what CN-012 corrected. `ssr` is a value `runtimes` accepts and **no
   * loader in this repo honours**, measured this session, so it is the live
   * counter-example that separates "reports what loads it" from "repeats what it
   * asked for".
   */
  it('🔴 a kit declaring a runtime with no loader still runs nowhere', () => {
    const { nodes } = catalogNodesFromNodeLibrary(payload, {
      moduleRuntimes: { 'Cashflow Kit': ['ssr'] }
    });
    expect(nodes[0].availableIn).toEqual([]);
    // The claim is not lost — it moves to the field that does not read as fact.
    expect(nodes[0].declaredRuntimes).toEqual(['ssr']);
  });

  it('keeps the loaders it knows and drops the ones it does not, in the same manifest', () => {
    const { nodes } = catalogNodesFromNodeLibrary(payload, {
      moduleRuntimes: { 'Cashflow Kit': ['cloud', 'ssr'] }
    });
    expect(nodes[0].availableIn).toEqual(['cloud']);
    expect(nodes[0].declaredRuntimes).toEqual(['cloud', 'ssr']);
  });
});

describe('normalizePortType', () => {
  it('accepts both shapes the payload actually contains', () => {
    expect(normalizePortType('string')).toEqual({ name: 'string' });
    expect(normalizePortType({ name: 'string', allowEditOnly: true })).toEqual({
      name: 'string',
      allowEditOnly: true
    });
  });

  it('falls back to the wildcard rather than producing a nameless type', () => {
    expect(normalizePortType(undefined).name).toBe('*');
    expect(normalizePortType({ enums: ['a'] }).name).toBe('*');
  });
});

describe('mergeOverlay', () => {
  const baseCatalog = () => ({
    catalogFormatVersion: '1.1.0',
    portTypeNames: ['string'],
    nodes: [{ typeName: 'Text', providedBy: 'noodl-viewer-react' }]
  });

  it('adds the kit types and keeps the catalog sorted', () => {
    const { nodes } = catalogNodesFromNodeLibrary(payload);
    const merged = mergeOverlay(baseCatalog(), nodes);
    const names = merged.nodes.map((n) => n.typeName);
    expect(names).toContain('nodegx.cashflow.Pill');
    expect(names).toContain('Text');
    expect([...names].sort()).toEqual(names);
  });

  it('widens portTypeNames with the kit’s own port types', () => {
    const { nodes } = catalogNodesFromNodeLibrary(payload);
    const merged = mergeOverlay(baseCatalog(), nodes);
    expect(merged.portTypeNames).toContain('signal');
    expect(merged.portTypeNames).toContain('color');
  });

  it('never mutates the catalog it was given', () => {
    // This is the cross-project leak in CN-003 acceptance 1: `defaultCatalog()`
    // hands out a singleton, so a mutating merge would make one project's kit
    // visible to the next.
    const original = baseCatalog();
    const before = JSON.stringify(original);
    const { nodes } = catalogNodesFromNodeLibrary(payload);
    mergeOverlay(original, nodes);
    expect(JSON.stringify(original)).toBe(before);
  });

  it('returns the catalog untouched when the project has no kits', () => {
    const original = baseCatalog();
    expect(mergeOverlay(original, [])).toBe(original);
  });
});

describe('compareOverlays', () => {
  const overlay = () => catalogNodesFromNodeLibrary(payload).nodes;

  it('agrees with itself', () => {
    const c = compareOverlays(overlay(), overlay());
    expect(c.agree).toBe(true);
    expect(c.divergences).toEqual([]);
  });

  it('names a type one route has and the other does not', () => {
    const b = overlay().filter((n) => n.typeName !== 'nodegx.cashflow.DayAxis');
    const c = compareOverlays(overlay(), b, { labelA: 'editor', labelB: 'mcp' });
    expect(c.agree).toBe(false);
    expect(c.divergences).toEqual([
      {
        typeName: 'nodegx.cashflow.DayAxis',
        kind: 'type-missing',
        detail: 'declared in editor, absent from mcp'
      }
    ]);
    // The failure must NAME the divergence, not just fail (D3's wording).
    expect(describeComparison(c)).toContain('nodegx.cashflow.DayAxis');
    expect(describeComparison(c)).toContain('absent from mcp');
  });

  it('names a port one route has and the other does not', () => {
    const b = overlay();
    const lane = b.find((n) => n.typeName === 'nodegx.cashflow.Lane');
    const dropped = lane.inputs[0].name;
    lane.inputs = lane.inputs.slice(1);
    const c = compareOverlays(overlay(), b);
    expect(c.agree).toBe(false);
    expect(c.divergences).toHaveLength(1);
    expect(c.divergences[0]).toMatchObject({
      typeName: 'nodegx.cashflow.Lane',
      kind: 'port-missing',
      plug: 'input',
      port: dropped
    });
    expect(describeComparison(c)).toContain(`nodegx.cashflow.Lane.input:${dropped}`);
  });

  it('names a port whose type differs, which is the silent one', () => {
    const b = overlay();
    const lane = b.find((n) => n.typeName === 'nodegx.cashflow.Lane');
    lane.inputs[0] = { ...lane.inputs[0], type: { name: 'number' } };
    const c = compareOverlays(overlay(), b, { labelA: 'editor', labelB: 'mcp' });
    expect(c.agree).toBe(false);
    expect(c.divergences[0].kind).toBe('port-type-differs');
    expect(c.divergences[0].detail).toBe('editor says "string", mcp says "number"');
  });

  it('names a field that differs', () => {
    const b = overlay();
    b[0] = { ...b[0], displayName: 'Renamed' };
    const c = compareOverlays(overlay(), b);
    expect(c.divergences[0]).toMatchObject({ kind: 'field-differs', field: 'displayName' });
  });

  it('reports agreement in words a reader can act on', () => {
    expect(describeComparison(compareOverlays(overlay(), overlay(), { labelA: 'editor', labelB: 'mcp' }))).toBe(
      'editor and mcp agree on every kit node type and port.'
    );
  });
});
