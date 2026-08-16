/**
 * CN-003 slice 4 — a lesson bundle checked against **its own** kits.
 *
 * ## The claim this suite exists to make true
 *
 * CN-003 has carried one trap since it was written: *a lesson bundle is graded
 * at install, before its project exists, so its vocabulary must come from the
 * bundle's own project files rather than from whatever project is open.* That
 * requirement has no implementation in the editor — ✅ **D3** puts kit
 * extraction in exactly one process and the editor is not it, and ✅ **D6**
 * forbids running third-party kit code before consent, which a gate cannot grant
 * itself. **This process is the one that can**, and a bundle is a project
 * directory like any other.
 *
 * So the bundles below carry a real kit, and the extractor really runs over
 * them — the same `entry.js`, bundled from source per run, that `kitOverlay`'s
 * suite uses and for the same reason (`dist/` is gitignored, so reading it would
 * grade a stale artifact in a working checkout and nothing at all in a fresh
 * one).
 *
 * ## 🔴 What each test is guarded against
 *
 * The failure this whole area produces is an instrument that *silently
 * exonerates*: an extractor that did not run reports zero kit node types, which
 * reads exactly like a bundle with no kits. So every "it resolved" claim is
 * paired with a control in which the same bundle, minus the kit, is refused —
 * and the "cannot tell" case is asserted to say so rather than to answer.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { bundleVocabularyFor } from '../src/lessons/bundleVocabulary';
import { verifyLessonManifest } from '../src/editor-deps';
import { buildKitExtractor } from './helpers';

const FIXTURES = path.join(__dirname, 'fixtures');
const KIT_APP = path.join(FIXTURES, 'kit-app');

let tempDir: string;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn003-slice4-'));
  process.env.NODEGX_KIT_EXTRACT = await buildKitExtractor(tempDir);
}, 120_000);

afterAll(() => {
  delete process.env.NODEGX_KIT_EXTRACT;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

/**
 * A lesson bundle at a fresh path: `kit-app` (which carries the Demo Kit and
 * uses it) plus a `lesson.json`. `withKit: false` deletes `noodl_modules/` and
 * is the control — same lesson, same graph, no kit to resolve it.
 */
function makeBundle(name: string, options: { withKit: boolean }): string {
  const dir = path.join(tempDir, name);
  fs.cpSync(KIT_APP, dir, { recursive: true });
  if (!options.withKit) fs.rmSync(path.join(dir, 'noodl_modules'), { recursive: true, force: true });

  fs.writeFileSync(
    path.join(dir, 'lesson.json'),
    JSON.stringify({
      format: 'noodl-lesson@1',
      title: 'Add a Demo Badge',
      steps: [{ title: 'Add one', completeWhen: [{ node: '/App:%demo.kit.Badge', exists: true }] }]
    })
  );
  return dir;
}

const LESSON = {
  format: 'noodl-lesson@1',
  title: 'Add a Demo Badge',
  steps: [{ title: 'Add one', completeWhen: [{ node: '/App:%demo.kit.Badge', exists: true }] }]
} as never;

describe('a bundle that ships the kit it teaches', () => {
  it('resolves the kit’s node types from the bundle’s own files', () => {
    const kits = bundleVocabularyFor(makeBundle('with-kit', { withKit: true }));

    // The extractor really ran: `skipped`/`unavailable` would both be an empty
    // node list, and an empty node list is what a broken build produces.
    expect(kits.overlay.unavailable).toBeUndefined();
    expect(kits.overlay.kits.map((k) => k.kitModule)).toEqual(['Demo Kit']);
    expect(kits.overlay.nodes.map((n) => n.typeName).sort()).toEqual(['demo.kit.Badge', 'demo.kit.Meter']);
    expect(kits.vocabulary.isIncomplete).toBe(false);

    // …and the lesson naming one of them is no longer a typo.
    expect(verifyLessonManifest(LESSON, { vocabulary: kits.vocabulary }).ok).toBe(true);
  });

  it('resolves the kit’s ports too, so a condition can ask about one', () => {
    // ⚠️ `hasType()` passing is not the match succeeding — assert the entry.
    const kits = bundleVocabularyFor(makeBundle('with-kit-ports', { withKit: true }));
    const badge = kits.catalog.getNode('demo.kit.Badge');

    expect(badge?.inputs.map((p) => p.name)).toEqual(
      expect.arrayContaining(['label', 'progress', 'showProgress', 'background'])
    );
    expect(badge?.outputs.map((p) => p.name)).toContain('clicked');
  });

  it('…while the same bundle without the kit is refused — the control', () => {
    // Without this half, the two tests above would pass against a catalog that
    // had always carried `demo.kit.Badge`, and would be grading nothing.
    const kits = bundleVocabularyFor(makeBundle('no-kit', { withKit: false }));

    expect(kits.overlay.skipped).toBe('no-modules-directory');
    expect(kits.overlay.nodes).toEqual([]);
    const report = verifyLessonManifest(LESSON, { vocabulary: kits.vocabulary });
    expect(report.ok).toBe(false);
    expect(report.findings[0].code).toBe('unknown-node-type');
  });

  it('says so when it could not read them, instead of answering', () => {
    // 🔴 The instrument that silently exonerates, inverted: point the extractor
    // at nothing and the node list is empty for a completely different reason.
    // A vocabulary that cannot tell the two apart would call this bundle's own
    // node type a typo with full confidence.
    const dir = makeBundle('unreadable-kit', { withKit: true });
    const saved = process.env.NODEGX_KIT_EXTRACT;
    process.env.NODEGX_KIT_EXTRACT = path.join(tempDir, 'does-not-exist.cjs');
    try {
      const kits = bundleVocabularyFor(dir);

      expect(kits.overlay.unavailable).toBeDefined();
      expect(kits.vocabulary.isIncomplete).toBe(true);

      const report = verifyLessonManifest(LESSON, { vocabulary: kits.vocabulary });
      // ✅ D4: still an error, still blocking. Only the *claim* changes.
      expect(report.findings[0].severity).toBe('error');
      expect(report.findings[0].message).toContain('could not be read here');
      expect(report.findings[0].message).toContain('does-not-exist.cjs');
    } finally {
      process.env.NODEGX_KIT_EXTRACT = saved;
    }
  });

  it('does not leave one bundle’s kits answering for the next', () => {
    // Two bundles in one server session — the trap CN-003 names for the overlay
    // and which applies identically here, because these vocabularies are built
    // per call rather than installed into a module singleton.
    const withKit = bundleVocabularyFor(makeBundle('first-with-kit', { withKit: true }));
    const without = bundleVocabularyFor(makeBundle('second-no-kit', { withKit: false }));

    expect(withKit.vocabulary.classifyTypeName('demo.kit.Badge').code).toBe('ok');
    expect(without.vocabulary.classifyTypeName('demo.kit.Badge').code).toBe('unknown-node-type');
  });
});
