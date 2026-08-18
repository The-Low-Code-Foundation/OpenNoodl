/**
 * CN-015 — failures name the kit.
 *
 * The central obligation of these tests is AC5: **nothing fires for a healthy
 * kit**. A check that only ever passes on good input has not been shown to work,
 * and one that fires on good input is worse than nothing — so every failure case
 * below is paired with the healthy overlay, and the healthy overlay is asserted
 * to produce exactly zero diagnostics.
 */
const { kitDiagnostics, formatKitDiagnostic } = require('../src/health');

/** A kit that loaded and registered two nodes. The known-good input. */
function healthyOverlay() {
  return {
    kits: [{ kitModule: 'Cashflow Kit', dirPath: 'noodl_modules/cashflow' }],
    nodes: [
      { typeName: 'cashflow.Lane', kitModule: 'Cashflow Kit' },
      { typeName: 'cashflow.Pill', kitModule: 'Cashflow Kit' }
    ],
    collisions: [],
    failures: []
  };
}

describe('AC5 — nothing fires for a healthy kit', () => {
  test('a kit that loaded and registered nodes produces no diagnostics at all', () => {
    expect(kitDiagnostics(healthyOverlay())).toEqual([]);
  });

  test('two healthy kits in one project still produce nothing', () => {
    const overlay = healthyOverlay();
    overlay.kits.push({ kitModule: 'Harbour Metrics', dirPath: 'noodl_modules/harbour' });
    overlay.nodes.push({ typeName: 'harbour.Tile', kitModule: 'Harbour Metrics' });
    expect(kitDiagnostics(overlay)).toEqual([]);
  });

  test('an empty project produces nothing rather than a complaint about nothing', () => {
    expect(kitDiagnostics({})).toEqual([]);
    expect(kitDiagnostics({ kits: [], nodes: [], collisions: [], failures: [] })).toEqual([]);
  });
});

describe('AC1 — a kit that throws names itself', () => {
  test('a load failure is an error carrying the loader\'s own message', () => {
    const overlay = healthyOverlay();
    overlay.failures = [
      { kitModule: 'Broken Kit', dirPath: 'noodl_modules/broken', message: 'Unexpected token )' }
    ];
    overlay.kits.push({ kitModule: 'Broken Kit', dirPath: 'noodl_modules/broken' });

    const found = kitDiagnostics(overlay).filter((d) => d.code === 'kit-load-failed');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    expect(found[0].kitModule).toBe('Broken Kit');
    // The author's actual syntax error must survive into the message; a summary
    // ("failed to load") would send them back to devtools, which is the exact
    // thing AC1 exists to remove.
    expect(found[0].message).toContain('Unexpected token )');
    expect(found[0].message).toContain('Broken Kit');
  });

  test('the healthy kit alongside a broken one is still not accused', () => {
    const overlay = healthyOverlay();
    overlay.failures = [{ kitModule: 'Broken Kit', dirPath: 'x', message: 'boom' }];
    overlay.kits.push({ kitModule: 'Broken Kit', dirPath: 'x' });

    const kitsNamed = new Set(kitDiagnostics(overlay).map((d) => d.kitModule));
    expect(kitsNamed.has('Cashflow Kit')).toBe(false);
  });

  test('a kit that got NOTHING registered says so', () => {
    const overlay = { kits: [{ kitModule: 'Broken Kit' }], nodes: [], collisions: [], failures: [{ kitModule: 'Broken Kit', message: 'Unexpected token }' }] };
    const [diagnostic] = kitDiagnostics(overlay);
    expect(diagnostic.partial).toBe(false);
    expect(diagnostic.message).toContain('None of its nodes are available');
  });

  /**
   * 🔴 The half-registered case, and it was observed live rather than imagined.
   *
   * A fixture kit whose first `reactNode` was `Text` and whose second had no
   * `name` produced BOTH a `kit-load-failed` AND a `Text` collision from the
   * real extractor — which is only possible if `Text` had already registered
   * before `defineNode` threw. `registerModule` loops the node list, so a bad
   * definition silently truncates the kit at that point.
   *
   * Claiming "none of its nodes are available" there would be the same kind of
   * false statement this task exists to remove.
   */
  test('a kit that registered SOME nodes before throwing is called partial, not empty', () => {
    const overlay = {
      kits: [{ kitModule: 'Rogue Kit' }],
      nodes: [{ typeName: 'rogue.Fine', kitModule: 'Rogue Kit' }],
      collisions: [],
      failures: [{ kitModule: 'Rogue Kit', message: 'registration failed: Node must have a name' }]
    };
    const [diagnostic] = kitDiagnostics(overlay);
    expect(diagnostic.partial).toBe(true);
    expect(diagnostic.message).toContain('PARTIALLY registered');
    expect(diagnostic.message).not.toContain('None of its nodes are available');
  });

  test('a node that only COLLIDED still proves the kit registered something', () => {
    // The collided node is absent from `nodes` because the catalog dropped it,
    // but it did register — so this kit is partial, not empty.
    const overlay = {
      kits: [{ kitModule: 'Rogue Kit' }],
      nodes: [],
      collisions: [{ typeName: 'Text', kitModule: 'Rogue Kit' }],
      failures: [{ kitModule: 'Rogue Kit', message: 'registration failed: Node must have a name' }]
    };
    expect(kitDiagnostics(overlay).find((d) => d.code === 'kit-load-failed').partial).toBe(true);
  });

  test('a failed kit is NOT also reported as registering nothing', () => {
    // It registered nothing, but the load error is the true cause and the better
    // message. Reporting both would have the author chase two bugs.
    const overlay = { kits: [{ kitModule: 'Broken Kit' }], nodes: [], collisions: [], failures: [{ kitModule: 'Broken Kit', message: 'boom' }] };
    const codes = kitDiagnostics(overlay).map((d) => d.code);
    expect(codes).toEqual(['kit-load-failed']);
  });
});

