import { getParameterDisplayValue } from '@noodl-models/ExpressionParameter';
import { RuntimeType } from '@noodl-models/nodelibrary/NodeLibraryData';

import Model from '../../../../shared/model';

export class BasicNodeType extends Model {
  private displayNodeName: TSFixme; // TODO: Where is this from?

  allowAsChild: boolean;
  allowAsExportRoot: boolean;
  allowChildrenWithCategory: string[];
  public category: string;
  color: string;
  connectionPanel: TSFixme;
  public docs: string;
  dynamicports: TSFixme[];
  listeners: TSFixme[];
  listenersOnce: TSFixme[];
  public name: string;
  ports: TSFixme[];
  public runtimeTypes: RuntimeType[];
  shortDocs: string;
  useVariants: boolean;
  visualStates: { name: string; label: string }[];
  nodeDoubleClickAction?: {
    focusPort: string;
  };
  public searchTags: string[];

  public get localName() {
    return this.name;
  }

  public get fullName() {
    return (this.category ? this.category + '/' : '') + this.name;
  }

  public get displayName() {
    return this.displayNodeName ? this.displayNodeName : this.localName;
  }

  constructor(args) {
    super();

    // Set default variable
    this.runtimeTypes = [];
    this.searchTags = [];

    // Add anything...
    // TODO: Try to get rid of this args loop
    for (const i in args) {
      this[i] = args[i];
    }

    return this;
  }

  /**
   * The auto-generated name of a node — what the canvas card and the property panel header
   * show when the author has not typed a label of their own.
   *
   * The label port's parameter is NOT necessarily a primitive: setting fx on it stores
   * `{ mode: 'expression', expression, fallback, version }` (see `ExpressionParameter`), and this
   * used to be handed straight to the canvas painter, which stringified it to "[object Object]"
   * (FH-003). Resolve it here, at the one place the label is produced, so that every consumer —
   * the painter, the wrap-height cache, the label/type comparison, the property panel — agrees
   * on one string.
   *
   * The expression TEXT is what is shown, not the fallback: `Noodl.Variables.foo` is the name the
   * author typed, and it is the more useful thing to read off a card.
   */
  labelForNode(node: TSFixme) {
    // If usePortAsLabel is specified use that port value as label
    if (node.type.usePortAsLabel && node.parameters[node.type.usePortAsLabel]) {
      const rawValue = getParameterDisplayValue(node.parameters[node.type.usePortAsLabel]);

      // Anything that is still not a primitive has no sensible card text: `String()` on an
      // object is exactly the "[object Object]" this guards against. Treat it as no label.
      if (rawValue === null || rawValue === undefined || typeof rawValue === 'object') {
        return this.displayName;
      }

      let labelName = String(rawValue);

      // An expression object is truthy even when its expression is empty, so the guard above
      // (`node.parameters[...]`) cannot judge emptiness — only the resolved string can.
      if (labelName.length === 0) {
        return this.displayName;
      }

      const truncationMode = node.type.portLabelTruncationMode;
      if (truncationMode === 'filename') {
        labelName = labelName.split('/').pop();
      } else if (truncationMode === 'length' && labelName.length > 36) {
        labelName = labelName.slice(0, 33) + '...';
      }

      return labelName;
    } else {
      return this.displayName;
    }
  }

  /**
   * Module is undefined for basic types
   */
  getModule() {}
}
