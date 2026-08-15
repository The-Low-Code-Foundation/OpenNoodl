/**
 * FIX-002 — the composer you cannot type in.
 *
 * The acceptance for this task is a live drive: type 200 characters, watch the
 * caret stay visible, press Enter in both composers. None of that is reachable
 * from plain Node. What *is* checkable here — in the manner of
 * `leg-005/nodeCommentRow.test.ts` — is the structure that rots:
 *
 *   - The Explain follow-up field must be a `TextArea`, never again the
 *     `TextInput` whose resizable-input mechanism pushed the caret out of the
 *     clipped box past ~40 characters.
 *   - Explain must have a Send button (it had none — Enter was the only route).
 *   - Both AI composers bind `onEnter`, whose meaning after the 2026-08-14
 *     ruling is **plain Enter sends, Shift+Enter newlines** — asserted against
 *     the `noodl-core-ui` source this package actually compiles against,
 *     because `test:main` never runs core-ui's own suite and a silent revert
 *     there would otherwise leave every spec here green.
 *
 * @see dev-docs/tasks/phase-66-0.1.7-bug-fixes/FIX-002-THE-COMPOSER-YOU-CANNOT-TYPE-IN.md
 */

import * as fs from 'fs';
import * as path from 'path';

const EDITOR_SRC = path.resolve(__dirname, '..', '..', 'src', 'editor', 'src');
const CORE_UI_SRC = path.resolve(__dirname, '..', '..', '..', 'noodl-core-ui', 'src');

function read(root: string, ...segments: string[]): string {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

const EXPLAIN_PANEL = ['views', 'panels', 'ExplainPanel', 'ExplainPanel.tsx'];
const BUILD_THREAD = ['views', 'panels', 'AiAuthoringPanel', 'thread', 'BuildThread.tsx'];
const AI_CHAT = ['views', 'panels', 'propertyeditor', 'components', 'AiChat', 'AiChat.tsx'];
const TEXT_AREA = ['components', 'inputs', 'TextArea', 'TextArea.tsx'];
const TEXT_AREA_KEYS = ['components', 'inputs', 'TextArea', 'TextArea.keys.ts'];

describe('FIX-002 — the Explain composer', () => {
  const panel = read(EDITOR_SRC, ...EXPLAIN_PANEL);

  it('is a TextArea, and TextInput is gone from the panel entirely', () => {
    // The prose comment beside the composer is allowed to *name* TextInput
    // (it explains why it is gone); the import and the element are not.
    expect(panel).toContain('<TextArea');
    expect(panel).not.toContain('<TextInput');
    expect(panel).not.toMatch(/import \{[^}]*TextInput[^}]*\}/);
  });

  it('sends the follow-up on Enter', () => {
    expect(panel).toMatch(/onEnter=\{askFollowUp\}/);
  });

  it('has a Send button wired to the same submit as the key', () => {
    const composer = panel.slice(panel.indexOf('<TextArea'));
    expect(composer).toMatch(/label="Send"/);
    expect(composer).toMatch(/onClick=\{askFollowUp\}/);
  });

  it('disables the button under exactly the guard askFollowUp enforces', () => {
    // askFollowUp refuses on busy and on empty text; a button that looks
    // pressable while the handler refuses is BLD-001's defect reborn.
    expect(panel).toContain('isDisabled={Boolean(state.busy) || question.trim().length === 0}');
  });
});

describe('FIX-002 — both AI composers answer to the same key', () => {
  it('Build composer binds onEnter, guarded by the same condition as its button', () => {
    const thread = read(EDITOR_SRC, ...BUILD_THREAD);
    expect(thread).toMatch(/onEnter=\{\(\) => \{\s*if \(busy \|\| !canSend\) return;\s*onSend\(\);\s*\}\}/);
  });

  it('the function-node AiChat composer binds onEnter to its submit', () => {
    const chat = read(EDITOR_SRC, ...AI_CHAT);
    expect(chat).toMatch(/onEnter=\{handleSubmit\}/);
  });

  it('and onEnter means plain Enter — the core-ui source this package compiles against', () => {
    const textArea = read(CORE_UI_SRC, ...TEXT_AREA);
    const keys = read(CORE_UI_SRC, ...TEXT_AREA_KEYS);

    // The component delegates to the pure policy…
    expect(textArea).toContain('shouldSubmitOnKey(ev, Boolean(onEnter))');
    // …the old inverted condition is gone…
    expect(textArea).not.toMatch(/ev\.shiftKey\s*&&\s*ev\.key\s*===\s*'Enter'/);
    // …and the policy is Enter-without-Shift, with defaultPrevented honoured
    // first so BLD-016's menu can consume the keystroke.
    expect(keys).toContain("return ev.key === 'Enter' && !ev.shiftKey;");
    expect(keys).toContain('if (ev.defaultPrevented) return false;');
  });
});
