import { readNameList } from './nameListParameter.warnings';
import NodeTypeAdapter from './NodeTypeAdapter';

export class PageInputsAdapter extends NodeTypeAdapter {
  events: Record<string, any>;
  _copyParamsScheduled: boolean;

  constructor() {
    super('PageInputs');

    this.events = {
      'nodeAdded:PageInputs': this.nodeAdded.bind(this),
      projectLoaded: this.updateAllNodes.bind(this),
      'parametersChanged:PageInputs': this.parametersChanged.bind(this)
    };
  }

  updatePortsForNode(node) {
    const ports = [];

    const uniqueNames = {};

    // AIB-001: this ran `.split(',')` on the raw parameter. Both of these fire
    // from `nodeAdded` — inside the AI plan's apply transaction, among other
    // places — so a value of the wrong shape did not produce wrong ports, it
    // rolled the whole transaction back.
    for (const p of readNameList(node, 'pathParams')) uniqueNames[p] = true;
    for (const p of readNameList(node, 'queryParams')) uniqueNames[p] = true;

    Object.keys(uniqueNames).forEach((outputName) => {
      ports.push({
        name: 'pm-' + outputName,
        displayName: outputName,
        type: '*',
        plug: 'output',
        group: 'Parameters'
      });
    });

    node.setDynamicPorts(ports);
  }

  nodeAdded(e) {
    const node = e.args.model;

    const component = node.owner.owner;
    if (component !== undefined) {
      const pageInputs = component.getNodesWithType('PageInputs');
      for (const pi of pageInputs) {
        if (pi !== node) {
          node.parameters['queryParams'] = pi.parameters['queryParams'];
          node.parameters['pathParams'] = pi.parameters['pathParams'];
          break;
        }
      }
    }

    this.updatePortsForNode(node);
  }

  parametersChanged(e) {
    const node = e.model;

    if (this._copyParamsScheduled) return;
    this._copyParamsScheduled = true;

    // Copy parameters from this node to all other to keep in sync
    const component = node.owner.owner;
    if (component !== undefined) {
      const pageInputs = component.getNodesWithType('PageInputs');
      pageInputs.forEach((pi) => {
        if (pi !== node) {
          pi.setParameter('queryParams', node.parameters['queryParams'], { undo: e.args.undo });
          pi.setParameter('pathParams', node.parameters['pathParams'], { undo: e.args.undo });
        }

        this.updatePortsForNode(pi);
      });
    }

    this._copyParamsScheduled = false;
  }

  updateAllNodes(e) {
    // We need to update all navigation nodes
    const pageInputs = this.findAllNodes();
    pageInputs.forEach((node) => {
      this.updatePortsForNode(node);
    });
  }
}
