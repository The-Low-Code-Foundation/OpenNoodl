/**
 * WFA-006 — what a step's `ref` points at.
 *
 * The property these specs protect is that **"deployed" and "in the project"
 * are never collapsed into one boolean**, and that "the backend could not be
 * asked" is never reported as "it is not there". Both are load-bearing: the
 * push is hash-gated and on-save, so a backend legitimately lags the project,
 * and a wrong warning about a working step is worse than no warning at all
 * (WFA-005's `isTargetResolved` draws the same distinction for a trigger's
 * target, and F54 below is what happens when the reading of that list is wrong).
 *
 * Jasmine, not Jest — the editor's suite runs inside a real Electron renderer.
 */

import {
  componentNameForRef,
  deployedFunctionNames,
  isBrokenState,
  refFromComponentName,
  resolveFunctionRef
} from '../../src/editor/src/models/workflow/functionRefResolution';

const BACKEND = 'SQLite backend';

function resolve(ref: unknown, inProject: string[], deployed: { names: string[]; known: boolean }) {
  return resolveFunctionRef(ref, { inProject, deployed, backendName: BACKEND });
}

const KNOWN = (names: string[]) => ({ names, known: true });
const NOT_ASKED = { names: [], known: false };

describe('WFA-006 function ref — the prefix convention', () => {
  it('matches the drag-to-canvas convention rather than inventing a second one', () => {
    expect(componentNameForRef('saveOrder')).toBe('/#__cloud__/saveOrder');
    expect(refFromComponentName('/#__cloud__/saveOrder')).toBe('saveOrder');
  });

  it('is not a cloud function just because the name contains the marker', () => {
    // Anchored, like `isCloudFunctionComponent`. A browser component in a folder
    // called "#__cloud__" further down the tree is still a browser component.
    expect(refFromComponentName('/Utils/#__cloud__/notAFunction')).toBe(null);
    expect(refFromComponentName('/App')).toBe(null);
  });
});

describe('WFA-006 function ref — the four states', () => {
  it('in the project and deployed: resolved, and the card says nothing extra', () => {
    const r = resolve('saveOrder', ['saveOrder'], KNOWN(['saveOrder']));
    expect(r.state).toBe('resolved-in-project');
    expect(r.inProject).toBe(true);
    expect(r.deployed).toBe(true);
    expect(r.componentName).toBe('/#__cloud__/saveOrder');
    expect(isBrokenState(r.state)).toBe(false);
  });

  it('in the project but NOT deployed: still resolved — there is a graph to open', () => {
    const r = resolve('saveOrder', ['saveOrder'], KNOWN([]));
    expect(r.state).toBe('resolved-in-project');
    expect(r.inProject).toBe(true);
    // The second fact is kept rather than folded away: it is what the deploy
    // offer keys on (§2's third case).
    expect(r.deployed).toBe(false);
    expect(r.summary).toBe('in this project · not deployed yet');
    expect(isBrokenState(r.state)).toBe(false);
  });

  it('deployed but not in this project: reported, never resolved', () => {
    const r = resolve('chargeCard', [], KNOWN(['chargeCard']));
    expect(r.state).toBe('deployed-only');
    expect(r.inProject).toBe(false);
    expect(r.deployed).toBe(true);
    expect(r.componentName).toBe(null);
    // NOT a warning: a step pointing at a function deployed from another
    // project is a legitimate state, and drawing a danger ring round it would
    // be the wrong warning.
    expect(isBrokenState(r.state)).toBe(false);
    expect(r.message).toContain('not part of this project');
  });

  it('in neither: the step is broken, and says so', () => {
    const r = resolve('chargeCard', [], KNOWN(['saveOrder']));
    expect(r.state).toBe('unresolved');
    expect(r.deployed).toBe(false);
    expect(isBrokenState(r.state)).toBe(true);
    expect(r.message).toContain('will fail when it runs');
  });

  it('the backend could not be asked: unknown, and never a warning', () => {
    const r = resolve('chargeCard', [], NOT_ASKED);
    expect(r.state).toBe('unknown');
    // The whole point of the third value.
    expect(r.deployed).toBe(null);
    expect(isBrokenState(r.state)).toBe(false);
    expect(r.message).toContain('could not be asked');
    expect(r.message).toContain('may be perfectly fine');
  });

  it('being in the project wins even when the backend was never asked', () => {
    // Otherwise opening a workflow against a stopped backend would refuse to
    // descend into a function that is sitting right there in the project.
    const r = resolve('saveOrder', ['saveOrder'], NOT_ASKED);
    expect(r.state).toBe('resolved-in-project');
    expect(r.deployed).toBe(null);
    expect(r.summary).toBe('in this project');
  });

  it('a step with no function named at all is its own state', () => {
    const r = resolve(undefined, ['saveOrder'], KNOWN(['saveOrder']));
    expect(r.state).toBe('unnamed');
    expect(isBrokenState(r.state)).toBe(true);
    // The backend refuses to save such a step; saying so here is what turns a
    // save-time rejection into an author-time one.
    expect(r.message).toContain('refuses to save');
  });

  it('names the backend it is answering about — there is no "the" backend', () => {
    const r = resolve('chargeCard', [], KNOWN([]));
    expect(r.backendName).toBe(BACKEND);
    expect(r.message).toContain(BACKEND);
  });

  it('trims a pasted name rather than reporting it missing', () => {
    expect(resolve('  saveOrder  ', ['saveOrder'], KNOWN(['saveOrder'])).state).toBe('resolved-in-project');
    expect(resolve('   ', [], KNOWN([])).state).toBe('unnamed');
  });
});

describe('WFA-006 / F54 — reading the deployed function list', () => {
  it('reads {name, workflow} objects, which is what GET /admin/workflows serves', () => {
    // The defect: `status.functions.map(String)` produced ["[object Object]"],
    // so WFA-005's target picker listed a placeholder and `isTargetResolved`
    // answered FALSE for a function that IS deployed.
    const deployed = deployedFunctionNames({
      initialized: true,
      workflowCount: 1,
      functions: [
        { name: 'saveOrder', workflow: 'project-abc' },
        { name: 'chargeCard', workflow: 'project-abc' }
      ]
    });
    expect(deployed.known).toBe(true);
    expect(deployed.names).toEqual(['saveOrder', 'chargeCard']);
    expect(deployed.names.some((n) => n.includes('[object'))).toBe(false);
  });

  it('an uninitialised or unreadable backend is "not asked", not "nothing"', () => {
    expect(deployedFunctionNames({ initialized: false, functions: [] }).known).toBe(false);
    expect(deployedFunctionNames(null).known).toBe(false);
    expect(deployedFunctionNames({ initialized: true }).known).toBe(false);
  });

  it('an initialised backend with no functions is an ANSWER', () => {
    const deployed = deployedFunctionNames({ initialized: true, workflowCount: 0, functions: [] });
    expect(deployed.known).toBe(true);
    expect(deployed.names).toEqual([]);
    // …and that answer is what makes "not deployed" sayable at all.
    expect(resolve('saveOrder', [], deployed).state).toBe('unresolved');
  });

  it('tolerates a plain-string list, in case an older backend serves one', () => {
    expect(deployedFunctionNames({ initialized: true, functions: ['saveOrder'] }).names).toEqual(['saveOrder']);
  });
});
