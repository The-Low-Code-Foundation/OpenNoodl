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
  rankAlternatives,
  refusalHeadlineFor
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

/**
 * SIG-001 §4 — 🔴 THE HEADLINE THAT REACHED NOBODY FOR A WHOLE PHASE.
 *
 * `refusalHeadline` was written with four branches and a spec file, and had **no caller in
 * `src/`**: `ConnectionBar` never derived it and `DocsPopup` never rendered it, so a refused row
 * said only `getConnectionStatus`'s sentence — *"Type mismatch a source port of type string
 * cannot be connected to a target port with type signal"* — to every beginner who met one.
 *
 * That is the third piece of this UI found built-but-unreachable, and the previous two were
 * caught the same way: something only a running editor could reach. So the derivation is a
 * function here, and these rows are what would go red if the wiring were pulled out again.
 *
 * ⚠️ **What these rows cannot prove.** They grade the *decision*, not the pixels. There is no
 * jsdom in this project (`testEnvironment: 'node'`), so nothing here renders `DocsPopup` and
 * nothing here proves the headline is on screen, above the detail, and legible. That needs a
 * drive.
 */
describe('SIG-001 §4 — the refusal headline, as ConnectionBar derives it', () => {
  const signalInput = port({ name: 'Do', typeName: 'signal', disabled: true, reason: 'signal-rule' });

  it('🔴 says nothing at all about a port that refused nothing', () => {
    // The guard that keeps every enabled row free of a refusal sentence. Without it the popup
    // would explain a refusal that did not happen on all ~90 connectable ports of a Text Input.
    expect(refusalHeadlineFor(port({ name: 'text', typeName: 'string' }), 'string')).toBeUndefined();
    // Explicitly false, not merely absent — `disabled` is written by three separate passes.
    expect(refusalHeadlineFor(port({ name: 'text', typeName: 'string', disabled: false }), 'string')).toBeUndefined();
  });

  it('leads with the signal rule when a value is dragged at a signal input', () => {
    expect(refusalHeadlineFor(signalInput, 'string')).toBe('Signal inputs are moments, not values.');
  });

  it('names both types when one value type cannot drive another', () => {
    const headline = refusalHeadlineFor(
      port({ name: 'width', typeName: 'number', disabled: true, reason: 'type-mismatch' }),
      'string'
    );
    // ⚠️ Asserted as a whole string rather than by `toContain`, which would pass on a sentence
    // that named the two types in the wrong order — the one detail that makes it wrong advice.
    expect(headline).toBe('A <strong>string</strong> output cannot drive a <strong>number</strong> input.');
  });

  it('🔴 says switched-off, not refused, for a gated port — with no wire in flight at all', () => {
    // The case that has no `sourceTypeName` to give: a gated port is inert because of the node's
    // own settings, and `ConnectionBar` marks it outside the drag guard. A headline that needed
    // the source type would be empty or wrong here, which is FB-021's whole subject.
    const gated = port({ name: 'contentSize', typeName: 'string', disabled: true, reason: 'gated' });
    expect(refusalHeadlineFor(gated, undefined)).toBe('This port is switched off by another setting.');
    // And it does not mistakenly claim a type problem.
    expect(refusalHeadlineFor(gated, undefined)).not.toMatch(/cannot drive/);
  });

  it('🔴 does not print an empty type name when there is no source port', () => {
    /*
     * A refused port with no drag in flight should not be reachable, and this row exists because
     * "should not be reachable" is an argument, not a guarantee. The first draft passed `''` for
     * the missing source type and this assertion caught it rendering *"A <strong></strong>
     * output cannot drive a number input"* — a sentence with a hole where its subject goes.
     *
     * ✅ The answer is the category-free refusal, not a malformed one and not silence: the row
     * is still inert and still has to say so.
     */
    const orphan = port({ name: 'width', typeName: 'number', disabled: true, reason: 'type-mismatch' });
    const headline = refusalHeadlineFor(orphan, undefined);
    expect(headline).not.toMatch(/<strong><\/strong>/);
    expect(headline).toBe("This wire can't reach this port.");
  });

  it('falls back to a category-free refusal rather than guessing one', () => {
    // `asRefusalReason` turns an unrecognised model reason into `'other'`; a port that somehow
    // carries none at all must land in the same place rather than throwing.
    const noReason = port({ name: 'width', typeName: 'number', disabled: true });
    expect(refusalHeadlineFor(noReason, 'string')).toBe(
      'A <strong>string</strong> output cannot drive a <strong>number</strong> input.'
    );
  });

  it('escapes a type name rather than letting it into the markup', () => {
    // The sentence is rendered with `dangerouslySetInnerHTML`, and a custom module names its own
    // port types — so this is the boundary, not a formality.
    const nasty = port({ name: 'x', typeName: '<img onerror=1>', disabled: true, reason: 'type-mismatch' });
    const headline = refusalHeadlineFor(nasty, 'string');
    expect(headline).toContain('&lt;img onerror=1&gt;');
    expect(headline).not.toContain('<img');
  });

  it('says already connected without reference to types', () => {
    const dup = port({ name: 'text', typeName: 'string', disabled: true, reason: 'duplicate' });
    expect(refusalHeadlineFor(dup, 'string')).toBe('Already connected.');
  });
});
