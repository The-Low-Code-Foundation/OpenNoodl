import React from 'react';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';
import type { Slot } from '@noodl-core-ui/types/global';

export interface QueryRulePopupProps {
  title: string;

  onDeleteClicked: TSFixme;

  children: Slot;
}

export function QueryRulePopup({ title, children, onDeleteClicked }: QueryRulePopupProps) {
  return (
    <div className="queryeditor-popup">
      <div className="queryeditor-header">{title}</div>
      <div className="queryeditor-content">
        <div className="queryeditor-rule">{children}</div>
        <div className="queryeditor-trash-icon" onClick={onDeleteClicked}>
          <Icon icon={IconName.Trash} UNSAFE_style={{ width: 20, height: 20 }} />
        </div>
      </div>
    </div>
  );
}
