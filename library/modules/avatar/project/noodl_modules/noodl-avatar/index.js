/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "../../noodl-sdk/build/dist/functions.js":
/*!***********************************************!*\
  !*** ../../noodl-sdk/build/dist/functions.js ***!
  \***********************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.runDeployed = exports.getProjectSettings = exports.defineModule = exports.defineReactNode = exports.defineModelNode = exports.defineCollectionNode = exports.defineNode = void 0;
const node_1 = __webpack_require__(/*! ./internal/node */ "../../noodl-sdk/build/dist/internal/node.js");
/**
 * Create a new logic node.
 *
 * @param def
 * @returns
 */
function defineNode(def) {
    const internalDefinition = (0, node_1.createNodeDefinition)(def);
    return {
        node: internalDefinition,
        setup: def.setup,
    };
}
exports.defineNode = defineNode;
/**
 *
 * @param def
 * @returns
 */
function defineCollectionNode(def) {
    const _def = {
        name: def.name,
        category: def.category,
        color: "data",
        inputs: def.inputs,
        outputs: Object.assign({
            Items: "array",
            "Fetch Started": "signal",
            "Fetch Completed": "signal",
        }, def.outputs || {}),
        signals: Object.assign({
            Fetch() {
                var _this = this;
                this.sendSignalOnOutput("Fetch Started");
                var a = def.fetch.call(this, function () {
                    _this.sendSignalOnOutput("Fetch Completed");
                });
                this.setOutputs({
                    Items: a,
                });
            },
        }, def.signals || {}),
    };
    return defineNode(_def);
}
exports.defineCollectionNode = defineCollectionNode;
/**
 *
 * @param def
 * @returns
 */
function defineModelNode(def) {
    const definition = {
        name: def.name,
        category: def.category,
        color: "data",
        inputs: {
            Id: "string",
        },
        outputs: {
            Fetched: "signal",
        },
        changed: {
            Id(value) {
                if (this._object && this._changeListener)
                    this._object.off("change", this._changeListener);
                // @ts-expect-error
                this._object = Noodl.Object.get(value);
                this._changeListener = (name, value) => {
                    const outputs = {};
                    outputs[name] = value;
                    this.setOutputs(outputs);
                };
                this._object.on("change", this._changeListener);
                this.setOutputs(this._object.data);
                this.sendSignalOnOutput("Fetched");
            },
        },
        initialize() { },
    };
    for (var key in def.properties) {
        definition.inputs[key] = def.properties[key];
        definition.outputs[key] = def.properties[key];
        definition.changed[key] = (function () {
            const _key = key;
            return function (value) {
                if (!this._object)
                    return;
                this._object.set(_key, value);
            };
        })();
    }
    return defineNode(definition);
}
exports.defineModelNode = defineModelNode;
/**
 * Create a new React node.
 *
 * @param def
 * @returns
 */
function defineReactNode(def) {
    const internalDefinition = (0, node_1.createNodeDefinition)(def);
    internalDefinition.getReactComponent = def.getReactComponent;
    internalDefinition.inputProps = def.inputProps;
    internalDefinition.inputCss = def.inputCss;
    internalDefinition.outputProps = def.outputProps;
    internalDefinition.setup = def.setup;
    internalDefinition.frame = def.frame;
    // @ts-expect-error
    internalDefinition.dynamicports = def.dynamicports;
    // @ts-expect-error
    internalDefinition.visualStates = def.visualStates;
    return internalDefinition;
}
exports.defineReactNode = defineReactNode;
function defineModule(def) {
    // HACK: Making webpack think that the method is in here.
    // @ts-ignore
    return Noodl.defineModule(def);
}
exports.defineModule = defineModule;
function getProjectSettings() {
    // HACK: Making webpack think that the method is in here.
    // @ts-ignore
    return Noodl.getProjectSettings();
}
exports.getProjectSettings = getProjectSettings;
function runDeployed() {
    // HACK: Making webpack think that the method is in here.
    // @ts-ignore
    return Noodl.runDeployed;
}
exports.runDeployed = runDeployed;
//# sourceMappingURL=functions.js.map

/***/ }),

/***/ "../../noodl-sdk/build/dist/index.js":
/*!*******************************************!*\
  !*** ../../noodl-sdk/build/dist/index.js ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
__exportStar(__webpack_require__(/*! ./types/types */ "../../noodl-sdk/build/dist/types/types.js"), exports);
__exportStar(__webpack_require__(/*! ./types/color */ "../../noodl-sdk/build/dist/types/color.js"), exports);
__exportStar(__webpack_require__(/*! ./types/node-instance */ "../../noodl-sdk/build/dist/types/node-instance.js"), exports);
__exportStar(__webpack_require__(/*! ./types/node */ "../../noodl-sdk/build/dist/types/node.js"), exports);
__exportStar(__webpack_require__(/*! ./types/module */ "../../noodl-sdk/build/dist/types/module.js"), exports);
__exportStar(__webpack_require__(/*! ./types/proxy */ "../../noodl-sdk/build/dist/types/proxy.js"), exports);
__exportStar(__webpack_require__(/*! ./functions */ "../../noodl-sdk/build/dist/functions.js"), exports);
//# sourceMappingURL=index.js.map

/***/ }),

/***/ "../../noodl-sdk/build/dist/internal/node.js":
/*!***************************************************!*\
  !*** ../../noodl-sdk/build/dist/internal/node.js ***!
  \***************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.createNodeDefinition = void 0;
const color_1 = __webpack_require__(/*! ../types/color */ "../../noodl-sdk/build/dist/types/color.js");
function nodeMapInputs(def) {
    const inputs = {};
    for (const key in def.inputs) {
        const value = def.inputs[key];
        if (typeof value === "object") {
            inputs[key] = {
                type: value.type,
                displayName: value.displayName,
                group: value.group,
                default: value.default,
                set: (function () {
                    const _key = key;
                    return function (value) {
                        // @ts-ignore
                        this.inputs[_key] = value;
                        if (def.changed && typeof def.changed[_key] === "function") {
                            def.changed[_key].apply(this, [value]);
                        }
                    };
                })(),
            };
        }
        else if (typeof value === "string") {
            inputs[key] = {
                type: value,
                displayName: undefined,
                group: undefined,
                default: undefined,
                set: (function () {
                    const _key = key;
                    return function (value) {
                        // @ts-ignore
                        this.inputs[_key] = value;
                        if (def.changed && typeof def.changed[_key] === "function") {
                            def.changed[_key].apply(this, [value]);
                        }
                    };
                })(),
            };
        }
        else {
            throw new Error("Unknown input type.");
        }
    }
    if (def.signals) {
        for (const key in def.signals) {
            const value = def.signals[key];
            if (typeof value === "object") {
                inputs[key] = {
                    type: "signal",
                    displayName: value.displayName,
                    group: value.group,
                    default: undefined,
                    valueChangedToTrue: (function () {
                        const _value = value;
                        return function () {
                            if (typeof _value.signal === "function") {
                                // @ts-ignore
                                this.scheduleAfterInputsHaveUpdated(() => {
                                    _value.signal.apply(this);
                                });
                            }
                        };
                    })(),
                };
            }
            else {
                inputs[key] = {
                    type: "signal",
                    displayName: undefined,
                    group: undefined,
                    default: undefined,
                    valueChangedToTrue: (function () {
                        const _value = value;
                        return function () {
                            if (typeof _value === "function") {
                                // @ts-ignore
                                this.scheduleAfterInputsHaveUpdated(() => {
                                    _value.apply(this);
                                });
                            }
                        };
                    })(),
                };
            }
        }
    }
    return inputs;
}
function nodeMapOutputs(def) {
    const outputs = {};
    for (const key in def.outputs) {
        const value = def.outputs[key];
        if (value === "signal") {
            outputs[key] = {
                type: "signal",
                displayName: undefined,
                group: undefined,
                getter: undefined,
            };
        }
        else if (typeof value === "object") {
            outputs[key] = {
                type: value.type,
                displayName: value.displayName,
                group: value.group,
                getter: (function () {
                    const _key = key;
                    return function () {
                        return this.outputs[_key];
                    };
                })(),
            };
        }
        else if (typeof value === "string") {
            outputs[key] = {
                type: value,
                displayName: undefined,
                group: undefined,
                getter: (function () {
                    const _key = key;
                    return function () {
                        return this.outputs[_key];
                    };
                })(),
            };
        }
        else {
            throw new Error("Unknown output type.");
        }
    }
    return outputs;
}
function nodeMapMethods(def) {
    const methods = {};
    for (const key in def.methods) {
        methods[key] = def.methods[key];
    }
    // Override the onNodeDeleted if required
    if (methods.onNodeDeleted) {
        methods._onNodeDeleted = function () {
            this.__proto__.__proto__._onNodeDeleted.call(this);
            methods.onNodeDeleted.value.call(this);
        };
    }
    return methods;
}
function createNodeDefinition(def) {
    const color = def.color || "default";
    const _def = {
        name: def.name,
        displayNodeName: def.displayName,
        usePortAsLabel: def.useInputAsLabel,
        color: (0, color_1.parseColor)(color),
        category: def.category || "Modules",
        allowChildren: def.allowChildren,
        allowChildrenWithCategory: def.allowChildrenWithCategory,
        getInspectInfo: def.getInspectInfo,
        docs: def.docs,
        initialize() {
            this.inputs = {};
            var _outputs = (this.outputs = {});
            var _this = this;
            // Function for quickly setting outputs
            this.setOutputs = function (o) {
                for (var key in o) {
                    // @ts-expect-error
                    _outputs[key] = o[key];
                    _this.flagOutputDirty(key);
                }
            };
            // Sending warnings
            this.clearWarnings = function () {
                if (this.context.editorConnection &&
                    this.nodeScope &&
                    this.nodeScope.componentOwner) {
                    this.context.editorConnection.clearWarnings(this.nodeScope.componentOwner.name, this.id);
                }
            }.bind(this);
            this.sendWarning = function (name, message) {
                if (this.context.editorConnection &&
                    this.nodeScope &&
                    this.nodeScope.componentOwner) {
                    this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, name, {
                        message: message,
                    });
                }
            }.bind(this);
            if (typeof def.initialize === "function") {
                def.initialize.apply(this);
            }
        },
        inputs: nodeMapInputs(def),
        outputs: nodeMapOutputs(def),
        methods: nodeMapMethods(def),
    };
    return _def;
}
exports.createNodeDefinition = createNodeDefinition;
//# sourceMappingURL=node.js.map

