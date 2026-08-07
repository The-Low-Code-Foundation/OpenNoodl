/**
 * SUB-007 step 5: merge conflicts, in graph terms.
 *
 * Before this, the panel showed a banner that pushed the user at the warnings
 * list, where conflicts appeared one node at a time with no sense of the whole
 * merge. The merger now writes its full structured conflict list into the
 * merged project (see ProjectMerge.MERGE_CONFLICTS_KEY), so the panel can show
 * every conflict grouped by component and resolve them in place.
 *
 * Resolution scope, stated rather than hidden: value conflicts (parameters,
 * state values and transitions, labels, variants) are applied to the live
 * project. Structural conflicts — a node one side deleted and the other
 * edited, cross-side reparents, rewiring against a deleted node — are shown
 * for review and dismissed, not auto-applied: the merged project is already
 * ours-flavored, and re-deriving the other side's structure after the fact is
 * how silent corruption starts. Take the other side wholesale by re-running
 * the merge if that is what you want.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';
import { MERGE_CONFLICTS_KEY, readMergeConflicts } from '@noodl-versioning';
import type { ConflictSide, ProjectMergeConflict } from '@noodl-versioning';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { Container } from '@noodl-core-ui/components/layout/Container';
import { VStack } from '@noodl-core-ui/components/layout/Stack';
import { Section } from '@noodl-core-ui/components/sidebar/Section';
import { Label } from '@noodl-core-ui/components/typography/Label';
import { Text, TextSize, TextType } from '@noodl-core-ui/components/typography/Text';

import { GraphConflictList } from '../../GraphDiffPanel';

/** Conflict kinds whose chosen side can be applied to the live project. */
const APPLICABLE_KINDS = new Set([
  'parameter',
  'source-code',
  'state-parameter',
  'state-transition',
  'default-state-transition',
  'label',
  'variant'
]);

export function MergeConflicts() {
  const [conflicts, setConflicts] = useState<ProjectMergeConflict[]>([]);

  const load = useCallback(() => {
    const project = ProjectModel.instance;
    if (!project) {
      setConflicts([]);
      return;
    }
    setConflicts(readMergeConflicts({ metadata: { [MERGE_CONFLICTS_KEY]: project.getMetaData(MERGE_CONFLICTS_KEY) } }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unresolved = useMemo(() => conflicts.filter((conflict) => !conflict.resolution), [conflicts]);

  const persist = useCallback((next: ProjectMergeConflict[]) => {
    setConflicts(next);
    const remaining = next.filter((conflict) => !conflict.resolution);
    const project = ProjectModel.instance;
    if (!project) return;
    project.setMetaData(MERGE_CONFLICTS_KEY, remaining.length > 0 ? remaining.map(toPortable) : undefined);
  }, []);

  const resolve = useCallback(
    (conflictId: string, side: ConflictSide) => {
      const conflict = conflicts.find((entry) => entry.id === conflictId);
      if (!conflict) return;

      if (side === 'theirs' && APPLICABLE_KINDS.has(conflict.kind)) {
        applyToLiveProject(conflict);
      }

      persist(conflicts.map((entry) => (entry.id === conflictId ? { ...entry, resolution: side } : entry)));
    },
    [conflicts, persist]
  );

  const resolveAll = useCallback(
    (side: ConflictSide) => {
      if (side === 'theirs') {
        conflicts
          .filter((conflict) => !conflict.resolution && APPLICABLE_KINDS.has(conflict.kind))
          .forEach(applyToLiveProject);
      }
      persist(conflicts.map((entry) => (entry.resolution ? entry : { ...entry, resolution: side })));
    },
    [conflicts, persist]
  );

  if (conflicts.length === 0) {
    // A project merged by a build older than SUB-007 has the legacy
    // `node.conflicts` stamps (which raised the warnings that got us here) but
    // no structured list to render. Fall back to the banner rather than
    // showing an empty panel.
    return <LegacyConflictBanner />;
  }

  const reviewOnly = unresolved.filter((conflict) => !APPLICABLE_KINDS.has(conflict.kind)).length;

  return (
    <VStack>
      <Section hasVisibleOverflow hasGutter>
        <Container>
          <Icon icon={IconName.WarningTriangle} size={IconSize.Small} />
          <Box hasLeftSpacing>
            <Label variant={TextType.Shy}>Merge conflict</Label>
            <Label>
              {unresolved.length} unresolved of {conflicts.length}
            </Label>
          </Box>
        </Container>
      </Section>

      <Section hasVisibleOverflow hasGutter>
        <Text hasBottomSpacing size={TextSize.Small}>
          You and your collaborators changed the same things. Choose a side for each.
        </Text>
        {reviewOnly > 0 && (
          <Text size={TextSize.Small} textType={TextType.Shy} hasBottomSpacing>
            {reviewOnly} of these are structural (a node deleted on one side, moved on the other). Those are shown for
            review — your side is already what was kept.
          </Text>
        )}
      </Section>

      <GraphConflictList conflicts={conflicts} onResolve={resolve} onResolveAll={resolveAll} />
    </VStack>
  );
}

/** The pre-SUB-007 view: point the user at the per-node warnings. */
function LegacyConflictBanner() {
  return (
    <VStack>
      <Section hasVisibleOverflow hasGutter>
        <Container>
          <Icon icon={IconName.WarningTriangle} size={IconSize.Small} />
          <Box hasLeftSpacing>
            <Label variant={TextType.Shy}>Warning</Label>
            <Label>Merge conflict</Label>
          </Box>
        </Container>
      </Section>
      <Section hasVisibleOverflow hasGutter>
        <Text hasBottomSpacing>
          You and your collaborators have made changes to the same nodes and you need to resolve them
        </Text>
        <PrimaryButton
          label="Open warnings"
          isGrowing
          size={PrimaryButtonSize.Small}
          onClick={() => {
            document.getElementById('editortopbar-warning-button').click();
          }}
        />
      </Section>
    </VStack>
  );
}

function toPortable(conflict: ProjectMergeConflict) {
  return {
    id: conflict.id,
    kind: conflict.kind,
    component: conflict.component,
    variant: conflict.variant,
    nodeId: conflict.node?.id,
    nodeType: conflict.node?.type,
    nodeLabel: conflict.node?.label,
    name: conflict.name,
    state: conflict.state,
    deletedBy: conflict.deletedBy,
    ours: conflict.ours,
    theirs: conflict.theirs
  };
}

/**
 * Apply the other side of a value conflict to the live project, going through
 * the models so undo, save and the canvas all see it as a normal edit.
 */
function applyToLiveProject(conflict: ProjectMergeConflict): void {
  const project = ProjectModel.instance;
  if (!project || !conflict.node) return;

  const component = conflict.component ? project.getComponentWithName(conflict.component) : undefined;
  const node = component?.graph?.findNodeWithId(conflict.node.id);
  if (!node) return;

  switch (conflict.kind) {
    case 'parameter':
    case 'source-code':
      node.setParameter(conflict.name, conflict.theirs);
      break;
    case 'label':
      node.setLabel(conflict.theirs as string);
      break;
    case 'variant':
      // Variants are set by name against the node's type.
      node.setVariant?.(conflict.theirs);
      break;
    case 'state-parameter':
      node.setParameter(conflict.name, conflict.theirs, { state: conflict.state });
      break;
    case 'state-transition':
      node.setStateTransition(conflict.state, conflict.name, conflict.theirs);
      break;
    case 'default-state-transition':
      node.setDefaultStateTransition(conflict.state, conflict.theirs);
      break;
    default:
      break;
  }
}
