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
    // Create mock context with Variables
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
      getDefaultValueForInput: jest.fn(() => undefined),
      Variables: {
        x: 10,
        count: 5,
        isAdmin: true,
        message: 'Hello'
      }
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

      it('clears warnings on successful evaluation', () => {
        const expr = createExpressionParameter('10 + 5', 0);
        node._evaluateExpressionParameter(expr, 'numberInput');

        expect(mockContext.editorConnection.clearWarning).toHaveBeenCalledWith(
          'TestComponent',
          'test-node-1',
          'expression-error-numberInput'
        );
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
        const expr = createExpressionParameter('null', 'fallback');
        const result = node._evaluateExpressionParameter(expr, 'stringInput');
        expect(result).toBe('null'); // Coerced to string
      });

      it('handles complex object expressions', () => {
        mockContext.data = { items: [1, 2, 3] };
        const expr = createExpressionParameter('data.items.length', 0);
        node.context = mockContext;
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
