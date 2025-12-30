/**
 * Filter Builder Modal
 *
 * Modal dialog wrapper for the Visual Filter Builder.
 * Keeps the property panel clean by showing the full builder in a modal.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Modal } from '@noodl-core-ui/components/layout/Modal';
import { HStack } from '@noodl-core-ui/components/layout/Stack';

import { ByobFilterBuilder, ByobFilterBuilderRef } from './ByobFilterBuilder';
import { createEmptyFilterGroup, FilterGroup, SchemaCollection } from './types';

export interface FilterBuilderModalProps {
  isVisible: boolean;
  value: FilterGroup | null;
  schema: SchemaCollection | null;
  onSave: (filter: FilterGroup) => void;
  onClose: () => void;
}

export function FilterBuilderModal({ isVisible, value, schema, onSave, onClose }: FilterBuilderModalProps) {
  // Ref to access filter builder imperatively (for saving pending JSON edits)
  const filterBuilderRef = useRef<ByobFilterBuilderRef>(null);

  // Local state for editing - only save when "Save" is clicked
  const [localFilter, setLocalFilter] = useState<FilterGroup>(() => {
    return value || createEmptyFilterGroup();
  });

  // Reset local state when modal opens with new value
  useEffect(() => {
    if (isVisible) {
      setLocalFilter(value || createEmptyFilterGroup());
    }
  }, [isVisible, value]);

  const handleFilterChange = useCallback((newFilter: FilterGroup) => {
    setLocalFilter(newFilter);
  }, []);

  const handleSave = useCallback(() => {
    // First, save any pending JSON edits from the raw editor
    // This returns the updated filter if JSON was being edited, null otherwise
    const updatedFromJson = filterBuilderRef.current?.saveJsonIfEditing();

    // Use the JSON-edited filter if available, otherwise use localFilter
    onSave(updatedFromJson || localFilter);
    onClose();
  }, [localFilter, onSave, onClose]);

  const handleCancel = useCallback(() => {
    // Discard changes
    onClose();
  }, [onClose]);

  const footerContent = (
    <HStack hasSpacing UNSAFE_style={{ justifyContent: 'flex-end', width: '100%' }}>
      <PrimaryButton label="Cancel" variant={PrimaryButtonVariant.Muted} onClick={handleCancel} />
      <PrimaryButton label="Save Filter" onClick={handleSave} />
    </HStack>
  );

  return (
    <Modal
      isVisible={isVisible}
      onClose={handleCancel}
      title="Edit Filter"
      subtitle={schema?.name ? `Collection: ${schema.displayName || schema.name}` : undefined}
      footerSlot={footerContent}
      hasFooterDivider
      UNSAFE_style={{ width: '700px', maxHeight: '80vh' }}
    >
      <div style={{ minHeight: '300px', maxHeight: '60vh', overflow: 'auto' }}>
        <ByobFilterBuilder ref={filterBuilderRef} value={localFilter} schema={schema} onChange={handleFilterChange} />
      </div>
    </Modal>
  );
}
