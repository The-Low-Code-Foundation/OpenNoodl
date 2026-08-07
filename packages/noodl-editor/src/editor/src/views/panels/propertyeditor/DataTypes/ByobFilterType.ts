/**
 * The filter builder's property-editor type.
 *
 * ⚠️ **One type view now serves both filter ports** — `byob-filter` and, since
 * BCN-003b, `query-filter`. There used to be two builders for one idea, and
 * `QueryEditor` was the weaker of them: RUN-003 slice 5 measured this one ahead
 * on operators, nesting, drag-and-drop and JSON editing, and then gave it
 * connected-value ports and enum/boolean value editors.
 *
 * The two ports still differ in three ways this file absorbs, and every one of
 * them is a fact about somebody's saved project rather than a preference:
 *
 * | | `byob-filter` | `query-filter` |
 * |---|---|---|
 * | Stored as | a JSON **string** | an **object** |
 * | Schema shape | `{collection, fields}` | `{properties, relations}` |
 * | Connected-value port | `filter_<field>_<id>` | `qp-<name>` / `fp-<name>` |
 *
 * The storage difference is kept rather than unified. Rewriting every Parse
 * filter in every project into a string would be a data migration with nothing
 * to buy it — the runtime reads the parameter directly, and a string would mean
 * teaching two more nodes to parse one.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { descriptorFor, type BackendType } from '@noodl/backend-contract';
import {
  isVisualQueryFormat,
  migrateSavedFilter,
  needsOperatorMigration,
  visualQueryToSaved,
  type SavedFilterGroup
} from '@noodl/backend-contract/translators';

import { FilterBuilderButton } from '../components/ByobFilterBuilder';
import { fromDirectusFilter } from '../components/ByobFilterBuilder/converter';
import { isParseSchema, parseSchemaToCollection } from '../components/ByobFilterBuilder/parseSchema';
import {
  DEFAULT_VALUE_PORT_PREFIX,
  FilterGroup,
  OperatorCapabilities,
  SchemaCollection
} from '../components/ByobFilterBuilder/types';
import { TypeView } from '../TypeView';
import { getEditType } from '../utils';

/** The port type's extra fields, as the runtime nodes declare them. */
interface FilterPortType {
  /** `'byob-filter'` or `'query-filter'` — which decides how the value is stored. */
  name?: string;
  schema?: unknown;
  /** Which capability table gates the operator dropdown. */
  backend?: BackendType;
  /** Prefix for a connected value's input port. */
  valuePortPrefix?: string;
  /** Collection name, for the modal's subtitle. */
  collection?: string;
}

export class ByobFilterType extends TypeView {
  el: TSFixme;
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
    const portType = (this.type ?? {}) as FilterPortType;

    // A `query-filter` parameter is an object in project data; a `byob-filter`
    // one is a JSON string. Decided by the *port*, not by what happens to be
    // stored — a filter that changed shape on save depending on what it was
    // last time would be unreadable by whichever node did not expect it.
    const savesAsString = portType.name !== 'query-filter';
    const valuePortPrefix = portType.valuePortPrefix ?? DEFAULT_VALUE_PORT_PREFIX;

    const parseValue = (): FilterGroup | null => {
      if (this.value === undefined || this.value === null || this.value === '') return null;
      try {
        const parsed: unknown = typeof this.value === 'string' ? JSON.parse(this.value as string) : this.value;
        if (!parsed || typeof parsed !== 'object') return null;

        // A `QueryEditor` filter, saved before BCN-003b retired that builder.
        // Rewritten into the format this one saves — going *directly*, not via
        // the neutral model, because the neutral model resolves a connected
        // value into whatever was on the wire and loses the port's name with it.
        if (isVisualQueryFormat(parsed)) {
          return visualQueryToSaved(parsed, { valuePortPrefix }) as unknown as FilterGroup;
        }

        if (Array.isArray((parsed as SavedFilterGroup).conditions)) {
          // BCN-003: filters saved before that task spell their operators the
          // Directus way (`_eq`), because that is what the builder used to
          // emit straight into project data. Migrated on the way in, and
          // `needsOperatorMigration` keeps it idempotent — a filter already in
          // the neutral vocabulary comes back the same object, so opening a
          // project does not rewrite filters nobody touched.
          return (
            needsOperatorMigration(parsed as SavedFilterGroup)
              ? migrateSavedFilter(parsed as SavedFilterGroup)
              : parsed
          ) as unknown as FilterGroup;
        }

        // A raw Directus filter, from the JSON editing affordance or from
        // before the builder existed. `fromDirectusFilter` reads it back in the
        // neutral vocabulary.
        return fromDirectusFilter(parsed as Parameters<typeof fromDirectusFilter>[0]);
      } catch (e) {
        console.warn('[ByobFilterType] Failed to parse existing filter:', e);
      }
      return null;
    };

    /**
     * The schema, in the one shape the builder reads.
     *
     * The Parse family describes a collection as `{properties, relations}` and
     * BYOB as `{collection, fields}`. Converting at this edge rather than
     * teaching the builder both is the same separation `translators/saved.ts`
     * makes for the saved format — and branching on backend family *inside* a
     * builder is how there came to be two of them.
     */
    const resolveSchema = (): SchemaCollection | null => {
      const schema = portType.schema;
      if (!schema) return null;
      if (isParseSchema(schema)) return parseSchemaToCollection(schema, portType.collection);
      const byob = schema as { collection?: string; name?: string; fields?: unknown[] };
      // ⚠️ `byob-query-data` declares `{collection, fields}` while the builder's
      // own type says `{name, fields}`, so the modal's "Collection: …" subtitle
      // has never appeared for a BYOB filter. Named here rather than left.
      return { ...(byob as SchemaCollection), name: byob.name ?? byob.collection ?? '' };
    };

    /**
     * What the chosen backend can express, straight from its descriptor.
     *
     * The same cell the translator refuses on, so the sentence under an
     * operator here and the one thrown at runtime cannot drift — that is why
     * BCN-003 put the declaration in the descriptor instead of in each
     * translator. A port that declares no backend gates nothing, which is the
     * safe floor: it can only fail to hide an operator, never hide one the
     * backend could have answered.
     */
    const resolveCapabilities = (): OperatorCapabilities | undefined => {
      if (!portType.backend) return undefined;
      try {
        return descriptorFor(portType.backend).filters as unknown as OperatorCapabilities;
      } catch (e) {
        console.warn('[ByobFilterType] Unknown backend on filter port:', portType.backend, e);
        return undefined;
      }
    };

    const renderButton = (filterValue: FilterGroup | null) => {
      const props = {
        value: filterValue,
        schema: resolveSchema(),
        capabilities: resolveCapabilities(),
        valuePortPrefix,
        onChange: (filter: FilterGroup) => {
          const stored: unknown = savesAsString ? JSON.stringify(filter) : filter;

          const undoArgs = { undo: true, label: 'filter changed', oldValue: this.value };
          this.value = stored;
          this.parent.model.setParameter(this.name, stored, undoArgs);
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

    this.el = div;

    return this.el;
  }
}
