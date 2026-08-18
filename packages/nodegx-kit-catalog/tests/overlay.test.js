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

  it('states that parameter encodings were not derived instead of leaving a gap', () => {
    const { nodes } = catalogNodesFromNodeLibrary(payload);
    for (const node of nodes) {
      // Never absent, never null: a gap must not pass for "nothing to say".
      expect(node.parameterEncoding).not.toBeNull();
      expect(node.parameterEncoding.known).toBe(false);
      expect(node.parameterEncoding.reason).toMatch(/CN-010/);
    }
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
   * 🔴 **This assertion was `toEqual(['cloud'])` and it was REPLACED, not
   * deleted** (CN-002's rule: a silence baseline is replaced when the call is
   * taken). The row's title has always been right — a cloud-only kit must not
   * claim the browser — but `['cloud']` was the wrong way to be right. CN-012
   * measured what a cloud-declared kit actually does: the browser injector
   * skips it and nothing loads it server-side, so it runs in **no** runtime, and
   * `availableIn` is the same field that states plain fact for a built-in.
   * Reporting the manifest's wish there told an agent the node was available on
   * the one runtime where it provably is not.
   */
  it('reports a cloud-only kit as running nowhere, and keeps its declaration', () => {
    const { nodes } = catalogNodesFromNodeLibrary(payload, {
      moduleRuntimes: { 'Cashflow Kit': ['cloud'] }
    });
    expect(nodes[0].availableIn).toEqual([]);
    // The manifest's claim is not lost — it moves to a field that does not read
    // as fact. An empty `availableIn` with no explanation would be a gap that
    // could pass for "nothing to say".
    expect(nodes[0].declaredRuntimes).toEqual(['cloud']);

    // Control: the default is browser, so the assertion above is about the
    // option and not about the default happening to match.
    expect(catalogNodesFromNodeLibrary(payload).nodes[0].availableIn).toEqual(['browser']);
    // ...and the ordinary case carries no `declaredRuntimes` at all, so its
    // presence always means "this kit asked for something it does not get".
    expect(catalogNodesFromNodeLibrary(payload).nodes[0].declaredRuntimes).toBeUndefined();
  });

  it('a kit declaring browser AND cloud is loaded in the browser only', () => {
    const { nodes } = catalogNodesFromNodeLibrary(payload, {
      moduleRuntimes: { 'Cashflow Kit': ['browser', 'cloud'] }
    });
    // The half that works is reported as working; the half that does not is
    // reported as asked-for. A kit like this is not broken — it is over-claimed.
    expect(nodes[0].availableIn).toEqual(['browser']);
    expect(nodes[0].declaredRuntimes).toEqual(['browser', 'cloud']);
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
