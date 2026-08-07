import { ipcRenderer } from 'electron';
import React from 'react';

import { UndoActionGroup, UndoQueue } from '@noodl-models/undo-queue-model';

import { ConnectionPopup } from '../ConnectionPopup';
import PopupLayer from '../popuplayer';
import { ToastLayer } from '../ToastLayer/ToastLayer';

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

      const canvas = _this.shell.canvas;
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
        // UIX-012: was a hardcoded grey. The stylesheet's own default for this
        // arrow is `--theme-color-bg-5`; name it so it flips with the theme.
        arrowColor: 'var(--theme-color-bg-5)',
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
        // UIX-012: was a hardcoded grey. The stylesheet's own default for this
        // arrow is `--theme-color-bg-5`; name it so it flips with the theme.
        arrowColor: 'var(--theme-color-bg-5)',
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

  /**
   * The port picker for a reroute drop (CAN-003).
   *
   * One picker, not two: a rewire is the same "connect these two nodes"
   * operation with one end already decided, so only the moved end needs a
   * port. It resolves as remove-old + add-new inside a single UndoActionGroup,
   * which is what makes one undo restore the original wire.
   */
  openForReroute() {
    const editor = this.editor;
    const rerouting = editor.interaction.reroutingConnection;
    if (!rerouting) return;

    const connection = rerouting.connection;
    const targetNode = rerouting.toNode;
    const end = rerouting.end;
    const previous = connection.model;

    ipcRenderer.send('viewer-hide');
    editor.deselect();

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

      const canvas = editor.shell.canvas;
      const tl = topLeft(canvas);
      const panAndScale = editor.getPanAndScale();

      targetNode.borderHighlighted = true;

      const finish = () => {
        targetNode.borderHighlighted = false;
        editor.interaction.cancelReroutingConnection();
        PopupLayer.instance.hidePopout(popout);
      };

      const rewire = (port: string) => {
        const next =
          end === 'to'
            ? { ...previous, toId: targetNode.model.id, toProperty: port }
            : { ...previous, fromId: targetNode.model.id, fromProperty: port };

        // Landing back where it started is not an edit: no undo entry, no
        // dirty project.
        const unchanged =
          next.fromId === previous.fromId &&
          next.fromProperty === previous.fromProperty &&
          next.toId === previous.toId &&
          next.toProperty === previous.toProperty;

        if (unchanged) {
          finish();
          return;
        }

        const sourceNode = end === 'to' ? connection.fromNode.model : targetNode.model;
        const sinkNode = end === 'to' ? targetNode.model : connection.toNode.model;
        const status = editor.model.getConnectionStatus({
          sourceNode,
          sourcePort: next.fromProperty,
          targetNode: sinkNode,
          targetPort: next.toProperty
        });

        if (!status.connectable) {
          ToastLayer.showError(status.message.replace(/<[^>]+>/g, ''));
          finish();
          return;
        }

        const undo = new UndoActionGroup({ label: 'rewire connection' });
        editor.model.removeConnection(previous, { undo });
        editor.model.addConnection(next, { undo });
        UndoQueue.instance.push(undo);

        finish();
      };

      const props = {
        model: targetNode.model,
        type: end === 'to' ? 'to' : 'from',
        // The pinned end, so the target picker can filter by source type.
        fromNode: end === 'to' ? connection.fromNode.model : undefined,
        sourcePort: end === 'to' ? previous.fromProperty : undefined,
        disabled: false,
        title: end === 'to' ? 'Select input' : 'Select output',
        isPanelActive: () => true,
        onPortSelected: (port: string) => rewire(port)
      };

      const div = document.createElement('div');
      const overlay = editor.overlays.mount(div, React.createElement(ConnectionPopup, props));

      const position = targetNode.global.x > (connection.fromNode?.global.x ?? 0) - 10 ? 'left' : 'right';
      const popout = PopupLayer.instance.showPopout({
        content: { el: div },
        position,
        arrowColor: 'var(--theme-color-bg-5)',
        attachToPoint: {
          x:
            (targetNode.global.x + panAndScale.x) * panAndScale.scale +
            tl[0] +
            targetNode.nodeSize.width * (position === 'left' ? 0 : 1.0) * panAndScale.scale,
          y: (targetNode.global.y + panAndScale.y) * panAndScale.scale + tl[1] + 20 * panAndScale.scale
        },
        onClose: () => {
          overlay.unmount();
          // Closing without picking cancels the reroute — the wire is
          // untouched, and this is the path that puts the viewer and the DOM
          // layer back.
          targetNode.borderHighlighted = false;
          editor.interaction.cancelReroutingConnection();
        }
      });
    }, 0);
  }

  close() {
    ipcRenderer.send('viewer-show');
  }
}
