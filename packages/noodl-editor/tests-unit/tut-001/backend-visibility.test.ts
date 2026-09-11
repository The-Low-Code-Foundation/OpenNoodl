/**
 * TUT-001 — one database, not forty.
 *
 * The panel rendered every backend on the machine flat. These specs grade the rule that replaces
 * that: which one backend gets a card, which fall behind the finder, and what the collapsed line
 * has to say so that hiding them stays honest.
 *
 * 🔴 **Every filter case asserts both halves — something excluded AND something included.** A
 * filter that returns its whole input passes any assertion that only checks for a row it expects
 * to see, and "returns everything" is the exact defect this task exists to remove, so a spec that
 * cannot distinguish the two would be a hole shaped like the defect.
 *
 * ⚠️ What this file cannot see: it grades the rule, not the render. The panel calls hooks and
 * `LocalBackendCard` imports `common/Icon`, so neither loads in this runner — the claim that the
 * panel maps over *this* partition is graded by `panel-render.test.ts` beside it.
 */
import {
  BackendVisibility,
  VisibilityCandidate,
  describeCollapsedSummary,
  filterFinderRows,
  partitionBackends,
  toEpoch
} from '../../src/editor/src/views/panels/BackendServicesPanel/backendVisibility';

const OPEN_PROJECT = 'project-open';

function local(over: Partial<VisibilityCandidate> & { id: string }): VisibilityCandidate {
  return {
    name: over.id,
    kind: 'local',
    createdAt: '2026-01-01T00:00:00.000Z',
    running: false,
    projectIds: [],
    projectNames: [],
    ...over
  };
}

/**
 * Seven backends — the machine the task describes, not a two-row toy.
 *
 * `tutorial-2` is the one the open project owns through `projectIds`; `hand-made` and `orphan`
 * carry the empty `projectIds` that every pre-stamp and hand-made backend has, and `orphan` is
 * running, which is what R1 turns on.
 */
function machine(): VisibilityCandidate[] {
  return [
    local({ id: 'tutorial-1', name: 'Tutorial 1 — records', createdAt: '2026-02-01T09:00:00.000Z' }),
    local({
      id: 'tutorial-2',
      name: 'Tutorial 2 — puppies',
      createdAt: '2026-03-05T09:00:00.000Z',
      projectIds: [OPEN_PROJECT],
      projectNames: ['My first tutorial']
    }),
    local({ id: 'ai-build', name: 'AI build scratch', createdAt: '2026-04-10T09:00:00.000Z', projectIds: ['other'] , projectNames: ['Puppy test 3']}),
    local({ id: 'hand-made', name: 'Hand made', createdAt: '2026-05-20T09:00:00.000Z' }),
    local({ id: 'orphan', name: 'Orphan', createdAt: '2026-06-30T09:00:00.000Z', running: true }),
    local({ id: 'oldest', name: 'Oldest of all', createdAt: '2025-11-11T09:00:00.000Z' }),
    {
      id: 'directus-1',
      name: 'Directus staging',
      kind: 'external',
      createdAt: new Date('2026-07-01T09:00:00.000Z'),
      projectNames: ['Puppy test 3']
    }
  ];
}

function ids(list: VisibilityCandidate[]): string[] {
  return list.map((c) => c.id);
}

function localCards(v: BackendVisibility): VisibilityCandidate[] {
  return v.attached.filter((c) => c.kind === 'local');
}

describe('AC1 — one card, against a machine with seven backends', () => {
  it('renders exactly one local backend when the project is bound to one', () => {
    const v = partitionBackends({
      candidates: machine(),
      boundLocalBackendId: 'tutorial-2',
      activeBackendId: 'tutorial-2',
      openProjectId: OPEN_PROJECT
    });

    expect(localCards(v)).toHaveLength(1);
    expect(v.attached[0].id).toBe('tutorial-2');
    expect(v.others).toHaveLength(6);
    // The fixture is big enough for the assertion to mean something.
    expect(machine().length).toBeGreaterThanOrEqual(5);
  });

  it('never returns two attached backends, even when three tiers all match different rows', () => {
    const v = partitionBackends({
      candidates: machine(),
      boundLocalBackendId: 'ai-build', // tier 1
      activeBackendId: 'orphan', // tier 2
      openProjectId: OPEN_PROJECT // tier 3 matches tutorial-2
    });

    expect(v.attached).toHaveLength(1);
    expect(v.attached[0].id).toBe('ai-build');
    expect(ids(v.others)).toEqual(expect.arrayContaining(['orphan', 'tutorial-2']));
  });

  it('falls to the active backend when the endpoint resolves to none of ours', () => {
    const v = partitionBackends({ candidates: machine(), activeBackendId: 'orphan', openProjectId: OPEN_PROJECT });
    expect(v.attached[0].id).toBe('orphan');
  });
});

