import { Connection } from '@noodl-models/nodegraphmodel';
import { NodeLibrary } from '@noodl-models/nodelibrary';
import DebugInspector from '@noodl-utils/debuginspector';
import { EditorSettings } from '@noodl-utils/editorsettings';

import { IVector2, NodeGraphEditor } from '../nodegrapheditor';
import PopupLayer from '../popuplayer';
import { CanvasFonts, CanvasTheme, WireLabel, WIRE_TYPE_ERROR } from './canvas/CanvasTheme';
import { NodeGraphEditorNode } from './NodeGraphEditorNode';
import { textWordWrap } from './NodeGraphEditorNodePainter';
import type { Point, WireRoute } from './wireRouting';
import {
  addMarkAt,
  addMarks,
  cornerAt,
  cornerRadiusAt,
  defaultRoute,
  isDefaultRoute,
  pointOnRoute,
  readRoute,
  routePoints,
  runAt,
  runCoordinate,
  WIRE_ROUTE
} from './wireRouting';
import {
  arrivalDirection,
  arrowheadPolygon,
  chevronPlacements,
  chevronPolyline,
  DIRECTION_CHEVRON,
  glyphScaleFor,
  loopedAge,
  WIRE_ENDPOINT
} from './wireEndpoints';
import {
  arrivalGlow,
  beadRange,
  beadTaper,
  samplePolyline,
  valueDashOffset,
  wirePulseKind,
  WIRE_PULSE
} from './wirePulse';

/** Editor setting: show every wire's label without hovering (CAN-001). */
export const ALWAYS_SHOW_WIRE_LABELS = 'nodeGraphEditor.alwaysShowWireLabels';

/**
 * Editor setting: state every wire's direction along its length (SIG-006 R3).
 *
 * ⚠️ **On by default** — so the stored value is only ever `false`, and an unset
 * key means on. R3 shipped this off by default on a redundancy argument (an end
 * is visible on ~92% of the wires on screen); shown the result, Richard's
 * judgement was the opposite, and specifically that the cue earning its place
 * only past a certain wire length is what makes it worth having always. The
 * measurement stands, the default it implied did not — see `DIRECTION_CHEVRON`
 * for the sweep and SIG-006 R9.
 */
export const ALWAYS_SHOW_WIRE_DIRECTION = 'nodeGraphEditor.alwaysShowWireDirection';

/**
 * Editor setting: draw every wire as right angles instead of a curve (SIG-007).
 *
 * 🔴 **This is not a new routing topology — it is the one that was always
 * there.** Every wire is built as `[P0, {mid, fy}, {mid, ty}, P3]` and then
 * drawn as a cubic *through* those control points, so the control polygon of
 * every wire in this editor is already the orthogonal route. Square mode draws
 * it, with a small fillet at each corner.
 *
 * ⚠️ Off by default, and the default is a **judgement call, not a measurement** —
 * it changes how every wire in every existing project looks. Richard asked to
 * see it; where it lands is his call on sight.
 */
export const SQUARE_WIRE_ROUTING = 'nodeGraphEditor.squareWireRouting';

/**
 * Break a label into the lines the chip will draw (CAN-002).
 *
 * `textWordWrap` from the node painter does the measure-and-break — there is no
 * second wrapper in this codebase — and this collects its callback instead of
 * drawing, because the chip has to be sized before anything is painted into it.
 * Past three lines the text is ellipsised and the full string is available on
 * hover; a wire label is a phrase, and a paragraph belongs in a node comment.
 */
function wrapLabelLines(ctx: CanvasRenderingContext2D, text: string): string[] {
  const lines: string[] = [];
  textWordWrap(ctx, text, 0, 0, WireLabel.lineHeight, WireLabel.maxWidth, (line: string) => lines.push(line));

  if (lines.length <= WireLabel.maxLines) return lines.length ? lines : [text];

  const kept = lines.slice(0, WireLabel.maxLines);
  kept[WireLabel.maxLines - 1] = kept[WireLabel.maxLines - 1] + '…';
  return kept;
}

function getPortName(p) {
  return p ? p.editorName || p.displayName : undefined;
}

function getPortIndex(p) {
  return p ? p.index || 0 : undefined;
}

export class NodeGraphEditorConnection {
  /** Stroke width used for hit-testing the wire (much wider than it paints). */
  static readonly hitStrokeWidth = 10;
  /** Painted radius of an endpoint dot; grows to a handle on highlight. */
  static readonly endpointRadius = 3;
  static readonly endpointHandleRadius = 4;
  /** Grab radius for an endpoint handle — larger than it paints, on purpose. */
  static readonly endpointHitRadius = 8;

  ctx: CanvasRenderingContext2D;
  owner: NodeGraphEditor;

  /**
   * Set while one end of this wire is being dragged (CAN-003). The model is
   * untouched — the connection stays whole and only *paints* with a loose end,
   * so a cancelled drag has nothing to restore. `disconnect()` would null
   * `fromNode`/`toNode` and `paint()` would throw on the next frame.
   */
  rerouting: { end: 'from' | 'to'; pos: IVector2 } | undefined;

  /**
   * The label chip's rect in graph coordinates, written by `paintPortLabel` and
   * read by the drag hit-test (CAN-001). Undefined when no label was painted
   * this frame.
   */
  labelBounds: { x: number; y: number; width: number; height: number } | undefined;

  fromNode: any;
  toNode: any;
  fromPort: any;
  toPort: any;

  fromPlug: any;
  toPlug: any;

  model: Connection;
  curve: any;
  /**
   * The painted path as corner points, when square routing is on (SIG-007).
   *
   * ⚠️ **Undefined is the signal for "curved", and curved means unbendable.**
   * Everything that follows the wire — `drawCurve`, `pointOnCurve`, the cull
   * box, the handles — branches on this one field, so there is a single place
   * that decides which mode a wire is in and no way for two of them to disagree.
   * A curved wire has no route, no handles and no drag targets: it is exactly
   * the wire this editor drew before SIG-007.
   */
  wirePoints: IVector2[] | undefined;
  /**
   * Where the pointer is on this wire, while it is the hovered one (SIG-007).
   *
   * Read by the cursor: a movable run says so by turning the pointer into a
   * resize arrow along the one axis it can travel, which is the whole
   * affordance — there is no other cue that a run is draggable.
   */
  hoverPos: IVector2 | undefined;
  color: any;
  lineWidth: number | undefined;

  fromProperty: string;
  toProperty: string;

