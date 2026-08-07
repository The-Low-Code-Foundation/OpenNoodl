/**
 * What changes when a project changes backends.
 *
 * This is the moment BCN-009 exists to catch. Under one merged node family a
 * user can pick a different backend from a list and, without being told, change
 * whether their published app carries a key any visitor can copy, and change
 * which product's admin screen decides what that visitor may do. Nothing else in
 * the editor is positioned to say so — by the time it is visible it is deployed.
 *
 * Two rules the dialog follows, both from the task's traps:
 *
 * - **It is a comparison, not a warning.** Two columns, the same two facts on
 *   each side, so the difference is the thing you read. No red, no
 *   `isDangerousAction`: choosing a backend is not a destructive act.
 * - **It never blocks.** Confirm and cancel, and confirm is the primary. OPS-006
 *   owns blocking, at Live and Scale, on a Critical finding — and adding a
 *   second, differently-shaped gate here is what its spec asks us not to do.
 *
 * @module BackendServicesPanel/SecurityDisclosure/BackendSwitchDialog
 */

import React from 'react';

import { BackendSwitchDisclosure } from '@noodl-models/BackendServices';

import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { Modal } from '@noodl-core-ui/components/layout/Modal';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './BackendSwitchDialog.module.scss';

export interface BackendSwitchDialogProps {
  isVisible: boolean;
  /** Null while nothing is being switched — the dialog renders nothing. */
  disclosure: BackendSwitchDisclosure | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function BackendSwitchDialog({ isVisible, disclosure, onConfirm, onCancel }: BackendSwitchDialogProps) {
  if (!disclosure) return null;

  return (
    <Modal isVisible={isVisible} onClose={onCancel} title="Change this project's backend">
      <VStack hasSpacing>
        <div className={css.Columns} data-test="backend-switch-comparison">
          <div className={css.Column}>
            <Text textType={TextType.Shy} className={css.ColumnLabel}>
              Now
            </Text>
            <Text textType={TextType.DefaultContrast}>{disclosure.from.name}</Text>
            <Text textType={TextType.Shy} className={css.Fact}>
              Publishes {disclosure.from.publishes}.
            </Text>
            <Text textType={TextType.Shy} className={css.Fact}>
              Access decided by {disclosure.from.rulesLiveIn}.
            </Text>
          </div>

          <div className={css.Column}>
            <Text textType={TextType.Shy} className={css.ColumnLabel}>
              After this change
            </Text>
            <Text textType={TextType.DefaultContrast}>{disclosure.to.name}</Text>
            <Text textType={TextType.Shy} className={css.Fact}>
              Publishes {disclosure.to.publishes}.
            </Text>
            <Text textType={TextType.Shy} className={css.Fact}>
              Access decided by {disclosure.to.rulesLiveIn}.
            </Text>
          </div>
        </div>

        {disclosure.tokenVisibilityChange && (
          <Box hasTopSpacing>
            <div className={css.Note} data-test="backend-switch-token-change">
              <Text textType={TextType.Default}>{disclosure.tokenVisibilityChange}</Text>
            </div>
          </Box>
        )}

        <Box hasTopSpacing>
          <Text textType={TextType.Shy}>{disclosure.rulesDoNotTravel}</Text>
        </Box>

        <HStack hasSpacing UNSAFE_style={{ justifyContent: 'flex-end' }}>
          <PrimaryButton label="Cancel" variant={PrimaryButtonVariant.Muted} onClick={onCancel} />
          <PrimaryButton label="Use this backend" onClick={onConfirm} testId="confirm-backend-switch" />
        </HStack>
      </VStack>
    </Modal>
  );
}
