/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./src/index.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./node_modules/@noodl/noodl-sdk/index.js":
/*!************************************************!*\
  !*** ./node_modules/@noodl/noodl-sdk/index.js ***!
  \************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var _colors = {
  "purple": "component",
  "green": "data",
  "default": "default",
  "grey": "default"
};

Noodl.defineNode = function (def) {
  var _def = {};
  _def.name = def.name;
  _def.displayNodeName = def.displayName;
  _def.usePortAsLabel = def.useInputAsLabel;
  _def.color = _colors[def.color || 'default'];
  _def.category = def.category || 'Modules';
  _def.getInspectInfo = def.getInspectInfo;
  _def.docs = def.docs;

  _def.initialize = function () {
    this.inputs = {};

    var _outputs = this.outputs = {};

    var _this = this; // Function for quickly setting outputs


    this.setOutputs = function (o) {
      for (var key in o) {
        _outputs[key] = o[key];

        _this.flagOutputDirty(key);
      }
    }; // Sending warnings


    this.clearWarnings = function () {
      if (this.context.editorConnection && this.nodeScope && this.nodeScope.componentOwner) this.context.editorConnection.clearWarnings(this.nodeScope.componentOwner.name, this.id);
    }.bind(this);

    this.sendWarning = function (name, message) {
      if (this.context.editorConnection && this.nodeScope && this.nodeScope.componentOwner) this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, name, {
        message: message
      });
    }.bind(this);

    if (typeof def.initialize === 'function') def.initialize.apply(this);
  };

  _def.inputs = {};
  _def.outputs = {};

  for (var key in def.inputs) {
    _def.inputs[key] = {
      type: _typeof(def.inputs[key]) === 'object' ? def.inputs[key].type : def.inputs[key],
      displayName: _typeof(def.inputs[key]) === 'object' ? def.inputs[key].displayName : undefined,
      group: _typeof(def.inputs[key]) === 'object' ? def.inputs[key].group : undefined,
      "default": _typeof(def.inputs[key]) === 'object' ? def.inputs[key]["default"] : undefined,
      set: function () {
        var _key = key;
        return function (value) {
          this.inputs[_key] = value;

          if (def.changed && typeof def.changed[_key] === 'function') {
            def.changed[_key].apply(this, [value]);
          }
        };
      }()
    };
  }

  for (var key in def.signals) {
    _def.inputs[key] = {
      type: 'signal',
      displayName: _typeof(def.signals[key]) === 'object' ? def.signals[key].displayName : undefined,
      group: _typeof(def.signals[key]) === 'object' ? def.signals[key].group : undefined,
      valueChangedToTrue: function () {
        var _key = key;
        return function () {
          var _this2 = this;

          var _fn = _typeof(def.signals[_key]) === 'object' ? def.signals[_key].signal : def.signals[_key];

          if (typeof _fn === 'function') {
            this.scheduleAfterInputsHaveUpdated(function () {
              _fn.apply(_this2);
            });
          }
        };
      }()
    };
  }

  for (var key in def.outputs) {
    if (def.outputs[key] === 'signal') {
      _def.outputs[key] = {
        type: 'signal'
      };
    } else {
      _def.outputs[key] = {
        type: _typeof(def.outputs[key]) === 'object' ? def.outputs[key].type : def.outputs[key],
        displayName: _typeof(def.outputs[key]) === 'object' ? def.outputs[key].displayName : undefined,
        group: _typeof(def.outputs[key]) === 'object' ? def.outputs[key].group : undefined,
        getter: function () {
          var _key = key;
          return function () {
            return this.outputs[_key];
          };
        }()
      };
    }
  }

  _def.methods = _def.prototypeExtensions = {};

  for (var key in def.methods) {
    _def.prototypeExtensions[key] = def.methods[key];
  }

  if (_def.methods.onNodeDeleted) {
    // Override the onNodeDeleted if required
    _def.methods._onNodeDeleted = function () {
      this.__proto__.__proto__._onNodeDeleted.call(this);

      _def.methods.onNodeDeleted.value.call(this);
    };
  }

  return {
    node: _def,
    setup: def.setup
  };
};

Noodl.defineCollectionNode = function (def) {
  var _def = {
    name: def.name,
    category: def.category,
    color: 'data',
    inputs: def.inputs,
    outputs: Object.assign({
      Items: 'array',
      'Fetch Started': 'signal',
      'Fetch Completed': 'signal'
    }, def.outputs || {}),
    signals: Object.assign({
      Fetch: function Fetch() {
        var _this = this;

        this.sendSignalOnOutput('Fetch Started');
        var a = def.fetch.call(this, function () {
          _this.sendSignalOnOutput('Fetch Completed');
        });
        this.setOutputs({
          Items: a
        });
      }
    }, def.signals || {})
  };
  return Noodl.defineNode(_def);
};

Noodl.defineModelNode = function (def) {
  var _def = {
    name: def.name,
    category: def.category,
    color: 'data',
    inputs: {
      Id: 'string'
    },
    outputs: {
      Fetched: 'signal'
    },
    changed: {
      Id: function Id(value) {
        var _this3 = this;

        if (this._object && this._changeListener) this._object.off('change', this._changeListener);
        this._object = Noodl.Object.get(value);

        this._changeListener = function (name, value) {
          var _o = {};
          _o[name] = value;

          _this3.setOutputs(_o);
        };

        this._object.on('change', this._changeListener);

        this.setOutputs(this._object.data);
        this.sendSignalOnOutput('Fetched');
      }
    },
    initialize: function initialize() {}
  };

  for (var key in def.properties) {
    _def.inputs[key] = def.properties[key];
    _def.outputs[key] = def.properties[key];

    _def.changed[key] = function () {
      var _key = key;
      return function (value) {
        if (!this._object) return;

        this._object.set(_key, value);
      };
    }();
  }

  return Noodl.defineNode(_def);
};

Noodl.defineReactNode = function (def) {
  var _def = Noodl.defineNode(def);

  _def.node.getReactComponent = def.getReactComponent;
  _def.node.inputProps = def.inputProps;
  _def.node.inputCss = def.inputCss;
  _def.node.outputProps = def.outputProps;
  _def.node.setup = def.setup;
  _def.node.frame = def.frame;
  return _def.node;
};

module.exports = Noodl;

/***/ }),

/***/ "./node_modules/bail/index.js":
/*!************************************!*\
  !*** ./node_modules/bail/index.js ***!
  \************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = bail;

function bail(err) {
  if (err) {
    throw err;
  }
}

/***/ }),

/***/ "./node_modules/extend/index.js":
/*!**************************************!*\
  !*** ./node_modules/extend/index.js ***!
  \**************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var hasOwn = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;
var defineProperty = Object.defineProperty;
var gOPD = Object.getOwnPropertyDescriptor;

var isArray = function isArray(arr) {
  if (typeof Array.isArray === 'function') {
    return Array.isArray(arr);
  }

  return toStr.call(arr) === '[object Array]';
};

var isPlainObject = function isPlainObject(obj) {
  if (!obj || toStr.call(obj) !== '[object Object]') {
    return false;
  }

  var hasOwnConstructor = hasOwn.call(obj, 'constructor');
  var hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf'); // Not own constructor property must be Object

  if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
    return false;
  } // Own properties are enumerated firstly, so to speed up,
  // if last one is own, then all properties are own.


  var key;

  for (key in obj) {
    /**/
  }

  return typeof key === 'undefined' || hasOwn.call(obj, key);
}; // If name is '__proto__', and Object.defineProperty is available, define __proto__ as an own property on target


var setProperty = function setProperty(target, options) {
  if (defineProperty && options.name === '__proto__') {
    defineProperty(target, options.name, {
      enumerable: true,
      configurable: true,
      value: options.newValue,
      writable: true
    });
  } else {
    target[options.name] = options.newValue;
  }
}; // Return undefined instead of __proto__ if '__proto__' is not an own property


var getProperty = function getProperty(obj, name) {
  if (name === '__proto__') {
    if (!hasOwn.call(obj, name)) {
      return void 0;
    } else if (gOPD) {
      // In early versions of node, obj['__proto__'] is buggy when obj has
      // __proto__ as an own property. Object.getOwnPropertyDescriptor() works.
      return gOPD(obj, name).value;
    }
  }

  return obj[name];
};

module.exports = function extend() {
  var options, name, src, copy, copyIsArray, clone;
  var target = arguments[0];
  var i = 1;
  var length = arguments.length;
  var deep = false; // Handle a deep copy situation

  if (typeof target === 'boolean') {
    deep = target;
    target = arguments[1] || {}; // skip the boolean and the target

    i = 2;
  }

  if (target == null || _typeof(target) !== 'object' && typeof target !== 'function') {
    target = {};
  }

  for (; i < length; ++i) {
    options = arguments[i]; // Only deal with non-null/undefined values

    if (options != null) {
      // Extend the base object
      for (name in options) {
        src = getProperty(target, name);
        copy = getProperty(options, name); // Prevent never-ending loop

        if (target !== copy) {
          // Recurse if we're merging plain objects or arrays
          if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
            if (copyIsArray) {
              copyIsArray = false;
              clone = src && isArray(src) ? src : [];
            } else {
              clone = src && isPlainObject(src) ? src : {};
            } // Never move original objects, clone them


            setProperty(target, {
              name: name,
              newValue: extend(deep, clone, copy)
            }); // Don't bring in undefined values
          } else if (typeof copy !== 'undefined') {
            setProperty(target, {
              name: name,
              newValue: copy
            });
          }
        }
      }
    }
  } // Return the modified object


  return target;
};

/***/ }),

/***/ "./node_modules/is-plain-obj/index.js":
/*!********************************************!*\
  !*** ./node_modules/is-plain-obj/index.js ***!
  \********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = function (value) {
  if (Object.prototype.toString.call(value) !== '[object Object]') {
    return false;
  }

  var prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
};

/***/ }),

/***/ "./node_modules/mdast-add-list-metadata/index.js":
/*!*******************************************************!*\
  !*** ./node_modules/mdast-add-list-metadata/index.js ***!
  \*******************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var visitWithParents = __webpack_require__(/*! unist-util-visit-parents */ "./node_modules/unist-util-visit-parents/index.js");

function addListMetadata() {
  return function (ast) {
    visitWithParents(ast, 'list', function (listNode, parents) {
      var depth = 0,
          i,
          n;

      for (i = 0, n = parents.length; i < n; i++) {
        if (parents[i].type === 'list') depth += 1;
      }

      for (i = 0, n = listNode.children.length; i < n; i++) {
        var child = listNode.children[i];
        child.index = i;
        child.ordered = listNode.ordered;
      }

      listNode.depth = depth;
    });
    return ast;
  };
}

module.exports = addListMetadata;

/***/ }),

/***/ "./node_modules/mdast-util-from-markdown/dist/index.js":
/*!*************************************************************!*\
  !*** ./node_modules/mdast-util-from-markdown/dist/index.js ***!
  \*************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = fromMarkdown; // These three are compiled away in the `dist/`

var decode = __webpack_require__(/*! parse-entities/decode-entity */ "./node_modules/parse-entities/decode-entity.browser.js");

var toString = __webpack_require__(/*! mdast-util-to-string */ "./node_modules/mdast-util-to-string/index.js");

var own = __webpack_require__(/*! micromark/dist/constant/has-own-property */ "./node_modules/micromark/dist/constant/has-own-property.js");

var normalizeIdentifier = __webpack_require__(/*! micromark/dist/util/normalize-identifier */ "./node_modules/micromark/dist/util/normalize-identifier.js");

var safeFromInt = __webpack_require__(/*! micromark/dist/util/safe-from-int */ "./node_modules/micromark/dist/util/safe-from-int.js");

var parser = __webpack_require__(/*! micromark/dist/parse */ "./node_modules/micromark/dist/parse.js");

var preprocessor = __webpack_require__(/*! micromark/dist/preprocess */ "./node_modules/micromark/dist/preprocess.js");

var postprocess = __webpack_require__(/*! micromark/dist/postprocess */ "./node_modules/micromark/dist/postprocess.js");

function fromMarkdown(value, encoding, options) {
  if (typeof encoding !== 'string') {
    options = encoding;
    encoding = undefined;
  }

  return compiler(options)(postprocess(parser(options).document().write(preprocessor()(value, encoding, true))));
} // Note this compiler only understand complete buffering, not streaming.


function compiler(options) {
  var settings = options || {};
  var config = configure({
    canContainEols: ['emphasis', 'fragment', 'heading', 'paragraph', 'strong'],
    enter: {
      autolink: opener(link),
      autolinkProtocol: onenterdata,
      autolinkEmail: onenterdata,
      atxHeading: opener(heading),
      blockQuote: opener(blockQuote),
      characterEscape: onenterdata,
      characterReference: onenterdata,
      codeFenced: opener(codeFlow),
      codeFencedFenceInfo: buffer,
      codeFencedFenceMeta: buffer,
      codeIndented: opener(codeFlow, buffer),
      codeText: opener(codeText, buffer),
      codeTextData: onenterdata,
      data: onenterdata,
      codeFlowValue: onenterdata,
      definition: opener(definition),
      definitionDestinationString: buffer,
      definitionLabelString: buffer,
      definitionTitleString: buffer,
      emphasis: opener(emphasis),
      hardBreakEscape: opener(hardBreak),
      hardBreakTrailing: opener(hardBreak),
      htmlFlow: opener(html, buffer),
      htmlFlowData: onenterdata,
      htmlText: opener(html, buffer),
      htmlTextData: onenterdata,
      image: opener(image),
      label: buffer,
      link: opener(link),
      listItem: opener(listItem),
      listItemValue: onenterlistitemvalue,
      listOrdered: opener(list, onenterlistordered),
      listUnordered: opener(list),
      paragraph: opener(paragraph),
      reference: onenterreference,
      referenceString: buffer,
      resourceDestinationString: buffer,
      resourceTitleString: buffer,
      setextHeading: opener(heading),
      strong: opener(strong),
      thematicBreak: opener(thematicBreak)
    },
    exit: {
      atxHeading: closer(),
      atxHeadingSequence: onexitatxheadingsequence,
      autolink: closer(),
      autolinkEmail: onexitautolinkemail,
      autolinkProtocol: onexitautolinkprotocol,
      blockQuote: closer(),
      characterEscapeValue: onexitdata,
      characterReferenceMarkerHexadecimal: onexitcharacterreferencemarker,
      characterReferenceMarkerNumeric: onexitcharacterreferencemarker,
      characterReferenceValue: closer(onexitcharacterreferencevalue),
      codeFenced: closer(onexitcodefenced),
      codeFencedFence: onexitcodefencedfence,
      codeFencedFenceInfo: onexitcodefencedfenceinfo,
      codeFencedFenceMeta: onexitcodefencedfencemeta,
      codeFlowValue: onexitdata,
      codeIndented: closer(onexitcodeindented),
      codeText: closer(onexitcodetext),
      codeTextData: onexitdata,
      data: onexitdata,
      definition: closer(),
      definitionDestinationString: onexitdefinitiondestinationstring,
      definitionLabelString: onexitdefinitionlabelstring,
      definitionTitleString: onexitdefinitiontitlestring,
      emphasis: closer(),
      hardBreakEscape: closer(onexithardbreak),
      hardBreakTrailing: closer(onexithardbreak),
      htmlFlow: closer(onexithtmlflow),
      htmlFlowData: onexitdata,
      htmlText: closer(onexithtmltext),
      htmlTextData: onexitdata,
      image: closer(onexitimage),
      label: onexitlabel,
      labelText: onexitlabeltext,
      lineEnding: onexitlineending,
      link: closer(onexitlink),
      listItem: closer(),
      listOrdered: closer(),
      listUnordered: closer(),
      paragraph: closer(),
      referenceString: onexitreferencestring,
      resourceDestinationString: onexitresourcedestinationstring,
      resourceTitleString: onexitresourcetitlestring,
      resource: onexitresource,
      setextHeading: closer(onexitsetextheading),
      setextHeadingLineSequence: onexitsetextheadinglinesequence,
      setextHeadingText: onexitsetextheadingtext,
      strong: closer(),
      thematicBreak: closer()
    }
  }, settings.mdastExtensions || []);
  var data = {};
  return compile;

  function compile(events) {
    var stack = [{
      type: 'root',
      children: []
    }];
    var index = -1;
    var listStack = [];
    var length;
    var handler;
    var listStart;
    var event;

    while (++index < events.length) {
      event = events[index]; // We preprocess lists to add `listItem` tokens, and to infer whether
      // items the list itself are spread out.

      if (event[1].type === 'listOrdered' || event[1].type === 'listUnordered') {
        if (event[0] === 'enter') {
          listStack.push(index);
        } else {
          listStart = listStack.pop(index);
          index = prepareList(events, listStart, index);
        }
      }
    }

    index = -1;
    length = events.length;

    while (++index < length) {
      handler = config[events[index][0]];

      if (own.call(handler, events[index][1].type)) {
        handler[events[index][1].type].call({
          stack: stack,
          config: config,
          enter: enter,
          exit: exit,
          buffer: buffer,
          resume: resume,
          sliceSerialize: events[index][2].sliceSerialize,
          setData: setData,
          getData: getData
        }, events[index][1]);
      }
    } // Figure out `root` position.


    stack[0].position = {
      start: point(length ? events[0][1].start : {
        line: 1,
        column: 1,
        offset: 0
      }),
      end: point(length ? events[events.length - 2][1].end : {
        line: 1,
        column: 1,
        offset: 0
      })
    };
    return stack[0];
  }

  function prepareList(events, start, length) {
    var index = start - 1;
    var containerBalance = -1;
    var listSpread = false;
    var listItem;
    var tailIndex;
    var lineIndex;
    var tailEvent;
    var event;
    var firstBlankLineIndex;
    var atMarker;

    while (++index <= length) {
      event = events[index];

      if (event[1].type === 'listUnordered' || event[1].type === 'listOrdered' || event[1].type === 'blockQuote') {
        if (event[0] === 'enter') {
          containerBalance++;
        } else {
          containerBalance--;
        }

        atMarker = undefined;
      } else if (event[1].type === 'lineEndingBlank') {
        if (event[0] === 'enter') {
          if (listItem && !atMarker && !containerBalance && !firstBlankLineIndex) {
            firstBlankLineIndex = index;
          }

          atMarker = undefined;
        }
      } else if (event[1].type === 'linePrefix' || event[1].type === 'listItemValue' || event[1].type === 'listItemMarker' || event[1].type === 'listItemPrefix' || event[1].type === 'listItemPrefixWhitespace') {// Empty.
      } else {
        atMarker = undefined;
      }

      if (!containerBalance && event[0] === 'enter' && event[1].type === 'listItemPrefix' || containerBalance === -1 && event[0] === 'exit' && (event[1].type === 'listUnordered' || event[1].type === 'listOrdered')) {
        if (listItem) {
          tailIndex = index;
          lineIndex = undefined;

          while (tailIndex--) {
            tailEvent = events[tailIndex];

            if (tailEvent[1].type === 'lineEnding' || tailEvent[1].type === 'lineEndingBlank') {
              if (tailEvent[0] === 'exit') continue;

              if (lineIndex) {
                events[lineIndex][1].type = 'lineEndingBlank';
                listSpread = true;
              }

              tailEvent[1].type = 'lineEnding';
              lineIndex = tailIndex;
            } else if (tailEvent[1].type === 'linePrefix' || tailEvent[1].type === 'blockQuotePrefix' || tailEvent[1].type === 'blockQuotePrefixWhitespace' || tailEvent[1].type === 'blockQuoteMarker' || tailEvent[1].type === 'listItemIndent') {// Empty
            } else {
              break;
            }
          }

          if (firstBlankLineIndex && (!lineIndex || firstBlankLineIndex < lineIndex)) {
            listItem._spread = true;
          } // Fix position.


          listItem.end = point(lineIndex ? events[lineIndex][1].start : event[1].end);
          events.splice(lineIndex || index, 0, ['exit', listItem, event[2]]);
          index++;
          length++;
        } // Create a new list item.


        if (event[1].type === 'listItemPrefix') {
          listItem = {
            type: 'listItem',
            _spread: false,
            start: point(event[1].start)
          };
          events.splice(index, 0, ['enter', listItem, event[2]]);
          index++;
          length++;
          firstBlankLineIndex = undefined;
          atMarker = true;
        }
      }
    }

    events[start][1]._spread = listSpread;
    return length;
  }

  function setData(key, value) {
    data[key] = value;
  }

  function getData(key) {
    return data[key];
  }

  function point(d) {
    return {
      line: d.line,
      column: d.column,
      offset: d.offset
    };
  }

  function opener(create, and) {
    return open;

    function open(token) {
      enter.call(this, create(token), token);
      if (and) and.call(this, token);
    }
  }

  function buffer() {
    this.stack.push({
      type: 'fragment',
      children: []
    });
  }

  function enter(node, token) {
    this.stack[this.stack.length - 1].children.push(node);
    this.stack.push(node);
    node.position = {
      start: point(token.start)
    };
    return node;
  }

  function closer(and) {
    return close;

    function close(token) {
      if (and) and.call(this, token);
      exit.call(this, token);
    }
  }

  function exit(token) {
    var node = this.stack.pop();
    node.position.end = point(token.end);
    return node;
  }

  function resume() {
    var value = toString(this.stack.pop());
    return value;
  } //
  // Handlers.
  //


  function onenterlistordered() {
    setData('expectingFirstListItemValue', true);
  }

  function onenterlistitemvalue(token) {
    if (getData('expectingFirstListItemValue')) {
      this.stack[this.stack.length - 2].start = parseInt(this.sliceSerialize(token), 10);
      setData('expectingFirstListItemValue');
    }
  }

  function onexitcodefencedfenceinfo() {
    var data = this.resume();
    this.stack[this.stack.length - 1].lang = data;
  }

  function onexitcodefencedfencemeta() {
    var data = this.resume();
    this.stack[this.stack.length - 1].meta = data;
  }

  function onexitcodefencedfence() {
    // Exit if this is the closing fence.
    if (getData('flowCodeInside')) return;
    this.buffer();
    setData('flowCodeInside', true);
  }

  function onexitcodefenced() {
    var data = this.resume();
    this.stack[this.stack.length - 1].value = data.replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, '');
    setData('flowCodeInside');
  }

  function onexitcodeindented() {
    var data = this.resume();
    this.stack[this.stack.length - 1].value = data;
  }

  function onexitdefinitionlabelstring(token) {
    // Discard label, use the source content instead.
    var label = this.resume();
    this.stack[this.stack.length - 1].label = label;
    this.stack[this.stack.length - 1].identifier = normalizeIdentifier(this.sliceSerialize(token)).toLowerCase();
  }

  function onexitdefinitiontitlestring() {
    var data = this.resume();
    this.stack[this.stack.length - 1].title = data;
  }

  function onexitdefinitiondestinationstring() {
    var data = this.resume();
    this.stack[this.stack.length - 1].url = data;
  }

  function onexitatxheadingsequence(token) {
    if (!this.stack[this.stack.length - 1].depth) {
      this.stack[this.stack.length - 1].depth = this.sliceSerialize(token).length;
    }
  }

  function onexitsetextheadingtext() {
    setData('setextHeadingSlurpLineEnding', true);
  }

  function onexitsetextheadinglinesequence(token) {
    this.stack[this.stack.length - 1].depth = this.sliceSerialize(token).charCodeAt(0) === 61 ? 1 : 2;
  }

  function onexitsetextheading() {
    setData('setextHeadingSlurpLineEnding');
  }

  function onenterdata(token) {
    var siblings = this.stack[this.stack.length - 1].children;
    var tail = siblings[siblings.length - 1];

    if (!tail || tail.type !== 'text') {
      // Add a new text node.
      tail = text();
      tail.position = {
        start: point(token.start)
      };
      this.stack[this.stack.length - 1].children.push(tail);
    }

    this.stack.push(tail);
  }

  function onexitdata(token) {
    var tail = this.stack.pop();
    tail.value += this.sliceSerialize(token);
    tail.position.end = point(token.end);
  }

  function onexitlineending(token) {
    var context = this.stack[this.stack.length - 1]; // If we’re at a hard break, include the line ending in there.

    if (getData('atHardBreak')) {
      context.children[context.children.length - 1].position.end = point(token.end);
      setData('atHardBreak');
      return;
    }

    if (getData('setextHeadingSlurpLineEnding')) {
      return;
    }

    if (config.canContainEols.indexOf(context.type) !== -1) {
      onenterdata.call(this, token);
      onexitdata.call(this, token);
    }
  }

  function onexithardbreak() {
    setData('atHardBreak', true);
  }

  function onexithtmlflow() {
    var data = this.resume();
    this.stack[this.stack.length - 1].value = data;
  }

  function onexithtmltext() {
    var data = this.resume();
    this.stack[this.stack.length - 1].value = data;
  }

  function onexitcodetext() {
    var data = this.resume();
    this.stack[this.stack.length - 1].value = data;
  }

  function onexitlink() {
    var context = this.stack[this.stack.length - 1]; // To do: clean.

    if (getData('inReference')) {
      context.type += 'Reference';
      context.referenceType = getData('referenceType') || 'shortcut';
      delete context.url;
      delete context.title;
    } else {
      delete context.identifier;
      delete context.label;
      delete context.referenceType;
    }

    setData('referenceType');
  }

  function onexitimage() {
    var context = this.stack[this.stack.length - 1]; // To do: clean.

    if (getData('inReference')) {
      context.type += 'Reference';
      context.referenceType = getData('referenceType') || 'shortcut';
      delete context.url;
      delete context.title;
    } else {
      delete context.identifier;
      delete context.label;
      delete context.referenceType;
    }

    setData('referenceType');
  }

  function onexitlabeltext(token) {
    this.stack[this.stack.length - 2].identifier = normalizeIdentifier(this.sliceSerialize(token)).toLowerCase();
  }

  function onexitlabel() {
    var fragment = this.stack[this.stack.length - 1];
    var value = this.resume();
    this.stack[this.stack.length - 1].label = value; // Assume a reference.

    setData('inReference', true);

    if (this.stack[this.stack.length - 1].type === 'link') {
      this.stack[this.stack.length - 1].children = fragment.children;
    } else {
      this.stack[this.stack.length - 1].alt = value;
    }
  }

  function onexitresourcedestinationstring() {
    var data = this.resume();
    this.stack[this.stack.length - 1].url = data;
  }

  function onexitresourcetitlestring() {
    var data = this.resume();
    this.stack[this.stack.length - 1].title = data;
  }

  function onexitresource() {
    setData('inReference');
  }

  function onenterreference() {
    setData('referenceType', 'collapsed');
  }

  function onexitreferencestring(token) {
    var label = this.resume();
    this.stack[this.stack.length - 1].label = label;
    this.stack[this.stack.length - 1].identifier = normalizeIdentifier(this.sliceSerialize(token)).toLowerCase();
    setData('referenceType', 'full');
  }

  function onexitcharacterreferencemarker(token) {
    setData('characterReferenceType', token.type);
  }

  function onexitcharacterreferencevalue(token) {
    var data = this.sliceSerialize(token);
    var type = getData('characterReferenceType');
    var value;

    if (type) {
      value = safeFromInt(data, type === 'characterReferenceMarkerNumeric' ? 10 : 16);
      setData('characterReferenceType');
    } else {
      value = decode(data);
    }

    this.stack[this.stack.length - 1].value += value;
  }

  function onexitautolinkprotocol(token) {
    onexitdata.call(this, token);
    this.stack[this.stack.length - 1].url = this.sliceSerialize(token);
  }

  function onexitautolinkemail(token) {
    onexitdata.call(this, token);
    this.stack[this.stack.length - 1].url = 'mailto:' + this.sliceSerialize(token);
  } //
  // Creaters.
  //


  function blockQuote() {
    return {
      type: 'blockquote',
      children: []
    };
  }

  function codeFlow() {
    return {
      type: 'code',
      lang: null,
      meta: null,
      value: ''
    };
  }

  function codeText() {
    return {
      type: 'inlineCode',
      value: ''
    };
  }

  function definition() {
    return {
      type: 'definition',
      identifier: '',
      label: null,
      title: null,
      url: ''
    };
  }

  function emphasis() {
    return {
      type: 'emphasis',
      children: []
    };
  }

  function heading() {
    return {
      type: 'heading',
      depth: undefined,
      children: []
    };
  }

  function hardBreak() {
    return {
      type: 'break'
    };
  }

  function html() {
    return {
      type: 'html',
      value: ''
    };
  }

  function image() {
    return {
      type: 'image',
      title: null,
      url: '',
      alt: null
    };
  }

  function link() {
    return {
      type: 'link',
      title: null,
      url: '',
      children: []
    };
  }

  function list(token) {
    return {
      type: 'list',
      ordered: token.type === 'listOrdered',
      start: null,
      spread: token._spread,
      children: []
    };
  }

  function listItem(token) {
    return {
      type: 'listItem',
      spread: token._spread,
      checked: null,
      children: []
    };
  }

  function paragraph() {
    return {
      type: 'paragraph',
      children: []
    };
  }

  function strong() {
    return {
      type: 'strong',
      children: []
    };
  }

  function text() {
    return {
      type: 'text',
      value: ''
    };
  }

  function thematicBreak() {
    return {
      type: 'thematicBreak'
    };
  }
}

function configure(config, extensions) {
  var length = extensions.length;
  var index = -1;

  while (++index < length) {
    extension(config, extensions[index]);
  }

  return config;
}

function extension(config, extension) {
  var key;
  var left;
  var right;

  for (key in extension) {
    left = own.call(config, key) ? config[key] : config[key] = {};
    right = extension[key];

    if (key === 'canContainEols') {
      config[key] = [].concat(left, right);
    } else {
      Object.assign(left, right);
    }
  }
}

/***/ }),

/***/ "./node_modules/mdast-util-from-markdown/index.js":
/*!********************************************************!*\
  !*** ./node_modules/mdast-util-from-markdown/index.js ***!
  \********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = __webpack_require__(/*! ./dist */ "./node_modules/mdast-util-from-markdown/dist/index.js");

/***/ }),

/***/ "./node_modules/mdast-util-to-string/index.js":
/*!****************************************************!*\
  !*** ./node_modules/mdast-util-to-string/index.js ***!
  \****************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = toString; // Get the text content of a node.
// Prefer the node’s plain-text fields, otherwise serialize its children,
// and if the given value is an array, serialize the nodes in it.

function toString(node) {
  return node && (node.value || node.alt || node.title || 'children' in node && all(node.children) || 'length' in node && all(node)) || '';
}

function all(values) {
  var result = [];
  var length = values.length;
  var index = -1;

  while (++index < length) {
    result[index] = toString(values[index]);
  }

  return result.join('');
}

/***/ }),

/***/ "./node_modules/micromark/dist/character/ascii-alpha.js":
/*!**************************************************************!*\
  !*** ./node_modules/micromark/dist/character/ascii-alpha.js ***!
  \**************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var check = __webpack_require__(/*! ../util/regex-check */ "./node_modules/micromark/dist/util/regex-check.js");

module.exports = check(/[A-Za-z]/);

/***/ }),

/***/ "./node_modules/micromark/dist/character/ascii-alphanumeric.js":
/*!*********************************************************************!*\
  !*** ./node_modules/micromark/dist/character/ascii-alphanumeric.js ***!
  \*********************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var check = __webpack_require__(/*! ../util/regex-check */ "./node_modules/micromark/dist/util/regex-check.js");

module.exports = check(/[\dA-Za-z]/);

/***/ }),

/***/ "./node_modules/micromark/dist/character/ascii-atext.js":
/*!**************************************************************!*\
  !*** ./node_modules/micromark/dist/character/ascii-atext.js ***!
  \**************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var check = __webpack_require__(/*! ../util/regex-check */ "./node_modules/micromark/dist/util/regex-check.js");

module.exports = check(/[#-'*+\--9=?A-Z^-~]/);

/***/ }),

/***/ "./node_modules/micromark/dist/character/ascii-control.js":
/*!****************************************************************!*\
  !*** ./node_modules/micromark/dist/character/ascii-control.js ***!
  \****************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = asciiControl; // Note: EOF is seen as ASCII control here, because `null < 32 == true`.

function asciiControl(code) {
  return (// Special whitespace codes (which have negative values), C0 and Control
    // character DEL
    code < 32 || code === 127
  );
}

/***/ }),

/***/ "./node_modules/micromark/dist/character/ascii-digit.js":
/*!**************************************************************!*\
  !*** ./node_modules/micromark/dist/character/ascii-digit.js ***!
  \**************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var check = __webpack_require__(/*! ../util/regex-check */ "./node_modules/micromark/dist/util/regex-check.js");

