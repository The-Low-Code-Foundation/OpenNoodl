/**
 * CN-004 acceptance criterion 4b — a lesson that teaches a kit node actually
 * grades one.
 *
 * ## Why this is not already covered by CN-003 slice 4
 *
 * Slice 4 routed the overlay into `lessonverify` and graded the **install gate**:
 * a lesson naming a kit type stops being refused as a typo. That is one half.
 * The criterion is explicit that it is not the half that matters:
 *
 * > 🔴 Verify the *consequence*: "the verifier no longer errors" is also true of
 * > an overlay that resolves the type and then matches nothing at runtime —
 * > which is failure class F1 by a different route, and the exact silent failure
 * > UNI-007's `unmatchable-node-path` was added to close. Drive the step to
 * > completion.
 *
 * So this file does not ask the verifier anything. It builds the evaluation
 * context the live runtime builds, from project files with the node **placed**,
 * and asserts the step ticks — `gradeLessonSteps(...).passed`.
 *
 * ## The two halves of "matches", and why the port half is the load-bearing one
 *
 * `exists` matches on `node.type.name`, read straight off the project graph. It
 * would tick for a kit node even with no catalog at all, because nothing about
 * it consults one — so a lesson whose only condition is `exists` cannot tell a
 * working overlay from an absent one, and asserting it alone would be the
 * unfalsifiable version of this test.
 *
 * `hasPort` and `portHasValue` go through `toLessonComponent(legacy, catalog)`,
 * which is where a kit node's ports either exist or do not. That is the
 * condition that discriminates, and it is the one every test below pairs with
 * its overlay-cleared control.
 */

import { gradeLessonSteps } from '../../src/editor/src/models/lessongrading';
import { buildLessonEvalContext } from '../../src/editor/src/models/lessonprojectcontext';
import type { LessonProjectComponentFiles } from '../../src/editor/src/models/lessonprojectcontext';
import type { LessonManifest } from '../../src/editor/src/models/lessonformat';
import { setCatalogOverlay } from '../../src/editor/src/validation/catalog';
import { overlayFromNodeLibrary } from '../../src/editor/src/validation/kitOverlay';

/** The project's kit, as the viewer sends it: a Badge with two real ports. */
const KIT_PAYLOAD = {
  nodetypes: [
    {
      name: 'demo.kit.Badge',
      displayNodeName: 'Demo Badge',
      module: 'Demo Kit',
      category: 'Visual',
      ports: [
        { name: 'label', type: { name: 'string' }, plug: 'input' },
        { name: 'progress', type: { name: 'number' }, plug: 'input' },
        { name: 'clicked', type: { name: 'signal' }, plug: 'output' }
      ]
    }
  ]
};

/**
 * One component, with `nodes` placed in it.
 *
 * 🔴 `path: '/App'` with the leading slash. A condition's first segment is
 * matched against the component's **legacy name**, and CN-003's own fixture was
 * green against a restored defect for exactly this reason — `App:` matches
 * nothing, every condition reads false, and a failure indistinguishable from the
 * mechanism being absent grades nothing at all.
 */
function project(nodes: unknown[]): LessonProjectComponentFiles[] {
  return [
    {
      registryPath: 'App',
      component: { id: 'App', name: 'App', path: '/App', type: 'visual' } as never,
      nodes: { componentId: 'App', nodes } as never,
      connections: { componentId: 'App', connections: [] } as never
    }
  ];
}

/** The learner has placed a correctly-configured Badge. */
const PLACED = project([
  { id: 'n1', type: 'demo.kit.Badge', label: 'My Badge', parameters: { label: 'Budget', progress: 40 } }
]);

/** The learner has not placed anything yet. */
const EMPTY = project([]);

function lesson(completeWhen: unknown[]): LessonManifest {
  return {
    format: 'noodl-lesson@1',
    title: 'Use your own node',
    steps: [{ title: 'Place a Demo Badge', completeWhen }]
  } as LessonManifest;
}

function grade(manifest: LessonManifest, components: LessonProjectComponentFiles[]) {
  return gradeLessonSteps(manifest, buildLessonEvalContext({ components }))[0];
}

afterEach(() => setCatalogOverlay([]));

describe('the step ticks when the learner places the kit node', () => {
  it('grades a port condition on a kit node as satisfied', () => {
    setCatalogOverlay(overlayFromNodeLibrary(KIT_PAYLOAD as never).nodes);

    const step = grade(
      lesson([
        { node: '/App:%demo.kit.Badge', exists: true },
        { node: '/App:%demo.kit.Badge', hasPort: 'progress' }
      ]),
      PLACED
    );

    expect(step.error).toBeUndefined();
    expect(step.graded).toBe(true);
    expect(step.passed).toBe(true);
  });

  // 🔴 The control that makes the above attributable. Same lesson, same placed
  // node, no overlay: the type still matches (that never needed a catalog), but
  // the node has no ports, so the step cannot tick. This is the state a lesson
  // teaching a custom node was in — installable after slice 4, and ungradeable.
  it('and cannot, with the overlay cleared — the port half is what the catalog buys', () => {
    const step = grade(
      lesson([
        { node: '/App:%demo.kit.Badge', exists: true },
        { node: '/App:%demo.kit.Badge', hasPort: 'progress' }
      ]),
      PLACED
    );

    expect(step.error).toBeUndefined();
    expect(step.passed).toBe(false);
  });

  it('reads a parameter set on a kit node’s port', () => {
    setCatalogOverlay(overlayFromNodeLibrary(KIT_PAYLOAD as never).nodes);

    const step = grade(lesson([{ node: '/App:%demo.kit.Badge', paramsEqual: { label: 'Budget' } }]), PLACED);
    // ⚠️ Asserted alongside `passed`, not instead of it: an unknown verb throws
    // into `step.error` and reads as `passed: false`, which is the same answer a
    // genuinely unmet condition gives. The first draft of this pair used a verb
    // that does not exist and "failed" identically in both arms — a failure
    // indistinguishable from a missing mechanism measures nothing.
    expect(step.error).toBeUndefined();
    expect(step.passed).toBe(true);
  });

  it('does not tick on the wrong value — the step still discriminates', () => {
    setCatalogOverlay(overlayFromNodeLibrary(KIT_PAYLOAD as never).nodes);

    const step = grade(lesson([{ node: '/App:%demo.kit.Badge', paramsEqual: { label: 'Something else' } }]), PLACED);
    expect(step.error).toBeUndefined();
    expect(step.passed).toBe(false);
  });

  it('does not tick before the node is placed', () => {
    setCatalogOverlay(overlayFromNodeLibrary(KIT_PAYLOAD as never).nodes);

    // ⚠️ The other half of "two ways an instrument lies": a step that passes on
    // an empty project is a step that passes on anything, and would make every
    // assertion above worthless.
    const step = grade(lesson([{ node: '/App:%demo.kit.Badge', exists: true }]), EMPTY);
    expect(step.passed).toBe(false);
  });

  it('a step whose conditions the learner has half-met stays unticked', () => {
    setCatalogOverlay(overlayFromNodeLibrary(KIT_PAYLOAD as never).nodes);

    const step = grade(
      lesson([
        { node: '/App:%demo.kit.Badge', exists: true },
        { node: '/App:%demo.kit.Badge', hasPort: 'noSuchPortOnTheKit' }
      ]),
      PLACED
    );
    // `hasPort` on a port the kit does not declare must be false, not "unknown
    // type, so who knows". A permissive answer here would tick every step of
    // every lesson about a custom node.
    expect(step.passed).toBe(false);
  });
});
