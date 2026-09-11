import { NodeGraphModel, NodeGraphNode } from '@noodl-models/nodegraphmodel';
import { seedNewNode } from '@noodl-models/nodeSeed/seedNewNode';
import { guid } from '@noodl-utils/utils';

import { ElementConfigRegistry } from '../../models/ElementConfigs';
import { CommentFillStyle } from '../CommentLayer/CommentLayerView';

export function createNodeFunction(
  model: NodeGraphModel,
  parentModel: NodeGraphNode,
  pos: TSFixme,
  attachToRoot: boolean
) {
  return (type: TSFixme) => {
    const node = NodeGraphNode.fromJSON({
      type: type.name,
      version: type.version,
      x: pos.x,
      y: pos.y,
      id: guid()
    });

    // STYLE-002: Apply element config defaults (token-based styles + initial variant)
    // Only affects nodes with a registered ElementConfig — no-op for all others.
    ElementConfigRegistry.applyDefaults(node, type.name);

    if (parentModel) {
      parentModel.addChild(node, { undo: true, label: 'create' });
    } else if (attachToRoot) {
      for (const root of model.roots) {
        if (root.canAcceptChildren([node])) {
          root.addChild(node, { undo: true, label: 'create' });
        }
      }

      if (node.parent === undefined)
        // Couldn't find compatiable root
        model.addRoot(node, { undo: true, label: 'create' });
    } else {
      model.addRoot(node, { undo: true, label: 'create' });
    }

    // FUN-002: a Function node arrives with a body that works, and therefore
    // with two ports. After the add, so it is its own undo entry — one ⌘Z
    // removes the seed and leaves the node, which is the expert's escape hatch.
    seedNewNode(node, type.name);
  };
}

export function createNewComment(model: TSFixme, pos: TSFixme) {
  const comment = {
    text: '',
    width: 150,
    height: 100,
    fill: CommentFillStyle.Transparent,
    x: pos.x,
    y: pos.y
  };

  model.commentsModel.addComment(comment, { undo: true, label: 'add comment', focusComment: true });
}