/**
 * ⚠️ **AC2 has no tests here, deliberately, and the reason is the finding.**
 *
 * The spec expects a "malformed definition" diagnostic. A probe calling
 * `NodeRegister.register` directly did register a nameless definition under the
 * literal type name `'undefined'` — but that probe **skipped a layer**. A kit
 * goes through `registerModule` → `registerNode` → `NodeDefinition.defineNode`,
 * which throws `'Node must have a name'` (`nodedefinition.ts:252-254`). The
 * extractor catches it, so a nameless node in a real kit already surfaces as
 * `kit-load-failed` — verified end to end against a fixture kit built to
 * contain one. A separate check could never fire, and this task's trap list
 * forbids shipping a guard nobody has seen fail.
 */

describe('AC3 — a collision is reported, and the resolution is stated truthfully', () => {
  test('shadowing a built-in is an error naming both the kit and the type', () => {
    const overlay = healthyOverlay();
    overlay.collisions = [{ typeName: 'Text', kitModule: 'Rogue Kit' }];
    overlay.kits.push({ kitModule: 'Rogue Kit' });

    const found = kitDiagnostics(overlay).filter((d) => d.code === 'kit-shadows-builtin');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    expect(found[0].kitModule).toBe('Rogue Kit');
    expect(found[0].typeName).toBe('Text');
  });

  /**
   * 🔴 The regression guard that matters most in this file.
   *
   * The message that shipped before CN-015 said *"The built-in wins; the kit's
   * node is not available."* That is false at runtime — `NodeRegister.register`
   * is an unguarded assignment and module nodes register after built-ins, so
   * `createNode` returns the KIT's constructor. Measured, not inferred.
   *
   * An author who believed the old sentence would debug the built-in while the
   * kit's code ran. This asserts the wording cannot drift back.
   */
  test('the message does NOT claim the built-in wins, because at runtime it does not', () => {
    const overlay = { kits: [{ kitModule: 'Rogue Kit' }], nodes: [], collisions: [{ typeName: 'Text', kitModule: 'Rogue Kit' }], failures: [] };
    const message = kitDiagnostics(overlay)[0].message;

    expect(message).not.toMatch(/built-in wins/i);
    expect(message).not.toMatch(/not available/i);
    // and it must state the divergence that is actually true
    expect(message).toMatch(/runtime/i);
    expect(message).toMatch(/disagree|replaces/i);
  });

  test('a kit whose ONLY node collided is not ALSO reported as registering nothing', () => {
    // `catalogNodesFromNodeLibrary` drops collided entries from `nodes`, so
    // counting `nodes` alone would report this kit twice — once with the real
    // cause and once with a wrong one.
    const overlay = { kits: [{ kitModule: 'Rogue Kit' }], nodes: [], collisions: [{ typeName: 'Text', kitModule: 'Rogue Kit' }], failures: [] };
    expect(kitDiagnostics(overlay).map((d) => d.code)).toEqual(['kit-shadows-builtin']);
  });
});