module.exports = check(/\d/);

/***/ }),

/***/ "./node_modules/micromark/dist/character/ascii-hex-digit.js":
/*!******************************************************************!*\
  !*** ./node_modules/micromark/dist/character/ascii-hex-digit.js ***!
  \******************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var check = __webpack_require__(/*! ../util/regex-check */ "./node_modules/micromark/dist/util/regex-check.js");

module.exports = check(/[\dA-Fa-f]/);

/***/ }),

/***/ "./node_modules/micromark/dist/character/ascii-punctuation.js":
/*!********************************************************************!*\
  !*** ./node_modules/micromark/dist/character/ascii-punctuation.js ***!
  \********************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var check = __webpack_require__(/*! ../util/regex-check */ "./node_modules/micromark/dist/util/regex-check.js");

module.exports = check(/[!-/:-@[-`{-~]/);

/***/ }),

/***/ "./node_modules/micromark/dist/character/markdown-line-ending-or-space.js":
/*!********************************************************************************!*\
  !*** ./node_modules/micromark/dist/character/markdown-line-ending-or-space.js ***!
  \********************************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = markdownLineEndingOrSpace;

function markdownLineEndingOrSpace(code) {
  return code < 0 || code === 32;
}

/***/ }),

/***/ "./node_modules/micromark/dist/character/markdown-line-ending.js":
/*!***********************************************************************!*\
  !*** ./node_modules/micromark/dist/character/markdown-line-ending.js ***!
  \***********************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = markdownLineEnding;

function markdownLineEnding(code) {
  return code < -2;
}

/***/ }),

/***/ "./node_modules/micromark/dist/character/markdown-space.js":
/*!*****************************************************************!*\
  !*** ./node_modules/micromark/dist/character/markdown-space.js ***!
  \*****************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = markdownSpace;

function markdownSpace(code) {
  return code === -2 || code === -1 || code === 32;
}

/***/ }),

/***/ "./node_modules/micromark/dist/character/unicode-punctuation.js":
/*!**********************************************************************!*\
  !*** ./node_modules/micromark/dist/character/unicode-punctuation.js ***!
  \**********************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var unicodePunctuation = __webpack_require__(/*! ../constant/unicode-punctuation-regex */ "./node_modules/micromark/dist/constant/unicode-punctuation-regex.js");

var check = __webpack_require__(/*! ../util/regex-check */ "./node_modules/micromark/dist/util/regex-check.js"); // Size note: removing ASCII from the regex and using `ascii-punctuation` here
// In fact adds to the bundle size.


module.exports = check(unicodePunctuation);

/***/ }),

/***/ "./node_modules/micromark/dist/character/unicode-whitespace.js":
/*!*********************************************************************!*\
  !*** ./node_modules/micromark/dist/character/unicode-whitespace.js ***!
  \*********************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var check = __webpack_require__(/*! ../util/regex-check */ "./node_modules/micromark/dist/util/regex-check.js");

module.exports = check(/\s/);

/***/ }),

/***/ "./node_modules/micromark/dist/constant/assign.js":
/*!********************************************************!*\
  !*** ./node_modules/micromark/dist/constant/assign.js ***!
  \********************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = Object.assign;

/***/ }),

/***/ "./node_modules/micromark/dist/constant/from-char-code.js":
/*!****************************************************************!*\
  !*** ./node_modules/micromark/dist/constant/from-char-code.js ***!
  \****************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = String.fromCharCode;

/***/ }),

/***/ "./node_modules/micromark/dist/constant/has-own-property.js":
/*!******************************************************************!*\
  !*** ./node_modules/micromark/dist/constant/has-own-property.js ***!
  \******************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = {}.hasOwnProperty;

/***/ }),

/***/ "./node_modules/micromark/dist/constant/html-block-names.js":
/*!******************************************************************!*\
  !*** ./node_modules/micromark/dist/constant/html-block-names.js ***!
  \******************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

// This module is copied from <https://spec.commonmark.org/0.29/#html-blocks>.
module.exports = ['address', 'article', 'aside', 'base', 'basefont', 'blockquote', 'body', 'caption', 'center', 'col', 'colgroup', 'dd', 'details', 'dialog', 'dir', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hr', 'html', 'iframe', 'legend', 'li', 'link', 'main', 'menu', 'menuitem', 'nav', 'noframes', 'ol', 'optgroup', 'option', 'p', 'param', 'section', 'source', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'title', 'tr', 'track', 'ul'];

/***/ }),

/***/ "./node_modules/micromark/dist/constant/html-raw-names.js":
/*!****************************************************************!*\
  !*** ./node_modules/micromark/dist/constant/html-raw-names.js ***!
  \****************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

// This module is copied from <https://spec.commonmark.org/0.29/#html-blocks>.
module.exports = ['pre', 'script', 'style'];

/***/ }),

/***/ "./node_modules/micromark/dist/constant/unicode-punctuation-regex.js":
/*!***************************************************************************!*\
  !*** ./node_modules/micromark/dist/constant/unicode-punctuation-regex.js ***!
  \***************************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

// This module is generated by `script/`.
//
// CommonMark handles attention (emphasis, strong) markers based on what comes
// before or after them.
// One such difference is if those characters are Unicode punctuation.
// This script is generated from the Unicode data.
module.exports = /[!-\/:-@\[-`\{-~\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C77\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4F\u2E52\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]/;

/***/ }),

/***/ "./node_modules/micromark/dist/constructs.js":
/*!***************************************************!*\
  !*** ./node_modules/micromark/dist/constructs.js ***!
  \***************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var attention = __webpack_require__(/*! ./tokenize/attention */ "./node_modules/micromark/dist/tokenize/attention.js");

var headingAtx = __webpack_require__(/*! ./tokenize/heading-atx */ "./node_modules/micromark/dist/tokenize/heading-atx.js");

var autolink = __webpack_require__(/*! ./tokenize/autolink */ "./node_modules/micromark/dist/tokenize/autolink.js");

var list = __webpack_require__(/*! ./tokenize/list */ "./node_modules/micromark/dist/tokenize/list.js");

var blockQuote = __webpack_require__(/*! ./tokenize/block-quote */ "./node_modules/micromark/dist/tokenize/block-quote.js");

var characterEscape = __webpack_require__(/*! ./tokenize/character-escape */ "./node_modules/micromark/dist/tokenize/character-escape.js");

var characterReference = __webpack_require__(/*! ./tokenize/character-reference */ "./node_modules/micromark/dist/tokenize/character-reference.js");

var codeFenced = __webpack_require__(/*! ./tokenize/code-fenced */ "./node_modules/micromark/dist/tokenize/code-fenced.js");

var codeIndented = __webpack_require__(/*! ./tokenize/code-indented */ "./node_modules/micromark/dist/tokenize/code-indented.js");

var codeText = __webpack_require__(/*! ./tokenize/code-text */ "./node_modules/micromark/dist/tokenize/code-text.js");

var definition = __webpack_require__(/*! ./tokenize/definition */ "./node_modules/micromark/dist/tokenize/definition.js");

var hardBreakEscape = __webpack_require__(/*! ./tokenize/hard-break-escape */ "./node_modules/micromark/dist/tokenize/hard-break-escape.js");

var htmlFlow = __webpack_require__(/*! ./tokenize/html-flow */ "./node_modules/micromark/dist/tokenize/html-flow.js");

var htmlText = __webpack_require__(/*! ./tokenize/html-text */ "./node_modules/micromark/dist/tokenize/html-text.js");

var labelEnd = __webpack_require__(/*! ./tokenize/label-end */ "./node_modules/micromark/dist/tokenize/label-end.js");

var labelImage = __webpack_require__(/*! ./tokenize/label-start-image */ "./node_modules/micromark/dist/tokenize/label-start-image.js");

var labelLink = __webpack_require__(/*! ./tokenize/label-start-link */ "./node_modules/micromark/dist/tokenize/label-start-link.js");

var setextUnderline = __webpack_require__(/*! ./tokenize/setext-underline */ "./node_modules/micromark/dist/tokenize/setext-underline.js");

var thematicBreak = __webpack_require__(/*! ./tokenize/thematic-break */ "./node_modules/micromark/dist/tokenize/thematic-break.js");

var lineEnding = __webpack_require__(/*! ./tokenize/line-ending */ "./node_modules/micromark/dist/tokenize/line-ending.js");

var resolveText = __webpack_require__(/*! ./initialize/text */ "./node_modules/micromark/dist/initialize/text.js").resolver;

exports.document = {
  42: list,
  // Asterisk
  43: list,
  // Plus sign
  45: list,
  // Dash
  48: list,
  // 0
  49: list,
  // 1
  50: list,
  // 2
  51: list,
  // 3
  52: list,
  // 4
  53: list,
  // 5
  54: list,
  // 6
  55: list,
  // 7
  56: list,
  // 8
  57: list,
  // 9
  62: blockQuote // Greater than

};
exports.contentInitial = {
  91: definition // Left square bracket

};
exports.flowInitial = {
  '-2': codeIndented,
  // Horizontal tab
  '-1': codeIndented,
  // Virtual space
  32: codeIndented // Space

};
exports.flow = {
  35: headingAtx,
  // Number sign
  42: thematicBreak,
  // Asterisk
  45: [setextUnderline, thematicBreak],
  // Dash
  60: htmlFlow,
  // Less than
  61: setextUnderline,
  // Equals to
  95: thematicBreak,
  // Underscore
  96: codeFenced,
  // Grave accent
  126: codeFenced // Tilde

};
exports.string = {
  38: characterReference,
  // Ampersand
  92: characterEscape // Backslash

};
exports.text = {
  '-5': lineEnding,
  // Carriage return
  '-4': lineEnding,
  // Line feed
  '-3': lineEnding,
  // Carriage return + line feed
  33: labelImage,
  // Exclamation mark
  38: characterReference,
  // Ampersand
  42: attention,
  // Asterisk
  60: [autolink, htmlText],
  // Less than
  91: labelLink,
  // Left square bracket
  92: [hardBreakEscape, characterEscape],
  // Backslash
  93: labelEnd,
  // Right square bracket
  95: attention,
  // Underscore
  96: codeText // Grave accent

};
exports.insideSpan = {
  "null": [attention, resolveText]
};

/***/ }),

/***/ "./node_modules/micromark/dist/initialize/content.js":
/*!***********************************************************!*\
  !*** ./node_modules/micromark/dist/initialize/content.js ***!
  \***********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = initializeContent;

var markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending */ "./node_modules/micromark/dist/character/markdown-line-ending.js");

var createSpace = __webpack_require__(/*! ../tokenize/factory-space */ "./node_modules/micromark/dist/tokenize/factory-space.js");

function initializeContent(effects) {
  var contentStart = effects.attempt(this.parser.constructs.contentInitial, afterContentStartConstruct, paragraphInitial);
  var previous;
  return contentStart;

  function afterContentStartConstruct(code) {
    if (code === null) {
      effects.consume(code);
      return;
    }

    effects.enter('lineEnding');
    effects.consume(code);
    effects.exit('lineEnding');
    return createSpace(effects, contentStart, 'linePrefix');
  }

  function paragraphInitial(code) {
    effects.enter('paragraph');
    return lineStart(code);
  }

  function lineStart(code) {
    var token = effects.enter('chunkText', {
      contentType: 'text',
      previous: previous
    });

    if (previous) {
      previous.next = token;
    }

    previous = token;
    return data(code);
  }

  function data(code) {
    if (code === null) {
      effects.exit('chunkText');
      effects.exit('paragraph');
      effects.consume(code);
      return;
    }

    if (markdownLineEnding(code)) {
      effects.consume(code);
      effects.exit('chunkText');
      return lineStart;
    } // Data.


    effects.consume(code);
    return data;
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/initialize/document.js":
/*!************************************************************!*\
  !*** ./node_modules/micromark/dist/initialize/document.js ***!
  \************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = initializeDocument;

var markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending */ "./node_modules/micromark/dist/character/markdown-line-ending.js");

var createSpace = __webpack_require__(/*! ../tokenize/factory-space */ "./node_modules/micromark/dist/tokenize/factory-space.js");

var blank = __webpack_require__(/*! ../tokenize/partial-blank-line */ "./node_modules/micromark/dist/tokenize/partial-blank-line.js");

var container = {
  tokenize: tokenizeContainer
};
var lazyFlow = {
  tokenize: tokenizeLazyFlow
};

function initializeDocument(effects) {
  var self = this;
  var stack = [];
  var continued = 0;
  var inspectResult;
  var childFlow;
  var childToken;
  return start;

  function start(code) {
    if (continued < stack.length) {
      self.containerState = stack[continued][1];
      return effects.attempt(stack[continued][0].continuation, documentContinue, documentContinued)(code);
    }

    return documentContinued(code);
  }

  function documentContinue(code) {
    continued++;
    return start(code);
  }

  function documentContinued(code) {
    // If we’re in a concrete construct (such as when expecting another line of
    // HTML, or we resulted in lazy content), we can immediately start flow.
    if (inspectResult && inspectResult.flowContinue) {
      return flowStart(code);
    }

    self.interrupt = childFlow && childFlow.currentConstruct && childFlow.currentConstruct.interruptible;
    self.containerState = {};
    return effects.attempt(container, containerContinue, flowStart)(code);
  }

  function containerContinue(code) {
    stack.push([self.currentConstruct, self.containerState]);
    self.containerState = undefined;
    return documentContinued(code);
  }

  function flowStart(code) {
    if (code === null) {
      exitContainers(0, true);
      effects.consume(code);
      return;
    }

    childFlow = childFlow || self.parser.flow(self.now());
    effects.enter('chunkFlow', {
      contentType: 'flow',
      previous: childToken,
      _tokenizer: childFlow
    });
    return flowContinue(code);
  }

  function flowContinue(code) {
    if (code === null) {
      continueFlow(effects.exit('chunkFlow'));
      return flowStart(code);
    }

    if (markdownLineEnding(code)) {
      effects.consume(code);
      continueFlow(effects.exit('chunkFlow'));
      return effects.check({
        tokenize: tokenizeInspect,
        partial: true
      }, documentAfterPeek);
    }

    effects.consume(code);
    return flowContinue;
  }

  function documentAfterPeek(code) {
    exitContainers(inspectResult.continued, inspectResult && inspectResult.flowEnd);
    continued = 0;
    return start(code);
  }

  function continueFlow(token) {
    if (childToken) childToken.next = token;
    childToken = token;
    childFlow.lazy = inspectResult && inspectResult.lazy;
    childFlow.defineSkip(token.start);
    childFlow.write(self.sliceStream(token));
  }

  function exitContainers(size, end) {
    var index = stack.length; // Close the flow.

    if (childFlow && end) {
      childFlow.write([null]);
      childToken = childFlow = undefined;
    } // Exit open containers.


    while (index-- > size) {
      self.containerState = stack[index][1];
      stack[index][0].exit.call(self, effects);
    }

    stack.length = size;
  }

  function tokenizeInspect(effects, ok) {
    var subcontinued = 0;
    inspectResult = {};
    return inspectStart;

    function inspectStart(code) {
      if (subcontinued < stack.length) {
        self.containerState = stack[subcontinued][1];
        return effects.attempt(stack[subcontinued][0].continuation, inspectContinue, inspectLess)(code);
      } // If we’re continued but in a concrete flow, we can’t have more
      // containers.


      if (childFlow.currentConstruct && childFlow.currentConstruct.concrete) {
        inspectResult.flowContinue = true;
        return inspectDone(code);
      }

      self.interrupt = childFlow.currentConstruct && childFlow.currentConstruct.interruptible;
      self.containerState = {};
      return effects.attempt(container, inspectFlowEnd, inspectDone)(code);
    }

    function inspectContinue(code) {
      subcontinued++;
      return self.containerState._closeFlow ? inspectFlowEnd(code) : inspectStart(code);
    }

    function inspectLess(code) {
      if (childFlow.currentConstruct && childFlow.currentConstruct.lazy) {
        // Maybe another container?
        self.containerState = {};
        return effects.attempt(container, inspectFlowEnd, // Maybe flow, or a blank line?
        effects.attempt(lazyFlow, inspectFlowEnd, effects.check(blank, inspectFlowEnd, inspectLazy)))(code);
      } // Otherwise we’re interrupting.


      return inspectFlowEnd(code);
    }

    function inspectLazy(code) {
      // Act as if all containers are continued.
      subcontinued = stack.length;
      inspectResult.lazy = true;
      inspectResult.flowContinue = true;
      return inspectDone(code);
    } // We’re done with flow if we have more containers, or an interruption.


    function inspectFlowEnd(code) {
      inspectResult.flowEnd = true;
      return inspectDone(code);
    }

    function inspectDone(code) {
      inspectResult.continued = subcontinued;
      self.interrupt = self.containerState = undefined;
      return ok(code);
    }
  }
}

function tokenizeContainer(effects, ok, nok) {
  return createSpace(effects, effects.attempt(this.parser.constructs.document, ok, nok), 'linePrefix', 4);
}

function tokenizeLazyFlow(effects, ok, nok) {
  return createSpace(effects, effects.lazy(this.parser.constructs.flow, ok, nok), 'linePrefix', 4);
}

/***/ }),

/***/ "./node_modules/micromark/dist/initialize/flow.js":
/*!********************************************************!*\
  !*** ./node_modules/micromark/dist/initialize/flow.js ***!
  \********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = initializeFlow;

var markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending */ "./node_modules/micromark/dist/character/markdown-line-ending.js");

var createSpace = __webpack_require__(/*! ../tokenize/factory-space */ "./node_modules/micromark/dist/tokenize/factory-space.js");

var blank = __webpack_require__(/*! ../tokenize/partial-blank-line */ "./node_modules/micromark/dist/tokenize/partial-blank-line.js");

var content = __webpack_require__(/*! ../tokenize/content */ "./node_modules/micromark/dist/tokenize/content.js");

function initializeFlow(effects) {
  var self = this;
  var initial = effects.attempt( // Try to parse a blank line.
  blank, atBlankEnding, // Try to parse initial flow (essentially, only code).
  effects.attempt(this.parser.constructs.flowInitial, afterConstruct, createSpace(effects, effects.attempt(this.parser.constructs.flow, afterConstruct, effects.attempt(content, afterConstruct)), 'linePrefix')));
  return initial;

  function atBlankEnding(code) {
    if (code === null) {
      effects.consume(code);
      return;
    }

    effects.enter('lineEndingBlank');
    effects.consume(code);
    effects.exit('lineEndingBlank');
    self.currentConstruct = undefined;
    return initial;
  }

  function afterConstruct(code) {
    if (code === null) {
      effects.consume(code);
      return;
    }

    effects.enter('lineEnding');
    effects.consume(code);
    effects.exit('lineEnding');
    self.currentConstruct = undefined;
    return initial;
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/initialize/text.js":
/*!********************************************************!*\
  !*** ./node_modules/micromark/dist/initialize/text.js ***!
  \********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.text = initializeFactory('text');
exports.string = initializeFactory('string');
exports.resolver = {
  resolveAll: resolver()
};

var assign = __webpack_require__(/*! ../constant/assign */ "./node_modules/micromark/dist/constant/assign.js");

var shallow = __webpack_require__(/*! ../util/shallow */ "./node_modules/micromark/dist/util/shallow.js");

function initializeFactory(field) {
  return {
    tokenize: initializeText,
    resolveAll: resolver(field === 'text' ? resolveAllLineSuffixes : undefined)
  };

  function initializeText(effects) {
    var self = this;
    var constructs = this.parser.constructs[field];
    var text = effects.attempt(constructs, start, notText);
    return start;

    function start(code) {
      return atBreak(code) ? text(code) : notText(code);
    }

    function notText(code) {
      if (code === null) {
        effects.consume(code);
        return;
      }

      effects.enter('data');
      effects.consume(code);
      return data;
    }

    function data(code) {
      if (atBreak(code)) {
        effects.exit('data');
        return text(code);
      } // Data.


      effects.consume(code);
      return data;
    }

    function atBreak(code) {
      var list = constructs[code];
      var index = -1;

      if (code === null) {
        return true;
      }

      if (list) {
        while (++index < list.length) {
          if (!list[index].previous || list[index].previous.call(self, self.previous)) {
            return true;
          }
        }
      }
    }
  }
}

function resolver(extraResolver) {
  return resolveAllText;

  function resolveAllText(events, context) {
    var index = -1;
    var enter; // A rather boring computation (to merge adjacent `data` events) which
    // improves mm performance by 29%.

    while (++index <= events.length) {
      if (enter === undefined) {
        if (events[index] && events[index][1].type === 'data') {
          enter = index;
          index++;
        }
      } else if (!events[index] || events[index][1].type !== 'data') {
        // Don’t do anything if there is one data token.
        if (index !== enter + 2) {
          events[enter][1].end = events[index - 1][1].end;
          events.splice(enter + 2, index - enter - 2);
          index = enter + 2;
        }

        enter = undefined;
      }
    }

    return extraResolver ? extraResolver(events, context) : events;
  }
} // A rather ugly set of instructions which again looks at chunks in the input
// stream.
// The reason to do this here is that it is *much* faster to parse in reverse.
// And that we can’t hook into `null` to split the line suffix before an EOF.
// To do: figure out if we can make this into a clean utility, or even in core.
// As it will be useful for GFMs literal autolink extension (and maybe even
// tables?)


function resolveAllLineSuffixes(events, context) {
  var eventIndex = -1;
  var chunks;
  var data;
  var chunk;
  var index;
  var bufferIndex;
  var size;
  var tabs;
  var token;

  while (++eventIndex <= events.length) {
    if ((eventIndex === events.length || events[eventIndex][1].type === 'lineEnding') && events[eventIndex - 1][1].type === 'data') {
      data = events[eventIndex - 1][1];
      chunks = context.sliceStream(data);
      index = chunks.length;
      bufferIndex = -1;
      size = 0;
      tabs = undefined;

      while (index--) {
        chunk = chunks[index];

        if (typeof chunk === 'string') {
          bufferIndex = chunk.length;

          while (chunk.charCodeAt(bufferIndex - 1) === 32) {
            size++;
            bufferIndex--;
          }

          if (bufferIndex) break;
          bufferIndex = -1;
        } // Number
        else if (chunk === -2) {
            tabs = true;
            size++;
          } else if (chunk === -1) {// Empty
          } else {
            // Replacement character, exit.
            index++;
            break;
          }
      }

      if (size) {
        token = {
          type: eventIndex === events.length || tabs || size < 2 ? 'lineSuffix' : 'hardBreakTrailing',
          start: {
            line: data.end.line,
            column: data.end.column - size,
            offset: data.end.offset - size,
            _index: data.start._index + index,
            _bufferIndex: index ? bufferIndex : data.start._bufferIndex + bufferIndex
          },
          end: shallow(data.end)
        };
        data.end = shallow(token.start);

        if (data.start.offset === data.end.offset) {
          assign(data, token);
        } else {
          events.splice(eventIndex, 0, ['enter', token, context], ['exit', token, context]);
          eventIndex += 2;
        }
      }

      eventIndex++;
    }
  }

  return events;
}

/***/ }),

/***/ "./node_modules/micromark/dist/parse.js":
/*!**********************************************!*\
  !*** ./node_modules/micromark/dist/parse.js ***!
  \**********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = createParser;

var initializeContent = __webpack_require__(/*! ./initialize/content */ "./node_modules/micromark/dist/initialize/content.js");

var initializeDocument = __webpack_require__(/*! ./initialize/document */ "./node_modules/micromark/dist/initialize/document.js");

var initializeFlow = __webpack_require__(/*! ./initialize/flow */ "./node_modules/micromark/dist/initialize/flow.js");

var initializeText = __webpack_require__(/*! ./initialize/text */ "./node_modules/micromark/dist/initialize/text.js");

var constructs = __webpack_require__(/*! ./constructs */ "./node_modules/micromark/dist/constructs.js");

var createTokenizer = __webpack_require__(/*! ./util/create-tokenizer */ "./node_modules/micromark/dist/util/create-tokenizer.js");

var combineExtensions = __webpack_require__(/*! ./util/combine-extensions */ "./node_modules/micromark/dist/util/combine-extensions.js");

var miniflat = __webpack_require__(/*! ./util/miniflat */ "./node_modules/micromark/dist/util/miniflat.js");

function createParser(options) {
  var settings = options || {};
  var parser = {
    defined: [],
    constructs: combineExtensions([constructs].concat(miniflat(settings.extensions))),
    content: create(initializeContent),
    document: create(initializeDocument),
    flow: create(initializeFlow),
    string: create(initializeText.string),
    text: create(initializeText.text)
  };
  return parser;

  function create(initializer) {
    return creator;

    function creator(from) {
      return createTokenizer(parser, initializer, from);
    }
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/postprocess.js":
/*!****************************************************!*\
  !*** ./node_modules/micromark/dist/postprocess.js ***!
  \****************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = postprocess;

var subtokenize = __webpack_require__(/*! ./util/subtokenize */ "./node_modules/micromark/dist/util/subtokenize.js");

function postprocess(events) {
  while (!subtokenize(events)) {// Empty
  }

  return events;
}

/***/ }),

/***/ "./node_modules/micromark/dist/preprocess.js":
/*!***************************************************!*\
  !*** ./node_modules/micromark/dist/preprocess.js ***!
  \***************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = preprocessor;
var search = /[\0\t\n\r]/g;

function preprocessor() {
  var start = true;
  var column = 1;
  var buffer = '';
  var atCarriageReturn;
  return preprocess;

  function preprocess(value, encoding, end) {
    var chunks = [];
    var match;
    var next;
    var startPosition;
    var endPosition;
    var code;
    value = buffer + value.toString(encoding);
    startPosition = 0;
    buffer = '';

    if (start) {
      if (value.charCodeAt(0) === 65279) {
        startPosition++;
      }

      start = undefined;
    }

    while (startPosition < value.length) {
      search.lastIndex = startPosition;
      match = search.exec(value);
      endPosition = match ? match.index : value.length;
      code = value.charCodeAt(endPosition);

      if (!match) {
        buffer = value.slice(startPosition);
        break;
      }

      if (code === 10 && startPosition === endPosition && atCarriageReturn) {
        chunks.push(-3);
        atCarriageReturn = undefined;
      } else {
        if (atCarriageReturn) {
          chunks.push(-5);
          atCarriageReturn = undefined;
        }

        if (startPosition < endPosition) {
          chunks.push(value.slice(startPosition, endPosition));
          column += endPosition - startPosition;
        }

        if (code === 0) {
          chunks.push(65533);
          column++;
        } else if (code === 9) {
          next = Math.ceil(column / 4) * 4;
          chunks.push(-2);

          while (column++ < next) {
            chunks.push(-1);
          }
        } else if (code === 10) {
          chunks.push(-4);
          column = 1;
        } // Must be carriage return.
        else {
            atCarriageReturn = true;
            column = 1;
          }
      }

      startPosition = endPosition + 1;
    }

    if (end) {
      if (atCarriageReturn) chunks.push(-5);
      if (buffer) chunks.push(buffer);
      chunks.push(null);
    }

    return chunks;
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/attention.js":
/*!***********************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/attention.js ***!
  \***********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizeAttention;
exports.resolveAll = resolveAllAttention;

var shallow = __webpack_require__(/*! ../util/shallow */ "./node_modules/micromark/dist/util/shallow.js");

var chunkedSplice = __webpack_require__(/*! ../util/chunked-splice */ "./node_modules/micromark/dist/util/chunked-splice.js");

var classifyCharacter = __webpack_require__(/*! ../util/classify-character */ "./node_modules/micromark/dist/util/classify-character.js");

var movePoint = __webpack_require__(/*! ../util/move-point */ "./node_modules/micromark/dist/util/move-point.js");

var resolveAll = __webpack_require__(/*! ../util/resolve-all */ "./node_modules/micromark/dist/util/resolve-all.js"); // Take all events and resolve attention to emphasis or strong.


function resolveAllAttention(events, context) {
  var index = -1;
  var open;
  var group;
  var text;
  var openingSequence;
  var closingSequence;
  var use;
  var nextEvents;
  var offset; // Walk through all events.
  //
  // Note: performance of this is fine on an mb of normal markdown, but it’s
  // a bottleneck for malicious stuff.

  while (++index < events.length) {
    // Find a token that can close.
    if (events[index][0] === 'enter' && events[index][1].type === 'attentionSequence' && events[index][1]._close) {
      open = index; // Now walk back to find an opener.

      while (open--) {
        // Find a token that can open the closer.
        if (events[open][0] === 'exit' && events[open][1].type === 'attentionSequence' && events[open][1]._open && // If the markers are the same:
        context.sliceSerialize(events[open][1]).charCodeAt(0) === context.sliceSerialize(events[index][1]).charCodeAt(0)) {
          // If the opening can close or the closing can open,
          // and the close size *is not* a multiple of three,
          // but the sum of the opening and closing size *is* multiple of three,
          // then don’t match.
          if ((events[open][1]._close || events[index][1]._open) && (events[index][1].end.offset - events[index][1].start.offset) % 3 && !((events[open][1].end.offset - events[open][1].start.offset + events[index][1].end.offset - events[index][1].start.offset) % 3)) {
            continue;
          } // Number of markers to use from the sequence.


          use = events[open][1].end.offset - events[open][1].start.offset > 1 && events[index][1].end.offset - events[index][1].start.offset > 1 ? 2 : 1;
          openingSequence = {
            type: use > 1 ? 'strongSequence' : 'emphasisSequence',
            start: movePoint(shallow(events[open][1].end), -use),
            end: shallow(events[open][1].end)
          };
          closingSequence = {
            type: use > 1 ? 'strongSequence' : 'emphasisSequence',
            start: shallow(events[index][1].start),
            end: movePoint(shallow(events[index][1].start), use)
          };
          text = {
            type: use > 1 ? 'strongText' : 'emphasisText',
            start: shallow(events[open][1].end),
            end: shallow(events[index][1].start)
          };
          group = {
            type: use > 1 ? 'strong' : 'emphasis',
            start: shallow(openingSequence.start),
            end: shallow(closingSequence.end)
          };
          events[open][1].end = shallow(openingSequence.start);
          events[index][1].start = shallow(closingSequence.end);
          nextEvents = []; // If there are more markers in the opening, add them before.

          if (events[open][1].end.offset - events[open][1].start.offset) {
            chunkedSplice(nextEvents, nextEvents.length, 0, [['enter', events[open][1], context], ['exit', events[open][1], context]]);
          } // Opening.


          chunkedSplice(nextEvents, nextEvents.length, 0, [['enter', group, context], ['enter', openingSequence, context], ['exit', openingSequence, context], ['enter', text, context]]); // Between.

          chunkedSplice(nextEvents, nextEvents.length, 0, resolveAll(context.parser.constructs.insideSpan["null"], events.slice(open + 1, index), context)); // Closing.

          chunkedSplice(nextEvents, nextEvents.length, 0, [['exit', text, context], ['enter', closingSequence, context], ['exit', closingSequence, context], ['exit', group, context]]); // If there are more markers in the closing, add them after.

          if (events[index][1].end.offset - events[index][1].start.offset) {
            offset = 2;
            chunkedSplice(nextEvents, nextEvents.length, 0, [['enter', events[index][1], context], ['exit', events[index][1], context]]);
          } else {
            offset = 0;
          }

          chunkedSplice(events, open - 1, index - open + 3, nextEvents);
          index = open + nextEvents.length - offset - 2;
          break;
        }
      }
    }
  } // Remove remaining sequences.


  index = -1;

  while (++index < events.length) {
    if (events[index][1].type === 'attentionSequence') {
      events[index][1].type = 'data';
    }
  }

  return events;
}

