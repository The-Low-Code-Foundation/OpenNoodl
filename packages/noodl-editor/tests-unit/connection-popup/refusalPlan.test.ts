/**
 * SIG-001 — the ranking that turns a dead end into the wire the builder meant.
 *
 * The fixture below is Text Input-shaped on purpose: it is the node SIG-001
 * names as the hard case ("dozens of ports, most of them refused by any given
 * source"), and it is the one whose `groupPriority` the phase already found does
 * *not* list `Run On Value Change`.
 */

import {
  asRefusalReason,
  isConfidentRedirect,
  dominantReason,
  dominantTypeName,
  OTHER_GROUP,
  type PlannablePort,
  rankAlternatives
} from '../../src/editor/src/views/ConnectionPopup/refusalPlan';

function port(partial: Partial<PlannablePort> & { name: string }): PlannablePort {
  return {
    displayName: partial.name,
    typeName: 'string',
    ...partial
  };
}

/** A Text Input's inputs, as the popup builds them mid-drag from a String output. */
const TEXT_INPUT_PORTS: PlannablePort[] = [
  port({ name: 'Do', typeName: 'signal', group: 'Actions', disabled: true, reason: 'signal-rule' }),
  port({ name: 'Clear', typeName: 'signal', group: 'Actions', disabled: true, reason: 'signal-rule' }),
  port({ name: 'Text', typeName: 'string', group: 'General' }),
  port({ name: 'Placeholder', typeName: 'string', group: 'Text Style' }),
  port({ name: 'Width', typeName: 'number', group: 'Dimensions' }),
  port({ name: 'Label', typeName: 'string', group: 'General' })
];

const TEXT_INPUT_PRIORITY = ['General', 'Text Style', 'Dimensions'];

describe('SIG-001 — narrowing what the model said', () => {
  it('keeps the reasons the popup knows how to talk about', () => {
    expect(asRefusalReason('signal-rule')).toBe('signal-rule');
    expect(asRefusalReason('type-mismatch')).toBe('type-mismatch');
    expect(asRefusalReason('duplicate')).toBe('duplicate');
  });

  it('demotes anything else, including a subclass’s own reason', () => {
    // `WorkflowGraphModel` refuses three ways this popup has never heard of.
    // Rendering one of those as "4 signal inputs · a moment, not a value" would
    // be a confident sentence about the wrong thing.
    expect(asRefusalReason('would-create-a-cycle')).toBe('other');
    expect(asRefusalReason(undefined)).toBe('other');
    expect(asRefusalReason('')).toBe('other');
  });
});

describe('SIG-001 — which category was ruled out', () => {
  it('names the reason when every refused port shares one', () => {
    const refused = TEXT_INPUT_PORTS.filter((p) => p.disabled);
    expect(dominantReason(refused)).toBe('signal-rule');
    expect(dominantTypeName(refused)).toBe('signal');
  });

  it('refuses to name one when two reasons are mixed', () => {
    // A summary row that confidently names one of two reasons is worse than one
    // that names neither — the builder acts on it.
    const mixed = [
      port({ name: 'Do', typeName: 'signal', disabled: true, reason: 'signal-rule' }),
      port({ name: 'Text', typeName: 'string', disabled: true, reason: 'duplicate' })
    ];
    expect(dominantReason(mixed)).toBe('other');
    expect(dominantTypeName(mixed)).toBeUndefined();
  });

  it('treats an unattributed refusal as unattributed, not as the first reason seen', () => {
    expect(dominantReason([port({ name: 'X', disabled: true })])).toBe('other');
  });
});

