import React from 'react';

import { BindingChip } from '@noodl-core-ui/components/property-panel/BindingChip/BindingChip';
import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput/PropertyPanelRow';

import Tooltip from '../../../../reactcomponents/tooltip';
import css from './ListInputRow.module.scss';

export interface ListInputRowProps {
  label: string;
  tooltip?: string;
  /** One line describing the value, e.g. "3 items". */
  summary: string;
  isChanged?: boolean;
  isConnected?: boolean;
  connectionLabel?: string;
  onConnectionClick?: () => void;
  onEdit: (anchor: HTMLElement) => void;
  onReset?: () => void;
}

/**
 * ERG-003 criterion 5 — a list port driven by a wire says so.
 *
 * The three ways into a list value are a visual builder, a JSON code editor and
 * a connection. The first two live behind Edit; the third is the one an author
 * could not previously see, because a connected `array` port still showed an
 * Edit button over a local value the runtime was ignoring. When the port is
 * connected the row shows the binding chip instead and does not offer that
 * stale value.
 */
export function ListInputRow({
  label,
  tooltip,
  summary,
  isChanged,
  isConnected,
  connectionLabel,
  onConnectionClick,
  onEdit,
  onReset
}: ListInputRowProps) {
  return (
    <PropertyPanelRow label={label} isChanged={isChanged} onReset={onReset}>
      {isConnected ? (
        <BindingChip source={connectionLabel} onClick={onConnectionClick} />
      ) : (
        <Tooltip enabled={!!tooltip} text={tooltip}>
          <button
            type="button"
            className={`property-codeeditor-button ${css['EditButton']}`}
            data-identifier={label}
            onClick={(e) => {
              onEdit(e.currentTarget);
              e.stopPropagation();
            }}
          >
            <span className={css['Summary']}>{summary}</span>
            <span className={css['EditLabel']}>Edit</span>
          </button>
        </Tooltip>
      )}
    </PropertyPanelRow>
  );
}
