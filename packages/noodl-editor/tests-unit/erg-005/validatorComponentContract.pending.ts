/**
 * ERG-005 §1 — the validator can finally see a component's interface.
 *
 * §0 measured the gap this closes: a graph the running editor raises **2
 * errors** on validated **0 errors, 0 warnings** under `validate:project`,
 * because a component's ports were never written to disk. The two errors were
 *
 *   1. a connection to a port the component does not have — *"Target port
 *      doesn't exist."*
 *   2. a `string` component output wired into a `font` input — *"Target port of
 *      type font cannot be connected to a source port of type string"*
 *
 * so those are the two cases here, plus the one that matters more than either:
 * **a project saved before §1 must still validate exactly as it did.** A rule
 * that treated a missing contract as an empty interface would turn every
 * existing project into a wall of false errors, which is a far worse failure
 * than the blindness it replaced.
 */

import { SemanticValidator } from '../../src/editor/src/validation/SemanticValidator';
import { fromLegacyProject } from '../../src/editor/src/validation/normalize';
import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';

// No argument: the **real** generated catalog. NDA-017's rule shipped broken
// because its tests used a hand-built one, and `Text.text` / `Text.fontFamily`
// below are only a provable string/font pair against the real thing.
const validator = new SemanticValidator();

/**
 * A caller wiring a `Text` node into an instance of `/Card`.
 *
 * `Text.text` is a real `string` input and `Text.fontFamily` is a real `font`
 * input, which is what makes the incompatible case provable against the real
 * catalog rather than a hand-built one — NDA-017 shipped a broken rule on the
 * strength of a fixture catalog and this phase's first lesson is not to.
 */
function project(cardPorts: unknown, connections: Array<[string, string, string, string]>) {
  return {
    components: [
      {
        name: '/Card',
        ports: cardPorts,
        graph: { roots: [], connections: [] }
      },
      {
        name: '/#Home',
        graph: {
          roots: [
            { id: 'text', type: 'Text', ports: [], children: [] },
            { id: 'card', type: '/Card', ports: [], children: [] }
          ],
          connections: connections.map(([fromId, fromProperty, toId, toProperty]) => ({
            fromId,
            fromProperty,
            toId,
            toProperty
          }))
        }
      }
    ]
  };
}

function run(p: ReturnType<typeof project>) {
  return validator.validate(fromLegacyProject(p as never)).diagnostics;
}

const CONTRACT = [
  { name: 'title', plug: 'input', type: { name: 'string' } },
  { name: 'label', plug: 'output', type: { name: 'string' } }
];

describe('a component that recorded its contract', () => {
  it('reports a connection to a port the component does not have', () => {
    const found = run(project(CONTRACT, [['text', 'text', 'card', 'subtitle']]));
    const errors = found.filter((d) => d.code === DiagnosticCode.NonexistentPort);

    expect(errors.length).toBe(1);
    expect(errors[0].severity).toBe('error');
    expect(errors[0].message).toBe('Component /Card has no input named "subtitle".');
    // The message has to say what the component *does* accept, or the reader is
    // told they are wrong and not what would be right.
    expect(errors[0].alternatives).toEqual(['title']);
  });

  it('accepts a connection to a port the component does have', () => {
    const found = run(project(CONTRACT, [['text', 'text', 'card', 'title']]));
    expect(found.filter((d) => d.code === DiagnosticCode.NonexistentPort)).toEqual([]);
  });

  it('reports a type-incompatible wire out of a component output', () => {
    // `/Card.label` is `string`; `Text.fontFamily` is `font`. §0 drove exactly
    // this pair through the editor's health pass and got an error.
    const found = run(project(CONTRACT, [['card', 'label', 'text', 'fontFamily']]));
    const mismatches = found.filter((d) => d.code === DiagnosticCode.TypeIncompatibleConnection);

    expect(mismatches.length).toBe(1);
    expect(mismatches[0].message).toContain('(string)');
    expect(mismatches[0].message).toContain('(font)');
  });

  it('accepts a compatible wire out of a component output', () => {
    const found = run(project(CONTRACT, [['card', 'label', 'text', 'text']]));
    expect(found.filter((d) => d.code === DiagnosticCode.TypeIncompatibleConnection)).toEqual([]);
  });

  it('treats a port derived as "*" as compatible with anything', () => {
    // An unwired component port really is `*`. That is a stated answer, not a
    // missing one, and the wildcard casts to everything.
    const wildcard = [{ name: 'label', plug: 'output', type: { name: '*' } }];
    const found = run(project(wildcard, [['card', 'label', 'text', 'fontFamily']]));
    expect(found.filter((d) => d.code === DiagnosticCode.TypeIncompatibleConnection)).toEqual([]);
  });
});

describe('a project saved before the contract existed', () => {
  it('still skips every component-ref endpoint, exactly as before', () => {
    // Both the nonexistent port and the incompatible type, and neither fires.
    const found = run(
      project(undefined, [
        ['text', 'text', 'card', 'subtitle'],
        ['card', 'label', 'text', 'fontFamily']
      ])
    );
    expect(found.filter((d) => d.code === DiagnosticCode.NonexistentPort)).toEqual([]);
    expect(found.filter((d) => d.code === DiagnosticCode.TypeIncompatibleConnection)).toEqual([]);
  });

  it('skips a port the contract does not mention, since an instance may add its own', () => {
    const found = run(project(CONTRACT, [['card', 'extra', 'text', 'fontFamily']]));
    expect(found.filter((d) => d.code === DiagnosticCode.TypeIncompatibleConnection)).toEqual([]);
  });
});

describe('a component that recorded an empty contract', () => {
  it('is checked, and reports the port as nonexistent', () => {
    // `ports: []` is a component that genuinely exposes nothing — a *recorded*
    // answer. This is the case that must not be folded into "no contract".
    const found = run(project([], [['text', 'text', 'card', 'title']]));
    const errors = found.filter((d) => d.code === DiagnosticCode.NonexistentPort);
    expect(errors.length).toBe(1);
    expect(errors[0].message).toBe('Component /Card has no input named "title".');
  });
});