function tokenizeAttention(effects, ok) {
  var before = classifyCharacter(this.previous);
  var marker;
  return start;

  function start(code) {
    effects.enter('attentionSequence');
    marker = code;
    return sequence(code);
  }

  function sequence(code) {
    var token;
    var after;
    var open;
    var close;

    if (code === marker) {
      effects.consume(code);
      return sequence;
    }

    token = effects.exit('attentionSequence');
    after = classifyCharacter(code);
    open = !after || after === 2 && before;
    close = !before || before === 2 && after;
    token._open = marker === 42 ? open : open && (before || !close);
    token._close = marker === 42 ? close : close && (after || !open);
    return ok(code);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/autolink.js":
/*!**********************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/autolink.js ***!
  \**********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizeAutolink;

var asciiAlpha = __webpack_require__(/*! ../character/ascii-alpha */ "./node_modules/micromark/dist/character/ascii-alpha.js");

var asciiAlphanumeric = __webpack_require__(/*! ../character/ascii-alphanumeric */ "./node_modules/micromark/dist/character/ascii-alphanumeric.js");

var asciiAtext = __webpack_require__(/*! ../character/ascii-atext */ "./node_modules/micromark/dist/character/ascii-atext.js");

var asciiControl = __webpack_require__(/*! ../character/ascii-control */ "./node_modules/micromark/dist/character/ascii-control.js");

function tokenizeAutolink(effects, ok, nok) {
  var size;
  return start;

  function start(code) {
    effects.enter('autolink');
    effects.enter('autolinkMarker');
    effects.consume(code);
    effects.exit('autolinkMarker');
    effects.enter('autolinkProtocol');
    return open;
  }

  function open(code) {
    if (asciiAlpha(code)) {
      effects.consume(code);
      size = 1;
      return schemeOrEmailAtext;
    }

    return asciiAtext(code) ? emailAtext(code) : nok(code);
  }

  function schemeOrEmailAtext(code) {
    return code === 43 || code === 45 || code === 46 || asciiAlphanumeric(code) ? schemeInsideOrEmailAtext(code) : emailAtext(code);
  }

  function schemeInsideOrEmailAtext(code) {
    if (code === 58) {
      effects.consume(code);
      return urlInside;
    }

    if ((code === 43 || code === 45 || code === 46 || asciiAlphanumeric(code)) && size++ < 32) {
      effects.consume(code);
      return schemeInsideOrEmailAtext;
    }

    return emailAtext(code);
  }

  function urlInside(code) {
    if (code === 62) {
      effects.exit('autolinkProtocol');
      return end(code);
    }

    if (code === 32 || code === 60 || asciiControl(code)) {
      return nok(code);
    }

    effects.consume(code);
    return urlInside;
  }

  function emailAtext(code) {
    if (code === 64) {
      effects.consume(code);
      size = 0;
      return emailAtSignOrDot;
    }

    if (asciiAtext(code)) {
      effects.consume(code);
      return emailAtext;
    }

    return nok(code);
  }

  function emailAtSignOrDot(code) {
    return asciiAlphanumeric(code) ? emailLabel(code) : nok(code);
  }

  function emailLabel(code) {
    if (code === 46) {
      effects.consume(code);
      size = 0;
      return emailAtSignOrDot;
    }

    if (code === 62) {
      // Exit, then change the type.
      effects.exit('autolinkProtocol').type = 'autolinkEmail';
      return end(code);
    }

    return emailValue(code);
  }

  function emailValue(code) {
    if ((code === 45 || asciiAlphanumeric(code)) && size++ < 63) {
      effects.consume(code);
      return code === 45 ? emailValue : emailLabel;
    }

    return nok(code);
  }

  function end(code) {
    effects.enter('autolinkMarker');
    effects.consume(code);
    effects.exit('autolinkMarker');
    effects.exit('autolink');
    return ok;
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/block-quote.js":
/*!*************************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/block-quote.js ***!
  \*************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizeBlockQuoteStart;
exports.continuation = {
  tokenize: tokenizeBlockQuoteContinuation
};
exports.exit = exit;

var markdownSpace = __webpack_require__(/*! ../character/markdown-space */ "./node_modules/micromark/dist/character/markdown-space.js");

var createSpace = __webpack_require__(/*! ./factory-space */ "./node_modules/micromark/dist/tokenize/factory-space.js");

function tokenizeBlockQuoteStart(effects, ok, nok) {
  var self = this;
  return start;

  function start(code) {
    if (code === 62) {
      if (!self.containerState.open) {
        effects.enter('blockQuote', {
          _container: true
        });
        self.containerState.open = true;
      }

      effects.enter('blockQuotePrefix');
      effects.enter('blockQuoteMarker');
      effects.consume(code);
      effects.exit('blockQuoteMarker');
      return after;
    }

    return nok(code);
  }

  function after(code) {
    if (markdownSpace(code)) {
      effects.enter('blockQuotePrefixWhitespace');
      effects.consume(code);
      effects.exit('blockQuotePrefixWhitespace');
      effects.exit('blockQuotePrefix');
      return ok;
    }

    effects.exit('blockQuotePrefix');
    return ok(code);
  }
}

function tokenizeBlockQuoteContinuation(effects, ok, nok) {
  return createSpace(effects, effects.attempt(exports, ok, nok), 'linePrefix', 4);
}

function exit(effects) {
  effects.exit('blockQuote');
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/character-escape.js":
/*!******************************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/character-escape.js ***!
  \******************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizeCharacterEscape;

var asciiPunctuation = __webpack_require__(/*! ../character/ascii-punctuation */ "./node_modules/micromark/dist/character/ascii-punctuation.js");

function tokenizeCharacterEscape(effects, ok, nok) {
  return start;

  function start(code) {
    effects.enter('characterEscape');
    effects.enter('escapeMarker');
    effects.consume(code);
    effects.exit('escapeMarker');
    return open;
  }

  function open(code) {
    if (asciiPunctuation(code)) {
      effects.enter('characterEscapeValue');
      effects.consume(code);
      effects.exit('characterEscapeValue');
      effects.exit('characterEscape');
      return ok;
    }

    return nok(code);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/character-reference.js":
/*!*********************************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/character-reference.js ***!
  \*********************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizeCharacterReference;

var decode = __webpack_require__(/*! parse-entities/decode-entity */ "./node_modules/parse-entities/decode-entity.browser.js");

var asciiAlphanumeric = __webpack_require__(/*! ../character/ascii-alphanumeric */ "./node_modules/micromark/dist/character/ascii-alphanumeric.js");

var asciiDigit = __webpack_require__(/*! ../character/ascii-digit */ "./node_modules/micromark/dist/character/ascii-digit.js");

var asciiHexDigit = __webpack_require__(/*! ../character/ascii-hex-digit */ "./node_modules/micromark/dist/character/ascii-hex-digit.js");

function tokenizeCharacterReference(effects, ok, nok) {
  var self = this;
  var size = 0;
  var max;
  var test;
  return start;

  function start(code) {
    effects.enter('characterReference');
    effects.enter('characterReferenceMarker');
    effects.consume(code);
    effects.exit('characterReferenceMarker');
    return open;
  }

  function open(code) {
    if (code === 35) {
      effects.enter('characterReferenceMarkerNumeric');
      effects.consume(code);
      effects.exit('characterReferenceMarkerNumeric');
      return numeric;
    }

    effects.enter('characterReferenceValue');
    max = 31;
    test = asciiAlphanumeric;
    return value(code);
  }

  function numeric(code) {
    if (code === 88 || code === 120) {
      effects.enter('characterReferenceMarkerHexadecimal');
      effects.consume(code);
      effects.exit('characterReferenceMarkerHexadecimal');
      effects.enter('characterReferenceValue');
      max = 6;
      test = asciiHexDigit;
      return value;
    }

    effects.enter('characterReferenceValue');
    max = 7;
    test = asciiDigit;
    return value(code);
  }

  function value(code) {
    var token;

    if (code === 59 && size) {
      token = effects.exit('characterReferenceValue');

      if (test === asciiAlphanumeric && !decode(self.sliceSerialize(token))) {
        return nok(code);
      }

      effects.enter('characterReferenceMarker');
      effects.consume(code);
      effects.exit('characterReferenceMarker');
      effects.exit('characterReference');
      return ok;
    }

    if (test(code) && size++ < max) {
      effects.consume(code);
      return value;
    }

    return nok(code);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/code-fenced.js":
/*!*************************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/code-fenced.js ***!
  \*************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizeCodeFenced;
exports.concrete = true;

var markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending */ "./node_modules/micromark/dist/character/markdown-line-ending.js");

var markdownLineEndingOrSpace = __webpack_require__(/*! ../character/markdown-line-ending-or-space */ "./node_modules/micromark/dist/character/markdown-line-ending-or-space.js");

var prefixSize = __webpack_require__(/*! ../util/prefix-size */ "./node_modules/micromark/dist/util/prefix-size.js");

var createSpace = __webpack_require__(/*! ./factory-space */ "./node_modules/micromark/dist/tokenize/factory-space.js");

function tokenizeCodeFenced(effects, ok, nok) {
  var self = this;
  var initialPrefix = prefixSize(this.events, 'linePrefix');
  var sizeOpen = 0;
  var marker;
  return start;

  function start(code) {
    effects.enter('codeFenced');
    effects.enter('codeFencedFence');
    effects.enter('codeFencedFenceSequence');
    marker = code;
    return sequenceOpen(code);
  }

  function sequenceOpen(code) {
    if (code === marker) {
      effects.consume(code);
      sizeOpen++;
      return sequenceOpen;
    }

    effects.exit('codeFencedFenceSequence');
    return sizeOpen < 3 ? nok(code) : createSpace(effects, infoOpen, 'whitespace')(code);
  }

  function infoOpen(code) {
    if (code === null || markdownLineEnding(code)) {
      return openAfter(code);
    }

    effects.enter('codeFencedFenceInfo');
    effects.enter('chunkString', {
      contentType: 'string'
    });
    return info(code);
  }

  function info(code) {
    if (code === null || markdownLineEndingOrSpace(code)) {
      effects.exit('chunkString');
      effects.exit('codeFencedFenceInfo');
      return createSpace(effects, infoAfter, 'whitespace')(code);
    }

    if (code === 96 && code === marker) return nok(code);
    effects.consume(code);
    return info;
  }

  function infoAfter(code) {
    if (code === null || markdownLineEnding(code)) {
      return openAfter(code);
    }

    effects.enter('codeFencedFenceMeta');
    effects.enter('chunkString', {
      contentType: 'string'
    });
    return meta(code);
  }

  function meta(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit('chunkString');
      effects.exit('codeFencedFenceMeta');
      return openAfter(code);
    }

    if (code === 96 && code === marker) return nok(code);
    effects.consume(code);
    return meta;
  }

  function openAfter(code) {
    effects.exit('codeFencedFence');
    return self.interrupt ? ok(code) : content(code);
  }

  function content(code) {
    if (code === null) {
      return after(code);
    }

    if (markdownLineEnding(code)) {
      effects.enter('lineEnding');
      effects.consume(code);
      effects.exit('lineEnding');
      return effects.attempt({
        tokenize: tokenizeClosingFence,
        partial: true
      }, after, initialPrefix ? createSpace(effects, content, 'linePrefix', initialPrefix + 1) : content);
    }

    effects.enter('codeFlowValue');
    return contentContinue(code);
  }

  function contentContinue(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit('codeFlowValue');
      return content(code);
    }

    effects.consume(code);
    return contentContinue;
  }

  function after(code) {
    effects.exit('codeFenced');
    return ok(code);
  }

  function tokenizeClosingFence(effects, ok, nok) {
    var size = 0;
    return createSpace(effects, closingPrefixAfter, 'linePrefix', 4);

    function closingPrefixAfter(code) {
      effects.enter('codeFencedFence');
      effects.enter('codeFencedFenceSequence');
      return closingSequence(code);
    }

    function closingSequence(code) {
      if (code === marker) {
        effects.consume(code);
        size++;
        return closingSequence;
      }

      if (size < sizeOpen) return nok(code);
      effects.exit('codeFencedFenceSequence');
      return createSpace(effects, closingSequenceEnd, 'whitespace')(code);
    }

    function closingSequenceEnd(code) {
      if (code === null || markdownLineEnding(code)) {
        effects.exit('codeFencedFence');
        return ok(code);
      }

      return nok(code);
    }
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/code-indented.js":
/*!***************************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/code-indented.js ***!
  \***************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizeCodeIndented;
exports.resolve = resolveCodeIndented;

var markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending */ "./node_modules/micromark/dist/character/markdown-line-ending.js");

var chunkedSplice = __webpack_require__(/*! ../util/chunked-splice */ "./node_modules/micromark/dist/util/chunked-splice.js");

var prefixSize = __webpack_require__(/*! ../util/prefix-size */ "./node_modules/micromark/dist/util/prefix-size.js");

var createSpace = __webpack_require__(/*! ./factory-space */ "./node_modules/micromark/dist/tokenize/factory-space.js");

var continuedIndent = {
  tokenize: tokenizeContinuedIndent,
  partial: true
};

function resolveCodeIndented(events, context) {
  var code = {
    type: 'codeIndented',
    start: events[0][1].start,
    end: events[events.length - 1][1].end
  };
  chunkedSplice(events, 0, 0, [['enter', code, context]]);
  chunkedSplice(events, events.length, 0, [['exit', code, context]]);
  return events;
}

function tokenizeCodeIndented(effects, ok, nok) {
  var self = this;
  return createSpace(effects, afterInitial, 'linePrefix', 4 + 1);

  function afterInitial(code) {
    // Flow checks blank lines first, so we don’t have EOL/EOF.
    if (prefixSize(self.events, 'linePrefix') < 4) {
      return nok(code);
    }

    effects.enter('codeFlowValue');
    return content(code);
  }

  function afterPrefix(code) {
    if (code === null) {
      return ok(code);
    }

    if (markdownLineEnding(code)) {
      return effects.attempt(continuedIndent, afterPrefix, ok)(code);
    }

    effects.enter('codeFlowValue');
    return content(code);
  }

  function content(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit('codeFlowValue');
      return afterPrefix(code);
    }

    effects.consume(code);
    return content;
  }
}

function tokenizeContinuedIndent(effects, ok, nok) {
  var self = this;
  return createSpace(effects, afterPrefix, 'linePrefix', 4 + 1);

  function afterPrefix(code) {
    if (markdownLineEnding(code)) {
      effects.enter('lineEnding');
      effects.consume(code);
      effects.exit('lineEnding');
      return createSpace(effects, afterPrefix, 'linePrefix', 4 + 1);
    }

    return prefixSize(self.events, 'linePrefix') < 4 ? nok(code) : ok(code);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/code-text.js":
/*!***********************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/code-text.js ***!
  \***********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizeCodeText;
exports.resolve = resolveCodeText;
exports.previous = previous;

var markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending */ "./node_modules/micromark/dist/character/markdown-line-ending.js");

function resolveCodeText(events) {
  var tailExitIndex = events.length - 4;
  var headEnterIndex = 3;
  var index;
  var enter; // If we start and end with an EOL or a space.

  if ((events[headEnterIndex][1].type === 'lineEnding' || events[headEnterIndex][1].type === 'space') && (events[tailExitIndex][1].type === 'lineEnding' || events[tailExitIndex][1].type === 'space')) {
    index = headEnterIndex; // And we have data.

    while (++index < tailExitIndex) {
      if (events[index][1].type === 'codeTextData') {
        // Then we have padding.
        events[tailExitIndex][1].type = events[headEnterIndex][1].type = 'codeTextPadding';
        headEnterIndex += 2;
        tailExitIndex -= 2;
        break;
      }
    }
  } // Merge adjacent spaces and data.


  index = headEnterIndex - 1;
  tailExitIndex++;

  while (++index <= tailExitIndex) {
    if (enter === undefined) {
      if (index !== tailExitIndex && events[index][1].type !== 'lineEnding') {
        enter = index;
      }
    } else if (index === tailExitIndex || events[index][1].type === 'lineEnding') {
      events[enter][1].type = 'codeTextData';

      if (index !== enter + 2) {
        events[enter][1].end = events[index - 1][1].end;
        events.splice(enter + 2, index - enter - 2);
        tailExitIndex -= index - enter - 2;
        index = enter + 2;
      }

      enter = undefined;
    }
  }

  return events;
}

function previous(code) {
  // If there is a previous code, there will always be a tail.
  return code !== 96 || this.events[this.events.length - 1][1].type === 'characterEscape';
}

function tokenizeCodeText(effects, ok, nok) {
  var self = this;
  var sizeOpen = 0;
  var size;
  var token;
  return start;

  function start(code) {
    effects.enter('codeText');
    effects.enter('codeTextSequence');
    return openingSequence(code);
  }

  function openingSequence(code) {
    if (code === 96) {
      effects.consume(code);
      sizeOpen++;
      return openingSequence;
    }

    effects.exit('codeTextSequence');
    return gap(code);
  }

  function gap(code) {
    // EOF.
    if (code === null) {
      return nok(code);
    } // Closing fence?
    // Could also be data.


    if (code === 96) {
      token = effects.enter('codeTextSequence');
      size = 0;
      return closingSequence(code);
    } // Tabs don’t work, and virtual spaces don’t make sense.


    if (code === 32) {
      effects.enter('space');
      effects.consume(code);
      effects.exit('space');
      return gap;
    }

    if (markdownLineEnding(code)) {
      effects.enter('lineEnding');
      effects.consume(code);
      effects.exit('lineEnding');
      return gap;
    } // Data.


    effects.enter('codeTextData');
    return data(code);
  } // In code.


  function data(code) {
    if (code === null || code === 32 || code === 96 || markdownLineEnding(code)) {
      effects.exit('codeTextData');
      return gap(code);
    }

    effects.consume(code);
    return data;
  } // Closing fence.


  function closingSequence(code) {
    // More.
    if (code === 96) {
      effects.consume(code);
      size++;
      return closingSequence;
    } // Done!


    if (size === sizeOpen) {
      effects.exit('codeTextSequence');
      effects.exit('codeText');
      return ok(code);
    } // More or less accents: mark as data.


    token.type = 'codeTextData';
    return data(code);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/content.js":
/*!*********************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/content.js ***!
  \*********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizeContent;
exports.resolve = resolveContent;
exports.interruptible = true;
exports.lazy = true;

var markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending */ "./node_modules/micromark/dist/character/markdown-line-ending.js");

var subtokenize = __webpack_require__(/*! ../util/subtokenize */ "./node_modules/micromark/dist/util/subtokenize.js");

var prefixSize = __webpack_require__(/*! ../util/prefix-size */ "./node_modules/micromark/dist/util/prefix-size.js");

var createSpace = __webpack_require__(/*! ./factory-space */ "./node_modules/micromark/dist/tokenize/factory-space.js");

var lookaheadConstruct = {
  tokenize: tokenizeLookaheadConstruct,
  partial: true
}; // Content is transparent: it’s parsed right now. That way, definitions are also
// parsed right now: before text in paragraphs (specifically, media) are parsed.

function resolveContent(events) {
  subtokenize(events);
  return events;
}

function tokenizeContent(effects, ok) {
  var previous;
  return start;

  function start(code) {
    effects.enter('content');
    previous = effects.enter('chunkContent', {
      contentType: 'content'
    });
    return data(code);
  }

  function data(code) {
    if (code === null) {
      return contentEnd(code);
    }

    if (markdownLineEnding(code)) {
      return effects.check(lookaheadConstruct, contentContinue, contentEnd)(code);
    } // Data.


    effects.consume(code);
    return data;
  }

  function contentEnd(code) {
    effects.exit('chunkContent');
    effects.exit('content');
    return ok(code);
  }

  function contentContinue(code) {
    effects.consume(code);
    effects.exit('chunkContent');
    previous = previous.next = effects.enter('chunkContent', {
      contentType: 'content',
      previous: previous
    });
    return data;
  }
}

function tokenizeLookaheadConstruct(effects, ok, nok) {
  var self = this;
  return startLookahead;

  function startLookahead(code) {
    effects.enter('lineEnding');
    effects.consume(code);
    effects.exit('lineEnding');
    return createSpace(effects, prefixed, 'linePrefix');
  }

  function prefixed(code) {
    if (code === null || markdownLineEnding(code)) {
      return nok(code);
    }

    if (prefixSize(self.events, 'linePrefix') < 4) {
      return effects.interrupt(self.parser.constructs.flow, nok, ok)(code);
    }

    return ok(code);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/definition.js":
/*!************************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/definition.js ***!
  \************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizeDefinition;

var markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending */ "./node_modules/micromark/dist/character/markdown-line-ending.js");

var markdownLineEndingOrSpace = __webpack_require__(/*! ../character/markdown-line-ending-or-space */ "./node_modules/micromark/dist/character/markdown-line-ending-or-space.js");

var normalizeIdentifier = __webpack_require__(/*! ../util/normalize-identifier */ "./node_modules/micromark/dist/util/normalize-identifier.js");

var createDestination = __webpack_require__(/*! ./factory-destination */ "./node_modules/micromark/dist/tokenize/factory-destination.js");

var createLabel = __webpack_require__(/*! ./factory-label */ "./node_modules/micromark/dist/tokenize/factory-label.js");

var createSpace = __webpack_require__(/*! ./factory-space */ "./node_modules/micromark/dist/tokenize/factory-space.js");

var createWhitespace = __webpack_require__(/*! ./factory-whitespace */ "./node_modules/micromark/dist/tokenize/factory-whitespace.js");

var createTitle = __webpack_require__(/*! ./factory-title */ "./node_modules/micromark/dist/tokenize/factory-title.js");

function tokenizeDefinition(effects, ok, nok) {
  var self = this;
  var destinationAfter = effects.attempt({
    tokenize: tokenizeTitle,
    partial: true
  }, createSpace(effects, after, 'whitespace'), createSpace(effects, after, 'whitespace'));
  var identifier;
  return start;

  function start(code) {
    effects.enter('definition');
    return createLabel.call(self, effects, labelAfter, nok, 'definitionLabel', 'definitionLabelMarker', 'definitionLabelString')(code);
  }

  function labelAfter(code) {
    identifier = normalizeIdentifier(self.sliceSerialize(self.events[self.events.length - 1][1]).slice(1, -1));

    if (code === 58) {
      effects.enter('definitionMarker');
      effects.consume(code);
      effects.exit('definitionMarker'); // Note: blank lines can’t exist in content.

      return createWhitespace(effects, createDestination(effects, destinationAfter, nok, 'definitionDestination', 'definitionDestinationLiteral', 'definitionDestinationLiteralMarker', 'definitionDestinationRaw', 'definitionDestinationString'));
    }

    return nok(code);
  }

  function after(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit('definition');

      if (self.parser.defined.indexOf(identifier) < 0) {
        self.parser.defined.push(identifier);
      }

      return ok(code);
    }

    return nok(code);
  }
}

function tokenizeTitle(effects, ok, nok) {
  return start;

  function start(code) {
    return markdownLineEndingOrSpace(code) ? createWhitespace(effects, before)(code) : nok(code);
  }

  function before(code) {
    if (code === 34 || code === 39 || code === 40) {
      return createTitle(effects, createSpace(effects, after, 'whitespace'), nok, 'definitionTitle', 'definitionTitleMarker', 'definitionTitleString')(code);
    }

    return nok(code);
  }

  function after(code) {
    return code === null || markdownLineEnding(code) ? ok(code) : nok(code);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/factory-destination.js":
/*!*********************************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/factory-destination.js ***!
  \*********************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = createDestination;

var asciiControl = __webpack_require__(/*! ../character/ascii-control */ "./node_modules/micromark/dist/character/ascii-control.js");

var markdownLineEndingOrSpace = __webpack_require__(/*! ../character/markdown-line-ending-or-space */ "./node_modules/micromark/dist/character/markdown-line-ending-or-space.js");

var markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending */ "./node_modules/micromark/dist/character/markdown-line-ending.js"); // eslint-disable-next-line max-params


function createDestination(effects, ok, nok, type, literalType, literalMarkerType, rawType, stringType, max) {
  var limit = max || Infinity;
  var balance = 0;
  return start;

  function start(code) {
    if (code === 60) {
      effects.enter(type);
      effects.enter(literalType);
      effects.enter(literalMarkerType);
      effects.consume(code);
      effects.exit(literalMarkerType);
      return destinationEnclosedBefore;
    }

    if (asciiControl(code)) {
      return nok(code);
    }

    effects.enter(type);
    effects.enter(rawType);
    effects.enter(stringType);
    effects.enter('chunkString', {
      contentType: 'string'
    });
    return destinationRaw(code);
  }

  function destinationEnclosedBefore(code) {
    if (code === 62) {
      effects.enter(literalMarkerType);
      effects.consume(code);
      effects.exit(literalMarkerType);
      effects.exit(literalType);
      effects.exit(type);
      return ok;
    }

    effects.enter(stringType);
    effects.enter('chunkString', {
      contentType: 'string'
    });
    return destinationEnclosed(code);
  }

  function destinationEnclosed(code) {
    if (code === 62) {
      effects.exit('chunkString');
      effects.exit(stringType);
      return destinationEnclosedBefore(code);
    }

    if (code === null || code === 60 || markdownLineEnding(code)) {
      return nok(code);
    }

    effects.consume(code);
    return code === 92 ? destinationEnclosedEscape : destinationEnclosed;
  }

  function destinationEnclosedEscape(code) {
    if (code === 60 || code === 62 || code === 92) {
      effects.consume(code);
      return destinationEnclosed;
    }

    return destinationEnclosed(code);
  }

  function destinationRaw(code) {
    if (code === 40) {
      if (++balance > limit) return nok(code);
      effects.consume(code);
      return destinationRaw;
    }

    if (code === 41) {
      if (!balance--) {
        effects.exit('chunkString');
        effects.exit(stringType);
        effects.exit(rawType);
        effects.exit(type);
        return ok(code);
      }

      effects.consume(code);
      return destinationRaw;
    }

    if (code === null || markdownLineEndingOrSpace(code)) {
      if (balance) return nok(code);
      effects.exit('chunkString');
      effects.exit(stringType);
      effects.exit(rawType);
      effects.exit(type);
      return ok(code);
    }

    if (asciiControl(code)) return nok(code);
    effects.consume(code);
    return code === 92 ? destinationRawEscape : destinationRaw;
  }

  function destinationRawEscape(code) {
    if (code === 40 || code === 41 || code === 92) {
      effects.consume(code);
      return destinationRaw;
    }

    return destinationRaw(code);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/factory-label.js":
/*!***************************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/factory-label.js ***!
  \***************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = createLabel;

var markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending */ "./node_modules/micromark/dist/character/markdown-line-ending.js");

var markdownSpace = __webpack_require__(/*! ../character/markdown-space */ "./node_modules/micromark/dist/character/markdown-space.js"); // eslint-disable-next-line max-params


function createLabel(effects, ok, nok, type, markerType, stringType) {
  var self = this;
  var size = 0;
  var data;
  return start;

  function start(code) {
    effects.enter(type);
    effects.enter(markerType);
    effects.consume(code);
    effects.exit(markerType);
    effects.enter(stringType);
    return atBreak;
  }

  function atBreak(code) {
    if (code === null || code === 91 || code === 93 && !data ||
    /* istanbul ignore next - footnotes. */
    code === 94 && !size && '_hiddenFootnoteSupport' in self.parser.constructs || size > 999) {
      return nok(code);
    }

    if (code === 93) {
      effects.exit(stringType);
      effects.enter(markerType);
      effects.consume(code);
      effects.exit(markerType);
      effects.exit(type);
      return ok;
    }

    if (markdownLineEnding(code)) {
      effects.enter('lineEnding');
      effects.consume(code);
      effects.exit('lineEnding');
      return atBreak;
    }

    effects.enter('chunkString', {
      contentType: 'string'
    });
    return label(code);
  }

  function label(code) {
    if (code === null || code === 91 || code === 93 || markdownLineEnding(code) || size++ > 999) {
      effects.exit('chunkString');
      return atBreak(code);
    }

    effects.consume(code);
    data = data || !markdownSpace(code);
    return code === 92 ? labelEscape : label;
  }

  function labelEscape(code) {
    if (code === 91 || code === 92 || code === 93) {
      effects.consume(code);
      size++;
      return label;
    }

    return label(code);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/factory-space.js":
/*!***************************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/factory-space.js ***!
  \***************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = createSpace;

var markdownSpace = __webpack_require__(/*! ../character/markdown-space */ "./node_modules/micromark/dist/character/markdown-space.js");

function createSpace(effects, ok, type, max) {
  var limit = max ? max - 1 : Infinity;
  var size;
  return start;

  function start(code) {
    if (markdownSpace(code)) {
      effects.enter(type);
      size = 0;
      return prefix(code);
    }

    return ok(code);
  }

  function prefix(code) {
    if (markdownSpace(code) && size++ < limit) {
      effects.consume(code);
      return prefix;
    }

    effects.exit(type);
    return ok(code);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/factory-title.js":
/*!***************************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/factory-title.js ***!
  \***************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = createTitle;

var markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending */ "./node_modules/micromark/dist/character/markdown-line-ending.js");

var createSpace = __webpack_require__(/*! ./factory-space */ "./node_modules/micromark/dist/tokenize/factory-space.js"); // eslint-disable-next-line max-params


function createTitle(effects, ok, nok, type, markerType, stringType) {
  var marker;
  return start;

  function start(code) {
    effects.enter(type);
    effects.enter(markerType);
    effects.consume(code);
    effects.exit(markerType);
    marker = code === 40 ? 41 : code;
    return atFirstTitleBreak;
  }

  function atFirstTitleBreak(code) {
    if (code === marker) {
      effects.enter(markerType);
      effects.consume(code);
      effects.exit(markerType);
      effects.exit(type);
      return ok;
    }

    effects.enter(stringType);
    return atTitleBreak(code);
  }

  function atTitleBreak(code) {
    if (code === marker) {
      effects.exit(stringType);
      return atFirstTitleBreak(marker);
    }

    if (code === null) {
      return nok(code);
    } // Note: blank lines can’t exist in content.


    if (markdownLineEnding(code)) {
      effects.enter('lineEnding');
      effects.consume(code);
      effects.exit('lineEnding');
      return createSpace(effects, atTitleBreak, 'linePrefix');
    }

    effects.enter('chunkString', {
      contentType: 'string'
    });
    return title(code);
  }

  function title(code) {
    if (code === marker || code === null || markdownLineEnding(code)) {
      effects.exit('chunkString');
      return atTitleBreak(code);
    }

    effects.consume(code);
    return code === 92 ? titleEscape : title;
  }

  function titleEscape(code) {
    if (code === marker || code === 92) {
      effects.consume(code);
      return title;
    }

    return title(code);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/factory-whitespace.js":
/*!********************************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/factory-whitespace.js ***!
  \********************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = createWhitespace;

var markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending */ "./node_modules/micromark/dist/character/markdown-line-ending.js");

var markdownSpace = __webpack_require__(/*! ../character/markdown-space */ "./node_modules/micromark/dist/character/markdown-space.js");

var createSpace = __webpack_require__(/*! ./factory-space */ "./node_modules/micromark/dist/tokenize/factory-space.js");

function createWhitespace(effects, ok) {
  var seen;
  return start;

  function start(code) {
    if (markdownLineEnding(code)) {
      effects.enter('lineEnding');
      effects.consume(code);
      effects.exit('lineEnding');
      seen = true;
      return start;
    }

    if (markdownSpace(code)) {
      return createSpace(effects, start, seen ? 'linePrefix' : 'lineSuffix')(code);
    }

    return ok(code);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/hard-break-escape.js":
/*!*******************************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/hard-break-escape.js ***!
  \*******************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizeHardBreakEscape;

var markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending */ "./node_modules/micromark/dist/character/markdown-line-ending.js");

function tokenizeHardBreakEscape(effects, ok, nok) {
  return start;

  function start(code) {
    effects.enter('hardBreakEscape');
    effects.enter('escapeMarker');
    effects.consume(code);
    return open;
  }

  function open(code) {
    if (markdownLineEnding(code)) {
      effects.exit('escapeMarker');
      effects.exit('hardBreakEscape');
      return ok(code);
    }

    return nok(code);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/heading-atx.js":
/*!*************************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/heading-atx.js ***!
  \*************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizeAtxHeading;
exports.resolve = resolveAtxHeading;

var markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending */ "./node_modules/micromark/dist/character/markdown-line-ending.js");

var markdownLineEndingOrSpace = __webpack_require__(/*! ../character/markdown-line-ending-or-space */ "./node_modules/micromark/dist/character/markdown-line-ending-or-space.js");

var markdownSpace = __webpack_require__(/*! ../character/markdown-space */ "./node_modules/micromark/dist/character/markdown-space.js");

var chunkedSplice = __webpack_require__(/*! ../util/chunked-splice */ "./node_modules/micromark/dist/util/chunked-splice.js");

var createSpace = __webpack_require__(/*! ./factory-space */ "./node_modules/micromark/dist/tokenize/factory-space.js");

function resolveAtxHeading(events, context) {
  var contentEnd = events.length - 2;
  var contentStart = 3;
  var content;
  var text; // Prefix whitespace, part of the opening.

  if (events[contentStart][1].type === 'whitespace') {
    contentStart += 2;
  } // Suffix whitespace, part of the closing.


  if (contentEnd - 2 > contentStart && events[contentEnd][1].type === 'whitespace') {
    contentEnd -= 2;
  }

  if (events[contentEnd][1].type === 'atxHeadingSequence' && (contentStart === contentEnd - 1 || contentEnd - 4 > contentStart && events[contentEnd - 2][1].type === 'whitespace')) {
    contentEnd -= contentStart + 1 === contentEnd ? 2 : 4;
  }

  if (contentEnd > contentStart) {
    content = {
      type: 'atxHeadingText',
      start: events[contentStart][1].start,
      end: events[contentEnd][1].end
    };
    text = {
      type: 'chunkText',
      start: events[contentStart][1].start,
      end: events[contentEnd][1].end,
      contentType: 'text'
    };
    chunkedSplice(events, contentStart, contentEnd - contentStart + 1, [['enter', content, context], ['enter', text, context], ['exit', text, context], ['exit', content, context]]);
  }

  return events;
}

function tokenizeAtxHeading(effects, ok, nok) {
  var self = this;
  var size = 0;
  return start;

  function start(code) {
    effects.enter('atxHeading');
    effects.enter('atxHeadingSequence');
    return fenceOpenInside(code);
  }

  function fenceOpenInside(code) {
    if (code === 35 && size++ < 6) {
      effects.consume(code);
      return fenceOpenInside;
    }

    if (code === null || markdownLineEndingOrSpace(code)) {
      effects.exit('atxHeadingSequence');
      return self.interrupt ? ok(code) : headingBreak(code);
    }

    return nok(code);
  }

  function headingBreak(code) {
    if (code === 35) {
      effects.enter('atxHeadingSequence');
      return sequence(code);
    }

    if (code === null || markdownLineEnding(code)) {
      effects.exit('atxHeading');
      return ok(code);
    }

    if (markdownSpace(code)) {
      return createSpace(effects, headingBreak, 'whitespace')(code);
    }

    effects.enter('atxHeadingText');
    return data(code);
  }

  function sequence(code) {
    if (code === 35) {
      effects.consume(code);
      return sequence;
    }

    effects.exit('atxHeadingSequence');
    return headingBreak(code);
  }

  function data(code) {
    if (code === null || code === 35 || markdownLineEndingOrSpace(code)) {
      effects.exit('atxHeadingText');
      return headingBreak(code);
    }

    effects.consume(code);
    return data;
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/html-flow.js":
/*!***********************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/html-flow.js ***!
  \***********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizeHtml;
exports.resolveTo = resolveToHtml;
exports.concrete = true;

var asciiAlpha = __webpack_require__(/*! ../character/ascii-alpha */ "./node_modules/micromark/dist/character/ascii-alpha.js");

var asciiAlphanumeric = __webpack_require__(/*! ../character/ascii-alphanumeric */ "./node_modules/micromark/dist/character/ascii-alphanumeric.js");

var markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending */ "./node_modules/micromark/dist/character/markdown-line-ending.js");

var markdownLineEndingOrSpace = __webpack_require__(/*! ../character/markdown-line-ending-or-space */ "./node_modules/micromark/dist/character/markdown-line-ending-or-space.js");

var markdownSpace = __webpack_require__(/*! ../character/markdown-space */ "./node_modules/micromark/dist/character/markdown-space.js");

var fromCharCode = __webpack_require__(/*! ../constant/from-char-code */ "./node_modules/micromark/dist/constant/from-char-code.js");

var basics = __webpack_require__(/*! ../constant/html-block-names */ "./node_modules/micromark/dist/constant/html-block-names.js");

var raws = __webpack_require__(/*! ../constant/html-raw-names */ "./node_modules/micromark/dist/constant/html-raw-names.js");

var blank = __webpack_require__(/*! ./partial-blank-line */ "./node_modules/micromark/dist/tokenize/partial-blank-line.js");

var nextBlank = {
  tokenize: tokenizeNextBlank,
  partial: true
};

function resolveToHtml(events) {
  var index = events.length;

  while (index--) {
    if (events[index][0] === 'enter' && events[index][1].type === 'htmlFlow') {
      break;
    }
  }

  if (index > 1 && events[index - 2][1].type === 'linePrefix') {
    // Add the prefix start to the HTML token.
    events[index][1].start = events[index - 2][1].start; // Add the prefix start to the HTML line token.

    events[index + 1][1].start = events[index - 2][1].start; // Remove the line prefix.

    events.splice(index - 2, 2);
  }

  return events;
}

function tokenizeHtml(effects, ok, nok) {
  var self = this;
  var kind;
  var startTag;
  var buffer;
  var index;
  var marker;
  return start;

  function start(code) {
    effects.enter('htmlFlow');
    effects.enter('htmlFlowData');
    effects.consume(code);
    return open;
  }

  function open(code) {
    if (code === 33) {
      effects.consume(code);
      return declarationStart;
    }

    if (code === 47) {
      effects.consume(code);
      return tagCloseStart;
    }

    if (code === 63) {
      effects.consume(code);
      kind = 3; // While we’re in an instruction instead of a declaration, we’re on a `?`
      // right now, so we do need to search for `>`, similar to declarations.

      return self.interrupt ? ok : continuationDeclarationInside;
    }

    if (asciiAlpha(code)) {
      effects.consume(code);
      buffer = fromCharCode(code);
      startTag = true;
      return tagName;
    }

    return nok(code);
  }

  function declarationStart(code) {
    if (code === 45) {
      effects.consume(code);
      kind = 2;
      return commentOpenInside;
    }

    if (code === 91) {
      effects.consume(code);
      kind = 5;
      buffer = 'CDATA[';
      index = 0;
      return cdataOpenInside;
    }

    if (asciiAlpha(code)) {
      effects.consume(code);
      kind = 4;
      return self.interrupt ? ok : continuationDeclarationInside;
    }

    return nok(code);
  }

  function commentOpenInside(code) {
    if (code === 45) {
      effects.consume(code);
      return self.interrupt ? ok : continuationDeclarationInside;
    }

    return nok(code);
  }

  function cdataOpenInside(code) {
    if (code === buffer.charCodeAt(index++)) {
      effects.consume(code);
      return index === buffer.length ? self.interrupt ? ok : continuation : cdataOpenInside;
    }

    return nok(code);
  }

  function tagCloseStart(code) {
    if (asciiAlpha(code)) {
      effects.consume(code);
      buffer = fromCharCode(code);
      return tagName;
    }

    return nok(code);
  }

  function tagName(code) {
    if (code === null || code === 47 || code === 62 || markdownLineEndingOrSpace(code)) {
      if (code !== 47 && startTag && raws.indexOf(buffer.toLowerCase()) > -1) {
        kind = 1;
        return self.interrupt ? ok(code) : continuation(code);
      }

      if (basics.indexOf(buffer.toLowerCase()) > -1) {
        kind = 6;

        if (code === 47) {
          effects.consume(code);
          return basicSelfClosing;
        }

        return self.interrupt ? ok(code) : continuation(code);
      }

      kind = 7; // Do not support complete HTML when interrupting.

      return self.interrupt ? nok(code) : startTag ? completeAttributeNameBefore(code) : completeClosingTagAfter(code);
    }

    if (code === 45 || asciiAlphanumeric(code)) {
      effects.consume(code);
      buffer += fromCharCode(code);
      return tagName;
    }

    return nok(code);
  }

  function basicSelfClosing(code) {
    if (code === 62) {
      effects.consume(code);
      return self.interrupt ? ok : continuation;
    }

    return nok(code);
  }

  function completeClosingTagAfter(code) {
    if (markdownSpace(code)) {
      effects.consume(code);
      return completeClosingTagAfter;
    }

    return completeEnd(code);
  }

  function completeAttributeNameBefore(code) {
    if (code === 47) {
      effects.consume(code);
      return completeEnd;
    }

    if (code === 58 || code === 95 || asciiAlpha(code)) {
      effects.consume(code);
      return completeAttributeName;
    }

    if (markdownSpace(code)) {
      effects.consume(code);
      return completeAttributeNameBefore;
    }

    return completeEnd(code);
  }

  function completeAttributeName(code) {
    if (code === 45 || code === 46 || code === 58 || code === 95 || asciiAlphanumeric(code)) {
      effects.consume(code);
      return completeAttributeName;
    }

    return completeAttributeNameAfter(code);
  }

  function completeAttributeNameAfter(code) {
    if (code === 61) {
      effects.consume(code);
      return completeAttributeValueBefore;
    }

    if (markdownSpace(code)) {
      effects.consume(code);
      return completeAttributeNameAfter;
    }

    return completeAttributeNameBefore(code);
  }

  function completeAttributeValueBefore(code) {
    if (code === null || code === 60 || code === 61 || code === 62 || code === 96) {
      return nok(code);
    }

    if (code === 34 || code === 39) {
      effects.consume(code);
      marker = code;
      return completeAttributeValueQuoted;
    }

    if (markdownSpace(code)) {
      effects.consume(code);
      return completeAttributeValueBefore;
    }

    marker = undefined;
    return completeAttributeValueUnquoted(code);
  }

  function completeAttributeValueQuoted(code) {
    if (code === marker) {
      effects.consume(code);
      return completeAttributeValueQuotedAfter;
    }

    if (code === null || markdownLineEnding(code)) {
      return nok(code);
    }

    effects.consume(code);
    return completeAttributeValueQuoted;
  }

  function completeAttributeValueUnquoted(code) {
    if (code === null || code === 34 || code === 39 || code === 60 || code === 61 || code === 62 || code === 96 || markdownLineEndingOrSpace(code)) {
      return completeAttributeNameAfter(code);
    }

    effects.consume(code);
    return completeAttributeValueUnquoted;
  }

  function completeAttributeValueQuotedAfter(code) {
    if (code === 47 || code === 62 || markdownSpace(code)) {
      return completeAttributeNameBefore(code);
    }

    return nok(code);
  }

  function completeEnd(code) {
    if (code === 62) {
      effects.consume(code);
      return completeAfter;
    }

    return nok(code);
  }

  function completeAfter(code) {
    if (markdownSpace(code)) {
      effects.consume(code);
      return completeAfter;
    }

    return code === null || markdownLineEnding(code) ? continuation(code) : nok(code);
  }

  function continuation(code) {
    if (code === 45 && kind === 2) {
      effects.consume(code);
      return continuationCommentInside;
    }

    if (code === 60 && kind === 1) {
      effects.consume(code);
      return continuationRawTagOpen;
    }

    if (code === 62 && kind === 4) {
      effects.consume(code);
      return continuationClose;
    }

    if (code === 63 && kind === 3) {
      effects.consume(code);
      return continuationDeclarationInside;
    }

    if (code === 93 && kind === 5) {
      effects.consume(code);
      return continuationCharacterDataInside;
    }

    if (markdownLineEnding(code) && (kind === 6 || kind === 7)) {
      return effects.check(nextBlank, continuationClose, continuationAtLineEnding)(code);
    }

    if (code === null || markdownLineEnding(code)) {
      return continuationAtLineEnding(code);
    }

    effects.consume(code);
    return continuation;
  }

  function continuationAtLineEnding(code) {
    effects.exit('htmlFlowData');
    return htmlContinueStart(code);
  }

  function htmlContinueStart(code) {
    if (code === null) {
      return done(code);
    }

    if (markdownLineEnding(code)) {
      effects.enter('lineEnding');
      effects.consume(code);
      effects.exit('lineEnding');
      return htmlContinueStart;
    }

    effects.enter('htmlFlowData');
    return continuation(code);
  }

  function continuationCommentInside(code) {
    if (code === 45) {
      effects.consume(code);
      return continuationDeclarationInside;
    }

    return continuation(code);
  }

  function continuationRawTagOpen(code) {
    if (code === 47) {
      effects.consume(code);
      buffer = '';
      return continuationRawEndTag;
    }

    return continuation(code);
  }

  function continuationRawEndTag(code) {
    if (code === 62 && raws.indexOf(buffer.toLowerCase()) > -1) {
      effects.consume(code);
      return continuationClose;
    }

    if (asciiAlpha(code) && buffer.length < 6) {
      effects.consume(code);
      buffer += fromCharCode(code);
      return continuationRawEndTag;
    }

    return continuation(code);
  }

  function continuationCharacterDataInside(code) {
    if (code === 93) {
      effects.consume(code);
      return continuationDeclarationInside;
    }

    return continuation(code);
  }

  function continuationDeclarationInside(code) {
    if (code === 62) {
      effects.consume(code);
      return continuationClose;
    }

    return continuation(code);
  }

  function continuationClose(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit('htmlFlowData');
      return done(code);
    }

    effects.consume(code);
    return continuationClose;
  }

  function done(code) {
    effects.exit('htmlFlow');
    return ok(code);
  }
}

function tokenizeNextBlank(effects, ok, nok) {
  return start;

  function start(code) {
    effects.exit('htmlFlowData');
    effects.enter('lineEndingBlank');
    effects.consume(code);
    effects.exit('lineEndingBlank');
    return effects.attempt(blank, ok, nok);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/html-text.js":
/*!***********************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/html-text.js ***!
  \***********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizeHtml;

var markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending */ "./node_modules/micromark/dist/character/markdown-line-ending.js");

var markdownLineEndingOrSpace = __webpack_require__(/*! ../character/markdown-line-ending-or-space */ "./node_modules/micromark/dist/character/markdown-line-ending-or-space.js");

var markdownSpace = __webpack_require__(/*! ../character/markdown-space */ "./node_modules/micromark/dist/character/markdown-space.js");

var asciiAlpha = __webpack_require__(/*! ../character/ascii-alpha */ "./node_modules/micromark/dist/character/ascii-alpha.js");

var asciiAlphanumeric = __webpack_require__(/*! ../character/ascii-alphanumeric */ "./node_modules/micromark/dist/character/ascii-alphanumeric.js");

var createSpace = __webpack_require__(/*! ./factory-space */ "./node_modules/micromark/dist/tokenize/factory-space.js");

function tokenizeHtml(effects, ok, nok) {
  var marker;
  var buffer;
  var index;
  var returnState;
  return start;

  function start(code) {
    effects.enter('htmlText');
    effects.enter('htmlTextData');
    effects.consume(code);
    return open;
  }

  function open(code) {
    if (code === 33) {
      effects.consume(code);
      return declarationOpen;
    }

    if (code === 47) {
      effects.consume(code);
      return tagCloseStart;
    }

    if (code === 63) {
      effects.consume(code);
      return instruction;
    }

    if (asciiAlpha(code)) {
      effects.consume(code);
      return tagOpen;
    }

    return nok(code);
  }

  function declarationOpen(code) {
    if (code === 45) {
      effects.consume(code);
      return commentOpen;
    }

    if (code === 91) {
      effects.consume(code);
      buffer = 'CDATA[';
      index = 0;
      return cdataOpen;
    }

    if (asciiAlpha(code)) {
      effects.consume(code);
      return declaration;
    }

    return nok(code);
  }

  function commentOpen(code) {
    if (code === 45) {
      effects.consume(code);
      return commentStart;
    }

    return nok(code);
  }

  function commentStart(code) {
    if (code === null || code === 62) {
      return nok(code);
    }

    if (code === 45) {
      effects.consume(code);
      return commentStartDash;
    }

    return comment(code);
  }

  function commentStartDash(code) {
    if (code === null || code === 62) {
      return nok(code);
    }

    return comment(code);
  }

  function comment(code) {
    if (code === null) {
      return nok(code);
    }

    if (code === 45) {
      effects.consume(code);
      return commentClose;
    }

    if (markdownLineEnding(code)) {
      returnState = comment;
      return atLineEnding(code);
    }

    effects.consume(code);
    return comment;
  }

  function commentClose(code) {
    if (code === 45) {
      effects.consume(code);
      return end;
    }

    return comment(code);
  }

  function cdataOpen(code) {
    if (code === buffer.charCodeAt(index++)) {
      effects.consume(code);
      return index === buffer.length ? cdata : cdataOpen;
    }

    return nok(code);
  }

  function cdata(code) {
    if (code === null) {
      return nok(code);
    }

    if (code === 93) {
      effects.consume(code);
      return cdataClose;
    }

    effects.consume(code);
    return cdata;
  }

  function cdataClose(code) {
    if (code === 93) {
      effects.consume(code);
      return cdataEnd;
    }

    return cdata(code);
  }

  function cdataEnd(code) {
    if (code === 62) {
      return end(code);
    }

    if (code === 93) {
      effects.consume(code);
      return cdataEnd;
    }

    return cdata(code);
  }

  function declaration(code) {
    if (code === null || code === 62) {
      return end(code);
    }

    if (markdownLineEnding(code)) {
      returnState = declaration;
      return atLineEnding(code);
    }

    effects.consume(code);
    return declaration;
  }

  function instruction(code) {
    if (code === null) {
      return nok(code);
    }

    if (code === 63) {
      effects.consume(code);
      return instructionClose;
    }

    if (markdownLineEnding(code)) {
      returnState = instruction;
      return atLineEnding(code);
    }

    effects.consume(code);
    return instruction;
  }

  function instructionClose(code) {
    return code === 62 ? end(code) : instruction(code);
  }

  function tagCloseStart(code) {
    if (asciiAlpha(code)) {
      effects.consume(code);
      return tagClose;
    }

    return nok(code);
  }

  function tagClose(code) {
    if (code === 45 || asciiAlphanumeric(code)) {
      effects.consume(code);
      return tagClose;
    }

    return tagCloseBetween(code);
  }

  function tagCloseBetween(code) {
    if (markdownLineEnding(code)) {
      returnState = tagCloseBetween;
      return atLineEnding(code);
    }

    if (markdownSpace(code)) {
      effects.consume(code);
      return tagCloseBetween;
    }

    return end(code);
  }

  function tagOpen(code) {
    if (code === 45 || asciiAlphanumeric(code)) {
      effects.consume(code);
      return tagOpen;
    }

    if (code === 47 || code === 62 || markdownLineEndingOrSpace(code)) {
      return tagOpenBetween(code);
    }

    return nok(code);
  }

  function tagOpenBetween(code) {
    if (code === 47) {
      effects.consume(code);
      return end;
    }

    if (code === 58 || code === 95 || asciiAlpha(code)) {
      effects.consume(code);
      return tagOpenAttributeName;
    }

    if (markdownLineEnding(code)) {
      returnState = tagOpenBetween;
      return atLineEnding(code);
    }

    if (markdownSpace(code)) {
      effects.consume(code);
      return tagOpenBetween;
    }

    return end(code);
  }

  function tagOpenAttributeName(code) {
    if (code === 45 || code === 46 || code === 58 || code === 95 || asciiAlphanumeric(code)) {
      effects.consume(code);
      return tagOpenAttributeName;
    }

    return tagOpenAttributeNameAfter(code);
  }

  function tagOpenAttributeNameAfter(code) {
    if (code === 61) {
      effects.consume(code);
      return tagOpenAttributeValueBefore;
    }

    if (markdownLineEnding(code)) {
      returnState = tagOpenAttributeNameAfter;
      return atLineEnding(code);
    }

    if (markdownSpace(code)) {
      effects.consume(code);
      return tagOpenAttributeNameAfter;
    }

    return tagOpenBetween(code);
  }

  function tagOpenAttributeValueBefore(code) {
    if (code === null || code === 60 || code === 61 || code === 62 || code === 96) {
      return nok(code);
    }

    if (code === 34 || code === 39) {
      effects.consume(code);
      marker = code;
      return tagOpenAttributeValueQuoted;
    }

    if (markdownLineEnding(code)) {
      returnState = tagOpenAttributeValueBefore;
      return atLineEnding(code);
    }

    if (markdownSpace(code)) {
      effects.consume(code);
      return tagOpenAttributeValueBefore;
    }

    effects.consume(code);
    marker = undefined;
    return tagOpenAttributeValueUnquoted;
  }

  function tagOpenAttributeValueQuoted(code) {
    if (code === marker) {
      effects.consume(code);
      return tagOpenAttributeValueQuotedAfter;
    }

    if (code === null) {
      return nok(code);
    }

    if (markdownLineEnding(code)) {
      returnState = tagOpenAttributeValueQuoted;
      return atLineEnding(code);
    }

    effects.consume(code);
    return tagOpenAttributeValueQuoted;
  }

  function tagOpenAttributeValueQuotedAfter(code) {
    if (code === 62 || code === 47 || markdownLineEndingOrSpace(code)) {
      return tagOpenBetween(code);
    }

    return nok(code);
  }

  function tagOpenAttributeValueUnquoted(code) {
    if (code === null || code === 34 || code === 39 || code === 60 || code === 61 || code === 96) {
      return nok(code);
    }

    if (code === 62 || markdownLineEndingOrSpace(code)) {
      return tagOpenBetween(code);
    }

    effects.consume(code);
    return tagOpenAttributeValueUnquoted;
  } // We can’t have blank lines in content, so no need to worry about empty
  // tokens.


  function atLineEnding(code) {
    effects.exit('htmlTextData');
    effects.enter('lineEnding');
    effects.consume(code);
    effects.exit('lineEnding');
    return createSpace(effects, afterPrefix, 'linePrefix', 4);
  }

  function afterPrefix(code) {
    effects.enter('htmlTextData');
    return returnState(code);
  }

  function end(code) {
    if (code === 62) {
      effects.consume(code);
      effects.exit('htmlTextData');
      effects.exit('htmlText');
      return ok;
    }

    return nok(code);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/label-end.js":
/*!***********************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/label-end.js ***!
  \***********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizeLabelEnd;
exports.resolveTo = resolveToLabelEnd;
exports.resolveAll = resolveAllLabelEnd;

var markdownLineEndingOrSpace = __webpack_require__(/*! ../character/markdown-line-ending-or-space */ "./node_modules/micromark/dist/character/markdown-line-ending-or-space.js");

var normalizeIdentifier = __webpack_require__(/*! ../util/normalize-identifier */ "./node_modules/micromark/dist/util/normalize-identifier.js");

var chunkedSplice = __webpack_require__(/*! ../util/chunked-splice */ "./node_modules/micromark/dist/util/chunked-splice.js");

var resolveAll = __webpack_require__(/*! ../util/resolve-all */ "./node_modules/micromark/dist/util/resolve-all.js");

var shallow = __webpack_require__(/*! ../util/shallow */ "./node_modules/micromark/dist/util/shallow.js");

var createDestination = __webpack_require__(/*! ./factory-destination */ "./node_modules/micromark/dist/tokenize/factory-destination.js");

var createLabel = __webpack_require__(/*! ./factory-label */ "./node_modules/micromark/dist/tokenize/factory-label.js");

var createWhitespace = __webpack_require__(/*! ./factory-whitespace */ "./node_modules/micromark/dist/tokenize/factory-whitespace.js");

var createTitle = __webpack_require__(/*! ./factory-title */ "./node_modules/micromark/dist/tokenize/factory-title.js");

var resource = {
  tokenize: tokenizeResource
};
var fullReference = {
  tokenize: tokenizeFullReference
};
var collapsedReference = {
  tokenize: tokenizeCollapsedReference
};

function resolveAllLabelEnd(events) {
  var index = -1;
  var token;

  while (++index < events.length) {
    token = events[index][1];

    if (!token._used && (token.type === 'labelImage' || token.type === 'labelLink' || token.type === 'labelEnd')) {
      // Remove the marker.
      events.splice(index + 1, token.type === 'labelImage' ? 4 : 2);
      token.type = 'data';
      index++;
    }
  }

  return events;
}

function resolveToLabelEnd(events, context) {
  var index = events.length;
  var offset = 0;
  var group;
  var label;
  var text;
  var token;
  var open;
  var close;
  var media; // Find an opening.

  while (index--) {
    token = events[index][1];

    if (open) {
      // If we see another link, or inactive link label, we’ve been here before.
      if (token.type === 'link' || token.type === 'labelLink' && token._inactive) {
        break;
      } // Mark other link openings as inactive, as we can’t have links in
      // links.


      if (events[index][0] === 'enter' && token.type === 'labelLink') {
        token._inactive = true;
      }
    } else if (close) {
      if (events[index][0] === 'enter' && (token.type === 'labelImage' || token.type === 'labelLink') && !token._balanced) {
        open = index;

        if (token.type !== 'labelLink') {
          offset = 2;
          break;
        }
      }
    } else if (token.type === 'labelEnd') {
      close = index;
    }
  }

  group = {
    type: events[open][1].type === 'labelLink' ? 'link' : 'image',
    start: shallow(events[open][1].start),
    end: shallow(events[events.length - 1][1].end)
  };
  label = {
    type: 'label',
    start: shallow(events[open][1].start),
    end: shallow(events[close][1].end)
  };
  text = {
    type: 'labelText',
    start: shallow(events[open + offset + 2][1].end),
    end: shallow(events[close - 2][1].start)
  };
  media = [['enter', group, context], ['enter', label, context]]; // Opening marker.

  chunkedSplice(media, media.length, 0, events.slice(open + 1, open + offset + 3)); // Text open.

  chunkedSplice(media, media.length, 0, [['enter', text, context]]); // Between.

  chunkedSplice(media, media.length, 0, resolveAll(context.parser.constructs.insideSpan["null"], events.slice(open + offset + 4, close - 3), context)); // Text close, marker close, label close.

  chunkedSplice(media, media.length, 0, [['exit', text, context], events[close - 2], events[close - 1], ['exit', label, context]]); // Reference, resource, or so.

  chunkedSplice(media, media.length, 0, events.slice(close + 1)); // Media close.

  chunkedSplice(media, media.length, 0, [['exit', group, context]]);
  chunkedSplice(events, open, events.length, media);
  return events;
}

function tokenizeLabelEnd(effects, ok, nok) {
  var self = this;
  var index = self.events.length;
  var labelStart;
  var defined; // Find an opening.

  while (index--) {
    if ((self.events[index][1].type === 'labelImage' || self.events[index][1].type === 'labelLink') && !self.events[index][1]._balanced) {
      labelStart = self.events[index][1];
      break;
    }
  }

  return start;

  function start(code) {
    if (!labelStart) {
      return nok(code);
    } // It’s a balanced bracket, but contains a link.


    if (labelStart._inactive) return balanced(code);
    defined = self.parser.defined.indexOf(normalizeIdentifier(self.sliceSerialize({
      start: labelStart.end,
      end: self.now()
    }))) > -1;
    effects.enter('labelEnd');
    effects.enter('labelMarker');
    effects.consume(code);
    effects.exit('labelMarker');
    effects.exit('labelEnd');
    return afterLabelEnd;
  }

  function afterLabelEnd(code) {
    // Resource: `[asd](fgh)`.
    if (code === 40) {
      return effects.attempt(resource, ok, defined ? ok : balanced)(code);
    } // Collapsed (`[asd][]`) or full (`[asd][fgh]`) reference?


    if (code === 91) {
      return effects.attempt(fullReference, ok, defined ? effects.attempt(collapsedReference, ok, balanced) : balanced)(code);
    } // Shortcut reference: `[asd]`?


    return defined ? ok(code) : balanced(code);
  }

  function balanced(code) {
    labelStart._balanced = true;
    return nok(code);
  }
}

function tokenizeResource(effects, ok, nok) {
  return start;

  function start(code) {
    effects.enter('resource');
    effects.enter('resourceMarker');
    effects.consume(code);
    effects.exit('resourceMarker');
    return createWhitespace(effects, open);
  }

  function open(code) {
    if (code === 41) {
      return end(code);
    }

    return createDestination(effects, destinationAfter, nok, 'resourceDestination', 'resourceDestinationLiteral', 'resourceDestinationLiteralMarker', 'resourceDestinationRaw', 'resourceDestinationString', 3)(code);
  }

  function destinationAfter(code) {
    return markdownLineEndingOrSpace(code) ? createWhitespace(effects, between)(code) : end(code);
  }

  function between(code) {
    if (code === 34 || code === 39 || code === 40) {
      return createTitle(effects, createWhitespace(effects, end), nok, 'resourceTitle', 'resourceTitleMarker', 'resourceTitleString')(code);
    }

    return end(code);
  }

  function end(code) {
    if (code === 41) {
      effects.enter('resourceMarker');
      effects.consume(code);
      effects.exit('resourceMarker');
      effects.exit('resource');
      return ok;
    }

    return nok(code);
  }
}

function tokenizeFullReference(effects, ok, nok) {
  var self = this;
  return start;

  function start(code) {
    return createLabel.call(self, effects, afterLabel, nok, 'reference', 'referenceMarker', 'referenceString')(code);
  }

  function afterLabel(code) {
    return self.parser.defined.indexOf(normalizeIdentifier(self.sliceSerialize(self.events[self.events.length - 1][1]).slice(1, -1))) < 0 ? nok(code) : ok(code);
  }
}

function tokenizeCollapsedReference(effects, ok, nok) {
  return start;

  function start(code) {
    effects.enter('reference');
    effects.enter('referenceMarker');
    effects.consume(code);
    effects.exit('referenceMarker');
    return open;
  }

  function open(code) {
    if (code === 93) {
      effects.enter('referenceMarker');
      effects.consume(code);
      effects.exit('referenceMarker');
      effects.exit('reference');
      return ok;
    }

    return nok(code);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/label-start-image.js":
/*!*******************************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/label-start-image.js ***!
  \*******************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizelabelImage;
exports.resolveAll = __webpack_require__(/*! ./label-end */ "./node_modules/micromark/dist/tokenize/label-end.js").resolveAll;

function tokenizelabelImage(effects, ok, nok) {
  var self = this;
  return start;

  function start(code) {
    effects.enter('labelImage');
    effects.enter('labelImageMarker');
    effects.consume(code);
    effects.exit('labelImageMarker');
    return open;
  }

  function open(code) {
    if (code === 91) {
      effects.enter('labelMarker');
      effects.consume(code);
      effects.exit('labelMarker');
      effects.exit('labelImage');
      return after;
    }

    return nok(code);
  }

  function after(code) {
    /* istanbul ignore next - footnotes. */
    return code === 94 && '_hiddenFootnoteSupport' in self.parser.constructs ? nok(code) : ok(code);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/label-start-link.js":
/*!******************************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/label-start-link.js ***!
  \******************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizelabelLink;
exports.resolveAll = __webpack_require__(/*! ./label-end */ "./node_modules/micromark/dist/tokenize/label-end.js").resolveAll;

function tokenizelabelLink(effects, ok, nok) {
  var self = this;
  return start;

  function start(code) {
    effects.enter('labelLink');
    effects.enter('labelMarker');
    effects.consume(code);
    effects.exit('labelMarker');
    effects.exit('labelLink');
    return after;
  }

  function after(code) {
    /* istanbul ignore next - footnotes. */
    return code === 94 && '_hiddenFootnoteSupport' in self.parser.constructs ? nok(code) : ok(code);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/line-ending.js":
/*!*************************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/line-ending.js ***!
  \*************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizeWhitespace;

var markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending */ "./node_modules/micromark/dist/character/markdown-line-ending.js");

var createSpace = __webpack_require__(/*! ./factory-space */ "./node_modules/micromark/dist/tokenize/factory-space.js");

function tokenizeWhitespace(effects, ok) {
  return start;

  function start(code) {
    effects.enter('lineEnding');
    effects.consume(code);
    effects.exit('lineEnding');
    return createSpace(effects, ok, 'linePrefix');
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/list.js":
/*!******************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/list.js ***!
  \******************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizeListStart;
exports.continuation = {
  tokenize: tokenizeListContinuation
};
exports.exit = tokenizeListEnd;

var markdownSpace = __webpack_require__(/*! ../character/markdown-space */ "./node_modules/micromark/dist/character/markdown-space.js");

var asciiDigit = __webpack_require__(/*! ../character/ascii-digit */ "./node_modules/micromark/dist/character/ascii-digit.js");

var prefixSize = __webpack_require__(/*! ../util/prefix-size */ "./node_modules/micromark/dist/util/prefix-size.js");

var sizeChunks = __webpack_require__(/*! ../util/size-chunks */ "./node_modules/micromark/dist/util/size-chunks.js");

var thematicBreak = __webpack_require__(/*! ./thematic-break */ "./node_modules/micromark/dist/tokenize/thematic-break.js");

var createSpace = __webpack_require__(/*! ./factory-space */ "./node_modules/micromark/dist/tokenize/factory-space.js");

var blank = __webpack_require__(/*! ./partial-blank-line */ "./node_modules/micromark/dist/tokenize/partial-blank-line.js");

function tokenizeListStart(effects, ok, nok) {
  var self = this;
  var initialSize = prefixSize(self.events, 'linePrefix');
  var valueSize;
  return start;

  function start(code) {
    if ((code === 42 || code === 43 || code === 45) && (!self.containerState.marker || code === self.containerState.marker)) {
      return code === 42 || code === 45 ? effects.check(thematicBreak, nok, unordered)(code) : unordered(code);
    }

    if (asciiDigit(code) && (!self.containerState.type || self.containerState.type === 'listOrdered')) {
      return ordered(code);
    }

    return nok(code);
  }

  function unordered(code) {
    if (!self.containerState.type) {
      self.containerState.type = 'listUnordered';
      effects.enter(self.containerState.type, {
        _container: true
      });
    }

    effects.enter('listItemPrefix');
    return atMarker(code);
  }

  function ordered(code) {
    if (self.containerState.type || !self.interrupt || code === 49) {
      if (!self.containerState.type) {
        self.containerState.type = 'listOrdered';
        effects.enter(self.containerState.type, {
          _container: true
        });
      }

      effects.enter('listItemPrefix');
      effects.enter('listItemValue');
      effects.consume(code);
      valueSize = 1;
      return self.interrupt ? afterValue : inside;
    }

    return nok(code);
  }

  function inside(code) {
    if (asciiDigit(code) && ++valueSize < 10) {
      effects.consume(code);
      return inside;
    }

    return afterValue(code);
  }

  function afterValue(code) {
    effects.exit('listItemValue');
    return code === 41 || code === 46 ? atMarker(code) : nok(code);
  }

  function atMarker(code) {
    self.containerState.marker = self.containerState.marker || code;

    if (code === self.containerState.marker) {
      effects.enter('listItemMarker');
      effects.consume(code);
      effects.exit('listItemMarker');
      return effects.check(blank, // Can’t be empty when interrupting.
      self.interrupt ? nok : onBlank, effects.attempt({
        tokenize: tokenizeListItemPrefixWhitespace,
        partial: true
      }, endOfPrefix, otherPrefix));
    }

    return nok(code);
  }

  function onBlank(code) {
    self.containerState.initialBlankLine = true;
    initialSize++;
    return endOfPrefix(code);
  }

  function otherPrefix(code) {
    if (markdownSpace(code)) {
      effects.enter('listItemPrefixWhitespace');
      effects.consume(code);
      effects.exit('listItemPrefixWhitespace');
      return endOfPrefix;
    }

    return nok(code);
  }

  function endOfPrefix(code) {
    self.containerState.size = initialSize + sizeChunks(self.sliceStream(effects.exit('listItemPrefix')));
    return ok(code);
  }
}

function tokenizeListContinuation(effects, ok, nok) {
  var self = this;
  self.containerState._closeFlow = undefined;
  return effects.check(blank, onBlank, notBlank);

  function onBlank(code) {
    self.containerState.furtherBlankLines = self.containerState.furtherBlankLines || self.containerState.initialBlankLine;
    return ok(code);
  }

  function notBlank(code) {
    if (self.containerState.furtherBlankLines || !markdownSpace(code)) {
      self.containerState.furtherBlankLines = self.containerState.initialBlankLine = undefined;
      return notInCurrentItem(code);
    }

    self.containerState.furtherBlankLines = self.containerState.initialBlankLine = undefined;
    return effects.attempt({
      tokenize: tokenizeIndent,
      partial: true
    }, ok, notInCurrentItem)(code);
  }

  function notInCurrentItem(code) {
    // While we do continue, we signal that the flow should be closed.
    self.containerState._closeFlow = true; // As we’re closing flow, we’re no longer interrupting

    self.interrupt = undefined;
    return createSpace(effects, effects.attempt(exports, ok, nok), 'linePrefix', 4)(code);
  }
}

function tokenizeIndent(effects, ok, nok) {
  var self = this;
  return createSpace(effects, afterPrefix, 'listItemIndent', self.containerState.size + 1);

  function afterPrefix(code) {
    return prefixSize(self.events, 'listItemIndent') === self.containerState.size ? ok(code) : nok(code);
  }
}

function tokenizeListEnd(effects) {
  effects.exit(this.containerState.type);
}

function tokenizeListItemPrefixWhitespace(effects, ok, nok) {
  var self = this;
  return createSpace(effects, afterPrefix, 'listItemPrefixWhitespace', 4 + 1);

  function afterPrefix(code) {
    return markdownSpace(code) || !prefixSize(self.events, 'listItemPrefixWhitespace') ? nok(code) : ok(code);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/partial-blank-line.js":
/*!********************************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/partial-blank-line.js ***!
  \********************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizeBlankLine;
exports.partial = true;

var markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending */ "./node_modules/micromark/dist/character/markdown-line-ending.js");

var createSpace = __webpack_require__(/*! ./factory-space */ "./node_modules/micromark/dist/tokenize/factory-space.js");

function tokenizeBlankLine(effects, ok, nok) {
  return createSpace(effects, afterWhitespace, 'linePrefix');

  function afterWhitespace(code) {
    return code === null || markdownLineEnding(code) ? ok(code) : nok(code);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/setext-underline.js":
/*!******************************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/setext-underline.js ***!
  \******************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizeSetextUnderline;
exports.resolveTo = resolveToSetextUnderline;

var markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending */ "./node_modules/micromark/dist/character/markdown-line-ending.js");

var shallow = __webpack_require__(/*! ../util/shallow */ "./node_modules/micromark/dist/util/shallow.js");

var createSpace = __webpack_require__(/*! ./factory-space */ "./node_modules/micromark/dist/tokenize/factory-space.js");

function resolveToSetextUnderline(events, context) {
  var index = events.length;
  var content;
  var text;
  var definition;
  var heading; // Find the opening of the content.
  // It’ll always exist: we don’t tokenize if it isn’t there.

  while (index--) {
    if (events[index][0] === 'enter') {
      if (events[index][1].type === 'content') {
        content = index;
        break;
      }

      if (events[index][1].type === 'paragraph') {
        text = index;
      }
    } // Exit
    else {
        if (events[index][1].type === 'content') {
          // Remove the content end (if needed we’ll add it later)
          events.splice(index, 1);
        }

        if (!definition && events[index][1].type === 'definition') {
          definition = index;
        }
      }
  }

  heading = {
    type: 'setextHeading',
    start: shallow(events[text][1].start),
    end: shallow(events[events.length - 1][1].end)
  }; // Change the paragraph to setext heading text.

  events[text][1].type = 'setextHeadingText'; // If we have definitions in the content, we’ll keep on having content,
  // but we need move it.

  if (definition) {
    events.splice(text, 0, ['enter', heading, context]);
    events.splice(definition + 1, 0, ['exit', events[content][1], context]);
    events[content][1].end = shallow(events[definition][1].end);
  } else {
    events[content][1] = heading;
  } // Add the heading exit at the end.


  events.push(['exit', heading, context]);
  return events;
}

function tokenizeSetextUnderline(effects, ok, nok) {
  var self = this;
  var index = self.events.length;
  var marker;
  var paragraph; // Find an opening.

  while (index--) {
    // Skip enter/exit of line ending, line prefix, and content.
    // We can now either have a definition or a paragraph.
    if (self.events[index][1].type !== 'lineEnding' && self.events[index][1].type !== 'linePrefix' && self.events[index][1].type !== 'content') {
      paragraph = self.events[index][1].type === 'paragraph';
      break;
    }
  }

  return start;

  function start(code) {
    if (!self.lazy && (self.interrupt || paragraph)) {
      effects.enter('setextHeadingLine');
      effects.enter('setextHeadingLineSequence');
      marker = code;
      return closingSequence(code);
    }

    return nok(code);
  }

  function closingSequence(code) {
    if (code === marker) {
      effects.consume(code);
      return closingSequence;
    }

    effects.exit('setextHeadingLineSequence');
    return createSpace(effects, closingSequenceEnd, 'lineSuffix')(code);
  }

  function closingSequenceEnd(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit('setextHeadingLine');
      return ok(code);
    }

    return nok(code);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/tokenize/thematic-break.js":
/*!****************************************************************!*\
  !*** ./node_modules/micromark/dist/tokenize/thematic-break.js ***!
  \****************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

exports.tokenize = tokenizeThematicBreak;

var markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending */ "./node_modules/micromark/dist/character/markdown-line-ending.js");

var markdownSpace = __webpack_require__(/*! ../character/markdown-space */ "./node_modules/micromark/dist/character/markdown-space.js");

var createSpace = __webpack_require__(/*! ./factory-space */ "./node_modules/micromark/dist/tokenize/factory-space.js");

function tokenizeThematicBreak(effects, ok, nok) {
  var size = 0;
  var marker;
  return start;

  function start(code) {
    effects.enter('thematicBreak');
    marker = code;
    return atBreak(code);
  }

  function atBreak(code) {
    if (code === marker) {
      effects.enter('thematicBreakSequence');
      return sequence(code);
    }

    if (markdownSpace(code)) {
      return createSpace(effects, atBreak, 'whitespace')(code);
    }

    if (size < 3 || code !== null && !markdownLineEnding(code)) {
      return nok(code);
    }

    effects.exit('thematicBreak');
    return ok(code);
  }

  function sequence(code) {
    if (code === marker) {
      effects.consume(code);
      size++;
      return sequence;
    }

    effects.exit('thematicBreakSequence');
    return atBreak(code);
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/util/chunked-splice.js":
/*!************************************************************!*\
  !*** ./node_modules/micromark/dist/util/chunked-splice.js ***!
  \************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = chunkedSplice;
var v8MaxSafeChunkSize = 10000; // `Array#splice` takes all items to be inserted as individual argument which
// causes a stack overflow in V8 when trying to insert 100k items for instance.

function chunkedSplice(list, start, remove, items) {
  var end = list.length;
  var chunkStart = 0;
  var result;
  var parameters; // Make start between zero and `end` (included).

  if (start < 0) {
    start = -start > end ? 0 : end + start;
  } else {
    start = start > end ? end : start;
  }

  remove = remove > 0 ? remove : 0; // No need to chunk the items if there’s only a couple (10k) items.

  if (items.length < v8MaxSafeChunkSize) {
    parameters = Array.from(items);
    parameters.unshift(start, remove);
    return [].splice.apply(list, parameters);
  } // Delete `remove` items starting from `start`


  result = [].splice.apply(list, [start, remove]); // Insert the items in chunks to not cause stack overflows.

  while (chunkStart < items.length) {
    parameters = items.slice(chunkStart, chunkStart + v8MaxSafeChunkSize);
    parameters.unshift(start, 0);
    [].splice.apply(list, parameters);
    chunkStart += v8MaxSafeChunkSize;
    start += v8MaxSafeChunkSize;
  }

  return result;
}

/***/ }),

/***/ "./node_modules/micromark/dist/util/classify-character.js":
/*!****************************************************************!*\
  !*** ./node_modules/micromark/dist/util/classify-character.js ***!
  \****************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = classifyCharacter;

var markdownLineEndingOrSpace = __webpack_require__(/*! ../character/markdown-line-ending-or-space */ "./node_modules/micromark/dist/character/markdown-line-ending-or-space.js");

var unicodePunctuation = __webpack_require__(/*! ../character/unicode-punctuation */ "./node_modules/micromark/dist/character/unicode-punctuation.js");

var unicodeWhitespace = __webpack_require__(/*! ../character/unicode-whitespace */ "./node_modules/micromark/dist/character/unicode-whitespace.js"); // Classify whether a character is unicode whitespace, unicode punctuation, or
// anything else.
// Used for attention (emphasis, strong), whose sequences can open or close
// based on the class of surrounding characters.


function classifyCharacter(code) {
  if (code === null || markdownLineEndingOrSpace(code) || unicodeWhitespace(code)) {
    return 1;
  }

  if (unicodePunctuation(code)) {
    return 2;
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/util/combine-extensions.js":
/*!****************************************************************!*\
  !*** ./node_modules/micromark/dist/util/combine-extensions.js ***!
  \****************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = combineExtensions;

var own = __webpack_require__(/*! ../constant/has-own-property */ "./node_modules/micromark/dist/constant/has-own-property.js");

var miniflat = __webpack_require__(/*! ./miniflat */ "./node_modules/micromark/dist/util/miniflat.js");

var chunkedSplice = __webpack_require__(/*! ./chunked-splice */ "./node_modules/micromark/dist/util/chunked-splice.js"); // Combine several syntax extensions into one.


function combineExtensions(extensions) {
  var all = {};
  var index = -1;

  while (++index < extensions.length) {
    extension(all, extensions[index]);
  }

  return all;
}

function extension(all, extension) {
  var hook;
  var left;
  var right;
  var code;

  for (hook in extension) {
    left = own.call(all, hook) ? all[hook] : all[hook] = {};
    right = extension[hook];

    for (code in right) {
      left[code] = constructs(miniflat(right[code]), own.call(left, code) ? left[code] : []);
    }
  }
}

function constructs(list, existing) {
  var index = -1;
  var before = [];

  while (++index < list.length) {
    ;
    (list[index].add === 'after' ? existing : before).push(list[index]);
  }

  chunkedSplice(existing, 0, 0, before);
  return existing;
}

/***/ }),

/***/ "./node_modules/micromark/dist/util/create-tokenizer.js":
/*!**************************************************************!*\
  !*** ./node_modules/micromark/dist/util/create-tokenizer.js ***!
  \**************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = createTokenizer;

var assign = __webpack_require__(/*! ../constant/assign */ "./node_modules/micromark/dist/constant/assign.js");

var markdownLineEnding = __webpack_require__(/*! ../character/markdown-line-ending */ "./node_modules/micromark/dist/character/markdown-line-ending.js");

var chunkedSplice = __webpack_require__(/*! ./chunked-splice */ "./node_modules/micromark/dist/util/chunked-splice.js");

var shallow = __webpack_require__(/*! ./shallow */ "./node_modules/micromark/dist/util/shallow.js");

var serializeChunks = __webpack_require__(/*! ./serialize-chunks */ "./node_modules/micromark/dist/util/serialize-chunks.js");

var sliceChunks = __webpack_require__(/*! ./slice-chunks */ "./node_modules/micromark/dist/util/slice-chunks.js");

var resolveAll = __webpack_require__(/*! ./resolve-all */ "./node_modules/micromark/dist/util/resolve-all.js");

var miniflat = __webpack_require__(/*! ./miniflat */ "./node_modules/micromark/dist/util/miniflat.js"); // Create a tokenizer.
// Tokenizers deal with one type of data (e.g., containers, flow, text).
// The parser is the object dealing with it all.
// `initialize` works like other constructs, except that only its `tokenize`
// function is used, in which case it doesn’t receive an `ok` or `nok`.
// `from` can be given to set the point before the first character, although
// when further lines are indented, they must be set with `defineSkip`.


function createTokenizer(parser, initialize, from) {
  var point = from ? shallow(from) : {
    line: 1,
    column: 1,
    offset: 0
  };
  var columnStart = {};
  var resolveAllConstructs = [];
  var chunks = [];
  var stack = [];
  var consumed = true; // Tools used for tokenizing.

  var effects = {
    consume: consume,
    enter: enter,
    exit: exit,
    attempt: constructFactory(onsuccessfulconstruct),
    check: constructFactory(onsuccessfulcheck),
    interrupt: constructFactory(onsuccessfulcheck, {
      interrupt: true
    }),
    lazy: constructFactory(onsuccessfulcheck, {
      lazy: true
    })
  }; // State and tools for resolving and serializing.

  var context = {
    previous: null,
    events: [],
    parser: parser,
    sliceStream: sliceStream,
    sliceSerialize: sliceSerialize,
    now: now,
    defineSkip: skip,
    write: write
  }; // The state function.

  var state = initialize.tokenize.call(context, effects); // Track which character we expect to be consumed, to catch bugs.

  var expectedCode;

  if (initialize.resolveAll) {
    resolveAllConstructs.push(initialize);
  } // Store where we are in the input stream.


  point._index = 0;
  point._bufferIndex = -1;
  return context;

  function write(slice) {
    chunkedSplice(chunks, chunks.length, 0, slice);
    main(); // Exit if we’re not done, resolve might change stuff.

    if (chunks[chunks.length - 1] !== null) {
      return [];
    }

    addResult(initialize, 0); // Otherwise, resolve, and exit.

    context.events = resolveAll(resolveAllConstructs, context.events, context);
    return context.events;
  } //
  // Tools.
  //


  function sliceSerialize(token) {
    return serializeChunks(sliceStream(token));
  }

  function sliceStream(token) {
    return sliceChunks(chunks, token);
  }

  function now() {
    return shallow(point);
  }

  function skip(value) {
    columnStart[value.line] = value.column;
    accountForPotentialSkip();
  } //
  // State management.
  //
  // Main loop (note that `_index` and `_bufferIndex` in `point` are modified by
  // `consume`).
  // Here is where we walk through the chunks, which either include strings of
  // several characters, or numerical character codes.
  // The reason to do this in a loop instead of a call is so the stack can
  // drain.


  function main() {
    var chunkIndex;
    var chunk;

    while (point._index < chunks.length) {
      chunk = chunks[point._index]; // If we’re in a buffer chunk, loop through it.

      if (typeof chunk === 'string') {
        chunkIndex = point._index;

        if (point._bufferIndex < 0) {
          point._bufferIndex = 0;
        }

        while (point._index === chunkIndex && point._bufferIndex < chunk.length) {
          go(chunk.charCodeAt(point._bufferIndex));
        }
      } else {
        go(chunk);
      }
    }
  } // Deal with one code.


  function go(code) {
    consumed = undefined;
    expectedCode = code;
    state = state(code);
  } // Move a character forward.


  function consume(code) {
    if (markdownLineEnding(code)) {
      point.line++;
      point.column = 1;
      point.offset += code === -3 ? 2 : 1;
      accountForPotentialSkip();
    } else if (code !== -1) {
      point.column++;
      point.offset++;
    } // Not in a string chunk.


    if (point._bufferIndex < 0) {
      point._index++;
    } else {
      point._bufferIndex++; // At end of string chunk.

      if (point._bufferIndex === chunks[point._index].length) {
        point._bufferIndex = -1;
        point._index++;
      }
    } // Expose the previous character.


    context.previous = code; // Mark as consumed.

    consumed = true;
  } // Start a token.


  function enter(type, fields) {
    var token = fields || {};
    token.type = type;
    token.start = now();
    context.events.push(['enter', token, context]);
    stack.push(token);
    return token;
  } // Stop a token.


  function exit(type) {
    var token = stack.pop();
    token.end = now();
    context.events.push(['exit', token, context]);
    return token;
  } // Use results.


  function onsuccessfulconstruct(construct, info) {
    addResult(construct, info.from);
  } // Discard results.


  function onsuccessfulcheck(construct, info) {
    info.restore();
  } // Factory to attempt/check/interrupt.


  function constructFactory(onreturn, fields) {
    return hook; // Handle either an object mapping codes to constructs, a list of
    // constructs, or a single construct.

    function hook(constructs, returnState, bogusState) {
      var listOfConstructs;
      var constructIndex;
      var currentConstruct;
      var info;
      return constructs.tokenize || 'length' in constructs ? handleListOfConstructs(miniflat(constructs)) : handleMapOfConstructs;

      function handleMapOfConstructs(code) {
        if (code in constructs || null in constructs) {
          return handleListOfConstructs(
          /* istanbul ignore next - `null` is used by some extensions */
          constructs["null"] ? miniflat(constructs[code]).concat(miniflat(constructs["null"])) : constructs[code])(code);
        }

        return bogusState(code);
      }

      function handleListOfConstructs(list) {
        listOfConstructs = list;
        constructIndex = 0;
        return handleConstruct(list[constructIndex]);
      }

      function handleConstruct(construct) {
        return start;

        function start(code) {
          // To do: not nede to store if there is no bogus state, probably?
          // Currently doesn’t work because `inspect` in document does a check
          // w/o a bogus, which doesn’t make sense. But it does seem to help perf
          // by not storing.
          info = store();
          currentConstruct = construct;

          if (!construct.partial) {
            context.currentConstruct = construct;
          }

          return construct.tokenize.call(fields ? assign({}, context, fields) : context, effects, ok, nok)(code);
        }
      }

      function ok(code) {
        consumed = true;
        onreturn(currentConstruct, info);
        return returnState;
      }

      function nok(code) {
        consumed = true;
        info.restore();

        if (++constructIndex < listOfConstructs.length) {
          return handleConstruct(listOfConstructs[constructIndex]);
        }

        return bogusState;
      }
    }
  }

  function addResult(construct, from) {
    if (construct.resolveAll && resolveAllConstructs.indexOf(construct) < 0) {
      resolveAllConstructs.push(construct);
    }

    if (construct.resolve) {
      chunkedSplice(context.events, from, context.events.length - from, construct.resolve(context.events.slice(from), context));
    }

    if (construct.resolveTo) {
      context.events = construct.resolveTo(context.events, context);
    }
  }

  function store() {
    var startPoint = now();
    var startPrevious = context.previous;
    var startCurrentConstruct = context.currentConstruct;
    var startEventsIndex = context.events.length;
    var startStack = Array.from(stack);
    return {
      restore: restore,
      from: startEventsIndex
    };

    function restore() {
      point = startPoint;
      context.previous = startPrevious;
      context.currentConstruct = startCurrentConstruct;
      context.events.length = startEventsIndex;
      stack = startStack;
      accountForPotentialSkip();
    }
  }

  function accountForPotentialSkip() {
    if (point.line in columnStart && point.column < 2) {
      point.column = columnStart[point.line];
      point.offset += columnStart[point.line] - 1;
    }
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/util/miniflat.js":
/*!******************************************************!*\
  !*** ./node_modules/micromark/dist/util/miniflat.js ***!
  \******************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = miniflat;

function miniflat(value) {
  return value === null || value === undefined ? [] : 'length' in value ? value : [value];
}

/***/ }),

/***/ "./node_modules/micromark/dist/util/move-point.js":
/*!********************************************************!*\
  !*** ./node_modules/micromark/dist/util/move-point.js ***!
  \********************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = movePoint; // Note! `move` only works inside lines! It’s not possible to move past other
// chunks (replacement characters, tabs, or line endings).

function movePoint(point, offset) {
  point.column += offset;
  point.offset += offset;
  point._bufferIndex += offset;
  return point;
}

/***/ }),

/***/ "./node_modules/micromark/dist/util/normalize-identifier.js":
/*!******************************************************************!*\
  !*** ./node_modules/micromark/dist/util/normalize-identifier.js ***!
  \******************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = normalizeIdentifier;

function normalizeIdentifier(value) {
  return value // Collapse Markdown whitespace.
  .replace(/[\t\n\r ]+/g, ' ') // Trim.
  .replace(/^ | $/g, '') // Some characters are considered “uppercase”, but if their lowercase
  // counterpart is uppercased will result in a different uppercase
  // character.
  // Hence, to get that form, we perform both lower- and uppercase.
  // Upper case makes sure keys will not interact with default prototypal
  // methods: no object method is uppercase.
  .toLowerCase().toUpperCase();
}

/***/ }),

/***/ "./node_modules/micromark/dist/util/prefix-size.js":
/*!*********************************************************!*\
  !*** ./node_modules/micromark/dist/util/prefix-size.js ***!
  \*********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = prefixSize;

var sizeChunks = __webpack_require__(/*! ./size-chunks */ "./node_modules/micromark/dist/util/size-chunks.js");

function prefixSize(events, type) {
  var tail = events[events.length - 1];
  if (!tail || tail[1].type !== type) return 0;
  return sizeChunks(tail[2].sliceStream(tail[1]));
}

/***/ }),

/***/ "./node_modules/micromark/dist/util/regex-check.js":
/*!*********************************************************!*\
  !*** ./node_modules/micromark/dist/util/regex-check.js ***!
  \*********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = regexCheck;

var fromCharCode = __webpack_require__(/*! ../constant/from-char-code */ "./node_modules/micromark/dist/constant/from-char-code.js");

function regexCheck(regex) {
  return check;

  function check(code) {
    return regex.test(fromCharCode(code));
  }
}

/***/ }),

/***/ "./node_modules/micromark/dist/util/resolve-all.js":
/*!*********************************************************!*\
  !*** ./node_modules/micromark/dist/util/resolve-all.js ***!
  \*********************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = resolveAll;

function resolveAll(constructs, events, context) {
  var called = [];
  var index = -1;
  var resolve;

  while (++index < constructs.length) {
    resolve = constructs[index].resolveAll;

    if (resolve && called.indexOf(resolve) < 0) {
      events = resolve(events, context);
      called.push(resolve);
    }
  }

  return events;
}

/***/ }),

/***/ "./node_modules/micromark/dist/util/safe-from-int.js":
/*!***********************************************************!*\
  !*** ./node_modules/micromark/dist/util/safe-from-int.js ***!
  \***********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = safeFromInt;

var fromCharCode = __webpack_require__(/*! ../constant/from-char-code */ "./node_modules/micromark/dist/constant/from-char-code.js");

function safeFromInt(value, base) {
  var code = parseInt(value, base);

  if ( // C0 except for HT, LF, FF, CR, space
  code < 9 || code === 11 || code > 13 && code < 32 || // Control character (DEL) of the basic block and C1 controls.
  code > 126 && code < 160 || // Lone high surrogates and low surrogates.
  code > 55295 && code < 57344 || // Noncharacters.
  code > 64975 && code < 65008 || (code & 65535) === 65535 || (code & 65535) === 65534 || // Out of range
  code > 1114111) {
    return "\uFFFD";
  }

  return fromCharCode(code);
}

/***/ }),

