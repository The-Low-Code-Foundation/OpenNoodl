/**
 * DEF-035 — a schema fetch that could not reach the backend must not delete the ports.
 *
 * ## What these grade
 *
 * `dbCollections` is the only home of a built-in backend's schema, it is project
 * metadata (so `setMetaData` writes it to disk), and `recordFieldPorts` mints one
 * `prop-<column>` port per column of it. Measured with the runtime's own generator:
 *
 * ```
 * dbCollections=[Puppy]   → prop-name, prop-age, prop-bio
 * dbCollections=undefined → (no ports)
 * ```
 *
 * A wire into a port that does not exist is `con-no-target-port`, raised at
 * `level: 'error'` by `NodeGraphModel.evaluateConnectionHealth` — and an error is
 * exactly what DEF-034 established still deletes a wire from an export. So the
 * difference between those two lines is **3,783 wires across 28 of the 118 corpus
 * projects** silently missing from a build.
 *
 * `SchemaHandler._store()` reached the second line on every outcome that was not a
 * successful read, including a backend that was merely asleep or thirty seconds
 * from ready. {@link decideSchemaCache} is the rule that stops it, and it is the
 * whole of the fix, so it is what is graded here.
 *
 * ## Why here and not in `tests/`
 *
 * `schemahandler.ts` reaches `ProjectModel`, `EventDispatcher` and `ipcRenderer`;
 * the policy reaches nothing. Same split the codebase already makes in
 * `BackendServices/projectCollections.ts` — "the reading of singletons stays on
 * the Electron side, the judgement stays specable."
 */

import { decideSchemaCache, type SchemaFetchOutcome } from '@noodl-utils/schemaCachePolicy';

const PUPPY = { name: 'Puppy', columns: [{ name: 'name', type: 'String' }] };

describe('DEF-035 — a backend we could not reach leaves the cache alone', () => {
  /**
   * The defect itself. Every one of these used to be `undefined` out of
   * `fetchBuiltInSchema`, and `_store()` wiped the metadata on `undefined`.
   */
  const UNREACHABLE: SchemaFetchOutcome[] = [
    { status: 'unavailable', reason: 'no project is open' },
    { status: 'unavailable', reason: 'no ipcRenderer in this window' },
    { status: 'unavailable', reason: 'no managed backend matches the endpoint yet' },
    { status: 'unavailable', reason: 'backend b1 is not running' },
    { status: 'unavailable', reason: 'backend b1 returned no readable table list' }
  ];

  it.each(UNREACHABLE)('writes nothing for: $reason', (outcome) => {
    const decision = decideSchemaCache(outcome);

    expect(decision.write).toBe(false);
  });

  it('carries the reason on the no-write arm, so the decision is loggable', () => {
    const decision = decideSchemaCache({ status: 'unavailable', reason: 'backend b1 is not running' });

    // An invisible decision not to write is how this defect stayed invisible.
    expect(decision.reason).toContain('backend b1 is not running');
    expect(decision.reason).toContain('keeping the cached schema');
  });

  it('covers every unreachable case `fetchBuiltInSchema` can produce', () => {
    // Cardinality, asserted where it can rot: if a sixth `unavailable` reason is
    // added to `fetchBuiltInSchema` and not to the list above, this is the line
    // that says so rather than a silently narrower sweep.
    expect(UNREACHABLE.length).toBe(5);
  });
});

describe('DEF-035 — an answer we did get replaces the cache', () => {
  it('caches the tables the backend reported', () => {
    const decision = decideSchemaCache({ status: 'schema', tables: [PUPPY] });

    expect(decision.write).toBe(true);
    if (!decision.write) throw new Error('unreachable');
    expect(decision.value.dbCollections).toEqual([PUPPY]);
    expect(decision.value.haveCloudServices).toBe(true);
  });

  it('treats zero tables as an answer, not a failure', () => {
    // A backend with no tables is a fact the Data Browser and the AI review both
    // have to be able to state. `[]` was already truthy in the old `if (tables)`,
    // and losing that on the way to fixing the wipe would be a new defect.
    const decision = decideSchemaCache({ status: 'schema', tables: [] });

    expect(decision.write).toBe(true);
    if (!decision.write) throw new Error('unreachable');
    expect(decision.value.dbCollections).toEqual([]);
    expect(decision.value.haveCloudServices).toBe(true);
  });

  it('caches system tables in the one array, never a second list', () => {
    // `collectionsFromParseClasses` marks `isSystem` off the leading underscore.
    const decision = decideSchemaCache({ status: 'schema', tables: [PUPPY, { name: '_User', columns: [] }] });

    if (!decision.write) throw new Error('unreachable');
    expect(decision.value.dbCollections).toHaveLength(2);
    expect(decision.value.systemCollections).toEqual([]);
  });
});

describe('DEF-035 — a project with no built-in backend still clears', () => {
  /**
   * The half that must NOT become "never clear". Keeping a cache here would
   * attribute another server's classes to this project — the WF-007 rule.
   */
  const NOT_APPLICABLE: SchemaFetchOutcome[] = [
    { status: 'not-applicable', reason: 'the project has no backend endpoint' },
    { status: 'not-applicable', reason: 'the endpoint is a parse server we hold no key for' }
  ];

  it.each(NOT_APPLICABLE)('clears the cache for: $reason', (outcome) => {
    const decision = decideSchemaCache(outcome);

    expect(decision.write).toBe(true);
    if (!decision.write) throw new Error('unreachable');
    expect(decision.value.dbCollections).toBeUndefined();
    expect(decision.value.systemCollections).toBeUndefined();
    expect(decision.value.haveCloudServices).toBe(false);
  });

  it('is the only status that clears', () => {
    // The three statuses do three different things, and this is the assertion
    // that fails if a future edit collapses two of them back together.
    const clears = (o: SchemaFetchOutcome) => {
      const d = decideSchemaCache(o);
      return d.write && d.value.dbCollections === undefined;
    };

    expect(clears({ status: 'not-applicable', reason: 'x' })).toBe(true);
    expect(clears({ status: 'unavailable', reason: 'x' })).toBe(false);
    expect(clears({ status: 'schema', tables: [] })).toBe(false);
  });
});