  constructor(model: Connection, ctx) {
    this.model = model;

    // 🔴 **A model field must never land on top of a method of the same name,
    // and one did: it killed the whole canvas.**
    //
    // This loop copies the model's fields onto the view. `labelT` is both a
    // stored number (CAN-001, where the label sits) and a method (the same
    // value, clamped) — and an own property beats a prototype method, so the
    // moment a wire had its label moved, `this.labelT()` became
    // `TypeError: this.labelT is not a function`. It throws inside `paint`, so
    // the frame stops there and **every node after that wire vanishes**, which
    // reads as a rendering bug in whatever you were last working on rather than
    // as a wire whose label you dragged three sessions ago.
    //
    // ⚠️ Latent since CAN-001 shipped: it only fires once the view is rebuilt
    // from a model that already carries the key — switch component, or reopen
    // the project — so the drag that causes it and the breakage are far apart.
    //
    // Guarding the copy rather than renaming `labelT` fixes the shape of the
    // bug instead of this one instance of it: any future field that shares a
    // name with a method stays inert here.
    for (const i in model) {
      if (typeof this[i] === 'function') continue;
      this[i] = model[i];
    }

    this.ctx = ctx;
  }

  /**
   * DEF-039 (phase 80) — **returns `undefined` for a wire whose ends do not resolve, and the
   * caller skips it.** It used to throw one line into `connect()`.
   *
   * `findNodeWithId` answers `undefined` for an id that names no node in this component — a bad
   * merge, a partial copy, a generator that writes nodes and wires separately. `connect()` then
   * calls `resolvePorts()`, whose first act is `this.fromNode.model.getPort(…)`. 🔴 The cost was
   * never one wire: `ModelBindings` builds the canvas in a bare loop, so the throw stopped **every
   * later wire in the component** from being created.
   *
   * The model is untouched — the wire is still in the graph and still saved, so nothing is
   * destroyed by being undrawable, and `evaluateConnectionHealth` still records
   * `con-no-source-port` against it.
   */
  static createFromModel(model: Connection, owner: NodeGraphEditor, ctx?: CanvasRenderingContext2D) {
    const fromNode = owner.findNodeWithId(model.fromId);
    const toNode = owner.findNodeWithId(model.toId);

    if (!fromNode || !toNode) {
      const missing = [!fromNode && `source "${model.fromId}"`, !toNode && `target "${model.toId}"`]
        .filter(Boolean)
        .join(' and ');
      console.warn(
        `[canvas] connection ${model.fromProperty} → ${model.toProperty} skipped: ${missing} is not a node in this component.`
      );
      return undefined;
    }

    const con = new NodeGraphEditorConnection(model, ctx);

    con.fromNode = fromNode;
    con.toNode = toNode;
    con.owner = owner;
    con.connect(con);

    return con;
  }

  resolvePorts(args?) {
    this.fromPort = this.fromNode.model.getPort(this.fromProperty, 'output');
    this.toPort = this.toNode.model.getPort(this.toProperty, 'input');
  }

  connect(args) {
    this.fromNode = args.fromNode;
    this.toNode = args.toNode;
    this.fromProperty = args.fromProperty;
    this.toProperty = args.toProperty;

    this.resolvePorts();

    this.fromNode.connections.push(this);
    this.fromNode.sortConnections();

    this.toNode.connections.push(this);
    this.toNode.sortConnections();

    this.owner.connections.push(this);
  }

  disconnect() {
    let idx = this.fromNode.connections.indexOf(this);
    if (idx !== -1) this.fromNode.connections.splice(idx, 1);

    idx = this.toNode.connections.indexOf(this);
    if (idx !== -1) this.toNode.connections.splice(idx, 1);

    idx = this.owner.connections.indexOf(this);
    if (idx !== -1) this.owner.connections.splice(idx, 1);

    this.fromNode = this.toNode = undefined;
    this.fromProperty = this.toProperty = undefined;
  }

  getLocationRelativeTo(node) {
    const other = node === this.toNode ? this.fromNode : this.toNode;

    if (node.global.x < other.global.x - NodeGraphEditorNode.size.width * 1.1) {
      return 'left';
    } else if (other.global.x < node.global.x - NodeGraphEditorNode.size.width * 1.1) {
      return 'right';
    } else {
      return 'inline';
    }
  }

  getPropertyFor(node) {
    return node === this.fromNode ? this.fromProperty : this.toProperty;
  }

  getPortDisplayNameFor(node) {
    return node === this.fromNode ? getPortName(this.fromPort) : getPortName(this.toPort);
  }

  getPortIndexFor(node) {
    return node === this.fromNode ? getPortIndex(this.fromPort) : getPortIndex(this.toPort);
  }

  getPortGroupNameFor(node) {
    return node === this.fromNode
      ? this.fromPort
        ? this.fromPort.group
        : undefined
      : this.toPort
      ? this.toPort.group
      : undefined;
  }

  getDirectionFor(node) {
    return node === this.fromNode ? 'from' : 'to';
  }

  setPlugFor(node, plug) {
    if (node === this.fromNode) this.fromPlug = plug;
    else this.toPlug = plug;
  }

  isHighlighted() {
    return (
      (this.owner && this.owner.highlightedConnection === this) ||
      this.owner.isHighlighted(this.fromNode) ||
      this.owner.isHighlighted(this.toNode) ||
      this.owner.selector.isActive(this.fromNode) ||
      this.owner.selector.isActive(this.toNode)
    );
  }

  /**
   * Is this point on the wire? (CAN-003 — the stroke test the hover path has
   * always used, given a name so right-click and the editor can ask too.)
   *
   * `isPointInStroke` reads `ctx.lineWidth`, so the test widens the stroke to
   * the 10px hit width and then puts it back — the old inline version left the
   * context at 10 and everything painted after it inherited that.
   */
  hitTest(pos: IVector2): boolean {
    if (!this.ctx || !this.curve) return false;

    const previousLineWidth = this.ctx.lineWidth;
    this.ctx.lineWidth = NodeGraphEditorConnection.hitStrokeWidth;
    this.drawCurve();
    const hit = this.ctx.isPointInStroke(pos.x, pos.y);
    this.ctx.lineWidth = previousLineWidth;

    return hit;
  }

  /**
   * Which endpoint handle is under this point, if any (CAN-003).
   *
   * Tested against the curve's own ends, which `paint()` computed this frame,
   * and with a hit radius comfortably larger than the painted dot — the handle
   * has to be grabbable while sitting on a node's edge.
   */
  endpointAt(pos: IVector2): 'from' | 'to' | undefined {
    if (!this.curve) return undefined;

    const r = NodeGraphEditorConnection.endpointHitRadius;
    const within = (p: IVector2) => (p.x - pos.x) * (p.x - pos.x) + (p.y - pos.y) * (p.y - pos.y) <= r * r;

    if (within(this.curve[0])) return 'from';
    if (within(this.curve[3])) return 'to';
    return undefined;
  }

