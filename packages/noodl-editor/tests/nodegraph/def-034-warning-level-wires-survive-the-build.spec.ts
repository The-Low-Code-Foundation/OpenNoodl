import { NodeLibrary } from '@noodl-models/nodelibrary';
import { ProjectModel } from '@noodl-models/projectmodel';
import { WarningsModel } from '@noodl-models/warningsmodel';
import { exportComponent } from '@noodl-utils/exporter';

/**
 * DEF-034 (phase 80) — a wire the editor calls merely *questionable* was deleted from the build
 * exactly like a broken one.
 *
 * `WarningsModel.getWarnings` did not filter by level, so **any** recorded warning on a
 * connection made `getConnectionHealth` return `healthy: false`, and `exportComponent`'s filter
 * drops every unhealthy wire. Two of the seven connection keys `evaluateConnectionHealth` can
 * write are `level: 'warning'`, and both describe wires that *work*:
 *
 *   - `con-target-port-gated` (FB-021) — a wire into a `basic`-gated port. Its own comment says
 *     the wire *"is valid and its value is ignored"*. `basic` suppresses the property ROW; the
 *     port still exists.
 *   - `con-type-unconverted` (FIX-025) — `string → number`, which the `typecasts` table permits
 *     and the runtime does not convert. The value arrives verbatim; it is not absent.
 *
 * ## Why deleting them is worse than keeping them
 *
 * 🔴 **The gate is evaluated against a SAVED PARAMETER, and the running app is not obliged to
 * stay in that state.** `evaluateDynamicPortsCondition` reads `getParameter(gate)`; a gate driven
 * by a *wire* sets no parameter, so the editor reads the port's default, calls the port switched
 * off, and the export removes the wire. When the gate flips at runtime the port becomes live with
 * nothing delivering a value — permanently, and with no diagnostic in the artefact.
 *
 * ⚠️ **Measured over 179 projects on this machine before the fix**: 290 gated wires and 23
 * unconverted ones were being dropped, across 34 projects. **27 of the 290 had the gate port
 * itself wired** — a `States` node or a Component Input feeding `flexDirection`, `useIcon` or
 * `useLabel` — inside reusable components ("Pretty button", "Secondary Button", "Toggle Switch"),
 * where a parameter arriving from outside is the whole point of the component.
 *
 * ✅ **Both shipped templates measured 0** (Site Builder: 0 of 412 connections; TPL-001: 0 of
 * 273). This was never observable from the templates, which is why the register could only say
 * "it may cost nothing" — the population that pays for it is authored projects.
 *
 * 🔴 **What this suite deliberately does NOT change: the canvas.** FB-021's dash is Richard's
 * ruling and it is drawn from the *unfiltered* verdict, so `NodeGraphEditorConnection` still
 * dashes a gated wire. The narrowing is opt-in and only `exportComponent` opts in.
 */
