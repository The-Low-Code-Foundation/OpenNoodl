/**
 * CN-002 — a skipped check must say so.
 *
 * `unknown-node-type` correctly reports, as a *warning*, that a type is not in
 * the catalog. What nothing reported is that **every downstream check then
 * stopped**. Measured on `NodeGX test projects/cashflow-command-centre` before
 * this landed: five kit nodes carrying 26 parameters verified by nothing, and 10
 * of the project's 28 connection endpoints never reached — printed as
 * `0 error(s), 5 warning(s), 0 info`. After: `0 error(s), 5 warning(s), 8 info`.
 *
 * The three assertions that carry the task are the *inertness* ones. `info`
 * never fails anything, and that is load-bearing rather than incidental: if the
 * severity were implemented wrong, every project using a module node would start
 * failing CI, which is precisely the "cry wolf" outcome the warning-not-error
 * policy exists to avoid. So this file asserts the severity, asserts the summary
 * counts are untouched, and asserts the code is not in the set that blocks
 * authored output.
 *
 * ⚠️ Two of these tests are also **CN-003's baseline instrument**. When the
 * project catalog overlay lands, a kit node's type resolves and these infos
 * should vanish, replaced by real results. That is a number taken before and
 * after. If a later change makes them disappear for any other reason, these
 * tests are what notices.
 */
import {
  AUTHORED_BLOCKING_WARNINGS,
  DiagnosticCode,
  checkParameterValues,
  fromLegacyProject,
  isBlockingForAuthoredOutput,
  validateProject,
  type Diagnostic
} from '../../src/editor/src/validation';
import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';

const KIT_TYPE = 'mykit.Chip';

/** Built once — the same catalog the shipped validator uses, not a stub. */
const CATALOG = loadDefaultCatalog();

interface RawNode {
  id: string;
  type: string;
  label?: string;
  children?: RawNode[];
  parameters?: Record<string, unknown>;
}

/**
 * A `Text` feeding a node, where only the target's type varies.
 *
 * The pair is the whole design: same graph, same connection, same ports — the
 * *only* difference is whether the catalog knows the target. So any difference
 * in the output is attributable to that and to nothing else.
 */
function twoNodeGraph(targetType: string) {
  const roots: RawNode[] = [
    {
      id: 'group',
      type: 'Group',
      label: 'Root',
      children: [
        { id: 'src', type: 'Text', label: 'Source', parameters: { text: 'hello' } },
        { id: 'dst', type: targetType, label: 'Target', parameters: { label: 'x', tone: 'warm' } }
      ]
    }
  ];
  return fromLegacyProject({
    components: [
      {
        name: '/Pages/Home',
        graph: { roots, connections: [{ fromId: 'src', fromProperty: 'text', toId: 'dst', toProperty: 'label' }] }
      }
    ]
  });
}

const skips = (ds: Diagnostic[]) => ds.filter((d) => d.code === DiagnosticCode.UnknownTypeCheckSkipped);