  isSelected() {
    return this.owner?.selectedConnection === this;
  }

  mouse(type, pos: IVector2, evt) {
    if (evt.button !== 0) return; //only interact with left mouse button

    if (type === 'move') {
      if (this.ctx) {
        // FH-016: the chip is asked about FIRST, and independently of the wire
        // stroke. CAN-001's own spec called this ordering out and it was not
        // honoured: the hover was decided by `hitTest` alone (±5 units of the
        // stroke), so the grabbable part of a chip was the *intersection* of
        // chip and stroke. Stepping onto the wide end of a two- or three-line
        // chip on a sloped wire left the stroke band, cleared the highlight,
        // and made the chip vanish out from under the cursor.
        if (this.isPointInLabel(pos) || this.hitTest(pos)) {
          evt.consumed = true;
          // SIG-007: the ghost anchor rides this. Kept on the connection rather
          // than read back off the editor, because the ghost has to be drawn in
          // *this* wire's graph coordinates and only this wire knows its path.
          this.hoverPos = pos;
          this.owner.setHighlightedConnection(this, pos);

          // annotations takes priority over health
          if (this.model.annotation) {
            PopupLayer.instance.showTooltip({
              x: evt.pageX,
              y: evt.pageY,
              position: 'bottom',
              content: this.model.annotation
            });
          } else {
            const health = this.getHealth();
            if (!health.healthy) {
              PopupLayer.instance.showTooltip({
                x: evt.pageX,
                y: evt.pageY,
                position: 'bottom',
                content: health.message
              });
            } else if (this.model.label) {
              // The chip stops at three lines; hovering is where the rest of a
              // long label lives (CAN-002).
              PopupLayer.instance.showTooltip({
                x: evt.pageX,
                y: evt.pageY,
                position: 'bottom',
                content: this.model.label
              });
            }
          }
          this.owner.repaint();
        } else if (this.owner.highlightedConnection === this) {
          this.hoverPos = undefined;
          this.owner.setHighlightedConnection(undefined);
          PopupLayer.instance.hideTooltip();
          this.owner.repaint();
        }
      }
    } else if (type === 'down') {
      // FH-016: a press on a *painted* chip belongs to this wire however the
      // chip became visible — an author's label, a `connectionLabel` port type,
      // the always-on setting, or either end's node being hovered or selected.
      // CAN-001 put the chip test inside the `highlightedConnection` gate, and
      // only the stroke hover ever sets that, so every one of those chips was
      // visible and completely inert.
      const onLabel = this.isPointInLabel(pos);
      if (!onLabel && this.owner.highlightedConnection !== this) return;

      evt.consumed = true;

      if (this.owner.readOnly === true) return;

      // Double-click writes a label (CAN-002). It is available at all because
      // CAN-003 retired the arm-then-confirm delete, whose second click this
      // used to be.
      if (this.owner.interaction.leftButtonIsDoubleClicked) {
        PopupLayer.instance.hideTooltip();
        this.owner.wireLabelEditor.open(this);
        return;
      }

      // Grabbing an end detaches it (CAN-003). Tested before anything else on
      // the wire, so a grab can never select instead.
      //
      // ⚠️ **Still first, and still 8px** (SIG-007 R1). The reported anchor
      // gesture — *"clicking near one end and dragging"* — is this gesture, and
      // the one that has been in the editor longer wins the overlap. What
      // SIG-007 adds is that the boundary is now *painted*: the ghost ring
      // tracks the pointer along the wire and stops appearing here.
      const end = this.endpointAt(pos);
      if (end) {
        PopupLayer.instance.hideTooltip();
        this.owner.interaction.startReroutingConnection(this, end);
        return;
      }

      // Grabbing the label chip moves it along the wire (CAN-001). Before the
      // anchors, because a chip is a thing you can see and aim at, and it sits
      // on the wire body where a mint would otherwise happen.
      if (onLabel) {
        PopupLayer.instance.hideTooltip();
        this.owner.interaction.startDraggingWireLabel(this);
        return;
      }

      // SIG-007 — square routing. A corner is asked about **before** the run it
      // sits on: near a corner you move the corner, along a run you move the
      // run. The other order makes every corner unreachable, since a corner is
      // by definition inside both of the runs it joins.
      //
      // ⚠️ **Neither gesture creates anything.** Grabbing a vertical run slides
      // it sideways; that is what the hand expects of a line that is already
      // straight, and an earlier build that minted a new corner there instead
      // broke the wire under the pointer. A new corner is an explicit
      // right-click — see `NodeContextMenu`.
      // ⚠️ The "+" is asked about first: it is the smallest target and it sits in
      // the middle of a run, so anything asked before it would swallow it.
      const add = this.addHandleAt(pos);
      if (add !== undefined) {
        PopupLayer.instance.hideTooltip();
        this.owner.interaction.startAddingWireCorner(this, add, pos);
        return;
      }

      const corner = this.cornerHandleAt(pos);
      if (corner !== undefined) {
        PopupLayer.instance.hideTooltip();
        this.owner.interaction.startDraggingWireCorner(this, corner);
        return;
      }

      const run = this.runHandleAt(pos);
      if (run !== undefined) {
        PopupLayer.instance.hideTooltip();
        this.owner.interaction.startDraggingWireRun(this, run);
      }
    } else if (type === 'up' && this.owner.highlightedConnection === this) {
      PopupLayer.instance.hideTooltip();
      evt.consumed = true;

      // A click selects the wire. It used to arm a delete that a second click
      // anywhere on the wire confirmed — a gesture nothing announced, that made
      // double-click unusable for anything else, and whose three replacements
      // (drag an end to empty canvas, right-click → Delete, select + Delete)
      // all live in this task.
      if (this.model && this.owner.readOnly !== true) {
        this.owner.selectConnection(this);
      }
    }
  }

  /**
   * The wire's painted path, as one path on the context.
   *
   * ⚠️ **One `beginPath` for every segment, which is what makes `hitTest` work
   * on a bent wire.** `isPointInStroke` tests the path last built, so a wire
   * stroked segment-by-segment would only ever hit-test its last segment —
   * SIG-007's build note asked for this to be verified rather than assumed, and
   * it is the reason the whole path is assembled before anyone strokes it.
   */
  drawCurve() {
    const c = this.curve;
    if (!c) return;
    const ctx = this.ctx;

    // SIG-007 square routing — the same path, drawn as runs and corners.
    // `arcTo` rounds each corner by the radius `cornerRadiusAt` clamped for it,
    // so a tight elbow tightens instead of the arc wandering off the route.
    const p = this.wirePoints;
    if (p && p.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      for (let i = 1; i < p.length - 1; i++) {
        const radius = cornerRadiusAt(p as Point[], i);
        if (radius > 0) ctx.arcTo(p[i].x, p[i].y, p[i + 1].x, p[i + 1].y, radius);
        else ctx.lineTo(p[i].x, p[i].y);
      }
      ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
      return;
    }

    ctx.beginPath();
    ctx.moveTo(c[0].x, c[0].y);
    ctx.bezierCurveTo(c[1].x, c[1].y, c[2].x, c[2].y, c[3].x, c[3].y);
  }

