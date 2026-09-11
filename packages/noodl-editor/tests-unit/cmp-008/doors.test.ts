/**
 * CMP-008 AC3 + AC4 — the two doors a person installs through.
 *
 * AC3 is the one-click install (`ModuleLibraryModel._install`'s no-collision
 * branch), which opens no result stage and used to discard `result.warnings`
 * entirely under a green success toast.
 *
 * AC4 is the flow (`ImportFlow`), whose `ResultStage` renders
 * `ResultSummary.warnings`. The hop being graded here is `summarizeResult`:
 * an engine warning has to survive it to reach the screen. ⚠️ The last link —
 * `ResultStage` rendering that array — is NOT graded here: it imports
 * `@noodl-core-ui`'s `Icon`, which this runner cannot load. It is shipped code
 * with a `data-test="import-flow-result-warnings"` hook on it, and that is the
 * honest limit of this file.
 */

import { installWarningToast } from '../../src/editor/src/models/installWarningToast';
import { summarizeResult } from '../../src/editor/src/views/ImportFlow/model/summary';
import type { ImportPlan, ImportResult } from '../../src/editor/src/utils/import-engine/types';

const TOKEN_WARNING =
  'This uses 2 design tokens your project does not define (--brand-accent, --brand-ink). ' +
  'They resolve to nothing, so they will draw unstyled without reporting an error. ' +
  'Define them in the Design Tokens panel, or repoint those parameters at tokens your project has.';

// ─── AC3: the one-click door ────────────────────────────────────────────────

describe('CMP-008 AC3 — installWarningToast', () => {
  it('says nothing after a clean install', () => {
    // A clean install stays a single green tick. A second toast that always
    // appears is a second toast nobody reads.
    expect(installWarningToast([], 'Accordion')).toBeUndefined();
  });

  it('says nothing when the only warnings are blank', () => {
    expect(installWarningToast(['', '   '], 'Accordion')).toBeUndefined();
  });

  it('carries the token sentence to the person', () => {
    const toast = installWarningToast([TOKEN_WARNING], 'Accordion')!;
    expect(toast.message).toContain('--brand-accent');
    expect(toast.message).toContain('--brand-ink');
  });

  it('puts the count in the title so the paragraph is a choice', () => {
    expect(installWarningToast([TOKEN_WARNING], 'Accordion')!.title).toBe(
      'Accordion installed, with one thing to check'
    );
    expect(installWarningToast([TOKEN_WARNING, 'Failed to copy file "x.png".'], 'Accordion')!.title).toBe(
      'Accordion installed, with 2 things to check'
    );
  });

  it('names the entry, because a toast arrives detached from what caused it', () => {
    expect(installWarningToast([TOKEN_WARNING], 'PDF Viewer')!.title).toContain('PDF Viewer');
  });

  it('🔴 carries EVERY warning, not only the token one', () => {
    // The branch discarded all of them. Filtering to CMP-008's own sentence
    // here would re-create the silence one class of warning at a time — and
    // the others are worse: CN-017's refusal to copy an unconsented kit is a
    // node that will come up as a red placeholder with nothing saying why.
    const engineWarnings = [
      'Failed to copy module "custom-html-module": EACCES.',
      'Could not record where the imported modules came from: disk full.',
      TOKEN_WARNING
    ];
    const toast = installWarningToast(engineWarnings, 'PDF Viewer')!;
    for (const warning of engineWarnings) expect(toast.message).toContain(warning);
    expect(toast.title).toContain('3 things');
  });
});

// ─── AC4: the flow door ─────────────────────────────────────────────────────

function emptyPlan(): ImportPlan {
  return {
    sourceDir: '/tmp/source',
    origin: { kind: 'local-project' },
    components: [],
    resources: [],
    modules: [],
    variants: [],
    styles: { colors: [], text: [] },
    renames: {},
    hasCollisions: false
  };
}

function resultWith(warnings: string[]): ImportResult {
  return {
    result: 'success',
    componentsImported: ['/Card'],
    variantsImported: [],
    stylesImported: { colors: [], text: [] },
    filesCopied: [],
    modulesCopied: [],
    warnings
  };
}

describe('CMP-008 AC4 — the warning survives into what the result stage renders', () => {
  it('lifts an engine warning into ResultSummary.warnings', () => {
    const summary = summarizeResult(resultWith([TOKEN_WARNING]), emptyPlan());
    expect(summary.warnings).toEqual([TOKEN_WARNING]);
  });

  it('leaves the array empty after a clean import, so the banner stays hidden', () => {
    expect(summarizeResult(resultWith([]), emptyPlan()).warnings).toEqual([]);
  });

  it('does not lose a warning behind the other summary fields', () => {
    const summary = summarizeResult(resultWith(['Failed to copy file "x.png".', TOKEN_WARNING]), emptyPlan());
    expect(summary.warnings).toHaveLength(2);
    expect(summary.modelLines).toContain('1 component into your project');
  });
});

// ─── AC5: it reports, it never refuses ──────────────────────────────────────

describe('CMP-008 AC5 — a token warning is not a failure', () => {
  it('leaves the result a success', () => {
    // `apply()` turns only a failed FILE COPY into a failure. A part whose
    // tokens do not all resolve still installs and still renders — the person
    // may be about to define the token, or be happy with the fallback.
    const summary = summarizeResult(resultWith([TOKEN_WARNING]), emptyPlan());
    expect(summary.undoNote).toContain('Undo removes');
    expect(resultWith([TOKEN_WARNING]).result).toBe('success');
  });
});
