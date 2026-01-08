/**
 * Easy Mode - Visual JSON Tree Builder (WITH EDITING)
 *
 * A visual tree-based editor where users can't break JSON structure.
 * Perfect for no-coders who don't understand JSON syntax.
 *
 * @module json-editor/modes
 */

import React, { useState } from 'react';

import { setValueAtPath, deleteValueAtPath, treeNodeToValue, valueToTreeNode } from '../../utils/treeConverter';
import { JSONTreeNode, JSONValueType } from '../../utils/types';
import css from './EasyMode.module.scss';
import { ValueEditor } from './ValueEditor';

export interface EasyModeProps {
  rootNode: JSONTreeNode;
  onChange?: (node: JSONTreeNode) => void;
  disabled?: boolean;
}

interface TreeNodeProps {
  node: JSONTreeNode;
  depth: number;
  onEdit: (path: (string | number)[], value: unknown) => void;
  onDelete: (path: (string | number)[]) => void;
  onAdd: (path: (string | number)[], type: JSONValueType, key?: string) => void;
  disabled?: boolean;
}

/**
 * Editable Tree Node Component
 */
function EditableTreeNode({ node, depth, onEdit, onDelete, onAdd, disabled }: TreeNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemType, setNewItemType] = useState<JSONValueType>('string');
  const [newKey, setNewKey] = useState('');

  const hasChildren = node.children && node.children.length > 0;
  const indent = depth * 20;
  const canEdit =
    !disabled && (node.type === 'string' || node.type === 'number' || node.type === 'boolean' || node.type === 'null');
  const canDelete = !disabled && depth > 0; // Can't delete root

  // Type badge
  const typeBadge = (
    <span className={css['TypeBadge']} data-type={node.type}>
      {node.type}
    </span>
  );

  // Handle saving edited value
  const handleSaveEdit = (value: unknown) => {
    onEdit(node.path, value);
    setIsEditing(false);
  };

  // Handle adding new item/property
  const handleAddItem = () => {
    if (node.type === 'array') {
      onAdd(node.path, newItemType);
    } else if (node.type === 'object') {
      if (!newKey.trim()) return;
      onAdd(node.path, newItemType, newKey.trim());
    }
    setIsAddingItem(false);
    setNewKey('');
    setNewItemType('string');
  };

  // Arrays
  if (node.type === 'array') {
    return (
      <div className={css['TreeNode']} style={{ marginLeft: `${indent}px` }}>
        <div className={css['NodeHeader']}>
          {node.key && (
            <>
              <span className={css['Key']}>{node.key}</span>
              <span className={css['Colon']}>:</span>
            </>
          )}
          {node.index !== undefined && <span className={css['Index']}>[{node.index}]</span>}
          {typeBadge}
          <span className={css['Count']}>({node.children?.length || 0} items)</span>

          {!disabled && (
            <button onClick={() => setIsAddingItem(!isAddingItem)} className={css['AddButton']} title="Add item">
              + Add Item
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(node.path)} className={css['DeleteButton']} title="Delete">
              ✕
            </button>
          )}
        </div>

        {isAddingItem && (
          <div className={css['AddItemForm']}>
            <select value={newItemType} onChange={(e) => setNewItemType(e.target.value as JSONValueType)}>
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="null">Null</option>
              <option value="array">Array</option>
              <option value="object">Object</option>
            </select>
            <button onClick={handleAddItem}>Add</button>
            <button onClick={() => setIsAddingItem(false)}>Cancel</button>
          </div>
        )}

        {hasChildren && (
          <div className={css['Children']}>
            {node.children!.map((child, idx) => (
              <EditableTreeNode
                key={child.id || idx}
                node={child}
                depth={depth + 1}
                onEdit={onEdit}
                onDelete={onDelete}
                onAdd={onAdd}
                disabled={disabled}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Objects
  if (node.type === 'object') {
    return (
      <div className={css['TreeNode']} style={{ marginLeft: `${indent}px` }}>
        <div className={css['NodeHeader']}>
          {node.key && (
            <>
              <span className={css['Key']}>{node.key}</span>
              <span className={css['Colon']}>:</span>
            </>
          )}
          {node.index !== undefined && <span className={css['Index']}>[{node.index}]</span>}
          {typeBadge}
          <span className={css['Count']}>({node.children?.length || 0} properties)</span>

          {!disabled && (
            <button onClick={() => setIsAddingItem(!isAddingItem)} className={css['AddButton']} title="Add property">
              + Add Property
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(node.path)} className={css['DeleteButton']} title="Delete">
              ✕
            </button>
          )}
        </div>

        {isAddingItem && (
          <div className={css['AddItemForm']}>
            <input type="text" placeholder="Property key" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
            <select value={newItemType} onChange={(e) => setNewItemType(e.target.value as JSONValueType)}>
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="null">Null</option>
              <option value="array">Array</option>
              <option value="object">Object</option>
            </select>
            <button onClick={handleAddItem} disabled={!newKey.trim()}>
              Add
            </button>
            <button onClick={() => setIsAddingItem(false)}>Cancel</button>
          </div>
        )}

        {hasChildren && (
          <div className={css['Children']}>
            {node.children!.map((child, idx) => (
              <EditableTreeNode
                key={child.id || idx}
                node={child}
                depth={depth + 1}
                onEdit={onEdit}
                onDelete={onDelete}
                onAdd={onAdd}
                disabled={disabled}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Primitive values
  return (
    <div className={css['TreeNode']} style={{ marginLeft: `${indent}px` }}>
      <div className={css['NodeHeader']}>
        {node.key && (
          <>
            <span className={css['Key']}>{node.key}</span>
            <span className={css['Colon']}>:</span>
          </>
        )}
        {node.index !== undefined && <span className={css['Index']}>[{node.index}]</span>}
        {typeBadge}

        {isEditing ? (
          <ValueEditor
            value={node.value!}
            type={node.type}
            onSave={handleSaveEdit}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <>
            <span className={css['Value']} data-type={node.type} onClick={() => canEdit && setIsEditing(true)}>
              {formatValue(node.value, node.type)}
            </span>
            {canEdit && (
              <button onClick={() => setIsEditing(true)} className={css['EditButton']} title="Edit">
                ✎
              </button>
            )}
          </>
        )}

        {canDelete && (
          <button onClick={() => onDelete(node.path)} className={css['DeleteButton']} title="Delete">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function formatValue(value: unknown, type: string): string {
  if (type === 'null') return 'null';
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'string') return `"${value}"`;
  return String(value);
}

/**
 * Easy Mode Component
 */
export function EasyMode({ rootNode, onChange, disabled }: EasyModeProps) {
  // Handle editing a value at a path
  const handleEdit = (path: (string | number)[], value: unknown) => {
    if (!onChange) return;
    const currentValue = treeNodeToValue(rootNode);
    const newValue = setValueAtPath(currentValue, path, value);
    const newNode = valueToTreeNode(newValue);
    onChange(newNode);
  };

  // Handle deleting a value at a path
  const handleDelete = (path: (string | number)[]) => {
    if (!onChange) return;
    const currentValue = treeNodeToValue(rootNode);
    const newValue = deleteValueAtPath(currentValue, path);
    const newNode = valueToTreeNode(newValue);
    onChange(newNode);
  };

  // Handle adding a new item/property
  const handleAdd = (path: (string | number)[], type: JSONValueType, key?: string) => {
    if (!onChange) return;
    const currentValue = treeNodeToValue(rootNode);

    // Get the parent value at path
    let parent = currentValue;
    for (const segment of path) {
      parent = (parent as any)[segment];
    }

    // Create default value for the type
    let defaultValue: any;
    if (type === 'string') defaultValue = '';
    else if (type === 'number') defaultValue = 0;
    else if (type === 'boolean') defaultValue = false;
    else if (type === 'null') defaultValue = null;
    else if (type === 'array') defaultValue = [];
    else if (type === 'object') defaultValue = {};

    // Add to parent
    if (Array.isArray(parent)) {
      (parent as any[]).push(defaultValue);
    } else if (typeof parent === 'object' && parent !== null && key) {
      (parent as any)[key] = defaultValue;
    }

    const newNode = valueToTreeNode(currentValue);
    onChange(newNode);
  };

  // Empty state
  if (!rootNode || (rootNode.type === 'array' && !rootNode.children?.length)) {
    return (
      <div className={css['Root']}>
        <div className={css['EmptyState']}>
          <div className={css['EmptyIcon']}>📋</div>
          <div className={css['EmptyText']}>Empty array - click "Add Item" to start</div>
        </div>
        {!disabled && (
          <EditableTreeNode
            node={rootNode || valueToTreeNode([])}
            depth={0}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAdd={handleAdd}
            disabled={disabled}
          />
        )}
      </div>
    );
  }

  if (rootNode.type === 'object' && !rootNode.children?.length) {
    return (
      <div className={css['Root']}>
        <div className={css['EmptyState']}>
          <div className={css['EmptyIcon']}>📦</div>
          <div className={css['EmptyText']}>Empty object - click "Add Property" to start</div>
        </div>
        {!disabled && (
          <EditableTreeNode
            node={rootNode || valueToTreeNode({})}
            depth={0}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAdd={handleAdd}
            disabled={disabled}
          />
        )}
      </div>
    );
  }

  return (
    <div className={css['Root']}>
      <EditableTreeNode
        node={rootNode}
        depth={0}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAdd={handleAdd}
        disabled={disabled}
      />
    </div>
  );
}
