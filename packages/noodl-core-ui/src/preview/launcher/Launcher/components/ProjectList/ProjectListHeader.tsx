import React from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { Label, LabelSize } from '@noodl-core-ui/components/typography/Label';
import { TextType } from '@noodl-core-ui/components/typography/Text';

import { SortDirection, SortField } from '../../hooks/useProjectList';
import css from './ProjectListHeader.module.scss';

export interface ProjectListHeaderProps {
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}

interface ColumnConfig {
  field: SortField;
  label: string;
  width: string;
}

const COLUMNS: ColumnConfig[] = [
  { field: 'name', label: 'Name', width: '40%' },
  { field: 'lastModified', label: 'Last Modified', width: '20%' },
  { field: 'gitStatus', label: 'Git Status', width: '20%' },
  { field: 'name', label: 'Path', width: '20%' } // Path uses name for field (not sortable separately)
];

/**
 * ProjectListHeader
 *
 * Table header with sortable columns for the project list.
 * Shows sort indicators and handles column click events.
 */
export function ProjectListHeader({ sortField, sortDirection, onSort }: ProjectListHeaderProps) {
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <Icon icon={IconName.CaretDownUp} size={IconSize.Tiny} variant={TextType.Shy} />;
    }

    return (
      <Icon
        icon={sortDirection === 'asc' ? IconName.CaretUp : IconName.CaretDown}
        size={IconSize.Tiny}
        variant={TextType.Default}
      />
    );
  };

  return (
    <div className={css.Root}>
      {COLUMNS.map((column, index) => {
        const isSortable = index < 3; // First 3 columns are sortable
        const isActive = sortField === column.field;

        return (
          <button
            key={`${column.field}-${index}`}
            className={css.Column}
            style={{ width: column.width }}
            onClick={() => isSortable && onSort(column.field)}
            disabled={!isSortable}
            data-active={isActive}
          >
            <Label size={LabelSize.Small} variant={isActive ? TextType.Default : TextType.Shy}>
              {column.label}
            </Label>
            {isSortable && renderSortIcon(column.field)}
          </button>
        );
      })}
    </div>
  );
}
