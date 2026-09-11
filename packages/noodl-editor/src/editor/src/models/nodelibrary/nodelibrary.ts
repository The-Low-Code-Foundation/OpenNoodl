import _ from 'underscore';

import { ComponentModel } from '@noodl-models/componentmodel';
import { NodeGraphNode } from '@noodl-models/nodegraphmodel';
import { BasicNodeType } from '@noodl-models/nodelibrary/BasicNodeType';
// WFA-009: the condition evaluator moved to `dynamicPortRules` so that the
// `conditionalports/*` filter below and the `namedports/list` generator share
// exactly one implementation of this small language rather than two dialects
// of it. Nothing else about the filter changed.
import { evaluateDynamicPortsCondition } from '@noodl-models/nodelibrary/dynamicPortRules';
import type { NodeLibraryProjectSettings } from '@noodl-models/nodelibrary/NodeLibraryData';
// FB-019 scope (3): the one predicate for "is this a port whose value carries a
// unit", shared with the connection popup's shape sentence and the Ports tab so
// the three cannot disagree about which ports they are talking about.
import { declaredUnit, isUnitsPortType } from '@noodl-models/nodelibrary/portWireShape';
import { UnknownNodeType } from '@noodl-models/nodelibrary/UnknownNodeType';

import Model from '../../../../shared/model';
// CN-003: the two halves of the project catalog overlay — the mapping (pure) and
// the seam it is installed into. Imported from the modules rather than through
// `../../validation`'s barrel, which would pull the whole rule engine into every
// module that touches the node library.
import { setCatalogOverlay } from '../../validation/catalog';
import { overlayFromNodeLibrary } from '../../validation/kitOverlay';
import { CanvasTheme } from '../../views/nodegrapheditor/canvas/CanvasTheme';
import { ModelProxy } from '../../views/panels/propertyeditor/models/modelProxy';

// TODO: Very ugly how we handle nodes in here now
export type NodeLibraryNodeType = (BasicNodeType | UnknownNodeType) & {
  ports: TSFixme[];
  dynamicports: TSFixme[];
  runtimeTypes?: string[];
};

export class NodeLibrary extends Model {
  public static instance = new NodeLibrary();

  modules: TSFixme[];
  typeCache: Map<TSFixme, TSFixme>;
  types: ComponentModel[];
  unkownNodeTypes: TSFixme;
  library: TSFixme;

  constructor() {
    super();

    this.modules = [];

    //have all types available in a name => type map to improve performance
    //of getNodeTypeWithName which is a major hotspot
    this.typeCache = new Map();
    this.loadLibrary();

    return this;
  }

  /**
   * Returns the name for a port type.
   *
   * SIG-001 widened the parameter to match what the body has always done: the
   * `if (!type) return;` guard handles `null`/`undefined`, and a port
   * declaration's `type` is `PortTypeLike` — an object whose `name` is optional.
   * The signature claimed neither, so every call site holding a real port
   * declaration had to cast. The return type is unchanged (`string | undefined`
   * was already what it inferred).
   */
  static nameForPortType(type: string | { name?: string } | null | undefined): string | undefined {
    if (!type) return;
    return typeof type === 'string' ? type : type.name;
  }

  /**
   * @param data HLS-013 — the library to load, for a caller with no `window`.
   *
   * 🔴 **Omitting it is not the same as passing an empty library.** With no
   * argument this reads `window.NodeLibraryData`, which in a plain Node process
   * is not "no library" but *silently* `{}` — every node type unresolved, every
   * connection unhealthy, and an export that quietly ships a fraction of the
   * graph. The headless cloud deploy hit exactly that, and it looked like a
   * working export. A caller outside the renderer must say which library it
   * means.
   */
  loadLibrary(data?: TSFixme) {
    this.types = [];
    this.typeCache.clear();
    this.unkownNodeTypes = {};

    this.library = data ?? ((typeof window !== 'undefined' ? window.NodeLibraryData : {}) || {});

    // CN-003 ✅ D3 — the project catalog overlay, installed from the library the
    // viewer already sent. Here rather than in `NodeLibraryImporter` because
    // this is the one function that runs on *every* path that changes what the
    // editor believes the node types are, including a `reload()` no importer
    // triggered; and because it is the read of `NodeLibrary.instance` the ruling
    // describes. It maps and merges — it never executes project code.
    //
    // The catalog this installs into is what `SemanticValidator` validates
    // against, so an empty library (no project open) installs an empty overlay
    // and puts the catalog back to built-ins only. That is the clearing path.
    setCatalogOverlay(overlayFromNodeLibrary(this.library).nodes);

    // Register basic types from the node library
    for (const i in this.library.nodetypes) {
      const type = this.library.nodetypes[i];

      this.registerType(new BasicNodeType(type));
    }

    // Dynamic port managers
    // this.dynamicPortManagers = [];
    /*  var dynamicPortManagerTypes = {
      'numbered':NodeLibrary.DynamicPortNumbered,
      'portchannel':NodeLibrary.DynamicPortChannel,
      'conditionalports':NodeLibrary.DynamicPortConditional,
      'expand':NodeLibrary.DynamicPortExpand,
    };*/
    /*  for(var i in this.library.dynamicports) {
      var type = this.library.dynamicports[i].type;
  
      if(type && dynamicPortManagerTypes[type])
        this.dynamicPortManagers.push(new dynamicPortManagerTypes[type](this.library.dynamicports[i]));
    }*/
    // Make sure the default color scheme is present
    if (!this.library.colors) this.library.colors = { nodes: {}, connections: {} };
    // UIX-005: fallbacks match the harmonised palette in nodelibraryexport.js
    if (!this.library.colors.nodes.default) {
      this.library.colors.nodes.default = {
        base: '#222933',
        text: '#a6b0bb'
      };
    }
    if (!this.library.colors.connections.default) {
      this.library.colors.connections.default = {
        normal: '#45d08a',
        highlighted: '#7de0ac'
      };
    }
  }

