import React from 'react';

import type { ExecutionStatus } from '@noodl-viewer-cloud/execution-history';

import type { ExecutionFilters as FiltersState } from '../../hooks/useExecutionHistory';
import styles from './ExecutionFilters.module.scss';

interface Props {
  filters: FiltersState;
  onChange: (filters: FiltersState) => void;
}

const STATUS_OPTIONS: { value: ExecutionStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'success', label: 'Success' },
  { value: 'error', label: 'Error' },
  { value: 'running', label: 'Running' }
];

/** Filter toolbar for the execution history list. */
export function ExecutionFilters({ filters, onChange }: Props) {
  return (
    <div className={styles.Filters}>
      <select
        className={styles.Select}
        value={filters.status ?? ''}
        onChange={(e) =>
          onChange({
            ...filters,
            status: (e.target.value as ExecutionStatus) || undefined
          })
        }
        aria-label="Filter by status"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {(filters.status || filters.startDate || filters.endDate) && (
        <button
          className={styles.ClearButton}
          onClick={() => onChange({ status: undefined, startDate: undefined, endDate: undefined })}
        >
          Clear
        </button>
      )}
    </div>
  );
}
