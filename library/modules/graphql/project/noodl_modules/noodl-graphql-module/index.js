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

const _colors = {
    "purple":"component",
    "green":"data",
    "default":"default",
    "grey":"default"
}

Noodl.defineNode = function(def) {
    const _def = {};

    _def.name = def.name;
    _def.displayNodeName = def.displayName;
    _def.usePortAsLabel = def.useInputAsLabel;
    _def.color = _colors[def.color || 'default'];
    _def.category = def.category || 'Modules';
    _def.getInspectInfo = def.getInspectInfo;
    _def.docs = def.docs;
    
    _def.initialize = function() {
        this.inputs = {};
        var _outputs = this.outputs = {};
        var _this = this;

        // Function for quickly setting outputs
        this.setOutputs = function(o) {
            for(var key in o) {
                _outputs[key] = o[key];
                _this.flagOutputDirty(key);
            }
        }

        // Sending warnings
        this.clearWarnings = (function() {
            if(this.context.editorConnection && this.nodeScope && this.nodeScope.componentOwner)
                this.context.editorConnection.clearWarnings(this.nodeScope.componentOwner.name, this.id);
        }).bind(this);

        this.sendWarning = (function(name,message) {
            if(this.context.editorConnection && this.nodeScope && this.nodeScope.componentOwner)
                this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, name, {
                    message: message
                });
        }).bind(this);

        if(typeof def.initialize === 'function')
            def.initialize.apply(this);
    }
    _def.inputs = {};
    _def.outputs = {};

    for(var key in def.inputs) {
        _def.inputs[key] = {
            type:(typeof def.inputs[key] === 'object')?def.inputs[key].type:def.inputs[key],
            displayName:(typeof def.inputs[key] === 'object')?def.inputs[key].displayName:undefined,
            group:(typeof def.inputs[key] === 'object')?def.inputs[key].group:undefined,
            default:(typeof def.inputs[key] === 'object')?def.inputs[key].default:undefined,
            set:(function() { const _key = key; return function(value) {
                this.inputs[_key] = value;
                if(def.changed && typeof def.changed[_key] === 'function') {
                    def.changed[_key].apply(this,[value]);
                }
            }})()
        }
    }

    for(var key in def.signals) {
        _def.inputs[key] = {
            type:'signal',
            displayName:(typeof def.signals[key] === 'object')?def.signals[key].displayName:undefined,
            group:(typeof def.signals[key] === 'object')?def.signals[key].group:undefined,
            valueChangedToTrue:(function() { const _key = key; return function() {
                const _fn = (typeof def.signals[_key] === 'object')?def.signals[_key].signal:def.signals[_key]
                if(typeof _fn === 'function') {
                    this.scheduleAfterInputsHaveUpdated(() => {
                        _fn.apply(this);
                    }) 
                }
            }})()
        }
    }

    for(var key in def.outputs) {
        if(def.outputs[key] === 'signal') {
            _def.outputs[key] = {
                type:'signal',
            }
        }
        else {
            _def.outputs[key] = {
                type:(typeof def.outputs[key] === 'object')?def.outputs[key].type:def.outputs[key],
                displayName:(typeof def.outputs[key] === 'object')?def.outputs[key].displayName:undefined,
                group:(typeof def.outputs[key] === 'object')?def.outputs[key].group:undefined,
                getter:(function() { const _key = key; return function() {
                    return this.outputs[_key];
                }})()
            }
        }
    }

    _def.methods = _def.prototypeExtensions = {};
    for(var key in def.methods) {
        _def.prototypeExtensions[key] = def.methods[key];
    }
    if(_def.methods.onNodeDeleted) { // Override the onNodeDeleted if required
        _def.methods._onNodeDeleted = function() {
            this.__proto__.__proto__._onNodeDeleted.call(this);
            _def.methods.onNodeDeleted.value.call(this);
        }
    }

    return {node:_def,setup:def.setup};
}

Noodl.defineCollectionNode = function(def) {
    const _def = {
        name:def.name,
        category:def.category,
        color:'data',
        inputs:def.inputs,
        outputs:Object.assign({
            Items:'array',
            'Fetch Started':'signal',
            'Fetch Completed':'signal'
        },def.outputs||{}),
        signals:Object.assign({
            Fetch:function() {
                var _this = this;
                this.sendSignalOnOutput('Fetch Started');
                var a = def.fetch.call(this,function() {
                    _this.sendSignalOnOutput('Fetch Completed');
                });
                this.setOutputs({
                    Items:a
                })
            }
        },def.signals||{})
    }

    return Noodl.defineNode(_def);
}

Noodl.defineModelNode = function(def) {
    const _def = {
        name:def.name,
        category:def.category,
        color:'data',
        inputs:{
            Id:'string'
        },
        outputs:{
            Fetched:'signal'
        },
        changed:{
            Id:function(value) {
                if(this._object && this._changeListener)
                    this._object.off('change',this._changeListener)
                
                this._object = Noodl.Object.get(value);
                this._changeListener = (name,value) => {
                    const _o = {}
                    _o[name] = value;
                    this.setOutputs(_o)
                }
                this._object.on('change',this._changeListener)

                this.setOutputs(this._object.data);
                this.sendSignalOnOutput('Fetched');
            }
        },
        initialize:function() {

        }
    }

    for(var key in def.properties) {
        _def.inputs[key] = def.properties[key];
        _def.outputs[key] = def.properties[key];
        _def.changed[key] = (function() { const _key = key; return function(value) {
            if(!this._object) return;
            this._object.set(_key,value);
        }})()
    }
 
    return Noodl.defineNode(_def);
}

