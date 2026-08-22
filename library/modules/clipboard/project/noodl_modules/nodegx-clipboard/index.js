/* NodeGX Clipboard module — hand-authored (LBR-009 module expansion).
   A single Copy To Clipboard node: navigator.clipboard.writeText with a
   document.execCommand('copy') fallback for non-secure contexts.
   No dependencies, no network, no API keys. */

// ── Noodl node-definition SDK shim ───────────────────────────────────────────
/* Noodl node-definition SDK shim — verbatim from @noodl/noodl-sdk as shipped inside the
   custom-html and chart-js library modules. The viewer HTML prelude only provides
   Noodl.defineModule (it pushes modules into window.__noodl_modules); this installs
   Noodl.defineNode / defineReactNode / defineCollectionNode / defineModelNode so a
   hand-authored module can declare nodes without a webpack/SDK build step. */
(function () {
  if (typeof Noodl === "undefined" || typeof Noodl.defineNode === "function") return;
  function n(t){return(n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t})(t)}var o={purple:"component",green:"data",default:"default",grey:"default"};Noodl.defineNode=function(t){var e={};for(var r in e.name=t.name,e.displayNodeName=t.displayName,e.usePortAsLabel=t.useInputAsLabel,e.color=o[t.color||"default"],e.category=t.category||"Modules",e.getInspectInfo=t.getInspectInfo,e.docs=t.docs,e.initialize=function(){this.inputs={};var e=this.outputs={},n=this;this.setOutputs=function(t){for(var o in t)e[o]=t[o],n.flagOutputDirty(o)},this.clearWarnings=function(){this.context.editorConnection&&this.nodeScope&&this.nodeScope.componentOwner&&this.context.editorConnection.clearWarnings(this.nodeScope.componentOwner.name,this.id)}.bind(this),this.sendWarning=function(t,e){this.context.editorConnection&&this.nodeScope&&this.nodeScope.componentOwner&&this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name,this.id,t,{message:e})}.bind(this),"function"==typeof t.initialize&&t.initialize.apply(this)},e.inputs={},e.outputs={},t.inputs)e.inputs[r]={type:"object"===n(t.inputs[r])?t.inputs[r].type:t.inputs[r],displayName:"object"===n(t.inputs[r])?t.inputs[r].displayName:void 0,group:"object"===n(t.inputs[r])?t.inputs[r].group:void 0,default:"object"===n(t.inputs[r])?t.inputs[r].default:void 0,set:function(){var e=r;return function(n){this.inputs[e]=n,t.changed&&"function"==typeof t.changed[e]&&t.changed[e].apply(this,[n])}}()};for(var r in t.signals)e.inputs[r]={type:"signal",displayName:"object"===n(t.signals[r])?t.signals[r].displayName:void 0,group:"object"===n(t.signals[r])?t.signals[r].group:void 0,valueChangedToTrue:function(){var e=r;return function(){var o=this,r="object"===n(t.signals[e])?t.signals[e].signal:t.signals[e];"function"==typeof r&&this.scheduleAfterInputsHaveUpdated((function(){r.apply(o)}))}}()};for(var r in t.outputs)"signal"===t.outputs[r]?e.outputs[r]={type:"signal"}:e.outputs[r]={type:"object"===n(t.outputs[r])?t.outputs[r].type:t.outputs[r],displayName:"object"===n(t.outputs[r])?t.outputs[r].displayName:void 0,group:"object"===n(t.outputs[r])?t.outputs[r].group:void 0,getter:function(){var t=r;return function(){return this.outputs[t]}}()};for(var r in e.methods=e.prototypeExtensions={},t.methods)e.prototypeExtensions[r]=t.methods[r];return e.methods.onNodeDeleted&&(e.methods._onNodeDeleted=function(){this.__proto__.__proto__._onNodeDeleted.call(this),e.methods.onNodeDeleted.value.call(this)}),{node:e,setup:t.setup}},Noodl.defineCollectionNode=function(t){var e={name:t.name,category:t.category,color:"data",inputs:t.inputs,outputs:Object.assign({Items:"array","Fetch Started":"signal","Fetch Completed":"signal"},t.outputs||{}),signals:Object.assign({Fetch:function(){var e=this;this.sendSignalOnOutput("Fetch Started");var n=t.fetch.call(this,(function(){e.sendSignalOnOutput("Fetch Completed")}));this.setOutputs({Items:n})}},t.signals||{})};return Noodl.defineNode(e)},Noodl.defineModelNode=function(t){var e={name:t.name,category:t.category,color:"data",inputs:{Id:"string"},outputs:{Fetched:"signal"},changed:{Id:function(t){var e=this;this._object&&this._changeListener&&this._object.off("change",this._changeListener),this._object=Noodl.Object.get(t),this._changeListener=function(t,n){var o={};o[t]=n,e.setOutputs(o)},this._object.on("change",this._changeListener),this.setOutputs(this._object.data),this.sendSignalOnOutput("Fetched")}},initialize:function(){}};for(var n in t.properties)e.inputs[n]=t.properties[n],e.outputs[n]=t.properties[n],e.changed[n]=function(){var t=n;return function(e){this._object&&this._object.set(t,e)}}();return Noodl.defineNode(e)},Noodl.defineReactNode=function(t){var e=Noodl.defineNode(t);return e.node.getReactComponent=t.getReactComponent,e.node.inputProps=t.inputProps,e.node.inputCss=t.inputCss,e.node.outputProps=t.outputProps,e.node.setup=t.setup,e.node.frame=t.frame,e.node}
})();
/* ── Copy To Clipboard node ───────────────────────────────────────────────────
 *
 * Copies the `Text` input to the user's clipboard when the `Copy` signal fires.
 *
 * Strategy: prefer the async Clipboard API (`navigator.clipboard.writeText`),
 * which only exists in secure contexts (https / localhost). On plain http, in
 * older browsers, or when the async write is refused, fall back to the classic
 * off-screen-textarea + `document.execCommand('copy')` path. Emits `Success`
 * or `Failure`, and puts a human-readable message on the `Error` output.
 *
 * Every input is guarded — an unconnected input has no default at runtime, so
 * `Text` may arrive as undefined and is coerced to an empty string.
 */
