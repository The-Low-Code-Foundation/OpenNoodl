/**
 * ComponentTree
 *
 * Recursively renders the component/folder tree structure.
 */

import React from 'react';

import { Sheet, TreeNode } from '../types';
import { ComponentItem } from './ComponentItem';
import { FolderItem } from './FolderItem';

interface ComponentTreeProps {
  nodes: TreeNode[];
  level?: number;
  onItemClick: (node: TreeNode) => void;
  onCaretClick: (folderId: string) => void;
  expandedFolders: Set<string>;
  selectedId?: string;
  onMakeHome?: (node: TreeNode) => void;
  onDelete?: (node: TreeNode) => void;
  onDuplicate?: (node: TreeNode) => void;
  onRename?: (node: TreeNode) => void;
  onOpen?: (node: TreeNode) => void;
  onDragStart?: (node: TreeNode, element: HTMLElement) => void;
  onDrop?: (node: TreeNode) => void;
  canAcceptDrop?: (node: TreeNode) => boolean;
  onAddComponent?: (template: TSFixme, parentPath?: string) => void;
  onAddFolder?: (parentPath?: string) => void;
  // Rename mode props
  renamingItem?: TreeNode | null;
  renameValue?: string;
  onRenameChange?: (value: string) => void;
  onRenameConfirm?: () => void;
  onRenameCancel?: () => void;
  onDoubleClick?: (node: TreeNode) => void;
  // Sheet management props
  sheets?: Sheet[];
  onMoveToSheet?: (componentPath: string, sheet: Sheet) => void;
  /**
   * PNL-006 — rows that matched the filter themselves. Anything rendered while
   * this is non-null and *not* in it is ancestry kept for context, and is
   * dimmed. Null (the default) means no filter is active and nothing dims.
   */
  matched?: Set<string> | null;
  /**
   * WFA-001 — which runtime the create menus author for. Derived from the
   * selected sheet by `ComponentsPanel`; `'cloud'` only on the Cloud Functions
   * sheet.
   */
  runtimeType?: 'browser' | 'cloud';
}

export function ComponentTree({
  nodes,
  level = 0,
  onItemClick,
  onCaretClick,
  expandedFolders,
  selectedId,
  onMakeHome,
  onDelete,
  onDuplicate,
  onRename,
  onOpen,
  onDragStart,
  onDrop,
  canAcceptDrop,
  onAddComponent,
  onAddFolder,
  renamingItem,
  renameValue,
  onRenameChange,
  onRenameConfirm,
  onRenameCancel,
  onDoubleClick,
  sheets,
  onMoveToSheet,
  matched = null,
  runtimeType = 'browser'
}: ComponentTreeProps) {
  return (
    <>
      {nodes.map((node) => {
        const id = node.type === 'component' ? node.data.name : node.data.path;
        const isDimmed = matched !== null && !matched.has(id);

        // Check if this item is being renamed
        const isRenaming =
          renamingItem &&
          ((node.type === 'component' && renamingItem.type === 'component' && node.data.id === renamingItem.data.id) ||
            (node.type === 'folder' && renamingItem.type === 'folder' && node.data.path === renamingItem.data.path));

        if (node.type === 'folder') {
          return (
            <FolderItem
              key={node.data.path}
              folder={node.data}
              level={level}
              isExpanded={expandedFolders.has(node.data.path)}
              isSelected={selectedId === node.data.path}
              onCaretClick={() => onCaretClick(node.data.path)}
              onClick={() => onItemClick(node)}
              onDelete={onDelete}
              onRename={onRename}
              onDragStart={onDragStart}
              onDrop={onDrop}
              canAcceptDrop={canAcceptDrop}
              onDoubleClick={onDoubleClick}
              onAddComponent={onAddComponent}
              onAddFolder={onAddFolder}
              isRenaming={isRenaming}
              renameValue={renameValue}
              onRenameChange={onRenameChange}
              onRenameConfirm={onRenameConfirm}
              onRenameCancel={onRenameCancel}
              sheets={sheets}
              onMoveToSheet={onMoveToSheet}
              onOpen={onOpen}
              onMakeHome={onMakeHome}
              onDuplicate={onDuplicate}
              isDimmed={isDimmed}
              runtimeType={runtimeType}
            >
              {expandedFolders.has(node.data.path) && node.data.children.length > 0 && (
                <ComponentTree
                  nodes={node.data.children}
                  level={level + 1}
                  onItemClick={onItemClick}
                  onCaretClick={onCaretClick}
                  expandedFolders={expandedFolders}
                  selectedId={selectedId}
                  onMakeHome={onMakeHome}
                  onDelete={onDelete}
                  onDuplicate={onDuplicate}
                  onRename={onRename}
                  onOpen={onOpen}
                  onDragStart={onDragStart}
                  onDrop={onDrop}
                  canAcceptDrop={canAcceptDrop}
                  onAddComponent={onAddComponent}
                  onAddFolder={onAddFolder}
                  renamingItem={renamingItem}
                  renameValue={renameValue}
                  onRenameChange={onRenameChange}
                  onRenameConfirm={onRenameConfirm}
                  onRenameCancel={onRenameCancel}
                  onDoubleClick={onDoubleClick}
                  sheets={sheets}
                  onMoveToSheet={onMoveToSheet}
                  matched={matched}
                  runtimeType={runtimeType}
                />
              )}
            </FolderItem>
          );
        } else {
          return (
            <ComponentItem
              key={node.data.id}
              component={node.data}
              level={level}
              isSelected={selectedId === node.data.name}
              onClick={() => onItemClick(node)}
              onMakeHome={onMakeHome}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onRename={onRename}
              onOpen={onOpen}
              onDragStart={onDragStart}
              onDrop={onDrop}
              canAcceptDrop={canAcceptDrop}
              onDoubleClick={onDoubleClick}
              onAddComponent={onAddComponent}
              onAddFolder={onAddFolder}
              isRenaming={isRenaming}
              renameValue={renameValue}
              onRenameChange={onRenameChange}
              onRenameConfirm={onRenameConfirm}
              onRenameCancel={onRenameCancel}
              sheets={sheets}
              onMoveToSheet={onMoveToSheet}
              isDimmed={isDimmed}
              runtimeType={runtimeType}
            />
          );
        }
      })}
    </>
  );
}
