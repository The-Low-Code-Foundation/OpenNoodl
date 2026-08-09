/**
 * Node Expression Evaluation Tests
 *
 * Tests the integration of expression parameters with the Node base class.
 * Verifies that expressions are evaluated correctly and results are type-coerced.
 *
 * The runtime is framework-neutral and touches no DOM APIs, so these run in the
 * default node environment.
 */

/* eslint-env jest */

const Node = require('../src/node');
const Model = require('../src/model');

// Helper to create expression parameter
function createExpressionParameter(expression, fallback, version = 1) {
  return {
    mode: 'expression',
    expression,
    fallback,
    version
  };
}

describe('Node Expression Evaluation', () => {
  let mockContext;
  let node;

  beforeEach(() => {
    // Expressions read Variables from the global model store — the same
    // '--ndl--global-variables' model the Variable / Set Variable nodes and the
    // Noodl.Variables JS API write to. There is no context-level Variables API;
    // an earlier version of this suite mocked one and tested nothing real.
    delete Model._models['--ndl--global-variables'];
    const variables = Model.get('--ndl--global-variables');
    variables.set('x', 10);
    variables.set('count', 5);
    variables.set('isAdmin', true);
    variables.set('message', 'Hello');

    mockContext = {
      updateIteration: 0,
      nodeIsDirty: jest.fn(),
      styles: {
        resolveColor: jest.fn((color) => color)
      },
      editorConnection: {
        sendWarning: jest.fn(),
        clearWarning: jest.fn()
      },
      getDefaultValueForInput: jest.fn(() => undefined)
    };

    // Create a test node
    node = new Node(mockContext, 'test-node-1');
    node.name = 'TestNode';
    node.nodeScope = {
      componentOwner: { name: 'TestComponent' }
    };

    // Register test inputs with different types
    node.registerInputs({
      numberInput: {
        type: 'number',
        default: 0,
        set: jest.fn()
      },
      stringInput: {
        type: 'string',
        default: '',
        set: jest.fn()
      },
      booleanInput: {
        type: 'boolean',
        default: false,
        set: jest.fn()
      },
      colorInput: {
        type: 'color',
        default: '#000000',
        set: jest.fn()
      },
      anyInput: {
        type: undefined,
        default: null,
        set: jest.fn()
      }
    });
  });

  describe('_evaluateExpressionParameter', () => {
    describe('Basic evaluation', () => {
      it('returns simple values as-is', () => {
        expect(node._evaluateExpressionParameter(42, 'numberInput')).toBe(42);
        expect(node._evaluateExpressionParameter('hello', 'stringInput')).toBe('hello');
        expect(node._evaluateExpressionParameter(true, 'booleanInput')).toBe(true);
        expect(node._evaluateExpressionParameter(null, 'anyInput')).toBe(null);
        expect(node._evaluateExpressionParameter(undefined, 'anyInput')).toBe(undefined);
      });

      it('evaluates expression parameters', () => {
        const expr = createExpressionParameter('10 + 5', 0);
        const result = node._evaluateExpressionParameter(expr, 'numberInput');
        expect(result).toBe(15);
      });

      it('uses fallback on evaluation error', () => {
        const expr = createExpressionParameter('undefined.foo', 100);
        const result = node._evaluateExpressionParameter(expr, 'numberInput');
        expect(result).toBe(100);
      });

      it('uses fallback when no input definition exists', () => {
        const expr = createExpressionParameter('10 + 5', 999);
        const result = node._evaluateExpressionParameter(expr, 'nonexistentInput');
        expect(result).toBe(999);
      });

      it('coerces result to expected port type', () => {
        const expr = createExpressionParameter('"42"', 0); // String expression
        const result = node._evaluateExpressionParameter(expr, 'numberInput');
        expect(result).toBe(42); // Coerced to number
        expect(typeof result).toBe('number');
      });
    });

    describe('Type coercion integration', () => {
      it('coerces string expressions to numbers', () => {
        const expr = createExpressionParameter('"123"', 0);
        const result = node._evaluateExpressionParameter(expr, 'numberInput');
        expect(result).toBe(123);
      });

      it('coerces number expressions to strings', () => {
        const expr = createExpressionParameter('456', '');
        const result = node._evaluateExpressionParameter(expr, 'stringInput');
        expect(result).toBe('456');
        expect(typeof result).toBe('string');
      });

      it('coerces boolean expressions correctly', () => {
        const expr = createExpressionParameter('1', false);
        const result = node._evaluateExpressionParameter(expr, 'booleanInput');
        expect(result).toBe(true);
      });

      it('validates color expressions', () => {
        const expr = createExpressionParameter('"#ff0000"', '#000000');
        const result = node._evaluateExpressionParameter(expr, 'colorInput');
        expect(result).toBe('#ff0000');
      });

      it('uses fallback for invalid color expressions', () => {
        const expr = createExpressionParameter('"not-a-color"', '#000000');
        const result = node._evaluateExpressionParameter(expr, 'colorInput');
        expect(result).toBe('#000000');
      });
    });

    describe('Error handling', () => {
      it('handles syntax errors gracefully', () => {
        const expr = createExpressionParameter('10 +', 0);
        const result = node._evaluateExpressionParameter(expr, 'numberInput');
        expect(result).toBe(0); // Fallback
      });

      it('handles reference errors gracefully', () => {
        const expr = createExpressionParameter('unknownVariable', 0);
        const result = node._evaluateExpressionParameter(expr, 'numberInput');
        expect(result).toBe(0); // Fallback
      });

      it('sends warning to editor on error', () => {
        const expr = createExpressionParameter('undefined.foo', 0);
        node._evaluateExpressionParameter(expr, 'numberInput');

        expect(mockContext.editorConnection.sendWarning).toHaveBeenCalledWith(
          'TestComponent',
          'test-node-1',
          'expression-error-numberInput',
          expect.objectContaining({
            showGlobally: true,
            message: expect.stringContaining('Expression error')
          })
        );
      });

      // This used to assert the clear on *every* successful evaluation, which the code did
      // do — and which `EditorConnection.clearWarning` then dropped, because `ActiveWarnings`
      // had no such warning recorded and returned false before reaching the wire. So the call
      // was never observable; what is observable is that a fixed expression stops warning.
      it('clears the warning when a failing expression starts evaluating', () => {
        node._evaluateExpressionParameter(createExpressionParameter('10 +', 0), 'numberInput');
        mockContext.editorConnection.clearWarning.mockClear();

        node._evaluateExpressionParameter(createExpressionParameter('10 + 5', 0), 'numberInput');

        expect(mockContext.editorConnection.clearWarning).toHaveBeenCalledWith(
          'TestComponent',
          'test-node-1',
          'expression-error-numberInput'
        );
      });

      // The node id outlives the node *instance*, so an error left raised by an unmounted
      // node had nothing left to clear it and sat in the Problems panel indefinitely.
      it('clears the expression error when the node is deleted', () => {
        node._evaluateExpressionParameter(createExpressionParameter('undefined.foo', 0), 'numberInput');
        mockContext.editorConnection.clearWarning.mockClear();

        node._onNodeDeleted();

        expect(mockContext.editorConnection.clearWarning).toHaveBeenCalledWith(
          'TestComponent',
          'test-node-1',
          'expression-error-numberInput'
        );
      });

      // The reported bug: `fx` on a field that already holds prose turns that prose into
      // the expression, which of course does not parse — that error is correct. Turning
      // `fx` back off writes the literal back, and the literal is not JavaScript, so the
      // error describing it is no longer about anything. It used to survive anyway: the
      // early return for a non-expression value cleaned up the subscription and returned,
      // leaving `expression-error-<port>` raised. The node stayed dotted, and the Problems
      // panel kept quoting a syntax error for a field the author was typing plain text into.
      it('clears the expression error when the port goes back to a plain value', () => {
        node.setInputValue('stringInput', createExpressionParameter('Hello world', 'Hello world'));
        expect(mockContext.editorConnection.sendWarning).toHaveBeenCalledWith(
          'TestComponent',
          'test-node-1',
          'expression-error-stringInput',
          expect.anything()
        );

        mockContext.editorConnection.clearWarning.mockClear();
        node.setInputValue('stringInput', 'Hello world');

        expect(mockContext.editorConnection.clearWarning).toHaveBeenCalledWith(
          'TestComponent',
          'test-node-1',
          'expression-error-stringInput'
        );
      });

      // Same escape, different door: removing the parameter altogether resets the port to
      // its default, which arrives here as a plain value too.
      it('clears the expression error when the parameter is reset to its default', () => {
        node.setInputValue('numberInput', createExpressionParameter('10 +', 0));
        mockContext.editorConnection.clearWarning.mockClear();

        node.setInputValue('numberInput', 0);

        expect(mockContext.editorConnection.clearWarning).toHaveBeenCalledWith(
          'TestComponent',
          'test-node-1',
          'expression-error-numberInput'
        );
      });

      // The clear is not free — it is a WebSocket message and a Problems-panel re-render —
      // and every plain input set in the runtime passes through the same early return.
      it('does not clear anything for a port that never carried an expression', () => {
        node.setInputValue('stringInput', 'just text');

        expect(mockContext.editorConnection.clearWarning).not.toHaveBeenCalled();
      });
    });

    describe('Context integration', () => {
      it('has access to Variables', () => {
        const expr = createExpressionParameter('Variables.x * 2', 0);
        const result = node._evaluateExpressionParameter(expr, 'numberInput');
        expect(result).toBe(20); // Variables.x = 10, * 2 = 20
      });

      it('evaluates complex expressions with Variables', () => {
        const expr = createExpressionParameter('Variables.isAdmin ? "Admin" : "User"', 'User');
        const result = node._evaluateExpressionParameter(expr, 'stringInput');
        expect(result).toBe('Admin'); // Variables.isAdmin = true
      });

      it('handles arithmetic with Variables', () => {
        const expr = createExpressionParameter('Variables.count + Variables.x', 0);
        const result = node._evaluateExpressionParameter(expr, 'numberInput');
        expect(result).toBe(15); // 5 + 10 = 15
      });
    });

    describe('Edge cases', () => {
      it('handles undefined fallback', () => {
        const expr = createExpressionParameter('invalid syntax +', undefined);
        const result = node._evaluateExpressionParameter(expr, 'anyInput');
        expect(result).toBeUndefined();
      });

      it('handles null expression result', () => {
        // Policy (recorded by DEBT-003): a null result is treated as "no value"
        // and yields the fallback. Coercing null to the literal string "null",
        // as an earlier version of this test expected, was never the behaviour.
        const expr = createExpressionParameter('null', 'fallback');
        const result = node._evaluateExpressionParameter(expr, 'stringInput');
        expect(result).toBe('fallback');
      });

      it('handles complex object expressions', () => {
        // Expressions reach structured data through Noodl.Objects (the global
        // model store) — arbitrary context properties were never in scope.
        Model.get('ItemsHolder').set('items', [1, 2, 3]);
        const expr = createExpressionParameter('Objects.ItemsHolder.items.length', 0);
        const result = node._evaluateExpressionParameter(expr, 'numberInput');
        expect(result).toBe(3);
      });

      it('handles empty string expression', () => {
        const expr = createExpressionParameter('', 'fallback');
        const result = node._evaluateExpressionParameter(expr, 'stringInput');
        // Empty expression evaluates to undefined, uses fallback
        expect(result).toBe('fallback');
      });

      it('handles multi-line expressions', () => {
        const expr = createExpressionParameter(
          `Variables.x > 5 ? 
           "Greater" : 
           "Lesser"`,
          'Unknown'
        );
        const result = node._evaluateExpressionParameter(expr, 'stringInput');
        expect(result).toBe('Greater');
      });
    });
  });

  describe('setInputValue with expressions', () => {
    describe('Integration with input setters', () => {
      it('evaluates expressions before calling input setter', () => {
        const expr = createExpressionParameter('Variables.x * 2', 0);
        node.setInputValue('numberInput', expr);

        const input = node.getInput('numberInput');
        expect(input.set).toHaveBeenCalledWith(20); // Evaluated result
      });

      it('passes simple values directly to setter', () => {
        node.setInputValue('numberInput', 42);

        const input = node.getInput('numberInput');
        expect(input.set).toHaveBeenCalledWith(42);
      });

      it('stores evaluated value in _inputValues', () => {
        const expr = createExpressionParameter('Variables.count', 0);
        node.setInputValue('numberInput', expr);

        // _inputValues should store the expression, not the evaluated result
        // (This allows re-evaluation on context changes)
        expect(node._inputValues['numberInput']).toEqual(expr);
      });

      it('works with string input type', () => {
        const expr = createExpressionParameter('Variables.message', 'default');
        node.setInputValue('stringInput', expr);

        const input = node.getInput('stringInput');
        expect(input.set).toHaveBeenCalledWith('Hello');
      });

      it('works with boolean input type', () => {
        const expr = createExpressionParameter('Variables.isAdmin', false);
        node.setInputValue('booleanInput', expr);

        const input = node.getInput('booleanInput');
        expect(input.set).toHaveBeenCalledWith(true);
      });
    });

    describe('Maintains existing behavior', () => {
      it('maintains existing unit handling', () => {
        // Set initial value with unit
        node.setInputValue('numberInput', { value: 10, unit: 'px' });

        // Update with unitless value
        node.setInputValue('numberInput', 20);

        const input = node.getInput('numberInput');
        expect(input.set).toHaveBeenLastCalledWith({ value: 20, unit: 'px' });
      });

      it('maintains existing color resolution', () => {
        mockContext.styles.resolveColor = jest.fn((color) => '#resolved');

        node.setInputValue('colorInput', '#ff0000');

        const input = node.getInput('colorInput');
        expect(input.set).toHaveBeenCalledWith('#resolved');
      });

      it('handles non-existent input gracefully', () => {
        // Should not throw
        expect(() => {
          node.setInputValue('nonexistent', 42);
        }).not.toThrow();
      });
    });

    describe('Expression evaluation errors', () => {
      it('uses fallback when expression fails', () => {
        const expr = createExpressionParameter('undefined.prop', 999);
        node.setInputValue('numberInput', expr);

        const input = node.getInput('numberInput');
        expect(input.set).toHaveBeenCalledWith(999); // Fallback
      });

      it('sends warning on expression error', () => {
        const expr = createExpressionParameter('syntax error +', 0);
        node.setInputValue('numberInput', expr);

        expect(mockContext.editorConnection.sendWarning).toHaveBeenCalled();
      });
    });
  });
});