describe('AC3 — "previously attached" resolves through projectIds, and only through it', () => {
  it('promotes a backend whose projectIds names the open project, with no endpoint and no active id', () => {
    const v = partitionBackends({ candidates: machine(), openProjectId: OPEN_PROJECT });

    expect(v.attached).toHaveLength(1);
    expect(v.attached[0].id).toBe('tutorial-2');
  });

  it('promotes it even when the endpoint currently points somewhere else entirely', () => {
    // The project's endpoint is an external Directus; the built-in backend it used last week is
    // still the one a builder means by "my database".
    const v = partitionBackends({
      candidates: machine(),
      activeBackendId: 'directus-1',
      openProjectId: OPEN_PROJECT
    });

    expect(v.attached[0].id).toBe('directus-1');
    // …and it is reachable rather than lost: the previously-attached one is in the finder.
    expect(ids(v.others)).toContain('tutorial-2');
  });

  it('🔴 refuses to promote a backend with an EMPTY projectIds — owned by nobody', () => {
    const candidates = machine().filter((c) => c.id !== 'tutorial-2');
    const v = partitionBackends({ candidates, openProjectId: OPEN_PROJECT });

    expect(v.attached).toHaveLength(0);
    expect(ids(v.others)).toEqual(expect.arrayContaining(['hand-made', 'orphan']));
  });

  it('does not promote a backend owned by a DIFFERENT project', () => {
    const v = partitionBackends({ candidates: machine(), openProjectId: 'someone-else' });
    expect(v.attached).toHaveLength(0);
  });

  it('picks the newest when the open project owns several', () => {
    const candidates = machine().concat(
      local({
        id: 'tutorial-2b',
        name: 'Tutorial 2 — retry',
        createdAt: '2026-03-06T09:00:00.000Z',
        projectIds: [OPEN_PROJECT]
      })
    );
    const v = partitionBackends({ candidates, openProjectId: OPEN_PROJECT });
    expect(v.attached[0].id).toBe('tutorial-2b');
  });
});

describe('🔴 a backend just created in this panel — the lowest tier, and why', () => {
  it('is drawn when nothing else is attached, so Create does not appear to do nothing', () => {
    // A hand-made backend is owned by nobody: no endpoint points at it, it is not active, and its
    // `projectIds` is empty. Without this tier it would be filed straight into the finder.
    const candidates = machine().concat(local({ id: 'brand-new', name: 'Brand new', createdAt: '2026-08-19T09:00:00.000Z' }));
    const v = partitionBackends({ candidates, justCreatedBackendId: 'brand-new' });

    expect(v.attached).toHaveLength(1);
    expect(v.attached[0].id).toBe('brand-new');
  });

  it('🔴 NEVER outranks the backend the running app actually talks to', () => {
    // Ranked first, this would draw the new backend, hide the bound one, and let the summary line
    // claim "1 attached" about a backend nothing is attached to.
    const candidates = machine().concat(local({ id: 'brand-new', name: 'Brand new' }));
    const v = partitionBackends({
      candidates,
      boundLocalBackendId: 'tutorial-2',
      justCreatedBackendId: 'brand-new'
    });

    expect(v.attached[0].id).toBe('tutorial-2');
    expect(describeCollapsedSummary(v.summary)).toBe('1 attached · 7 others, 1 running');
    // …and the new one is reachable rather than lost.
    expect(ids(v.others)).toContain('brand-new');
  });

  it('does not outrank a previously-attached backend either', () => {
    const candidates = machine().concat(local({ id: 'brand-new', name: 'Brand new' }));
    const v = partitionBackends({ candidates, openProjectId: OPEN_PROJECT, justCreatedBackendId: 'brand-new' });
    expect(v.attached[0].id).toBe('tutorial-2');
  });
});

