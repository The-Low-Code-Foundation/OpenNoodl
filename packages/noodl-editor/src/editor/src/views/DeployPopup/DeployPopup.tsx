import React, { RefObject } from 'react';

import { ActivityIndicator } from '@noodl-core-ui/components/common/ActivityIndicator';
import { BaseDialog } from '@noodl-core-ui/components/layout/BaseDialog';
import { Tabs } from '@noodl-core-ui/components/layout/Tabs';
import { PopupSection } from '@noodl-core-ui/components/popups/PopupSection';

import { DeployContextProvider, useDeployContext } from './DeployPopup.context';
import { DeployToFolderTab } from './tabs/DeployToFolderTab';

function DeployPopupChild() {
  const { hasActivity } = useDeployContext();

  return (
    <div style={{ width: 400 }}>
      <div
        style={{
          // NAT-003: this dialog is an elevation surface and must follow the ramp.
          // It was `#444444` from the initial commit — near enough to the old dark
          // `bg-4` to pass unnoticed, and a grey slab in light, where ~295px of it
          // sits exposed beside the single tab.
          backgroundColor: 'var(--theme-color-bg-4)',
          position: 'relative',
          maxHeight: `calc(90vh - 40px)`,
          overflowY: 'overlay' as React.CSSProperties['overflowY'],
          overflowX: 'hidden'
        }}
      >
        <PopupSection title="Deploy options" />

        <Tabs tabs={[{ label: 'Self Hosting', content: <DeployToFolderTab />, testId: 'self-hosting-tab-button' }]} />

        {hasActivity && <ActivityIndicator isOverlay />}
      </div>
    </div>
  );
}

export interface DeployPopupProps {
  triggerRef: RefObject<HTMLElement>;
  isVisible: boolean;
  onClose: () => void;
}

export function DeployPopup(props: DeployPopupProps) {
  return (
    <DeployContextProvider>
      <BaseDialog
        triggerRef={props.triggerRef}
        isVisible={props.isVisible}
        onClose={props.onClose}
        hasArrow
        isLockingScroll
      >
        <DeployPopupChild />
      </BaseDialog>
    </DeployContextProvider>
  );
}
