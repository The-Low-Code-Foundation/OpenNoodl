/**
 * LIB-006: the rebuild verdict.
 *
 * `COMPATIBILITY-POLICY.md` says plainly that "delete and rebuild" is an
 * acceptable outcome, and that "the import report saying so plainly is a better
 * product than a broken half-conversion". This computes when to say it.
 *
 * The calculus has two terms, and both are needed. Fidelity alone would tell a
 * 4000-node project with 5% unconverted to rebuild, which is absurd — 200 broken
 * nodes are worth repairing when the alternative is re-authoring 3800 good ones.
 * Size alone would tell a tiny, perfectly-converted project to rebuild. The
 * recommendation is `rebuild` only where *both* say so: a small project with a
 * large unconverted share.
 *
 * @module noodl-editor/utils/import-engine/legacy/verdict
 */

import type { LegacyFinding, LegacyOutcome, RebuildVerdict } from './types';

/**
 * Above this share of unconverted constructs, a small project is cheaper to
 * rebuild than to repair.
 *
 * A quarter is a judgement, not a measurement, and it is the number the policy's
 * own worked example implies ("this project is small and 40% unconvertible").
 * It is deliberately generous to repair: below a quarter, repair always wins.
 */
export const REBUILD_UNCONVERTED_SHARE = 0.25;

/**
 * At or below this many nodes, re-authoring the project by hand is a session's
 * work rather than a project's. Above it, repair wins regardless of fidelity —
 * there is too much working material to throw away.
 */
export const REBUILD_MAX_NODES = 150;

/** How many constructs a finding accounts for (aggregated findings cover many). */
export function findingWeight(finding: LegacyFinding): number {
  return finding.occurrences ?? 1;
}

/**
 * Tally the four outcomes so they sum to `constructsAssessed`.
 *
 * Nodes whose type is current earn no finding — they are the difference between
 * what was assessed and what the findings account for, and they are all
 * `converted`. Folding them in here is what makes the sum an identity rather
 * than an approximation, and `report.ts` publishes both sides of it.
 */
export function tallyOutcomes(findings: LegacyFinding[], constructsAssessed: number): Record<LegacyOutcome, number> {
  const counts: Record<LegacyOutcome, number> = {
    converted: 0,
    'converted-with-changes': 0,
    placeholder: 0,
    dropped: 0
  };
  let accountedFor = 0;
  for (const finding of findings) {
    const weight = findingWeight(finding);
    counts[finding.outcome] += weight;
    accountedFor += weight;
  }
  counts.converted += Math.max(0, constructsAssessed - accountedFor);
  return counts;
}

export interface VerdictInput {
  counts: Record<LegacyOutcome, number>;
  constructsAssessed: number;
  nodeCount: number;
}

export function computeVerdict({ counts, constructsAssessed, nodeCount }: VerdictInput): RebuildVerdict {
  const unconvertedCount = counts.placeholder + counts.dropped;
  const converted = counts.converted + counts['converted-with-changes'];
  const fidelity = constructsAssessed === 0 ? 1 : converted / constructsAssessed;
  const unconvertedShare = constructsAssessed === 0 ? 0 : unconvertedCount / constructsAssessed;
  const reasons: string[] = [];

  if (counts.placeholder === 0 && counts.dropped === 0) {
    if (counts['converted-with-changes'] > 0) {
      reasons.push(
        `${counts['converted-with-changes']} construct${counts['converted-with-changes'] === 1 ? ' was' : 's were'} rewritten during the import.`
      );
    }
    reasons.push('Nothing was left unconverted.');
    return {
      recommendation: 'proceed',
      fidelity,
      nodeCount,
      unconvertedCount: 0,
      reasons,
      message:
        counts['converted-with-changes'] > 0
          ? 'Everything in this project converted. Some constructs were rewritten on the way in — the entries below say exactly what changed, and are worth a read before you trust the behaviour. Nothing needs repairing.'
          : 'Everything in this project converted unchanged. There is nothing to repair.'
    };
  }

  reasons.push(
    `${unconvertedCount} of ${constructsAssessed} construct${constructsAssessed === 1 ? '' : 's'} (${Math.round(unconvertedShare * 100)}%) could not be converted.`
  );
  reasons.push(`The imported set is ${nodeCount} node${nodeCount === 1 ? '' : 's'}.`);

  const small = nodeCount <= REBUILD_MAX_NODES;
  const poor = unconvertedShare >= REBUILD_UNCONVERTED_SHARE;

  if (small && poor) {
    reasons.push(
      `Both thresholds are met: at or under ${REBUILD_MAX_NODES} nodes, and at or over ${Math.round(REBUILD_UNCONVERTED_SHARE * 100)}% unconverted.`
    );
    return {
      recommendation: 'rebuild',
      fidelity,
      nodeCount,
      unconvertedCount,
      reasons,
      message: `This project is small (${nodeCount} nodes) and ${Math.round(unconvertedShare * 100)}% of it did not convert. Rebuilding it in NodeGX will almost certainly cost you less than repairing this import. The entries below tell you what the project did, which is the part worth keeping — treat them as a specification to rebuild from rather than a defect list to work through.`
    };
  }

  reasons.push(
    small
      ? `Under the ${Math.round(REBUILD_UNCONVERTED_SHARE * 100)}% unconverted threshold, so there is more working material than broken.`
      : `Over ${REBUILD_MAX_NODES} nodes, so there is too much working material to discard.`
  );
  return {
    recommendation: 'repair',
    fidelity,
    nodeCount,
    unconvertedCount,
    reasons,
    message: `${unconvertedCount} construct${unconvertedCount === 1 ? '' : 's'} did not convert, out of ${constructsAssessed}. Repairing is the right call here — the rest of the project came across intact. Each unconverted construct is still on the canvas, marked as an error, with its original type and parameters, so nothing has to be recovered from the source project.`
  };
}