describe('AC5 — the two cases the current render keeps separate', () => {
  it('a project bound to no backend attaches nothing and hides nothing', () => {
    const v = partitionBackends({ candidates: machine(), openProjectId: 'brand-new-project' });

    expect(v.attached).toHaveLength(0);
    expect(v.others).toHaveLength(7);
    expect(describeCollapsedSummary(v.summary)).toBe('No backend attached · 7 others, 1 running');
  });

  it('a project bound to the endpoint rather than a local backend draws no local card', () => {
    const v = partitionBackends({ candidates: machine(), activeBackendId: 'directus-1' });

    expect(localCards(v)).toHaveLength(0);
    expect(v.attached[0].kind).toBe('external');
  });

  it('an empty machine is not an error', () => {
    const v = partitionBackends({ candidates: [], openProjectId: OPEN_PROJECT });
    expect(v.attached).toHaveLength(0);
    expect(v.summary).toEqual({ attachedCount: 0, otherCount: 0, otherRunningCount: 0 });
    expect(describeCollapsedSummary(v.summary)).toBe('No backend attached');
  });
});

describe('AC2 — the finder filters, each proved to exclude as well as include', () => {
  const rows = () => partitionBackends({ candidates: machine(), boundLocalBackendId: 'tutorial-2' }).others;

  it('an empty query excludes nothing — the control that makes the rest mean something', () => {
    expect(filterFinderRows(rows(), {})).toHaveLength(6);
    expect(filterFinderRows(rows(), { name: '  ' })).toHaveLength(6);
  });

  it('filters by name substring, case-insensitively', () => {
    const got = filterFinderRows(rows(), { name: 'tutorial' });

    expect(ids(got)).toEqual(['tutorial-1']); // included
    expect(ids(got)).not.toContain('orphan'); // excluded
    expect(got.length).toBeLessThan(rows().length);
    expect(ids(filterFinderRows(rows(), { name: 'ORPHAN' }))).toEqual(['orphan']);
  });

  it('filters by created date range, on both bounds', () => {
    const got = filterFinderRows(rows(), { createdFrom: '2026-04-01', createdTo: '2026-06-01' });

    expect(ids(got)).toEqual(['hand-made', 'ai-build']);
    expect(ids(got)).not.toContain('oldest'); // below the lower bound
    expect(ids(got)).not.toContain('directus-1'); // above the upper bound
  });

  it('a bare YYYY-MM-DD upper bound includes the whole of that day', () => {
    // 09:00 on the 30th is inside "up to and including the 30th"; a naive midnight bound drops it.
    expect(ids(filterFinderRows(rows(), { createdTo: '2026-06-30' }))).toContain('orphan');
    expect(ids(filterFinderRows(rows(), { createdTo: '2026-06-29' }))).not.toContain('orphan');
  });

  it('filters by owning project name', () => {
    const got = filterFinderRows(rows(), { project: 'puppy' });

    expect(ids(got).sort()).toEqual(['ai-build', 'directus-1']);
    expect(ids(got)).not.toContain('hand-made'); // owned by nobody
  });

  it('combines clauses conjunctively', () => {
    const got = filterFinderRows(rows(), { project: 'puppy', name: 'directus' });
    expect(ids(got)).toEqual(['directus-1']);
  });

  it('🔴 excludes an undated backend from any date bound rather than admitting it', () => {
    const undated = local({ id: 'undated', name: 'No date at all', createdAt: null });
    const withUndated = rows().concat(undated);

    expect(ids(filterFinderRows(withUndated, {}))).toContain('undated');
    expect(ids(filterFinderRows(withUndated, { createdFrom: '2020-01-01' }))).not.toContain('undated');
    expect(ids(filterFinderRows(withUndated, { createdTo: '2030-01-01' }))).not.toContain('undated');
  });
});