describe('CN-002: a check skipped for an unresolvable type says so', () => {
  const unknown = validateProject(twoNodeGraph(KIT_TYPE));

  it('emits an info for each check that did not run, naming the node', () => {
    const found = skips(unknown.diagnostics);
    expect(found.length).toBeGreaterThan(0);

    for (const d of found) {
      expect(d.location?.nodeId).toBe('dst');
      expect(d.location?.nodeType).toBe(KIT_TYPE);
      expect(d.location?.nodeLabel).toBe('Target');
    }
  });

  it('names the specific check, not a generic "skipped"', () => {
    const messages = skips(unknown.diagnostics).map((d) => d.message);
    expect(messages.some((m) => m.includes('connection port existence'))).toBe(true);
    expect(messages.some((m) => m.includes('connection type compatibility'))).toBe(true);
    // CN-003's diff has to be legible: each line must say what will replace it.
    expect(messages.every((m) => !/\bskipped\b\.?$/i.test(m))).toBe(true);
  });

  it('states the reason as a fact about our knowledge, never a verdict on the node', () => {
    // A kit node is not wrong; we are uninformed. Wording this the other way
    // round would teach authors that using a custom node is an error, which is
    // the opposite of what this phase exists for.
    for (const d of skips(unknown.diagnostics)) {
      expect(d.message).toContain(`type "${KIT_TYPE}" is not in the node catalog`);
      expect(d.message).not.toMatch(/invalid|illegal|bad node|not allowed/i);
    }
  });

  it('emits one per (node, check) pair — not one per endpoint', () => {
    const pairs = skips(unknown.diagnostics).map((d) => `${d.location?.nodeId}|${d.message.split('"')[1]}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  // ─── inertness: the half that must never regress ──────────────────────────

  it('is always info, never error or warning', () => {
    for (const d of skips(unknown.diagnostics)) expect(d.severity).toBe('info');
  });

  it('leaves error and warning counts exactly where they were', () => {
    /*
     * The known-type twin is the control for **errors**. The unknown-type graph must add no error
     * and no warning of its own; the only warning it may carry is `unknown-node-type`, which
     * predates this task.
     *
     * 🔴 **The count identity `unknown === known + 1` was here and had to go, re-baselined rather
     * than deleted.** `c1c0b5b5` added `validation/rules/parameterValue.ts` and registered it, and
     * that rule fires on the control's resolvable `Text` node and **cannot** fire on an
     * unresolvable one — the whole point of the skip this file grades. So the two graphs stopped
     * being comparable by count, in the direction that made the identity read as a regression:
     * measured 2026-08-18, `known.summary.warnings` is **2** and `unknown.summary.warnings` is
     * **1**.
     *
     * ⚠️ **This is CN-002's deliberate silence baseline, so it is replaced with a STRONGER
     * assertion, not a looser one.** `.every(...)` passed vacuously on an empty list and said
     * nothing about how many warnings there were; the list comparison below pins the cardinality
     * too, which is the half that goes unnoticed. If a future rule makes this graph warn about
     * something else, this row still fails — which is what the identity was protecting.
     */
    const known = validateProject(twoNodeGraph('Text'));
    expect(unknown.summary.errors).toBe(known.summary.errors);

    const unknownWarnings = unknown.diagnostics.filter((d) => d.severity === 'warning');
    expect(unknownWarnings.map((d) => d.code)).toEqual([DiagnosticCode.UnknownNodeType]);
  });

  it('never blocks authored output', () => {
    // A tripwire, not a description: a later edit to AUTHORED_BLOCKING_WARNINGS
    // must not be able to promote this code quietly.
    expect(AUTHORED_BLOCKING_WARNINGS.has(DiagnosticCode.UnknownTypeCheckSkipped)).toBe(false);
    for (const d of skips(unknown.diagnostics)) expect(isBlockingForAuthoredOutput(d)).toBe(false);
  });

  // ─── the control: silence when nothing was skipped ────────────────────────

  it('emits nothing at all when every type resolves', () => {
    // Without this the assertions above could all be satisfied by a rule that
    // fires unconditionally, and would look identical.
    expect(skips(validateProject(twoNodeGraph('Text')).diagnostics)).toEqual([]);
  });

  it('stays silent about a node it did not actually skip', () => {
    // An unresolvable node with NO connections has nothing skipped by the two
    // connection rules, so it must produce no notice from them — the diagnostic
    // claims a skip that happened, not one that could have. This is the real
    // behaviour on `cashflow-command-centre`, whose `DayAxis` has zero
    // connections and correctly draws no connection-check info.
    const lonely = fromLegacyProject({
      components: [
        {
          name: '/Pages/Home',
          graph: { roots: [{ id: 'solo', type: KIT_TYPE, label: 'Lonely' }], connections: [] }
        }
      ]
    });
    expect(skips(validateProject(lonely).diagnostics)).toEqual([]);
  });
});

describe('CN-002: the parameter-values skip', () => {
  /**
   * ⚠️ This one is NOT reachable from `npm run validate:project`, and that is a
   * finding rather than an oversight here: `checkParameterValues` has exactly
   * one caller, `authoredPreconditionDiagnostics`, so the project-level gate
   * never checks parameter values for **any** node — kit or built-in. It runs
   * on the AI-authoring path (MCP `validate_component`, the editor's authoring
   * loop), which is where this info surfaces.
   */
  const node = { id: 'dst', type: KIT_TYPE, label: 'Target', parameters: { label: 'x', tone: 'warm' } };

  it('reports that every parameter on the node went unchecked', () => {
    const found = skips(checkParameterValues([node], CATALOG, { component: '/Pages/Home' }));
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('info');
    expect(found[0].message).toContain('parameter values');
    expect(found[0].location?.nodeId).toBe('dst');
  });

  it('says nothing for a node whose type resolves', () => {
    const known = { id: 'ok', type: 'Text', label: 'Fine', parameters: { text: 'hello' } };
    expect(skips(checkParameterValues([known], CATALOG, { component: '/Pages/Home' }))).toEqual([]);
  });

  it('says nothing for an unresolvable node with no parameters — nothing was skipped', () => {
    const bare = { id: 'bare', type: KIT_TYPE, label: 'Bare' };
    expect(skips(checkParameterValues([bare], CATALOG, { component: '/Pages/Home' }))).toEqual([]);
  });
});
