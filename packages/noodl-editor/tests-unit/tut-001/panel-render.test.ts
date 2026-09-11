/**
 * TUT-001 — what the panel and the finder actually draw.
 *
 * `backend-visibility.test.ts` beside this one grades the *rule*. A correct rule that the render
 * ignores is the failure this repo keeps paying for, so this file grades the *render*: one card for
 * a machine carrying seven backends, and a finder whose list shrinks when a filter is typed.
 *
 * 🔴 **Neither the panel nor `LocalBackendCard` can be loaded here.** The panel calls hooks (the
 * dispatcher is null outside a render) and the card imports `common/Icon`, which uses webpack's
 * `require.context`. So the two hook-free components both surfaces draw *through* —
 * `BackendVisibilityList` and `BackendFinderBody` — are what carry the assertion, and the last
 * claim (that the panel feeds them the partition rather than the raw lists) is source-derived,
 * with comments stripped first.
 */
import React from 'react';

import { render, walk, text, stripComments } from '../support/renderElements';

// The finder's fields are `TextInput`s, and `TextInput` imports `common/Icon`. Replaced here so
// the real module is never required — the factory means it is not loaded, not merely ignored.
jest.mock('@noodl-core-ui/components/inputs/TextInput', () => ({
  TextInput: (props: Record<string, unknown>) =>
    React.createElement('input', { 'data-test': props.testId, value: props.value, readOnly: true })
}));

import { BackendFinderBody } from '../../src/editor/src/views/panels/BackendServicesPanel/BackendFinder/BackendFinderBody';
import { BackendVisibilityList } from '../../src/editor/src/views/panels/BackendServicesPanel/BackendFinder/BackendVisibilityList';
import {
  VisibilityCandidate,
  partitionBackends
} from '../../src/editor/src/views/panels/BackendServicesPanel/backendVisibility';

const OPEN_PROJECT = 'project-open';

/** The same seven-backend machine the rule specs use. */
function machine(): VisibilityCandidate[] {
  const l = (id: string, over: Partial<VisibilityCandidate> = {}): VisibilityCandidate => ({
    id,
    name: id,
    kind: 'local',
    createdAt: '2026-02-01T09:00:00.000Z',
    running: false,
    projectIds: [],
    projectNames: [],
    ...over
  });
  return [
    l('tutorial-1', { name: 'Tutorial 1 — records' }),
    l('tutorial-2', { name: 'Tutorial 2 — puppies', projectIds: [OPEN_PROJECT], projectNames: ['My first tutorial'] }),
    l('ai-build', { name: 'AI build scratch', projectNames: ['Puppy test 3'] }),
    l('hand-made', { name: 'Hand made' }),
    l('orphan', { name: 'Orphan', running: true }),
    l('oldest', { name: 'Oldest of all', createdAt: '2025-11-11T09:00:00.000Z' }),
    { id: 'directus-1', name: 'Directus staging', kind: 'external', createdAt: new Date('2026-07-01T09:00:00.000Z') }
  ];
}

/**
 * A stand-in for `LocalBackendCard` / `BackendCard`, which cannot be loaded here.
 *
 * The panel builds exactly one `renderRow` and hands the same one to its own list and to the
 * finder — so counting what a stub renderer is asked to draw is counting cards.
 */
function stubRow(candidate: VisibilityCandidate) {
  return React.createElement('div', { 'data-card': candidate.id, className: 'BackendCardStub' }, candidate.name);
}

function cards(tree: ReturnType<typeof render>): string[] {
  return walk(tree)
    .filter((n) => typeof n.props['data-card'] === 'string')
    .map((n) => String(n.props['data-card']));
}

describe('AC1 — one card renders, against a machine carrying seven backends', () => {
  it('draws exactly one card for a project bound to a local backend', () => {
    const v = partitionBackends({
      candidates: machine(),
      boundLocalBackendId: 'tutorial-2',
      openProjectId: OPEN_PROJECT
    });

    const tree = render(
      React.createElement(BackendVisibilityList, { candidates: v.attached, renderRow: stubRow })
    );

    expect(cards(tree)).toEqual(['tutorial-2']);
    expect(cards(tree)).toHaveLength(1);
  });

  it('🔴 the same list drew SEVEN when handed the unfiltered machine — the control', () => {
    // Without this the assertion above is satisfied by a list that renders nothing at all, and by
    // one that renders whatever it is given. This is the arm that fails if the filter is dropped.
    const tree = render(React.createElement(BackendVisibilityList, { candidates: machine(), renderRow: stubRow }));
    expect(cards(tree)).toHaveLength(7);
  });

  it('draws no card and shows the empty slot when nothing is attached', () => {
    const v = partitionBackends({ candidates: machine(), openProjectId: 'brand-new' });
    const tree = render(
      React.createElement(BackendVisibilityList, {
        candidates: v.attached,
        renderRow: stubRow,
        emptySlot: React.createElement('span', null, 'No backend attached')
      })
    );

    expect(cards(tree)).toHaveLength(0);
    expect(text(tree)).toBe('No backend attached');
  });
});