describe('🔴 createdAt is a string on one source and a Date on the other', () => {
  it('reads both, and refuses anything it cannot place', () => {
    expect(toEpoch('2026-03-05T09:00:00.000Z')).toBe(Date.parse('2026-03-05T09:00:00.000Z'));
    expect(toEpoch(new Date('2026-03-05T09:00:00.000Z'))).toBe(Date.parse('2026-03-05T09:00:00.000Z'));
    expect(toEpoch(undefined)).toBeNull();
    expect(toEpoch(null)).toBeNull();
    expect(toEpoch('not a date')).toBeNull();
    expect(toEpoch(new Date('not a date'))).toBeNull();
  });

  it('sorts a Date-shaped and a string-shaped backend into one order', () => {
    const v = partitionBackends({ candidates: machine(), boundLocalBackendId: 'tutorial-2' });
    // directus-1 (a Date, 2026-07-01) is the newest of the six; oldest (a string, 2025-11) is last.
    expect(ids(v.others)).toEqual(['directus-1', 'orphan', 'hand-made', 'ai-build', 'tutorial-1', 'oldest']);
  });

  it('sorts undated backends last rather than to the top', () => {
    const candidates = machine().concat(local({ id: 'undated', createdAt: undefined }));
    const v = partitionBackends({ candidates, boundLocalBackendId: 'tutorial-2' });
    expect(ids(v.others)[v.others.length - 1]).toBe('undated');
  });
});

describe('R1 / AC4 — the collapsed line cannot conceal a running process', () => {
  it('names how many hidden backends are running', () => {
    const v = partitionBackends({ candidates: machine(), boundLocalBackendId: 'tutorial-2' });
    expect(describeCollapsedSummary(v.summary)).toBe('1 attached · 6 others, 1 running');
  });

  it('counts every running hidden backend, not just the first', () => {
    const candidates = machine().map((c) => (c.kind === 'local' ? { ...c, running: true } : c));
    const v = partitionBackends({ candidates, boundLocalBackendId: 'tutorial-2' });
    expect(v.summary.otherRunningCount).toBe(5);
    expect(describeCollapsedSummary(v.summary)).toBe('1 attached · 6 others, 5 running');
  });

  it('says nothing about running when nothing hidden is running — no false alarm', () => {
    const candidates = machine().map((c) => ({ ...c, running: false }));
    const v = partitionBackends({ candidates, boundLocalBackendId: 'tutorial-2' });
    expect(describeCollapsedSummary(v.summary)).toBe('1 attached · 6 others');
  });

  it('a running ATTACHED backend is not counted as hidden', () => {
    const candidates = machine().map((c) => (c.id === 'tutorial-2' ? { ...c, running: true } : { ...c, running: false }));
    const v = partitionBackends({ candidates, boundLocalBackendId: 'tutorial-2' });
    expect(v.summary.otherRunningCount).toBe(0);
    expect(describeCollapsedSummary(v.summary)).toBe('1 attached · 6 others');
  });

  it('🔴 says "1 attached" when the ENDPOINT card is the attachment, which the partition cannot see', () => {
    // A Parse endpoint: `activeBackendId` is ENDPOINT_BACKEND_ID, which matches no candidate, so
    // the partition reports zero attached — correctly. The line must not then contradict the card
    // sitting directly above it.
    const v = partitionBackends({ candidates: machine(), activeBackendId: 'endpoint' });
    expect(v.summary.attachedCount).toBe(0);

    expect(describeCollapsedSummary(v.summary)).toBe('No backend attached · 7 others, 1 running');
    expect(describeCollapsedSummary(v.summary, { endpointCardVisible: true })).toBe(
      '1 attached · 7 others, 1 running'
    );
    // …and the flag does not invent an attachment when it is false.
    expect(describeCollapsedSummary(v.summary, { endpointCardVisible: false })).toBe(
      'No backend attached · 7 others, 1 running'
    );
  });

  it('singularises one other', () => {
    const v = partitionBackends({
      candidates: [local({ id: 'a', projectIds: [OPEN_PROJECT] }), local({ id: 'b', running: true })],
      openProjectId: OPEN_PROJECT
    });
    expect(describeCollapsedSummary(v.summary)).toBe('1 attached · 1 other, 1 running');
  });
});
