import { ProjectModel } from '../../models/projectmodel';
import DebugInspector from '../../utils/debuginspector';
import { ViewerConnection } from '../../ViewerConnection';
import Inspectors from '../nodegrapheditor.debuginspectors';
import { NodeGraphEditorConnection } from './NodeGraphEditorConnection';
import { NodeGraphEditorNode } from './NodeGraphEditorNode';

import type { NodeGraphModel } from '../../models/nodegraphmodel';
import type { NodeGraphEditor } from '../nodegrapheditor';

/**
 * Model→view synchronisation for the node graph editor (PLAT-001 wave 2
 * extraction — bodies moved verbatim from nodegrapheditor.ts bindModel /
 * bindNodeModel / bindDebugInspector / bindProjectModel).
 *
 * IMPORTANT: every subscription made here uses the *editor* as the listener
 * context (`model.on(event, fn, this.editor)`), not this class. The editor's
 * pre-existing teardown paths — `reset()` calling `model.off(this)` and
 * `dispose()` calling `off(this)` on the singletons — rely on that context to
 * detach these listeners; binding with a different context would silently
 * leak them.
 */
export class ModelBindings {
  constructor(private editor: NodeGraphEditor) {}

  /** Tear down all views and unbind the current model (the inverse of bindModel). */
  reset() {
    const editor = this.editor;

    editor.clearSelection({ disableHidePanels: true });
    editor.highlighted && ViewerConnection.instance.sendNodeHighlighted(editor.highlighted.model, false);
    editor.highlighted = undefined; // This is not cleared in clearSelection

    // Delete existing nodes and connections
    while (editor.roots.length > 0) {
      const root = editor.roots[0];
      editor.removeRoot(root);
      root.destruct();
    }

    // Remove all connections
    while (editor.connections.length > 0) {
      const con = editor.connections[0];
      con.disconnect(con);
    }

    // Remove all debug inspectors
    while (editor.inspectors.length > 0) {
      editor.removeInspector(editor.inspectors[0]);
    }

    if (editor.model) {
      // Unbind from current model
      editor.model.off(editor);
      editor.model.commentsModel.off(editor);
      for (const i in editor.model.roots) {
        editor.model.roots[i].forEach((model) => {
          this.unbindNodeModel(model);
        });
      }
    }
  }

  bindModel(model?: NodeGraphModel) {
    const _this = this.editor;
    const owner = this.editor;

    owner.reset();

    owner.model = model;
    owner.stateText = owner.readOnly ? 'Read Only' : null;
    owner.updateTitle();
    if (!model) return;

    // Create views for the content of the model
    owner.roots = [];
    for (const i in model.roots) {
      const node = NodeGraphEditorNode.createFromModel(model.roots[i], owner);

      model.roots[i].forEach(function (model) {
        _this.modelBindings.bindNodeModel(model);
      });

      owner.roots.push(node);
    }

    owner.connections = [];
    for (const i in model.connections) {
      NodeGraphEditorConnection.createFromModel(model.connections[i], owner);
    }

    // Listen to when a node is attached in the model and
    // change the view accordingly
    model.on(
      'nodeAdded',
      function (args) {
        const node = NodeGraphEditorNode.createFromModel(args.model, _this);
        _this.modelBindings.bindNodeModel(args.model);

        if (args.model.parent) {
          const parent = _this.findNodeWithId(args.model.parent.id);
          const index = args.model.parent.children.indexOf(args.model);
          parent.insertChild(node, index);
        } else {
          _this.roots.push(node);
        }

        if (!args?.disableSelect) {
          _this.clearSelection();

          //let the event loop do one tick before selecting, there might be other listeners that want to modify some paramters (like the router adapter)
          setTimeout(() => {
            if (_this.selector.active) {
              return;
            }
            _this.selectNode(node);
            _this.relayout();
            _this.repaint();
          }, 1);
        } else {
          _this.relayout();
          _this.repaint();
        }
      },
      this.editor
    );

    model.commentsModel.on(
      'commentAdded',
      ({ comment, args }) => {
        owner.clearSelection();

        if (args && args.focusComment) {
          owner.commentLayer && owner.commentLayer.focusComment(comment.id);
        }
      },
      this.editor
    );

    model.on(
      'nodeRemoved',
      (args) => {
        const node = owner.findNodeWithId(args.model.id);
        if (!node) return; // The node was not found

        /**
         * Was THIS node the selected one? Read before anything unselects it.
         *
         * `clearSelection()` below hides the node panels, which for a *transient*
         * panel means unmounting it and losing its state. Removing a node nobody
         * had selected must therefore leave the panels alone — WFA-008 found the
         * consequence live: redrawing a workflow's trigger entry nodes removes
         * the manual marker, which bounced the Triggers panel away to Components
         * and **destroyed the banner holding a webhook's one-time, unrecoverable
         * secret** one tick after it was created.
         */
        const wasSelected = node.selected || owner.selector.nodes.indexOf(node) !== -1;

        // If the highlighted node is delete empty the reference
        if (owner.highlighted === node) {
          owner.highlighted && ViewerConnection.instance.sendNodeHighlighted(owner.highlighted.model, false);
          owner.highlighted = undefined;
        }

        //de-select in case it's active
        owner.selector.unselectNode(node);

        const inspector = owner.getInspectorForNode(node);
        inspector && inspector.remove();

        this.unbindNodeModel(args.model);

        if (node.parent) {
          node.parent.removeChild(node);
          node.destruct();
        } else {
          owner.removeRoot(node);
          node.destruct();
        }

        owner.clearSelection({ disableHidePanels: !wasSelected });
        owner.relayout();
        owner.repaint();

        if (!owner.selector.active) {
          owner.updateNodeToolbar();
        }
      },
      this.editor
    );

    model.on(
      'nodeAttached',
      function (args) {
        const node = _this.findNodeWithId(args.model.id);
        const parent = _this.findNodeWithId(args.parent.id);
        parent.insertChild(node, args.index);
        _this.removeRoot(node);

        _this.relayout();
        _this.repaint();
      },
      this.editor
    );

    // Listen to when a node is detached in the model
    model.on(
      'nodeDetached',
      function (args) {
        const node = _this.findNodeWithId(args.model.id);
        node && node.detach();
        _this.roots.push(node);

        _this.relayout();
        _this.repaint();
      },
      this.editor
    );

    // Connections
    model.on(
      'connectionAdded',
      function (args) {
        NodeGraphEditorConnection.createFromModel(args.model, _this, _this.canvas.ctx);

        _this.relayout();
        _this.repaint();
      },
      this.editor
    );

    model.on(
      'connectionRemoved',
      function (args) {
        const con = _this.findConnectionWithModel(args.model);
        con && con.disconnect();

        // Don't leave hover or selection (CAN-003) pointing at a wire whose
        // view has just been disconnected — `paint` would throw on the next
        // frame, and Delete would act on nothing.
        if (con && _this.highlightedConnection === con) _this.setHighlightedConnection(undefined);
        if (con && _this.selectedConnection === con) _this.selectedConnection = undefined;

        const inspector = _this.getInspectorForConnection(con);
        inspector && inspector.remove();

        _this.relayout();
        _this.repaint();
      },
      this.editor
    );

    model.on(
      'connectionPortChanged',
      function (args) {
        const con = _this.findConnectionWithModel(args.model);
        con.fromProperty = args.model.fromProperty;
        con.toProperty = args.model.toProperty;

        con.resolvePorts();

        _this.relayout();
        _this.repaint();
      },
      this.editor
    );

    owner.layout();
    owner.paint();

    // Bind connection inspector and models after the first paint so they know what x and y position to attach to
    this.bindDebugInspector();
  }