/***/ "./node_modules/micromark/dist/util/serialize-chunks.js":
/*!**************************************************************!*\
  !*** ./node_modules/micromark/dist/util/serialize-chunks.js ***!
  \**************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = serializeChunks;

var fromCharCode = __webpack_require__(/*! ../constant/from-char-code */ "./node_modules/micromark/dist/constant/from-char-code.js");

function serializeChunks(chunks) {
  var index = -1;
  var result = [];
  var chunk;
  var value;
  var atTab;

  while (++index < chunks.length) {
    chunk = chunks[index];

    if (typeof chunk === 'string') {
      value = chunk;
    } else if (chunk === -5) {
      value = '\r';
    } else if (chunk === -4) {
      value = '\n';
    } else if (chunk === -3) {
      value = '\r' + '\n';
    } else if (chunk === -2) {
      value = '\t';
    } else if (chunk === -1) {
      if (atTab) continue;
      value = ' ';
    } else {
      // Currently only replacement character.
      value = fromCharCode(chunk);
    }

    atTab = chunk === -2;
    result.push(value);
  }

  return result.join('');
}

/***/ }),

/***/ "./node_modules/micromark/dist/util/shallow.js":
/*!*****************************************************!*\
  !*** ./node_modules/micromark/dist/util/shallow.js ***!
  \*****************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = shallow;

var assign = __webpack_require__(/*! ../constant/assign */ "./node_modules/micromark/dist/constant/assign.js");

