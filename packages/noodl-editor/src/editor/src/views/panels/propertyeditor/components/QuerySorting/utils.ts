/**
 * What is left of `QueryEditor/utils.ts` after BCN-003b.
 *
 * The filter half — `_supportedTypes`, `_operationsForType`,
 * `_propertiesFromSchema`, `_initializeRuleForProperty`, `_formatValue` — went
 * with the builder it served. Every one of those facts now lives once, in the
 * one builder: the Parse property types the filter understands are in
 * `ByobFilterBuilder/parseSchema.ts`, and which operators a column offers is in
 * `operators.ts`, gated by the backend's own capability table.
 *
 * `openPopup` stays because the sorting rules are popouts.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import PopupLayer from '../../../../popuplayer';

export function openPopup(args) {
  let root: Root | null = null;

  const onChange = () => {
    args.onChange && args.onChange();
    renderPopup();
  };

  const onDelete = () => {
    args.onDelete && args.onDelete();
    PopupLayer.instance.hidePopouts();
  };

  const renderPopup = () => {
    const props = {
      ...args.props,
      onChange,
      onDelete
    };

    if (!root) {
      root = createRoot(div);
    }
    root.render(React.createElement(args.reactComponent, props));
  };

  const div = document.createElement('div');
  div.style.display = 'flex';
  renderPopup();

  PopupLayer.instance.showPopout({
    content: { el: div },
    attachTo: args.attachTo,
    position: 'right',
    onClose() {
      if (root) {
        root.unmount();
        root = null;
      }
    }
  });
}
