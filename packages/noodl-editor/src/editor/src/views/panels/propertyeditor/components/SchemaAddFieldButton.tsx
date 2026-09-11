import React from 'react';

import { SidebarModel } from '@noodl-models/sidebar';

import { openBackendSurface } from '../../BackendServicesPanel/LocalBackendCard/backendSurfaces';

export interface SchemaAddFieldButtonProps {
  backendId: string;
  backendName: string;
  /** The table this node is pointed at — never guessed; see `addFieldTarget`. */
  table: string;
}

/**
 * DEF-036 AC4 — the way out, drawn where the question is asked.
 *
 * Richard: *"when someone asks 'where's the First Name field?' because they never added it to
 * the schema, the node is where they are looking, so the way out belongs there."* And the
 * second half of that sentence is the part with teeth: it should jump **straight into the
 * table's schema editor — the exact table already chosen in that node's dropdown, not the data
 * editor's front door.** A button that opens a list of eleven tables has moved the search, not
 * ended it.
 *
 * 🔴 This draws only when {@link addFieldTarget} returned a destination. AC2: *"an Add button
 * that cannot reach a schema editor is a second dead end"* — so there is no disabled state
 * here, no tooltip explaining why it will not work, and no branch that opens the front door as
 * a fallback. Either the jump lands on the right table or the button is not on the panel.
 *
 * Closing returns to `PropertyEditor` rather than to Backend Services, which is where
 * `LocalBackendCard` sends it. The author came from a node and the node is still selected;
 * putting them back in front of a list of backends would be a third place to have to navigate
 * out of.
 */
export function SchemaAddFieldButton({ backendId, backendName, table }: SchemaAddFieldButtonProps) {
  return (
    <div className="property-schema-add-field">
      <button
        type="button"
        className="property-schema-add-field-button"
        data-test={`schema-add-field-${table}`}
        title={`Open the schema for ${table}`}
        onClick={() => {
          openBackendSurface('schema', {
            backendId,
            backendName,
            isRunning: true,
            initialTable: table,
            // Distinct on every press — `SchemaPanel` reuses an already-mounted surface, and a
            // second press on the same node has to re-expand a row the author may have folded.
            openToken: Date.now(),
            onClose: () => SidebarModel.instance.switch('PropertyEditor')
          });
        }}
      >
        Add a field to {table}
      </button>
    </div>
  );
}
