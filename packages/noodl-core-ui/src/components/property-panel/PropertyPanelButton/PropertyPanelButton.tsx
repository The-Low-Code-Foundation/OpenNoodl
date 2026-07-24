import classNames from 'classnames';
import React from 'react';

import css from './PropertyPanelButton.module.scss';

export interface PropertyPanelButtonProps {
  properties: {
    isPrimary?: boolean;
    buttonLabel: string;
    /** Rendered as data-identifier, used for input targeting (e.g. node double-click focus actions) */
    dataIdentifier?: string;
    onClick?: () => void;
  };
}

export function PropertyPanelButton({ properties }: PropertyPanelButtonProps) {
  return (
    <div className={css['Root']}>
      <button
        className={classNames([css['Button'], properties.isPrimary && css['is-primary']])}
        data-identifier={properties.dataIdentifier}
        onClick={properties.onClick}
      >
        {properties.buttonLabel}
      </button>
    </div>
  );
}
