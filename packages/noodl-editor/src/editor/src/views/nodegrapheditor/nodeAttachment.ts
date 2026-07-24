import _ from 'underscore';

import { NodeGraphEditorNode } from './NodeGraphEditorNode';

export function nodeShouldAttach(root, mousePos, nodesToAttach) {
  const potentialAttachPoints = [];

  //Gather a list of potential positions to do the drop at
  //Start with the root and recurse down
  _nodeShouldAttachRecurse(mousePos, root, nodesToAttach, potentialAttachPoints);

  // window._debugNodeGraphAttachPoints = potentialAttachPoints;

  if (potentialAttachPoints.length === 0) {
    return;
  }

  function distSquared(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  //find closest attach point
  let index = 0;
  let minDist = distSquared(mousePos, potentialAttachPoints[0].anchorPoint);
  for (let i = 1; i < potentialAttachPoints.length; i++) {
    const d = distSquared(mousePos, potentialAttachPoints[i].anchorPoint);
    if (d < minDist) {
      minDist = d;
      index = i;
    }
  }

  return potentialAttachPoints[index].attachInfo;
}

//There are 4 different valid locations to drop a node in a hierarchy:
//1. Directly at the parent, node will be added as last child
//2. In the space directly above a node. Node will become a sibling
//3. In the space directly below a node. Node will become a sibling
//4. In the space directly below a node, but offset a bit to the right. Node will become first child
//5. In the space below a node subgraph, offset a bit to the right. Node will become last child
function _nodeShouldAttachRecurse(pos, node, nodesToAttach, result) {
  const hitPadding = 10;

  const { x, y } = node.global;

  const hierarchyHeight = node.measure().height;
  const { width, height } = node.nodeSize;

  const intersectX = pos.x >= x - hitPadding && pos.x <= x + width + hitPadding;
  const intersectY = pos.y >= y - hitPadding && pos.y <= y + height + hitPadding;

  const nodeCanAcceptChildNodes = canAcceptChildNodes(node, nodesToAttach);

  //1. Directly at the parent, node will be added as last child
  if (intersectX && intersectY && nodeCanAcceptChildNodes) {
    result.push(getAttachPointOnNode(node));
  }

  if (intersectX && node.parent && canAcceptChildNodes(node.parent, nodesToAttach)) {
    //2. In the space directly above a node. Node will become a sibling
    if (pos.y >= y - NodeGraphEditorNode.childSpacing + hitPadding && pos.y <= y + height / 2 + hitPadding) {
      result.push(getAttachPointAboveNode(node));
    }

    //3. In the space directly below a node. Node will become a sibling.
    //The hit areas are slightly different depending on if the node has children:
    // - No children: hit area starts at the middle of the node
    // - Children: hit area starts after last child
    const hasChildren = node.children.length > 0;
    if (
      hasChildren &&
      pos.y >= y + hierarchyHeight - hitPadding &&
      pos.y <= y + hierarchyHeight + NodeGraphEditorNode.childSpacing + hitPadding
    ) {
      result.push(getAttachPointBelowNode(node));
    } else if (
      !hasChildren &&
      pos.y >= y + height / 2 - hitPadding &&
      pos.y <= y + height + NodeGraphEditorNode.childSpacing + hitPadding
    ) {
      result.push(getAttachPointBelowNode(node));
    }
  }

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (pos.y >= child.global.y - hitPadding) {
      _nodeShouldAttachRecurse(pos, child, nodesToAttach, result);
    }
  }

  //4. In the space directly below a node, but offset a bit to the right. Node will become first child
  if (
    nodeCanAcceptChildNodes &&
    pos.x >= x - hitPadding &&
    pos.x <= x + node.nodeSize.width + NodeGraphEditorNode.childMargin + hitPadding &&
    pos.y >= y + node.nodeSize.height - hitPadding &&
    pos.y <= y + node.nodeSize.height + NodeGraphEditorNode.childSpacing + hitPadding
  ) {
    result.push(getAttachPointBelowRightNode(node));
  }

  //5. In the space below a node subgraph, offset a bit to the right. Node will become last child
  if (
    node.children.length &&
    nodeCanAcceptChildNodes &&
    pos.x >= x - hitPadding &&
    pos.x <= x + node.nodeSize.width + NodeGraphEditorNode.childMargin + hitPadding &&
    pos.y >= y + hierarchyHeight - hitPadding &&
    pos.y <= y + hierarchyHeight + NodeGraphEditorNode.childSpacing + hitPadding
  ) {
    result.push(getAttachPointBelowRightSubgraph(node));
  }
}

function canAcceptChildNodes(node, nodes) {
  return node.model.canAcceptChildren(_.pluck(nodes, 'model'));
}

function getAttachPointBelowRightNode(node) {
  const { x, y } = node.global;

  return {
    anchorPoint: {
      x: x + node.nodeSize.width / 2 + NodeGraphEditorNode.childMargin,
      y: y + node.nodeSize.height + NodeGraphEditorNode.childSpacing / 2
    },
    attachInfo: {
      parent: node,
      index: 0,
      pos: {
        x: x + NodeGraphEditorNode.childMargin,
        y: y + node.nodeSize.height
      }
    }
  };
}

function getAttachPointOnNode(node) {
  const { x, y } = node.global;

  const hierarchyHeight = node.measure().height;

  return {
    anchorPoint: {
      x: x + node.nodeSize.width / 2,
      y: y + node.nodeSize.height / 2
    },
    attachInfo: {
      parent: node,
      index: node.children.length,
      pos: {
        x: x + NodeGraphEditorNode.childMargin,
        y: y + hierarchyHeight
      }
    }
  };
}

function getAttachPointBelowRightSubgraph(node) {
  const { x, y } = node.global;

  const hierarchyHeight = node.measure().height;

  return {
    anchorPoint: {
      x: x + node.nodeSize.width / 2 + NodeGraphEditorNode.childMargin,
      y: y + hierarchyHeight + NodeGraphEditorNode.childSpacing / 2
    },
    attachInfo: {
      parent: node,
      index: node.children.length,
      pos: {
        x: x + NodeGraphEditorNode.childMargin,
        y: y + hierarchyHeight
      }
    }
  };
}

function getAttachPointAboveNode(node) {
  const { x, y } = node.global;

  const parent = node.parent;
  const index = parent.children.indexOf(node);

  return {
    anchorPoint: {
      x: x + node.nodeSize.width / 2,
      y: y - NodeGraphEditorNode.childSpacing / 2
    },
    attachInfo: {
      parent,
      index: index,
      pos: {
        x: x,
        y: y - NodeGraphEditorNode.childSpacing
      }
    }
  };
}

function getAttachPointBelowNode(node) {
  const { x, y } = node.global;

  const parent = node.parent;
  const index = parent.children.indexOf(node);

  const hierarchyHeight = node.measure().height;

  return {
    anchorPoint: {
      x: x + node.nodeSize.width / 2,
      y: y + hierarchyHeight + NodeGraphEditorNode.childSpacing / 2
    },
    attachInfo: {
      parent,
      index: index + 1,
      pos: {
        x: x,
        y: y + hierarchyHeight
      }
    }
  };
}