function shallow(object) {
  return assign({}, object);
}

/***/ }),

/***/ "./node_modules/micromark/dist/util/size-chunks.js":
/*!*********************************************************!*\
  !*** ./node_modules/micromark/dist/util/size-chunks.js ***!
  \*********************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = sizeChunks; // Measure the number of character codes in chunks.
// Counts tabs based on their expanded size, and CR+LF as one character.

function sizeChunks(chunks) {
  var index = -1;
  var size = 0;

  while (++index < chunks.length) {
    size += typeof chunks[index] === 'string' ? chunks[index].length : 1;
  }

  return size;
}

/***/ }),

/***/ "./node_modules/micromark/dist/util/slice-chunks.js":
/*!**********************************************************!*\
  !*** ./node_modules/micromark/dist/util/slice-chunks.js ***!
  \**********************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = sliceChunks;

function sliceChunks(chunks, token) {
  var startIndex = token.start._index;
  var startBufferIndex = token.start._bufferIndex;
  var endIndex = token.end._index;
  var endBufferIndex = token.end._bufferIndex;
  var view;

  if (startIndex === endIndex) {
    view = [chunks[startIndex].slice(startBufferIndex, endBufferIndex)];
  } else {
    view = chunks.slice(startIndex, endIndex);

    if (startBufferIndex > -1) {
      view[0] = view[0].slice(startBufferIndex);
    }

    if (endBufferIndex > 0) {
      view.push(chunks[endIndex].slice(0, endBufferIndex));
    }
  }

  return view;
}

/***/ }),

/***/ "./node_modules/micromark/dist/util/subtokenize.js":
/*!*********************************************************!*\
  !*** ./node_modules/micromark/dist/util/subtokenize.js ***!
  \*********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = subtokenize;

var assign = __webpack_require__(/*! ../constant/assign */ "./node_modules/micromark/dist/constant/assign.js");

var chunkedSplice = __webpack_require__(/*! ./chunked-splice */ "./node_modules/micromark/dist/util/chunked-splice.js");

var shallow = __webpack_require__(/*! ./shallow */ "./node_modules/micromark/dist/util/shallow.js");

function subtokenize(events) {
  var jumps = {};
  var index = -1;
  var event;
  var lineIndex;
  var otherIndex;
  var otherEvent;
  var parameters;
  var subevents;
  var more;

  while (++index < events.length) {
    while (index in jumps) {
      index = jumps[index];
    }

    event = events[index]; // Add a hook for the GFM tasklist extension, which needs to know if text
    // is in the first content of a list item.

    if (index && event[1].type === 'chunkFlow' && events[index - 1][1].type === 'listItemPrefix') {
      subevents = event[1]._tokenizer.events;
      otherIndex = 0;

      if (otherIndex < subevents.length && subevents[otherIndex][1].type === 'lineEndingBlank') {
        otherIndex += 2;
      }

      if (otherIndex < subevents.length && subevents[otherIndex][1].type === 'content') {
        while (++otherIndex < subevents.length) {
          if (subevents[otherIndex][1].type === 'content') {
            break;
          }

          if (subevents[otherIndex][1].type === 'chunkText') {
            subevents[otherIndex][1].isInFirstContentOfListItem = true;
            otherIndex++;
          }
        }
      }
    } // Enter.


    if (event[0] === 'enter') {
      if (event[1].contentType) {
        assign(jumps, subcontent(events, index));
        index = jumps[index];
        more = true;
      }
    } // Exit.
    else if (event[1]._container || event[1]._movePreviousLineEndings) {
        otherIndex = index;
        lineIndex = undefined;

        while (otherIndex--) {
          otherEvent = events[otherIndex];

          if (otherEvent[1].type === 'lineEnding' || otherEvent[1].type === 'lineEndingBlank') {
            if (otherEvent[0] === 'enter') {
              if (lineIndex) {
                events[lineIndex][1].type = 'lineEndingBlank';
              }

              otherEvent[1].type = 'lineEnding';
              lineIndex = otherIndex;
            }
          } else {
            break;
          }
        }

        if (lineIndex) {
          // Fix position.
          event[1].end = shallow(events[lineIndex][1].start); // Switch container exit w/ line endings.

          parameters = events.slice(lineIndex, index);
          parameters.unshift(event);
          chunkedSplice(events, lineIndex, index - lineIndex + 1, parameters);
        }
      }
  }

  return !more;
}

function subcontent(events, eventIndex) {
  var token = events[eventIndex][1];
  var context = events[eventIndex][2];
  var startPosition = eventIndex - 1;
  var startPositions = [];
  var tokenizer = token._tokenizer || context.parser[token.contentType](token.start);
  var childEvents = tokenizer.events;
  var jumps = [];
  var gaps = {};
  var stream;
  var previous;
  var index;
  var entered;
  var end;
  var adjust; // Loop forward through the linked tokens to pass them in order to the
  // subtokenizer.

  while (token) {
    // Find the position of the event for this token.
    while (events[++startPosition][1] !== token) {// Empty.
    }

    startPositions.push(startPosition);

    if (!token._tokenizer) {
      stream = context.sliceStream(token);

      if (!token.next) {
        stream.push(null);
      }

      if (previous) {
        tokenizer.defineSkip(token.start);
      }

      if (token.isInFirstContentOfListItem) {
        tokenizer._gfmTasklistFirstContentOfListItem = true;
      }

      tokenizer.write(stream);

      if (token.isInFirstContentOfListItem) {
        tokenizer._gfmTasklistFirstContentOfListItem = undefined;
      }
    } // Unravel the next token.


    previous = token;
    token = token.next;
  } // Now, loop back through all events (and linked tokens), to figure out which
  // parts belong where.


  token = previous;
  index = childEvents.length;

  while (index--) {
    // Make sure we’ve at least seen something (final eol is part of the last
    // token).
    if (childEvents[index][0] === 'enter') {
      entered = true;
    } else if ( // Find a void token that includes a break.
    entered && childEvents[index][1].type === childEvents[index - 1][1].type && childEvents[index][1].start.line !== childEvents[index][1].end.line) {
      add(childEvents.slice(index + 1, end)); // Help GC.

      token._tokenizer = token.next = undefined;
      token = token.previous;
      end = index + 1;
    }
  } // Help GC.


  tokenizer.events = token._tokenizer = token.next = undefined; // Do head:

  add(childEvents.slice(0, end));
  index = -1;
  adjust = 0;

  while (++index < jumps.length) {
    gaps[adjust + jumps[index][0]] = adjust + jumps[index][1];
    adjust += jumps[index][1] - jumps[index][0] - 1;
  }

  return gaps;

  function add(slice) {
    var start = startPositions.pop();
    jumps.unshift([start, start + slice.length - 1]);
    chunkedSplice(events, start, 2, slice);
  }
}

