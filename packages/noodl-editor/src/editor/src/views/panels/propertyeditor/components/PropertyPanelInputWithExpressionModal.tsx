/**
 * PropertyPanelInputWithExpressionModal
 *
 * Wraps PropertyPanelInput with ExpressionEditorModal state management.
 * Used by BasicType.ts to provide expression modal support.
 */

import React, { useState, useCallback } from 'react';

import {
  PropertyPanelInput,
  PropertyPanelInputProps
} from '@noodl-core-ui/components/property-panel/PropertyPanelInput';

import { ExpressionEditorModal } from '../ExpressionEditorModal';

export interface PropertyPanelInputWithExpressionModalProps extends PropertyPanelInputProps {
  /** Property name for the modal title */
  propertyName?: string;
}

export function PropertyPanelInputWithExpressionModal({
  propertyName,
  label,
  expression = '',
  expressionMode,
  onExpressionChange,
  ...props
}: PropertyPanelInputWithExpressionModalProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleExpand = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleModalApply = useCallback(
    (newExpression: string) => {
      if (onExpressionChange) {
        onExpressionChange(newExpression);
      }
    },
    [onExpressionChange]
  );

  return (
    <>
      <PropertyPanelInput
        label={label}
        expression={expression}
        expressionMode={expressionMode}
        onExpressionChange={onExpressionChange}
        onExpressionExpand={handleExpand}
        {...props}
      />
      <ExpressionEditorModal
        isOpen={isModalOpen}
        propertyName={propertyName || label}
        expression={expression}
        onApply={handleModalApply}
        onClose={handleModalClose}
      />
    </>
  );
}
