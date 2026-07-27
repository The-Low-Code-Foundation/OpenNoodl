/**
 * SheetSelector
 *
 * Dropdown component for selecting and managing component sheets.
 * Sheets are top-level organizational folders starting with #.
 */

import classNames from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';

import { Sheet } from '../types';
import css from './SheetSelector.module.scss';

interface SheetSelectorProps {
  /** All available sheets */
  sheets: Sheet[];
  /** Currently selected sheet (null = show all) */
  currentSheet: Sheet | null;
  /** Callback when sheet is selected */
  onSelectSheet: (sheet: Sheet | null) => void;
  /** Callback to create a new sheet */
  onCreateSheet?: () => void;
  /** Callback to rename a sheet */
  onRenameSheet?: (sheet: Sheet) => void;
  /** Callback to delete a sheet */
  onDeleteSheet?: (sheet: Sheet) => void;
  /** Whether the selector is disabled (e.g., locked to a sheet) */
  disabled?: boolean;
}

/**
 * WFA-001: which sheets a user may rename or delete.
 *
 * "Default" is not a real folder, and the cloud sheet's name is a runtime
 * boundary the exporter, `RuntimeType` and `CloudRunner` all resolve from — a
 * rename would silently detach every function from the backend that serves it.
 */
function canManageSheet(sheet: Sheet): boolean {
  return !sheet.isDefault && !sheet.isCloud;
}

/**
 * SheetSelector displays a dropdown to switch between component sheets.
 * When no sheet is selected, all components are shown.
 */
export function SheetSelector({
  sheets,
  currentSheet,
  onSelectSheet,
  onCreateSheet,
  onRenameSheet,
  onDeleteSheet,
  disabled = false
}: SheetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSheetMenu, setActiveSheetMenu] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown and action menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveSheetMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close action menu when clicking elsewhere in the dropdown (but not outside)
  useEffect(() => {
    if (!activeSheetMenu) return;

    const handleClickInDropdown = (e: MouseEvent) => {
      // Check if click is inside the dropdown but outside the action menu area
      const target = e.target as HTMLElement;
      const isInsideActionMenu = target.closest(`.${css['ActionMenu']}`) || target.closest(`.${css['ActionButton']}`);
      if (!isInsideActionMenu) {
        setActiveSheetMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickInDropdown);
    return () => document.removeEventListener('mousedown', handleClickInDropdown);
  }, [activeSheetMenu]);

  // Close dropdown on escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled]);

  const handleSelectSheet = useCallback(
    (sheet: Sheet | null) => {
      onSelectSheet(sheet);
      setIsOpen(false);
    },
    [onSelectSheet]
  );

  const handleCreateSheet = useCallback(() => {
    // Close dropdown first
    setIsOpen(false);

    // Delay popup to allow dropdown to fully close and React to complete its render cycle
    // This prevents timing conflicts between dropdown close and popup open
    setTimeout(() => {
      onCreateSheet?.();
    }, 50);
  }, [onCreateSheet]);

  // Don't render if only default sheet exists and no create option
  if (sheets.length <= 1 && !onCreateSheet) {
    return null;
  }

  const displayName = currentSheet ? currentSheet.name : 'All';

  return (
    <div className={css['SheetSelector']} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        className={classNames(css['TriggerButton'], { [css['Open']]: isOpen })}
        onClick={handleToggle}
        disabled={disabled}
        title={disabled ? 'Sheet selection is locked' : 'Select sheet'}
      >
        <span className={css['SheetName']}>{displayName}</span>
        <Icon
          icon={IconName.CaretDown}
          size={IconSize.Tiny}
          UNSAFE_className={classNames(css['ChevronIcon'], { [css['Open']]: isOpen })}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className={css['Dropdown']}>
          <div className={css['SheetList']}>
            {/* "All" option - no sheet filter */}
            <div
              className={classNames(css['SheetItem'], css['AllSheets'], {
                [css['Selected']]: currentSheet === null
              })}
              onClick={() => handleSelectSheet(null)}
            >
              <div
                className={classNames(css['RadioIndicator'], {
                  [css['Selected']]: currentSheet === null
                })}
              />
              <span className={css['SheetLabel']}>All</span>
            </div>

            {/* Sheet items */}
            {sheets.map((sheet) => (
              <div
                key={sheet.folderName || 'default'}
                className={classNames(css['SheetItem'], {
                  [css['Selected']]: currentSheet?.folderName === sheet.folderName,
                  [css['HasActions']]: canManageSheet(sheet) && (onRenameSheet || onDeleteSheet)
                })}
                onClick={() => handleSelectSheet(sheet)}
              >
                <div
                  className={classNames(css['RadioIndicator'], {
                    [css['Selected']]: currentSheet?.folderName === sheet.folderName
                  })}
                />
                <span className={css['SheetLabel']}>{sheet.name}</span>
                <span className={css['SheetCount']}>({sheet.componentCount})</span>

                {/* Action buttons for ordinary sheets */}
                {canManageSheet(sheet) && (onRenameSheet || onDeleteSheet) && (
                  <div
                    className={classNames(css['SheetActions'], {
                      [css['Visible']]: activeSheetMenu === sheet.folderName
                    })}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className={css['ActionButton']}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSheetMenu(activeSheetMenu === sheet.folderName ? null : sheet.folderName);
                      }}
                      title="Sheet actions"
                    >
                      <Icon icon={IconName.DotsThree} size={IconSize.Tiny} />
                    </button>

                    {activeSheetMenu === sheet.folderName && (
                      <div className={css['ActionMenu']}>
                        {onRenameSheet && (
                          <button
                            className={css['ActionMenuItem']}
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsOpen(false);
                              setActiveSheetMenu(null);
                              setTimeout(() => onRenameSheet(sheet), 50);
                            }}
                          >
                            Rename
                          </button>
                        )}
                        {onDeleteSheet && (
                          <button
                            className={classNames(css['ActionMenuItem'], css['Danger'])}
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsOpen(false);
                              setActiveSheetMenu(null);
                              setTimeout(() => onDeleteSheet(sheet), 50);
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Sheet option */}
          {onCreateSheet && (
            <>
              <div className={css['Divider']} />
              <button className={css['AddSheetButton']} onClick={handleCreateSheet}>
                <Icon icon={IconName.Plus} size={IconSize.Tiny} UNSAFE_className={css['AddIcon']} />
                <span>Add Sheet</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
