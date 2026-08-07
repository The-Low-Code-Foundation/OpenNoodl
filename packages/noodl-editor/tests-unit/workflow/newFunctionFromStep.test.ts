/**
 * CWF-004 S6 — the plan behind "New function from this step".
 *
 * In `tests-unit/` rather than the jasmine suite for the reason ERG-005's specs
 * are: the module under test imports only `workflowPorts`, which imports
 * nothing, so the half of this gesture that holds the decisions runs on every
 * `test:main` instead of only when someone can spare the Electron editor. The
 * document half — creating the component, retargeting the step, descending —
 * needs `ProjectModel` and lives in `tests/workflow/newfunctionfromstep.test.ts`.
 *
 * Each case is chosen to fail without the rule it covers.
 */

import {
  authorParamNames,
  declareRequestParams,
  functionNameFromLabel,
  isDeclarableParamName,
  isLegalFunctionName,
  planFunctionFromStep,
  REQUEST_NODE_TYPE,
  uniqueFunctionName
} from '../../src/editor/src/models/workflow/newFunctionFromStep';

describe('CWF-004 S6 — what a function may be called', () => {
  it('accepts the names cloud functions in this repo actually have', () => {
    expect(isLegalFunctionName('saveOrder')).toBe(true);
    expect(isLegalFunctionName('charge_card')).toBe(true);
    expect(isLegalFunctionName('charge-card')).toBe(true);
    expect(isLegalFunctionName('_private')).toBe(true);
  });

  it('refuses what a URL path segment cannot carry', () => {
    // `POST /functions/<name>` is the other reader of this string.
    expect(isLegalFunctionName('charge card')).toBe(false);
    expect(isLegalFunctionName('orders/charge')).toBe(false);
    expect(isLegalFunctionName('charge?x=1')).toBe(false);
    expect(isLegalFunctionName('')).toBe(false);
    // A leading digit is legal in a URL and not in the lowerCamelCase every
    // function here uses; `functionNameFromLabel` rescues it rather than losing it.
    expect(isLegalFunctionName('3ds')).toBe(false);
  });

  it('derives lowerCamelCase from a human label', () => {
    expect(functionNameFromLabel('Charge card')).toBe('chargeCard');
    expect(functionNameFromLabel('Save order')).toBe('saveOrder');
    expect(functionNameFromLabel('send the  supplier a receipt')).toBe('sendTheSupplierAReceipt');
    expect(functionNameFromLabel('charge/card')).toBe('chargeCard');
  });

  it('prefixes rather than drops a name that would start with a digit', () => {
    expect(functionNameFromLabel('3ds check')).toBe('f3dsCheck');
    expect(isLegalFunctionName(functionNameFromLabel('3ds check'))).toBe(true);
  });

  it('answers nothing for text with nothing usable in it, so the caller can fall back', () => {
    expect(functionNameFromLabel('***')).toBe('');
    expect(functionNameFromLabel('')).toBe('');
  });

  it('numbers a collision the way step ids are numbered', () => {
    expect(uniqueFunctionName('chargeCard', [])).toBe('chargeCard');
    expect(uniqueFunctionName('chargeCard', ['chargeCard'])).toBe('chargeCard2');
    expect(uniqueFunctionName('chargeCard', ['chargeCard', 'chargeCard2'])).toBe('chargeCard3');
  });
});

describe('CWF-004 S6 — which params the new function declares', () => {
  it('takes the author-named params and none of the kind’s own knobs', () => {
    const names = authorParamNames(
      { ref: 'chargeCard', maxAttempts: 3, amount: { $path: 'previous.result.total' }, currency: 'GBP' },
      ['maxAttempts', 'delayMs']
    );
    // `ref` is a step FIELD; `maxAttempts` is declared by the kind (CWF-005).
    // What is left is exactly what the engine merges into the request body.
    expect(names).toEqual(['amount', 'currency']);
  });

  it('never takes the synthetic mapping port, which stores no value of its own', () => {
    expect(authorParamNames({ __paramMapping__: {}, amount: 1 }, [])).toEqual(['amount']);
  });

  it('skips a param whose value was cleared rather than declaring a phantom', () => {
    expect(authorParamNames({ amount: undefined, currency: 'GBP' }, [])).toEqual(['currency']);
  });

  it('refuses to declare a name the comma-separated list cannot carry', () => {
    // CWF-014's `paramNames` splits on ',' and does not trim; the editor's
    // `namedports/list` rule does the same. A key with a comma in it would mint
    // two ports named after halves of one key.
    expect(isDeclarableParamName('amount')).toBe(true);
    expect(isDeclarableParamName('a,b')).toBe(false);
    expect(isDeclarableParamName(' amount')).toBe(false);
    expect(isDeclarableParamName('amount ')).toBe(false);
  });
});

