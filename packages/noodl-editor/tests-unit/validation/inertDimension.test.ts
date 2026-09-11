/**
 * DSG-004 §2.2 — `width`, `height` and `objectFit` that `sizeMode` switches off.
 *
 * ⚠️ The spec filed this as a rule that did not exist. Read in source it did:
 * `checkParameterValues` has reported it since phase 54 as
 * `inactive-conditional-parameter`, and it fires correctly. What did not exist
 * was a diagnostic that (a) carried the exit and (b) could be promoted on its
 * own — severity policy in `AUTHORED_BLOCKING_WARNINGS` is per *code*, and the
 * general code covers 366 corpus hits of a dozen unrelated conditions.
 *
 * So this file pins the split rather than the detection: the `sizeMode` family
 * reports under its own code, carries the repair, and blocks authored output;
 * everything else it used to cover still reports exactly as before.
 */

import { AUTHORED_BLOCKING_WARNINGS, isBlockingForAuthoredOutput } from '../../src/editor/src/validation/authoredCandidate';
import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';
import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';
import { checkParameterValues, type ParameterizedNode } from '../../src/editor/src/validation/parameterValues';

const catalog = loadDefaultCatalog();

const run = (type: string, parameters: Record<string, unknown>) =>
  checkParameterValues([{ id: 'n1', type, parameters }] as ParameterizedNode[], catalog, { component: '/Pages/Home' });

const codes = (type: string, parameters: Record<string, unknown>) => run(type, parameters).map((d) => d.code);

describe('inert-dimension (DSG-004 §2.2)', () => {
  it('reports the three ports doctrine §8 names, on an Image left at its default sizeMode', () => {
    // The build that produced 800px-tall photographs: a width, a height and an
    // objectFit, none of which the node reads.
    const found = run('Image', {
      src: 'a.png',
      width: { value: 100, unit: '%' },
      height: { value: 240, unit: 'px' },
      objectFit: 'cover'
    });
    expect(found.map((d) => d.code)).toEqual([
      DiagnosticCode.InertDimension,
      DiagnosticCode.InertDimension,
      DiagnosticCode.InertDimension
    ]);
    expect(found.map((d) => d.location.port).sort()).toEqual(['height', 'objectFit', 'width']);
  });

  it('reports the corpus’s real case: a Text Input at width 100% that renders 170px', () => {
    // `Puppy test 3`'s admin form, six times over — and the sentence doctrine §8
    // uses to describe it.
    // Picked by port: a Text Input with a label reports its own unrelated
    // conditional ports too, and which comes first is not this rule's claim.
    const found = run('net.noodl.controls.textinput', { label: 'Name', width: { value: 100, unit: '%' } }).find(
      (d) => d.location.port === 'width'
    )!;
    expect(found.code).toBe(DiagnosticCode.InertDimension);
    expect(found.severity).toBe('warning');
    expect(found.message).toContain('inert');
    // The exit, and both of the modes that reach it.
    expect(found.message).toContain('sizeMode: "explicit"');
    expect(found.message).toContain('contentHeight');
    expect(found.suggestion).toBe('sizeMode: "explicit"');
  });

  it('offers the mode that keeps the other axis on the content', () => {
    const [height] = run('Image', { src: 'a.png', height: { value: 240, unit: 'px' } });
    expect(height.message).toContain('contentWidth');
  });

  it('blocks authored output, where a width that does nothing is a value the agent believes it set', () => {
    const [found] = run('Image', { src: 'a.png', width: { value: 100, unit: '%' } });
    expect(AUTHORED_BLOCKING_WARNINGS.has(DiagnosticCode.InertDimension)).toBe(true);
    expect(isBlockingForAuthoredOutput(found)).toBe(true);
  });

  it('says nothing once sizeMode is explicit', () => {
    expect(
      codes('Image', {
        src: 'a.png',
        sizeMode: 'explicit',
        width: { value: 100, unit: '%' },
        height: { value: 240, unit: 'px' },
        objectFit: 'cover'
      })
    ).toEqual([]);
  });

  it('says nothing about a width on a node whose sizeMode defaults to explicit', () => {
    // `Group` and `Text` differ from `Image` here, and the check reads the
    // condition rather than a list of type names — which is what keeps it right
    // for the next type that calls `addDimensions`.
    expect(codes('Group', { width: { value: 100, unit: '%' } })).toEqual([]);
    expect(codes('Text', { text: 'x', width: { value: 50, unit: '%' } })).toEqual([]);
  });

  it('reports a Text height, because Text sizes its height to its content', () => {
    expect(codes('Text', { text: 'x', height: { value: 20, unit: 'px' } })).toEqual([DiagnosticCode.InertDimension]);
  });

  it('leaves every other conditional port on the general code, still a warning', () => {
    // A `borderWidth` with no `borderStyle` is the same class of defect and 67
    // corpus hits, but its promotion is a separate decision with its own
    // evidence — so it must not have been swept along by this one.
    const [found] = run('Group', { borderWidth: { value: 2, unit: 'px' } });
    expect(found.code).toBe(DiagnosticCode.InactiveConditionalParameter);
    expect(AUTHORED_BLOCKING_WARNINGS.has(DiagnosticCode.InactiveConditionalParameter)).toBe(false);
  });
});
