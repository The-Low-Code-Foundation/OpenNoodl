import { getCurrentWindow, screen } from '@electron/remote';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { MenuDialog, MenuDialogWidth } from '@noodl-core-ui/components/popups/MenuDialog';

import PopupLayer from '../popuplayer';

export function showInspectMenu(items: TSFixme) {
  const container = document.createElement('div');
  const screenPoint = screen.getCursorScreenPoint();
  const [winX, winY] = getCurrentWindow().getPosition();

  let root: Root | null = null;

  const popout = PopupLayer.instance.showPopout({
    content: { el: container },
    arrowColor: 'transparent',
    attachToPoint: {
      x: screenPoint.x - winX,
      y: screenPoint.y - winY
    },
    position: 'top',
    onClose: () => {
      if (root) {
        root.unmount();
        root = null;
      }
    }
  });

  root = createRoot(container);
  root.render(
    <MenuDialog
      title="Nodes"
      width={MenuDialogWidth.Large}
      isVisible={true}
      triggerRef={{ current: container }}
      onClose={() => {
        PopupLayer.instance.hidePopout(popout);
      }}
      items={items}
    />
  );
}