/***/ }),

/***/ "../../noodl-sdk/build/dist/types/color.js":
/*!*************************************************!*\
  !*** ../../noodl-sdk/build/dist/types/color.js ***!
  \*************************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.parseColor = void 0;
/** Provides the runtime values. */
const ColorTypesRuntime = {
    purple: "component",
    green: "data",
    blue: "visual",
    default: "default",
    grey: "default",
};
/**
 * Parse either Color key or Color value to a color.
 *
 * @param value Either the color or the type.
 * @returns
 */
function parseColor(value) {
    const keys = Object.keys(ColorTypesRuntime);
    // @ts-expect-error
    const hitKey = keys.find(x => ColorTypesRuntime[x] === value);
    if (hitKey) {
        return hitKey;
    }
    if (keys.includes(value)) {
        return ColorTypesRuntime[value];
    }
    return ColorTypesRuntime["default"];
}
exports.parseColor = parseColor;
//# sourceMappingURL=color.js.map

/***/ }),

/***/ "../../noodl-sdk/build/dist/types/module.js":
/*!**************************************************!*\
  !*** ../../noodl-sdk/build/dist/types/module.js ***!
  \**************************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
//# sourceMappingURL=module.js.map

/***/ }),

/***/ "../../noodl-sdk/build/dist/types/node-instance.js":
/*!*********************************************************!*\
  !*** ../../noodl-sdk/build/dist/types/node-instance.js ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
;
//# sourceMappingURL=node-instance.js.map

/***/ }),

/***/ "../../noodl-sdk/build/dist/types/node.js":
/*!************************************************!*\
  !*** ../../noodl-sdk/build/dist/types/node.js ***!
  \************************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
//# sourceMappingURL=node.js.map

/***/ }),

/***/ "../../noodl-sdk/build/dist/types/proxy.js":
/*!*************************************************!*\
  !*** ../../noodl-sdk/build/dist/types/proxy.js ***!
  \*************************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
//# sourceMappingURL=proxy.js.map

/***/ }),

/***/ "../../noodl-sdk/build/dist/types/types.js":
/*!*************************************************!*\
  !*** ../../noodl-sdk/build/dist/types/types.js ***!
  \*************************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
//# sourceMappingURL=types.js.map

/***/ }),

/***/ "./node_modules/react/cjs/react-jsx-runtime.development.js":
/*!*****************************************************************!*\
  !*** ./node_modules/react/cjs/react-jsx-runtime.development.js ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

/**
 * @license React
 * react-jsx-runtime.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */



if (true) {
  (function() {
'use strict';

var React = __webpack_require__(/*! react */ "react");

// -----------------------------------------------------------------------------

var enableScopeAPI = false; // Experimental Create Event Handle API.
var enableCacheElement = false;
var enableTransitionTracing = false; // No known bugs, but needs performance testing

var enableLegacyHidden = false; // Enables unstable_avoidThisFallback feature in Fiber
// stuff. Intended to enable React core members to more easily debug scheduling
// issues in DEV builds.

var enableDebugTracing = false; // Track which Fiber(s) schedule render work.

// ATTENTION

var REACT_ELEMENT_TYPE =  Symbol.for('react.element');
var REACT_PORTAL_TYPE =  Symbol.for('react.portal');
var REACT_FRAGMENT_TYPE =  Symbol.for('react.fragment');
var REACT_STRICT_MODE_TYPE =  Symbol.for('react.strict_mode');
var REACT_PROFILER_TYPE =  Symbol.for('react.profiler');
var REACT_PROVIDER_TYPE =  Symbol.for('react.provider');
var REACT_CONTEXT_TYPE =  Symbol.for('react.context');
var REACT_FORWARD_REF_TYPE =  Symbol.for('react.forward_ref');
var REACT_SUSPENSE_TYPE =  Symbol.for('react.suspense');
var REACT_SUSPENSE_LIST_TYPE =  Symbol.for('react.suspense_list');
var REACT_MEMO_TYPE =  Symbol.for('react.memo');
var REACT_LAZY_TYPE =  Symbol.for('react.lazy');
var REACT_OFFSCREEN_TYPE =  Symbol.for('react.offscreen');
var MAYBE_ITERATOR_SYMBOL =  Symbol.iterator;
var FAUX_ITERATOR_SYMBOL = '@@iterator';
function getIteratorFn(maybeIterable) {
  if (maybeIterable === null || typeof maybeIterable !== 'object') {
    return null;
  }

  var maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];

  if (typeof maybeIterator === 'function') {
    return maybeIterator;
  }

  return null;
}

var ReactSharedInternals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

function error(format) {
  {
    {
      for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        args[_key2 - 1] = arguments[_key2];
      }

      printWarning('error', format, args);
    }
  }
}

function printWarning(level, format, args) {
  // When changing this logic, you might want to also
  // update consoleWithStackDev.www.js as well.
  {
    var ReactDebugCurrentFrame = ReactSharedInternals.ReactDebugCurrentFrame;
    var stack = ReactDebugCurrentFrame.getStackAddendum();

    if (stack !== '') {
      format += '%s';
      args = args.concat([stack]);
    } // eslint-disable-next-line react-internal/safe-string-coercion


    var argsWithFormat = args.map(function (item) {
      return String(item);
    }); // Careful: RN currently depends on this prefix

    argsWithFormat.unshift('Warning: ' + format); // We intentionally don't use spread (or .apply) directly because it
    // breaks IE9: https://github.com/facebook/react/issues/13610
    // eslint-disable-next-line react-internal/no-production-logging

    Function.prototype.apply.call(console[level], console, argsWithFormat);
  }
}

var REACT_MODULE_REFERENCE;

{
  REACT_MODULE_REFERENCE = Symbol.for('react.module.reference');
}

function isValidElementType(type) {
  if (typeof type === 'string' || typeof type === 'function') {
    return true;
  } // Note: typeof might be other than 'symbol' or 'number' (e.g. if it's a polyfill).


  if (type === REACT_FRAGMENT_TYPE || type === REACT_PROFILER_TYPE || enableDebugTracing  || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || enableLegacyHidden  || type === REACT_OFFSCREEN_TYPE || enableScopeAPI  || enableCacheElement  || enableTransitionTracing ) {
    return true;
  }

  if (typeof type === 'object' && type !== null) {
    if (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || // This needs to include all possible module reference object
    // types supported by any Flight configuration anywhere since
    // we don't know which Flight build this will end up being used
    // with.
    type.$$typeof === REACT_MODULE_REFERENCE || type.getModuleId !== undefined) {
      return true;
    }
  }

  return false;
}

function getWrappedName(outerType, innerType, wrapperName) {
  var displayName = outerType.displayName;

  if (displayName) {
    return displayName;
  }

  var functionName = innerType.displayName || innerType.name || '';
  return functionName !== '' ? wrapperName + "(" + functionName + ")" : wrapperName;
} // Keep in sync with react-reconciler/getComponentNameFromFiber


function getContextName(type) {
  return type.displayName || 'Context';
} // Note that the reconciler package should generally prefer to use getComponentNameFromFiber() instead.


function getComponentNameFromType(type) {
  if (type == null) {
    // Host root, text node or just invalid type.
    return null;
  }

  {
    if (typeof type.tag === 'number') {
      error('Received an unexpected object in getComponentNameFromType(). ' + 'This is likely a bug in React. Please file an issue.');
    }
  }

  if (typeof type === 'function') {
    return type.displayName || type.name || null;
  }

  if (typeof type === 'string') {
    return type;
  }

  switch (type) {
    case REACT_FRAGMENT_TYPE:
      return 'Fragment';

    case REACT_PORTAL_TYPE:
      return 'Portal';

    case REACT_PROFILER_TYPE:
      return 'Profiler';

    case REACT_STRICT_MODE_TYPE:
      return 'StrictMode';

    case REACT_SUSPENSE_TYPE:
      return 'Suspense';

    case REACT_SUSPENSE_LIST_TYPE:
      return 'SuspenseList';

  }

  if (typeof type === 'object') {
    switch (type.$$typeof) {
      case REACT_CONTEXT_TYPE:
        var context = type;
        return getContextName(context) + '.Consumer';

      case REACT_PROVIDER_TYPE:
        var provider = type;
        return getContextName(provider._context) + '.Provider';

      case REACT_FORWARD_REF_TYPE:
        return getWrappedName(type, type.render, 'ForwardRef');

      case REACT_MEMO_TYPE:
        var outerName = type.displayName || null;

        if (outerName !== null) {
          return outerName;
        }

        return getComponentNameFromType(type.type) || 'Memo';

      case REACT_LAZY_TYPE:
        {
          var lazyComponent = type;
          var payload = lazyComponent._payload;
          var init = lazyComponent._init;

          try {
            return getComponentNameFromType(init(payload));
          } catch (x) {
            return null;
          }
        }

      // eslint-disable-next-line no-fallthrough
    }
  }

  return null;
}

var assign = Object.assign;

// Helpers to patch console.logs to avoid logging during side-effect free
// replaying on render function. This currently only patches the object
// lazily which won't cover if the log function was extracted eagerly.
// We could also eagerly patch the method.
var disabledDepth = 0;
var prevLog;
var prevInfo;
var prevWarn;
var prevError;
var prevGroup;
var prevGroupCollapsed;
var prevGroupEnd;

function disabledLog() {}

disabledLog.__reactDisabledLog = true;
function disableLogs() {
  {
    if (disabledDepth === 0) {
      /* eslint-disable react-internal/no-production-logging */
      prevLog = console.log;
      prevInfo = console.info;
      prevWarn = console.warn;
      prevError = console.error;
      prevGroup = console.group;
      prevGroupCollapsed = console.groupCollapsed;
      prevGroupEnd = console.groupEnd; // https://github.com/facebook/react/issues/19099

      var props = {
        configurable: true,
        enumerable: true,
        value: disabledLog,
        writable: true
      }; // $FlowFixMe Flow thinks console is immutable.

      Object.defineProperties(console, {
        info: props,
        log: props,
        warn: props,
        error: props,
        group: props,
        groupCollapsed: props,
        groupEnd: props
      });
      /* eslint-enable react-internal/no-production-logging */
    }

    disabledDepth++;
  }
}
function reenableLogs() {
  {
    disabledDepth--;

    if (disabledDepth === 0) {
      /* eslint-disable react-internal/no-production-logging */
      var props = {
        configurable: true,
        enumerable: true,
        writable: true
      }; // $FlowFixMe Flow thinks console is immutable.

      Object.defineProperties(console, {
        log: assign({}, props, {
          value: prevLog
        }),
        info: assign({}, props, {
          value: prevInfo
        }),
        warn: assign({}, props, {
          value: prevWarn
        }),
        error: assign({}, props, {
          value: prevError
        }),
        group: assign({}, props, {
          value: prevGroup
        }),
        groupCollapsed: assign({}, props, {
          value: prevGroupCollapsed
        }),
        groupEnd: assign({}, props, {
          value: prevGroupEnd
        })
      });
      /* eslint-enable react-internal/no-production-logging */
    }

    if (disabledDepth < 0) {
      error('disabledDepth fell below zero. ' + 'This is a bug in React. Please file an issue.');
    }
  }
}

var ReactCurrentDispatcher = ReactSharedInternals.ReactCurrentDispatcher;
var prefix;
function describeBuiltInComponentFrame(name, source, ownerFn) {
  {
    if (prefix === undefined) {
      // Extract the VM specific prefix used by each line.
      try {
        throw Error();
      } catch (x) {
        var match = x.stack.trim().match(/\n( *(at )?)/);
        prefix = match && match[1] || '';
      }
    } // We use the prefix to ensure our stacks line up with native stack frames.


    return '\n' + prefix + name;
  }
}
var reentry = false;
var componentFrameCache;

{
  var PossiblyWeakMap = typeof WeakMap === 'function' ? WeakMap : Map;
  componentFrameCache = new PossiblyWeakMap();
}

function describeNativeComponentFrame(fn, construct) {
  // If something asked for a stack inside a fake render, it should get ignored.
  if ( !fn || reentry) {
    return '';
  }

  {
    var frame = componentFrameCache.get(fn);

    if (frame !== undefined) {
      return frame;
    }
  }

  var control;
  reentry = true;
  var previousPrepareStackTrace = Error.prepareStackTrace; // $FlowFixMe It does accept undefined.

  Error.prepareStackTrace = undefined;
  var previousDispatcher;

  {
    previousDispatcher = ReactCurrentDispatcher.current; // Set the dispatcher in DEV because this might be call in the render function
    // for warnings.

    ReactCurrentDispatcher.current = null;
    disableLogs();
  }

  try {
    // This should throw.
    if (construct) {
      // Something should be setting the props in the constructor.
      var Fake = function () {
        throw Error();
      }; // $FlowFixMe


      Object.defineProperty(Fake.prototype, 'props', {
        set: function () {
          // We use a throwing setter instead of frozen or non-writable props
          // because that won't throw in a non-strict mode function.
          throw Error();
        }
      });

      if (typeof Reflect === 'object' && Reflect.construct) {
        // We construct a different control for this case to include any extra
        // frames added by the construct call.
        try {
          Reflect.construct(Fake, []);
        } catch (x) {
          control = x;
        }

        Reflect.construct(fn, [], Fake);
      } else {
        try {
          Fake.call();
        } catch (x) {
          control = x;
        }

        fn.call(Fake.prototype);
      }
    } else {
      try {
        throw Error();
      } catch (x) {
        control = x;
      }

      fn();
    }
  } catch (sample) {
    // This is inlined manually because closure doesn't do it for us.
    if (sample && control && typeof sample.stack === 'string') {
      // This extracts the first frame from the sample that isn't also in the control.
      // Skipping one frame that we assume is the frame that calls the two.
      var sampleLines = sample.stack.split('\n');
      var controlLines = control.stack.split('\n');
      var s = sampleLines.length - 1;
      var c = controlLines.length - 1;

      while (s >= 1 && c >= 0 && sampleLines[s] !== controlLines[c]) {
        // We expect at least one stack frame to be shared.
        // Typically this will be the root most one. However, stack frames may be
        // cut off due to maximum stack limits. In this case, one maybe cut off
        // earlier than the other. We assume that the sample is longer or the same
        // and there for cut off earlier. So we should find the root most frame in
        // the sample somewhere in the control.
        c--;
      }

      for (; s >= 1 && c >= 0; s--, c--) {
        // Next we find the first one that isn't the same which should be the
        // frame that called our sample function and the control.
        if (sampleLines[s] !== controlLines[c]) {
          // In V8, the first line is describing the message but other VMs don't.
          // If we're about to return the first line, and the control is also on the same
          // line, that's a pretty good indicator that our sample threw at same line as
          // the control. I.e. before we entered the sample frame. So we ignore this result.
          // This can happen if you passed a class to function component, or non-function.
          if (s !== 1 || c !== 1) {
            do {
              s--;
              c--; // We may still have similar intermediate frames from the construct call.
              // The next one that isn't the same should be our match though.

              if (c < 0 || sampleLines[s] !== controlLines[c]) {
                // V8 adds a "new" prefix for native classes. Let's remove it to make it prettier.
                var _frame = '\n' + sampleLines[s].replace(' at new ', ' at '); // If our component frame is labeled "<anonymous>"
                // but we have a user-provided "displayName"
                // splice it in to make the stack more readable.


                if (fn.displayName && _frame.includes('<anonymous>')) {
                  _frame = _frame.replace('<anonymous>', fn.displayName);
                }

                {
                  if (typeof fn === 'function') {
                    componentFrameCache.set(fn, _frame);
                  }
                } // Return the line we found.


                return _frame;
              }
            } while (s >= 1 && c >= 0);
          }

          break;
        }
      }
    }
  } finally {
    reentry = false;

    {
      ReactCurrentDispatcher.current = previousDispatcher;
      reenableLogs();
    }

    Error.prepareStackTrace = previousPrepareStackTrace;
  } // Fallback to just using the name if we couldn't make it throw.


  var name = fn ? fn.displayName || fn.name : '';
  var syntheticFrame = name ? describeBuiltInComponentFrame(name) : '';

  {
    if (typeof fn === 'function') {
      componentFrameCache.set(fn, syntheticFrame);
    }
  }

  return syntheticFrame;
}
function describeFunctionComponentFrame(fn, source, ownerFn) {
  {
    return describeNativeComponentFrame(fn, false);
  }
}

function shouldConstruct(Component) {
  var prototype = Component.prototype;
  return !!(prototype && prototype.isReactComponent);
}

function describeUnknownElementTypeFrameInDEV(type, source, ownerFn) {

  if (type == null) {
    return '';
  }

  if (typeof type === 'function') {
    {
      return describeNativeComponentFrame(type, shouldConstruct(type));
    }
  }

  if (typeof type === 'string') {
    return describeBuiltInComponentFrame(type);
  }

  switch (type) {
    case REACT_SUSPENSE_TYPE:
      return describeBuiltInComponentFrame('Suspense');

    case REACT_SUSPENSE_LIST_TYPE:
      return describeBuiltInComponentFrame('SuspenseList');
  }

  if (typeof type === 'object') {
    switch (type.$$typeof) {
      case REACT_FORWARD_REF_TYPE:
        return describeFunctionComponentFrame(type.render);

      case REACT_MEMO_TYPE:
        // Memo may contain any component type so we recursively resolve it.
        return describeUnknownElementTypeFrameInDEV(type.type, source, ownerFn);

      case REACT_LAZY_TYPE:
        {
          var lazyComponent = type;
          var payload = lazyComponent._payload;
          var init = lazyComponent._init;

          try {
            // Lazy may contain any component type so we recursively resolve it.
            return describeUnknownElementTypeFrameInDEV(init(payload), source, ownerFn);
          } catch (x) {}
        }
    }
  }

  return '';
}

var hasOwnProperty = Object.prototype.hasOwnProperty;

var loggedTypeFailures = {};
var ReactDebugCurrentFrame = ReactSharedInternals.ReactDebugCurrentFrame;

function setCurrentlyValidatingElement(element) {
  {
    if (element) {
      var owner = element._owner;
      var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
      ReactDebugCurrentFrame.setExtraStackFrame(stack);
    } else {
      ReactDebugCurrentFrame.setExtraStackFrame(null);
    }
  }
}

function checkPropTypes(typeSpecs, values, location, componentName, element) {
  {
    // $FlowFixMe This is okay but Flow doesn't know it.
    var has = Function.call.bind(hasOwnProperty);

    for (var typeSpecName in typeSpecs) {
      if (has(typeSpecs, typeSpecName)) {
        var error$1 = void 0; // Prop type validation may throw. In case they do, we don't want to
        // fail the render phase where it didn't fail before. So we log it.
        // After these have been cleaned up, we'll let them throw.

        try {
          // This is intentionally an invariant that gets caught. It's the same
          // behavior as without this statement except with a better message.
          if (typeof typeSpecs[typeSpecName] !== 'function') {
            // eslint-disable-next-line react-internal/prod-error-codes
            var err = Error((componentName || 'React class') + ': ' + location + ' type `' + typeSpecName + '` is invalid; ' + 'it must be a function, usually from the `prop-types` package, but received `' + typeof typeSpecs[typeSpecName] + '`.' + 'This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.');
            err.name = 'Invariant Violation';
            throw err;
          }

          error$1 = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, 'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED');
        } catch (ex) {
          error$1 = ex;
        }

        if (error$1 && !(error$1 instanceof Error)) {
          setCurrentlyValidatingElement(element);

          error('%s: type specification of %s' + ' `%s` is invalid; the type checker ' + 'function must return `null` or an `Error` but returned a %s. ' + 'You may have forgotten to pass an argument to the type checker ' + 'creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and ' + 'shape all require an argument).', componentName || 'React class', location, typeSpecName, typeof error$1);

          setCurrentlyValidatingElement(null);
        }

        if (error$1 instanceof Error && !(error$1.message in loggedTypeFailures)) {
          // Only monitor this failure once because there tends to be a lot of the
          // same error.
          loggedTypeFailures[error$1.message] = true;
          setCurrentlyValidatingElement(element);

          error('Failed %s type: %s', location, error$1.message);

          setCurrentlyValidatingElement(null);
        }
      }
    }
  }
}

