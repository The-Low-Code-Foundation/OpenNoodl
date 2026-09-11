/**
 * LAS-001 — the interface gate.
 *
 * Written before the implementation and watched fail against the shipped code,
 * which reported **0 errors** for every case below.
 *
 * The defect, measured: haiku's cold replay of the storefront brief produced the
 * architecturally ideal shape — one `ProductCard`, instantiated four times with
 * per-instance `image`/`name`/`price` parameters — and rendered four identical
 * blocks of literal "Text" placeholder, because `ProductCard` exposes no
 * `Component Inputs`. The parameters landed on ports that do not exist. Nothing
 * in the validator, the write gate or the plan gate looked at an instance's
 * parameters against the target component's actual interface:
 * `checkParameterValues` bails on its first line for a component-ref node
 * (`!catalog.hasType(node.type)`), and `NormNode` carries no parameters at all,
 * so no `rules/` rule could see them either.
 *
 * The three fixtures here are the three ways the interface goes missing, all of
 * them found in real authored output rather than imagined:
 *
 *  1. **no interface node** — the ports were declared on a `Group`
 *     (haiku, `/Components/ProductCard`);
 *  2. **an interface that is one name off** — the component has inputs and the
 *     instance names something else (sonnet, `width`/`minWidth` on
 *     `/Cards/Category Card`, which a component instance does not have);
 *  3. **the direction is backwards** — the ports ARE on a `Component Inputs`
 *     node and carry `plug: "input"`, so `getPorts('output')` skips them and
 *     `componentmodel.getPorts()` publishes them as component *outputs*. This is
 *     the shape `ecommerce-example` — phase 54's reference build — ships in, and
 *     it is invisible today because `nonexistentPort` accepts any name in
 *     `instancePorts` regardless of its plug.
 */
import {
  checkComponentPortDirection,
  checkInstanceInterfaces,
  componentInterfaceIndex,
  DiagnosticCode
} from '../../src/editor/src/validation';
import type { AuthoredNode, ComponentInterfaceView } from '../../src/editor/src/validation';

// ── fixtures ──────────────────────────────────────────────────────────────────

/** haiku's ProductCard: the interface ports declared on the card Group. */
const HAIKU_PRODUCT_CARD: ComponentInterfaceView = {
  name: '/Components/ProductCard',
  nodes: [
    {
      type: 'Group',
      ports: [
        { name: 'image', plug: 'input', type: 'string' },
        { name: 'name', plug: 'input', type: 'string' },
        { name: 'price', plug: 'input', type: 'string' }
      ]
    },
    { type: 'Text' }
  ]
};

/** sonnet's Product Card: a correct interface. */
const CORRECT_PRODUCT_CARD: ComponentInterfaceView = {
  name: '/Cards/Product Card',
  nodes: [
    {
      type: 'Component Inputs',
      ports: [
        { name: 'image', plug: 'output', type: 'string' },
        { name: 'name', plug: 'output', type: 'string' },
        { name: 'price', plug: 'output', type: 'string' }
      ]
    },
    { type: 'Group' }
  ]
};

/** ecommerce-example's ProductCard: right node, backwards plug. */
const BACKWARDS_PRODUCT_CARD: ComponentInterfaceView = {
  name: '/Components/BackwardsCard',
  nodes: [
    {
      type: 'Component Inputs',
      ports: [
        { name: 'image', plug: 'input', type: 'string' },
        { name: 'name', plug: 'input', type: 'string' }
      ]
    }
  ]
};

function instance(id: string, type: string, parameters: Record<string, unknown>): AuthoredNode {
  return { id, type, parameters };
}

const check = (nodes: AuthoredNode[], views: ComponentInterfaceView[]) =>
  checkInstanceInterfaces(nodes, {
    component: '/Sections/FeaturedProducts',
    interfaces: componentInterfaceIndex(views)
  });

// ── 1. the component has no interface at all ──────────────────────────────────