describe('SIG-001 §5 — ranking the alternatives', () => {
  it('puts an exact type match first, then group priority', () => {
    const ranked = rankAlternatives('string', TEXT_INPUT_PORTS, TEXT_INPUT_PRIORITY);

    // `Text` and `Label` are both string+General; `Text` is declared first.
    expect(ranked.map((p) => p.name)).toEqual(['Text', 'Label', 'Placeholder', 'Width']);
  });

  /*
   * The defect this rank key exists for, measured live on 2026-08-11 before it
   * existed: a TextInput's `Text` output dragged at a Button offered **Variant**.
   * Both `variant` and `label` are `string`, so the exact-type key ties them, and
   * `Variant` sits in `General` (priority 0) against `Label` in `Label`
   * (priority 6). The stated rule picked it and the stated rule was wrong —
   * `groupPriority` orders the *display*, it does not rank likelihood.
   */
  it('prefers the port the node is about over the port that merely sorts first', () => {
    const BUTTON_PORTS: PlannablePort[] = [
      port({ name: 'variant', displayName: 'Variant', typeName: 'string', group: 'General' }),
      port({ name: 'label', displayName: 'Label', typeName: 'string', group: 'Label' })
    ];
    const BUTTON_PRIORITY = ['General', 'Style', 'Actions', 'Events', 'States', 'Mounted', 'Label'];

    expect(rankAlternatives('string', BUTTON_PORTS, BUTTON_PRIORITY)[0].name).toBe('variant');
    expect(rankAlternatives('string', BUTTON_PORTS, BUTTON_PRIORITY, 'label')[0].name).toBe('label');
  });

  it('does not let the primary port jump a type it cannot carry', () => {
    // ⚠️ A node being "about" its label is not a reason to hand a `color` output
    // to a `string` port. The primary key ranks below the exact-type key, and
    // this is the spec that keeps it there.
    const ports = [
      port({ name: 'label', displayName: 'Label', typeName: 'string', group: 'Label' }),
      port({ name: 'textColor', displayName: 'Color', typeName: 'color', group: 'Text Style' })
    ];
    expect(rankAlternatives('color', ports, [], 'label')[0].name).toBe('textColor');
  });

  it('never offers a port the popup already refused', () => {
    const ranked = rankAlternatives('string', TEXT_INPUT_PORTS, TEXT_INPUT_PRIORITY);
    expect(ranked.map((p) => p.name)).not.toContain('Do');
    expect(ranked.map((p) => p.name)).not.toContain('Clear');
  });

  it('sorts an unlisted group after every named one, and does not tie with the last', () => {
    // `Run On Value Change` is not in Text Input's `groupPriority` (the phase
    // found this in a source comment at `text-input.ts:45`), so it has to land
    // behind `Dimensions` — not alongside it.
    const ports = [
      port({ name: 'Enabled', typeName: 'boolean', group: 'Run On Value Change' }),
      port({ name: 'Width', typeName: 'number', group: 'Dimensions' })
    ];
    expect(rankAlternatives('string', ports, TEXT_INPUT_PRIORITY).map((p) => p.name)).toEqual(['Width', 'Enabled']);
  });

  it('sorts an ungrouped port with the other unlisted ones', () => {
    const ports = [
      port({ name: 'Loose', typeName: 'string' }),
      port({ name: 'Named', typeName: 'string', group: 'General' })
    ];
    expect(rankAlternatives('string', ports, ['General']).map((p) => p.name)).toEqual(['Named', 'Loose']);
    expect(rankAlternatives('string', ports, [OTHER_GROUP]).map((p) => p.name)).toEqual(['Loose', 'Named']);
  });

  it('is stable — declaration order breaks every remaining tie', () => {
    const ports = [port({ name: 'B' }), port({ name: 'A' }), port({ name: 'C' })];
    expect(rankAlternatives('string', ports, []).map((p) => p.name)).toEqual(['B', 'A', 'C']);
  });

  it('returns nothing when every port on the node was refused', () => {
    // ⚠️ The caller must then say so plainly and offer no redirect. An arbitrary
    // connection is worse than the silence this task is replacing.
    const allRefused = TEXT_INPUT_PORTS.map((p) => ({ ...p, disabled: true }));
    expect(rankAlternatives('string', allRefused, TEXT_INPUT_PRIORITY)).toEqual([]);
  });

  it('does not mutate the list it was given', () => {
    const before = TEXT_INPUT_PORTS.map((p) => p.name);
    rankAlternatives('string', TEXT_INPUT_PORTS, TEXT_INPUT_PRIORITY);
    expect(TEXT_INPUT_PORTS.map((p) => p.name)).toEqual(before);
  });
});

describe('SIG-001 §5 — when the offer may promise a wire', () => {
  const label = port({ name: 'label', displayName: 'Label', typeName: 'string', group: 'Label' });
  const variant = port({ name: 'variant', displayName: 'Variant', typeName: 'string', group: 'General' });
  const width = port({ name: 'width', displayName: 'Width', typeName: 'number', group: 'Dimensions' });

  it('is confident about the port the node declares itself to be about', () => {
    expect(isConfidentRedirect('string', [label, variant], 'label')).toBe(true);
  });

  it('is confident about a unique exact type match', () => {
    // Only one `number` input on the node, so "connect it to Width" is not a
    // guess even though nothing declares Width special.
    expect(isConfidentRedirect('number', [width, label], undefined)).toBe(true);
  });

  it('is NOT confident when the winner is only first among equals', () => {
    // Two string ports, neither declared primary: the ranking picked one on
    // display order, which is exactly the guess SIG-001 §5 forbids.
    expect(isConfidentRedirect('string', [variant, label], undefined)).toBe(false);
  });

  it('is not confident about nothing', () => {
    expect(isConfidentRedirect('string', [], 'label')).toBe(false);
  });

  it('does not become confident just because the primary port is somewhere in the list', () => {
    // `label` is present but did not win — promising it would connect a port the
    // ranking did not choose.
    expect(isConfidentRedirect('number', [variant, label], 'label')).toBe(false);
  });
});