var isArrayImpl = Array.isArray; // eslint-disable-next-line no-redeclare

function isArray(a) {
  return isArrayImpl(a);
}

/*
 * The `'' + value` pattern (used in in perf-sensitive code) throws for Symbol
 * and Temporal.* types. See https://github.com/facebook/react/pull/22064.
 *
 * The functions in this module will throw an easier-to-understand,
 * easier-to-debug exception with a clear errors message message explaining the
 * problem. (Instead of a confusing exception thrown inside the implementation
 * of the `value` object).
 */
// $FlowFixMe only called in DEV, so void return is not possible.
function typeName(value) {
  {
    // toStringTag is needed for namespaced types like Temporal.Instant
    var hasToStringTag = typeof Symbol === 'function' && Symbol.toStringTag;
    var type = hasToStringTag && value[Symbol.toStringTag] || value.constructor.name || 'Object';
    return type;
  }
} // $FlowFixMe only called in DEV, so void return is not possible.


function willCoercionThrow(value) {
  {
    try {
      testStringCoercion(value);
      return false;
    } catch (e) {
      return true;
    }
  }
}

function testStringCoercion(value) {
  // If you ended up here by following an exception call stack, here's what's
  // happened: you supplied an object or symbol value to React (as a prop, key,
  // DOM attribute, CSS property, string ref, etc.) and when React tried to
  // coerce it to a string using `'' + value`, an exception was thrown.
  //
  // The most common types that will cause this exception are `Symbol` instances
  // and Temporal objects like `Temporal.Instant`. But any object that has a
  // `valueOf` or `[Symbol.toPrimitive]` method that throws will also cause this
  // exception. (Library authors do this to prevent users from using built-in
  // numeric operators like `+` or comparison operators like `>=` because custom
  // methods are needed to perform accurate arithmetic or comparison.)
  //
  // To fix the problem, coerce this object or symbol value to a string before
  // passing it to React. The most reliable way is usually `String(value)`.
  //
  // To find which value is throwing, check the browser or debugger console.
  // Before this exception was thrown, there should be `console.error` output
  // that shows the type (Symbol, Temporal.PlainDate, etc.) that caused the
  // problem and how that type was used: key, atrribute, input value prop, etc.
  // In most cases, this console output also shows the component and its
  // ancestor components where the exception happened.
  //
  // eslint-disable-next-line react-internal/safe-string-coercion
  return '' + value;
}
function checkKeyStringCoercion(value) {
  {
    if (willCoercionThrow(value)) {
      error('The provided key is an unsupported type %s.' + ' This value must be coerced to a string before before using it here.', typeName(value));

      return testStringCoercion(value); // throw (to help callers find troubleshooting comments)
    }
  }
}

var ReactCurrentOwner = ReactSharedInternals.ReactCurrentOwner;
var RESERVED_PROPS = {
  key: true,
  ref: true,
  __self: true,
  __source: true
};
var specialPropKeyWarningShown;
var specialPropRefWarningShown;
var didWarnAboutStringRefs;

{
  didWarnAboutStringRefs = {};
}

function hasValidRef(config) {
  {
    if (hasOwnProperty.call(config, 'ref')) {
      var getter = Object.getOwnPropertyDescriptor(config, 'ref').get;

      if (getter && getter.isReactWarning) {
        return false;
      }
    }
  }

  return config.ref !== undefined;
}

function hasValidKey(config) {
  {
    if (hasOwnProperty.call(config, 'key')) {
      var getter = Object.getOwnPropertyDescriptor(config, 'key').get;

      if (getter && getter.isReactWarning) {
        return false;
      }
    }
  }

  return config.key !== undefined;
}

function warnIfStringRefCannotBeAutoConverted(config, self) {
  {
    if (typeof config.ref === 'string' && ReactCurrentOwner.current && self && ReactCurrentOwner.current.stateNode !== self) {
      var componentName = getComponentNameFromType(ReactCurrentOwner.current.type);

      if (!didWarnAboutStringRefs[componentName]) {
        error('Component "%s" contains the string ref "%s". ' + 'Support for string refs will be removed in a future major release. ' + 'This case cannot be automatically converted to an arrow function. ' + 'We ask you to manually fix this case by using useRef() or createRef() instead. ' + 'Learn more about using refs safely here: ' + 'https://reactjs.org/link/strict-mode-string-ref', getComponentNameFromType(ReactCurrentOwner.current.type), config.ref);

        didWarnAboutStringRefs[componentName] = true;
      }
    }
  }
}

function defineKeyPropWarningGetter(props, displayName) {
  {
    var warnAboutAccessingKey = function () {
      if (!specialPropKeyWarningShown) {
        specialPropKeyWarningShown = true;

        error('%s: `key` is not a prop. Trying to access it will result ' + 'in `undefined` being returned. If you need to access the same ' + 'value within the child component, you should pass it as a different ' + 'prop. (https://reactjs.org/link/special-props)', displayName);
      }
    };

    warnAboutAccessingKey.isReactWarning = true;
    Object.defineProperty(props, 'key', {
      get: warnAboutAccessingKey,
      configurable: true
    });
  }
}

