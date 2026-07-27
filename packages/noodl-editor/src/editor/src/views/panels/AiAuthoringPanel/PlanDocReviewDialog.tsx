/**
 * AIX-011 criterion 7 — the plan's doc review.
 *
 * A `doc` operation is reviewed the same way a component operation is: as a
 * diff, before anything is written, with reject meaning the absence of a write.
 * It is a dialog rather than a document because the review belongs *to the
 * plan* — the user is deciding whether this line item stays in the set they are
 * about to apply, not opening a file — and because a plan can carry several,
 * which would otherwise litter the tab bar.
 *
 * Excluding here is the same `excludeOperation` the component rows use, so a
 * dropped doc participates in the plan's exclusion closure like everything else.
 *
 * @module noodl-editor/views/panels/AiAuthoringPanel/PlanDocReviewDialog
 */

import React from 'react';

import type { StagedDoc } from '@noodl-models/AiAssistant/authoring';

import { FeedbackType } from '@noodl-constants/FeedbackType';
import { CodeDiffView } from '@noodl-core-ui/components/code-editor';
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { BaseDialog, DialogBackground } from '@noodl-core-ui/components/layout/BaseDialog';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

export interface PlanDocReviewDialogProps {
  doc: StagedDoc;
  /** Keep it in the plan and close. */
  onKeep: () => void;
  /** Drop this operation from the plan — nothing is written either way. */
  onExclude: () => void;
  onClose: () => void;
}

export function PlanDocReviewDialog({ doc, onKeep, onExclude, onClose }: PlanDocReviewDialogProps) {
  return (
    <BaseDialog
      background={DialogBackground.Secondary}
      isVisible
      hasBackdrop
      onClose={onClose}
      UNSAFE_style={{ width: '80vw' }}
    >
      <Box hasXSpacing hasYSpacing UNSAFE_style={{ width: '100%' }}>
        <VStack UNSAFE_style={{ gap: 8 }}>
          <HStack UNSAFE_style={{ alignItems: 'center', gap: 8 }}>
            <VStack UNSAFE_style={{ gap: 2, flex: 1 }}>
              <Text textType={TextType.Proud}>
                {doc.baseline === null ? `New file — ${doc.path}` : `Proposed change to ${doc.path}`}
              </Text>
              <Text textType={TextType.Shy}>
                {doc.summary ?? 'Written when you apply the plan, in the same undo step as its components.'}
              </Text>
            </VStack>
            <PrimaryButton label="Keep" icon={IconName.Check} onClick={onKeep} />
            <PrimaryButton label="Drop from plan" variant={PrimaryButtonVariant.Danger} onClick={onExclude} />
          </HStack>

          {doc.lintFindings.length > 0 && (
            <HStack UNSAFE_style={{ alignItems: 'flex-start', gap: 6 }}>
              <Icon icon={IconName.WarningTriangle} variant={FeedbackType.Notice} size={IconSize.Small} />
              <VStack UNSAFE_style={{ gap: 2, flex: 1 }}>
                <Text textType={TextType.Secondary}>
                  {doc.lintFindings.length} line{doc.lintFindings.length === 1 ? '' : 's'} may describe the graph
                  rather than the reasoning behind it. Those go stale the first time someone rearranges the canvas
                  — the editor can already narrate any component on demand.
                </Text>
                {doc.lintFindings.slice(0, 4).map((finding) => (
                  <Text key={finding} textType={TextType.Shy}>
                    {finding}
                  </Text>
                ))}
              </VStack>
            </HStack>
          )}

          <CodeDiffView original={doc.baseline ?? ''} modified={doc.proposed} height="70vh" />
        </VStack>
      </Box>
    </BaseDialog>
  );
}
