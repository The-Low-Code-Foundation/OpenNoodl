/**
 * AIB-007 slice 2 — which nodes need a backend, and the completeness guard that
 * keeps a hand-written table honest.
 *
 * The guard is the point of this file. A table is more reviewable than a
 * generated catalog field (BCN-010's argument, adopted) but it goes stale
 * silently, which is the fair objection to one. So: every cloud node in the
 * catalog, and every node BCN-010 already binds a capability to, must be
 * classified either way. A cloud node added to the catalog fails this until
 * somebody says which it is.
 */

import { NODE_CAPABILITIES } from '@noodl/backend-contract';

import catalogJson from '../../../noodl-types/src/node-catalog.json';
import {
  DELIBERATELY_BACKEND_FREE,
  NODES_REQUIRING_BACKEND,
  backendRequirementFor,
  checkBackendRequirements
} from '../../src/editor/src/validation/backendRequirement';
import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';

interface CatalogEntry {
  typeName: string;
  category: string;
}
const CATALOG = (catalogJson as { nodes: CatalogEntry[] }).nodes;

/**
 * The categories whose members are candidates.
 *
 * `Cloud Services` is the family; `Cloud` is the three nodes that run *inside* a
 * cloud function and are in `DELIBERATELY_BACKEND_FREE` for that reason. `Data`
 * is deliberately not swept wholesale — it holds Array, Object and Variable —
 * so its cloud-data members are covered by the `NODE_CAPABILITIES` sweep below
 * and by the explicit list here.
 */
const CLOUD_CATEGORIES = new Set(['Cloud Services', 'Cloud']);

describe('the table is complete', () => {
  it('classifies every node in the catalog\'s cloud categories', () => {
    const unclassified = CATALOG.filter(
      (n) =>
        CLOUD_CATEGORIES.has(n.category) &&
        !Object.prototype.hasOwnProperty.call(NODES_REQUIRING_BACKEND, n.typeName) &&
        !Object.prototype.hasOwnProperty.call(DELIBERATELY_BACKEND_FREE, n.typeName)
    ).map((n) => n.typeName);
    expect(unclassified).toEqual([]);
  });

  it('classifies every node BCN-010 binds a backend capability to', () => {
    const unclassified = Object.keys(NODE_CAPABILITIES).filter(
      (typeName) =>
        !Object.prototype.hasOwnProperty.call(NODES_REQUIRING_BACKEND, typeName) &&
        !Object.prototype.hasOwnProperty.call(DELIBERATELY_BACKEND_FREE, typeName)
    );
    // Anything BCN-010 says needs `auth.password` or `files.upload` needs a
    // backend by definition. A key here that this table has never heard of means
    // the two have drifted.
    expect(unclassified).toEqual([]);
  });

  it('never says both things about one node', () => {
    const both = Object.keys(NODES_REQUIRING_BACKEND).filter((t) =>
      Object.prototype.hasOwnProperty.call(DELIBERATELY_BACKEND_FREE, t)
    );
    expect(both).toEqual([]);
  });

  it('names only node types the catalog actually has', () => {
    const known = new Set(CATALOG.map((n) => n.typeName));
    const ghosts = [...Object.keys(NODES_REQUIRING_BACKEND), ...Object.keys(DELIBERATELY_BACKEND_FREE)].filter(
      (t) => !known.has(t)
    );
    expect(ghosts).toEqual([]);
  });

  it('requires a backend for the two nodes that started this task', () => {
    // Richard's plan authored these into a project with no backend and the gate
    // said nothing.
    expect(backendRequirementFor('net.noodl.user.SignUp')).toBe('backend:auth');
    expect(backendRequirementFor('net.noodl.user.LogIn')).toBe('backend:auth');
  });
});

describe('checkBackendRequirements', () => {
  const nodes = [
    { id: 'n1', type: 'net.noodl.user.SignUp', label: 'Create User Account' },
    { id: 'n2', type: 'DbCollection2', label: 'Query Records' },
    { id: 'n3', type: 'Group' },
    { id: 'n4', type: 'DbConfig' }
  ];

  it('names the node and the missing precondition — criterion 2', () => {
    const found = checkBackendRequirements(nodes, { component: '/Pages/Sign Up', hasBackend: false });
    expect(found.map((d) => d.location.nodeId)).toEqual(['n1', 'n2']);
    expect(found[0].code).toBe(DiagnosticCode.MissingBackend);
    expect(found[0].message).toContain('Create User Account');
    expect(found[0].message).toContain('user accounts');
    expect(found[1].message).toContain('reads and writes on a backend');
    // Neither Group nor DbConfig — the latter is the node you'd use to CHECK
    // whether there is a backend.
  });

  it('is an error only when the conversation agreed there is none', () => {
    expect(checkBackendRequirements(nodes, { component: 'c', hasBackend: false })[0].severity).toBe('warning');
    expect(
      checkBackendRequirements(nodes, { component: 'c', hasBackend: false, scopeSaidNone: true })[0].severity
    ).toBe('error');
  });

  it('says nothing when the plan is about to provision the backend', () => {
    // The reason this matters: the agent is told to take diagnostics literally,
    // so a spurious warning here is a Sign Up page that comes back without its
    // Sign Up node.
    const found = checkBackendRequirements(nodes, {
      component: 'c',
      hasBackend: false,
      plannedProvision: { collections: ['Message'], needsAuth: true }
    });
    expect(found).toEqual([]);
  });

  it('still flags the auth nodes when the planned backend has no accounts', () => {
    const found = checkBackendRequirements(nodes, {
      component: 'c',
      hasBackend: false,
      plannedProvision: { collections: ['Message'], needsAuth: false }
    });
    expect(found.map((d) => d.location.nodeId)).toEqual(['n1']);
    expect(found[0].message).toContain('no accounts configured');
  });

  it('claims no knowledge it does not have about an existing backend\'s auth', () => {
    // `cloudservices` says nothing about whether sign-in is switched on, so a
    // configured backend satisfies both requirements rather than reporting a
    // problem the editor cannot see.
    expect(checkBackendRequirements(nodes, { component: 'c', hasBackend: true })).toEqual([]);
    // A caller that DOES know says so.
    const found = checkBackendRequirements(nodes, { component: 'c', hasBackend: true, hasAuth: false });
    expect(found.map((d) => d.location.nodeId)).toEqual(['n1']);
  });
});