function defineRefPropWarningGetter(props, displayName) {
  {
    var warnAboutAccessingRef = function () {
      if (!specialPropRefWarningShown) {
        specialPropRefWarningShown = true;

        error('%s: `ref` is not a prop. Trying to access it will result ' + 'in `undefined` being returned. If you need to access the same ' + 'value within the child component, you should pass it as a different ' + 'prop. (https://reactjs.org/link/special-props)', displayName);
      }
    };

    warnAboutAccessingRef.isReactWarning = true;
    Object.defineProperty(props, 'ref', {
      get: warnAboutAccessingRef,
      configurable: true
    });
  }
}
/**
 * Factory method to create a new React element. This no longer adheres to
 * the class pattern, so do not use new to call it. Also, instanceof check
 * will not work. Instead test $$typeof field against Symbol.for('react.element') to check
 * if something is a React Element.
 *
 * @param {*} type
 * @param {*} props
 * @param {*} key
 * @param {string|object} ref
 * @param {*} owner
 * @param {*} self A *temporary* helper to detect places where `this` is
 * different from the `owner` when React.createElement is called, so that we
 * can warn. We want to get rid of owner and replace string `ref`s with arrow
 * functions, and as long as `this` and owner are the same, there will be no
 * change in behavior.
 * @param {*} source An annotation object (added by a transpiler or otherwise)
 * indicating filename, line number, and/or other information.
 * @internal
 */


var ReactElement = function (type, key, ref, self, source, owner, props) {
  var element = {
    // This tag allows us to uniquely identify this as a React Element
    $$typeof: REACT_ELEMENT_TYPE,
    // Built-in properties that belong on the element
    type: type,
    key: key,
    ref: ref,
    props: props,
    // Record the component responsible for creating this element.
    _owner: owner
  };

  {
    // The validation flag is currently mutative. We put it on
    // an external backing store so that we can freeze the whole object.
    // This can be replaced with a WeakMap once they are implemented in
    // commonly used development environments.
    element._store = {}; // To make comparing ReactElements easier for testing purposes, we make
    // the validation flag non-enumerable (where possible, which should
    // include every environment we run tests in), so the test framework
    // ignores it.

    Object.defineProperty(element._store, 'validated', {
      configurable: false,
      enumerable: false,
      writable: true,
      value: false
    }); // self and source are DEV only properties.

    Object.defineProperty(element, '_self', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: self
    }); // Two elements created in two different places should be considered
    // equal for testing purposes and therefore we hide it from enumeration.

    Object.defineProperty(element, '_source', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: source
    });

    if (Object.freeze) {
      Object.freeze(element.props);
      Object.freeze(element);
    }
  }

  return element;
};
/**
 * https://github.com/reactjs/rfcs/pull/107
 * @param {*} type
 * @param {object} props
 * @param {string} key
 */

function jsxDEV(type, config, maybeKey, source, self) {
  {
    var propName; // Reserved names are extracted

    var props = {};
    var key = null;
    var ref = null; // Currently, key can be spread in as a prop. This causes a potential
    // issue if key is also explicitly declared (ie. <div {...props} key="Hi" />
    // or <div key="Hi" {...props} /> ). We want to deprecate key spread,
    // but as an intermediary step, we will use jsxDEV for everything except
    // <div {...props} key="Hi" />, because we aren't currently able to tell if
    // key is explicitly declared to be undefined or not.

    if (maybeKey !== undefined) {
      {
        checkKeyStringCoercion(maybeKey);
      }

      key = '' + maybeKey;
    }

    if (hasValidKey(config)) {
      {
        checkKeyStringCoercion(config.key);
      }

      key = '' + config.key;
    }

    if (hasValidRef(config)) {
      ref = config.ref;
      warnIfStringRefCannotBeAutoConverted(config, self);
    } // Remaining properties are added to a new props object


    for (propName in config) {
      if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
        props[propName] = config[propName];
      }
    } // Resolve default props


    if (type && type.defaultProps) {
      var defaultProps = type.defaultProps;

      for (propName in defaultProps) {
        if (props[propName] === undefined) {
          props[propName] = defaultProps[propName];
        }
      }
    }

    if (key || ref) {
      var displayName = typeof type === 'function' ? type.displayName || type.name || 'Unknown' : type;

      if (key) {
        defineKeyPropWarningGetter(props, displayName);
      }

      if (ref) {
        defineRefPropWarningGetter(props, displayName);
      }
    }

    return ReactElement(type, key, ref, self, source, ReactCurrentOwner.current, props);
  }
}

var ReactCurrentOwner$1 = ReactSharedInternals.ReactCurrentOwner;
var ReactDebugCurrentFrame$1 = ReactSharedInternals.ReactDebugCurrentFrame;

function setCurrentlyValidatingElement$1(element) {
  {
    if (element) {
      var owner = element._owner;
      var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
      ReactDebugCurrentFrame$1.setExtraStackFrame(stack);
    } else {
      ReactDebugCurrentFrame$1.setExtraStackFrame(null);
    }
  }
}

var propTypesMisspellWarningShown;

{
  propTypesMisspellWarningShown = false;
}
/**
 * Verifies the object is a ReactElement.
 * See https://reactjs.org/docs/react-api.html#isvalidelement
 * @param {?object} object
 * @return {boolean} True if `object` is a ReactElement.
 * @final
 */


function isValidElement(object) {
  {
    return typeof object === 'object' && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
  }
}

function getDeclarationErrorAddendum() {
  {
    if (ReactCurrentOwner$1.current) {
      var name = getComponentNameFromType(ReactCurrentOwner$1.current.type);

      if (name) {
        return '\n\nCheck the render method of `' + name + '`.';
      }
    }

    return '';
  }
}

function getSourceInfoErrorAddendum(source) {
  {
    if (source !== undefined) {
      var fileName = source.fileName.replace(/^.*[\\\/]/, '');
      var lineNumber = source.lineNumber;
      return '\n\nCheck your code at ' + fileName + ':' + lineNumber + '.';
    }

    return '';
  }
}
/**
 * Warn if there's no key explicitly set on dynamic arrays of children or
 * object keys are not valid. This allows us to keep track of children between
 * updates.
 */


var ownerHasKeyUseWarning = {};

function getCurrentComponentErrorInfo(parentType) {
  {
    var info = getDeclarationErrorAddendum();

    if (!info) {
      var parentName = typeof parentType === 'string' ? parentType : parentType.displayName || parentType.name;

      if (parentName) {
        info = "\n\nCheck the top-level render call using <" + parentName + ">.";
      }
    }

    return info;
  }
}
/**
 * Warn if the element doesn't have an explicit key assigned to it.
 * This element is in an array. The array could grow and shrink or be
 * reordered. All children that haven't already been validated are required to
 * have a "key" property assigned to it. Error statuses are cached so a warning
 * will only be shown once.
 *
 * @internal
 * @param {ReactElement} element Element that requires a key.
 * @param {*} parentType element's parent's type.
 */


function validateExplicitKey(element, parentType) {
  {
    if (!element._store || element._store.validated || element.key != null) {
      return;
    }

    element._store.validated = true;
    var currentComponentErrorInfo = getCurrentComponentErrorInfo(parentType);

    if (ownerHasKeyUseWarning[currentComponentErrorInfo]) {
      return;
    }

    ownerHasKeyUseWarning[currentComponentErrorInfo] = true; // Usually the current owner is the offender, but if it accepts children as a
    // property, it may be the creator of the child that's responsible for
    // assigning it a key.

    var childOwner = '';

    if (element && element._owner && element._owner !== ReactCurrentOwner$1.current) {
      // Give the component that originally created this child.
      childOwner = " It was passed a child from " + getComponentNameFromType(element._owner.type) + ".";
    }

    setCurrentlyValidatingElement$1(element);

    error('Each child in a list should have a unique "key" prop.' + '%s%s See https://reactjs.org/link/warning-keys for more information.', currentComponentErrorInfo, childOwner);

    setCurrentlyValidatingElement$1(null);
  }
}
/**
 * Ensure that every element either is passed in a static location, in an
 * array with an explicit keys property defined, or in an object literal
 * with valid key property.
 *
 * @internal
 * @param {ReactNode} node Statically passed child of any type.
 * @param {*} parentType node's parent's type.
 */


function validateChildKeys(node, parentType) {
  {
    if (typeof node !== 'object') {
      return;
    }

    if (isArray(node)) {
      for (var i = 0; i < node.length; i++) {
        var child = node[i];

        if (isValidElement(child)) {
          validateExplicitKey(child, parentType);
        }
      }
    } else if (isValidElement(node)) {
      // This element was passed in a valid location.
      if (node._store) {
        node._store.validated = true;
      }
    } else if (node) {
      var iteratorFn = getIteratorFn(node);

      if (typeof iteratorFn === 'function') {
        // Entry iterators used to provide implicit keys,
        // but now we print a separate warning for them later.
        if (iteratorFn !== node.entries) {
          var iterator = iteratorFn.call(node);
          var step;

          while (!(step = iterator.next()).done) {
            if (isValidElement(step.value)) {
              validateExplicitKey(step.value, parentType);
            }
          }
        }
      }
    }
  }
}
/**
 * Given an element, validate that its props follow the propTypes definition,
 * provided by the type.
 *
 * @param {ReactElement} element
 */