describe('LAS-001 — an instance of a component with no inputs', () => {
  it("rejects haiku's four ProductCards with ONE diagnostic naming the component", () => {
    const diagnostics = check(
      [1, 2, 3, 4].map((n) =>
        instance(`product-${n}`, '/Components/ProductCard', {
          image: `https://example.com/${n}.jpg`,
          name: `Product ${n}`,
          price: `$${n}9`
        })
      ),
      [HAIKU_PRODUCT_CARD]
    );

    // One diagnostic, not twelve: the repair is a single edit to a single
    // component, and twelve identical rejections is a repair round spent reading.
    expect(diagnostics).toHaveLength(1);
    const [d] = diagnostics;
    expect(d.code).toBe(DiagnosticCode.InterfacelessInstance);
    expect(d.severity).toBe('warning');
    expect(d.message).toContain('/Components/ProductCard');
    expect(d.message).toContain('4 instances');
    for (const parameter of ['image', 'name', 'price']) expect(d.message).toContain(parameter);
  });

  it('names the node the ports were actually declared on, because that is the mistake', () => {
    const [d] = check(
      [instance('product-1', '/Components/ProductCard', { image: 'a.jpg', name: 'A' })],
      [HAIKU_PRODUCT_CARD]
    );
    expect(d.suggestion).toContain('Component Inputs');
    // The hint that turns "add an interface" into "move what you already wrote".
    expect(d.message).toContain('Group');
  });

  it('fires for a single instance too — one dead card is still a dead card', () => {
    const diagnostics = check([instance('only', '/Components/ProductCard', { name: 'A' })], [HAIKU_PRODUCT_CARD]);
    expect(diagnostics.map((d) => d.code)).toEqual([DiagnosticCode.InterfacelessInstance]);
  });

  it('says nothing when the instance sets no parameters', () => {
    expect(check([instance('only', '/Components/ProductCard', {})], [HAIKU_PRODUCT_CARD])).toEqual([]);
  });
});

// ── 2. the component has an interface and the parameter misses it ─────────────

describe('LAS-001 — a parameter that names no input', () => {
  it("passes sonnet's correct Product Card untouched", () => {
    expect(
      check([instance('card', '/Cards/Product Card', { image: 'a.jpg', name: 'A', price: '$1' })], [
        CORRECT_PRODUCT_CARD
      ])
    ).toEqual([]);
  });

  it('reports width/minWidth on a component instance — a component instance has no layout ports', () => {
    const diagnostics = check(
      [instance('cb_card', '/Cards/Product Card', { image: 'a.jpg', width: { value: 31, unit: '%' }, minWidth: 260 })],
      [CORRECT_PRODUCT_CARD]
    );
    expect(diagnostics.map((d) => d.location.port).sort()).toEqual(['minWidth', 'width']);
    for (const d of diagnostics) {
      expect(d.code).toBe(DiagnosticCode.InstanceUnknownParameter);
      expect(d.severity).toBe('warning');
      // The "did you mean" shape: the component's ACTUAL input list travels with
      // the rejection, which is what measured a 100% self-correction rate.
      expect(d.alternatives).toEqual(['image', 'name', 'price']);
    }
  });

  it('suggests the near miss', () => {
    const [d] = check([instance('card', '/Cards/Product Card', { imag: 'a.jpg' })], [CORRECT_PRODUCT_CARD]);
    expect(d.suggestion).toContain('image');
  });

  it('accepts a port the instance node itself declares', () => {
    const node: AuthoredNode = {
      id: 'card',
      type: '/Cards/Product Card',
      parameters: { extra: 1 },
      ports: [{ name: 'extra', plug: 'input' }]
    };
    expect(check([node], [CORRECT_PRODUCT_CARD])).toEqual([]);
  });

  it('says nothing about a component reference it cannot resolve', () => {
    // `unresolved-component-ref` owns that, and two diagnostics for one cause is
    // a repair round spent choosing between them.
    expect(check([instance('x', '/Components/Nope', { anything: 1 })], [CORRECT_PRODUCT_CARD])).toEqual([]);
  });

  it('says nothing when no interface index is supplied', () => {
    // Omitted means "do not check" — the convention `urlPaths` and `backend`
    // already follow, because a caller that cannot enumerate the project cannot
    // tell a wrong name from one it does not know about.
    expect(
      checkInstanceInterfaces([instance('card', '/Cards/Product Card', { nope: 1 })], {
        component: '/Sections/X',
        interfaces: componentInterfaceIndex([])
      })
    ).toEqual([]);
  });
});

// ── 3. the interface exists and points the wrong way ──────────────────────────

