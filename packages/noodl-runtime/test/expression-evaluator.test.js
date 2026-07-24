const ExpressionEvaluator = require('../src/expression-evaluator');
const Model = require('../src/model');

describe('Expression Evaluator', () => {
  beforeEach(() => {
    // Reset Model state before each test
    Model._models = {};
    // Ensure global variables model exists
    Model.get('--ndl--global-variables');
    ExpressionEvaluator.clearCache();
  });

  describe('detectDependencies', () => {
    it('detects Noodl.Variables references', () => {
      const deps = ExpressionEvaluator.detectDependencies(
        'Noodl.Variables.isLoggedIn ? Noodl.Variables.userName : "guest"'
      );
      expect(deps.variables).toContain('isLoggedIn');
      expect(deps.variables).toContain('userName');
      expect(deps.variables.length).toBe(2);
    });

    it('detects Variables shorthand references', () => {
      const deps = ExpressionEvaluator.detectDependencies('Variables.count + Variables.offset');
      expect(deps.variables).toContain('count');
      expect(deps.variables).toContain('offset');
    });

    it('detects bracket notation', () => {
      const deps = ExpressionEvaluator.detectDependencies('Noodl.Variables["my variable"]');
      expect(deps.variables).toContain('my variable');
    });

    it('ignores references inside strings', () => {
      const deps = ExpressionEvaluator.detectDependencies('"Noodl.Variables.notReal"');
      expect(deps.variables).toHaveLength(0);
    });

    it('detects Noodl.Objects references', () => {
      const deps = ExpressionEvaluator.detectDependencies('Noodl.Objects.CurrentUser.name');
      expect(deps.objects).toContain('CurrentUser');
    });

    it('detects Objects shorthand references', () => {
      const deps = ExpressionEvaluator.detectDependencies('Objects.User.id');
      expect(deps.objects).toContain('User');
    });

    it('detects Noodl.Arrays references', () => {
      const deps = ExpressionEvaluator.detectDependencies('Noodl.Arrays.items.length');
      expect(deps.arrays).toContain('items');
    });

    it('detects Arrays shorthand references', () => {
      const deps = ExpressionEvaluator.detectDependencies('Arrays.todos.filter(x => x.done)');
      expect(deps.arrays).toContain('todos');
    });

    it('handles mixed dependencies', () => {
      const deps = ExpressionEvaluator.detectDependencies(
        'Variables.isAdmin && Objects.User.role === "admin" ? Arrays.items.length : 0'
      );
      expect(deps.variables).toContain('isAdmin');
      expect(deps.objects).toContain('User');
      expect(deps.arrays).toContain('items');
    });

    it('handles template literals', () => {
      const deps = ExpressionEvaluator.detectDependencies('`Hello, ${Variables.userName}!`');
      expect(deps.variables).toContain('userName');
    });
  });

  describe('compileExpression', () => {
    it('compiles valid expression', () => {
      const fn = ExpressionEvaluator.compileExpression('1 + 1');
      expect(fn).not.toBeNull();
      expect(typeof fn).toBe('function');
    });

    it('returns null for invalid expression', () => {
      const fn = ExpressionEvaluator.compileExpression('1 +');
      expect(fn).toBeNull();
    });

    it('caches compiled functions', () => {
      const fn1 = ExpressionEvaluator.compileExpression('2 + 2');
      const fn2 = ExpressionEvaluator.compileExpression('2 + 2');
      expect(fn1).toBe(fn2);
    });

    it('different expressions compile separately', () => {
      const fn1 = ExpressionEvaluator.compileExpression('1 + 1');
      const fn2 = ExpressionEvaluator.compileExpression('2 + 2');
      expect(fn1).not.toBe(fn2);
    });
  });

  describe('validateExpression', () => {
    it('validates correct syntax', () => {
      const result = ExpressionEvaluator.validateExpression('a > b ? 1 : 0');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('catches syntax errors', () => {
      const result = ExpressionEvaluator.validateExpression('a >');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('validates complex expressions', () => {
      const result = ExpressionEvaluator.validateExpression('Variables.count > 10 ? "many" : "few"');
      expect(result.valid).toBe(true);
    });
  });

  describe('evaluateExpression', () => {
    it('evaluates simple math expressions', () => {
      const fn = ExpressionEvaluator.compileExpression('5 + 3');
      const result = ExpressionEvaluator.evaluateExpression(fn);
      expect(result).toBe(8);
    });

    it('evaluates with min/max helpers', () => {
      const fn = ExpressionEvaluator.compileExpression('min(10, 5) + max(1, 2)');
      const result = ExpressionEvaluator.evaluateExpression(fn);
      expect(result).toBe(7);
    });

    it('evaluates with pi constant', () => {
      const fn = ExpressionEvaluator.compileExpression('round(pi * 100) / 100');
      const result = ExpressionEvaluator.evaluateExpression(fn);
      expect(result).toBe(3.14);
    });

    it('evaluates with pow helper', () => {
      const fn = ExpressionEvaluator.compileExpression('pow(2, 3)');
      const result = ExpressionEvaluator.evaluateExpression(fn);
      expect(result).toBe(8);
    });

    it('returns undefined for null function', () => {
      const result = ExpressionEvaluator.evaluateExpression(null);
      expect(result).toBeUndefined();
    });

    it('evaluates with Noodl.Variables', () => {
      const varsModel = Model.get('--ndl--global-variables');
      varsModel.set('testVar', 42);

      const fn = ExpressionEvaluator.compileExpression('Variables.testVar * 2');
      const result = ExpressionEvaluator.evaluateExpression(fn);
      expect(result).toBe(84);
    });

    it('evaluates with Noodl.Objects', () => {
      const userModel = Model.get('CurrentUser');
      userModel.set('name', 'Alice');

      const fn = ExpressionEvaluator.compileExpression('Objects.CurrentUser.name');
      const result = ExpressionEvaluator.evaluateExpression(fn);
      expect(result).toBe('Alice');
    });

    it('handles undefined Variables gracefully', () => {
      const fn = ExpressionEvaluator.compileExpression('Variables.nonExistent || "default"');
      const result = ExpressionEvaluator.evaluateExpression(fn);
      expect(result).toBe('default');
    });

    it('evaluates ternary expressions', () => {
      const varsModel = Model.get('--ndl--global-variables');
      varsModel.set('isAdmin', true);

      const fn = ExpressionEvaluator.compileExpression('Variables.isAdmin ? "Admin" : "User"');
      const result = ExpressionEvaluator.evaluateExpression(fn);
      expect(result).toBe('Admin');
    });

    it('evaluates template literals', () => {
      const varsModel = Model.get('--ndl--global-variables');
      varsModel.set('name', 'Bob');

      const fn = ExpressionEvaluator.compileExpression('`Hello, ${Variables.name}!`');
      const result = ExpressionEvaluator.evaluateExpression(fn);
      expect(result).toBe('Hello, Bob!');
    });
  });

  describe('subscribeToChanges', () => {
    it('calls callback when Variable changes', (done) => {
      const varsModel = Model.get('--ndl--global-variables');
      varsModel.set('counter', 0);

      const deps = { variables: ['counter'], objects: [], arrays: [] };
      const unsub = ExpressionEvaluator.subscribeToChanges(deps, () => {
        unsub();
        done();
      });

      varsModel.set('counter', 1);
    });

    it('calls callback when Object changes', (done) => {
      const userModel = Model.get('TestUser');
      userModel.set('name', 'Initial');

      const deps = { variables: [], objects: ['TestUser'], arrays: [] };
      const unsub = ExpressionEvaluator.subscribeToChanges(deps, () => {
        unsub();
        done();
      });

      userModel.set('name', 'Changed');
    });

    it('does not call callback for unrelated Variable changes', () => {
      const varsModel = Model.get('--ndl--global-variables');
      let called = false;

      const deps = { variables: ['watchThis'], objects: [], arrays: [] };
      const unsub = ExpressionEvaluator.subscribeToChanges(deps, () => {
        called = true;
      });

      varsModel.set('notWatching', 'value');

      setTimeout(() => {
        expect(called).toBe(false);
        unsub();
      }, 50);
    });

    it('unsubscribe prevents future callbacks', () => {
      const varsModel = Model.get('--ndl--global-variables');
      let callCount = 0;

      const deps = { variables: ['test'], objects: [], arrays: [] };
      const unsub = ExpressionEvaluator.subscribeToChanges(deps, () => {
        callCount++;
      });

      varsModel.set('test', 1);
      unsub();
      varsModel.set('test', 2);

      setTimeout(() => {
        expect(callCount).toBe(1);
      }, 50);
    });

    it('handles multiple dependencies', (done) => {
      const varsModel = Model.get('--ndl--global-variables');
      const userModel = Model.get('User');
      let callCount = 0;

      const deps = { variables: ['count'], objects: ['User'], arrays: [] };
      const unsub = ExpressionEvaluator.subscribeToChanges(deps, () => {
        callCount++;
        if (callCount === 2) {
          unsub();
          done();
        }
      });

      varsModel.set('count', 1);
      userModel.set('name', 'Test');
    });
  });

  describe('createNoodlContext', () => {
    it('creates context with Variables', () => {
      const varsModel = Model.get('--ndl--global-variables');
      varsModel.set('test', 123);

      const context = ExpressionEvaluator.createNoodlContext();
      expect(context.Variables.test).toBe(123);
    });

    it('creates context with Objects proxy', () => {
      const userModel = Model.get('TestUser');
      userModel.set('id', 'user-1');

      const context = ExpressionEvaluator.createNoodlContext();
      expect(context.Objects.TestUser.id).toBe('user-1');
    });

    it('auto-creates non-existent Objects, matching Model.get semantics', () => {
      // Model.get creates on first access — Noodl.Objects.Anything is always a
      // model, never undefined. That is the platform's documented behaviour
      // (Model.exists is the existence check); an earlier version of this test
      // expected undefined, which the API never produced.
      const context = ExpressionEvaluator.createNoodlContext();
      expect(context.Objects.NonExistentForThisTest).toEqual({});
    });

    it('handles empty Variables', () => {
      const context = ExpressionEvaluator.createNoodlContext();
      expect(context.Variables).toBeDefined();
      expect(typeof context.Variables).toBe('object');
    });
  });

  describe('getExpressionVersion', () => {
    it('returns a number', () => {
      const version = ExpressionEvaluator.getExpressionVersion();
      expect(typeof version).toBe('number');
    });

    it('returns consistent version', () => {
      const v1 = ExpressionEvaluator.getExpressionVersion();
      const v2 = ExpressionEvaluator.getExpressionVersion();
      expect(v1).toBe(v2);
    });
  });

  describe('clearCache', () => {
    it('clears compiled functions cache', () => {
      const fn1 = ExpressionEvaluator.compileExpression('1 + 1');
      ExpressionEvaluator.clearCache();
      const fn2 = ExpressionEvaluator.compileExpression('1 + 1');
      expect(fn1).not.toBe(fn2);
    });
  });

  describe('Integration tests', () => {
    it('full workflow: compile, evaluate, subscribe', (done) => {
      const varsModel = Model.get('--ndl--global-variables');
      varsModel.set('counter', 0);

      const expression = 'Variables.counter * 2';
      const deps = ExpressionEvaluator.detectDependencies(expression);
      const compiled = ExpressionEvaluator.compileExpression(expression);

      let result = ExpressionEvaluator.evaluateExpression(compiled);
      expect(result).toBe(0);

      const unsub = ExpressionEvaluator.subscribeToChanges(deps, () => {
        result = ExpressionEvaluator.evaluateExpression(compiled);
        expect(result).toBe(10);
        unsub();
        done();
      });

      varsModel.set('counter', 5);
    });

    it('complex expression with multiple operations', () => {
      const varsModel = Model.get('--ndl--global-variables');
      varsModel.set('a', 10);
      varsModel.set('b', 5);

      const expression = 'min(Variables.a, Variables.b) + max(Variables.a, Variables.b)';
      const compiled = ExpressionEvaluator.compileExpression(expression);
      const result = ExpressionEvaluator.evaluateExpression(compiled);

      expect(result).toBe(15); // min(10, 5) + max(10, 5) = 5 + 10
    });
  });
});
