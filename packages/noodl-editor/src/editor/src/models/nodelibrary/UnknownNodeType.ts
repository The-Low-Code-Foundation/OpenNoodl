import Model from '../../../../shared/model';

/**
 * What a node with no type at all is called.
 *
 * ⚠️ Distinct from a node whose type is *named but unregistered* — that one
 * keeps its name, which is the whole point of `UnknownNodeType`. This is for a
 * node that arrived carrying no `type` key, which is debris rather than a
 * missing plugin, and saying so is more use than an empty string.
 */
const NO_TYPE_NAME = 'Unknown node';

export class UnknownNodeType extends Model {
  private name: string;

  /**
   * 🔴 **This guard exists because its absence killed the whole editor, and did
   * it while telling you nothing.**
   *
   * A single node written with only `{id, x, y}` — no `type` — reaches here as
   * `new UnknownNodeType(undefined)`, and `undefined.split('/')` throws inside a
   * *getter*, during `NodeGraphModel.addRoot`'s walk over the roots. The project
   * never finishes loading, and the failure surfaces two doors away as
   * `TypeError: Cannot read properties of undefined (reading 'split')` thrown by
   * `<EditorDocument>` — which has nothing to do with it.
   *
   * ⚠️ **And the half-built graph is the confusing part.** `fromJSON` adds roots
   * first and connections second, so a throw partway through the roots leaves a
   * component whose wires are all present and whose nodes are not: the editor
   * paints a canvas of connectors floating in space. That reads as a renderer
   * bug, and it is a data one.
   *
   * One malformed node should cost you that node, not the project.
   */
  public get localName() {
    if (!this.name) return NO_TYPE_NAME;
    const path = this.name.split('/');
    return path[path.length - 1];
  }

  public get fullName() {
    return this.name;
  }

  public get displayName() {
    return this.localName;
  }

  constructor(typename: string) {
    super();

    this.name = typename;

    return this;
  }

  labelForNode(node: TSFixme) {
    return this.localName;
  }

  /**
   * Module is undefined for basic types
   */
  getModule() {}
}
