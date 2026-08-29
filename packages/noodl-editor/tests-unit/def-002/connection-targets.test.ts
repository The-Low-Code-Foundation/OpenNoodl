/**
 * DEF-002 §1(a) — a wire to a component-instance port that does not exist.
 *
 * ## What this grades, and against what
 *
 * Phase 78's D1 measured the hole by **sabotage**: renaming `standing.isMember`
 * to `standing.isMemberXX` in the members-area template produced a run identical
 * to the clean one. This file is that sabotage as a permanent arm, plus the
 * clean control beside it — 🔴 **a rule that fires on both arms has measured
 * nothing, and a rule that fires on neither is worse, because it looks like
 * coverage.**
 *
 * Every case below is a **pair**: the same graph, one wire apart.
 *
 * ## 🔴 The inversion is graded explicitly
 *
 * A port authored with plug `"output"` is an instance **input**; plug `"input"`
 * is an instance **output**. A checker with that backwards would refuse every
 * correct graph and accept every broken one — and would still pass a test suite
 * that only ever checked one direction. Both directions are here, and the
 * `accepts the correct wiring` cases are what make the refusals mean something.
 *
 * @module noodl-editor/tests-unit/def-002/connection-targets
 */
import { checkConnectionTargets, type ConnectionLike, type InstanceNodeLike } from '@noodl-models/../validation/connectionTargets';
import { componentInterfaceIndex } from '@noodl-models/../validation/componentInterface';
import { DiagnosticCode } from '@noodl-models/../validation/diagnostics';

const CARD = '/Components/Standing';

/**
 * The target component: a `Component Inputs` node publishing two instance
 * INPUTS (plug "output"), and a `Component Outputs` node publishing two
 * instance OUTPUTS (plug "input").
 */
function standingComponent() {
  return {
    name: CARD,
    nodes: [
      {
        type: 'Component Inputs',
        ports: [
          { name: 'memberId', plug: 'output' },
          { name: 'role', plug: 'output' }
        ]
      },
      {
        type: 'Component Outputs',
        ports: [
          { name: 'isMember', plug: 'input' },
          { name: 'isModerator', plug: 'input' }
        ]
      }
    ]
  };
}

function interfaces(extra: ReturnType<typeof standingComponent>[] = []) {
  return componentInterfaceIndex([standingComponent(), ...extra]);
}

const INSTANCE: InstanceNodeLike = { id: 'standing', type: CARD, label: 'Standing' };
const CONSUMER: InstanceNodeLike = { id: 'gate', type: 'Group' };

function run(wires: ConnectionLike[], nodes: InstanceNodeLike[] = [INSTANCE, CONSUMER]) {
  return checkConnectionTargets(nodes, { component: '/Pages/Members', interfaces: interfaces(), wires });
}

