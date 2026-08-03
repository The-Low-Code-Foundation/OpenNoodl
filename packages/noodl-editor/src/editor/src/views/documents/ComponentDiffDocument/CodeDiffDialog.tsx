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
  // `isVisible` decides whether the dialog *shows*, but the children below are
  // evaluated either way — and `DiffList` renders this with `diff === null` for
  // as long as nothing is selected, which is its resting state. So reading
  // `diff.original` threw on the panel's very first render and the whole of
  // Version Control fell into its error boundary.
  if (diff === null || diff === undefined) {
    return null;
  }

  return (
    <BaseDialog
      // POL-004: was DialogBackground.Secondary, which is the neutral ACTION
      // colour (#eef2f6 dark / #18212b light) — inverted relative to a surface
      // by construction, so it produced a white sheet in dark mode and a black
      // one in light. This is the modal Richard reported. Bg1 is a real surface.
      background={DialogBackground.Bg1}
      isVisible
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
