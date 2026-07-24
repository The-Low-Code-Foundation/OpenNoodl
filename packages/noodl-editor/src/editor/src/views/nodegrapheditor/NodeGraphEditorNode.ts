import _ from 'underscore';

import { AiAssistantModel } from '@noodl-models/AiAssistant';
import { ComponentModel } from '@noodl-models/componentmodel';
import { NodeGraphNode } from '@noodl-models/nodegraphmodel';

import { ProjectModel } from '../../models/projectmodel';
import { ViewerConnection } from '../../ViewerConnection';
import { NodeGraphEditor } from '../nodegrapheditor';
import PopupLayer from '../popuplayer';
import { nodeShouldAttach } from './nodeAttachment';
import { NodeGraphEditorConnection } from './NodeGraphEditorConnection';
import { measureTextHeight, paintNode } from './NodeGraphEditorNodePainter';

export class NodeGraphEditorNode {
  public static readonly size = { width: 150, height: 36 };
  public static readonly childMargin = 20;
  public static readonly childSpacing = 10;
  public static readonly borderSize = 7;
  public static readonly attachedThreshold = 20;
  public static readonly propertyConnectionHeight = 20;
  public static readonly verticalSpacing = 8;
  public static readonly cornerRadius = 6;

  model: NodeGraphNode;
  x: number;
  y: number;
  global: { x: number; y: number };
  id: string;
  children: NodeGraphEditorNode[];
  connections: NodeGraphEditorConnection[];
  nodeSize: { width: number; height: number };
  owner: NodeGraphEditor;
  parent: NodeGraphEditorNode;
  isTrackingMove: TSFixme;
  borderHighlighted: boolean;
  connectionDragAreaHighlighted: boolean;
  _cachedLabelHeightTextKey: string;
  _cachedLabelHeight: number;
  _cachedSublabelHeightText: string;
  _cachedSublabelHeight: number;
  selected: boolean;
  measuredSize: TSFixme;
  plugs: TSFixme[];

  icon: HTMLImageElement;
  rotatingIcon: HTMLImageElement;
  iconSize: number;
  iconRotation: number;

  commentIconBounds: { x: number; y: number; width: number; height: number } | undefined;

  constructor(model) {
    this.model = model;
    this.x = model.x || 0;
    this.y = model.y || 0;
    this.global = { x: 0, y: 0 };
    this.id = model.id;
    this.children = [];
    this.connections = [];
    this.nodeSize = NodeGraphEditorNode.size;
    this.iconRotation = 0;
    this.bindModel();

    return this;
  }

  static createFromModel(model, owner, parent?) {
    const node = new NodeGraphEditorNode(model);

    node.owner = owner;
    node.parent = parent;

    _.each(model.children, function (child) {
      node.children.push(NodeGraphEditorNode.createFromModel(child, owner, node));
    });

    return node;
  }

  updateIcon() {
    const health = this.model.getHealth();
    this.iconSize = 18;
    this.rotatingIcon = null;

    if (!health.healthy) {
      this.icon = this.owner?.icons.warning;
    } else if (this.model.type instanceof ComponentModel && this.owner?.icons.component) {
      this.icon = this.owner?.icons.component;
    } else if (this.id === ProjectModel.instance.getRootNode()?.id) {
      this.icon = this.owner?.icons.home;
    } else if (this.model.metadata?.AiAssistant) {
      this.icon = this.owner?.icons.aiAssistantInner;
      this.rotatingIcon = this.owner?.icons.aiAssistantOuter;
      this.iconSize = 25;
      if (AiAssistantModel.instance.getProcessingNodeIds().includes(this.id)) {
        this.iconRotation = performance.now() / 400;
      } else {
        this.iconRotation = 0;
      }
    } else {
      this.icon = undefined;
    }
  }

  bindModel() {
    const _this = this;
    this.model.on(
      'change',
      function (args) {
        _this.owner.relayout();
        _this.owner.repaint();
      },
      this
    );

    this.model.on(
      'instancePortsChanged',
      function () {
        _this.connections.forEach(function (c) {
          c.resolvePorts();
        });
        _this.owner.relayout();
        _this.owner.repaint();
      },
      this
    );
  }

  destruct() {
    this.model.off(this);

    for (const child of this.children) {
      child.destruct();
    }
  }

  updateModel() {
    this.model.set({ x: this.x, y: this.y });
  }

  forEach(callback: (child: NodeGraphEditorNode) => boolean) {
    if (callback(this)) {
      return true;
    }
    for (const i in this.children) {
      if (this.children[i].forEach(callback)) {
        return false;
      }
    }
  }

