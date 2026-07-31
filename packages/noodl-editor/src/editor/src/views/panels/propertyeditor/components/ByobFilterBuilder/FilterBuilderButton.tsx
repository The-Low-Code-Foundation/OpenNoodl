/**
 * Filter Builder Button
 *
 * Compact button for the property panel that shows a summary
 * and opens the full Filter Builder in a modal.
 */

import React, { useCallback, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './ByobFilterBuilder.module.scss';
import { FilterBuilderModal } from './FilterBuilderModal';
import { FilterGroup, getFilterSummary, OperatorCapabilities, SchemaCollection } from './types';

export interface FilterBuilderButtonProps {
  value: FilterGroup | null;
  schema: SchemaCollection | null;
  onChange: (filter: FilterGroup) => void;
  /** What the chosen backend can express. Omitted offers everything. */
  capabilities?: OperatorCapabilities;
  /** Prefix for a connected value's input port. */
  valuePortPrefix?: string;
}

export function FilterBuilderButton({
  value,
  schema,
  onChange,
  capabilities,
  valuePortPrefix
}: FilterBuilderButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const summary = getFilterSummary(value);
  const hasFilter = summary !== 'No filter';

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleSave = useCallback(
    (filter: FilterGroup) => {
      onChange(filter);
    },
    [onChange]
  );

  return (
    <>
      <div className={css.FilterBuilderButton} onClick={handleOpenModal}>
        <div className={css.FilterBuilderButtonContent}>
          <Icon icon={IconName.Search} size={IconSize.Small} UNSAFE_style={{ opacity: hasFilter ? 1 : 0.5 }} />
          <Text textType={hasFilter ? TextType.DefaultContrast : TextType.Shy}>{summary}</Text>
        </div>
        <IconButton
          icon={IconName.Pencil}
          size={IconSize.Small}
          variant={IconButtonVariant.Transparent}
          onClick={(e) => {
            e.stopPropagation();
            handleOpenModal();
          }}
        />
      </div>

      <FilterBuilderModal
        isVisible={isModalOpen}
        value={value}
        schema={schema}
        onSave={handleSave}
        onClose={handleCloseModal}
        capabilities={capabilities}
        valuePortPrefix={valuePortPrefix}
      />
    </>
  );
}