/***/ }),

/***/ "./node_modules/object-assign/index.js":
/*!*********************************************!*\
  !*** ./node_modules/object-assign/index.js ***!
  \*********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
object-assign
(c) Sindre Sorhus
@license MIT
*/

/* eslint-disable no-unused-vars */

var getOwnPropertySymbols = Object.getOwnPropertySymbols;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
  if (val === null || val === undefined) {
    throw new TypeError('Object.assign cannot be called with null or undefined');
  }

  return Object(val);
}

function shouldUseNative() {
  try {
    if (!Object.assign) {
      return false;
    } // Detect buggy property enumeration order in older V8 versions.
    // https://bugs.chromium.org/p/v8/issues/detail?id=4118


    var test1 = new String('abc'); // eslint-disable-line no-new-wrappers

    test1[5] = 'de';

    if (Object.getOwnPropertyNames(test1)[0] === '5') {
      return false;
    } // https://bugs.chromium.org/p/v8/issues/detail?id=3056


    var test2 = {};

    for (var i = 0; i < 10; i++) {
      test2['_' + String.fromCharCode(i)] = i;
    }

    var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
      return test2[n];
    });

    if (order2.join('') !== '0123456789') {
      return false;
    } // https://bugs.chromium.org/p/v8/issues/detail?id=3056


    var test3 = {};
    'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
      test3[letter] = letter;
    });

    if (Object.keys(Object.assign({}, test3)).join('') !== 'abcdefghijklmnopqrst') {
      return false;
    }

    return true;
  } catch (err) {
    // We don't expect any of the above to throw, but better to be safe.
    return false;
  }
}

module.exports = shouldUseNative() ? Object.assign : function (target, source) {
  var from;
  var to = toObject(target);
  var symbols;

  for (var s = 1; s < arguments.length; s++) {
    from = Object(arguments[s]);

    for (var key in from) {
      if (hasOwnProperty.call(from, key)) {
        to[key] = from[key];
      }
    }

    if (getOwnPropertySymbols) {
      symbols = getOwnPropertySymbols(from);

      for (var i = 0; i < symbols.length; i++) {
        if (propIsEnumerable.call(from, symbols[i])) {
          to[symbols[i]] = from[symbols[i]];
        }
      }
    }
  }

  return to;
};

/***/ }),

/***/ "./node_modules/parse-entities/decode-entity.browser.js":
/*!**************************************************************!*\
  !*** ./node_modules/parse-entities/decode-entity.browser.js ***!
  \**************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/* eslint-env browser */

var el;
var semicolon = 59; //  ';'

module.exports = decodeEntity;

function decodeEntity(characters) {
  var entity = '&' + characters + ';';

  var _char;

  el = el || document.createElement('i');
  el.innerHTML = entity;
  _char = el.textContent; // Some entities do not require the closing semicolon (`&not` - for instance),
  // which leads to situations where parsing the assumed entity of &notit; will
  // result in the string `¬it;`.  When we encounter a trailing semicolon after
  // parsing and the entity to decode was not a semicolon (`&semi;`), we can
  // assume that the matching was incomplete

  if (_char.charCodeAt(_char.length - 1) === semicolon && characters !== 'semi') {
    return false;
  } // If the decoded string is equal to the input, the entity was not valid


  return _char === entity ? false : _char;
}

/***/ }),

/***/ "./node_modules/path-browserify/index.js":
/*!***********************************************!*\
  !*** ./node_modules/path-browserify/index.js ***!
  \***********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(process) {// .dirname, .basename, and .extname methods are extracted from Node.js v8.11.1,
// backported and transplited with Babel, with backwards-compat fixes
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.
// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;

  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];

    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  } // if the path is allowed to go above the root, restore leading ..s


  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
} // path.resolve([from ...], to)
// posix version


exports.resolve = function () {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = i >= 0 ? arguments[i] : process.cwd(); // Skip empty and invalid entries

    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  } // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)
  // Normalize the path


  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function (p) {
    return !!p;
  }), !resolvedAbsolute).join('/');
  return (resolvedAbsolute ? '/' : '') + resolvedPath || '.';
}; // path.normalize(path)
// posix version


exports.normalize = function (path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/'; // Normalize the path

  path = normalizeArray(filter(path.split('/'), function (p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }

  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
}; // posix version


exports.isAbsolute = function (path) {
  return path.charAt(0) === '/';
}; // posix version


exports.join = function () {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function (p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }

    return p;
  }).join('/'));
}; // path.relative(from, to)
// posix version


exports.relative = function (from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;

    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;

    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));
  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;

  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];

  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));
  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function (path) {
  if (typeof path !== 'string') path = path + '';
  if (path.length === 0) return '.';
  var code = path.charCodeAt(0);
  var hasRoot = code === 47
  /*/*/
  ;
  var end = -1;
  var matchedSlash = true;

  for (var i = path.length - 1; i >= 1; --i) {
    code = path.charCodeAt(i);

    if (code === 47
    /*/*/
    ) {
        if (!matchedSlash) {
          end = i;
          break;
        }
      } else {
      // We saw the first non-path separator
      matchedSlash = false;
    }
  }

  if (end === -1) return hasRoot ? '/' : '.';

  if (hasRoot && end === 1) {
    // return '//';
    // Backwards-compat fix:
    return '/';
  }

  return path.slice(0, end);
};

function basename(path) {
  if (typeof path !== 'string') path = path + '';
  var start = 0;
  var end = -1;
  var matchedSlash = true;
  var i;

  for (i = path.length - 1; i >= 0; --i) {
    if (path.charCodeAt(i) === 47
    /*/*/
    ) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // path component
      matchedSlash = false;
      end = i + 1;
    }
  }

  if (end === -1) return '';
  return path.slice(start, end);
} // Uses a mixed approach for backwards-compatibility, as ext behavior changed
// in new Node.js versions, so only basename() above is backported here


exports.basename = function (path, ext) {
  var f = basename(path);

  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }

  return f;
};

exports.extname = function (path) {
  if (typeof path !== 'string') path = path + '';
  var startDot = -1;
  var startPart = 0;
  var end = -1;
  var matchedSlash = true; // Track the state of characters (if any) we see before our first dot and
  // after any path separator we find

  var preDotState = 0;

  for (var i = path.length - 1; i >= 0; --i) {
    var code = path.charCodeAt(i);

    if (code === 47
    /*/*/
    ) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }

        continue;
      }

    if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // extension
      matchedSlash = false;
      end = i + 1;
    }

    if (code === 46
    /*.*/
    ) {
        // If this is our first dot, mark it as the start of our extension
        if (startDot === -1) startDot = i;else if (preDotState !== 1) preDotState = 1;
      } else if (startDot !== -1) {
      // We saw a non-dot and non-path separator before our dot, so we should
      // have a good chance at having a non-empty extension
      preDotState = -1;
    }
  }

  if (startDot === -1 || end === -1 || // We saw a non-dot character immediately before the dot
  preDotState === 0 || // The (right-most) trimmed path component is exactly '..'
  preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    return '';
  }

  return path.slice(startDot, end);
};

function filter(xs, f) {
  if (xs.filter) return xs.filter(f);
  var res = [];

  for (var i = 0; i < xs.length; i++) {
    if (f(xs[i], i, xs)) res.push(xs[i]);
  }

  return res;
} // String.prototype.substr - negative index don't work in IE8


var substr = 'ab'.substr(-1) === 'b' ? function (str, start, len) {
  return str.substr(start, len);
} : function (str, start, len) {
  if (start < 0) start = str.length + start;
  return str.substr(start, len);
};
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../process/browser.js */ "./node_modules/process/browser.js")))

/***/ }),

/***/ "./node_modules/process/browser.js":
/*!*****************************************!*\
  !*** ./node_modules/process/browser.js ***!
  \*****************************************/
/*! no static exports found */
/***/ (function(module, exports) {

// shim for using process in browser
var process = module.exports = {}; // cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
  throw new Error('setTimeout has not been defined');
}

function defaultClearTimeout() {
  throw new Error('clearTimeout has not been defined');
}

(function () {
  try {
    if (typeof setTimeout === 'function') {
      cachedSetTimeout = setTimeout;
    } else {
      cachedSetTimeout = defaultSetTimout;
    }
  } catch (e) {
    cachedSetTimeout = defaultSetTimout;
  }

  try {
    if (typeof clearTimeout === 'function') {
      cachedClearTimeout = clearTimeout;
    } else {
      cachedClearTimeout = defaultClearTimeout;
    }
  } catch (e) {
    cachedClearTimeout = defaultClearTimeout;
  }
})();

function runTimeout(fun) {
  if (cachedSetTimeout === setTimeout) {
    //normal enviroments in sane situations
    return setTimeout(fun, 0);
  } // if setTimeout wasn't available but was latter defined


  if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
    cachedSetTimeout = setTimeout;
    return setTimeout(fun, 0);
  }

  try {
    // when when somebody has screwed with setTimeout but no I.E. maddness
    return cachedSetTimeout(fun, 0);
  } catch (e) {
    try {
      // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
      return cachedSetTimeout.call(null, fun, 0);
    } catch (e) {
      // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
      return cachedSetTimeout.call(this, fun, 0);
    }
  }
}

function runClearTimeout(marker) {
  if (cachedClearTimeout === clearTimeout) {
    //normal enviroments in sane situations
    return clearTimeout(marker);
  } // if clearTimeout wasn't available but was latter defined


  if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
    cachedClearTimeout = clearTimeout;
    return clearTimeout(marker);
  }

  try {
    // when when somebody has screwed with setTimeout but no I.E. maddness
    return cachedClearTimeout(marker);
  } catch (e) {
    try {
      // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
      return cachedClearTimeout.call(null, marker);
    } catch (e) {
      // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
      // Some versions of I.E. have different rules for clearTimeout vs setTimeout
      return cachedClearTimeout.call(this, marker);
    }
  }
}

var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
  if (!draining || !currentQueue) {
    return;
  }

  draining = false;

  if (currentQueue.length) {
    queue = currentQueue.concat(queue);
  } else {
    queueIndex = -1;
  }

  if (queue.length) {
    drainQueue();
  }
}

function drainQueue() {
  if (draining) {
    return;
  }

  var timeout = runTimeout(cleanUpNextTick);
  draining = true;
  var len = queue.length;

  while (len) {
    currentQueue = queue;
    queue = [];

    while (++queueIndex < len) {
      if (currentQueue) {
        currentQueue[queueIndex].run();
      }
    }

    queueIndex = -1;
    len = queue.length;
  }

  currentQueue = null;
  draining = false;
  runClearTimeout(timeout);
}

process.nextTick = function (fun) {
  var args = new Array(arguments.length - 1);

  if (arguments.length > 1) {
    for (var i = 1; i < arguments.length; i++) {
      args[i - 1] = arguments[i];
    }
  }

  queue.push(new Item(fun, args));

  if (queue.length === 1 && !draining) {
    runTimeout(drainQueue);
  }
}; // v8 likes predictible objects


function Item(fun, array) {
  this.fun = fun;
  this.array = array;
}

Item.prototype.run = function () {
  this.fun.apply(null, this.array);
};

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues

process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) {
  return [];
};

process.binding = function (name) {
  throw new Error('process.binding is not supported');
};

process.cwd = function () {
  return '/';
};

process.chdir = function (dir) {
  throw new Error('process.chdir is not supported');
};

process.umask = function () {
  return 0;
};

/***/ }),

/***/ "./node_modules/prop-types/checkPropTypes.js":
/*!***************************************************!*\
  !*** ./node_modules/prop-types/checkPropTypes.js ***!
  \***************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */


function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var printWarning = function printWarning() {};

if (true) {
  var ReactPropTypesSecret = __webpack_require__(/*! ./lib/ReactPropTypesSecret */ "./node_modules/prop-types/lib/ReactPropTypesSecret.js");

  var loggedTypeFailures = {};
  var has = Function.call.bind(Object.prototype.hasOwnProperty);

  printWarning = function printWarning(text) {
    var message = 'Warning: ' + text;

    if (typeof console !== 'undefined') {
      console.error(message);
    }

    try {
      // --- Welcome to debugging React ---
      // This error was thrown as a convenience so that you can use this stack
      // to find the callsite that caused this warning to fire.
      throw new Error(message);
    } catch (x) {}
  };
}
/**
 * Assert that the values match with the type specs.
 * Error messages are memorized and will only be shown once.
 *
 * @param {object} typeSpecs Map of name to a ReactPropType
 * @param {object} values Runtime values that need to be type-checked
 * @param {string} location e.g. "prop", "context", "child context"
 * @param {string} componentName Name of the component for error messages.
 * @param {?Function} getStack Returns the component stack.
 * @private
 */


function checkPropTypes(typeSpecs, values, location, componentName, getStack) {
  if (true) {
    for (var typeSpecName in typeSpecs) {
      if (has(typeSpecs, typeSpecName)) {
        var error; // Prop type validation may throw. In case they do, we don't want to
        // fail the render phase where it didn't fail before. So we log it.
        // After these have been cleaned up, we'll let them throw.

        try {
          // This is intentionally an invariant that gets caught. It's the same
          // behavior as without this statement except with a better message.
          if (typeof typeSpecs[typeSpecName] !== 'function') {
            var err = Error((componentName || 'React class') + ': ' + location + ' type `' + typeSpecName + '` is invalid; ' + 'it must be a function, usually from the `prop-types` package, but received `' + _typeof(typeSpecs[typeSpecName]) + '`.');
            err.name = 'Invariant Violation';
            throw err;
          }

          error = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, ReactPropTypesSecret);
        } catch (ex) {
          error = ex;
        }

        if (error && !(error instanceof Error)) {
          printWarning((componentName || 'React class') + ': type specification of ' + location + ' `' + typeSpecName + '` is invalid; the type checker ' + 'function must return `null` or an `Error` but returned a ' + _typeof(error) + '. ' + 'You may have forgotten to pass an argument to the type checker ' + 'creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and ' + 'shape all require an argument).');
        }

        if (error instanceof Error && !(error.message in loggedTypeFailures)) {
          // Only monitor this failure once because there tends to be a lot of the
          // same error.
          loggedTypeFailures[error.message] = true;
          var stack = getStack ? getStack() : '';
          printWarning('Failed ' + location + ' type: ' + error.message + (stack != null ? stack : ''));
        }
      }
    }
  }
}
/**
 * Resets warning cache when testing.
 *
 * @private
 */


checkPropTypes.resetWarningCache = function () {
  if (true) {
    loggedTypeFailures = {};
  }
};

module.exports = checkPropTypes;

/***/ }),

/***/ "./node_modules/prop-types/factoryWithTypeCheckers.js":
/*!************************************************************!*\
  !*** ./node_modules/prop-types/factoryWithTypeCheckers.js ***!
  \************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */


function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var ReactIs = __webpack_require__(/*! react-is */ "./node_modules/react-is/index.js");

var assign = __webpack_require__(/*! object-assign */ "./node_modules/object-assign/index.js");

var ReactPropTypesSecret = __webpack_require__(/*! ./lib/ReactPropTypesSecret */ "./node_modules/prop-types/lib/ReactPropTypesSecret.js");

var checkPropTypes = __webpack_require__(/*! ./checkPropTypes */ "./node_modules/prop-types/checkPropTypes.js");

var has = Function.call.bind(Object.prototype.hasOwnProperty);

var printWarning = function printWarning() {};

if (true) {
  printWarning = function printWarning(text) {
    var message = 'Warning: ' + text;

    if (typeof console !== 'undefined') {
      console.error(message);
    }

    try {
      // --- Welcome to debugging React ---
      // This error was thrown as a convenience so that you can use this stack
      // to find the callsite that caused this warning to fire.
      throw new Error(message);
    } catch (x) {}
  };
}

function emptyFunctionThatReturnsNull() {
  return null;
}