  pointInside(pos) {
    const bw = NodeGraphEditorNode.borderSize;
    const inside =
      pos.x >= this.x - bw &&
      pos.x <= this.x + this.nodeSize.width + bw &&
      pos.y >= this.y - bw &&
      pos.y <= this.y + this.nodeSize.height + bw;

    return inside;
  }

  propagateMouse(type, pos, evt) {
    // Propagate mouse event to children
    for (const child of this.children) {
      child.propagateMouse(type, { x: pos.x - this.x, y: pos.y - this.y }, evt);
    }

    // Enlarge the hit area with the border size
    if (this.pointInside(pos) && type !== 'out') {
      if (type === 'move' && !this.isTrackingMove) {
        // If this is a move event and this node is not tracking move events
        // generate a move in first
        this.mouse('move-in', { x: pos.x - this.x, y: pos.y - this.y }, evt);
        this.isTrackingMove = true;
      }
      this.mouse(type, { x: pos.x - this.x, y: pos.y - this.y }, evt);
    } else if (this.isTrackingMove) {
      // The mouse exited the node, if it was tracking generate a move out event
      this.isTrackingMove = false;
      this.mouse('move-out', { x: pos.x - this.x, y: pos.y - this.y }, evt);
    }
  }

  mouse(type, pos, evt) {
    if (evt.button !== 0) return; //only interact with left mouse button

    evt.consumed = true;

    switch (type) {
      case 'move':
      case 'move-in':
        // Is the mouse hovering the border or body of the node?
        var bw = NodeGraphEditorNode.borderSize;
        if (pos.x < bw || pos.x > this.nodeSize.width - bw || pos.y < bw || pos.y > this.nodeSize.height - bw) {
          this.borderHighlighted = true;
        } else {
          this.borderHighlighted = false;
        }

        // Send node highlighted to viewer if this node is being highligted
        if (!this.borderHighlighted) ViewerConnection.instance.sendNodeHighlighted(this.model, true);

        this.owner.setHighlightedNode(this, pos);

        // Show tooltop if this node is annotated
        if (this.model.annotation) {
          PopupLayer.instance.showTooltip({
            x: evt.pageX,
            y: evt.pageY,
            position: 'bottom',
            content: this.model.annotation
          });
        } else {
          // Show tooltip if the connection is unhealthy
          const health = this.model.getHealth();
          if (!health.healthy) {
            PopupLayer.instance.showTooltip({
              x: evt.pageX,
              y: evt.pageY,
              position: 'bottom',
              content: health.message
            });
          }
        }

        this.connectionDragAreaHighlighted = pos.x > this.nodeSize.width - 20 && pos.y < 20;

        const showCrosshairCursor = this.connectionDragAreaHighlighted || this.borderHighlighted;
        this.owner.el.css({
          cursor: showCrosshairCursor ? 'crosshair' : 'initial'
        });

        this.owner.repaint();
        break;
      case 'move-out':
        PopupLayer.instance.hideTooltip();

        this.owner.el.css({ cursor: 'initial' });

        // Clear highlight on move out
        if (this.owner.highlighted === this) {
          this.owner.setHighlightedNode(undefined);
        }

        this.connectionDragAreaHighlighted = false;
        this.borderHighlighted = false;
        this.owner.repaint();

        ViewerConnection.instance.sendNodeHighlighted(this.model, false);
        break;
      case 'down':
        PopupLayer.instance.hideTooltip();

        if (this.owner.highlighted === this) {
          // Check if clicking on comment icon
          const inCommentIcon = this.commentIconBounds && this.isPointInCommentIcon(pos);

          if (inCommentIcon) {
            // Show comment edit prompt
            this.showCommentEditPopup();
            evt.stopPropagation && evt.stopPropagation();
            return;
          }

          if (this.borderHighlighted || this.connectionDragAreaHighlighted) {
            // User starts dragging from the border or connection area with circle icon
            this.owner.startDraggingConnection(this);
          } else {
            if (evt.shiftKey) {
              this.owner.addNodeToSelection(this);
            } else {
              this.owner.startDraggingNode(this);
            }
          }
        }
        break;
      case 'up':
        {
          const hasModifierKey = evt.metaKey || evt.ctrlKey || evt.shiftKey;
          if (!hasModifierKey) {
            this.owner.selectNode(this);
          }
        }
        break;
    }
  }

  isProjectRoot() {
    return ProjectModel.instance.getRootNode() === this.model;
  }

  isComponent() {
    return this.model.type instanceof ComponentModel;
  }

  titlebarLabelHeight() {
    const cacheKey = this.model.label + (this.icon ? 'icon' : '');
    if (cacheKey !== this._cachedLabelHeightTextKey) {
      const connectionDragAreaWidth = 10;
      const horizontalSpacing = 10;

      const iconOffset = this.icon ? 12 : 0;

      const maxWidth = this.nodeSize.width - 2 * horizontalSpacing - connectionDragAreaWidth - iconOffset;

      this._cachedLabelHeight = measureTextHeight(this.model.label, '12px Inter-Regular', 14, maxWidth);
      this._cachedLabelHeightTextKey = cacheKey;
    }

    return this._cachedLabelHeight;
  }