describe('AC4 — a kit that registers zero nodes', () => {
  /**
   * The shape of the one confirmed real case. LBR-006 asserts "three modules
   * register zero nodes" and names none; a census of all 29 shipped modules
   * (dom-shim + a `Noodl` collector, requiring each `main`) confirmed
   * `form-validation/noodl-validation-module` loading cleanly and registering
   * nothing. See `notes/cn-015-premise-census.md`.
   */
  test('a kit that loaded but registered nothing is a WARNING, not an error', () => {
    const overlay = {
      kits: [{ kitModule: 'noodl-validation-module', dirPath: 'noodl_modules/noodl-validation-module' }],
      nodes: [],
      collisions: [],
      failures: []
    };
    const found = kitDiagnostics(overlay);
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe('kit-registered-nothing');
    // A warning rather than an error: it might legitimately be a side-effect
    // module. The task's severity philosophy, not a new one.
    expect(found[0].severity).toBe('warning');
    expect(found[0].message).toContain('noodl-validation-module');
  });

  test('only the empty kit is named when a healthy one sits beside it', () => {
    const overlay = healthyOverlay();
    overlay.kits.push({ kitModule: 'Empty Kit' });
    const found = kitDiagnostics(overlay);
    expect(found).toHaveLength(1);
    expect(found[0].kitModule).toBe('Empty Kit');
  });

  /**
   * ⚠️ The editor cannot make this call. It reads a payload a running viewer
   * sent (✅ D3), where a kit with no nodes is "installed, not yet loaded" —
   * CN-006b's `joinKitNodes` keeps those two states apart deliberately, and a
   * zero-node accusation there would be a false one on a working kit.
   */
  test('assumeLoaded:false skips the zero-node check rather than guessing', () => {
    const overlay = { kits: [{ kitModule: 'Not Yet Loaded' }], nodes: [], collisions: [], failures: [] };
    expect(kitDiagnostics(overlay, { assumeLoaded: false })).toEqual([]);
    // ...and the control: the same overlay DOES report when the caller did load.
    expect(kitDiagnostics(overlay, { assumeLoaded: true })).toHaveLength(1);
  });

  test('assumeLoaded:false still reports the failures it CAN tell', () => {
    const overlay = {
      kits: [{ kitModule: 'Rogue Kit' }],
      nodes: [],
      collisions: [{ typeName: 'Text', kitModule: 'Rogue Kit' }],
      failures: [{ kitModule: 'Broken Kit', message: 'boom' }]
    };
    const codes = kitDiagnostics(overlay, { assumeLoaded: false }).map((d) => d.code).sort();
    expect(codes).toEqual(['kit-load-failed', 'kit-shadows-builtin']);
  });
});

/**
 * CN-012 — the kit that runs in no runtime.
 *
 * The three older checks all ask "what did the register end up with". This one
 * asks a question about the **manifest**, and it is the only case in the family
 * where the kit's own code is perfect. It is here rather than in a manifest
 * validator because the consequence is a node-availability fact, and this is
 * where the other node-availability facts are already worded.
 */
