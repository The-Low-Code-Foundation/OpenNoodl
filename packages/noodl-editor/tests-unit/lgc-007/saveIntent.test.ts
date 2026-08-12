/**
 * LGC-007 §1 — what the save dialog says, graded as a decision rather than as copy.
 *
 * §1's argument is that Blockly's grammar already teaches value-versus-statement and we are not
 * to invent a visual language for it. That leaves the *words* as the only thing doing the
 * teaching, so the words are a module and the module has specs. A sentence living inside a JSX
 * literal is a sentence no runner can reach, and this directory already carries an entry about a
 * mockup not being a measurement.
 *
 * What is **not** graded here, and needs a drive: that the dialog renders these strings, that
 * the field autofocuses, and that the Save button is actually disabled. Those need a DOM and
 * this runner is `testEnvironment: 'node'`.
 */

import {
  checkBlockName,
  countSavedBlocks,
  describeShape,
  joinPhrases,
  MAX_BLOCK_NAME_LENGTH,
  normaliseBlockName
} from '../../src/editor/src/views/BlocklyEditor/myblocks/saveIntent';
import { inferSignature } from '../../src/editor/src/views/BlocklyEditor/myblocks/shape';
import { arithmetic, getInput, number, sendSignal, setOutput, workspace } from './fixtures';

describe('LGC-007 §1 — the name a saved block is given', () => {
  it('refuses an empty name, and refuses whitespace the same way', () => {
    expect(checkBlockName('').ok).toBe(false);
    expect(checkBlockName('   ').ok).toBe(false);
    // The refusal has to say what to do, not what went wrong.
    expect(checkBlockName('').message).toContain('Give it a name');
  });

  it('refuses a name too long to fit on the block, and says how long it is', () => {
    const tooLong = 'x'.repeat(MAX_BLOCK_NAME_LENGTH + 1);
    const verdict = checkBlockName(tooLong);

    expect(verdict.ok).toBe(false);
    expect(verdict.message).toContain(String(MAX_BLOCK_NAME_LENGTH + 1));
    // A name exactly at the limit is fine — the boundary is inclusive, and a spec that did not
    // say so would let the next edit move it by one without anything noticing.
    expect(checkBlockName('x'.repeat(MAX_BLOCK_NAME_LENGTH)).ok).toBe(true);
  });

  it('🔴 allows a duplicate name and warns, because identity is a uid and a name is display', () => {
    const verdict = checkBlockName('Half', [{ id: 'mb_1', name: 'Half' }]);

    // Refusing here would contradict the format's own first design property — a name collision
    // is cosmetic, an id collision is remappable — at the one moment a builder cannot see why.
    expect(verdict.ok).toBe(true);
    expect(verdict.isWarning).toBe(true);
    expect(verdict.message).toContain('Half');
  });

  it('matches a duplicate case-insensitively and ignores surrounding space', () => {
    expect(checkBlockName('  half ', [{ id: 'mb_1', name: 'Half' }]).isWarning).toBe(true);
  });

  it('does not collide a definition with itself when it is being re-saved', () => {
    const verdict = checkBlockName('Half', [{ id: 'mb_1', name: 'Half' }], 'mb_1');

    expect(verdict.ok).toBe(true);
    expect(verdict.isWarning).toBeUndefined();
  });

  it('stores the trimmed name', () => {
    expect(normaliseBlockName('  Half  ')).toBe('Half');
  });
});

describe('LGC-007 §1 — the shape, in the words a builder reads', () => {
  it('a pure expression is a value block, and the consequence is stated as something to try', () => {
    // `n ÷ 2` — one root, output plug, no signals.
    const signature = inferSignature(workspace(arithmetic('DIVIDE', getInput('n'), number(2))));
    expect(signature.shape).toBe('value');

    const description = describeShape(signature);
    expect(description.shapeName).toBe('a value block');
    // "value block" is the toolkit's word and teaches nothing on its own; this is the same fact
    // stated as an action, which is what §1 means by plain English.
    expect(description.consequence).toContain('drop it into a calculation');
    expect(description.reason).toBe('Because it produces one value and changes nothing.');
  });

  it('a group that sends a signal is a stacking block, and the reason names the signal', () => {
    const signature = inferSignature(workspace(sendSignal('done')));
    expect(signature.shape).toBe('statement');

    const description = describeShape(signature);
    expect(description.shapeName).toBe('a stacking block');
    expect(description.consequence).toContain('cannot be dropped inside a calculation');
    expect(description.reason).toContain('it sends or declares a signal');
  });

  it('names every reason when more than one applies, rather than picking a winner', () => {
    // Two separate stacks, one of which sends a signal: both are true and both are why.
    const signature = inferSignature(workspace(sendSignal('a'), setOutput('r', number(1))));

    const description = describeShape(signature);
    expect(description.reason).toContain('2 separate stacks');
    expect(description.reason).toContain('sends or declares a signal');
    expect(description.reason).toContain(' and ');
  });

  it('counts the sockets the call block will have, and names them', () => {
    // `? × ?` — both sockets open, so two parameters.
    const signature = inferSignature(workspace(arithmetic('MULTIPLY')));
    expect(signature.params).toHaveLength(2);

    expect(describeShape(signature).inputs).toBe('It will have 2 sockets: a and b.');
  });

  it('says so when there is nothing to fill in', () => {
    const signature = inferSignature(workspace(arithmetic('DIVIDE', getInput('n'), number(2))));

    expect(describeShape(signature).inputs).toBe('It has no sockets to fill in.');
  });

  it('says "one socket" rather than "1 sockets"', () => {
    const signature = inferSignature(workspace(arithmetic('MULTIPLY', undefined, number(2))));

    expect(describeShape(signature).inputs).toBe('It will have one socket: a.');
  });
});

describe('LGC-007 §1 — how many blocks the gesture takes', () => {
  it('counts everything inside and stacked below, because the click only names the top one', () => {
    // `set output r = n ÷ 2` then `send signal done`: 5 blocks, one right-click.
    const body = workspace(setOutput('r', arithmetic('DIVIDE', getInput('n'), number(2)), sendSignal('done')));

    expect(countSavedBlocks(body)).toBe(5);
  });

  it('does not count a shadow, which is a default value in a socket and not a block placed', () => {
    const body = {
      blocks: {
        languageVersion: 0,
        blocks: [{ type: 'math_arithmetic', fields: { OP: 'ADD' }, inputs: { A: { shadow: number(1) } } }]
      }
    };

    expect(countSavedBlocks(body as never)).toBe(1);
  });

  it('is 0 for nothing', () => {
    expect(countSavedBlocks(undefined)).toBe(0);
    expect(countSavedBlocks(workspace())).toBe(0);
  });
});

describe('joinPhrases', () => {
  it('joins one, two and three phrases the way a sentence does', () => {
    expect(joinPhrases(['a'])).toBe('a');
    expect(joinPhrases(['a', 'b'])).toBe('a and b');
    expect(joinPhrases(['a', 'b', 'c'])).toBe('a, b and c');
  });
});