(function () {
  if (typeof Noodl === 'undefined' || typeof Noodl.defineNode !== 'function') return;

  var clipboardNode = Noodl.defineNode({
    name: 'nodegx.clipboard',
    displayName: 'Copy To Clipboard',
    category: 'Utilities',
    color: 'green',
    inputs: {
      Text: {
        displayName: 'Text',
        group: 'Clipboard',
        type: 'string',
        default: ''
      }
    },
    outputs: {
      Success: 'signal',
      Failure: 'signal',
      Error: {
        displayName: 'Error',
        group: 'Clipboard',
        type: 'string'
      }
    },
    signals: {
      Copy: {
        displayName: 'Copy',
        group: 'Clipboard',
        signal: function () {
          var node = this;
          var raw = node.inputs ? node.inputs.Text : undefined;
          var text = raw === undefined || raw === null ? '' : String(raw);

          function succeed() {
            node.setOutputs({ Error: '' });
            node.sendSignalOnOutput('Success');
          }

          function fail(err) {
            var message =
              err && err.message
                ? String(err.message)
                : err
                ? String(err)
                : 'Copy to clipboard failed';
            node.setOutputs({ Error: message });
            node.sendSignalOnOutput('Failure');
          }

          // Fallback for non-secure contexts (plain http) and older browsers:
          // an off-screen readonly textarea + document.execCommand('copy').
          function legacyCopy() {
            if (
              typeof document === 'undefined' ||
              !document.body ||
              typeof document.execCommand !== 'function'
            ) {
              fail('Clipboard is not available in this environment');
              return;
            }
            var textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.top = '-1000px';
            textarea.style.left = '-1000px';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            try {
              textarea.focus();
              textarea.select();
              if (typeof textarea.setSelectionRange === 'function') {
                textarea.setSelectionRange(0, textarea.value.length);
              }
              var copied = document.execCommand('copy');
              if (copied) {
                succeed();
              } else {
                fail("document.execCommand('copy') was refused by the browser");
              }
            } catch (e) {
              fail(e);
            } finally {
              document.body.removeChild(textarea);
            }
          }

          var hasAsyncClipboard =
            typeof navigator !== 'undefined' &&
            navigator.clipboard &&
            typeof navigator.clipboard.writeText === 'function' &&
            (typeof window === 'undefined' || window.isSecureContext !== false);

          if (hasAsyncClipboard) {
            navigator.clipboard.writeText(text).then(succeed, function () {
              // Permission denied or a transient failure — try the legacy
              // path before reporting Failure.
              legacyCopy();
            });
          } else {
            legacyCopy();
          }
        }
      }
    }
  });

  Noodl.defineModule({
    nodes: [clipboardNode],
    reactNodes: [],
    setup: function () {}
  });
})();