  bindNodeModel(model) {
    const _this = this.editor;

    model.on(
      ['labelChanged', 'portRearranged', 'typeRenamed'],
      function () {
        _this.relayout();
        _this.repaint();
      },
      this.editor
    );
  }

  unbindNodeModel(model) {
    model.off(this.editor);
  }

  bindDebugInspector() {
    const _this = this.editor;

    // Add inspector views
    function createConnectionInspector(model) {
      const connection = _this.findConnectionWithKey(model.connectionKey);
      if (connection && connection.isHealthy()) {
        // Is this a connection in this graph
        return new Inspectors.ConnectionInspector({
          model,
          connection,
          owner: _this,
          parentElement: _this.domElementContainer
        });
      }
    }

    function createNodeInspector(model) {
      const node = _this.findNodeWithId(model.nodeId);
      if (node) {
        return new Inspectors.NodeInspector({
          model,
          node,
          owner: _this,
          parentElement: _this.domElementContainer
        });
      }
    }

    function createInspector(model) {
      if (model.type === 'connection') {
        return createConnectionInspector(model);
      } else {
        return createNodeInspector(model);
      }
    }

    const inspectorsModel = DebugInspector.InspectorsModel.instanceForProject(ProjectModel.instance);
    _this.inspectorsModel = inspectorsModel;
    inspectorsModel.getInspectors().forEach((model) => {
      const inspector = createInspector(model);
      if (inspector) {
        _this.inspectors.push(inspector);
        inspector.render();
      }
    });

    inspectorsModel.off(this.editor);
    inspectorsModel.on(
      'inspectorAdded',
      (args) => {
        const inspector = createInspector(args.model);
        if (inspector) {
          _this.inspectors.push(inspector);
          inspector.render();
        }
      },
      this.editor
    );

    inspectorsModel.on(
      'inspectorRemoved',
      (args) => {
        const inspector = _this.findInspectorWithModel(args.model);
        _this.removeInspector(inspector);
      },
      this.editor
    );
  }

  bindProjectModel() {
    const _this = this.editor;

    ProjectModel.instance.on(
      'componentRemoved',
      (e) => {
        _this.navigationHistory.onComponentRemoved(e.model);
      },
      this.editor
    );

    ProjectModel.instance.on(
      'componentRenamed',
      (e) => {
        _this.updateTitle();
      },
      this.editor
    );
  }
}