  reload() {
    this.loadLibrary();
    this.notifyListeners('libraryUpdated');
  }

  isLoaded() {
    return this.types.length > 0;
  }

  registerModule(module) {
    // Registering twice used to push a second entry and bind a second
    // 'componentRemoved' listener. `unregisterModule` removes one entry by
    // `indexOf`, so the duplicate was unremovable: the module stayed visible to
    // `getComponents()` for the rest of the session, and every project ever
    // double-registered kept shadowing later projects' same-named components.
    // The `ProjectModel.instance` setter registers on assignment, so any caller
    // that also registered explicitly leaked one.
    if (this.modules.indexOf(module) !== -1) return;

    this.modules.push(module);
    module._registered = true;

    // Registering a module changes what `getComponents()` returns, so any cache
    // built before it is stale by construction — a component name this module
    // defines may already be cached against a *different* module's component,
    // and `getNodeTypeWithName` only refills on a miss, so the stale entry wins
    // indefinitely. `unregisterModule` has always cleared for the mirror-image
    // reason; this side was missing, which is how three specs in the editor
    // suite came to pass or fail depending on what ran before them.
    this.typeCache.clear();

    //keep this.typeCache in sync by removing components that are removed from registered modules
    //no need to listen for new components since getNodeTypeWithName handles types that arent in the typeCache
    module.on(
      'componentRemoved',
      ({ model }) => {
        this.typeCache.delete(model.name);
      },
      this
    );

    this.notifyListeners('moduleRegistered', { model: module });
  }

  unregisterModule(module) {
    module.off(this);

    const idx = this.modules.indexOf(module);
    idx !== -1 && this.modules.splice(idx, 1);
    module._registered = false;
    this.typeCache.clear();
    this.notifyListeners('moduleUnregistered', { model: module });
  }

  isModuleRegistered(module) {
    return module._registered;
  }

  _getNodeTypeWithName(typename) {
    const types = this.types.concat(this.getComponents());

    return _.find(types, function (type) {
      return type.name === typename;
    });
  }

  getNodeTypeWithName(typename: string): NodeLibraryNodeType {
    const hasLoadedNodeLib = this.types.length;
    if (hasLoadedNodeLib && !this.typeCache.has(typename)) {
      const types = this.types.concat(this.getComponents());
      types.forEach((type) => this.typeCache.set(type.name, type));
    }

    return this.typeCache.get(typename);
  }

  getNodeTypes() {
    return this.types;
  }

  getComponents(): ComponentModel[] {
    let components = [];

    for (const i in this.modules) {
      const m = this.modules[i];

      components = components.concat(m.getComponents());
    }

    return components;
  }

  registerType(type) {
    this.types.push(type);
  }

  getUnknownNodeType(typename: string): UnknownNodeType {
    if (!this.unkownNodeTypes[typename]) this.unkownNodeTypes[typename] = new UnknownNodeType(typename);

    return this.unkownNodeTypes[typename];
  }

  typeIsMissing(type) {
    if (
      !type ||
      type instanceof UnknownNodeType || // Type has not been resolved
      (type.graph && !type.owner)
    ) {
      // Type is component but not part of a project
      return true;
    }

    return false;
  }

