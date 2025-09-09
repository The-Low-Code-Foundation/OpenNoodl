import { getCurrentWindow, screen } from '@electron/remote';
import React from 'react';
import { createRoot } from 'react-dom/client';

import { DialogRenderDirection } from '@noodl-core-ui/components/layout/BaseDialog';
import { MenuDialog, MenuDialogItem, MenuDialogWidth } from '@noodl-core-ui/components/popups/MenuDialog';

import PopupLayer from './popuplayer';

interface ShowContextMenuInPopupArgs {
  title?: string;
  items: (MenuDialogItem | 'divider')[];
  width?: MenuDialogWidth;
  renderDirection?: DialogRenderDirection;
}

export function showContextMenuInPopup({
  title,
  items,
  width,
  renderDirection = DialogRenderDirection.Vertical
}: ShowContextMenuInPopupArgs) {
  const container = document.createElement('div');
  const screenPoint = screen.getCursorScreenPoint();
  const [winX, winY] = getCurrentWindow().getPosition();
  const root = createRoot(container)

  const popout = PopupLayer.instance.showPopout({
    content: { el: $(container) },
    arrowColor: 'transparent',
    attachToPoint: {
      x: screenPoint.x - winX,
      y: screenPoint.y - winY
    },
    position: 'top',
    onClose: () => {
      root.unmount();
    }
  });

  root.render(
    <MenuDialog
      title={title}
      width={width || MenuDialogWidth.Large}
      isVisible={true}
      triggerRef={{ current: container }}
      renderDirection={renderDirection}
      onClose={() => {
        PopupLayer.instance.hidePopout(popout);
      }}
      items={items}
    />);
}
