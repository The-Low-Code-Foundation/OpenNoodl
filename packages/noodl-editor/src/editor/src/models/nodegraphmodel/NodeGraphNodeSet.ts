import { NodeGraphNode } from '@noodl-models/nodegraphmodel';
import { guid } from '@noodl-utils/utils';

/**
 * A wire, as this model carries it: four endpoint fields that are its identity,
 * plus the presentation SIG-007 gave it.
 *
 * Declared for `clone()` rather than widened onto `connections` itself — those
 * fields are `TSFixme` in several other seams and retyping them here would move
 * the problem rather than solve it (PLAT-003 owns that). What it does buy is the
 * one place where getting the field list wrong is a silent data loss: R2 shipped
 * because `clone()` rebuilt a connection from four fields and nobody noticed the
 * other three.
 */
export interface GraphConnection {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
  /** CAN-002's wire label, and its position along the wire. */
  label?: string;
  labelT?: number;
  /** SIG-007's anchors, as run positions. Copied, never shared — see `clone()`. */
  route?: { xs: number[]; ys: number[] };
}

export interface NodeGraphNodeSetOptions {
  nodes: NodeGraphNode[];
  connections: TSFixme;
  comments?: TSFixme;
}

export class NodeGraphNodeSet {
  nodes: NodeGraphNode[];
  connections: TSFixme;
  comments: TSFixme;

  constructor(args: NodeGraphNodeSetOptions) {
    this.nodes = args.nodes;
    this.connections = args.connections;
    this.comments = args.comments || [];
  }

  static fromJSON(json) {
    const nodes = [];
    for (const i in json.nodes) nodes.push(NodeGraphNode.fromJSON(json.nodes[i]));

    return new NodeGraphNodeSet({ nodes: nodes, connections: json.connections, comments: json.comments });
  }

  clone() {
    // Clone all nodes
    const clones = [];
    for (var i in this.nodes) {
      clones.push(NodeGraphNode.fromJSON(this.nodes[i].toJSON()));
    }

    // Generate new IDs and remap
    const idMap = {};

    for (var i in clones) {
      clones[i].forEach(function (node) {
        idMap[node.id] = guid();
        node.id = idMap[node.id];
      });
    }

    // Clone all connections, and remap IDs
    //
    // 🔴 SIG-007 R2: this rebuilt each connection from **four fields**, so
    // copy/paste and component duplication have been dropping wire labels since
    // CAN-002 shipped one — a live defect nobody hit, found by tracing `labelT`
    // through every seam that had to learn about it and noticing this one never
    // did. Anchors would have gone the same way, in the same four lines.
    //
    // ⚠️ The route's arrays are copied, not shared: a pasted wire holding its
    // source's arrays would re-route the original the moment either was dragged.
    // Same shape as the `toJSON` metadata trap in LEG-001.
    const connections = [];
    for (var i in this.connections) {
      const c = this.connections[i];
      const clone: GraphConnection = {
        fromId: idMap[c.fromId],
        fromProperty: c.fromProperty,
        toId: idMap[c.toId],
        toProperty: c.toProperty
      };
      if (c.label !== undefined) clone.label = c.label;
      if (c.labelT !== undefined) clone.labelT = c.labelT;
      if (c.route) clone.route = { xs: (c.route.xs ?? []).slice(), ys: (c.route.ys ?? []).slice() };
      connections.push(clone);
    }

    //clone comments with new IDs
    const commentClones = JSON.parse(JSON.stringify(this.comments));
    for (const comment of commentClones) {
      comment.id = guid();
    }

    return new NodeGraphNodeSet({ nodes: clones, connections, comments: commentClones });
  }

  toJSON() {
    const json = {
      nodes: [],
      connections: this.connections,
      comments: this.comments
    };

    for (const i in this.nodes) {
      json.nodes.push(this.nodes[i].toJSON());
    }

    return json;
  }

  // Remove unnecessary stuff for clipboard
  strip() {
    function _strip(nodes) {
      for (const i in nodes) {
        delete nodes[i].dynamicports;

        _strip(nodes[i].children);
      }
    }

    _strip(this.nodes);
  }

  //Moves the entire graph so the position of the top left node is x,y
  setOriginPosition(newOrigin: { x: number; y: number }) {
    const origin = this.getOriginPosition();

    const nodesAndComments = this.nodes.concat(this.comments);

    for (const n of nodesAndComments) {
      n.x = Math.round(n.x - origin.x + newOrigin.x);
      n.y = Math.round(n.y - origin.y + newOrigin.y);
    }
  }

  //get position of top left node
  getOriginPosition(): { x: number; y: number } {
    let minX = Number.MAX_VALUE;
    let minY = Number.MAX_VALUE;

    const nodesAndComments = this.nodes.concat(this.comments);

    for (const n of nodesAndComments) {
      if (n.x < minX) {
        minX = n.x;
      }
      if (n.y < minY) {
        minY = n.y;
      }
    }

    return { x: minX, y: minY };
  }
}
