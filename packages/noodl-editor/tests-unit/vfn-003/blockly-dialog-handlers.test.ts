/**
 * VFN-003 — the dialog Electron does not have.
 *
 * > *"Clicking 'create variable' does nothing."*
 *
 * `Blockly.Variables.createVariableButtonHandler` asks for a name through `Blockly.dialog.prompt`,
 * and nothing here ever replaced the default — which is the only `window.prompt` in the bundle,
 * and **Electron renderers do not implement it**. The registered functions are plain callbacks,
 * so the contract they have to keep can be asserted directly, without a renderer.
 *
 * 🔴 The three the contract will not forgive are each a test below: `null` and not `''` on
 * cancel; exactly once; and an alert whose callback actually fires, because Blockly re-opens the
 * prompt from inside it when a name is taken.
 */
import {
  createBlocklyDialogHandlers,
  type BlocklyAlertRequest,
  type BlocklyConfirmRequest,
  type BlocklyDialogSurface,
  type BlocklyPromptRequest
} from '../../src/editor/src/views/BlocklyEditor/blocklyDialogHandlers';

/** A surface that draws nothing and remembers what it was asked to draw. */
function recordingSurface() {
  const prompts: BlocklyPromptRequest[] = [];
  const confirms: BlocklyConfirmRequest[] = [];
  const alerts: BlocklyAlertRequest[] = [];

  const surface: BlocklyDialogSurface = {
    showPrompt: (request) => prompts.push(request),
    showConfirm: (request) => confirms.push(request),
    showAlert: (request) => alerts.push(request)
  };

  return { surface, prompts, confirms, alerts, handlers: createBlocklyDialogHandlers(surface) };
}

describe('VFN-003 — the callback contract Blockly is written against', () => {
  describe('prompt', () => {
    it('shows the message and the default value it was given', () => {
      const { handlers, prompts } = recordingSurface();

      handlers.prompt('New variable name:', 'count', () => undefined);

      expect(prompts.length).toBe(1);
      expect(prompts[0].message).toBe('New variable name:');
      expect(prompts[0].defaultValue).toBe('count');
    });

    it('answers with the trimmed name when the user accepts', () => {
      const { handlers, prompts } = recordingSurface();
      const answers: (string | null)[] = [];

      handlers.prompt('New variable name:', '', (result) => answers.push(result));
      prompts[0].onAccept('  total  ');

      expect(answers).toEqual(['total']);
    });

    it('🔴 answers null on cancel, never the empty string', () => {
      // Blockly reads `null` as "the user backed out" and a string as a name they chose. `''`
      // creates a variable with no name — the same `undefined` ≠ `''` distinction the code
      // generation seam learned the expensive way, in a different costume.
      const { handlers, prompts } = recordingSurface();
      const answers: (string | null)[] = [];

      handlers.prompt('New variable name:', '', (result) => answers.push(result));
      prompts[0].onCancel();

      expect(answers).toEqual([null]);
      expect(answers[0]).not.toBe('');
    });

    it('🔴 answers exactly once, however many ways out the dialog has', () => {
      // A dialog that fires `onAccept` and then an `onClose` on the way out is the ordinary
      // shape of this mistake, and two answers create two variables.
      const { handlers, prompts } = recordingSurface();
      const answers: (string | null)[] = [];

      handlers.prompt('New variable name:', '', (result) => answers.push(result));
      prompts[0].onAccept('total');
      prompts[0].onCancel();
      prompts[0].onAccept('total again');

      expect(answers).toEqual(['total']);
    });

    it('treats a missing default value as empty rather than as undefined', () => {
      const { handlers, prompts } = recordingSurface();

      handlers.prompt('New variable name:', undefined as unknown as string, () => undefined);

      expect(prompts[0].defaultValue).toBe('');
    });
  });

  describe('confirm', () => {
    it('answers true on confirm and false on abort, once each', () => {
      const { handlers, confirms } = recordingSurface();

      const yes: boolean[] = [];
      handlers.confirm('Delete 3 uses of the "count" variable?', (result) => yes.push(result));
      confirms[0].onConfirm();
      confirms[0].onAbort();
      expect(yes).toEqual([true]);

      const no: boolean[] = [];
      handlers.confirm('Delete 3 uses of the "count" variable?', (result) => no.push(result));
      confirms[1].onAbort();
      confirms[1].onConfirm();
      expect(no).toEqual([false]);
    });
  });

  describe('alert', () => {
    it('🔴 calls back when dismissed — this is what re-opens the prompt', () => {
      // `createVariableButtonHandler` re-opens the prompt *from inside* this callback when the
      // name is already taken. An alert that dismisses without calling back does not skip a
      // message; it ends the gesture, silently, which is this task's whole defect.
      const { handlers, alerts } = recordingSurface();
      let dismissed = 0;

      handlers.alert('A variable named "count" already exists.', () => (dismissed += 1));
      alerts[0].onDismiss();

      expect(alerts[0].message).toBe('A variable named "count" already exists.');
      expect(dismissed).toBe(1);
    });

    it('calls back at most once', () => {
      const { handlers, alerts } = recordingSurface();
      let dismissed = 0;

      handlers.alert('A variable named "count" already exists.', () => (dismissed += 1));
      alerts[0].onDismiss();
      alerts[0].onDismiss();

      expect(dismissed).toBe(1);
    });

    it('survives being called with no callback at all', () => {
      // The callback is optional in Blockly's type even though the paths that matter pass one.
      const { handlers, alerts } = recordingSurface();

      handlers.alert('Something happened.');
      expect(() => alerts[0].onDismiss()).not.toThrow();
    });
  });

  /**
   * The whole gesture, as Blockly runs it: prompt → name taken → alert → re-prompt → accepted.
   *
   * This is the sequence the report's button is at the start of, and every one of the three
   * rules above is load-bearing in it.
   */
  it('completes the create-a-variable gesture, including the refusal in the middle', () => {
    const { handlers, prompts, alerts } = recordingSurface();
    const created: (string | null)[] = [];

    // Blockly's own handler, in miniature.
    const taken = new Set(['count']);
    function createVariable() {
      handlers.prompt('New variable name:', '', (name) => {
        if (!name) {
          created.push(null);
          return;
        }
        if (taken.has(name)) {
          handlers.alert(`A variable named "${name}" already exists.`, () => createVariable());
          return;
        }
        taken.add(name);
        created.push(name);
      });
    }

    createVariable();
    prompts[0].onAccept('count'); // taken
    expect(alerts.length).toBe(1);
    expect(created).toEqual([]);

    alerts[0].onDismiss(); // re-opens the prompt
    expect(prompts.length).toBe(2);

    prompts[1].onAccept('total');
    expect(created).toEqual(['total']);
    expect(taken.has('total')).toBe(true);
  });
});
