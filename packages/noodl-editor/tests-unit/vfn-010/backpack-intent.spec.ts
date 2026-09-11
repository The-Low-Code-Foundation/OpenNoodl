/**
 * VFN-010 — every sentence the backpack manager says, and the honesty each one has to carry.
 *
 * > *"Used in **8 places across 2 of your 4 recent projects**. It may be used in projects not
 * > listed here, and in projects on other machines. Changes apply everywhere this block is used."*
 *
 * 🔴 Three properties, all deliberate, and each one graded below:
 *
 * 1. **the number is real** — it counts distinct nodes in projects that were actually read;
 * 2. **its scope is stated** — criterion 3, *"the cross-project usage check names the projects it
 *    scanned and says so in the sentence"*;
 * 3. **the warning does not depend on the number being complete** — the propagation clause is
 *    present whether the count is eight or zero, because *"a count presented as total when it is a
 *    sample is a warning that teaches the builder to distrust warnings."*
 *
 * ⚠️ These sentences are run through VFN-009's `UNPROVABLE_CLAIM` too, with its own negative
 * control, because the boundary — *may claim a refusal, may not claim a flow is broken* — is a
 * property of the feature and not of the file the sentence happens to live in. This file
 * deliberately contains the forbidden vocabulary, in the control; what matters is which side of the
 * assertion it is on.
 */

import {
  BACKPACK_EDIT_NOTE,
  BACKPACK_EMPTY,
  BACKPACK_INTRO,
  CROSS_PROJECT_CAVEAT,
  CROSS_PROJECT_PROPAGATION,
  crossProjectLines,
  crossProjectSiteLine,
  describeCheckedAt,
  describeCrossProjectRefusal,
  describeCrossProjectUsage,
  describeImportResult,
  describeScannedProjects,
  describeUncheckedUsage,
  describeExportResult,
  describeUnreadableProjects,
  exportSucceeded,
  unprovableClaimIn
} from '../../src/editor/src/views/BlocklyEditor/myblocks/libraryIntent';
import {
  noCrossProjectCheck,
  type CrossProjectUsage
} from '../../src/editor/src/views/BlocklyEditor/myblocks/crossProjectUsage';
import type { UsageSite } from '../../src/editor/src/views/BlocklyEditor/myblocks/usage';

function site(nodeId: string, nodeName: string, componentPath: string): UsageSite {
  return {
    nodeId,
    nodeName,
    componentId: `${nodeId}-c`,
    componentName: componentPath.split('/').pop() ?? '',
    componentPath
  };
}

function scannedName(name: string) {
  return { id: `${name}-id`, name, path: `/projects/${name}` };
}

/** The report's own example: 8 places, 2 projects, 4 recent projects checked. */
const EIGHT_PLACES: CrossProjectUsage = {
  definitionId: 'd1',
  scanned: ['Alpha', 'Beta', 'Gamma', 'Delta'].map(scannedName),
  unreadable: [],
  projects: [
    {
      projectName: 'Alpha',
      projectPath: '/projects/Alpha',
      sites: [
        site('n1', 'Order total', '/Pages/Checkout'),
        site('n2', 'Shipping', '/Pages/Checkout'),
        site('n3', 'Basket line', '/Pages/Cart'),
        site('n4', 'Receipt', '/Pages/Receipt'),
        site('n5', 'Refund', '/Pages/Refund')
      ]
    },
    {
      projectName: 'Beta',
      projectPath: '/projects/Beta',
      sites: [site('n6', 'Quote', '/Pages/Quote'), site('n7', 'Invoice', '/Pages/Invoice'), site('n8', 'Line', '/Pages/Line')]
    }
  ],
  projectCount: 2,
  siteCount: 8,
  checkedAt: '2026-08-13T10:00:00.000Z'
};

const FOUND_NOTHING: CrossProjectUsage = {
  definitionId: 'd1',
  scanned: ['Alpha', 'Beta', 'Gamma', 'Delta'].map(scannedName),
  unreadable: [],
  projects: [],
  projectCount: 0,
  siteCount: 0,
  checkedAt: '2026-08-13T10:00:00.000Z'
};

const WITH_UNREADABLE: CrossProjectUsage = {
  ...FOUND_NOTHING,
  scanned: [scannedName('Alpha')],
  unreadable: [{ name: 'Beta', path: '/projects/Beta', reason: 'the folder is no longer there' }]
};