describe('DEF-002 §1(a) — a wire to a component-instance port', () => {
  describe("phase 78 D1's sabotage, and the clean graph beside it", () => {
    it('accepts the correct wiring — the control that makes every refusal below mean something', () => {
      expect(
        run([
          { fromId: 'standing', fromProperty: 'isMember', toId: 'gate', toProperty: 'visible' },
          { fromId: 'gate', fromProperty: 'value', toId: 'standing', toProperty: 'memberId' }
        ])
      ).toEqual([]);
    });

    it('refuses `standing.isMember` -> `standing.isMemberXX` BY NAME', () => {
      const found = run([{ fromId: 'standing', fromProperty: 'isMemberXX', toId: 'gate', toProperty: 'visible' }]);
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe(DiagnosticCode.ConnectionUnknownInstancePort);
      expect(found[0].severity).toBe('error');
      expect(found[0].location.port).toBe('isMemberXX');
      expect(found[0].location.plug).toBe('output');
      // The "did you mean" that the audit measured a 100% self-correction rate on.
      expect(found[0].suggestion).toBe('isMember');
      expect(found[0].alternatives).toEqual(['isMember', 'isModerator']);
      // It names the wire, not just the node — an author with six wires to one
      // instance needs to know which.
      expect(found[0].location.connection).toEqual({
        fromId: 'standing',
        fromProperty: 'isMemberXX',
        toId: 'gate',
        toProperty: 'visible'
      });
    });

    it('refuses a mistyped INPUT as well as a mistyped output', () => {
      const found = run([{ fromId: 'gate', fromProperty: 'value', toId: 'standing', toProperty: 'memberIdXX' }]);
      expect(found).toHaveLength(1);
      expect(found[0].location.plug).toBe('input');
      expect(found[0].suggestion).toBe('memberId');
      expect(found[0].alternatives).toEqual(['memberId', 'role']);
    });
  });

  describe('🔴 the plug inversion — the one way to get this wrong', () => {
    it('an instance INPUT is a port authored with plug "output"', () => {
      const iface = interfaces().get(CARD)!;
      expect(iface.inputs).toEqual(['memberId', 'role']);
      expect(iface.outputs).toEqual(['isMember', 'isModerator']);
    });

    it('refuses a wire INTO a port that is an instance OUTPUT — the mirror mistake', () => {
      // `isMember` exists, but as an output. Wiring INTO it is not the same graph.
      const found = run([{ fromId: 'gate', fromProperty: 'value', toId: 'standing', toProperty: 'isMember' }]);
      expect(found).toHaveLength(1);
      expect(found[0].location.plug).toBe('input');
      expect(found[0].alternatives).toEqual(['memberId', 'role']);
    });

    it('refuses a wire OUT OF a port that is an instance INPUT', () => {
      const found = run([{ fromId: 'standing', fromProperty: 'memberId', toId: 'gate', toProperty: 'visible' }]);
      expect(found).toHaveLength(1);
      expect(found[0].location.plug).toBe('output');
      expect(found[0].alternatives).toEqual(['isMember', 'isModerator']);
    });
  });

  describe('what it deliberately stays silent about — each with the firing case beside it', () => {
    it('says nothing about a node that is not a component instance', () => {
      // 🔴 The known-firing control: the SAME bad port name on the SAME wire,
      // differing only in whether the node is an instance. Without this pair the
      // silence below would be indistinguishable from a check that never ran.
      expect(run([{ fromId: 'gate', fromProperty: 'nonsense', toId: 'standing', toProperty: 'memberId' }])).toEqual([]);
      expect(run([{ fromId: 'standing', fromProperty: 'nonsense', toId: 'gate', toProperty: 'x' }])).toHaveLength(1);
    });

    it('says nothing about a component the index cannot resolve — unresolved-component-ref owns it', () => {
      const found = checkConnectionTargets([{ id: 'ghost', type: '/Components/NotThere' }], {
        component: '/Pages/Members',
        interfaces: interfaces(),
        wires: [{ fromId: 'ghost', fromProperty: 'anything', toId: 'gate', toProperty: 'visible' }]
      });
      expect(found).toEqual([]);
    });

    it('says nothing about a component with no ports in that direction — InterfacelessInstance owns it', () => {
      const empty = componentInterfaceIndex([{ name: '/Components/Bare', nodes: [] }]);
      expect(
        checkConnectionTargets([{ id: 'bare', type: '/Components/Bare' }], {
          component: '/Pages/Members',
          interfaces: empty,
          wires: [{ fromId: 'bare', fromProperty: 'whatever', toId: 'gate', toProperty: 'visible' }]
        })
      ).toEqual([]);
    });

    it('accepts a port the instance serialises on itself', () => {
      const withOwn: InstanceNodeLike = { ...INSTANCE, ports: [{ name: 'extra' }] };
      expect(run([{ fromId: 'standing', fromProperty: 'extra', toId: 'gate', toProperty: 'v' }], [withOwn])).toEqual(
        []
      );
      // …and the same wire without that declaration is refused. The pair is the point.
      expect(run([{ fromId: 'standing', fromProperty: 'extra', toId: 'gate', toProperty: 'v' }])).toHaveLength(1);
    });

    it('omitted wires means "do not check", not "nothing was wrong"', () => {
      expect(checkConnectionTargets([INSTANCE], { component: 'c', interfaces: interfaces() })).toEqual([]);
      expect(checkConnectionTargets([INSTANCE], { component: 'c', interfaces: interfaces(), wires: [] })).toEqual([]);
    });
  });

  it('reports one diagnostic per offending ENDPOINT, and a wire has two', () => {
    // Both ends wrong on one wire between two instances — two findings, not one,
    // and not four.
    const second: InstanceNodeLike = { id: 'other', type: CARD, label: 'Other' };
    const found = run(
      [{ fromId: 'standing', fromProperty: 'nopeOut', toId: 'other', toProperty: 'nopeIn' }],
      [INSTANCE, second]
    );
    expect(found).toHaveLength(2);
    expect(found.map((d) => d.location.plug).sort()).toEqual(['input', 'output']);
  });
});