function validatePropTypes(element) {
  {
    var type = element.type;

    if (type === null || type === undefined || typeof type === 'string') {
      return;
    }

    var propTypes;

    if (typeof type === 'function') {
      propTypes = type.propTypes;
    } else if (typeof type === 'object' && (type.$$typeof === REACT_FORWARD_REF_TYPE || // Note: Memo only checks outer props here.
    // Inner props are checked in the reconciler.
    type.$$typeof === REACT_MEMO_TYPE)) {
      propTypes = type.propTypes;
    } else {
      return;
    }

    if (propTypes) {
      // Intentionally inside to avoid triggering lazy initializers:
      var name = getComponentNameFromType(type);
      checkPropTypes(propTypes, element.props, 'prop', name, element);
    } else if (type.PropTypes !== undefined && !propTypesMisspellWarningShown) {
      propTypesMisspellWarningShown = true; // Intentionally inside to avoid triggering lazy initializers:

      var _name = getComponentNameFromType(type);

      error('Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?', _name || 'Unknown');
    }

    if (typeof type.getDefaultProps === 'function' && !type.getDefaultProps.isReactClassApproved) {
      error('getDefaultProps is only used on classic React.createClass ' + 'definitions. Use a static property named `defaultProps` instead.');
    }
  }
}
/**
 * Given a fragment, validate that it can only be provided with fragment props
 * @param {ReactElement} fragment
 */


function validateFragmentProps(fragment) {
  {
    var keys = Object.keys(fragment.props);

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];

      if (key !== 'children' && key !== 'key') {
        setCurrentlyValidatingElement$1(fragment);

        error('Invalid prop `%s` supplied to `React.Fragment`. ' + 'React.Fragment can only have `key` and `children` props.', key);

        setCurrentlyValidatingElement$1(null);
        break;
      }
    }

    if (fragment.ref !== null) {
      setCurrentlyValidatingElement$1(fragment);

      error('Invalid attribute `ref` supplied to `React.Fragment`.');

      setCurrentlyValidatingElement$1(null);
    }
  }
}

function jsxWithValidation(type, props, key, isStaticChildren, source, self) {
  {
    var validType = isValidElementType(type); // We warn in this case but don't throw. We expect the element creation to
    // succeed and there will likely be errors in render.

    if (!validType) {
      var info = '';

      if (type === undefined || typeof type === 'object' && type !== null && Object.keys(type).length === 0) {
        info += ' You likely forgot to export your component from the file ' + "it's defined in, or you might have mixed up default and named imports.";
      }

      var sourceInfo = getSourceInfoErrorAddendum(source);

      if (sourceInfo) {
        info += sourceInfo;
      } else {
        info += getDeclarationErrorAddendum();
      }

      var typeString;

      if (type === null) {
        typeString = 'null';
      } else if (isArray(type)) {
        typeString = 'array';
      } else if (type !== undefined && type.$$typeof === REACT_ELEMENT_TYPE) {
        typeString = "<" + (getComponentNameFromType(type.type) || 'Unknown') + " />";
        info = ' Did you accidentally export a JSX literal instead of a component?';
      } else {
        typeString = typeof type;
      }

      error('React.jsx: type is invalid -- expected a string (for ' + 'built-in components) or a class/function (for composite ' + 'components) but got: %s.%s', typeString, info);
    }

    var element = jsxDEV(type, props, key, source, self); // The result can be nullish if a mock or a custom function is used.
    // TODO: Drop this when these are no longer allowed as the type argument.

    if (element == null) {
      return element;
    } // Skip key warning if the type isn't valid since our key validation logic
    // doesn't expect a non-string/function type and can throw confusing errors.
    // We don't want exception behavior to differ between dev and prod.
    // (Rendering will throw with a helpful message and as soon as the type is
    // fixed, the key warnings will appear.)


    if (validType) {
      var children = props.children;

      if (children !== undefined) {
        if (isStaticChildren) {
          if (isArray(children)) {
            for (var i = 0; i < children.length; i++) {
              validateChildKeys(children[i], type);
            }

            if (Object.freeze) {
              Object.freeze(children);
            }
          } else {
            error('React.jsx: Static children should always be an array. ' + 'You are likely explicitly calling React.jsxs or React.jsxDEV. ' + 'Use the Babel transform instead.');
          }
        } else {
          validateChildKeys(children, type);
        }
      }
    }

    if (type === REACT_FRAGMENT_TYPE) {
      validateFragmentProps(element);
    } else {
      validatePropTypes(element);
    }

    return element;
  }
} // These two functions exist to still get child warnings in dev
// even with the prod transform. This means that jsxDEV is purely
// opt-in behavior for better messages but that we won't stop
// giving you warnings if you use production apis.

function jsxWithValidationStatic(type, props, key) {
  {
    return jsxWithValidation(type, props, key, true);
  }
}
function jsxWithValidationDynamic(type, props, key) {
  {
    return jsxWithValidation(type, props, key, false);
  }
}

var jsx =  jsxWithValidationDynamic ; // we may want to special case jsxs internally to take advantage of static children.
// for now we can ship identical prod functions

var jsxs =  jsxWithValidationStatic ;

exports.Fragment = REACT_FRAGMENT_TYPE;
exports.jsx = jsx;
exports.jsxs = jsxs;
  })();
}


/***/ }),

/***/ "./node_modules/react/jsx-runtime.js":
/*!*******************************************!*\
  !*** ./node_modules/react/jsx-runtime.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {



if (false) {} else {
  module.exports = __webpack_require__(/*! ./cjs/react-jsx-runtime.development.js */ "./node_modules/react/cjs/react-jsx-runtime.development.js");
}


/***/ }),

/***/ "./src/helpers.ts":
/*!************************!*\
  !*** ./src/helpers.ts ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "createBoxShadow": () => (/* binding */ createBoxShadow),
/* harmony export */   "createOutline": () => (/* binding */ createOutline),
/* harmony export */   "createTransform": () => (/* binding */ createTransform),
/* harmony export */   "createTransformOrigin": () => (/* binding */ createTransformOrigin),
/* harmony export */   "toFontClass": () => (/* binding */ toFontClass)
/* harmony export */ });
function createBoxShadow({ offsetShadow, ringShadow, shadow, }) {
    let result = [];
    // Add all offset props
    if (offsetShadow) {
        if (offsetShadow.inset)
            result.push("inset");
        result.push("0 0 0");
        result.push(offsetShadow.width || 0);
        result.push(offsetShadow.color || "rgb(0, 0, 0)");
        result.push(",");
    }
    else {
        result.push(",");
    }
    // Add ring shadow
    if (ringShadow) {
        if (ringShadow.inset)
            result.push("inset");
        result.push("0 0 0");
        result.push(`calc(2px + ${ringShadow.width || 0})`);
        result.push(ringShadow.color || "rgb(0, 0, 0)");
        result.push(",");
    }
    else {
        result.push("0 0 #0000,");
    }
    if (shadow) {
        result.push("0 1px 2px 0 rgb(0 0 0/0.05)");
    }
    else {
        result.push("0 0 #0000");
    }
    return result.join(" ");
}
function createOutline({ style, color, width, spacing, contentWidth, }) {
    if (!width)
        return {};
    const smoothWidth = Math.round(parseInt(width) * 100) / 100;
    const desiredBorder = smoothWidth + Math.max(spacing || 0, 0);
    return {
        margin: `-${desiredBorder}px`,
        padding: `${spacing}px`,
        width: `calc(${contentWidth} + ${desiredBorder}px * 2)`,
        height: `calc(${contentWidth} + ${desiredBorder}px * 2)`,
        border: `${smoothWidth}px ${style || "solid"} ${color || "rgb(0, 0, 0)"}`,
    };
}
function createTransform({ positionX, positionY, rotation, scaleX, scaleY, }) {
    let result = [];
    if (positionX && positionX !== "0px")
        result.push(`translateX(${positionX})`);
    if (positionY && positionY !== "0px")
        result.push(`translateY(${positionY})`);
    if (rotation && rotation !== "0deg")
        result.push(`rotate(${rotation})`);
    if ((scaleX && scaleX !== 1) || (scaleY && scaleY !== 1)) {
        result.push(`scale(${scaleX || 1}, ${scaleY || 1})`);
    }
    return result.join(" ");
}
function createTransformOrigin({ x, y }) {
    if (!x && !y)
        return undefined;
    if (x === "50%" && y === "50%")
        return undefined;
    return `${x} ${y}`;
}
/**
 * Returns a converted Noodl Family Font to a CSS font family.
 *
 * @param family The file path of font family to convert.
 * @returns The CSS font family name.
 */
function toFontClass(family) {
    if (family && family.split(".").length > 1) {
        family = family.replace(/\.[^/.]+$/, "");
        family = family.split("/").pop();
    }
    return family;
}


/***/ }),

/***/ "./src/node-events.ts":
/*!****************************!*\
  !*** ./src/node-events.ts ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "pointerProps": () => (/* binding */ pointerProps)
