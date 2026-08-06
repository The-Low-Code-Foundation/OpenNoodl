/**
 * SheetSelector
 *
 * Dropdown component for selecting and managing component sheets.
 * Sheets are top-level organizational folders starting with #.
 */

import classNames from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';

import { CLOUD_SHEET, Sheet } from '../types';
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
 * SPR-005 — what this control is a control *over*.
 *
 * F83: the trigger rendered a bare "All", which reads as a filter over what the
 * tree is showing — and a filter reading "All" says you are already seeing
 * everything. It is neither. It is the surface you are authoring into: the sheet
 * decides which runtime the create menus offer and which folder a new component
 * is named into (`ComponentsPanel`'s `sheetPrefix`).
 *
 * Three changes, all of them wording and glyph rather than behaviour:
 *  - the value is "All sheets", never the bare "All";
 *  - a glyph rides with it, and the cloud sheet's is the one the tree already
 *    gives a cloud function, so the current surface is legible without opening
 *    anything;
 *  - the `title` says, in words, where a new component will land.
 *
 * Naming is deliberately *not* touched: whether "Cloud Functions" survives as a
 * term is phase 43's, and this control quotes `CLOUD_SHEET.displayName` rather
 * than spelling anything itself.
 */
const ALL_SHEETS_LABEL = 'All sheets';

function sheetGlyph(sheet: Sheet | null): IconName {
  if (!sheet) return IconName.Components;
  return sheet.isCloud ? IconName.CloudFunction : IconName.FolderClosed;
}

function sheetDescription(sheet: Sheet | null, disabled: boolean): string {
  if (disabled) return `Sheet: ${sheet ? sheet.name : ALL_SHEETS_LABEL} — locked to this sheet`;
  if (!sheet) {
    return (
      `Sheet: ${ALL_SHEETS_LABEL} — every sheet except ${CLOUD_SHEET.displayName}, ` +
      `flattened. New components land in Default.`
    );
  }
  if (sheet.isCloud) {
    return `Sheet: ${sheet.name} — components that run on your backend. New cloud functions land here.`;
  }
  return `Sheet: ${sheet.name} — new components land here.`;
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

  const displayName = currentSheet ? currentSheet.name : ALL_SHEETS_LABEL;

  return (
    <div className={css['SheetSelector']} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        className={classNames(css['TriggerButton'], { [css['Open']]: isOpen })}
        onClick={handleToggle}
        disabled={disabled}
        title={sheetDescription(currentSheet, disabled)}
        aria-label={sheetDescription(currentSheet, disabled)}
        data-test="sheet-selector-trigger"
      >
        <Icon icon={sheetGlyph(currentSheet)} size={IconSize.Tiny} UNSAFE_className={css['SheetGlyph']} />
        <span className={css['SheetName']}>{displayName}</span>
        <Icon
          icon={IconName.CaretDown}
          size={IconSize.Tiny}
          UNSAFE_className={classNames(css['ChevronIcon'], { [css['Open']]: isOpen })}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className={css['Dropdown']} data-test="sheet-selector-dropdown">
          {/* SPR-005: what the list below is a list OF. Without it the entries
              read as filter presets rather than as places. */}
          <div className={css['DropdownHeading']}>Author in sheet</div>
          <div className={css['SheetList']}>
            {/* The flattened view of every browser sheet. Not a filter preset:
                it has its own create destination (Default), which is why it says
                so rather than saying "All". */}
            <div
              className={classNames(css['SheetItem'], css['AllSheets'], {
                [css['Selected']]: currentSheet === null
              })}
              onClick={() => handleSelectSheet(null)}
              data-test="sheet-selector-all"
            >
              <div
                className={classNames(css['RadioIndicator'], {
                  [css['Selected']]: currentSheet === null
                })}
              />
              <span className={css['SheetLabel']}>{ALL_SHEETS_LABEL}</span>
              <span className={css['SheetCount']}>new in Default</span>
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
                title={sheetDescription(sheet, false)}
                data-test={sheet.isCloud ? 'sheet-selector-cloud' : undefined}
              >
                <div
                  className={classNames(css['RadioIndicator'], {
                    [css['Selected']]: currentSheet?.folderName === sheet.folderName
                  })}
                />
                <Icon icon={sheetGlyph(sheet)} size={IconSize.Tiny} UNSAFE_className={css['SheetGlyph']} />
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