module.exports = function (isValidElement, throwOnDirectAccess) {
  /* global Symbol */
  var ITERATOR_SYMBOL = typeof Symbol === 'function' && Symbol.iterator;
  var FAUX_ITERATOR_SYMBOL = '@@iterator'; // Before Symbol spec.

  /**
   * Returns the iterator method function contained on the iterable object.
   *
   * Be sure to invoke the function with the iterable as context:
   *
   *     var iteratorFn = getIteratorFn(myIterable);
   *     if (iteratorFn) {
   *       var iterator = iteratorFn.call(myIterable);
   *       ...
   *     }
   *
   * @param {?object} maybeIterable
   * @return {?function}
   */

  function getIteratorFn(maybeIterable) {
    var iteratorFn = maybeIterable && (ITERATOR_SYMBOL && maybeIterable[ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL]);

    if (typeof iteratorFn === 'function') {
      return iteratorFn;
    }
  }
  /**
   * Collection of methods that allow declaration and validation of props that are
   * supplied to React components. Example usage:
   *
   *   var Props = require('ReactPropTypes');
   *   var MyArticle = React.createClass({
   *     propTypes: {
   *       // An optional string prop named "description".
   *       description: Props.string,
   *
   *       // A required enum prop named "category".
   *       category: Props.oneOf(['News','Photos']).isRequired,
   *
   *       // A prop named "dialog" that requires an instance of Dialog.
   *       dialog: Props.instanceOf(Dialog).isRequired
   *     },
   *     render: function() { ... }
   *   });
   *
   * A more formal specification of how these methods are used:
   *
   *   type := array|bool|func|object|number|string|oneOf([...])|instanceOf(...)
   *   decl := ReactPropTypes.{type}(.isRequired)?
   *
   * Each and every declaration produces a function with the same signature. This
   * allows the creation of custom validation functions. For example:
   *
   *  var MyLink = React.createClass({
   *    propTypes: {
   *      // An optional string or URI prop named "href".
   *      href: function(props, propName, componentName) {
   *        var propValue = props[propName];
   *        if (propValue != null && typeof propValue !== 'string' &&
   *            !(propValue instanceof URI)) {
   *          return new Error(
   *            'Expected a string or an URI for ' + propName + ' in ' +
   *            componentName
   *          );
   *        }
   *      }
   *    },
   *    render: function() {...}
   *  });
   *
   * @internal
   */


  var ANONYMOUS = '<<anonymous>>'; // Important!
  // Keep this list in sync with production version in `./factoryWithThrowingShims.js`.

  var ReactPropTypes = {
    array: createPrimitiveTypeChecker('array'),
    bool: createPrimitiveTypeChecker('boolean'),
    func: createPrimitiveTypeChecker('function'),
    number: createPrimitiveTypeChecker('number'),
    object: createPrimitiveTypeChecker('object'),
    string: createPrimitiveTypeChecker('string'),
    symbol: createPrimitiveTypeChecker('symbol'),
    any: createAnyTypeChecker(),
    arrayOf: createArrayOfTypeChecker,
    element: createElementTypeChecker(),
    elementType: createElementTypeTypeChecker(),
    instanceOf: createInstanceTypeChecker,
    node: createNodeChecker(),
    objectOf: createObjectOfTypeChecker,
    oneOf: createEnumTypeChecker,
    oneOfType: createUnionTypeChecker,
    shape: createShapeTypeChecker,
    exact: createStrictShapeTypeChecker
  };
  /**
   * inlined Object.is polyfill to avoid requiring consumers ship their own
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
   */

  /*eslint-disable no-self-compare*/

  function is(x, y) {
    // SameValue algorithm
    if (x === y) {
      // Steps 1-5, 7-10
      // Steps 6.b-6.e: +0 != -0
      return x !== 0 || 1 / x === 1 / y;
    } else {
      // Step 6.a: NaN == NaN
      return x !== x && y !== y;
    }
  }
  /*eslint-enable no-self-compare*/

  /**
   * We use an Error-like object for backward compatibility as people may call
   * PropTypes directly and inspect their output. However, we don't use real
   * Errors anymore. We don't inspect their stack anyway, and creating them
   * is prohibitively expensive if they are created too often, such as what
   * happens in oneOfType() for any type before the one that matched.
   */


  function PropTypeError(message) {
    this.message = message;
    this.stack = '';
  } // Make `instanceof Error` still work for returned errors.


  PropTypeError.prototype = Error.prototype;

  function createChainableTypeChecker(validate) {
    if (true) {
      var manualPropTypeCallCache = {};
      var manualPropTypeWarningCount = 0;
    }

    function checkType(isRequired, props, propName, componentName, location, propFullName, secret) {
      componentName = componentName || ANONYMOUS;
      propFullName = propFullName || propName;

      if (secret !== ReactPropTypesSecret) {
        if (throwOnDirectAccess) {
          // New behavior only for users of `prop-types` package
          var err = new Error('Calling PropTypes validators directly is not supported by the `prop-types` package. ' + 'Use `PropTypes.checkPropTypes()` to call them. ' + 'Read more at http://fb.me/use-check-prop-types');
          err.name = 'Invariant Violation';
          throw err;
        } else if ( true && typeof console !== 'undefined') {
          // Old behavior for people using React.PropTypes
          var cacheKey = componentName + ':' + propName;

          if (!manualPropTypeCallCache[cacheKey] && // Avoid spamming the console because they are often not actionable except for lib authors
          manualPropTypeWarningCount < 3) {
            printWarning('You are manually calling a React.PropTypes validation ' + 'function for the `' + propFullName + '` prop on `' + componentName + '`. This is deprecated ' + 'and will throw in the standalone `prop-types` package. ' + 'You may be seeing this warning due to a third-party PropTypes ' + 'library. See https://fb.me/react-warning-dont-call-proptypes ' + 'for details.');
            manualPropTypeCallCache[cacheKey] = true;
            manualPropTypeWarningCount++;
          }
        }
      }

      if (props[propName] == null) {
        if (isRequired) {
          if (props[propName] === null) {
            return new PropTypeError('The ' + location + ' `' + propFullName + '` is marked as required ' + ('in `' + componentName + '`, but its value is `null`.'));
          }

          return new PropTypeError('The ' + location + ' `' + propFullName + '` is marked as required in ' + ('`' + componentName + '`, but its value is `undefined`.'));
        }

        return null;
      } else {
        return validate(props, propName, componentName, location, propFullName);
      }
    }

    var chainedCheckType = checkType.bind(null, false);
    chainedCheckType.isRequired = checkType.bind(null, true);
    return chainedCheckType;
  }

  function createPrimitiveTypeChecker(expectedType) {
    function validate(props, propName, componentName, location, propFullName, secret) {
      var propValue = props[propName];
      var propType = getPropType(propValue);

      if (propType !== expectedType) {
        // `propValue` being instance of, say, date/regexp, pass the 'object'
        // check, but we can offer a more precise error message here rather than
        // 'of type `object`'.
        var preciseType = getPreciseType(propValue);
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + preciseType + '` supplied to `' + componentName + '`, expected ') + ('`' + expectedType + '`.'));
      }

      return null;
    }

    return createChainableTypeChecker(validate);
  }

  function createAnyTypeChecker() {
    return createChainableTypeChecker(emptyFunctionThatReturnsNull);
  }

  function createArrayOfTypeChecker(typeChecker) {
    function validate(props, propName, componentName, location, propFullName) {
      if (typeof typeChecker !== 'function') {
        return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside arrayOf.');
      }

      var propValue = props[propName];

      if (!Array.isArray(propValue)) {
        var propType = getPropType(propValue);
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an array.'));
      }

      for (var i = 0; i < propValue.length; i++) {
        var error = typeChecker(propValue, i, componentName, location, propFullName + '[' + i + ']', ReactPropTypesSecret);

        if (error instanceof Error) {
          return error;
        }
      }

      return null;
    }

    return createChainableTypeChecker(validate);
  }

  function createElementTypeChecker() {
    function validate(props, propName, componentName, location, propFullName) {
      var propValue = props[propName];

      if (!isValidElement(propValue)) {
        var propType = getPropType(propValue);
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected a single ReactElement.'));
      }

      return null;
    }

    return createChainableTypeChecker(validate);
  }

  function createElementTypeTypeChecker() {
    function validate(props, propName, componentName, location, propFullName) {
      var propValue = props[propName];

      if (!ReactIs.isValidElementType(propValue)) {
        var propType = getPropType(propValue);
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected a single ReactElement type.'));
      }

      return null;
    }

    return createChainableTypeChecker(validate);
  }

  function createInstanceTypeChecker(expectedClass) {
    function validate(props, propName, componentName, location, propFullName) {
      if (!(props[propName] instanceof expectedClass)) {
        var expectedClassName = expectedClass.name || ANONYMOUS;
        var actualClassName = getClassName(props[propName]);
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + actualClassName + '` supplied to `' + componentName + '`, expected ') + ('instance of `' + expectedClassName + '`.'));
      }

      return null;
    }

    return createChainableTypeChecker(validate);
  }

  function createEnumTypeChecker(expectedValues) {
    if (!Array.isArray(expectedValues)) {
      if (true) {
        if (arguments.length > 1) {
          printWarning('Invalid arguments supplied to oneOf, expected an array, got ' + arguments.length + ' arguments. ' + 'A common mistake is to write oneOf(x, y, z) instead of oneOf([x, y, z]).');
        } else {
          printWarning('Invalid argument supplied to oneOf, expected an array.');
        }
      }

      return emptyFunctionThatReturnsNull;
    }

    function validate(props, propName, componentName, location, propFullName) {
      var propValue = props[propName];

      for (var i = 0; i < expectedValues.length; i++) {
        if (is(propValue, expectedValues[i])) {
          return null;
        }
      }

      var valuesString = JSON.stringify(expectedValues, function replacer(key, value) {
        var type = getPreciseType(value);

        if (type === 'symbol') {
          return String(value);
        }

        return value;
      });
      return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of value `' + String(propValue) + '` ' + ('supplied to `' + componentName + '`, expected one of ' + valuesString + '.'));
    }

    return createChainableTypeChecker(validate);
  }

  function createObjectOfTypeChecker(typeChecker) {
    function validate(props, propName, componentName, location, propFullName) {
      if (typeof typeChecker !== 'function') {
        return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside objectOf.');
      }

      var propValue = props[propName];
      var propType = getPropType(propValue);

      if (propType !== 'object') {
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an object.'));
      }

      for (var key in propValue) {
        if (has(propValue, key)) {
          var error = typeChecker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret);

          if (error instanceof Error) {
            return error;
          }
        }
      }

      return null;
    }

    return createChainableTypeChecker(validate);
  }

  function createUnionTypeChecker(arrayOfTypeCheckers) {
    if (!Array.isArray(arrayOfTypeCheckers)) {
       true ? printWarning('Invalid argument supplied to oneOfType, expected an instance of array.') : undefined;
      return emptyFunctionThatReturnsNull;
    }

    for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
      var checker = arrayOfTypeCheckers[i];

      if (typeof checker !== 'function') {
        printWarning('Invalid argument supplied to oneOfType. Expected an array of check functions, but ' + 'received ' + getPostfixForTypeWarning(checker) + ' at index ' + i + '.');
        return emptyFunctionThatReturnsNull;
      }
    }

    function validate(props, propName, componentName, location, propFullName) {
      for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
        var checker = arrayOfTypeCheckers[i];

        if (checker(props, propName, componentName, location, propFullName, ReactPropTypesSecret) == null) {
          return null;
        }
      }

      return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`.'));
    }

    return createChainableTypeChecker(validate);
  }

  function createNodeChecker() {
    function validate(props, propName, componentName, location, propFullName) {
      if (!isNode(props[propName])) {
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`, expected a ReactNode.'));
      }

      return null;
    }

    return createChainableTypeChecker(validate);
  }

  function createShapeTypeChecker(shapeTypes) {
    function validate(props, propName, componentName, location, propFullName) {
      var propValue = props[propName];
      var propType = getPropType(propValue);

      if (propType !== 'object') {
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));
      }

      for (var key in shapeTypes) {
        var checker = shapeTypes[key];

        if (!checker) {
          continue;
        }

        var error = checker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret);

        if (error) {
          return error;
        }
      }

      return null;
    }

    return createChainableTypeChecker(validate);
  }

  function createStrictShapeTypeChecker(shapeTypes) {
    function validate(props, propName, componentName, location, propFullName) {
      var propValue = props[propName];
      var propType = getPropType(propValue);

      if (propType !== 'object') {
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));
      } // We need to check all keys in case some are required but missing from
      // props.


      var allKeys = assign({}, props[propName], shapeTypes);

      for (var key in allKeys) {
        var checker = shapeTypes[key];

        if (!checker) {
          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` key `' + key + '` supplied to `' + componentName + '`.' + '\nBad object: ' + JSON.stringify(props[propName], null, '  ') + '\nValid keys: ' + JSON.stringify(Object.keys(shapeTypes), null, '  '));
        }

        var error = checker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret);

        if (error) {
          return error;
        }
      }

      return null;
    }

    return createChainableTypeChecker(validate);
  }

  function isNode(propValue) {
    switch (_typeof(propValue)) {
      case 'number':
      case 'string':
      case 'undefined':
        return true;

      case 'boolean':
        return !propValue;

      case 'object':
        if (Array.isArray(propValue)) {
          return propValue.every(isNode);
        }

        if (propValue === null || isValidElement(propValue)) {
          return true;
        }

        var iteratorFn = getIteratorFn(propValue);

        if (iteratorFn) {
          var iterator = iteratorFn.call(propValue);
          var step;

          if (iteratorFn !== propValue.entries) {
            while (!(step = iterator.next()).done) {
              if (!isNode(step.value)) {
                return false;
              }
            }
          } else {
            // Iterator will provide entry [k,v] tuples rather than values.
            while (!(step = iterator.next()).done) {
              var entry = step.value;

              if (entry) {
                if (!isNode(entry[1])) {
                  return false;
                }
              }
            }
          }
        } else {
          return false;
        }

        return true;

      default:
        return false;
    }
  }

  function isSymbol(propType, propValue) {
    // Native Symbol.
    if (propType === 'symbol') {
      return true;
    } // falsy value can't be a Symbol


    if (!propValue) {
      return false;
    } // 19.4.3.5 Symbol.prototype[@@toStringTag] === 'Symbol'


    if (propValue['@@toStringTag'] === 'Symbol') {
      return true;
    } // Fallback for non-spec compliant Symbols which are polyfilled.


    if (typeof Symbol === 'function' && propValue instanceof Symbol) {
      return true;
    }

    return false;
  } // Equivalent of `typeof` but with special handling for array and regexp.


  function getPropType(propValue) {
    var propType = _typeof(propValue);

    if (Array.isArray(propValue)) {
      return 'array';
    }

    if (propValue instanceof RegExp) {
      // Old webkits (at least until Android 4.0) return 'function' rather than
      // 'object' for typeof a RegExp. We'll normalize this here so that /bla/
      // passes PropTypes.object.
      return 'object';
    }

    if (isSymbol(propType, propValue)) {
      return 'symbol';
    }

    return propType;
  } // This handles more types than `getPropType`. Only used for error messages.
  // See `createPrimitiveTypeChecker`.


  function getPreciseType(propValue) {
    if (typeof propValue === 'undefined' || propValue === null) {
      return '' + propValue;
    }

    var propType = getPropType(propValue);

    if (propType === 'object') {
      if (propValue instanceof Date) {
        return 'date';
      } else if (propValue instanceof RegExp) {
        return 'regexp';
      }
    }

    return propType;
  } // Returns a string that is postfixed to a warning about an invalid type.
  // For example, "undefined" or "of type array"


  function getPostfixForTypeWarning(value) {
    var type = getPreciseType(value);

    switch (type) {
      case 'array':
      case 'object':
        return 'an ' + type;

      case 'boolean':
      case 'date':
      case 'regexp':
        return 'a ' + type;

      default:
        return type;
    }
  } // Returns class name of the object, if any.


  function getClassName(propValue) {
    if (!propValue.constructor || !propValue.constructor.name) {
      return ANONYMOUS;
    }

    return propValue.constructor.name;
  }

  ReactPropTypes.checkPropTypes = checkPropTypes;
  ReactPropTypes.resetWarningCache = checkPropTypes.resetWarningCache;
  ReactPropTypes.PropTypes = ReactPropTypes;
  return ReactPropTypes;
};

/***/ }),

/***/ "./node_modules/prop-types/index.js":
/*!******************************************!*\
  !*** ./node_modules/prop-types/index.js ***!
  \******************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
if (true) {
  var ReactIs = __webpack_require__(/*! react-is */ "./node_modules/react-is/index.js"); // By explicitly using `prop-types` you are opting into new development behavior.
  // http://fb.me/prop-types-in-prod


  var throwOnDirectAccess = true;
  module.exports = __webpack_require__(/*! ./factoryWithTypeCheckers */ "./node_modules/prop-types/factoryWithTypeCheckers.js")(ReactIs.isElement, throwOnDirectAccess);
} else {}

/***/ }),

/***/ "./node_modules/prop-types/lib/ReactPropTypesSecret.js":
/*!*************************************************************!*\
  !*** ./node_modules/prop-types/lib/ReactPropTypesSecret.js ***!
  \*************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */


var ReactPropTypesSecret = 'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED';
module.exports = ReactPropTypesSecret;

/***/ }),

/***/ "./node_modules/react-is/cjs/react-is.development.js":
/*!***********************************************************!*\
  !*** ./node_modules/react-is/cjs/react-is.development.js ***!
  \***********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/** @license React v16.13.1
 * react-is.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */


function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

if (true) {
  (function () {
    'use strict'; // The Symbol used to tag the ReactElement-like types. If there is no native Symbol
    // nor polyfill, then a plain number is used for performance.

    var hasSymbol = typeof Symbol === 'function' && Symbol["for"];
    var REACT_ELEMENT_TYPE = hasSymbol ? Symbol["for"]('react.element') : 0xeac7;
    var REACT_PORTAL_TYPE = hasSymbol ? Symbol["for"]('react.portal') : 0xeaca;
    var REACT_FRAGMENT_TYPE = hasSymbol ? Symbol["for"]('react.fragment') : 0xeacb;
    var REACT_STRICT_MODE_TYPE = hasSymbol ? Symbol["for"]('react.strict_mode') : 0xeacc;
    var REACT_PROFILER_TYPE = hasSymbol ? Symbol["for"]('react.profiler') : 0xead2;
    var REACT_PROVIDER_TYPE = hasSymbol ? Symbol["for"]('react.provider') : 0xeacd;
    var REACT_CONTEXT_TYPE = hasSymbol ? Symbol["for"]('react.context') : 0xeace; // TODO: We don't use AsyncMode or ConcurrentMode anymore. They were temporary
    // (unstable) APIs that have been removed. Can we remove the symbols?

    var REACT_ASYNC_MODE_TYPE = hasSymbol ? Symbol["for"]('react.async_mode') : 0xeacf;
    var REACT_CONCURRENT_MODE_TYPE = hasSymbol ? Symbol["for"]('react.concurrent_mode') : 0xeacf;
    var REACT_FORWARD_REF_TYPE = hasSymbol ? Symbol["for"]('react.forward_ref') : 0xead0;
    var REACT_SUSPENSE_TYPE = hasSymbol ? Symbol["for"]('react.suspense') : 0xead1;
    var REACT_SUSPENSE_LIST_TYPE = hasSymbol ? Symbol["for"]('react.suspense_list') : 0xead8;
    var REACT_MEMO_TYPE = hasSymbol ? Symbol["for"]('react.memo') : 0xead3;
    var REACT_LAZY_TYPE = hasSymbol ? Symbol["for"]('react.lazy') : 0xead4;
    var REACT_BLOCK_TYPE = hasSymbol ? Symbol["for"]('react.block') : 0xead9;
    var REACT_FUNDAMENTAL_TYPE = hasSymbol ? Symbol["for"]('react.fundamental') : 0xead5;
    var REACT_RESPONDER_TYPE = hasSymbol ? Symbol["for"]('react.responder') : 0xead6;
    var REACT_SCOPE_TYPE = hasSymbol ? Symbol["for"]('react.scope') : 0xead7;

    function isValidElementType(type) {
      return typeof type === 'string' || typeof type === 'function' || // Note: its typeof might be other than 'symbol' or 'number' if it's a polyfill.
      type === REACT_FRAGMENT_TYPE || type === REACT_CONCURRENT_MODE_TYPE || type === REACT_PROFILER_TYPE || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || _typeof(type) === 'object' && type !== null && (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || type.$$typeof === REACT_FUNDAMENTAL_TYPE || type.$$typeof === REACT_RESPONDER_TYPE || type.$$typeof === REACT_SCOPE_TYPE || type.$$typeof === REACT_BLOCK_TYPE);
    }

    function typeOf(object) {
      if (_typeof(object) === 'object' && object !== null) {
        var $$typeof = object.$$typeof;

        switch ($$typeof) {
          case REACT_ELEMENT_TYPE:
            var type = object.type;

            switch (type) {
              case REACT_ASYNC_MODE_TYPE:
              case REACT_CONCURRENT_MODE_TYPE:
              case REACT_FRAGMENT_TYPE:
              case REACT_PROFILER_TYPE:
              case REACT_STRICT_MODE_TYPE:
              case REACT_SUSPENSE_TYPE:
                return type;

              default:
                var $$typeofType = type && type.$$typeof;

                switch ($$typeofType) {
                  case REACT_CONTEXT_TYPE:
                  case REACT_FORWARD_REF_TYPE:
                  case REACT_LAZY_TYPE:
                  case REACT_MEMO_TYPE:
                  case REACT_PROVIDER_TYPE:
                    return $$typeofType;

                  default:
                    return $$typeof;
                }

            }

          case REACT_PORTAL_TYPE:
            return $$typeof;
        }
      }

      return undefined;
    } // AsyncMode is deprecated along with isAsyncMode


    var AsyncMode = REACT_ASYNC_MODE_TYPE;
    var ConcurrentMode = REACT_CONCURRENT_MODE_TYPE;
    var ContextConsumer = REACT_CONTEXT_TYPE;
    var ContextProvider = REACT_PROVIDER_TYPE;
    var Element = REACT_ELEMENT_TYPE;
    var ForwardRef = REACT_FORWARD_REF_TYPE;
    var Fragment = REACT_FRAGMENT_TYPE;
    var Lazy = REACT_LAZY_TYPE;
    var Memo = REACT_MEMO_TYPE;
    var Portal = REACT_PORTAL_TYPE;
    var Profiler = REACT_PROFILER_TYPE;
    var StrictMode = REACT_STRICT_MODE_TYPE;
    var Suspense = REACT_SUSPENSE_TYPE;
    var hasWarnedAboutDeprecatedIsAsyncMode = false; // AsyncMode should be deprecated

    function isAsyncMode(object) {
      {
        if (!hasWarnedAboutDeprecatedIsAsyncMode) {
          hasWarnedAboutDeprecatedIsAsyncMode = true; // Using console['warn'] to evade Babel and ESLint

          console['warn']('The ReactIs.isAsyncMode() alias has been deprecated, ' + 'and will be removed in React 17+. Update your code to use ' + 'ReactIs.isConcurrentMode() instead. It has the exact same API.');
        }
      }
      return isConcurrentMode(object) || typeOf(object) === REACT_ASYNC_MODE_TYPE;
    }

    function isConcurrentMode(object) {
      return typeOf(object) === REACT_CONCURRENT_MODE_TYPE;
    }

    function isContextConsumer(object) {
      return typeOf(object) === REACT_CONTEXT_TYPE;
    }

    function isContextProvider(object) {
      return typeOf(object) === REACT_PROVIDER_TYPE;
    }

    function isElement(object) {
      return _typeof(object) === 'object' && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
    }

    function isForwardRef(object) {
      return typeOf(object) === REACT_FORWARD_REF_TYPE;
    }

    function isFragment(object) {
      return typeOf(object) === REACT_FRAGMENT_TYPE;
    }

    function isLazy(object) {
      return typeOf(object) === REACT_LAZY_TYPE;
    }

    function isMemo(object) {
      return typeOf(object) === REACT_MEMO_TYPE;
    }

    function isPortal(object) {
      return typeOf(object) === REACT_PORTAL_TYPE;
    }

    function isProfiler(object) {
      return typeOf(object) === REACT_PROFILER_TYPE;
    }

    function isStrictMode(object) {
      return typeOf(object) === REACT_STRICT_MODE_TYPE;
    }

    function isSuspense(object) {
      return typeOf(object) === REACT_SUSPENSE_TYPE;
    }

    exports.AsyncMode = AsyncMode;
    exports.ConcurrentMode = ConcurrentMode;
    exports.ContextConsumer = ContextConsumer;
    exports.ContextProvider = ContextProvider;
    exports.Element = Element;
    exports.ForwardRef = ForwardRef;
    exports.Fragment = Fragment;
    exports.Lazy = Lazy;
    exports.Memo = Memo;
    exports.Portal = Portal;
    exports.Profiler = Profiler;
    exports.StrictMode = StrictMode;
    exports.Suspense = Suspense;
    exports.isAsyncMode = isAsyncMode;
    exports.isConcurrentMode = isConcurrentMode;
    exports.isContextConsumer = isContextConsumer;
    exports.isContextProvider = isContextProvider;
    exports.isElement = isElement;
    exports.isForwardRef = isForwardRef;
    exports.isFragment = isFragment;
    exports.isLazy = isLazy;
    exports.isMemo = isMemo;
    exports.isPortal = isPortal;
    exports.isProfiler = isProfiler;
    exports.isStrictMode = isStrictMode;
    exports.isSuspense = isSuspense;
    exports.isValidElementType = isValidElementType;
    exports.typeOf = typeOf;
  })();
}

/***/ }),

/***/ "./node_modules/react-is/index.js":
/*!****************************************!*\
  !*** ./node_modules/react-is/index.js ***!
  \****************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


if (false) {} else {
  module.exports = __webpack_require__(/*! ./cjs/react-is.development.js */ "./node_modules/react-is/cjs/react-is.development.js");
}

/***/ }),

/***/ "./node_modules/react-markdown/lib/ast-to-react.js":
/*!*********************************************************!*\
  !*** ./node_modules/react-markdown/lib/ast-to-react.js ***!
  \*********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var React = __webpack_require__(/*! react */ "react");

var xtend = __webpack_require__(/*! xtend */ "./node_modules/xtend/immutable.js");

var ReactIs = __webpack_require__(/*! react-is */ "./node_modules/react-is/index.js");

function astToReact(node, options) {
  var parent = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var index = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
  var renderer = options.renderers[node.type]; // Nodes created by plugins do not have positional info, in which case we set
  // an object that matches the positon interface.

  if (!node.position) {
    node.position = {
      start: {
        line: null,
        column: null,
        offset: null
      },
      end: {
        line: null,
        column: null,
        offset: null
      }
    };
  }

  var pos = node.position.start;
  var key = [node.type, pos.line, pos.column, index].join('-');

  if (!ReactIs.isValidElementType(renderer)) {
    throw new Error("Renderer for type `".concat(node.type, "` not defined or is not renderable"));
  }

  var nodeProps = getNodeProps(node, key, options, renderer, parent, index);
  return React.createElement(renderer, nodeProps, nodeProps.children || resolveChildren() || undefined);

  function resolveChildren() {
    return node.children && node.children.map(function (childNode, i) {
      return astToReact(childNode, options, {
        node: node,
        props: nodeProps
      }, i);
    });
  }
} // eslint-disable-next-line max-params, complexity


function getNodeProps(node, key, opts, renderer, parent, index) {
  var props = {
    key: key
  };
  var isSimpleRenderer = typeof renderer === 'string' || renderer === React.Fragment; // `sourcePos` is true if the user wants source information (line/column info from markdown source)

  if (opts.sourcePos && node.position) {
    props['data-sourcepos'] = flattenPosition(node.position);
  }

  if (opts.rawSourcePos && !isSimpleRenderer) {
    props.sourcePosition = node.position;
  } // If `includeNodeIndex` is true, pass node index info to all non-tag renderers


  if (opts.includeNodeIndex && parent.node && parent.node.children && !isSimpleRenderer) {
    props.index = parent.node.children.indexOf(node);
    props.parentChildCount = parent.node.children.length;
  }

  var ref = node.identifier !== null && node.identifier !== undefined ?
  /* istanbul ignore next - plugins could inject an undefined reference. */
  opts.definitions[node.identifier.toUpperCase()] || {} : null;

  switch (node.type) {
    case 'root':
      assignDefined(props, {
        className: opts.className
      });
      break;

    case 'text':
      props.nodeKey = key;
      props.children = node.value;
      break;

    case 'heading':
      props.level = node.depth;
      break;

    case 'list':
      props.start = node.start;
      props.ordered = node.ordered;
      props.spread = node.spread;
      props.depth = node.depth;
      break;

    case 'listItem':
      props.checked = node.checked;
      props.spread = node.spread;
      props.ordered = node.ordered;
      props.index = node.index;
      props.children = getListItemChildren(node, parent).map(function (childNode, i) {
        return astToReact(childNode, opts, {
          node: node,
          props: props
        }, i);
      });
      break;

    case 'definition':
      assignDefined(props, {
        identifier: node.identifier,
        title: node.title,
        url: node.url
      });
      break;

    case 'code':
      assignDefined(props, {
        language: node.lang && node.lang.split(/\s/, 1)[0]
      });
      break;

    case 'inlineCode':
      props.children = node.value;
      props.inline = true;
      break;

    case 'link':
      assignDefined(props, {
        title: node.title || undefined,
        target: typeof opts.linkTarget === 'function' ? opts.linkTarget(node.url, node.children, node.title) : opts.linkTarget,
        href: opts.transformLinkUri ? opts.transformLinkUri(node.url, node.children, node.title) : node.url
      });
      break;

    case 'image':
      assignDefined(props, {
        src: opts.transformImageUri ? opts.transformImageUri(node.url, node.children, node.title, node.alt) : node.url,
        alt: node.alt || '',
        title: node.title || undefined
      });
      break;

    case 'linkReference':
      assignDefined(props, xtend(ref, {
        href: opts.transformLinkUri ? opts.transformLinkUri(ref.href) : ref.href
      }));
      break;

    case 'imageReference':
      assignDefined(props, {
        src: opts.transformImageUri && ref.href ? opts.transformImageUri(ref.href, node.children, ref.title, node.alt) : ref.href,
        alt: node.alt || '',
        title: ref.title || undefined
      });
      break;

    case 'table':
    case 'tableHead':
    case 'tableBody':
      props.columnAlignment = node.align;
      break;

    case 'tableRow':
      props.isHeader = parent.node.type === 'tableHead';
      props.columnAlignment = parent.props.columnAlignment;
      break;

    case 'tableCell':
      assignDefined(props, {
        isHeader: parent.props.isHeader,
        align: parent.props.columnAlignment[index]
      });
      break;

    case 'virtualHtml':
      props.tag = node.tag;
      break;

    case 'html':
      // @todo find a better way than this
      props.isBlock = node.position.start.line !== node.position.end.line;
      props.allowDangerousHtml = opts.allowDangerousHtml;
      props.escapeHtml = opts.escapeHtml;
      props.skipHtml = opts.skipHtml;
      break;

    case 'parsedHtml':
      {
        var parsedChildren;

        if (node.children) {
          parsedChildren = node.children.map(function (child, i) {
            return astToReact(child, opts, {
              node: node,
              props: props
            }, i);
          });
        }

        props.allowDangerousHtml = opts.allowDangerousHtml;
        props.escapeHtml = opts.escapeHtml;
        props.skipHtml = opts.skipHtml;
        props.element = mergeNodeChildren(node, parsedChildren);
        break;
      }

    default:
      assignDefined(props, xtend(node, {
        type: undefined,
        position: undefined,
        children: undefined
      }));
  }

  if (!isSimpleRenderer && node.value) {
    props.value = node.value;
  }

  if (!isSimpleRenderer) {
    props.node = node;
  }

  return props;
}

function assignDefined(target, attrs) {
  for (var key in attrs) {
    if (typeof attrs[key] !== 'undefined') {
      target[key] = attrs[key];
    }
  }
}

function mergeNodeChildren(node, parsedChildren) {
  var el = node.element;

  if (Array.isArray(el)) {
    /* istanbul ignore next - `div` fallback for old React. */
    var Fragment = React.Fragment || 'div';
    return React.createElement(Fragment, null, el);
  }

  if (el.props.children || parsedChildren) {
    var children = React.Children.toArray(el.props.children).concat(parsedChildren);
    return React.cloneElement(el, null, children);
  }

  return React.cloneElement(el, null);
}

function flattenPosition(pos) {
  return [pos.start.line, ':', pos.start.column, '-', pos.end.line, ':', pos.end.column].map(String).join('');
}

function getListItemChildren(node, parent) {
  /* istanbul ignore next - list items are always in a list, but best to be sure. */
  var loose = parent && parent.node ? listLoose(parent.node) : listItemLoose(node);
  return loose ? node.children : unwrapParagraphs(node);
}

function unwrapParagraphs(node) {
  return node.children.reduce(function (array, child) {
    return array.concat(child.type === 'paragraph' ? child.children : [child]);
  }, []);
}

function listLoose(node) {
  var children = node.children;
  var loose = node.spread;
  var index = -1;

  while (!loose && ++index < children.length) {
    loose = listItemLoose(children[index]);
  }

  return loose;
}

function listItemLoose(node) {
  var spread = node.spread;
  /* istanbul ignore next - spread is present from remark-parse, but maybe plugins don’t set it. */

  return spread === undefined || spread === null ? node.children.length > 1 : spread;
}

module.exports = astToReact;

/***/ }),

/***/ "./node_modules/react-markdown/lib/get-definitions.js":
/*!************************************************************!*\
  !*** ./node_modules/react-markdown/lib/get-definitions.js ***!
  \************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var visit = __webpack_require__(/*! unist-util-visit */ "./node_modules/unist-util-visit/index.js");

module.exports = function getDefinitions(tree) {
  var definitions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  visit(tree, 'definition', function (node) {
    var identifier = node.identifier.toUpperCase();
    if (identifier in definitions) return;
    definitions[identifier] = {
      href: node.url,
      title: node.title
    };
  });
  return definitions;
};

/***/ }),

/***/ "./node_modules/react-markdown/lib/plugins/disallow-node.js":
/*!******************************************************************!*\
  !*** ./node_modules/react-markdown/lib/plugins/disallow-node.js ***!
  \******************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var visit = __webpack_require__(/*! unist-util-visit */ "./node_modules/unist-util-visit/index.js");

var splice = [].splice;

exports.ofType = function (types, mode) {
  return ifNotMatch(allow, mode);

  function allow(node, index, parent) {
    return !types.includes(node.type);
  }
};

exports.ifNotMatch = ifNotMatch;

function ifNotMatch(allow, mode) {
  return transform;

  function transform(tree) {
    visit(tree, filter);
    return tree;
  } // eslint-disable-next-line consistent-return


  function filter(node, index, parent) {
    if (parent && !allow(node, index, parent)) {
      var parameters = [index, 1];

      if (mode === 'unwrap' && node.children) {
        parameters = parameters.concat(node.children);
      }

      splice.apply(parent.children, parameters);
      return index;
    }
  }
}

/***/ }),

/***/ "./node_modules/react-markdown/lib/plugins/naive-html.js":
/*!***************************************************************!*\
  !*** ./node_modules/react-markdown/lib/plugins/naive-html.js ***!
  \***************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * Naive, simple plugin to match inline nodes without attributes
 * This allows say <strong>foo</strong>, but not <strong class="very">foo</strong>
 * For proper HTML support, you'll want a different plugin
 **/

var visit = __webpack_require__(/*! unist-util-visit */ "./node_modules/unist-util-visit/index.js");

var type = 'virtualHtml';
var selfClosingRe = /^<(area|base|br|col|embed|hr|img|input|keygen|link|meta|param|source|track|wbr)\s*\/?>$/i;
var simpleTagRe = /^<(\/?)([a-z]+)\s*>$/;

module.exports = function (tree) {
  var open;
  var currentParent;
  visit(tree, 'html', function (node, index, parent) {
    if (currentParent !== parent) {
      open = [];
      currentParent = parent;
    }

    var selfClosing = getSelfClosing(node);

    if (selfClosing) {
      parent.children.splice(index, 1, {
        type: type,
        tag: selfClosing,
        position: node.position
      });
      return true;
    }

    var current = getSimpleTag(node, parent);

    if (!current) {
      return true;
    }

    var matching = findAndPull(open, current.tag);

    if (matching) {
      parent.children.splice(index, 0, virtual(current, matching, parent));
    } else if (!current.opening) {
      open.push(current);
    }

    return true;
  }, true // Iterate in reverse
  );
  return tree;
};

function findAndPull(open, matchingTag) {
  var i = open.length;

  while (i--) {
    if (open[i].tag === matchingTag) {
      return open.splice(i, 1)[0];
    }
  }

  return false;
}

function getSimpleTag(node, parent) {
  var match = node.value.match(simpleTagRe);
  return match ? {
    tag: match[2],
    opening: !match[1],
    node: node
  } : false;
}

function getSelfClosing(node) {
  var match = node.value.match(selfClosingRe);
  return match ? match[1] : false;
}

function virtual(fromNode, toNode, parent) {
  var fromIndex = parent.children.indexOf(fromNode.node);
  var toIndex = parent.children.indexOf(toNode.node);
  var extracted = parent.children.splice(fromIndex, toIndex - fromIndex + 1);
  var children = extracted.slice(1, -1);
  return {
    type: type,
    children: children,
    tag: fromNode.tag,
    position: {
      start: fromNode.node.position.start,
      end: toNode.node.position.end,
      indent: []
    }
  };
}

/***/ }),

/***/ "./node_modules/react-markdown/lib/react-markdown.js":
/*!***********************************************************!*\
  !*** ./node_modules/react-markdown/lib/react-markdown.js ***!
  \***********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var xtend = __webpack_require__(/*! xtend */ "./node_modules/xtend/immutable.js");

var unified = __webpack_require__(/*! unified */ "./node_modules/unified/index.js");

var parse = __webpack_require__(/*! remark-parse */ "./node_modules/remark-parse/index.js");

var PropTypes = __webpack_require__(/*! prop-types */ "./node_modules/prop-types/index.js");

var addListMetadata = __webpack_require__(/*! mdast-add-list-metadata */ "./node_modules/mdast-add-list-metadata/index.js");

var naiveHtml = __webpack_require__(/*! ./plugins/naive-html */ "./node_modules/react-markdown/lib/plugins/naive-html.js");

var disallowNode = __webpack_require__(/*! ./plugins/disallow-node */ "./node_modules/react-markdown/lib/plugins/disallow-node.js");

var astToReact = __webpack_require__(/*! ./ast-to-react */ "./node_modules/react-markdown/lib/ast-to-react.js");

var wrapTableRows = __webpack_require__(/*! ./wrap-table-rows */ "./node_modules/react-markdown/lib/wrap-table-rows.js");

var getDefinitions = __webpack_require__(/*! ./get-definitions */ "./node_modules/react-markdown/lib/get-definitions.js");

var uriTransformer = __webpack_require__(/*! ./uri-transformer */ "./node_modules/react-markdown/lib/uri-transformer.js");

var defaultRenderers = __webpack_require__(/*! ./renderers */ "./node_modules/react-markdown/lib/renderers.js");

var symbols = __webpack_require__(/*! ./symbols */ "./node_modules/react-markdown/lib/symbols.js");

var allTypes = Object.keys(defaultRenderers);

var ReactMarkdown = function ReactMarkdown(props) {
  // To do in next major: remove `source`.
  var src = props.source || props.children || '';

  if (props.allowedTypes && props.disallowedTypes) {
    throw new Error('Only one of `allowedTypes` and `disallowedTypes` should be defined');
  }

  var renderers = xtend(defaultRenderers, props.renderers);
  var processor = unified().use(parse).use(props.plugins || []); // eslint-disable-next-line no-sync

  var tree = processor.runSync(processor.parse(src));
  var renderProps = xtend(props, {
    renderers: renderers,
    definitions: getDefinitions(tree)
  });
  determineAstToReactTransforms(props).forEach(function (transform) {
    tree = transform(tree, renderProps);
  });
  return tree;
};

function determineAstToReactTransforms(props) {
  var transforms = [wrapTableRows, addListMetadata()];
  var disallowedTypes = props.disallowedTypes;

  if (props.allowedTypes) {
    disallowedTypes = allTypes.filter(function (type) {
      return type !== 'root' && props.allowedTypes.indexOf(type) === -1;
    });
  }

  var removalMethod = props.unwrapDisallowed ? 'unwrap' : 'remove';

  if (disallowedTypes && disallowedTypes.length > 0) {
    transforms.push(disallowNode.ofType(disallowedTypes, removalMethod));
  }

  if (props.allowNode) {
    transforms.push(disallowNode.ifNotMatch(props.allowNode, removalMethod));
  } // To do in next major: remove `escapeHtml`.


  var renderHtml = (props.allowDangerousHtml || props.escapeHtml === false) && !props.skipHtml;
  var hasHtmlParser = (props.astPlugins || []).some(function (transform) {
    return transform.identity === symbols.HtmlParser;
  });

  if (renderHtml && !hasHtmlParser) {
    transforms.push(naiveHtml);
  }

  if (props.astPlugins) {
    transforms = transforms.concat(props.astPlugins);
  } // Add the final transform to turn everything into React.


  transforms.push(astToReact);
  return transforms;
}

ReactMarkdown.defaultProps = {
  transformLinkUri: uriTransformer
};
ReactMarkdown.propTypes = {
  className: PropTypes.string,
  source: PropTypes.string,
  children: PropTypes.string,
  sourcePos: PropTypes.bool,
  rawSourcePos: PropTypes.bool,
  escapeHtml: PropTypes.bool,
  allowDangerousHtml: PropTypes.bool,
  skipHtml: PropTypes.bool,
  allowNode: PropTypes.func,
  allowedTypes: PropTypes.arrayOf(PropTypes.oneOf(allTypes)),
  disallowedTypes: PropTypes.arrayOf(PropTypes.oneOf(allTypes)),
  transformLinkUri: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
  linkTarget: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
  transformImageUri: PropTypes.func,
  astPlugins: PropTypes.arrayOf(PropTypes.func),
  unwrapDisallowed: PropTypes.bool,
  renderers: PropTypes.object,
  plugins: PropTypes.array
};
ReactMarkdown.types = allTypes;
ReactMarkdown.renderers = defaultRenderers;
ReactMarkdown.uriTransformer = uriTransformer;
module.exports = ReactMarkdown;

/***/ }),

/***/ "./node_modules/react-markdown/lib/renderers.js":
/*!******************************************************!*\
  !*** ./node_modules/react-markdown/lib/renderers.js ***!
  \******************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* eslint-disable react/prop-types, react/no-multi-comp */


var xtend = __webpack_require__(/*! xtend */ "./node_modules/xtend/immutable.js");

var React = __webpack_require__(/*! react */ "react");
/* istanbul ignore next - Don’t crash on old React. */


var supportsStringRender = parseInt((React.version || '16').slice(0, 2), 10) >= 16;
var createElement = React.createElement;
module.exports = {
  "break": 'br',
  paragraph: 'p',
  emphasis: 'em',
  strong: 'strong',
  thematicBreak: 'hr',
  blockquote: 'blockquote',
  "delete": 'del',
  link: 'a',
  image: 'img',
  linkReference: 'a',
  imageReference: 'img',
  table: SimpleRenderer.bind(null, 'table'),
  tableHead: SimpleRenderer.bind(null, 'thead'),
  tableBody: SimpleRenderer.bind(null, 'tbody'),
  tableRow: SimpleRenderer.bind(null, 'tr'),
  tableCell: TableCell,
  root: Root,
  text: TextRenderer,
  list: List,
  listItem: ListItem,
  definition: NullRenderer,
  heading: Heading,
  inlineCode: InlineCode,
  code: CodeBlock,
  html: Html,
  virtualHtml: VirtualHtml,
  parsedHtml: ParsedHtml
};

function TextRenderer(props) {
  /* istanbul ignore next - a text node w/o a value could be injected by plugins */
  var children = props.children || '';
  /* istanbul ignore next - `span` is a fallback for old React. */

  return supportsStringRender ? children : createElement('span', null, children);
}

function Root(props) {
  var className = props.className;
  var root = !className && React.Fragment || 'div';
  return createElement(root, className ? {
    className: className
  } : null, props.children);
}

function SimpleRenderer(tag, props) {
  return createElement(tag, getCoreProps(props), props.children);
}

function TableCell(props) {
  var style = props.align ? {
    textAlign: props.align
  } : undefined;
  var coreProps = getCoreProps(props);
  return createElement(props.isHeader ? 'th' : 'td', style ? xtend({
    style: style
  }, coreProps) : coreProps, props.children);
}

function Heading(props) {
  return createElement("h".concat(props.level), getCoreProps(props), props.children);
}

function List(props) {
  var attrs = getCoreProps(props);

  if (props.start !== null && props.start !== 1 && props.start !== undefined) {
    attrs.start = props.start.toString();
  }

  return createElement(props.ordered ? 'ol' : 'ul', attrs, props.children);
}

function ListItem(props) {
  var checkbox = null;

  if (props.checked !== null && props.checked !== undefined) {
    var checked = props.checked;
    checkbox = createElement('input', {
      type: 'checkbox',
      checked: checked,
      readOnly: true
    });
  }

  return createElement('li', getCoreProps(props), checkbox, props.children);
}

function CodeBlock(props) {
  var className = props.language && "language-".concat(props.language);
  var code = createElement('code', className ? {
    className: className
  } : null, props.value);
  return createElement('pre', getCoreProps(props), code);
}

function InlineCode(props) {
  return createElement('code', getCoreProps(props), props.children);
}

function Html(props) {
  if (props.skipHtml) {
    return null;
  }

  var dangerous = props.allowDangerousHtml || props.escapeHtml === false;
  var tag = props.isBlock ? 'div' : 'span';

  if (!dangerous) {
    /* istanbul ignore next - `tag` is a fallback for old React. */
    return createElement(React.Fragment || tag, null, props.value);
  }

  var nodeProps = {
    dangerouslySetInnerHTML: {
      __html: props.value
    }
  };
  return createElement(tag, nodeProps);
}

function ParsedHtml(props) {
  /* To do: `React.cloneElement` is slow, is it really needed? */
  return props['data-sourcepos'] ? React.cloneElement(props.element, {
    'data-sourcepos': props['data-sourcepos']
  }) : props.element;
}

function VirtualHtml(props) {
  return createElement(props.tag, getCoreProps(props), props.children);
}

function NullRenderer() {
  return null;
}

function getCoreProps(props) {
  var source = props['data-sourcepos'];
  /* istanbul ignore next - nodes from plugins w/o position */

  return source ? {
    'data-sourcepos': source
  } : {};
}

/***/ }),

/***/ "./node_modules/react-markdown/lib/symbols.js":
/*!****************************************************!*\
  !*** ./node_modules/react-markdown/lib/symbols.js ***!
  \****************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var HtmlParser = '__RMD_HTML_PARSER__';
/* istanbul ignore next - Fallback for `Symbol`. */

exports.HtmlParser = typeof Symbol === 'undefined' ? HtmlParser : Symbol(HtmlParser);

/***/ }),

/***/ "./node_modules/react-markdown/lib/uri-transformer.js":
/*!************************************************************!*\
  !*** ./node_modules/react-markdown/lib/uri-transformer.js ***!
  \************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var protocols = ['http', 'https', 'mailto', 'tel'];

module.exports = function uriTransformer(uri) {
  var url = (uri || '').trim();
  var first = url.charAt(0);

  if (first === '#' || first === '/') {
    return url;
  }

  var colon = url.indexOf(':');

  if (colon === -1) {
    return url;
  }

  var length = protocols.length;
  var index = -1;

  while (++index < length) {
    var protocol = protocols[index];

    if (colon === protocol.length && url.slice(0, protocol.length).toLowerCase() === protocol) {
      return url;
    }
  }

  index = url.indexOf('?');

  if (index !== -1 && colon > index) {
    return url;
  }

  index = url.indexOf('#');

  if (index !== -1 && colon > index) {
    return url;
  } // eslint-disable-next-line no-script-url


  return 'javascript:void(0)';
};

/***/ }),

/***/ "./node_modules/react-markdown/lib/wrap-table-rows.js":
/*!************************************************************!*\
  !*** ./node_modules/react-markdown/lib/wrap-table-rows.js ***!
  \************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var visit = __webpack_require__(/*! unist-util-visit */ "./node_modules/unist-util-visit/index.js");

module.exports = function (node) {
  visit(node, 'table', wrap);
  return node;
};

function wrap(table) {
  var children = table.children;
  table.children = [{
    type: 'tableHead',
    align: table.align,
    children: [children[0]],
    position: children[0].position
  }];

  if (children.length > 1) {
    table.children.push({
      type: 'tableBody',
      align: table.align,
      children: children.slice(1),
      position: {
        start: children[1].position.start,
        end: children[children.length - 1].position.end
      }
    });
  }
}

/***/ }),

/***/ "./node_modules/remark-parse/index.js":
/*!********************************************!*\
  !*** ./node_modules/remark-parse/index.js ***!
  \********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = parse;

var fromMarkdown = __webpack_require__(/*! mdast-util-from-markdown */ "./node_modules/mdast-util-from-markdown/index.js");

function parse(options) {
  var self = this;
  this.Parser = parse;

  function parse(doc) {
    return fromMarkdown(doc, Object.assign({}, self.data('settings'), options, {
      // Note: these options are not in the readme.
      // The goal is for them to be set by plugins on `data` instead of being
      // passed by users.
      extensions: self.data('micromarkExtensions') || [],
      mdastExtensions: self.data('fromMarkdownExtensions') || []
    }));
  }
}

/***/ }),

/***/ "./node_modules/replace-ext/index.js":
/*!*******************************************!*\
  !*** ./node_modules/replace-ext/index.js ***!
  \*******************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var path = __webpack_require__(/*! path */ "./node_modules/path-browserify/index.js");

function replaceExt(npath, ext) {
  if (typeof npath !== 'string') {
    return npath;
  }

  if (npath.length === 0) {
    return npath;
  }

  var nFileName = path.basename(npath, path.extname(npath)) + ext;
  return path.join(path.dirname(npath), nFileName);
}

module.exports = replaceExt;

/***/ }),

/***/ "./node_modules/trough/index.js":
/*!**************************************!*\
  !*** ./node_modules/trough/index.js ***!
  \**************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var wrap = __webpack_require__(/*! ./wrap.js */ "./node_modules/trough/wrap.js");

module.exports = trough;
trough.wrap = wrap;
var slice = [].slice; // Create new middleware.

function trough() {
  var fns = [];
  var middleware = {};
  middleware.run = run;
  middleware.use = use;
  return middleware; // Run `fns`.  Last argument must be a completion handler.

  function run() {
    var index = -1;
    var input = slice.call(arguments, 0, -1);
    var done = arguments[arguments.length - 1];

    if (typeof done !== 'function') {
      throw new Error('Expected function as last argument, not ' + done);
    }

    next.apply(null, [null].concat(input)); // Run the next `fn`, if any.

    function next(err) {
      var fn = fns[++index];
      var params = slice.call(arguments, 0);
      var values = params.slice(1);
      var length = input.length;
      var pos = -1;

      if (err) {
        done(err);
        return;
      } // Copy non-nully input into values.


      while (++pos < length) {
        if (values[pos] === null || values[pos] === undefined) {
          values[pos] = input[pos];
        }
      }

      input = values; // Next or done.

      if (fn) {
        wrap(fn, next).apply(null, input);
      } else {
        done.apply(null, [null].concat(input));
      }
    }
  } // Add `fn` to the list.


  function use(fn) {
    if (typeof fn !== 'function') {
      throw new Error('Expected `fn` to be a function, not ' + fn);
    }

    fns.push(fn);
    return middleware;
  }
}

/***/ }),

/***/ "./node_modules/trough/wrap.js":
/*!*************************************!*\
  !*** ./node_modules/trough/wrap.js ***!
  \*************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var slice = [].slice;
module.exports = wrap; // Wrap `fn`.
// Can be sync or async; return a promise, receive a completion handler, return
// new values and errors.

function wrap(fn, callback) {
  var invoked;
  return wrapped;

  function wrapped() {
    var params = slice.call(arguments, 0);
    var callback = fn.length > params.length;
    var result;

    if (callback) {
      params.push(done);
    }

    try {
      result = fn.apply(null, params);
    } catch (error) {
      // Well, this is quite the pickle.
      // `fn` received a callback and invoked it (thus continuing the pipeline),
      // but later also threw an error.
      // We’re not about to restart the pipeline again, so the only thing left
      // to do is to throw the thing instead.
      if (callback && invoked) {
        throw error;
      }

      return done(error);
    }

    if (!callback) {
      if (result && typeof result.then === 'function') {
        result.then(then, done);
      } else if (result instanceof Error) {
        done(result);
      } else {
        then(result);
      }
    }
  } // Invoke `next`, only once.


  function done() {
    if (!invoked) {
      invoked = true;
      callback.apply(null, arguments);
    }
  } // Invoke `done` with one value.
  // Tracks if an error is passed, too.


  function then(value) {
    done(null, value);
  }
}

/***/ }),

/***/ "./node_modules/unified/index.js":
/*!***************************************!*\
  !*** ./node_modules/unified/index.js ***!
  \***************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var bail = __webpack_require__(/*! bail */ "./node_modules/bail/index.js");

var buffer = __webpack_require__(/*! is-buffer */ "./node_modules/unified/node_modules/is-buffer/index.js");

var extend = __webpack_require__(/*! extend */ "./node_modules/extend/index.js");

var plain = __webpack_require__(/*! is-plain-obj */ "./node_modules/is-plain-obj/index.js");

var trough = __webpack_require__(/*! trough */ "./node_modules/trough/index.js");

var vfile = __webpack_require__(/*! vfile */ "./node_modules/vfile/index.js"); // Expose a frozen processor.


module.exports = unified().freeze();
var slice = [].slice;
var own = {}.hasOwnProperty; // Process pipeline.

var pipeline = trough().use(pipelineParse).use(pipelineRun).use(pipelineStringify);

function pipelineParse(p, ctx) {
  ctx.tree = p.parse(ctx.file);
}

function pipelineRun(p, ctx, next) {
  p.run(ctx.tree, ctx.file, done);

  function done(err, tree, file) {
    if (err) {
      next(err);
    } else {
      ctx.tree = tree;
      ctx.file = file;
      next();
    }
  }
}

function pipelineStringify(p, ctx) {
  var result = p.stringify(ctx.tree, ctx.file);
  var file = ctx.file;

  if (result === undefined || result === null) {// Empty.
  } else if (typeof result === 'string' || buffer(result)) {
    file.contents = result;
  } else {
    file.result = result;
  }
} // Function to create the first processor.


function unified() {
  var attachers = [];
  var transformers = trough();
  var namespace = {};
  var frozen = false;
  var freezeIndex = -1; // Data management.

  processor.data = data; // Lock.

  processor.freeze = freeze; // Plugins.

  processor.attachers = attachers;
  processor.use = use; // API.

  processor.parse = parse;
  processor.stringify = stringify;
  processor.run = run;
  processor.runSync = runSync;
  processor.process = process;
  processor.processSync = processSync; // Expose.

  return processor; // Create a new processor based on the processor in the current scope.

  function processor() {
    var destination = unified();
    var length = attachers.length;
    var index = -1;

    while (++index < length) {
      destination.use.apply(null, attachers[index]);
    }

    destination.data(extend(true, {}, namespace));
    return destination;
  } // Freeze: used to signal a processor that has finished configuration.
  //
  // For example, take unified itself: it’s frozen.
  // Plugins should not be added to it.
  // Rather, it should be extended, by invoking it, before modifying it.
  //
  // In essence, always invoke this when exporting a processor.


  function freeze() {
    var values;
    var plugin;
    var options;
    var transformer;

    if (frozen) {
      return processor;
    }

    while (++freezeIndex < attachers.length) {
      values = attachers[freezeIndex];
      plugin = values[0];
      options = values[1];
      transformer = null;

      if (options === false) {
        continue;
      }

      if (options === true) {
        values[1] = undefined;
      }

      transformer = plugin.apply(processor, values.slice(1));

      if (typeof transformer === 'function') {
        transformers.use(transformer);
      }
    }

    frozen = true;
    freezeIndex = Infinity;
    return processor;
  } // Data management.
  // Getter / setter for processor-specific informtion.


  function data(key, value) {
    if (typeof key === 'string') {
      // Set `key`.
      if (arguments.length === 2) {
        assertUnfrozen('data', frozen);
        namespace[key] = value;
        return processor;
      } // Get `key`.


      return own.call(namespace, key) && namespace[key] || null;
    } // Set space.


    if (key) {
      assertUnfrozen('data', frozen);
      namespace = key;
      return processor;
    } // Get space.


    return namespace;
  } // Plugin management.
  //
  // Pass it:
  // *   an attacher and options,
  // *   a preset,
  // *   a list of presets, attachers, and arguments (list of attachers and
  //     options).


  function use(value) {
    var settings;
    assertUnfrozen('use', frozen);

    if (value === null || value === undefined) {// Empty.
    } else if (typeof value === 'function') {
      addPlugin.apply(null, arguments);
    } else if (_typeof(value) === 'object') {
      if ('length' in value) {
        addList(value);
      } else {
        addPreset(value);
      }
    } else {
      throw new Error('Expected usable value, not `' + value + '`');
    }

    if (settings) {
      namespace.settings = extend(namespace.settings || {}, settings);
    }

    return processor;

    function addPreset(result) {
      addList(result.plugins);

      if (result.settings) {
        settings = extend(settings || {}, result.settings);
      }
    }

    function add(value) {
      if (typeof value === 'function') {
        addPlugin(value);
      } else if (_typeof(value) === 'object') {
        if ('length' in value) {
          addPlugin.apply(null, value);
        } else {
          addPreset(value);
        }
      } else {
        throw new Error('Expected usable value, not `' + value + '`');
      }
    }

    function addList(plugins) {
      var length;
      var index;

      if (plugins === null || plugins === undefined) {// Empty.
      } else if (_typeof(plugins) === 'object' && 'length' in plugins) {
        length = plugins.length;
        index = -1;

        while (++index < length) {
          add(plugins[index]);
        }
      } else {
        throw new Error('Expected a list of plugins, not `' + plugins + '`');
      }
    }

    function addPlugin(plugin, value) {
      var entry = find(plugin);

      if (entry) {
        if (plain(entry[1]) && plain(value)) {
          value = extend(entry[1], value);
        }

        entry[1] = value;
      } else {
        attachers.push(slice.call(arguments));
      }
    }
  }

  function find(plugin) {
    var length = attachers.length;
    var index = -1;
    var entry;

    while (++index < length) {
      entry = attachers[index];

      if (entry[0] === plugin) {
        return entry;
      }
    }
  } // Parse a file (in string or vfile representation) into a unist node using
  // the `Parser` on the processor.


  function parse(doc) {
    var file = vfile(doc);
    var Parser;
    freeze();
    Parser = processor.Parser;
    assertParser('parse', Parser);

    if (newable(Parser, 'parse')) {
      return new Parser(String(file), file).parse();
    }

    return Parser(String(file), file); // eslint-disable-line new-cap
  } // Run transforms on a unist node representation of a file (in string or
  // vfile representation), async.


  function run(node, file, cb) {
    assertNode(node);
    freeze();

    if (!cb && typeof file === 'function') {
      cb = file;
      file = null;
    }

    if (!cb) {
      return new Promise(executor);
    }

    executor(null, cb);

    function executor(resolve, reject) {
      transformers.run(node, vfile(file), done);

      function done(err, tree, file) {
        tree = tree || node;

        if (err) {
          reject(err);
        } else if (resolve) {
          resolve(tree);
        } else {
          cb(null, tree, file);
        }
      }
    }
  } // Run transforms on a unist node representation of a file (in string or
  // vfile representation), sync.


  function runSync(node, file) {
    var complete = false;
    var result;
    run(node, file, done);
    assertDone('runSync', 'run', complete);
    return result;

    function done(err, tree) {
      complete = true;
      bail(err);
      result = tree;
    }
  } // Stringify a unist node representation of a file (in string or vfile
  // representation) into a string using the `Compiler` on the processor.


  function stringify(node, doc) {
    var file = vfile(doc);
    var Compiler;
    freeze();
    Compiler = processor.Compiler;
    assertCompiler('stringify', Compiler);
    assertNode(node);

    if (newable(Compiler, 'compile')) {
      return new Compiler(node, file).compile();
    }

    return Compiler(node, file); // eslint-disable-line new-cap
  } // Parse a file (in string or vfile representation) into a unist node using
  // the `Parser` on the processor, then run transforms on that node, and
  // compile the resulting node using the `Compiler` on the processor, and
  // store that result on the vfile.


  function process(doc, cb) {
    freeze();
    assertParser('process', processor.Parser);
    assertCompiler('process', processor.Compiler);

    if (!cb) {
      return new Promise(executor);
    }

    executor(null, cb);

    function executor(resolve, reject) {
      var file = vfile(doc);
      pipeline.run(processor, {
        file: file
      }, done);

      function done(err) {
        if (err) {
          reject(err);
        } else if (resolve) {
          resolve(file);
        } else {
          cb(null, file);
        }
      }
    }
  } // Process the given document (in string or vfile representation), sync.


  function processSync(doc) {
    var complete = false;
    var file;
    freeze();
    assertParser('processSync', processor.Parser);
    assertCompiler('processSync', processor.Compiler);
    file = vfile(doc);
    process(file, done);
    assertDone('processSync', 'process', complete);
    return file;

    function done(err) {
      complete = true;
      bail(err);
    }
  }
} // Check if `value` is a constructor.


function newable(value, name) {
  return typeof value === 'function' && value.prototype && ( // A function with keys in its prototype is probably a constructor.
  // Classes’ prototype methods are not enumerable, so we check if some value
  // exists in the prototype.
  keys(value.prototype) || name in value.prototype);
} // Check if `value` is an object with keys.


function keys(value) {
  var key;

  for (key in value) {
    return true;
  }

  return false;
} // Assert a parser is available.


function assertParser(name, Parser) {
  if (typeof Parser !== 'function') {
    throw new Error('Cannot `' + name + '` without `Parser`');
  }
} // Assert a compiler is available.


function assertCompiler(name, Compiler) {
  if (typeof Compiler !== 'function') {
    throw new Error('Cannot `' + name + '` without `Compiler`');
  }
} // Assert the processor is not frozen.


function assertUnfrozen(name, frozen) {
  if (frozen) {
    throw new Error('Cannot invoke `' + name + '` on a frozen processor.\nCreate a new processor first, by invoking it: use `processor()` instead of `processor`.');
  }
} // Assert `node` is a unist node.


function assertNode(node) {
  if (!node || typeof node.type !== 'string') {
    throw new Error('Expected node, got `' + node + '`');
  }
} // Assert that `complete` is `true`.


function assertDone(name, asyncName, complete) {
  if (!complete) {
    throw new Error('`' + name + '` finished async. Use `' + asyncName + '` instead');
  }
}

/***/ }),

/***/ "./node_modules/unified/node_modules/is-buffer/index.js":
/*!**************************************************************!*\
  !*** ./node_modules/unified/node_modules/is-buffer/index.js ***!
  \**************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
module.exports = function isBuffer(obj) {
  return obj != null && obj.constructor != null && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj);
};

/***/ }),

/***/ "./node_modules/unist-util-is/convert.js":
/*!***********************************************!*\
  !*** ./node_modules/unist-util-is/convert.js ***!
  \***********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

module.exports = convert;

function convert(test) {
  if (test == null) {
    return ok;
  }

  if (typeof test === 'string') {
    return typeFactory(test);
  }

  if (_typeof(test) === 'object') {
    return 'length' in test ? anyFactory(test) : allFactory(test);
  }

  if (typeof test === 'function') {
    return test;
  }

  throw new Error('Expected function, string, or object as test');
} // Utility assert each property in `test` is represented in `node`, and each
// values are strictly equal.


function allFactory(test) {
  return all;

  function all(node) {
    var key;

    for (key in test) {
      if (node[key] !== test[key]) return;
    }

    return true;
  }
}

function anyFactory(tests) {
  var checks = [];
  var index = -1;

  while (++index < tests.length) {
    checks[index] = convert(tests[index]);
  }

  return any;

  function any() {
    var index = -1;

    while (++index < checks.length) {
      if (checks[index].apply(this, arguments)) {
        return true;
      }
    }
  }
} // Utility to convert a string into a function which checks a given node’s type
// for said string.


function typeFactory(test) {
  return type;

  function type(node) {
    return node && node.type === test;
  }
} // Utility to return true.


function ok() {
  return true;
}

/***/ }),

/***/ "./node_modules/unist-util-stringify-position/index.js":
/*!*************************************************************!*\
  !*** ./node_modules/unist-util-stringify-position/index.js ***!
  \*************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var own = {}.hasOwnProperty;
module.exports = stringify;

function stringify(value) {
  // Nothing.
  if (!value || _typeof(value) !== 'object') {
    return '';
  } // Node.


  if (own.call(value, 'position') || own.call(value, 'type')) {
    return position(value.position);
  } // Position.


  if (own.call(value, 'start') || own.call(value, 'end')) {
    return position(value);
  } // Point.


  if (own.call(value, 'line') || own.call(value, 'column')) {
    return point(value);
  } // ?


  return '';
}

function point(point) {
  if (!point || _typeof(point) !== 'object') {
    point = {};
  }

  return index(point.line) + ':' + index(point.column);
}

function position(pos) {
  if (!pos || _typeof(pos) !== 'object') {
    pos = {};
  }

  return point(pos.start) + '-' + point(pos.end);
}

function index(value) {
  return value && typeof value === 'number' ? value : 1;
}

/***/ }),

/***/ "./node_modules/unist-util-visit-parents/index.js":
/*!********************************************************!*\
  !*** ./node_modules/unist-util-visit-parents/index.js ***!
  \********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/* Expose. */

module.exports = visitParents;
/* Visit. */

function visitParents(tree, type, visitor) {
  var stack = [];

  if (typeof type === 'function') {
    visitor = type;
    type = null;
  }

  one(tree);
  /* Visit a single node. */

  function one(node) {
    var result;

    if (!type || node.type === type) {
      result = visitor(node, stack.concat());
    }

    if (node.children && result !== false) {
      return all(node.children, node);
    }

    return result;
  }
  /* Visit children in `parent`. */


  function all(children, parent) {
    var length = children.length;
    var index = -1;
    var child;
    stack.push(parent);

    while (++index < length) {
      child = children[index];

      if (child && one(child) === false) {
        return false;
      }
    }

    stack.pop();
    return true;
  }
}

/***/ }),

/***/ "./node_modules/unist-util-visit/index.js":
/*!************************************************!*\
  !*** ./node_modules/unist-util-visit/index.js ***!
  \************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = visit;

var visitParents = __webpack_require__(/*! unist-util-visit-parents */ "./node_modules/unist-util-visit/node_modules/unist-util-visit-parents/index.js");

var CONTINUE = visitParents.CONTINUE;
var SKIP = visitParents.SKIP;
var EXIT = visitParents.EXIT;
visit.CONTINUE = CONTINUE;
visit.SKIP = SKIP;
visit.EXIT = EXIT;

function visit(tree, test, visitor, reverse) {
  if (typeof test === 'function' && typeof visitor !== 'function') {
    reverse = visitor;
    visitor = test;
    test = null;
  }

  visitParents(tree, test, overload, reverse);

  function overload(node, parents) {
    var parent = parents[parents.length - 1];
    var index = parent ? parent.children.indexOf(node) : null;
    return visitor(node, index, parent);
  }
}

/***/ }),

/***/ "./node_modules/unist-util-visit/node_modules/unist-util-visit-parents/color.browser.js":
/*!**********************************************************************************************!*\
  !*** ./node_modules/unist-util-visit/node_modules/unist-util-visit-parents/color.browser.js ***!
  \**********************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = identity;

function identity(d) {
  return d;
}

/***/ }),

/***/ "./node_modules/unist-util-visit/node_modules/unist-util-visit-parents/index.js":
/*!**************************************************************************************!*\
  !*** ./node_modules/unist-util-visit/node_modules/unist-util-visit-parents/index.js ***!
  \**************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

module.exports = visitParents;

var convert = __webpack_require__(/*! unist-util-is/convert */ "./node_modules/unist-util-is/convert.js");

var color = __webpack_require__(/*! ./color */ "./node_modules/unist-util-visit/node_modules/unist-util-visit-parents/color.browser.js");

var CONTINUE = true;
var SKIP = 'skip';
var EXIT = false;
visitParents.CONTINUE = CONTINUE;
visitParents.SKIP = SKIP;
visitParents.EXIT = EXIT;

function visitParents(tree, test, visitor, reverse) {
  var step;
  var is;

  if (typeof test === 'function' && typeof visitor !== 'function') {
    reverse = visitor;
    visitor = test;
    test = null;
  }

  is = convert(test);
  step = reverse ? -1 : 1;
  factory(tree, null, [])();

  function factory(node, index, parents) {
    var value = _typeof(node) === 'object' && node !== null ? node : {};
    var name;

    if (typeof value.type === 'string') {
      name = typeof value.tagName === 'string' ? value.tagName : typeof value.name === 'string' ? value.name : undefined;
      visit.displayName = 'node (' + color(value.type + (name ? '<' + name + '>' : '')) + ')';
    }

    return visit;

    function visit() {
      var grandparents = parents.concat(node);
      var result = [];
      var subresult;
      var offset;

      if (!test || is(node, index, parents[parents.length - 1] || null)) {
        result = toResult(visitor(node, parents));

        if (result[0] === EXIT) {
          return result;
        }
      }

      if (node.children && result[0] !== SKIP) {
        offset = (reverse ? node.children.length : -1) + step;

        while (offset > -1 && offset < node.children.length) {
          subresult = factory(node.children[offset], offset, grandparents)();

          if (subresult[0] === EXIT) {
            return subresult;
          }

          offset = typeof subresult[1] === 'number' ? subresult[1] : offset + step;
        }
      }

      return result;
    }
  }
}

function toResult(value) {
  if (value !== null && _typeof(value) === 'object' && 'length' in value) {
    return value;
  }

  if (typeof value === 'number') {
    return [CONTINUE, value];
  }

  return [value];
}

/***/ }),

/***/ "./node_modules/vfile-message/index.js":
/*!*********************************************!*\
  !*** ./node_modules/vfile-message/index.js ***!
  \*********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var stringify = __webpack_require__(/*! unist-util-stringify-position */ "./node_modules/unist-util-stringify-position/index.js");

module.exports = VMessage; // Inherit from `Error#`.

function VMessagePrototype() {}

VMessagePrototype.prototype = Error.prototype;
VMessage.prototype = new VMessagePrototype(); // Message properties.

var proto = VMessage.prototype;
proto.file = '';
proto.name = '';
proto.reason = '';
proto.message = '';
proto.stack = '';
proto.fatal = null;
proto.column = null;
proto.line = null; // Construct a new VMessage.
//
// Note: We cannot invoke `Error` on the created context, as that adds readonly
// `line` and `column` attributes on Safari 9, thus throwing and failing the
// data.

function VMessage(reason, position, origin) {
  var parts;
  var range;
  var location;

  if (typeof position === 'string') {
    origin = position;
    position = null;
  }

  parts = parseOrigin(origin);
  range = stringify(position) || '1:1';
  location = {
    start: {
      line: null,
      column: null
    },
    end: {
      line: null,
      column: null
    }
  }; // Node.

  if (position && position.position) {
    position = position.position;
  }

  if (position) {
    // Position.
    if (position.start) {
      location = position;
      position = position.start;
    } else {
      // Point.
      location.start = position;
    }
  }

  if (reason.stack) {
    this.stack = reason.stack;
    reason = reason.message;
  }

  this.message = reason;
  this.name = range;
  this.reason = reason;
  this.line = position ? position.line : null;
  this.column = position ? position.column : null;
  this.location = location;
  this.source = parts[0];
  this.ruleId = parts[1];
}

function parseOrigin(origin) {
  var result = [null, null];
  var index;

  if (typeof origin === 'string') {
    index = origin.indexOf(':');

    if (index === -1) {
      result[1] = origin;
    } else {
      result[0] = origin.slice(0, index);
      result[1] = origin.slice(index + 1);
    }
  }

  return result;
}

/***/ }),