describe('CN-012 — kit-loads-nowhere', () => {
  /** An overlay as `catalogNodesFromNodeLibrary` really builds it for a cloud-only kit. */
  function cloudOnlyOverlay() {
    return {
      kits: [
        { kitModule: 'Tally Kit', dirPath: 'noodl_modules/tally-kit', availableIn: [], declaredRuntimes: ['cloud'] }
      ],
      // 🔴 Empty, and that is the case being graded rather than a shortcut: a kit
      // no runtime loads registers nothing, so there are no node entries to hang
      // the fact on. A check keyed on nodes would be blind exactly here.
      nodes: [],
      collisions: [],
      failures: []
    };
  }

  test('names the kit, its declaration, and what will happen', () => {
    // Selected by code rather than by index: on a loaded route this kit is also
    // a `kit-registered-nothing`, and that pairing is asserted separately below.
    const found = kitDiagnostics(cloudOnlyOverlay()).filter((d) => d.code === 'kit-loads-nowhere');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    expect(found[0].kitModule).toBe('Tally Kit');
    expect(found[0].dirPath).toBe('noodl_modules/tally-kit');
    expect(found[0].declaredRuntimes).toEqual(['cloud']);
    expect(found[0].message).toContain('"browser"');
  });

  /**
   * One manifest is one decision, whatever else is on the overlay. Nodes are
   * pushed here to prove the count comes from the kit list and cannot be
   * multiplied by them.
   */
  test('a kit is named once however many nodes are on the overlay', () => {
    const overlay = cloudOnlyOverlay();
    for (let i = 0; i < 8; i++) {
      overlay.nodes.push({ typeName: `tally.kit.N${i}`, kitModule: 'Tally Kit' });
    }
    expect(kitDiagnostics(overlay).filter((d) => d.code === 'kit-loads-nowhere')).toHaveLength(1);
  });

  /**
   * 🔴 The regression this shape was chosen to avoid. An earlier cut fed the
   * fact in as a synthetic *node* row so a zero-node kit could carry it — which
   * made `registeredSomething` believe the kit had registered a node, silently
   * disabling `kit-registered-nothing` for it. Both must be able to fire.
   */
  test('still reports registering nothing, on a loaded route', () => {
    const codes = kitDiagnostics(cloudOnlyOverlay(), { assumeLoaded: true }).map((d) => d.code).sort();
    expect(codes).toEqual(['kit-loads-nowhere', 'kit-registered-nothing']);
  });

  /**
   * 🔴 The control that makes the row above mean something. A healthy kit's
   * nodes carry `availableIn: ['browser']`, and the whole family's AC5 is that
   * a healthy project is silent — a check keyed on the wrong emptiness would
   * light up every project in the repo.
   */
  test('a browser kit beside it stays silent, and only the cloud one is named', () => {
    const overlay = cloudOnlyOverlay();
    overlay.kits.push({
      kitModule: 'Cashflow Kit',
      dirPath: 'noodl_modules/cashflow',
      availableIn: ['browser'],
      declaredRuntimes: ['browser']
    });
    overlay.nodes.push({ typeName: 'cashflow.Lane', kitModule: 'Cashflow Kit' });
    const found = kitDiagnostics(overlay).filter((d) => d.code === 'kit-loads-nowhere');
    expect(found).toHaveLength(1);
    expect(found[0].kitModule).toBe('Tally Kit');
  });

  /**
   * ⚠️ A caller that never built `availableIn` (any overlay assembled by hand,
   * including every older row in this file) must not be accused. Absent is not
   * empty: one means "nobody said", the other means "measured, and it is none".
   */
  test('a kit with no availableIn at all is not accused', () => {
    const overlay = cloudOnlyOverlay();
    delete overlay.kits[0].availableIn;
    delete overlay.kits[0].declaredRuntimes;
    overlay.nodes = [{ typeName: 'tally.kit.Accumulator', kitModule: 'Tally Kit' }];
    expect(kitDiagnostics(overlay)).toEqual([]);
  });

  /**
   * ⚠️ A kit that threw already has a louder, more actionable error. Two errors
   * for one kit is an invitation to fix the wrong one — and the manifest is not
   * why the nodes are missing when the module never ran.
   */
  test('a kit that also FAILED to load is reported once, as the failure', () => {
    const overlay = cloudOnlyOverlay();
    overlay.failures = [{ kitModule: 'Tally Kit', dirPath: 'noodl_modules/tally-kit', message: 'boom' }];
    const codes = kitDiagnostics(overlay).map((d) => d.code);
    expect(codes).toEqual(['kit-load-failed']);
  });

  /**
   * Unlike the zero-node check, this one is readable from the manifest and is
   * just as true before anything has loaded — so the editor gets it too.
   */
  test('assumeLoaded:false still reports it', () => {
    const found = kitDiagnostics(cloudOnlyOverlay(), { assumeLoaded: false });
    expect(found.map((d) => d.code)).toEqual(['kit-loads-nowhere']);
  });
});

describe('formatKitDiagnostic', () => {
  test('prefixes the severity so a CLI line is greppable', () => {
    const [diagnostic] = kitDiagnostics({ kits: [{ kitModule: 'K' }], nodes: [], collisions: [], failures: [] });
    expect(formatKitDiagnostic(diagnostic)).toBe(`WARNING ${diagnostic.message}`);
  });
});
