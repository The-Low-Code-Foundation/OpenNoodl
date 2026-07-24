import { ipcRenderer } from 'electron';
import React from 'react';

import { ConnectionPopup } from '../ConnectionPopup';
import PopupLayer from '../popuplayer';

import type { NodeGraphEditor } from '../nodegrapheditor';

/**
 * The two connection port-picker popouts shown when a dragged connection is
 * dropped on a target node (PLAT-001 wave 2 extraction — body moved verbatim
 * from nodegrapheditor.ts openConnectionPanels/closeConnectionPanels).
 *
 * Reads the in-flight connection from `editor.interaction.draggingConnection` (owned by
 * InteractionController) and commits the chosen ports to the model with undo.
 * The React roots go through the editor's OverlayHost so they are covered by
 * dispose.
 */
export class ConnectionPopups {
  constructor(private editor: NodeGraphEditor) {}

  open() {
    const _this = this.editor;

    // Hide viewer
    ipcRenderer.send('viewer-hide');

    // If a single or multiselect node is selected, deselect them
    _this.deselect();

    setTimeout(() => {
      const topLeft = function (obj) {
        let curleft = 0;
        let curtop = 0;
        if (obj.offsetParent) {
          do {
            curleft += obj.offsetLeft;
            curtop += obj.offsetTop;
          } while ((obj = obj.offsetParent));
        }
        return [curleft, curtop];
      };

      const canvas = _this.$('#nodegraphcanvas')[0];
      const tl = topLeft(canvas);

      const panAndScale = _this.getPanAndScale();

      const fromNode = _this.interaction.draggingConnection.fromNode;
      const toNode = _this.interaction.draggingConnection.toNode;

      const fromNodeXPos = fromNode.global.x - 10;

      fromNode.borderHighlighted = true;
      toNode.borderHighlighted = false;

      let activePanel = 'from';

      function isPanelActive(id: string) {
        return activePanel === id;
      }

      // Show source node port picker
      const fromProps = {
        model: fromNode.model,
        type: 'from',
        disabled: false,
        isPanelActive,
        onPortSelected: (fromPort) => {
          activePanel = 'to';
          // @ts-expect-error
          toProps.sourcePort = fromPort;
          toProps.disabled = false;
          toOverlay.update(React.createElement(ConnectionPopup, toProps));

          fromProps.disabled = true;
          fromOverlay.update(React.createElement(ConnectionPopup, fromProps));

          fromNode.borderHighlighted = false;
          toNode.borderHighlighted = true;
          _this.repaint();
        }
      };
      const fromDiv = document.createElement('div');
      const fromOverlay = _this.overlays.mount(fromDiv, React.createElement(ConnectionPopup, fromProps));

      const fromPosition = toNode.global.x > fromNodeXPos ? 'left' : 'right';

      ipcRenderer.send('viewer-hide');

      const fromPopout = PopupLayer.instance.showPopout({
        content: { el: fromDiv },
        position: fromPosition,
        arrowColor: '#464648',
        attachToPoint: {
          x:
            (fromNode.global.x + panAndScale.x) * panAndScale.scale +
            tl[0] +
            fromNode.nodeSize.width * (fromPosition === 'left' ? 0 : 1.0) * panAndScale.scale,
          y: (fromNode.global.y + panAndScale.y) * panAndScale.scale + tl[1] + 20 * panAndScale.scale
        },
        onClose: () => {
          fromOverlay.unmount();
          ipcRenderer.send('viewer-show');
        }
      });

      // Show target node port picker
      const toProps = {
        model: toNode.model,
        fromNode: fromNode.model,
        type: 'to',
        disabled: true,
        isPanelActive,
        onPortSelected: (toPort) => {
          activePanel = 'from';
          // Make the connection
          // Create the connection, this must be undoable
          // @ts-expect-error
          if (toProps.sourcePort !== undefined) {
            const c = {
              fromId: fromNode.model.id,
              // @ts-expect-error
              fromProperty: toProps.sourcePort,
              toId: toNode.model.id,
              toProperty: toPort
            };

            _this.model.addConnection(c, {
              undo: true,
              label: 'connect'
            });

            // @ts-expect-error
            toProps.sourcePort = undefined;
            toProps.disabled = true;
            toOverlay.update(React.createElement(ConnectionPopup, toProps));

            fromProps.disabled = false;
            fromOverlay.update(React.createElement(ConnectionPopup, fromProps));

            fromNode.borderHighlighted = true;
            toNode.borderHighlighted = false;
            _this.repaint();
          }
        }
      };
      const toDiv = document.createElement('div');
      const toOverlay = _this.overlays.mount(toDiv, React.createElement(ConnectionPopup, toProps));

      const toPosition = fromNodeXPos >= toNode.global.x ? 'left' : 'right';
      const toPopout = PopupLayer.instance.showPopout({
        content: { el: toDiv },
        position: toPosition,
        arrowColor: '#464648',
        attachToPoint: {
          x:
            (toNode.global.x + panAndScale.x) * panAndScale.scale +
            tl[0] +
            toNode.nodeSize.width * (toPosition === 'left' ? 0 : 1.0) * panAndScale.scale,
          y: (toNode.global.y + panAndScale.y) * panAndScale.scale + tl[1] + 20 * panAndScale.scale
        },
        onClose: () => {
          toOverlay.unmount();
          _this.clearSelection();
          _this.repaint();
        }
      });
    }, 0);
  }

  close() {
    ipcRenderer.send('viewer-show');
  }
}