/** Every sentence this task added, over a spread of inputs. Used by the boundary check. */
function everyNewSentence(): string[] {
  return [
    CROSS_PROJECT_CAVEAT,
    CROSS_PROJECT_PROPAGATION,
    BACKPACK_EDIT_NOTE,
    BACKPACK_INTRO,
    BACKPACK_EMPTY,
    ...crossProjectLines(EIGHT_PLACES),
    crossProjectSiteLine('Alpha', site('n1', 'Order total', '/Pages/Checkout')),
    describeScannedProjects(EIGHT_PLACES),
    describeScannedProjects(noCrossProjectCheck('d1')),
    describeUnreadableProjects(WITH_UNREADABLE),
    describeCrossProjectUsage('Discount', EIGHT_PLACES),
    describeCrossProjectUsage('Discount', FOUND_NOTHING),
    describeCrossProjectUsage('Discount', WITH_UNREADABLE),
    describeCrossProjectUsage('Discount', noCrossProjectCheck('d1')),
    describeUncheckedUsage('Discount'),
    describeCheckedAt(EIGHT_PLACES, new Date('2026-08-13T10:00:30.000Z')),
    describeCheckedAt(EIGHT_PLACES, new Date('2026-08-13T10:07:00.000Z')),
    describeCrossProjectRefusal('Discount', EIGHT_PLACES),
    describeImportResult(3, 0, 'user'),
    describeImportResult(3, 1, 'user'),
    describeImportResult(0, 2, 'project'),
    describeImportResult(0, 0, 'user'),
    describeExportResult('Discount', 0),
    describeExportResult('Discount', 1),
    describeExportResult('Discount', 3)
  ].filter((sentence) => sentence !== '');
}

describe('VFN-010 criterion 3 — the sentence names what its number is a sample of', () => {
  it('leads with the real count and then says what was checked, by name', () => {
    const sentence = describeCrossProjectUsage('Discount', EIGHT_PLACES);

    expect(sentence).toContain('"Discount" is used in 8 places across 2 projects.');
    // 🔴 Criterion 3. Without the names, "2 of 4" is a ratio a builder cannot verify or act on.
    expect(sentence).toContain('4 recent projects were checked: Alpha, Beta, Gamma, Delta.');
  });

  it('carries the caveat and the propagation clause whether the count is eight or zero', () => {
    // 🔴 The warning must not depend on the number being complete. A count of zero is exactly when
    // a builder is about to delete, and exactly when "it may be used elsewhere" matters most.
    for (const usage of [EIGHT_PLACES, FOUND_NOTHING]) {
      const sentence = describeCrossProjectUsage('Discount', usage);
      expect(sentence).toContain(CROSS_PROJECT_CAVEAT);
      expect(sentence).toContain(CROSS_PROJECT_PROPAGATION);
    }

    expect(describeCrossProjectUsage('Discount', FOUND_NOTHING)).toContain('was not found in any of the projects checked');
  });

  it('🔴 says a project could not be read rather than counting it as an absence', () => {
    const sentence = describeCrossProjectUsage('Discount', WITH_UNREADABLE);

    expect(sentence).toContain('1 recent project was checked: Alpha.');
    expect(sentence).toContain('1 project in your list could not be read and was not counted: Beta.');

    // 🔴 CONTROL — the same builder over a scan with nothing unreadable says nothing about it, so
    // the sentence above is a report and not a clause that is always printed.
    expect(describeUnreadableProjects(EIGHT_PLACES)).toBe('');
    expect(describeCrossProjectUsage('Discount', FOUND_NOTHING)).not.toContain('could not be read');
  });

  it('🔴 says "not checked" for a check that never ran, and never "not used"', () => {
    const never = describeCrossProjectUsage('Discount', noCrossProjectCheck('d1'));

    expect(never).toBe(describeUncheckedUsage('Discount'));
    expect(never).toContain('has not been checked');

    // 🔴 CONTROL — and the sentence for a check that *did* run and found nothing is a different
    // sentence. Rendering the two the same way is how "not used anywhere" gets said about a
    // question nobody asked, which is a licence to delete.
    expect(describeCrossProjectUsage('Discount', FOUND_NOTHING)).not.toBe(never);
    expect(describeCrossProjectUsage('Discount', FOUND_NOTHING)).toContain('was not found');
  });

  it('names every place, project first', () => {
    const lines = crossProjectLines(EIGHT_PLACES);

    expect(lines).toHaveLength(8);
    expect(lines[0]).toBe('Alpha · /Pages/Checkout · Order total');
    expect(lines[7]).toBe('Beta · /Pages/Line · Line');
  });

  it('says how long ago the answer was true', () => {
    expect(describeCheckedAt(EIGHT_PLACES, new Date('2026-08-13T10:00:30.000Z'))).toBe('Checked just now.');
    expect(describeCheckedAt(EIGHT_PLACES, new Date('2026-08-13T10:07:00.000Z'))).toBe('Checked 7 minutes ago.');
    // Nothing to say about a check that never ran, so the row prints nothing rather than "0".
    expect(describeCheckedAt(noCrossProjectCheck('d1'))).toBe('');
  });
});