/* harmony export */ });
const pointerEvents = [
    "onClick",
    "onMouseDown",
    "onMouseMove",
    "onMouseUp",
    "onMouseEnter",
    "onMouseLeave",
    "onMouseOver",
    "onMouseOut",
    "onTouchStart",
    "onTouchMove",
    "onTouchEnd",
    "onTouchCancel",
    "onPointerDown",
    "onPointerMove",
    "onPointerUp",
    "onPointerCancel",
];
//These should not be blocked, it causes some annoying behaviour when using hover
const pointerEventsNotToBlock = new Set(["onMouseLeave", "onMouseOut"]);
function pointerProps(props) {
    const newProps = {};
    for (const eventName of pointerEvents) {
        if (props.blockTouch && !pointerEventsNotToBlock.has(eventName)) {
            //Noodl stores pointer event callbacks in props.pointer
            if (props.pointer && props.pointer[eventName]) {
                newProps[eventName] = (e) => {
                    props.pointer[eventName](e);
                    e.stopPropagation();
                };
            }
            //some third party library might add pointer event callbacks as well, so look for callbacks directly on the props object
            else if (props[eventName]) {
                newProps[eventName] = (e) => {
                    props[eventName](e);
                    e.stopPropagation();
                };
            }
            else {
                //there was no existing listener, so create a new one that just blocks
                newProps[eventName] = (e) => {
                    e.stopPropagation();
                };
            }
        }
        //check if third party code added a listener
        else if (props[eventName]) {
            newProps[eventName] = props[eventName];
        }
        //check if Noodl added a listener
        else if (props.pointer) {
            newProps[eventName] = props.pointer[eventName];
        }
    }
    if (props.noodlNode) {
        for (const p in newProps) {
            const f = newProps[p];
            if (f) {
                newProps[p] = (e) => {
                    f.call(this, e);
                    props.noodlNode.context.updateDirtyNodes();
                };
            }
        }
    }
    return newProps;
}


/***/ }),

/***/ "./src/reactNodes/avatar.tsx":
/*!***********************************!*\
  !*** ./src/reactNodes/avatar.tsx ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "avatarNode": () => (/* binding */ avatarNode)
/* harmony export */ });
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-runtime */ "./node_modules/react/jsx-runtime.js");
/* harmony import */ var _noodl_noodl_sdk__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @noodl/noodl-sdk */ "../../noodl-sdk/build/dist/index.js");
/* harmony import */ var _noodl_noodl_sdk__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_noodl_noodl_sdk__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _helpers__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../helpers */ "./src/helpers.ts");
/* harmony import */ var _node_events__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../node-events */ "./src/node-events.ts");