  midpoint(a: IVector2, b: IVector2) {
    return { x: a.x * 0.5 + b.x * 0.5, y: a.y * 0.5 + b.y * 0.5 };
  }

  _bezierInterpolation(t, a, b, c, d) {
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      a +
      (-a * 3 + t * (3 * a - a * t)) * t +
      (3 * b + t * (-6 * b + b * 3 * t)) * t +
      (c * 3 - c * 3 * t) * t2 +
      d * t3
    );
  }

  /**
   * A point on the painted path, `t` in `[0, 1]`.
   *
   * The label, the direction chevrons and the travelling mark all ride this, so
   * they follow a bent wire without any of them knowing anchors exist.
   */
  pointOnCurve(t) {
    const c = this.curve;
    if (!c) return;
    // ⚠️ By arc length in square mode. A square route's legs are wildly uneven —
    // a long run and a 4px jog are one vertex apart — so anything stepping by
    // vertex would crawl the long side and jump the short one.
    if (this.wirePoints && this.wirePoints.length >= 2) {
      return pointOnRoute(this.wirePoints as Point[], t);
    }
    return {
      x: this._bezierInterpolation(t, c[0].x, c[1].x, c[2].x, c[3].x),
      y: this._bezierInterpolation(t, c[0].y, c[1].y, c[2].y, c[3].y)
    };
  }

  /**
   * The last leg of the painted path, for orienting the target arrowhead.
   *
   * `arrivalDirection` reads `curve[3] - curve[2]`, so a square route hands it
   * the final run's two ends in those slots. Both modes therefore state arrival
   * from the line that actually arrives, rather than from the curve's idea of it.
   */
  arrivalSegment(): Point[] {
    const p = this.wirePoints;
    if (p && p.length >= 2) {
      const a = p[p.length - 2] as Point;
      const b = p[p.length - 1] as Point;
      return [a, a, a, b];
    }
    return this.curve as Point[];
  }

  /** The route this wire is drawn along, or the untouched one (SIG-007). */
  wireRoute(): WireRoute {
    return readRoute(this.model?.route) ?? defaultRoute(this.curve as Point[]);
  }

  /** Has anybody actually routed this wire, or is it still where it started? */
  hasCustomRoute(): boolean {
    return !!this.curve && !isDefaultRoute(this.curve as Point[], readRoute(this.model?.route));
  }

  /**
   * Which corner is under this point, if any (SIG-007).
   *
   * ⚠️ Only answers on a wire that is showing its handles — a target you cannot
   * see is the trap `endpointHitRadius` already is, kept for CAN-003's sake and
   * deliberately not repeated here.
   */
  cornerHandleAt(pos: IVector2): number | undefined {
    if (!this.showsRouteHandles() || !this.wirePoints) return undefined;
    return cornerAt(this.wirePoints as Point[], pos);
  }

  /**
   * Which movable **run** is under this point, if any (SIG-007).
   *
   * ⚠️ Asked *after* `cornerHandleAt`, always. Near a corner you are moving the
   * corner; along a run you are moving the run. Asking the other way round makes
   * every corner unreachable, because a corner is by definition the end of two
   * runs and always inside one of them.
   */
  runHandleAt(pos: IVector2): number | undefined {
    if (!this.showsRouteHandles() || !this.wirePoints) return undefined;
    return runAt(this.wirePoints as Point[], this.wireRoute(), pos);
  }

  /**
   * Which run's "+" is under this point (SIG-007).
   *
   * ⚠️ Asked **before** the corner and the run, because it is the smallest and
   * most deliberate target of the three and it sits in the middle of a run — if
   * the run answered first, the "+" could never be clicked.
   */
  addHandleAt(pos: IVector2): number | undefined {
    if (!this.showsRouteHandles() || !this.wirePoints) return undefined;
    return addMarkAt(this.wirePoints as Point[], this.wireRoute(), pos);
  }

  /** The axis a run may travel along — what the cursor is telling you. */
  runAxisAt(pos: IVector2): 'x' | 'y' | undefined {
    const run = this.runHandleAt(pos);
    if (run === undefined) return undefined;
    return runCoordinate(this.wireRoute(), run)?.axis;
  }

  /**
   * Are this wire's route handles live right now?
   *
   * ⚠️ **Square mode only.** A curved wire has no route to move — that is the
   * whole shape of the decision: curves are a look, square is the mode you route
   * in. And within square mode it is still hover-or-selection, on the argument
   * that kept endpoints as 3px dots: handles on every wire would be a hundred
   * new hit targets competing with the node cards on a dense graph.
   */
  showsRouteHandles(): boolean {
    return !this.rerouting && !!this.wirePoints && (this.owner?.highlightedConnection === this || this.isSelected());
  }

  _findClosestPointOnCurve(p, t0, t1) {
    const thres = 0.05;
    const _t0 = t0 + (t1 - t0) * 0.25;
    const p0 = this.pointOnCurve(_t0);
    const pd0 = (p0.x - p.x) * (p0.x - p.x) + (p0.y - p.y) * (p0.y - p.y);

    const _t1 = t0 + (t1 - t0) * 0.75;
    const p1 = this.pointOnCurve(_t1);
    const pd1 = (p1.x - p.x) * (p1.x - p.x) + (p1.y - p.y) * (p1.y - p.y);

    if (Math.abs(t0 - t1) < thres) return t0 * 0.5 + t1 * 0.5;

    if (pd0 < pd1) return this._findClosestPointOnCurve(p, t0, t0 + (t1 - t0) * 0.5);
    else return this._findClosestPointOnCurve(p, t0 + (t1 - t0) * 0.5, t1);
  }

  findClosestPointOnCurve(p) {
    return this._findClosestPointOnCurve(p, 0, 1);
  }

  getHealth() {
    if (!this.owner) {
      return {
        healthy: true,
        message: undefined
      };
    }

    return this.owner.model.getConnectionHealth({
      sourceNode: this.fromNode ? this.fromNode.model : undefined,
      sourcePort: this.fromProperty,
      targetNode: this.toNode ? this.toNode.model : undefined,
      targetPort: this.toProperty
    });
  }

  isHealthy() {
    return this.getHealth().healthy;
  }

  /** The text on this wire: what the author wrote, else the source port's name. */
  labelText(): string | undefined {
    return this.model.label || getPortName(this.fromPort) || this.fromProperty;
  }

  /**
   * Should this wire show its label right now? (CAN-001.)
   *
   * WFA-004 gated the label on the source port type's `connectionLabel` flag,
   * which only two workflow port types set — a conservative default, not a
   * technical boundary. It is a policy now, in this order:
   *
   *   1. an author wrote it → always, it is the only text the graph does not
   *      already contain (CAN-002);
   *   2. the port type asks for it → always, preserving WFA-004 exactly;
   *   3. the always-on setting is on → yes;
   *   4. the wire is highlighted → yes. Note `isHighlighted` is true when
   *      *either endpoint node* is hovered or selected, so hovering a node
   *      names every wire attached to it.
   *
   * Hover is the default rather than always-on because on a browser graph a
   * connected port already prints its name on the card at BOTH ends of every
   * wire — an always-on chip is a third copy, on graphs that routinely carry
   * 50–100 wires at a fixed 150px card width.
   */
  shouldShowPortLabel(): boolean {
    if (this.model.label) return true;

    const portType = this.fromPort?.type;
    if (portType && typeof portType === 'object' && portType.connectionLabel) return true;

    if (EditorSettings.instance.get(ALWAYS_SHOW_WIRE_LABELS)) return true;

    return this.isHighlighted();
  }

  /**
   * Should this wire state its direction along its length right now? (SIG-006 R3.)
   *
   * Unlike `shouldShowPortLabel` there is no hover clause: hovering already runs
   * a travelling mark from source to target, which is a better answer to the
   * same question than a row of static chevrons would be. This is only ever the
   * always-on setting — the chevrons exist for reading a graph you are *not*
   * pointing at.
   */
  /**
   * Should this wire be drawn as right angles rather than a curve? (SIG-007.)
   *
   * Off by default — unlike the direction chevrons, this changes the appearance
   * of every wire in every existing project, so an unset key means the editor
   * looks the way it always has.
   */
  usesSquareRouting(): boolean {
    return EditorSettings.instance.get(SQUARE_WIRE_ROUTING) === true;
  }

  paintsDirectionChevrons(): boolean {
    // ⚠️ `!== false`, not truthiness: this setting is **on by default**, and an
    // unset key must mean on rather than off.
    return EditorSettings.instance.get(ALWAYS_SHOW_WIRE_DIRECTION) !== false;
  }

  /** Where the label sits on the curve, clamped clear of both node cards. */
  labelT(): number {
    const t = typeof this.model.labelT === 'number' ? this.model.labelT : WireLabel.defaultT;
    return Math.min(WireLabel.maxT, Math.max(WireLabel.minT, t));
  }

  paintPortLabel(ctx: CanvasRenderingContext2D, strokeColor: string) {
    this.labelBounds = undefined;

    if (!this.shouldShowPortLabel()) return;

    const label = this.labelText();
    if (!label) return;

    // A point ON the curve, not the midpoint of two control points — the label
    // is draggable now, and a position the user picked has to land where they
    // put it. (This is why WFA-004's workflow captures shift by a pixel or two.)
    const a = this.pointOnCurve(this.labelT());
    if (!a) return;

    ctx.save();
    // Set before measuring: textWordWrap measures with whatever font the
    // previous paint left on the context.
    ctx.font = CanvasFonts.portLabel;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // An author's text wraps and is capped at three lines; a port name is one
    // short word and comes out of the same code as a single line.
    const lines = wrapLabelLines(ctx, label);
    const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
    const width = Math.min(textWidth, WireLabel.maxWidth) + WireLabel.paddingX * 2;
    const height = WireLabel.lineHeight * lines.length;

    // A chip behind the text: a bare glyph over a dot-grid at low zoom is
    // unreadable, and the wire itself runs under it.
    ctx.fillStyle = CanvasTheme.instance.colors.cardBg;
    ctx.globalAlpha = WireLabel.chipAlpha;
    ctx.fillRect(a.x - width / 2, a.y - height / 2, width, height);
    ctx.globalAlpha = 1;

    ctx.fillStyle = strokeColor;
    lines.forEach((line, index) => {
      ctx.fillText(line, a.x, a.y - height / 2 + WireLabel.lineHeight * (index + 0.5));
    });
    ctx.restore();

    // Cached for hit-testing the drag. Graph coordinates, this frame only.
    this.labelBounds = { x: a.x - width / 2, y: a.y - height / 2, width, height };
  }

  /**
   * The travelling mark, and its arrival — the one implementation, called by
   * both the runtime signal pulse and the hover direction mark.
   *
   * `ageMs` is time since the mark began: since the runtime reported the pulse,
   * or since the pointer entered the wire (folded into one cycle by
   * `loopedAge`). `baseWidth` is the wire's own stroke width, which the mark
   * exceeds — SIG-005 established that the mark's meaning is carried in weight,
   * because a luminance step against a bright wire cannot be won in dark.
   *
   * ## Why it is drawn in segments rather than as one stroke
   *
   * One stroke is one width and one alpha, and that is what made this a uniform
   * white bar sliding along the wire. The mark is now **tapered and faded from
   * tail to head** (`beadTaper`) and drawn as a dim halo under a bright core,
   * which is what reads as a charge moving down a wire rather than a rectangle.
   * `shadowBlur` is the other way to get a glow and costs far more on a graph
   * that may be pulsing dozens of wires at once.
   *
   * ⚠️ Each segment sets its own `globalAlpha`, so the caller's alpha — the
   * runtime pulse's fade-out — is read first and multiplied through rather than
   * clobbered.
   *
   * ## The arrival
   *
   * The head used to clamp at the target with the tail held behind it, parking a
   * full-length bar on the end of the wire for the rest of its life and then
   * blinking out. Now `beadRange` runs the tail in after it, so the mark is
   * consumed by the target, and `arrivalGlow` lights `arrowhead` as it lands.
   * ⚠️ **The lit arrowhead is the payoff, not decoration** — the mark spends its
   * whole life saying "this way" and only that instant says "*here*".
   */
  paintTravellingMark(
    ctx: CanvasRenderingContext2D,
    ageMs: number,
    baseWidth: number,
    arrowhead: { x: number; y: number }[] | undefined
  ) {
    const outerAlpha = ctx.globalAlpha;
    const headWidth = baseWidth + WIRE_PULSE.signalWeightBoost;
    const { from, to } = beadRange(ageMs);

    if (to - from > 1e-4) {
      const points = samplePolyline((u) => this.pointOnCurve(u), from, to, WIRE_PULSE.beadSegments);
      if (points.length > 1) {
        const previousCap = ctx.lineCap;
        const previousJoin = ctx.lineJoin;
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Halo first, whole length, then the core over it — interleaving them
        // would let one segment's halo wash over the previous segment's core.
        for (const halo of [true, false]) {
          for (let i = 1; i < points.length; i++) {
            const { alpha, widthScale } = beadTaper(i / (points.length - 1));
            ctx.globalAlpha = outerAlpha * alpha * (halo ? WIRE_PULSE.beadHaloAlpha : 1);
            ctx.lineWidth = headWidth * widthScale * (halo ? WIRE_PULSE.beadHaloScale : 1);
            ctx.beginPath();
            ctx.moveTo(points[i - 1].x, points[i - 1].y);
            ctx.lineTo(points[i].x, points[i].y);
            ctx.stroke();
          }
        }

        ctx.lineCap = previousCap;
        ctx.lineJoin = previousJoin;
      }
    }

    const glow = arrivalGlow(ageMs);
    if (glow > 0 && arrowhead && arrowhead.length) {
      const previousFill = ctx.fillStyle;
      ctx.globalAlpha = outerAlpha * glow;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(arrowhead[0].x, arrowhead[0].y);
      for (let i = 1; i < arrowhead.length; i++) ctx.lineTo(arrowhead[i].x, arrowhead[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = previousFill;
    }

    ctx.globalAlpha = outerAlpha;
    ctx.lineWidth = baseWidth;
  }

  /**
   * The corner handles of a square route (SIG-007).
   *
   * ## The handle is the corner
   *
   * 🔴 **This replaced a ring on a curve, and the shape change is the point.**
   * On a curve an anchor is somewhere the spline is smoothed *towards*, so a
   * ring — a mark meaning "here, roughly" — was honest. On a square route the
   * corner is exactly where you put it, and the handle and the corner are the
   * same object. A square says that. It also settles the objection that first
   * ruled a square out (rotate it and it is the `'both'` diamond): the diamond
   * lives on a node plug and never on a wire body, and here the square is
   * aligned to the two runs it joins rather than floating on a curve.
   *
   * ⚠️ There is no ghost-handle preview any more, because there is no
   * mint-by-dragging: dragging a run **moves** it, and a new corner is an
   * explicit right-click. What tells you a run is draggable is the cursor.
   *
   * ⚠️ Painted in the wire's own colour, not a new one. Wire colour already
   * carries four meanings and this painter refused to make selection a fifth.
   */
  paintRouteHandles(ctx: CanvasRenderingContext2D, strokeColor: string, glyphScale: number, wireType: string) {
    if (!this.showsRouteHandles()) return;

    const points = this.wirePoints;
    if (!points || points.length < 3) return;

    const radius = WIRE_ROUTE.handleRadius * glyphScale;
    const previousWidth = ctx.lineWidth;
    ctx.setLineDash([]);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = WIRE_ROUTE.handleLineWidth * glyphScale;

    // Every interior vertex is a corner, and every corner is a handle. There is
    // no separate "anchor" object to paint: a corner **is** the anchor, which is
    // what makes dragging one feel like moving the wire rather than moving a
    // marker attached to it.
    for (let i = 1; i < points.length - 1; i++) {
      ctx.beginPath();
      ctx.rect(points[i].x - radius, points[i].y - radius, radius * 2, radius * 2);
      ctx.stroke();
    }

    // 🔴 **The "+" is the answer to "there's no way to add an anchor that I can
    // see".** Adding was only ever on the right-click menu, which is a fine
    // place for it and a hopeless way to find it. One mark per run long enough
    // to hold it, at the run's midpoint, fainter than a corner because a corner
    // is a thing that exists and this is an offer.
    const previousAlpha = ctx.globalAlpha;
    const plus = WIRE_ROUTE.addMarkRadius * glyphScale;
    ctx.globalAlpha = previousAlpha * WIRE_ROUTE.addMarkAlpha;
    for (const mark of addMarks(points as Point[], this.wireRoute())) {
      ctx.beginPath();
      ctx.moveTo(mark.point.x - plus, mark.point.y);
      ctx.lineTo(mark.point.x + plus, mark.point.y);
      ctx.moveTo(mark.point.x, mark.point.y - plus);
      ctx.lineTo(mark.point.x, mark.point.y + plus);
      ctx.stroke();
    }

    ctx.globalAlpha = previousAlpha;
    ctx.lineWidth = previousWidth;
    this.restoreWireDash(ctx, wireType);
  }

  /**
   * Put back the dash pattern this wire is entitled to, after a mark that had to
   * be drawn solid.
   *
   * ⚠️ Three separate meanings live on `setLineDash` — an unhealthy wire, a
   * `Deleted` diff annotation and a workflow error edge — and every solid mark
   * painted over a wire has to restore whichever applies. The chevrons already
   * had this inline; the anchor rings would have been the second copy.
   */
  restoreWireDash(ctx: CanvasRenderingContext2D, wireType: string) {
    if (!this.getHealth().healthy) ctx.setLineDash([5]);
    else if (this.model.annotation === 'Deleted') ctx.setLineDash([6, 4]);
    else if (wireType === WIRE_TYPE_ERROR) ctx.setLineDash([7, 4]);
  }

  /** Is this point on the label chip? Only meaningful when one was painted. */
  isPointInLabel(pos: IVector2): boolean {
    const b = this.labelBounds;
    if (!b) return false;

    return pos.x >= b.x && pos.x <= b.x + b.width && pos.y >= b.y && pos.y <= b.y + b.height;
  }

  paint(ctx, paintRect) {
    this.ctx = ctx;

    if (!this.fromPlug || !this.toPlug) return;

    const from = this.fromNode.global;
    const to = this.toNode.global;

    // This is a connection between two plugs, figure out the placement
    // of the connection
    const fy =
      from.y +
      this.fromNode.titlebarHeight() +
      this.fromPlug.index * NodeGraphEditorNode.propertyConnectionHeight +
      NodeGraphEditorNode.propertyConnectionHeight / 2 +
      NodeGraphEditorNode.verticalSpacing;
    const ty =
      to.y +
      this.toNode.titlebarHeight() +
      this.toPlug.index * NodeGraphEditorNode.propertyConnectionHeight +
      NodeGraphEditorNode.propertyConnectionHeight / 2 +
      NodeGraphEditorNode.verticalSpacing;

    const loc = this.getLocationRelativeTo(this.fromNode);
    if (loc === 'left') {
      var mid = to.x * 0.5 + (from.x + NodeGraphEditorNode.size.width) * 0.5;

      this.curve = [
        { x: from.x + this.fromNode.nodeSize.width, y: fy },
        { x: mid, y: fy },
        { x: mid, y: ty },
        { x: to.x, y: ty }
      ];
    } else if (loc === 'right') {
      var mid = (to.x + NodeGraphEditorNode.size.width) * 0.5 + from.x * 0.5;

      this.curve = [
        { x: from.x, y: fy },
        { x: mid, y: fy },
        { x: mid, y: ty },
        { x: to.x + this.toNode.nodeSize.width, y: ty }
      ];
    } else {
      const dx = Math.min(from.x, to.x) - (50 + Math.abs(to.y - from.y) * 0.2);

      this.curve = [
        { x: from.x, y: fy },
        { x: dx, y: fy },
        { x: dx, y: ty },
        { x: to.x, y: ty }
      ];
    }

    // One end is being dragged: rebuild the curve as an elbow between the end
    // that is still pinned and the cursor (CAN-003). Done after the normal
    // curve so the pinned end keeps its port anchor exactly.
    if (this.rerouting) {
      const pinned = this.rerouting.end === 'to' ? this.curve[0] : this.curve[3];
      const loose = this.rerouting.pos;
      const mid = (pinned.x + loose.x) * 0.5;

      this.curve =
        this.rerouting.end === 'to'
          ? [pinned, { x: mid, y: pinned.y }, { x: mid, y: loose.y }, loose]
          : [loose, { x: mid, y: loose.y }, { x: mid, y: pinned.y }, pinned];
    }

    // SIG-007 — the painted path, which is the wire's curve unless the builder
    // bent it. ⚠️ Not while an end is being re-targeted: during a CAN-003 drag
    // the wire is a temporary elbow to the cursor, and its chord frame is
    // meaningless, so anchors sit the drag out and come back on drop.
    // SIG-007 — the square route, when square routing is on. ⚠️ Not while an
    // end is being re-targeted: a CAN-003 drag builds a temporary elbow to the
    // cursor, and squaring that fights the gesture.
    this.wirePoints =
      this.usesSquareRouting() && !this.rerouting
        ? (routePoints(this.curve as Point[], this.wireRoute()) as IVector2[])
        : undefined;

    // ⚠️ Over every segment's control points, not just the wire's own four. An
    // anchor can carry the path well outside the box its endpoints describe, and
    // culling on that box would make a bent wire vanish while part of it is
    // still on screen.
    function aabbIntersectTest(segments: IVector2[][], paintArea) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (const s of segments) {
        for (const p of s) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
      }

      return !(minX > paintArea.maxX || maxX < paintArea.minX || minY > paintArea.maxY || maxY < paintArea.minY);
    }

    // The square route's corners sit on the same control points the curve's box
    // was built from, so one test covers both — but pass the actual painted
    // points when there are anchors, because those leave the box entirely.
    if (aabbIntersectTest(this.wirePoints ? [this.wirePoints] : [this.curve], paintRect) === false) {
      return;
    }

    if (!this.getHealth().healthy) {
      ctx.setLineDash([5]);
    }

    const hoverConnection = this.isHighlighted();
    const type = NodeLibrary.nameForPortType(this.fromPort ? this.fromPort.type : undefined);

    // WFA-004: an error edge is dashed as well as red. Colour alone would not
    // survive a greyscale screenshot or a colourblind reader, and this is the
    // one edge whose meaning must be unmistakable. Keyed on the source port's
    // TYPE, like every other wire treatment here — the canvas does not know
    // what a workflow is.
    if (type === WIRE_TYPE_ERROR) {
      ctx.setLineDash([7, 4]);
    }
    // UIX-005: wire colours come from CanvasTheme (signal = cyan pair,
    // everything else = data/emerald pair) instead of the library blob.
    const connectionColors = CanvasTheme.instance.connectionColors(type);

    const color = hoverConnection ? connectionColors.highlighted : connectionColors.normal;
    let strokeColor: string = this.color ? this.color : color;

    const theme = CanvasTheme.instance.colors;
    if (this.model.annotation) {
      if (this.model.annotation === 'Deleted') strokeColor = theme.annotationDeleted;
      else if (this.model.annotation === 'Changed') strokeColor = theme.annotationChanged;
      else if (this.model.annotation === 'Created') strokeColor = theme.annotationCreated;

      // Shape as well as colour (AIX-003): removed routing is dashed; the
      // dash restore below already runs for all paths.
      if (this.model.annotation === 'Deleted') ctx.setLineDash([6, 4]);
    }
    ctx.strokeStyle = strokeColor;

    const lineWidth = 1.5;
    ctx.lineWidth = this.lineWidth ? this.lineWidth : lineWidth;
    // Added routing is thicker (shape cue, AIX-003).
    if (this.model.annotation === 'Created') ctx.lineWidth = 3;
    // Selected (CAN-003): a heavier stroke, not a colour. Wire colour already
    // carries type, health, debug pulse and diff annotation — selection would
    // be the fifth meaning on one channel.
    if (this.isSelected()) ctx.lineWidth = Math.max(ctx.lineWidth, 3);

    this.drawCurve();
    ctx.stroke();

    // SIG-006: circle at the source, arrowhead at the target.
    //
    // Both ends used to be the same 3px dot ("mock: 3px wire-coloured dots at
    // both ends"), so a finished wire stated no direction at all — while the
    // *drag* line, one interaction earlier, drew a circle at the source and a
    // real arrowhead at the target and then threw that away on commit. This is
    // the same vocabulary, kept.
    //
    // ⚠️ The glyphs hold their **screen** size as the graph zooms out
    // (`glyphScaleFor`); everything else here is in graph units. A 3px dot at
    // 50% zoom is 1.5 screen px, which is why no choice of shape could have met
    // this task's zoom acceptance while the glyphs scaled with the content.
    //
    // On a highlighted wire they grow into the grab handles CAN-003 adds; they
    // stay small otherwise, because handles on every wire would be a hundred new
    // hit targets competing with the node cards on a dense graph. ⚠️ The
    // arrowhead is *paint*: `endpointHitRadius` (8) is untouched, so what
    // CAN-003 grabs is exactly what it grabbed before.
    const scale = this.owner?.getPanAndScale?.().scale ?? 1;
    const glyphScale = glyphScaleFor(scale);
    const sourceRadius =
      (hoverConnection ? WIRE_ENDPOINT.sourceHandleRadius : WIRE_ENDPOINT.sourceRadius) * glyphScale;
    ctx.fillStyle = strokeColor;
    ctx.beginPath();
    ctx.arc(this.curve[0].x, this.curve[0].y, sourceRadius, 0, 2 * Math.PI, false);
    ctx.fill();

    // ⚠️ `arrivalDirection` reads the **last segment**, not the wire's own
    // control points. On a bent wire those are the same array; on one whose last
    // anchor sits above the target, they are not, and an arrowhead pointing the
    // way the curve used to arrive would be the one glyph on the canvas telling
    // a lie about the line it is attached to. Its own docstring anticipated this
    // task by name.
    const head = arrowheadPolygon(
      this.curve[3],
      arrivalDirection(this.arrivalSegment()),
      (hoverConnection ? WIRE_ENDPOINT.arrowLengthHighlighted : WIRE_ENDPOINT.arrowLength) * glyphScale,
      (hoverConnection ? WIRE_ENDPOINT.arrowHalfWidthHighlighted : WIRE_ENDPOINT.arrowHalfWidth) * glyphScale
    );
    ctx.beginPath();
    ctx.moveTo(head[0].x, head[0].y);
    for (let i = 1; i < head.length; i++) ctx.lineTo(head[i].x, head[i].y);
    ctx.closePath();
    ctx.fill();

    // SIG-006 R3 — the direction stated along the wire's length, off by default.
    //
    // The endpoint glyphs above answer "which way" wherever an end is on screen.
    // On the graph this was measured against, 40 of the 54 wires in the median
    // viewport had **both** ends off screen — so on a real project that is the
    // common case, not an edge one, and hover (below) answers it one wire at a
    // time. This answers it for every wire at once, for the builder who wants
    // that and has priced the density: see `DIRECTION_CHEVRON` for the sweep and
    // for why a single mid-wire mark would have been a plausible lie (18%).
    if (this.paintsDirectionChevrons()) {
      // ⚠️ Spacing and clearance are **screen** distances converted into graph
      // units, so the marks-per-screen figure the setting was priced on holds at
      // every zoom. The glyphs themselves use `glyphScale`, which is floored;
      // the spacing deliberately is not — see `DIRECTION_CHEVRON.spacing`.
      const perScreenPx = scale > 0 ? 1 / scale : 1;
      const marks = chevronPlacements(
        samplePolyline((u) => this.pointOnCurve(u), 0, 1, DIRECTION_CHEVRON.samples),
        DIRECTION_CHEVRON.spacing * perScreenPx,
        DIRECTION_CHEVRON.endClearance * perScreenPx
      );

      if (marks.length) {
        const previousCap = ctx.lineCap;
        const previousJoin = ctx.lineJoin;
        const previousWidth = ctx.lineWidth;
        // Stroked and open, against the filled endpoint arrowhead — a mid-wire
        // mark that read as an endpoint would say the wire stops there.
        ctx.setLineDash([]);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = previousWidth * glyphScale;
        ctx.beginPath();
        for (const mark of marks) {
          const v = chevronPolyline(
            mark.point,
            mark.direction,
            DIRECTION_CHEVRON.length * glyphScale,
            DIRECTION_CHEVRON.halfWidth * glyphScale
          );
          ctx.moveTo(v[0].x, v[0].y);
          for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
        }
        ctx.stroke();
        ctx.lineCap = previousCap;
        ctx.lineJoin = previousJoin;
        ctx.lineWidth = previousWidth;
        // The health/annotation dash is restored at the end of paint, with the
        // one the pulse branches also rely on.
        this.restoreWireDash(ctx, type);
      }
    }

    // SIG-007 — the anchor handles, and the ghost that shows where they begin.
    this.paintRouteHandles(ctx, strokeColor, glyphScale, type);

    if (DebugInspector.instance.isEnabled() && DebugInspector.instance.isConnectionPulsing(this)) {
      const t = DebugInspector.instance.getPulseAnimationState(this);
      // SIG-005. This was a `[5, 15]` dash at `globalAlpha = opacity * 0.7`,
      // which measured **1.48:1** against the signal wire it sat on and 1.43:1
      // against a value wire, in the default dark theme, on composited canvas
      // pixels. It fired correctly and nobody had ever mentioned seeing it. The
      // mark now carries its meaning in weight and shape instead of in a
      // luminance step it cannot win in dark, and a signal no longer looks like
      // a value — see the header of `wirePulse.ts` for the measurements and for
      // why colour is not on the table here.
      const kind = wirePulseKind(type);
      const ageMs = typeof t.created === 'number' ? performance.now() - t.created : 0;

      ctx.strokeStyle = theme.wirePulse;
      ctx.globalAlpha = Math.max(0, Math.min(1, t.opacity));

      const wireWidth = ctx.lineWidth;
      if (kind === 'signal') {
        // One bead, running source → target. `curve[0]` is the source end (the
        // endpoint dots above are painted from the same array), so sampling
        // forward in `t` travels the way the signal does.
        this.paintTravellingMark(ctx, ageMs, wireWidth, head);
      } else {
        // A value is live along the whole wire, so the overlay is too.
        ctx.setLineDash(WIRE_PULSE.valueDash as unknown as number[]);
        ctx.lineDashOffset = -valueDashOffset(ageMs);
        ctx.lineWidth = wireWidth + WIRE_PULSE.valueWeightBoost;
        this.drawCurve();
        ctx.stroke();
      }

      ctx.lineWidth = wireWidth;
      ctx.globalAlpha = 1;
    } else if (this.owner && this.owner.highlightedConnection === this) {
      // SIG-006 item 4 — the hover direction mark.
      //
      // The endpoint glyphs answer "which way" when you can see an end. On a
      // long wire crossing the viewport both ends are off screen, and this is
      // the answer that reaches: a bead running source → target, for as long as
      // the pointer stays on the wire.
      //
      // ⚠️ **`highlightedConnection === this`, not `isHighlighted()`.** The
      // latter is also true when either endpoint's *node* is hovered or
      // selected, which on a busy node is a dozen wires at once — the question
      // "which way does *this* wire go" is asked of one wire, the one under the
      // cursor.
      //
      // ⚠️ **The bead runs on a value wire too, and that is a decision.**
      // SIG-005 gave a signal one travelling bead and a value a repeating dash
      // *on purpose*, because at runtime the mark says *what happened* — and a
      // value connection is live everywhere at once, with no one place for a
      // moment to be. A hover asks a different question. Direction is the same
      // question for both kinds and has the same answer shape, so both get the
      // bead. The two never collide: this branch is `else` to the pulse, so a
      // wire that is genuinely carrying something keeps saying so.
      const ageMs = performance.now() - (this.owner.hoverMarkStartedAt ?? 0);
      ctx.strokeStyle = theme.wirePulse;
      this.paintTravellingMark(ctx, loopedAge(ageMs), ctx.lineWidth, head);
    }

    ctx.lineDashOffset = 0;
    ctx.setLineDash([]); // Restore line dash if it has been previously set

    this.paintPortLabel(ctx, strokeColor);
  }
}
