// @ts-check
/**
 * THE CONTROL. Every mistake below is deliberate, and `fixtures.test.js` asserts
 * that each one is *reported*.
 *
 * Without this file, `kit-annotated`'s clean bill of health would mean nothing —
 * a `.d.ts` full of `any`, or one the compiler never resolved, produces exactly
 * the same silence as a correct one.
 *
 * ⚠️ **One fault per definition, deliberately.** TypeScript elaborates an object
 * literal's assignability failure and stops early, so a literal carrying three
 * mistakes reports two of them and the test that "passes" for the third is
 * passing on someone else's error. Measured while writing this file: a single
 * definition holding all five faults reported two.
 *
 * ⚠️ Do not "fix" these. They are the measurement.
 */
(function () {
  /** @type {import('../../../src/index').ReactNodeDefinition} */
  var missingName = {
    // `name` is required and absent.
    getReactComponent: function () {
      return 'span';
    }
  };

  /** @type {import('../../../src/index').ReactNodeDefinition} */
  var topLevelTypo = {
    name: 'broken.TopLevelTypo',
    getReactComponent: function () {
      return 'span';
    },
    // The field is `displayNodeName`. The runtime drops this one silently; the
    // published type omits the runtime's index signature so the compiler does
    // not. This is the mistake the whole package exists to catch.
    dispayNodeName: 'Chip'
  };

  /** @type {import('../../../src/index').ReactNodeDefinition} */
  var portTypo = {
    name: 'broken.PortTypo',
    getReactComponent: function () {
      return 'span';
    },
    inputProps: {
      label: { type: 'string', displayNam: 'Label' }
    }
  };

  /** @type {import('../../../src/index').ReactNodeDefinition} */
  var badPortType = {
    name: 'broken.BadPortType',
    getReactComponent: function () {
      return 'span';
    },
    inputProps: {
      // A port type is a name or a `{ name }` object, never a number.
      label: { type: 5 }
    }
  };

  /** @type {import('../../../src/index').ReactNodeDefinition} */
  var incompleteVisualState = {
    name: 'broken.IncompleteVisualState',
    getReactComponent: function () {
      return 'span';
    },
    // A visual state needs both `name` and `label`.
    visualStates: [{ name: 'hover' }]
  };

  Noodl.defineModule({
    reactNodes: [missingName, topLevelTypo, portTypo, badPortType, incompleteVisualState]
  });
})();