describe('LAS-001 — the backwards component port', () => {
  it('reports a Component Inputs port declared plug:"input"', () => {
    const diagnostics = checkComponentPortDirection(
      [
        {
          id: 'card_inputs',
          type: 'Component Inputs',
          ports: [
            { name: 'image', plug: 'input' },
            { name: 'name', plug: 'output' }
          ]
        }
      ],
      { component: '/Components/ProductCard' }
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe(DiagnosticCode.ComponentPortDirection);
    expect(diagnostics[0].location.port).toBe('image');
    expect(diagnostics[0].suggestion).toContain('"output"');
  });

  it('reports a Component Outputs port declared plug:"output"', () => {
    const diagnostics = checkComponentPortDirection(
      [{ id: 'out', type: 'Component Outputs', ports: [{ name: 'clicked', plug: 'output' }] }],
      { component: '/Components/ProductCard' }
    );
    expect(diagnostics.map((d) => d.location.port)).toEqual(['clicked']);
    expect(diagnostics[0].suggestion).toContain('"input"');
  });

  it('accepts input/output, which `indexOf` matches both ways', () => {
    expect(
      checkComponentPortDirection(
        [{ id: 'in', type: 'Component Inputs', ports: [{ name: 'x', plug: 'input/output' }] }],
        { component: '/c' }
      )
    ).toEqual([]);
  });

  it('leaves a plugless port to checkInstancePorts', () => {
    // `PortWithoutPlug` is an error and already says exactly this; a second
    // diagnostic on the same port would be two rejections for one edit.
    expect(
      checkComponentPortDirection([{ id: 'in', type: 'Component Inputs', ports: [{ name: 'x' }] }], { component: '/c' })
    ).toEqual([]);
  });

  it('ignores ports on every other node type', () => {
    expect(
      checkComponentPortDirection(
        [{ id: 'fn', type: 'JavaScriptFunction', ports: [{ name: 'out', plug: 'output' }] }],
        { component: '/c' }
      )
    ).toEqual([]);
  });

  it('does not count a backwards port as an input of the component', () => {
    const index = componentInterfaceIndex([BACKWARDS_PRODUCT_CARD]);
    expect(index.get('/Components/BackwardsCard')?.inputs).toEqual([]);
  });

  it('tells an instance of a backwards component what is actually wrong', () => {
    const [d] = check([instance('c', '/Components/BackwardsCard', { image: 'a.jpg' })], [BACKWARDS_PRODUCT_CARD]);
    expect(d.code).toBe(DiagnosticCode.InterfacelessInstance);
    expect(d.message).toContain('plug');
    expect(d.message).toContain('image');
  });
});

// ── the index ─────────────────────────────────────────────────────────────────

describe('LAS-001 — the interface index', () => {
  it('resolves a reference in either name form', () => {
    const index = componentInterfaceIndex([CORRECT_PRODUCT_CARD]);
    expect(index.get('/Cards/Product Card')?.inputs).toEqual(['image', 'name', 'price']);
    expect(index.get('Cards/Product Card')?.inputs).toEqual(['image', 'name', 'price']);
  });

  it('reads a root component through its "#" marker', () => {
    const index = componentInterfaceIndex([{ name: '/#App', nodes: [] }]);
    expect(index.has('/#App')).toBe(true);
    expect(index.has('App')).toBe(true);
  });

  it('derives inputs the way componentmodel.getPorts does, not the way the disk renderer does', () => {
    // `explain/graph.ts::componentPorts` and `scripts/devtools/render-from-disk.js`
    // both take every port on a `Component Inputs` node as an input, ignoring
    // `plug`. The editor and the runtime do not: the exporter writes
    // `comp.getPorts()`, which selects on `plug.indexOf('output')`. Where the two
    // disagree the runtime wins, because it is what renders.
    const index = componentInterfaceIndex([
      {
        name: '/c',
        nodes: [
          {
            type: 'Component Inputs',
            ports: [
              { name: 'good', plug: 'output' },
              { name: 'backwards', plug: 'input' }
            ]
          }
        ]
      }
    ]);
    expect(index.get('/c')?.inputs).toEqual(['good']);
    expect(index.get('/c')?.backwards).toEqual(['backwards']);
  });
});