describe('VFN-010 criterion 5 — the delete refusal names the projects', () => {
  it('names them, and keeps the caveat', () => {
    const refusal = describeCrossProjectRefusal('Discount', EIGHT_PLACES);

    expect(refusal).toContain('"Discount" is still used in 8 places across 2 projects — Alpha, Beta.');
    expect(refusal).toContain('pointing at nothing');
    // Even a refusal is a sample: the block may be used somewhere this scan could not see, and the
    // refusal must not read as an exhaustive list the builder can go and clear.
    expect(refusal).toContain(CROSS_PROJECT_CAVEAT);
  });

  it('reads correctly for a single site', () => {
    const one: CrossProjectUsage = {
      ...EIGHT_PLACES,
      projects: [{ projectName: 'Alpha', projectPath: '/projects/Alpha', sites: [site('n1', 'Order total', '/Pages/Checkout')] }],
      projectCount: 1,
      siteCount: 1
    };
    expect(describeCrossProjectRefusal('Discount', one)).toContain('1 place across 1 project — Alpha');
    expect(describeCrossProjectRefusal('Discount', one)).toContain('that call block');
  });
});

describe('VFN-010 — the launcher states its limitation rather than working around it', () => {
  it('says where the blocks themselves are edited', () => {
    // 🔴 VFN-010 option 2, explicitly. What is *not acceptable* is a second Blockly host in the
    // launcher with its own save path — two writers to one shelf, in front of a 1000 ms debounce.
    expect(BACKPACK_EDIT_NOTE).toContain('no canvas');
    expect(BACKPACK_EDIT_NOTE).toContain('Saved blocks');
  });

  it('says what the backpack costs a collaborator', () => {
    expect(BACKPACK_INTRO).toContain('follow you between projects');
    expect(BACKPACK_INTRO).toContain('collaborator');
  });

  it('🔴 DEFECT FOUND IN VFN-009 — an export of a definition that has gone says so, not "-1"', () => {
    // Reproduced against the real store before fixing: `exportDefinitions(['gone'])` returns an
    // EMPTY library, and the merged section rendered `its ${definitions.length - 1} dependencies`
    // inline as a **success** toast — *"Copied "Discount" and its -1 dependencies to the
    // clipboard."* for a copy of nothing. The window is real: the same shelf now has two managers
    // over it, so a row can be rendered here and the definition deleted from the other one.
    expect(exportSucceeded(0)).toBe(false);
    expect(describeExportResult('Discount', 0)).toBe('"Discount" is not on either shelf any more, so there was nothing to copy.');
    expect(describeExportResult('Discount', 0)).not.toContain('-1');
    expect(describeExportResult('Discount', 0)).not.toContain('Copied');

    // 🔴 CONTROL — the same builder over a real export does say Copied, and counts the
    // dependencies as the closure minus the definition itself. Without this, "does not say
    // Copied" is indistinguishable from a function that never says anything.
    expect(exportSucceeded(1)).toBe(true);
    expect(describeExportResult('Discount', 1)).toBe('Copied "Discount" to the clipboard.');
    expect(describeExportResult('Discount', 3)).toBe('Copied "Discount" and the 2 saved blocks it depends on to the clipboard.');
    expect(describeExportResult('Discount', 2)).toContain('1 saved block it depends on');
  });

  it('reports what an import actually did, including what it skipped', () => {
    expect(describeImportResult(3, 0, 'user')).toBe('Imported 3 saved blocks into your backpack.');
    expect(describeImportResult(1, 0, 'project')).toBe('Imported 1 saved block into this project.');
    expect(describeImportResult(3, 1, 'user')).toContain('1 entry in the file could not be read');
    expect(describeImportResult(0, 0, 'user')).toBe('That file contained no saved blocks.');
  });
});

describe('🔴 VFN-010 — the boundary VFN-009 drew applies to these sentences too', () => {
  it('no sentence this task added claims a program stops doing what it did', () => {
    const offenders = everyNewSentence()
      .map((sentence) => ({ sentence, claim: unprovableClaimIn(sentence) }))
      .filter((entry) => entry.claim !== null);

    expect(offenders).toEqual([]);
  });

  it('🔴 NEGATIVE CONTROL — the same detector convicts the sentences this surface is tempted by', () => {
    // A detector that only ever sees compliant input is indistinguishable from one that returns
    // `null` unconditionally. Each of these is a sentence a cross-project warning wants to write,
    // and each one claims something no scan of a folder can know.
    const tempting = [
      'Deleting this will break 8 flows across 2 of your projects.',
      'Editing this block may stop working in projects you have not opened.',
      'These 8 call sites will no longer work after this change.',
      'This change alters the behaviour of two other projects.',
      'Your other projects will not run correctly until you reopen them.'
    ];

    for (const sentence of tempting) {
      expect(unprovableClaimIn(sentence)).not.toBeNull();
    }

    // …and it is not convicting everything: the claims this task *does* make all pass.
    expect(unprovableClaimIn(describeCrossProjectUsage('Discount', EIGHT_PLACES))).toBeNull();
    expect(unprovableClaimIn(describeCrossProjectRefusal('Discount', EIGHT_PLACES))).toBeNull();
  });

  it('🔴 the sweep above is over a real spread of sentences, not an empty list', () => {
    // A boundary check that swept nothing would pass loudly and prove nothing. Watched here rather
    // than assumed: the count is the number of distinct sentences the module produced above.
    const sentences = everyNewSentence();
    expect(sentences.length).toBeGreaterThan(20);
    expect(new Set(sentences).size).toBeGreaterThan(15);
  });
});
