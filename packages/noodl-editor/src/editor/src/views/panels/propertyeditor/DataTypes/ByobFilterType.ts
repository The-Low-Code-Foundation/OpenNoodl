/**
 * BYOB Filter Type
 *
 * Property editor type for the BYOB Visual Filter Builder.
 * Renders a button in the property panel that opens a modal with the full builder.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { FilterBuilderButton } from '../components/ByobFilterBuilder';
import { fromDirectusFilter } from '../components/ByobFilterBuilder/converter';
import { FilterGroup, SchemaCollection } from '../components/ByobFilterBuilder/types';
import { TypeView } from '../TypeView';
import { getEditType } from '../utils';

export class ByobFilterType extends TypeView {
  private root: Root | null = null;

  static fromPort(args: TSFixme): ByobFilterType {
    const view = new ByobFilterType();

    const p = args.port;
    const parent = args.parent;

    view.port = p;
    view.displayName = p.displayName ? p.displayName : p.name;
    view.name = p.name;
    view.type = getEditType(p);
    view.default = p.default;
    view.group = p.group;
    view.value = parent.model.getParameter(p.name);
    view.parent = parent;
    view.isConnected = parent.model.isPortConnected(p.name, 'target');
    view.isDefault = parent.model.parameters[p.name] === undefined;

    return view;
  }

  render() {
    const div = document.createElement('div');

    // Parse value from JSON string - extracted so it can be called on render and re-render
    const parseValue = (): FilterGroup | null => {
      if (this.value) {
        try {
          const parsed = JSON.parse(this.value as string);
          // Check if it's already our visual builder format (has 'conditions' array)
          if (parsed.conditions) {
            return parsed as FilterGroup;
          } else {
            // It's a legacy Directus format, convert it
            return fromDirectusFilter(parsed);
          }
        } catch (e) {
          console.warn('[ByobFilterType] Failed to parse existing filter:', e);
        }
      }
      return null;
    };

    // Render the button component
    const renderButton = (filterValue: FilterGroup | null) => {
      // Get schema from port type (populated by node's updatePorts)
      const schema: SchemaCollection | null = (this.type as TSFixme)?.schema || null;

      const props = {
        value: filterValue,
        schema: schema,
        onChange: (filter: FilterGroup) => {
          // Store the full visual builder format (with conditions array, IDs, etc.)
          // The runtime will convert to Directus format at fetch time
          const jsonString = JSON.stringify(filter);

          console.log('[ByobFilterType] Saving filter:', jsonString);

          const undoArgs = { undo: true, label: 'filter changed', oldValue: this.value };
          this.value = jsonString;
          this.parent.model.setParameter(this.name, jsonString, undoArgs);
          this.isDefault = false;

          // Re-render the button with the new value so UI updates immediately
          renderButton(filter);
        }
      };

      if (!this.root) {
        this.root = createRoot(div);
      }
      this.root.render(React.createElement(FilterBuilderButton, props));
    };

    renderButton(parseValue());

    this.el = $(div);

    return this.el;
  }
}