  // UIX-012: node colour schemes come from CanvasTheme (CSS tokens), not from
  // the runtime's dark-only `colors.nodes` blob — otherwise every DOM surface
  // that paints node chrome (picker, connection popup, references panel) stays
  // dark-navy under the light theme. The blob is still shipped by
  // nodelibraryexport.js for consumers outside the editor; it is simply no
  // longer what the editor renders from. React callers should prefer the
  // `useNodeColorScheme` hook, which also re-renders on theme change.
  colorSchemeForNodeColorName(name) {
    return CanvasTheme.instance.nodeColorScheme(name);
  }

  colorSchemeForNodeType(type) {
    return CanvasTheme.instance.nodeColorScheme(type?.color);
  }

  colorSchemeForConnectionType(type) {
    if (!this.library.colors.connections[type]) return this.library.colors.connections.default;
    return this.library.colors.connections[type];
  }

  // This function returns the annotated name for a port this is generally the
  // display name for the port plus any annotations such as the unit for numbers
  getAnnotatedPortName(node, port) {
    const displayName =
      (port.displayName ? port.displayName : port.name) +
      (port.tab && port.tab.label ? ' (' + port.tab.label + ')' : '');

    /*
     * Annotate a port whose value carries a unit with the unit it is currently in.
     *
     * 🔴 FB-019: this used to read `nameForPortType(port.type) === 'number'`, which excluded
     * `dimension` — and `dimension` is declared by exactly two ports, **Width and Height**. So
     * every units-typed `number` in the popup said its unit (`Min Width (%)`, `Pad Left (px)`,
     * `Margin Left (px)`) and the two ports a builder reaches for first said nothing. That is
     * the reported defect — *"the node width or something, you have to input a JSON"* — sitting
     * inside the editor's own annotation, as a hole shaped like the complaint.
     *
     * ⚠️ This answers a **different question** from the shape sentence in the port explainer,
     * and the two may legitimately differ. This says what unit the port is in *now*, falling
     * back to `defaultUnit`. `portWireShape`'s sentence says what unit a bare number arriving
     * **over a wire** will land in, and declines to guess for a port that declares no `default`
     * — because nothing is seeded for one, and whether it is coerced anyway depends on a
     * registration path the editor cannot see. Only the predicate is shared.
     */
    if (isUnitsPortType(port.type)) {
      const haveUnit = node.parameters[port.name] !== undefined && node.parameters[port.name].unit !== undefined;
      const unit = haveUnit ? node.parameters[port.name].unit : declaredUnit(port.type);
      // ⚠️ `dimension` is admitted by name alone, so a module could declare one with no
      // `defaultUnit`. Both shipped declarations have one; an annotation reading "(undefined)"
      // would be the widening making things worse than the hole it closed.
      if (unit) {
        return displayName + '<span class="portname-annotation-unit">&nbsp;(' + unit + ')<span>';
      }
    }

    return displayName;
  }

  formatParameterValue(value, port) {
    if (!port) return value;
    if (value === undefined) return;

    // If it's an enum node, it must return the label
    if (NodeLibrary.nameForPortType(port.type) === 'enum') {
      if (value === undefined) return 'none';

      const e = _.find(port.type.enums, function (e) {
        return e === value || e.value === value;
      });
      if (e === undefined) return;

      return e.label ? e.label : e;
    } else if (isUnitsPortType(port.type)) {

    /*
     * If the value has a unit, format it.
     *
     * 🔴 FB-019 found this as the **third** copy of "is this a units port", and it had two
     * defects the other two did not. It excluded `dimension` — so a Width in a merge-conflict
     * list rendered as `[object Object]` rather than `100%` — and its bare-number fallback read
     * `units[0]` where the runtime reads `defaultUnit`. Those disagree on six declarations, of
     * which `transformOriginX` is one: a stored bare `50` was shown as `50px` while the viewer
     * rendered it at `50%`. Both now come from the shared accessors.
     *
     * ⚠️ Every caller of this is the version-control conflict list (`NodeGraphNode.ts:1088`,
     * `VariantModel.ts:350`), which is why neither defect was ever reported.
     */
      if (value && value.unit !== undefined) return value.value + '' + value.unit;
      return value + '' + (declaredUnit(port.type) || '');
    }

    return value;
  }

  typeRenamed(model, oldName) {
    this.typeCache.delete(oldName);
    this.typeCache.set(model.name, model);
    this.notifyListeners('typeRenamed', { model, oldName });
  }

  findVariant(variantName, nodeType) {
    let variant = null;

    for (const m of this.modules) {
      if (m.findVariant) variant = m.findVariant(variantName, nodeType);
      if (variant !== undefined) return variant;
    }

    return variant;
  }

  getStyles(styleType) {
    for (const m of this.modules) {
      if (m.getMetaData) {
        const styles = m.getMetaData('styles');
        if (styles && styles[styleType]) {
          return styles[styleType];
        }
      }
    }

    return {};
  }

