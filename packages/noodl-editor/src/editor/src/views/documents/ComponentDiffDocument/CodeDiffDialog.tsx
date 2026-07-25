import React from 'react';
import { ITextDiff } from '@noodl/git/src/core/models/diff-data';

import { CodeDiffView } from '@noodl-core-ui/components/code-editor';
import { IconName } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { BaseDialog, DialogBackground } from '@noodl-core-ui/components/layout/BaseDialog';
import { Container, ContainerDirection } from '@noodl-core-ui/components/layout/Container';

export interface CodeDiffDialogProps {
  diff: ITextDiff;
  onClose: () => void;
}

function anyToString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

export function CodeDiffDialog({ diff, onClose }: CodeDiffDialogProps) {
  return (
    <BaseDialog
      background={DialogBackground.Secondary}
      isVisible={diff !== null}
      hasBackdrop
      onClose={onClose}
      UNSAFE_style={{ width: '80vw' }}
    >
      <Container isFill direction={ContainerDirection.Vertical}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', zIndex: 100 }}>
          <IconButton icon={IconName.Close} onClick={onClose} />
        </div>
        <CodeDiffView original={anyToString(diff.original)} modified={anyToString(diff.modified)} height="80vh" />
      </Container>
    </BaseDialog>
  );
}