/***/ "./node_modules/vfile/core.js":
/*!************************************!*\
  !*** ./node_modules/vfile/core.js ***!
  \************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(process) {

var path = __webpack_require__(/*! path */ "./node_modules/path-browserify/index.js");

var replace = __webpack_require__(/*! replace-ext */ "./node_modules/replace-ext/index.js");

var buffer = __webpack_require__(/*! is-buffer */ "./node_modules/vfile/node_modules/is-buffer/index.js");

module.exports = VFile;
var own = {}.hasOwnProperty;
var proto = VFile.prototype; // Order of setting (least specific to most), we need this because otherwise
// `{stem: 'a', path: '~/b.js'}` would throw, as a path is needed before a
// stem can be set.

var order = ['history', 'path', 'basename', 'stem', 'extname', 'dirname'];
proto.toString = toString; // Access full path (`~/index.min.js`).

Object.defineProperty(proto, 'path', {
  get: getPath,
  set: setPath
}); // Access parent path (`~`).

Object.defineProperty(proto, 'dirname', {
  get: getDirname,
  set: setDirname
}); // Access basename (`index.min.js`).

Object.defineProperty(proto, 'basename', {
  get: getBasename,
  set: setBasename
}); // Access extname (`.js`).

Object.defineProperty(proto, 'extname', {
  get: getExtname,
  set: setExtname
}); // Access stem (`index.min`).

Object.defineProperty(proto, 'stem', {
  get: getStem,
  set: setStem
}); // Construct a new file.

function VFile(options) {
  var prop;
  var index;
  var length;

  if (!options) {
    options = {};
  } else if (typeof options === 'string' || buffer(options)) {
    options = {
      contents: options
    };
  } else if ('message' in options && 'messages' in options) {
    return options;
  }

  if (!(this instanceof VFile)) {
    return new VFile(options);
  }

  this.data = {};
  this.messages = [];
  this.history = [];
  this.cwd = process.cwd(); // Set path related properties in the correct order.

  index = -1;
  length = order.length;

  while (++index < length) {
    prop = order[index];

    if (own.call(options, prop)) {
      this[prop] = options[prop];
    }
  } // Set non-path related properties.


  for (prop in options) {
    if (order.indexOf(prop) === -1) {
      this[prop] = options[prop];
    }
  }
}

function getPath() {
  return this.history[this.history.length - 1];
}

function setPath(path) {
  assertNonEmpty(path, 'path');

  if (path !== this.path) {
    this.history.push(path);
  }
}

function getDirname() {
  return typeof this.path === 'string' ? path.dirname(this.path) : undefined;
}

function setDirname(dirname) {
  assertPath(this.path, 'dirname');
  this.path = path.join(dirname || '', this.basename);
}

function getBasename() {
  return typeof this.path === 'string' ? path.basename(this.path) : undefined;
}

function setBasename(basename) {
  assertNonEmpty(basename, 'basename');
  assertPart(basename, 'basename');
  this.path = path.join(this.dirname || '', basename);
}

function getExtname() {
  return typeof this.path === 'string' ? path.extname(this.path) : undefined;
}

function setExtname(extname) {
  var ext = extname || '';
  assertPart(ext, 'extname');
  assertPath(this.path, 'extname');

  if (ext) {
    if (ext.charAt(0) !== '.') {
      throw new Error('`extname` must start with `.`');
    }

    if (ext.indexOf('.', 1) !== -1) {
      throw new Error('`extname` cannot contain multiple dots');
    }
  }

  this.path = replace(this.path, ext);
}

function getStem() {
  return typeof this.path === 'string' ? path.basename(this.path, this.extname) : undefined;
}

function setStem(stem) {
  assertNonEmpty(stem, 'stem');
  assertPart(stem, 'stem');
  this.path = path.join(this.dirname || '', stem + (this.extname || ''));
} // Get the value of the file.


function toString(encoding) {
  var value = this.contents || '';
  return buffer(value) ? value.toString(encoding) : String(value);
} // Assert that `part` is not a path (i.e., does not contain `path.sep`).


function assertPart(part, name) {
  if (part.indexOf(path.sep) !== -1) {
    throw new Error('`' + name + '` cannot be a path: did not expect `' + path.sep + '`');
  }
} // Assert that `part` is not empty.


function assertNonEmpty(part, name) {
  if (!part) {
    throw new Error('`' + name + '` cannot be empty');
  }
} // Assert `path` exists.


function assertPath(path, name) {
  if (!path) {
    throw new Error('Setting `' + name + '` requires `path` to be set too');
  }
}
/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../process/browser.js */ "./node_modules/process/browser.js")))

/***/ }),

/***/ "./node_modules/vfile/index.js":
/*!*************************************!*\
  !*** ./node_modules/vfile/index.js ***!
  \*************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var VMessage = __webpack_require__(/*! vfile-message */ "./node_modules/vfile-message/index.js");

var VFile = __webpack_require__(/*! ./core.js */ "./node_modules/vfile/core.js");

module.exports = VFile;
var proto = VFile.prototype;
proto.message = message;
proto.info = info;
proto.fail = fail; // Create a message with `reason` at `position`.
// When an error is passed in as `reason`, copies the stack.

function message(reason, position, origin) {
  var filePath = this.path;
  var message = new VMessage(reason, position, origin);

  if (filePath) {
    message.name = filePath + ':' + message.name;
    message.file = filePath;
  }

  message.fatal = false;
  this.messages.push(message);
  return message;
} // Fail: creates a vmessage, associates it with the file, and throws it.


function fail() {
  var message = this.message.apply(this, arguments);
  message.fatal = true;
  throw message;
} // Info: creates a vmessage, associates it with the file, and marks the fatality
// as null.


function info() {
  var message = this.message.apply(this, arguments);
  message.fatal = null;
  return message;
}

/***/ }),

/***/ "./node_modules/vfile/node_modules/is-buffer/index.js":
/*!************************************************************!*\
  !*** ./node_modules/vfile/node_modules/is-buffer/index.js ***!
  \************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
module.exports = function isBuffer(obj) {
  return obj != null && obj.constructor != null && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj);
};

/***/ }),

/***/ "./node_modules/xtend/immutable.js":
/*!*****************************************!*\
  !*** ./node_modules/xtend/immutable.js ***!
  \*****************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = extend;
var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend() {
  var target = {};

  for (var i = 0; i < arguments.length; i++) {
    var source = arguments[i];

    for (var key in source) {
      if (hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }

  return target;
}

/***/ }),

/***/ "./src/index.js":
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
/*! no exports provided */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var react_markdown__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-markdown */ "./node_modules/react-markdown/lib/react-markdown.js");
/* harmony import */ var react_markdown__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_markdown__WEBPACK_IMPORTED_MODULE_0__);
function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

var Noodl = __webpack_require__(/*! @noodl/noodl-sdk */ "./node_modules/@noodl/noodl-sdk/index.js");



function MarkdownComponent(props) {
  var openLinksInNewTab = props.openLinksInNewTab,
      otherProps = _objectWithoutProperties(props, ["openLinksInNewTab"]);

  return /*#__PURE__*/React.createElement(react_markdown__WEBPACK_IMPORTED_MODULE_0___default.a, _extends({}, otherProps, {
    linkTarget: openLinksInNewTab ? '_blank' : '_self'
  }));
}

var MarkdownNode = Noodl.defineReactNode({
  name: 'Markdown',
  category: 'Visual',
  docs: 'https://docs.noodl.net/#/modules/markdown/markdown-node',
  getReactComponent: function getReactComponent() {
    return MarkdownComponent;
  },
  inputProps: {
    className: {
      type: 'string',
      displayName: 'CSS Class',
      "default": 'markdown'
    },
    source: {
      type: {
        name: 'string',
        multiline: true
      }
    },
    allowDangerousHtml: {
      type: 'boolean',
      "default": true,
      displayName: 'Allow HTML'
    },
    openLinksInNewTab: {
      type: 'boolean',
      "default": true,
      displayName: 'Open Links in tab'
    }
  }
});
Noodl.defineModule({
  reactNodes: [MarkdownNode],
  nodes: [],
  setup: function setup() {}
});

/***/ }),

/***/ "react":
/*!************************!*\
  !*** external "React" ***!
  \************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = React;

/***/ })

/******/ });
//# sourceMappingURL=index.js.map