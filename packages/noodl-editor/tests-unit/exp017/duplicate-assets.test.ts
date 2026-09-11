/**
 * EXP-017 AC4 — the decision about a file a deploy would publish twice.
 *
 * ## 🔴 Every row here is about the arm that must NOT prune
 *
 * The pruning half is easy and almost uninteresting: a file nobody mentions can be left out. What
 * decides whether this rule is safe to ship is what it does when it does not understand the
 * project — a path assembled at run time, a reference written relative, a project with no readable
 * source at all. In each of those the correct action is to ship 307 KB it did not need to, and the
 * failure it is avoiding is a stranger's website rendering in Times.
 *
 * The end-to-end half — a real `copyProjectFilesToFolder` over a project with a real duplicate —
 * is in `tests/utils/exp017-duplicate-assets.test.ts`, which runs where `@noodl/platform` is bound.
 */
import {
  planDuplicateAssetPrune,
  survivorOf,
  type DuplicatePair
} from '../../src/editor/src/utils/compilation/build/duplicateAssets';

/** The measured pair: the same Inter face, from two producers, 314,712 bytes each. */
const INTER: DuplicatePair = {
  keep: 'noodl_modules/inter/Inter-Medium.ttf',
  drop: 'fonts/Inter/Inter-Medium.ttf',
  bytes: 314_712
};

describe('EXP-017 AC4 — which copy survives', () => {
  it('the module copy wins, whichever way round it is asked', () => {
    // 🔴 Not tidiness. The module's manifest is what puts its stylesheet in front of the app, and
    // that stylesheet names its own files by relative path — drop the module copy and the
    // stylesheet points at nothing.
    expect(survivorOf('noodl_modules/inter/Inter-Bold.ttf', 'fonts/Inter-Bold.ttf')).toEqual({
      keep: 'noodl_modules/inter/Inter-Bold.ttf',
      drop: 'fonts/Inter-Bold.ttf'
    });
    expect(survivorOf('fonts/Inter-Bold.ttf', 'noodl_modules/inter/Inter-Bold.ttf')).toEqual({
      keep: 'noodl_modules/inter/Inter-Bold.ttf',
      drop: 'fonts/Inter-Bold.ttf'
    });
  });

  it('🔴 with NEITHER in a module there is no pair at all', () => {
    // Measured, by breaking a shipped spec. This rule first deduplicated any two identical files,
    // and DEP-008's fixture holds `assets/logo.png` and `pre.gitlab-assets/logo.png` with the same
    // three bytes — two copies of a user's own picture, in two folders they chose. It dropped one,
    // and `criterion 4 — deploys pre.gitlab-assets/` went red. It was right to: a person with two
    // copies of their logo has two URLs, and this deploy can read neither of them.
    expect(survivorOf('assets/logo.png', 'pre.gitlab-assets/logo.png')).toBeNull();
    expect(survivorOf('pre.gitlab-assets/logo.png', 'assets/logo.png')).toBeNull();
  });

  it('with BOTH in modules the order is total, so two runs agree', () => {
    const a = survivorOf('noodl_modules/a/f.woff2', 'noodl_modules/other/f.woff2');
    const b = survivorOf('noodl_modules/other/f.woff2', 'noodl_modules/a/f.woff2');
    expect(a).toEqual(b);
    expect(a).not.toBeNull();
  });
});

describe('EXP-017 AC4 — a duplicate nothing refers to is left out', () => {
  it('drops it, naming the copy that makes it safe', () => {
    const plan = planDuplicateAssetPrune([INTER], '{"fontFamily":"Inter","text":"Hello"}');

    expect(plan.drop).toEqual([
      { path: 'fonts/Inter/Inter-Medium.ttf', keep: 'noodl_modules/inter/Inter-Medium.ttf', bytes: 314_712 }
    ]);
    expect(plan.kept).toEqual([]);
  });
});

describe('EXP-017 AC4 — a duplicate anything refers to ships anyway', () => {
  it('an exact path in the project source keeps it', () => {
    // The real case: an imported prefab writes `fontFamily: "fonts/Inter/Inter-Medium.ttf"` into a
    // Text node, and the viewer derives the family `Inter-Medium` from that URL. Drop the file and
    // the family resolves to nothing.
    const plan = planDuplicateAssetPrune([INTER], '{"fontFamily":"fonts/Inter/Inter-Medium.ttf"}');

    expect(plan.drop).toEqual([]);
    expect(plan.kept.length).toBe(1);
    expect(plan.kept[0].reason).toContain('fonts/Inter/Inter-Medium.ttf');
  });

  it('a RELATIVE reference to the same file keeps it', () => {
    // 🔴 The row a prefix scan would fail. A stylesheet inside the project writes
    // `url(../fonts/Inter/Inter-Medium.ttf)`, which does not contain the project-relative path at
    // all — and it loads the file this rule was about to delete.
    const plan = planDuplicateAssetPrune([INTER], '@font-face{src:url(../fonts/Inter/Inter-Medium.ttf)}');

    expect(plan.drop).toEqual([]);
    expect(plan.kept[0].reason).toContain('Inter/Inter-Medium.ttf');
  });

  it('a path BUILT at run time keeps everything in that folder', () => {
    // The planner meets `Inter/` followed by something that is not a filename. It does not
    // understand what the project is doing with that folder, so it does nothing to it — the same
    // refusal `planStarterImageryPrune` takes, for the same reason.
    const plan = planDuplicateAssetPrune([INTER], "const url = 'fonts/Inter/' + weight + '.ttf'");

    expect(plan.drop).toEqual([]);
    expect(plan.kept[0].reason).toContain('not a filename');
  });

  it('a reference to a DIFFERENT file in the same folder does not keep this one', () => {
    // Arming the row above: the refusal must be about an unresolvable occurrence, not about the
    // folder being mentioned at all. A project that names `Inter-Bold.ttf` says nothing about
    // `Inter-Medium.ttf`, and a planner that treated it as evidence would never prune anything.
    const plan = planDuplicateAssetPrune([INTER], '{"fontFamily":"fonts/Inter/Inter-Bold.ttf"}');

    expect(plan.drop.length).toBe(1);
    expect(plan.kept).toEqual([]);
  });

  it('no readable project source is not evidence of anything', () => {
    // 🔴 An absence with no known-firing signal beside it. "Nothing refers to this" and "nothing
    // was read" produce identical evidence and have opposite correct actions.
    const plan = planDuplicateAssetPrune([INTER], '   \n  ');

    expect(plan.drop).toEqual([]);
    expect(plan.kept[0].reason).toContain('no readable project source');
  });

  it('no duplicates at all is a plan that does nothing and says nothing', () => {
    expect(planDuplicateAssetPrune([], 'anything')).toEqual({ drop: [], kept: [] });
  });
});