Noodl.defineReactNode = function(def) {
    var _def = Noodl.defineNode(def);

    _def.node.getReactComponent = def.getReactComponent;
    _def.node.inputProps = def.inputProps;
    _def.node.inputCss = def.inputCss;
    _def.node.outputProps = def.outputProps;
    _def.node.setup = def.setup;
    _def.node.frame = def.frame;

    return _def.node;
}

module.exports = Noodl;

/***/ }),

/***/ "./src/index.js":
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

const Noodl = __webpack_require__(/*! @noodl/noodl-sdk */ "./node_modules/@noodl/noodl-sdk/index.js");

const _defaultRequestHeaders = "// Specify the request headers as a JS object, for instance:\n" +
"// headers({\n" +
"//  'Auhtorization':'secret'\n" +
"// })\n"+
"headers({})\n"

const GraphQLQueryNode = Noodl.defineNode({
	category: 'GraphQL',
	name: 'GraphQL Query',
	color: 'green',
	docs: 'https://docs.noodl.net/#/modules/graphql/graphql-node',
	initialize:function() {
		this.variableValues = {};
		this.results = {};

		this.clearWarnings();
	},
	inputs: {
		Query: {
			group:'General',
			type: { name: 'string', codeeditor: 'graphql' }
		},
		Endpoint: {
			group:'General',
			type: 'string'
		},
		ResultsList: {
			group:'Results',
			type: 'stringlist'
		},
		RequestHeaders:{
			group:'Advanced',
			displayName:'Request Headers',
			type: { name: 'string', codeeditor: 'javascript' },
			default:_defaultRequestHeaders
		}
	},
	outputs: {
	},
	changed:{
		RequestHeaders:function(value) {
			try {
				this.requestHeaderFunc = new Function('headers',value);
			}
			catch(e) {
				this.requestHeaderFunc = undefined;
				this.sendWarning('grapgl-headers-warning','Error in headers script: ' +  e);
			}  
		}
	},
	signals: {
		Fetch: function () {
			this.clearWarnings();
			
			const xhr = new XMLHttpRequest();

			xhr.onload = () => {
				if (xhr.status >= 200 && xhr.status < 300) {
					const response = JSON.parse(xhr.responseText);
					if(response.data) {
						if(this.inputs.ResultsList) {
							this.inputs.ResultsList.split(',').forEach((o) => {
								var _o = 'res-'+o;
								if(this.hasOutput(_o)) {
									this.results[o] = this.extractResult(o,response.data);
									this.flagOutputDirty(_o);
								}
							})
						}
					}
					else if(response.errors) {
						var message = '';
						response.errors.forEach((e) => message += (e.message + '\n'))
						this.sendWarning('grapgql-query-warning',message);
					}
				}
			}

			const json = {
				"query": this.inputs.Query,
				"variables": this.variableValues
			};

			xhr.open('POST', this.inputs.Endpoint);

			xhr.setRequestHeader('Content-Type', 'application/json');
			xhr.setRequestHeader('Accept', 'application/json');

			// Let's get the user specified headers
			if(this.requestHeaderFunc) {
				this.requestHeaderFunc(function(headers) {
					for(var key in headers) {
						xhr.setRequestHeader(key,headers[key])
					}
				})
			}

			xhr.send(JSON.stringify(json));
		}
	},
	methods: {
		registerInputIfNeeded: function (name) {
			if (this.hasInput(name)) {
				return;
			}

			this.registerInput(name, {
				set: this.setVariableValue.bind(this, name.substring('var-'.length))
			});
		},
		registerOutputIfNeeded: function (name) {
			if (this.hasOutput(name)) {
				return;
			}

			this.registerOutput(name, {
				getter: this.getResult.bind(this, name.substring('res-'.length))
			});
		},		
		setVariableValue: function (name, value) {
			this.variableValues[name] = value;
		},
		getResult: function(name) {
			return this.results[name];
		},
		extractResult:function(name,json) {
			const result = Noodl.Array.get();
			result.set(json[name]);
			return result;
		}
	},
	setup: function (context, graphModel) {
		if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
			return;
		}

		graphModel.on("nodeAdded.GraphQL Query", function (node) {

			function updatePorts() {
				var ports = [];

				const query = node.parameters.Query;
				if (query) {
					var variables = query.match(/\$[A-Za-z0-9]+/g)

					if(variables) {
						const unique = {};
						variables.forEach((v) => unique[v] = true)

						Object.keys(unique).forEach((p) => {
							ports.push({
								name: 'var-' + p.substring(1),
								displayName: p.substring(1),
								group: 'Variables',
								plug: 'input',
								type: { name: '*', allowConnectionsOnly: true }
							});
						})
					}
				}

				const resultsList = node.parameters.ResultsList;
				if (resultsList) {
					resultsList.split(',').forEach((p) => {
						ports.push({
							name: 'res-' + p,
							displayName: p,
							group: 'Results',
							plug: 'output',
							type: '*'
						});
					})
				}

				context.editorConnection.sendDynamicPorts(node.id, ports);
			}

			if (node.parameters.Query || node.parameters.ResultsList) {
				updatePorts();
			}
			node.on("parameterUpdated", function (event) {
				if (event.name === "Query" || event.name === "ResultsList") {
					updatePorts();
				}
			})
		})
	}
})

Noodl.defineModule({
	nodes: [
		GraphQLQueryNode
	],
	setup() {
		//this is called once on startup
	}
});

/***/ })

/******/ });
//# sourceMappingURL=index.js.map