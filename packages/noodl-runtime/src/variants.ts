import type { NodeInstance, NodeVariant as Variant } from '@noodl/types';

/** The slice of the graph model this class needs. */
interface VariantsGraphModel {
  on(eventName: 'variantUpdated', callback: (variant: Variant) => void): void;
  getVariant(typename: string, name: string): Variant | undefined;
}

/** The slice of the node scope this class needs. */
interface VariantsNodeScope {
  getNodesWithTypeRecursive(typename: string): VariantAwareNode[];
}

/**
 * A node as seen from here. `variant` is set only when a variant was applied at runtime;
 * `model.variant` is what the editor persisted. The runtime value wins.
 */
type VariantAwareNode = NodeInstance & {
  variant?: Variant;
  model?: { variant?: string };
  setVariant(variant: Variant): void;
};

class Variants {
  getNodeScope: () => VariantsNodeScope | undefined;
  graphModel?: VariantsGraphModel;

  constructor({
    graphModel,
    getNodeScope
  }: {
    graphModel?: VariantsGraphModel;
    getNodeScope: () => VariantsNodeScope | undefined;
  }) {
    this.getNodeScope = getNodeScope;

    if (graphModel) {
      this.graphModel = graphModel;
      graphModel.on('variantUpdated', (variant) => this.onVariantUpdated(variant));
    }
  }

  getVariant(typename: string, name: string): Variant | undefined {
    if (!this.graphModel) return undefined;

    return this.graphModel.getVariant(typename, name);
  }

  onVariantUpdated(variant: Variant): void {
    const nodeScope = this.getNodeScope();
    if (!nodeScope) return;

    //get all nodes with the type the variant applies to
    const nodes = nodeScope.getNodesWithTypeRecursive(variant.typename);

    //and filter for the ones using the updated variant
    const nodesWithVariant = nodes.filter((node) => {
      //if a variant has been set during runtime, it'll override the value from the model
      if (node.variant) return node.variant.name === variant.name;

      //otherwise check the model (which always matches the editor)
      return node.model && node.model.variant === variant.name;
    });

    //and re-apply the variant
    for (const node of nodesWithVariant) {
      node.setVariant(variant);
    }
  }
}

export = Variants;