describe('DEF-034 — only an error deletes a wire from the build', () => {
  // Resolves on both ends, at every level. The positive control every absence below rests on.
  const GOOD = { fromId: 'A', fromProperty: 'text', toId: 'B', toProperty: 'plainNumber' };
  // No target port at all — `con-no-target-port`, `level: 'error'`. Must still be deleted.
  const BROKEN = { fromId: 'A', fromProperty: 'text', toId: 'B', toProperty: 'noSuchPort' };

  let comp: TSFixme;

  /**
   * 🔴 `exportConnection` renames the fields — a wire is `from/toProperty` on the graph and
   * `source/targetPort` in the artefact. Reading the graph's names off the export yields
   * `undefined->undefined` for every wire, which *satisfies* an absence assertion while measuring
   * nothing. DEF-028's suite lost a spec to exactly that, hence the controls below.
   */
  function exportedConnections() {
    return exportComponent(comp).connections.map((c: TSFixme) => `${c.sourcePort}->${c.targetPort}`);
  }

  function load(project: TSFixme) {
    (window as TSFixme).NodeLibraryData = require('./nodelibrary');
    NodeLibrary.instance.loadLibrary();

    // WarningsModel is a global singleton; leftovers from another spec key into this component's
    // slot and would decide these assertions.
    WarningsModel.instance.clearAllWarnings();

    ProjectModel.instance = ProjectModel.fromJSON(project);
    NodeLibrary.instance.registerModule(ProjectModel.instance);
    comp = ProjectModel.instance.getComponentWithName('/comp1');

    // Settle health now rather than waiting on the debounce. `exportComponent` does this itself
    // (DEF-028), but asserting on warnings BEFORE exporting needs them written.
    comp.graph.flushEvaluateHealth();
  }

  afterEach(() => {
    if (ProjectModel.instance) NodeLibrary.instance.unregisterModule(ProjectModel.instance);
    WarningsModel.instance.clearAllWarnings();
  });

  describe('con-target-port-gated — a wire into a switched-off port (FB-021)', () => {
    // `gatedNumber` sits behind `useExtras = true`. `useExtras` is left unset, so the condition
    // fails and the port is gated — the state 232 of the 290 measured wires are in.
    const GATED = { fromId: 'A', fromProperty: 'text', toId: 'B', toProperty: 'gatedNumber' };

    beforeEach(() => {
      load({
        components: [
          {
            name: '/comp1',
            graph: {
              roots: [
                { id: 'A', type: 'def034Node' },
                { id: 'B', type: 'def034Node' }
              ],
              connections: [GOOD, GATED, BROKEN]
            }
          }
        ]
      });
    });

    /**
     * The known-firing signal beside the absence. If the evaluator never raised the warning, the
     * survival assertion below would pass for a reason that has nothing to do with the fix — the
     * gate would be vacuous and the suite green on the defect.
     */
    it('the evaluator really does raise it, at level warning', () => {
      const w = WarningsModel.instance.getWarnings({ component: comp, connection: GATED });
      expect(w).toBeDefined();
      const gated = w.warnings.find((entry: TSFixme) => entry.ref.key === 'con-target-port-gated');
      expect(gated).toBeDefined();
      expect(gated.warning.level).toBe('warning');

      // And the port really exists — otherwise this would be the error-level `con-no-target-port`
      // and the suite would be grading a different key entirely.
      expect(comp.graph.findNodeWithId('B').getPort('gatedNumber')).toBeDefined();
    });

    it('the canvas still calls the wire unhealthy, so FB-021 keeps its dash', () => {
      const health = comp.graph.getConnectionHealth({
        sourceId: GATED.fromId,
        sourcePort: GATED.fromProperty,
        targetId: GATED.toId,
        targetPort: GATED.toProperty
      });
      expect(health.healthy).toBe(false);
    });

    it('but the export keeps the wire', () => {
      const exported = exportedConnections();
      // Controls first: the helper can see wires at all, and an error still deletes one.
      expect(exported).toContain('text->plainNumber');
      expect(exported).not.toContain('text->noSuchPort');

      expect(exported).toContain('text->gatedNumber');
      expect(exported.length).toBe(2);
    });
  });

  describe('con-type-unconverted — a permitted cast the runtime does not perform (FIX-025)', () => {
    // `text` is a `string` output; `plainNumber` is a `number` input. The typecasts table permits
    // it, so this is NOT `con-type-mismatch`; the value simply arrives as text.
    it('the evaluator raises it at level warning, and the export keeps the wire', () => {
      load({
        components: [
          {
            name: '/comp1',
            graph: {
              roots: [
                { id: 'A', type: 'def034Node' },
                { id: 'B', type: 'def034Node' }
              ],
              connections: [GOOD, BROKEN]
            }
          }
        ]
      });

      const w = WarningsModel.instance.getWarnings({ component: comp, connection: GOOD });
      expect(w).toBeDefined();
      const cast = w.warnings.find((entry: TSFixme) => entry.ref.key === 'con-type-unconverted');
      expect(cast).toBeDefined();
      expect(cast.warning.level).toBe('warning');

      const exported = exportedConnections();
      expect(exported).toContain('text->plainNumber');
      // The error-level control, in the same reading, so "kept everything" cannot pass this.
      expect(exported).not.toContain('text->noSuchPort');
      expect(exported.length).toBe(1);
    });
  });

  describe('the filter itself, at the model', () => {
    beforeEach(() => {
      load({
        components: [
          { name: '/comp1', graph: { roots: [{ id: 'A', type: 'def034Node' }], connections: [] } }
        ]
      });
    });

    /**
     * 🔴 `setWarning` normalises an absent level to `'warning'`, not to `'error'`. This phase has
     * already been bitten once by an absent key meaning opposite things to two readers, so the
     * model's own ruling is asserted here rather than assumed by the filter.
     */
    it('an unlabelled warning is stored as a warning, so an error-only reader does not see it', () => {
      const ref = { component: comp, node: comp.graph.findNodeWithId('A') };
      WarningsModel.instance.setWarning({ ...ref, key: 'unlabelled' }, { message: 'no level given' });

      expect(WarningsModel.instance.getWarnings(ref).warnings[0].warning.level).toBe('warning');
      expect(WarningsModel.instance.getWarnings(ref, { levels: ['error'] })).toBeUndefined();
      expect(WarningsModel.instance.getWarnings(ref, { levels: ['warning'] })).toBeDefined();
    });

    it('narrowing keeps the errors and drops the warnings from both the list and the message', () => {
      const ref = { component: comp, node: comp.graph.findNodeWithId('A') };
      WarningsModel.instance.setWarning({ ...ref, key: 'e' }, { message: 'fatal', level: 'error' });
      WarningsModel.instance.setWarning({ ...ref, key: 'w' }, { message: 'merely odd', level: 'warning' });

      const all = WarningsModel.instance.getWarnings(ref);
      expect(all.warnings.length).toBe(2);
      expect(all.shortMessage).toContain('merely odd');

      const errorsOnly = WarningsModel.instance.getWarnings(ref, { levels: ['error'] });
      expect(errorsOnly.warnings.length).toBe(1);
      expect(errorsOnly.shortMessage).toBe('fatal');
      expect(errorsOnly.shortMessage).not.toContain('merely odd');
    });

    it('omitting levels is unchanged — every existing caller reads what it always read', () => {
      const ref = { component: comp, node: comp.graph.findNodeWithId('A') };
      WarningsModel.instance.setWarning({ ...ref, key: 'w' }, { message: 'merely odd', level: 'warning' });

      expect(WarningsModel.instance.getWarnings(ref).warnings.length).toBe(1);
    });
  });
});