  titlebarSublabelHeight() {
    if (this.typeDisplayName() !== this._cachedSublabelHeightText) {
      const connectionDragAreaWidth = 10;
      const horizontalSpacing = 10;
      const maxWidth = this.nodeSize.width - 2 * horizontalSpacing - connectionDragAreaWidth;

      this._cachedSublabelHeight = measureTextHeight(this.typeDisplayName(), '12px Inter-Regular', 14, maxWidth);
      this._cachedSublabelHeightText = this.typeDisplayName();
    }

    return this._cachedSublabelHeight;
  }

  titlebarHeight() {
    const labelExtraHeight = this.model.label !== this.typeDisplayName() ? this.titlebarSublabelHeight() : 0;
    return this.titlebarLabelHeight() + labelExtraHeight + 22;
  }

  typeDisplayName() {
    return this.model.metadata?.typeLabelOverride || this.model.type.displayName;
  }

  paint(ctx: CanvasRenderingContext2D, paintRect, options?) {
    paintNode(this, ctx, paintRect, options);
  }

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.global.x = x + (this.parent ? this.parent.global.x : 0);
    this.global.y = y + (this.parent ? this.parent.global.y : 0);
  }

  layout() {
    let y = this.nodeSize.height + NodeGraphEditorNode.childSpacing;
    _.each(this.children, function (child) {
      const size = child.measure();

      child.setPosition(NodeGraphEditorNode.childMargin, y);
      child.layout(); // Recurse to layout children

      y += size.height + NodeGraphEditorNode.childSpacing;
    });
  }

  sortConnections() {
    const _this = this;

    this.connections.sort(function (a, b) {
      return a.getPropertyFor(_this) < b.getPropertyFor(_this) ? -1 : 1;
    });
  }

  measure() {
    if (this.measuredSize) return this.measuredSize;

    if (!this.children) {
      this.measuredSize = NodeGraphEditorNode.size;
    } else {
      const size = {
        width: NodeGraphEditorNode.size.width,
        height: NodeGraphEditorNode.size.height
      };

      // Collect all connections into plugs and groups
      const plugs = (this.plugs = []);
      /*  var groups = this.plugGroups = {};
      function addPlugToGroup(p,group) {
        var name = group?group:'Other';
        if(!groups[name]) groups[name] = {name:name,leftCons:0,rightCons:0,plugs:[]};
        groups[name].plugs.push(p);
        return groups[name];
      }*/
      for (const i in this.connections) {
        const con = this.connections[i];
        const prop = con.getPropertyFor(this);
        const loc = con.getLocationRelativeTo(this) === 'left' ? 'right' : 'left';
        let p = plugs[plugs.length - 1];

        // Connections are sorted alphabetically, so if there are multiple connections
        // to this port they will be directly after each other in the array
        if (p && p.property === prop) {
          p.loc = p.loc === loc ? loc : 'middle'; // have connection on multiple side, center the plug
          con.setPlugFor(this, p);
        } else {
          plugs.push({
            property: prop,
            displayName: con.getPortDisplayNameFor(this),
            loc: loc,
            dir: con.getDirectionFor(this),
            leftCons: [],
            rightCons: [],
            index: con.getPortIndexFor(this)
          });
          p = plugs[plugs.length - 1];
          con.setPlugFor(this, p);
          //addPlugToGroup(p,con.getPortGroupNameFor(this));
        }

        // Store the connections based on where they are coming from
        if (loc === 'left') p.leftCons.push(con);
        else p.rightCons.push(con);

        // Set the icon for the left or right side of the plug
        p[loc + 'Icon'] =
          p[loc + 'Icon'] === undefined || p[loc + 'Icon'] === con.getDirectionFor(this)
            ? con.getDirectionFor(this)
            : 'both';
      }

      plugs.sort((a, b) => a.index - b.index);

      // Layout and measure connections
      const rowBreakPortNameLength = 10;
      let offset = 0;

      function layoutPlugs(plugs, g) {
        for (const p of plugs) {
          // Measure and place the plugs
          const label = p.displayName ? p.displayName : p.property;
          if (p.loc === 'middle' || label.length > rowBreakPortNameLength) {
            // p.col is 'middle' or string to long to share line
            p.index = Math.max(g.rightCons, g.leftCons) + offset;
            g.rightCons = g.leftCons = p.index + 1 - offset;
          } else if (p.loc === 'left') {
            p.index = g.leftCons + offset;
            g.leftCons++;
          } else if (p.loc === 'right') {
            p.index = g.rightCons + offset;
            g.rightCons++;
          }
        }
        return Math.max(g.rightCons, g.leftCons);
      }

      // Don't show group title if there is only and Other group
      offset = layoutPlugs(plugs, { leftCons: 0, rightCons: 0 });

      this.updateIcon(); //make sure we have the right icon when measuring

      if (offset === 0) {
        // No plugs
        size.height = Math.max(NodeGraphEditorNode.size.height, this.titlebarHeight());
      } else {
        size.height =
          offset * NodeGraphEditorNode.propertyConnectionHeight +
          this.titlebarHeight() +
          NodeGraphEditorNode.verticalSpacing * 2;
      }

      this.nodeSize = { width: size.width, height: size.height };

      _.each(this.children, function (child) {
        const childSize = child.measure();
        size.height += childSize.height + NodeGraphEditorNode.childSpacing;
        size.width = Math.max(NodeGraphEditorNode.childMargin + childSize.width, size.width);
      });

      this.measuredSize = size;
    }
    return this.measuredSize;
  }

  shouldConnect(pos, fromNode, origin?) {
    const x = (origin ? origin.x : 0) + this.x;
    const y = (origin ? origin.y : 0) + this.y;

    if (pos.x > x && pos.x < x + this.nodeSize.width && pos.y > y && pos.y < y + this.nodeSize.height) {
      return this;
    }

    // Recurse to children
    for (const i in this.children) {
      const node = this.children[i].shouldConnect(pos, fromNode, { x: x, y: y });
      if (node) return node;
    }
  }

  isVisual() {
    return this.model.type.visual;
  }

  canHaveVisualChildren() {
    return this.model.type.canHaveVisualChildren;
  }

  shouldAttach(pos, nodes) {
    return nodeShouldAttach(this, pos, nodes);
  }

  insertChild(child, index) {
    // Move child position into local coords
    const global = this.global;
    child.x -= global.x;
    child.y -= global.y;

    // Insert child in hierarchy
    child.parent = this;
    this.children.splice(index, 0, child);
  }

  addChild(child) {
    this.children.push(child);
    child.parent = this;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    idx !== -1 && this.children.splice(idx, 1);
  }

  detach() {
    if (this.parent) {
      // Find my position in global space
      const global = this.global;
      this.x = global.x;
      this.y = global.y;

      // Detatch
      const idx = this.parent.children.indexOf(this);
      this.parent.children.splice(idx, 1);
      this.parent = undefined;
    }
  }

  /**
   * Check if a point (in local node coordinates) is within the comment icon bounds
   */
  isPointInCommentIcon(pos: { x: number; y: number }): boolean {
    if (!this.commentIconBounds) return false;

    // Convert local pos to global for comparison with commentIconBounds (which are in global coords)
    const globalX = pos.x + this.global.x;
    const globalY = pos.y + this.global.y;

    const bounds = this.commentIconBounds;
    const padding = 4; // Extra hit area padding for easier clicking

    return (
      globalX >= bounds.x - padding &&
      globalX <= bounds.x + bounds.width + padding &&
      globalY >= bounds.y - padding &&
      globalY <= bounds.y + bounds.height + padding
    );
  }

  /**
   * Show a popup for editing the node comment
   */
  showCommentEditPopup() {
    const currentComment = this.model.getComment() || '';
    const nodeLabel = this.model.label || 'Node';
    const model = this.model;
    const owner = this.owner;

    // Use PopupLayer.StringInputPopup for Electron compatibility
    const popup = new PopupLayer.StringInputPopup({
      label: `Comment for "${nodeLabel}"`,
      okLabel: 'Save',
      cancelLabel: 'Cancel',
      onOk: (newComment: string) => {
        // Set comment with undo support
        model.setComment(newComment || undefined, {
          undo: true,
          label: newComment ? 'Edit node comment' : 'Remove node comment'
        });

        // Repaint to update the icon appearance
        owner.repaint();
        PopupLayer.instance.hidePopup();
      },
      onCancel: () => {
        PopupLayer.instance.hidePopup();
      }
    });

    // Render popup BEFORE showing it
    popup.render();

    // Set initial value after render
    popup.$('.string-input-popup-input').val(currentComment);

    // Use requestAnimationFrame + setTimeout to ensure we're past both the current
    // event cycle AND any pending DOM updates. This prevents the PopupLayer's body
    // click handler from immediately closing the popup.
    requestAnimationFrame(() => {
      setTimeout(() => {
        PopupLayer.instance.showPopup({
          content: popup,
          position: 'screen-center',
          isBackgroundDimmed: true
        });
      }, 100); // 100ms delay to be extra safe
    });
  }
}