describe('AC2/AC4 — the finder draws the rest, and filtering changes what it draws', () => {
  const others = () => partitionBackends({ candidates: machine(), boundLocalBackendId: 'tutorial-2' }).others;

  function finder(query: Record<string, string> = {}) {
    return render(
      React.createElement(BackendFinderBody, {
        rows: others(),
        query,
        onQueryChange: () => undefined,
        renderRow: stubRow
      })
    );
  }

  it('draws every hidden backend with no query, and says how many', () => {
    const tree = finder();
    expect(cards(tree)).toHaveLength(6);
    expect(text(tree)).toContain('6 backends');
  });

  it('draws fewer when a name filter excludes rows, and says "n of m"', () => {
    const tree = finder({ name: 'tutorial' });
    expect(cards(tree)).toEqual(['tutorial-1']);
    expect(text(tree)).toContain('1 of 6');
  });

  it('a date range changes the drawn set on both bounds', () => {
    expect(cards(finder({ createdTo: '2025-12-31' }))).toEqual(['oldest']);
    expect(cards(finder({ createdFrom: '2026-06-01' }))).toEqual(['directus-1']);
  });

  it('says so rather than drawing an empty box when nothing matches', () => {
    const tree = finder({ name: 'no such backend anywhere' });
    expect(cards(tree)).toHaveLength(0);
    expect(text(tree)).toContain('No backend matches those filters');
  });

  it('distinguishes "nothing matched" from "there is nothing"', () => {
    const tree = render(
      React.createElement(BackendFinderBody, {
        rows: [],
        query: {},
        onQueryChange: () => undefined,
        renderRow: stubRow
      })
    );
    expect(text(tree)).toContain('This computer has no other backends');
  });

  it('🔴 R1 — the finder draws the same row renderer the panel does, so Stop is reachable', () => {
    // The card the panel draws and the card the finder draws come from one function; a hidden
    // running backend is therefore two interactions from stopped (open the finder, press Stop).
    // That the function is `LocalBackendCard` — the card carrying Stop — is asserted from source
    // below, because the card itself cannot be loaded in this runner.
    const drawn = cards(finder());
    expect(drawn).toContain('orphan'); // the running one
  });
});

describe('🔴 the panel feeds them the partition, not the raw lists', () => {
  const source = stripComments(
    require('fs').readFileSync(
      require('path').join(
        __dirname,
        '../../src/editor/src/views/panels/BackendServicesPanel/BackendServicesPanel.tsx'
      ),
      'utf8'
    )
  );

  it('hands the attached partition to the list and the others to the finder', () => {
    expect(source).toContain('candidates={visibility.attached}');
    expect(source).toContain('rows={visibility.others}');
  });

  it('has exactly one render site for each card, so the finder cannot drift from the panel', () => {
    expect(source.match(/<LocalBackendCard\b/g)).toHaveLength(1);
    expect(source.match(/<BackendCard\b/g)).toHaveLength(1);
    expect(source).toContain('renderRow={renderBackendRow}');
  });

  it('🔴 no longer maps either raw list straight into the render', () => {
    // The old panel was `{localBackends.map((backend) => <LocalBackendCard …/>)}` twice over.
    // Building a `VisibilityCandidate` from each list is still a map — what must not come back is
    // a map whose body is a card.
    expect(source).not.toMatch(/\{localBackends\.map\(/);
    expect(source).not.toMatch(/\{backends\.map\(/);
  });

  it('draws the collapsed summary line, which is what makes hiding a running backend honest', () => {
    expect(source).toMatch(/describeCollapsedSummary\(visibility\.summary/);
    // …and it is told about the endpoint card, which the partition cannot see.
    expect(source).toMatch(/endpointCardVisible:/);
    expect(source).toContain('setIsFinderVisible(true)');
  });
});
