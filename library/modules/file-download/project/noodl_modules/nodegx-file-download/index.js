/* NodeGX File Download module — hand-authored (LBR-009 module #2).
   A Download File logic node: saves any string to the user's machine as a real
   file download (Blob + object URL + anchor click, URL revoked afterwards).
   Closes the dead end where To CSV can produce text but nothing can save it.
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
/* ── Download File node ────────────────────────────────────────────────────────
 *
 * A plain (non-visual) logic node created with the SDK shim's `Noodl.defineNode`,
 * following the confetti module's pattern. Send the `Download` signal and the
 * browser saves `Content` as a file named `Filename` with the given MIME type:
 * the node builds a Blob, mints an object URL, clicks a hidden anchor with the
 * `download` attribute, then removes the anchor and revokes the URL.
 *
 * Every input is guarded — an unconnected input arrives as `undefined` and must
 * never throw. Undefined/null Content is a Failure (with a helpful Error);
 * an empty string is a legitimate empty file. Objects/arrays are JSON-encoded.
 */
(function () {
  if (typeof Noodl === 'undefined' || typeof Noodl.defineNode !== 'function') return;

  function coerceContent(content) {
    if (typeof content === 'string') return content;
    if (typeof content === 'object') {
      // An array or object wired in (e.g. straight from a data node) — encode it
      // as JSON rather than downloading "[object Object]".
      try {
        return JSON.stringify(content, null, 2);
      } catch (e) {
        return String(content);
      }
    }
    return String(content);
  }

  function performDownload(node) {
    var content = node.inputs['Content'];
    var filename = node.inputs['Filename'];
    var mimeType = node.inputs['MIME Type'];

    try {
      if (content === undefined || content === null) {
        throw new Error('Content is empty — connect a string (e.g. the CSV output of a To CSV node) to Content before sending Download.');
      }
      if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        throw new Error('Download File needs a browser environment (Blob/URL/document are unavailable here).');
      }

      var text = coerceContent(content);
      var name = typeof filename === 'string' && filename.trim().length > 0 ? filename.trim() : 'download.txt';
      var mime = typeof mimeType === 'string' && mimeType.trim().length > 0 ? mimeType.trim() : 'text/plain';

      var blob = new Blob([text], { type: mime });
      var url = URL.createObjectURL(blob);
      var anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      // Revoke on the next tick — revoking synchronously can cancel the save in
      // some browsers because the click is processed asynchronously.
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1000);

      node.setOutputs({ Error: '' });
      node.sendSignalOnOutput('Done');
    } catch (e) {
      node.setOutputs({ Error: e && e.message ? e.message : String(e) });
      node.sendSignalOnOutput('Failure');
    }
  }

  var downloadFileNode = Noodl.defineNode({
    name: 'nodegx.filedownload',
    displayName: 'Download File',
    category: 'Utilities',
    color: 'green',
    docs: 'https://docs.noodl.net/#/modules/file-download/README.md',
    inputs: {
      Content: {
        type: 'string',
        displayName: 'Content',
        group: 'Download',
        default: ''
      },
      Filename: {
        type: 'string',
        displayName: 'Filename',
        group: 'Download',
        default: 'download.txt'
      },
      'MIME Type': {
        type: 'string',
        displayName: 'MIME Type',
        group: 'Download',
        default: 'text/plain'
      }
    },
    signals: {
      Download: {
        displayName: 'Download',
        group: 'Download',
        signal: function () {
          performDownload(this);
        }
      }
    },
    outputs: {
      Done: 'signal',
      Failure: 'signal',
      Error: {
        type: 'string',
        displayName: 'Error',
        group: 'Download'
      }
    }
  });

  Noodl.defineModule({
    nodes: [downloadFileNode],
    setup: function () {}
  });
})();