const sizes = {
    xsmall: 20,
    small: 24,
    medium: 32,
    large: 40,
    xlarge: 96,
    xxlarge: 128,
};
function defaultAvatarSvg() {
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("svg", Object.assign({ width: "383", height: "384", viewBox: "0 0 383 384", fill: "none", xmlns: "http://www.w3.org/2000/svg" }, { children: [(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", { d: "M383 192.072C383 297.834 297.263 383.572 191.5 383.572C85.7375 383.572 0 297.834 0 192.072C0 86.309 85.7375 0.571533 191.5 0.571533C297.263 0.571533 383 86.309 383 192.072Z", fill: "#A9A9A9" }), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("mask", Object.assign({ id: "mask0_704_239", maskUnits: "userSpaceOnUse", x: "0", y: "0", width: "383", height: "384" }, { children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("circle", { cx: "191.5", cy: "192.072", r: "191.5", fill: "#E2E2E3" }) })), (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("g", Object.assign({ mask: "url(#mask0_704_239)" }, { children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", { d: "M244.134 243.251C260.038 230.676 271.098 213.093 275.463 193.441C279.829 173.79 277.237 153.259 268.12 135.282C259.003 117.304 243.914 102.968 225.373 94.6692C206.833 86.3706 185.965 84.6123 166.258 89.688C146.55 94.7637 129.196 106.366 117.096 122.556C104.996 138.746 98.8829 158.542 99.7785 178.637C100.674 198.732 108.524 217.909 122.017 232.961C135.509 248.013 153.827 258.03 173.908 261.337C156.996 272.05 143.208 286.941 133.911 304.533C124.613 322.126 120.129 341.809 120.903 361.632L121.273 371.036L201.216 420.015L352.163 361.945L351.793 352.541C350.659 324.403 339.041 297.68 319.169 277.508C299.298 257.335 272.574 245.135 244.134 243.251Z", fill: "white" }) }))] })));
}
function AvatarComponent({ children, appearance, size, sizeCustom, backgroundColor, outlineStyle, outlineColor, outlineWidth, outlineSpacing, src, text, textScale, textColor, textFontFamily, label, tooltip, allowFocus, tabindex, profilePositionX, profilePositionY, profileRotation, profileScale, profileOriginX, profileOriginY, profileGrayscale, style, outDesiredSize, onClick, onFocus, onBlur, onMouseEnter, onMouseLeave, }) {
    function calculateDesiredSize() {
        if (size === "custom" && sizeCustom) {
            const sizeCustomNumber = parseInt(sizeCustom);
            if (sizeCustomNumber) {
                return sizeCustomNumber + "px";
            }
        }
        return (sizes[size] || sizes.medium) + "px";
    }
    const desiredSize = calculateDesiredSize();
    outDesiredSize && outDesiredSize(parseInt(desiredSize));
    const rootStyle = Object.assign({ display: "block", width: desiredSize, height: desiredSize, flex: `0 0 ${desiredSize}` }, style);
    const outline = (0,_helpers__WEBPACK_IMPORTED_MODULE_2__.createOutline)({
        style: outlineStyle,
        width: outlineWidth,
        color: outlineColor,
        spacing: outlineSpacing,
        contentWidth: desiredSize,
    });
    const mainStyle = Object.assign({ display: "block", borderRadius: appearance === "circle" ? "50%" : "3px", overflow: "hidden", width: "100%", height: "100%", flex: "1 1 100%" }, outline);
    const innerStyle = {
        borderRadius: appearance === "circle" ? "50%" : "0px",
        overflow: "hidden",
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: backgroundColor || "transparent",
    };
    // default icon
    if (!src || !text) {
        innerStyle.backgroundColor = "#a9a9a9";
    }
    function content() {
        // Use image
        if (src) {
            const transform = (0,_helpers__WEBPACK_IMPORTED_MODULE_2__.createTransform)({
                positionX: profilePositionX,
                positionY: profilePositionY,
                rotation: profileRotation,
                scaleX: profileScale,
                scaleY: profileScale,
            });
            const transformOrigin = (0,_helpers__WEBPACK_IMPORTED_MODULE_2__.createTransformOrigin)({
                x: profileOriginX,
                y: profileOriginY,
            });
            const filter = profileGrayscale !== "0%" ? `grayscale(${profileGrayscale})` : "";
            return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("img", { style: {
                    width: "100%",
                    height: "100%",
                    transform,
                    transformOrigin,
                    filter,
                }, src: src, alt: "avatar" }));
        }
        // Use text
        if (text) {
            const fontSize = parseInt(desiredSize) * (textScale || 0.5);
            return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", Object.assign({ style: {
                    fontSize: fontSize + "px",
                    color: textColor,
                    fontFamily: (0,_helpers__WEBPACK_IMPORTED_MODULE_2__.toFontClass)(textFontFamily),
                } }, { children: text })));
        }
        // Use fallback icon
        return defaultAvatarSvg();
    }
    // Append extra attributes
    const appendAttributes = {};
    if (allowFocus) {
        appendAttributes.tabIndex = tabindex;
    }
    return ((0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", Object.assign({ className: "avatar", style: rootStyle }, { children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", Object.assign({ style: mainStyle, title: tooltip, "aria-label": label }, (0,_node_events__WEBPACK_IMPORTED_MODULE_3__.pointerProps)({
            onMouseEnter,
            onMouseLeave,
            onClick,
        }), { onFocus: function (evt) {
                evt.stopPropagation();
                onFocus && onFocus();
            }, onBlur: function (evt) {
                evt.stopPropagation();
                onBlur && onBlur();
            } }, appendAttributes, { children: (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("span", Object.assign({ style: innerStyle }, { children: Boolean(children) ? children : content() })) })) })));
}
const avatarNode = _noodl_noodl_sdk__WEBPACK_IMPORTED_MODULE_1__.defineReactNode({
    name: "Avatar",
    getReactComponent() {
        return AvatarComponent;
    },
    visualStates: [
        { name: "neutral", label: "Neutral" },
        { name: "hover", label: "Hover" },
    ],
    dynamicports: [
        {
            condition: "size = custom",
            inputs: ["sizeCustom"],
        },
    ],
    inputProps: {
        appearance: {
            displayName: "Appearance",
            group: "Avatar",
            type: {
                name: "enum",
                enums: [
                    { label: "Circle", value: "circle" },
                    { label: "Square", value: "square" },
                ],
            },
            default: "circle",
            tooltip: {
                standard: "The appearance shape of the avatar.",
            },
            allowVisualStates: true,
        },
        size: {
            displayName: "Size",
            group: "Avatar",
            type: {
                name: "enum",
                enums: [
                    { label: "X-Small", value: "xsmall" },
                    { label: "Small", value: "small" },
                    { label: "Medium", value: "medium" },
                    { label: "Large", value: "large" },
                    { label: "X-Large", value: "xlarge" },
                    { label: "XX-Large", value: "xxlarge" },
                    { label: "Custom", value: "custom" },
                ],
            },
            default: "medium",
        },
        sizeCustom: {
            displayName: "Custom Size",
            group: "Avatar",
            type: {
                name: "number",
                units: ["%", "px", "vw", "vh"],
                defaultUnit: "px",
            },
            tooltip: {
                standard: "The custom size of the avatar. Only used if size is set to custom.",
            },
        },
        backgroundColor: {
            displayName: "Background Color",
            group: "Avatar",
            type: "color",
            tooltip: {
                standard: "The color of the background.",
            },
            default: "transparent",
            allowVisualStates: true,
        },
        src: {
            displayName: "Image Source",
            group: "Avatar Profile",
            type: "image",
            tooltip: {
                standard: "The source of the image.",
            },
            allowVisualStates: true,
        },
        textFontFamily: {
            displayName: "Text Font Family",
            group: "Avatar Text",
            type: "font",
            tooltip: {
                standard: "The font family of the text.",
            },
            default: "Arial",
        },
        textColor: {
            group: "Avatar Text",
            displayName: "Color",
            type: "color",
            tooltip: {
                standard: "The color of the text.",
            },
            default: "#000000",
        },
        text: {
            group: "Avatar Text",
            displayName: "Text",
            type: "string",
            tooltip: {
                standard: "The text that shall be inside the avatar.",
            },
        },
        textScale: {
            group: "Avatar Text",
            displayName: "Text Scale",
            type: "number",
            tooltip: {
                standard: "The scale of the text.",
            },
            default: 0.5,
            allowVisualStates: true,
        },
        profilePositionX: {
            displayName: "Position X",
            group: "Avatar Profile",
            type: {
                name: "number",
                units: ["%", "px", "vw", "vh"],
                defaultUnit: "px",
            },
            default: 0,
            allowVisualStates: true,
        },
        profilePositionY: {
            displayName: "Position Y",
            group: "Avatar Profile",
            type: {
                name: "number",
                units: ["%", "px", "vw", "vh"],
                defaultUnit: "px",
            },
            default: 0,
            allowVisualStates: true,
        },
        profileRotation: {
            displayName: "Rotation",
            group: "Avatar Profile",
            type: {
                name: "number",
                units: ["deg"],
                defaultUnit: "deg",
            },
            default: 0,
            allowVisualStates: true,
        },
        profileScale: {
            displayName: "Scale",
            group: "Avatar Profile",
            type: {
                name: "number",
            },
            default: 1,
            allowVisualStates: true,
        },
        profileOriginX: {
            displayName: "Transform Origin X",
            group: "Avatar Profile",
            type: {
                name: "number",
                units: ["%", "px", "vw", "vh"],
                defaultUnit: "%",
            },
            default: 50,
            allowVisualStates: true,
        },
        profileOriginY: {
            displayName: "Transform Origin X",
            group: "Avatar Profile",
            type: {
                name: "number",
                units: ["%", "px", "vw", "vh"],
                defaultUnit: "%",
            },
            default: 50,
            allowVisualStates: true,
        },
        profileGrayscale: {
            displayName: "Grayscale",
            group: "Avatar Profile",
            type: {
                name: "number",
                units: ["%"],
                defaultUnit: "%",
            },
            tooltip: {
                standard: "Whether the profile should be grayscaled.",
            },
            default: 0,
            allowVisualStates: true,
        },
        outlineStyle: {
            displayName: "Outline Style",
            group: "Outline",
            type: {
                name: "enum",
                enums: [
                    {
                        label: "Solid",
                        value: "solid",
                    },
                    {
                        label: "Dashed",
                        value: "dashed",
                    },
                    {
                        label: "Dotted",
                        value: "dotted",
                    },
                    {
                        label: "Double",
                        value: "double",
                    },
                    {
                        label: "Groove",
                        value: "groove",
                    },
                    {
                        label: "Ridge",
                        value: "ridge",
                    },
                    {
                        label: "Inset",
                        value: "inset",
                    },
                    {
                        label: "Outset",
                        value: "outset",
                    },
                ],
            },
            default: "solid",
            tooltip: {
                standard: "The style of the Outline.",
            },
            allowVisualStates: true,
        },
        outlineColor: {
            displayName: "Outline Color",
            group: "Outline",
            type: "color",
            default: "#fff",
            tooltip: {
                standard: "The color of the Outline.",
            },
            allowVisualStates: true,
        },
        outlineWidth: {
            displayName: "Outline Width",
            group: "Outline",
            type: {
                name: "number",
                units: ["%", "px", "vw", "vh"],
                defaultUnit: "px",
            },
            tooltip: {
                standard: "The width of the Outline.",
            },
            allowVisualStates: true,
        },
        outlineSpacing: {
            displayName: "Outline Spacing",
            group: "Outline",
            type: {
                name: "number",
            },
            tooltip: {
                standard: "The space between the avatar and the Outline.",
            },
            default: 0,
        },
        label: {
            group: "Accessibility",
            displayName: "Label",
            type: "string",
            tooltip: {
                standard: "Provide better content to screen readers.",
            },
        },
        tooltip: {
            group: "Accessibility",
            displayName: "Tooltip",
            type: "string",
            tooltip: {
                standard: "Will be displayed as tooltip.",
            },
        },
        allowFocus: {
            displayName: "Allow Focus",
            group: "Accessibility",
            type: "boolean",
            tooltip: {
                standard: "Enable focus on the element.",
            },
            default: true,
        },
        tabindex: {
            group: "Accessibility",
            displayName: "Tab Index",
            type: "number",
            tooltip: {
                standard: "The tab index of the component.",
            },
            default: 0,
        },
    },
    outputProps: {
        outDesiredSize: {
            displayName: "Size",
            type: "number",
            group: "Avatar",
        },
        onClick: {
            displayName: "On Click",
            type: "signal",
            group: "Events",
        },
        onFocus: {
            displayName: "Focused",
            type: "signal",
            group: "Focus",
        },
        onBlur: {
            displayName: "Focus Lost",
            type: "signal",
            group: "Focus",
        },
        onMouseEnter: {
            displayName: "Hover Start",
            type: "signal",
            group: "Hover Events",
            // @ts-expect-error
            props: {
                onMouseEnter() {
                    this.setVisualStates(["hover"]);
                    this.sendSignalOnOutput("onMouseEnter");
                },
            },
        },
        onMouseLeave: {
            displayName: "Hover End",
            type: "signal",
            group: "Hover Events",
            // @ts-expect-error
            props: {
                onMouseLeave() {
                    this.setVisualStates([]);
                    this.sendSignalOnOutput("onMouseLeave");
                },
            },
        },
    },
    inputCss: {
        marginLeft: {
            index: 1,
            group: "Margin and padding",
            displayName: "Margin Left",
            type: {
                name: "number",
                units: ["px", "%"],
                defaultUnit: "px",
                marginPaddingComp: "margin-left",
            },
        },
        marginRight: {
            index: 2,
            group: "Margin and padding",
            displayName: "Margin Right",
            type: {
                name: "number",
                units: ["px", "%"],
                defaultUnit: "px",
                marginPaddingComp: "margin-right",
            },
            allowVisualStates: true,
        },
        marginTop: {
            index: 3,
            group: "Margin and padding",
            displayName: "Margin Top",
            type: {
                name: "number",
                units: ["px", "%"],
                defaultUnit: "px",
                marginPaddingComp: "margin-top",
            },
            allowVisualStates: true,
        },
        marginBottom: {
            index: 4,
            group: "Margin and padding",
            displayName: "Margin Bottom",
            type: {
                name: "number",
                units: ["px", "%"],
                defaultUnit: "px",
                marginPaddingComp: "margin-bottom",
            },
            allowVisualStates: true,
        },
    },
});


/***/ }),

/***/ "react":
/*!************************!*\
  !*** external "React" ***!
  \************************/
/***/ ((module) => {

module.exports = React;

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _noodl_noodl_sdk__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @noodl/noodl-sdk */ "../../noodl-sdk/build/dist/index.js");
/* harmony import */ var _noodl_noodl_sdk__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_noodl_noodl_sdk__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _reactNodes_avatar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./reactNodes/avatar */ "./src/reactNodes/avatar.tsx");


// module
_noodl_noodl_sdk__WEBPACK_IMPORTED_MODULE_0__.defineModule({
    reactNodes: [_reactNodes_avatar__WEBPACK_IMPORTED_MODULE_1__.avatarNode],
    nodes: [],
    settings: [],
    setup() { },
});

})();

/******/ })()
;
//# sourceMappingURL=index.js.map