describe('CWF-004 S6 — the plan', () => {
  const args = { declared: [], existing: [] as string[] };

  it('creates the function the step is already asking for, unmodified', () => {
    const plan = planFunctionFromStep({ id: 'charge', label: 'Charge card', ref: 'chargeCard' }, args);

    expect(plan.name).toBe('chargeCard');
    // Nothing is rewritten: the step keeps the name the author typed, which is
    // what makes this a one-gesture fix for the commonest broken step there is.
    expect(plan.retargets).toBe(false);
  });

  it('declares the step’s params on the new function, which is the point of the gesture', () => {
    const plan = planFunctionFromStep(
      {
        id: 'charge',
        label: 'Charge card',
        ref: 'chargeCard',
        parameters: { ref: 'chargeCard', amount: { $path: 'previous.result.total' }, currency: 'GBP' }
      },
      args
    );

    expect(plan.paramNames).toEqual(['amount', 'currency']);
    // Comma-joined and NEVER spaced: neither the runtime nor the editor trims,
    // so `"amount, currency"` would declare a parameter called " currency".
    expect(plan.params).toBe('amount,currency');
  });

  it('names an unnamed step’s function from its label, and says it retargeted', () => {
    const plan = planFunctionFromStep({ id: 'callfunction', label: 'Charge the card' }, args);

    expect(plan.name).toBe('chargeTheCard');
    expect(plan.retargets).toBe(true);
  });

  it('falls back to the step id when a step has no label worth using', () => {
    expect(planFunctionFromStep({ id: 'callfunction2', label: '***' }, args).name).toBe('callfunction2');
  });

  it('turns an illegal ref into a legal name rather than refusing the gesture', () => {
    const plan = planFunctionFromStep({ id: 'charge', label: 'Charge', ref: 'charge card' }, args);

    expect(plan.name).toBe('chargeCard');
    // The step is pointed at what was actually created — the alternative is a
    // gesture that creates a function the step still does not call.
    expect(plan.retargets).toBe(true);
  });

  it('never mints a name the project already has', () => {
    const plan = planFunctionFromStep(
      { id: 'charge', label: 'Charge card', ref: 'chargeCard' },
      { declared: [], existing: ['chargeCard'] }
    );

    expect(plan.name).toBe('chargeCard2');
    expect(plan.retargets).toBe(true);
  });

  it('reports the params it could not declare instead of dropping them silently', () => {
    const plan = planFunctionFromStep(
      { id: 'charge', ref: 'chargeCard', parameters: { amount: 1, 'a,b': 2 } },
      args
    );

    expect(plan.paramNames).toEqual(['amount']);
    expect(plan.undeclarable).toEqual(['a,b']);
  });

  it('is total: a step with nothing on it still plans a one-node function', () => {
    const plan = planFunctionFromStep({ id: 'callfunction', label: '' }, args);

    expect(plan.name).toBe('callfunction');
    expect(plan.params).toBe('');
    expect(plan.paramNames).toEqual([]);
  });
});

describe('CWF-004 S6 — declaring the contract on the new function', () => {
  /** The shipped `CloudFunctionComponentTemplate`: a Request node and a Response node. */
  function graph(nodes: { typename: string; parameters?: Record<string, unknown> }[]) {
    return {
      nodes,
      forEachNode(callback: (node: { typename?: string; parameters?: Record<string, unknown> }) => void) {
        nodes.forEach(callback);
      }
    };
  }

  it('writes the contract onto the Request node and nothing else', () => {
    const g = graph([{ typename: 'noodl.cloud.request' }, { typename: 'noodl.cloud.response' }]);

    expect(declareRequestParams(g, 'amount,currency')).toBe(1);
    expect(g.nodes[0].parameters).toEqual({ params: 'amount,currency' });
    // The Response node has its own contract question (F27) and this is not it.
    expect(g.nodes[1].parameters).toBeUndefined();
  });

  it('keeps whatever the template already put on the node', () => {
    const g = graph([{ typename: REQUEST_NODE_TYPE, parameters: { allowNoAuth: true } }]);

    declareRequestParams(g, 'amount');
    expect(g.nodes[0].parameters).toEqual({ allowNoAuth: true, params: 'amount' });
  });

  it('answers 0 when there is no Request node, so a caller can tell it wrote nothing', () => {
    expect(declareRequestParams(graph([{ typename: 'noodl.cloud.response' }]), 'amount')).toBe(0);
  });
});
