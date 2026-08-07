/**
 * SUB-006 — False-positive corpus suite
 *
 * THE most important test in the task. Every known-good real project must
 * validate with ZERO errors. A validator that cries wolf on real projects is
 * ignored, so any error surfacing here is a bug in a rule — not in the fixture.
 *
 * The corpus is the same real-project set the git/import/round-trip suites use
 * (verbatim from tests/testfs/), plus the synthetic-awkward project that
 * exercises dynamic-port nodes, deep nesting, and variant/route edge cases.
 *
 * Warnings ARE expected: these legacy projects legitimately contain
 * module-provided and other-version node types the catalog cannot enumerate
 * (Markdown, module.inlineHtml, Rectangle, REST, On Item Action, …). Those are
 * honest observations, not false positives — the assertion is on *errors*.
 */

import { SemanticValidator } from '../../src/editor/src/validation/SemanticValidator';
import { fromLegacyProject, LegacyProjectLike } from '../../src/editor/src/validation/normalize';
import { formatDiagnosticLine } from '../../src/editor/src/validation/diagnostics';

/* eslint-disable @typescript-eslint/no-var-requires */
const CORPUS: Array<{ name: string; project: LegacyProjectLike }> = [
  { name: 'import_proj1', project: require('../testfs/import_proj1/project.json') },
  { name: 'import_proj2', project: require('../testfs/import_proj2/project.json') },
  { name: 'import_proj5', project: require('../testfs/import_proj5/project.json') },
  { name: 'watchproject', project: require('../testfs/watchproject/project.json') },
  { name: 'git-repo-utf8', project: require('../testfs/git-repo-utf8/project.json') },
  { name: 'big-merge-test-mine', project: require('../testfs/big-merge-test-mine/project.json') },
  { name: 'synthetic-awkward', project: require('../io/fixtures/synthetic-awkward.project.json') }
];
/* eslint-enable @typescript-eslint/no-var-requires */

describe('SUB-006 false-positive corpus', () => {
  const validator = new SemanticValidator();

  for (const { name, project } of CORPUS) {
    it(`validates ${name} with zero errors`, () => {
      const report = validator.validate(fromLegacyProject(project));
      if (report.summary.errors > 0) {
        // Surface exactly what misfired so the failure is actionable.
        const errs = report.diagnostics
          .filter((d) => d.severity === 'error')
          .map(formatDiagnosticLine)
          .join('\n');
        fail(`${name} produced ${report.summary.errors} error(s):\n${errs}`);
      }
      expect(report.summary.errors).toBe(0);
    });
  }

  it('produces zero dangling-connection, orphaned-node, or nonexistent-port errors across the whole corpus', () => {
    let staticErrors = 0;
    for (const { project } of CORPUS) {
      const report = validator.validate(fromLegacyProject(project));
      staticErrors += report.diagnostics.filter((d) => d.severity === 'error').length;
    }
    expect(staticErrors).toBe(0);
  });

  it('still surfaces useful warnings (unknown module/legacy types) on the large legacy corpus', () => {
    // Sanity: the validator is not silently passing everything — git-repo-utf8
    // carries module/legacy node types that should warn (with the tool still
    // functioning). This guards against a rule accidentally becoming a no-op.
    const gitRepo = CORPUS.find((c) => c.name === 'git-repo-utf8')!;
    const report = validator.validate(fromLegacyProject(gitRepo.project));
    expect(report.summary.warnings).toBeGreaterThan(0);
  });
});
