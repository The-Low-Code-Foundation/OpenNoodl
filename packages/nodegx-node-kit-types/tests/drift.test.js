/**
 * CN-005 AC2 — the published types and the runtime must not diverge silently.
 *
 * A `.d.ts` is a claim about code it does not live next to, and claims go stale.
 * These tests are the thing that stops this file becoming a well-formatted lie:
 * delete a field from `ReactNodeDefinition` in the viewer, or add one, and the
 * mirror fails here rather than in an author's editor six months later.
 *
 * Two strengths of check, and the difference is deliberate:
 *
 * - **MIRRORED_EXACTLY** — the published set must equal the runtime's, member for
 *   member, optional flag included. These are the shapes an author writes.
 * - **MIRRORED_PARTIALLY** — the published set must be a *subset*. These are the
 *   `this` types, which carry runtime internals a kit has no business calling;
 *   publishing all of them would be noise. A subset check still catches the
 *   failure that matters — publishing a member the runtime does not have.
 */
const { analyse, SOURCES } = require('./typeSets');

/** Which source each mirrored type is answerable to. */
const MIRRORED_EXACTLY = {
  viewer: [
    'ReactNodeDefinition',
    'ReactInputDefinition',
    'ReactOutputDefinition',
    'ReactInputPropDefinition',
    'ReactInputCssDefinition',
    'ReactOutputPropDefinition',
    'ReactNodeFrame',
    'ReactNodeProps'
  ],
  types: [
    'InputPortDefinition',
    'OutputPortDefinition',
    'NumberedInputDefinition',
    'ConditionalPortGroup',
    'RawDynamicPortEntry',
    'VisualStateDefinition',
    'InspectInfoEntry',
    'NodeSSRCompat',
    'NodePanel',
    'NodeDefinitionOptions'
  ]
};

const MIRRORED_PARTIALLY = {
  viewer: ['ReactNodeInstance'],
  types: ['NodeInstance']
};

const allFrom = (source) => [...(MIRRORED_EXACTLY[source] || []), ...(MIRRORED_PARTIALLY[source] || [])];

let viewer, types, published;

beforeAll(() => {
  viewer = analyse(SOURCES.viewer.file, SOURCES.viewer.baseDir)(allFrom('viewer'));
  types = analyse(SOURCES.types.file, SOURCES.types.baseDir)(allFrom('types'));
  published = analyse(SOURCES.published.file, SOURCES.published.baseDir)([...allFrom('viewer'), ...allFrom('types')]);
});

const runtimeFor = (source) => (source === 'viewer' ? viewer : types);

describe('the compiler could actually resolve both sources', () => {
  // A program whose imports failed to resolve reports interfaces with only their
  // own declared members. That would make several mirrors *look* wrong in
  // confusing ways, or — worse — make a partial check pass for the wrong reason.
  // These two assertions fail first and say why.

  it('resolves the viewer heritage chain into @noodl/types', () => {
    // `ReactInputPropDefinition extends Omit<InputPortDefinition, 'set'>`, so
    // `tooltip` is only present if @noodl/types resolved.
    expect(Object.keys(viewer.ReactInputPropDefinition.members)).toContain('tooltip');
  });

  it('resolves node-definition.d.ts against the node catalog', () => {
    expect(Object.keys(types.NodeDefinitionOptions.members).length).toBeGreaterThan(30);
  });
});

describe('exactly mirrored types', () => {
  for (const source of Object.keys(MIRRORED_EXACTLY)) {
    for (const name of MIRRORED_EXACTLY[source]) {
      it(`${name} publishes exactly what the runtime declares (${source})`, () => {
        const runtime = runtimeFor(source)[name].members;
        const mine = published[name].members;

        // Sorted name lists first: a set difference is what a reader needs to
        // see, and jest prints it far better than a whole-object diff.
        expect(Object.keys(mine).sort()).toEqual(Object.keys(runtime).sort());
      });

      it(`${name} agrees with the runtime about which members are optional (${source})`, () => {
        const runtime = runtimeFor(source)[name].members;
        const mine = published[name].members;
        const disagreements = Object.keys(runtime)
          .filter((key) => key in mine && mine[key] !== runtime[key])
          .map((key) => `${key}: published ${mine[key] ? 'optional' : 'required'}, runtime is not`);

        expect(disagreements).toEqual([]);
      });
    }
  }
});

describe('partially mirrored types', () => {
  for (const source of Object.keys(MIRRORED_PARTIALLY)) {
    for (const name of MIRRORED_PARTIALLY[source]) {
      it(`${name} publishes nothing the runtime does not have (${source})`, () => {
        const runtime = runtimeFor(source)[name].members;
        const mine = published[name].members;
        const invented = Object.keys(mine).filter((key) => !(key in runtime));

        expect(invented).toEqual([]);
      });

      it(`${name} is a real subset, not an accidentally empty one`, () => {
        // A resolution failure would empty this and the subset check above would
        // pass vacuously — the exact shape of "a guard proven by a run where the
        // hazard was absent".
        expect(Object.keys(published[name].members).length).toBeGreaterThan(10);
      });
    }
  }
});

describe('the one deliberate divergence: index signatures', () => {
  /**
   * A string index signature is not a property, so every check above is blind to
   * it — and it is the only thing this package changes on purpose. Left
   * unasserted, it is drift that the drift check cannot see.
   */

  it('the runtime still declares the index signature this package drops', () => {
    // If this ever goes false the divergence has become moot and the long
    // comment in src/index.d.ts should be deleted rather than left misleading.
    expect(viewer.ReactNodeDefinition.hasStringIndex).toBe(true);
  });

  it('the published ReactNodeDefinition drops it, so typos are reported', () => {
    // `fixtures/kit-broken` is the other half of this: it proves the omission
    // actually produces the diagnostic, rather than merely being absent here.
    expect(published.ReactNodeDefinition.hasStringIndex).toBe(false);
  });

  it('every other exactly-mirrored type keeps whatever the runtime has', () => {
    const divergent = [];
    for (const source of Object.keys(MIRRORED_EXACTLY)) {
      for (const name of MIRRORED_EXACTLY[source]) {
        if (name === 'ReactNodeDefinition') continue;
        const runtime = runtimeFor(source)[name].hasStringIndex;
        const mine = published[name].hasStringIndex;
        if (runtime !== mine) divergent.push(`${name}: runtime ${runtime}, published ${mine}`);
      }
    }
    expect(divergent).toEqual([]);
  });
});