  // Return true if a type can be casted to
  canCastPortTypes(from, to) {
    const _from = NodeLibrary.nameForPortType(from);
    const _to = NodeLibrary.nameForPortType(to);

    if (_from === '*' || _to === '*') return true; // All types
    if (_from === _to) return true; // Same type

    // Not same type, look in cast list
    const cast = _.find(this.library.typecasts, function (c) {
      return c.from === _from;
    });
    if (!cast) return false;

    return cast.to.indexOf(_to) !== -1;
  }

  // This function attempts to find a type that is compatible with all connections
  // in the supplied array. The connections array should be on the form
  // [{direction:'to',type: 'number'},
  //  {direction:'from',type: 'boolean'}, ...]
  // The direction is the direction which the compatible type should be able to cast to
  // the supplied type. In the example above the function will attempt to find a type
  // that can cast to a number, and that can be casted to from a boolean.
  findCompatiblePortType(connections) {
    const _this = this;

    // Returns true if all types are castable in the
    // correct direction
    function isCompatible(type) {
      for (const i in connections) {
        const c = connections[i];

        const from = c.direction === 'from' ? c.type : type;
        const to = c.direction === 'to' ? c.type : type;
        if (!_this.canCastPortTypes(from, to)) return false;
      }
      return true;
    }

    // Merges modifiers for all types
    function mergeModifiers(types) {
      const merged = {} as any;

      // Merge enums
      let enums = [];
      _.each(types, function (t) {
        if (t.enums) enums = _.union(enums, t.enums);
      });
      merged.enums = enums.length > 0 ? enums : undefined;

      // Merge other modifiers
      _.each(types, function (t) {
        merged.multiline = merged.multiline || t.multiline;
        merged.allowConnectionsOnly = merged.allowConnectionsOnly || t.allowConnectionsOnly;
        merged.allowEditOnly = merged.allowEditOnly || t.allowEditOnly;
      });

      for (const i in merged) if (merged[i] === undefined) delete merged[i]; // Delete undefined
      return merged;
    }

    if (
      _.every(connections, function (c) {
        return NodeLibrary.nameForPortType(c.type) === NodeLibrary.nameForPortType(connections[0].type);
      })
    ) {
      // All ports have the same type, return a merged type
      return _.extend(
        { name: NodeLibrary.nameForPortType(connections[0].type) },
        mergeModifiers(_.pluck(connections, 'type'))
      );
    } else {
      const explicitTypeConnections = connections.filter(function (c) {
        return NodeLibrary.nameForPortType(c.type) !== '*';
      });
      if (explicitTypeConnections.length === 1) return explicitTypeConnections[0].type;

      // Iterate over all possible typecasts until a match that
      // supports all connections are found
      for (const i in this.library.typecasts) {
        const type = this.library.typecasts[i].from;

        if (isCompatible(type)) return _.extend({ name: type }, mergeModifiers(_.pluck(connections, 'type')));
      }
    }
  }

  // Project settings template from node library
  getProjectSettingsPorts(): NodeLibraryProjectSettings {
    return this.library.projectsettings || {};
  }

  applyPortConditionsFilterForNode(node: NodeGraphNode | ModelProxy, modes?: TSFixme): string[] {
    if (!node.type.dynamicports) return [];

    // Allow dynamic ports to be used in multiple conditions
    const ports = {};

    for (const i in node.type.dynamicports) {
      const ref = node.type.dynamicports[i];
      if (
        ref.name.startsWith('conditionalports/') &&
        (modes === undefined || modes.indexOf(ref.name.split('/')[1]) !== -1)
      ) {
        if (!evaluateDynamicPortsCondition(ref.condition, node)) {
          // Condition failed, these ports should be removed
          ref.ports.forEach((p) => {
            if (ports[p.name] === undefined) {
              ports[p.name] = true;
            }
          });
        } else {
          ref.ports.forEach((p) => {
            ports[p.name] = false;
          });
        }
      }
    }

    return Object.keys(ports).filter((key) => ports[key]);
  }

  isConditionalPortValid(node, portname, modes) {
    if (!node.type.dynamicports) return true;

    for (const i in node.type.dynamicports) {
      const ref = node.type.dynamicports[i];
      if (
        ref.name.startsWith('conditionalports/') &&
        (modes === undefined || modes.indexOf(ref.name.split('/')[1]) !== -1)
      ) {
        if (ref.ports.find((p) => p.name === portname) !== undefined) {
          return evaluateDynamicPortsCondition(ref.condition, node);
        }
      }
    }

    return true;
  }

  canPortHaveTransition(port) {
    function _typename() {
      return typeof port.type === 'object' ? port.type.name : port.type;
    }

    if (port === undefined) return false;

    return _typename() === 'color' || _typename() === 'number' || _typename() === 'dimension';
  }
}
