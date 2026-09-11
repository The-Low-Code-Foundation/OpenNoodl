/* NodeGX Media Recorder module — hand-authored (COM-005, phase 86).
   A single Record Media node: MediaRecorder over getUserMedia, or over a
   MediaStream handed in from elsewhere (Web Camera's `Media Stream` output).
   Emits a ready-to-upload File plus a blob URL the built-in Video node plays.
   No dependencies, no network, no API keys.

   ⚠️ This sits BESIDE library/modules/web-camera rather than extending it, and
   the reasons are measured in
   dev-docs/tasks/phase-86-the-community-already-built-it/COM-005-…md §4b:
   web-camera is a vendored minified 1.0.4 bundle with no source here, it asks
   for video only, its failure path is a console.log with no port on it, and it
   has no unmount teardown. Its job is a live stream to SHOW; this node's job is
   a file to KEEP. Feed its `Media Stream` output into this node's `Media
   Stream` input and the browser is not asked for permission a second time. */

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
/* ── Record Media node ────────────────────────────────────────────────────────
 *
 * Start / Stop / Cancel a MediaRecorder and hand the graph a File it can upload
 * with `Noodl.Files.upload` plus a blob URL the built-in Video node can play.
 *
 * Three things here are deliberate, and each replaces something the community
 * graphs this module was drawn from got wrong (COM-005 §3):
 *
 *  1. **No base64 round trip.** Both community recorders ran the finished Blob
 *     through `FileReader.readAsDataURL`, published the data URL on a port, and
 *     then parsed it back into a Blob with `atob` before uploading. That is two
 *     full copies of the recording in memory as a JS string — roughly 1.37× the
 *     byte size each, on the main thread — for a value nothing needed as text.
 *     The Blob goes straight into a `File`.
 *
 *  2. **Track teardown is owned.** `mediaRecorder.stop()` stops the *recorder*,
 *     not the *stream*: neither community graph ever called `track.stop()`, so
 *     the microphone or camera stayed live after "Stop". Here every track this
 *     node opened is stopped on Stop, on Cancel, and on unmount — and tracks it
 *     did NOT open (a stream handed in on the `Media Stream` input) are never
 *     stopped, because that stream belongs to whoever made it.
 *
 *  3. **Failures land on ports.** Permission denied, device busy and no device
 *     each get their own signal as well as the `Error` string, because a graph
 *     cannot branch on a `console.log` — which is all `web-camera` offers.
 *
 * ⚠️ `start(TIMESLICE_MS)` rather than `start()`: a timeslice makes the recorder
 * emit `dataavailable` every second, so a tab that is backgrounded — or killed —
 * mid-recording has already flushed everything up to the last second instead of
 * holding one unwritten buffer. Duration is measured from `Date.now()` for the
 * same reason: a backgrounded tab throttles timers, and a counted interval would
 * under-report a recording that a wall clock gets right.
 */
(function () {
  if (typeof Noodl === 'undefined' || typeof Noodl.defineNode !== 'function') return;

  var TIMESLICE_MS = 1000;

  // Container preference, best first. Everything here is checked against
  // MediaRecorder.isTypeSupported before it is used — Safari supports almost
  // none of the webm line and a hard-coded 'audio/webm' throws there.
  var AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  var VIDEO_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];

  function canProbe() {
    return typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function';
  }

  /* An empty return means "let the browser choose": passing `mimeType: ''` to
     MediaRecorder is not the same as omitting the option, so the caller omits it. */
  function pickMimeType(mode, requested) {
    if (requested) {
      if (!canProbe() || MediaRecorder.isTypeSupported(requested)) return requested;
      return '';
    }
    if (!canProbe()) return '';
    var candidates = mode === 'video' ? VIDEO_TYPES : AUDIO_TYPES;
    for (var i = 0; i < candidates.length; i++) {
      if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
    }
    return '';
  }

  function extensionFor(mime, mode) {
    var base = String(mime || '').split(';')[0];
    if (base.indexOf('webm') !== -1) return 'webm';
    if (base.indexOf('ogg') !== -1) return 'ogg';
    if (base.indexOf('mp4') !== -1) return mode === 'video' ? 'mp4' : 'm4a';
    if (base.indexOf('mpeg') !== -1) return 'mp3';
    return mode === 'video' ? 'webm' : 'webm';
  }

  /* AC3's three named paths, by DOMException name. The aliases are not
     decoration: Chrome still reports 'TrackStartError' for a device another
     application holds, and older Firefox reports 'PermissionDeniedError'. */
  function classify(err) {
    var name = err && err.name ? String(err.name) : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
      return 'PermissionDenied';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
      return 'DeviceBusy';
    }
    if (
      name === 'NotFoundError' ||
      name === 'DevicesNotFoundError' ||
      name === 'OverconstrainedError' ||
      name === 'ConstraintNotSatisfiedError'
    ) {
      return 'NoDevice';
    }
    return 'Failure';
  }

  function messageFor(kind, err) {
    var detail = err && err.message ? String(err.message) : err ? String(err) : '';
    if (kind === 'PermissionDenied') {
      return 'Permission to record was denied' + (detail ? ' — ' + detail : '');
    }
    if (kind === 'DeviceBusy') {
      return 'The recording device is already in use by another application or tab' + (detail ? ' — ' + detail : '');
    }
    if (kind === 'NoDevice') {
      return 'No matching recording device was found' + (detail ? ' — ' + detail : '');
    }
    return detail || 'Recording failed';
  }

  var recordMediaNode = Noodl.defineNode({
    name: 'nodegx.mediarecorder',
    displayName: 'Record Media',
    category: 'Media',
    color: 'green',

    initialize: function () {
      this._recorder = null;
      this._stream = null;
      this._ownsStream = false;
      this._chunks = [];
      this._startedAt = 0;
      this._objectUrl = '';
      this._maxTimer = null;
      this._cancelled = false;
    },

    inputs: {
      mode: {
        displayName: 'Mode',
        group: 'Recording',
        type: {
          name: 'enum',
          enums: [
            { label: 'Audio', value: 'audio' },
            { label: 'Video', value: 'video' }
          ]
        },
        default: 'audio'
      },
      stream: {
        displayName: 'Media Stream',
        group: 'Recording',
        type: 'mediastream'
      },
      mimeType: {
        displayName: 'Mime Type',
        group: 'Recording',
        type: 'string',
        default: ''
      },
      maxDuration: {
        displayName: 'Max Duration',
        group: 'Recording',
        type: 'number',
        default: 0
      },
      fileName: {
        displayName: 'File Name',
        group: 'Recording',
        type: 'string',
        default: ''
      }
    },

    outputs: {
      Started: 'signal',
      Stopped: 'signal',
      Failure: 'signal',
      PermissionDenied: { displayName: 'Permission Denied', group: 'Recording', type: 'signal' },
      DeviceBusy: { displayName: 'Device Busy', group: 'Recording', type: 'signal' },
      NoDevice: { displayName: 'No Device', group: 'Recording', type: 'signal' },
      recording: { displayName: 'Recording', group: 'Recording', type: 'boolean' },
      file: { displayName: 'File', group: 'Recording', type: 'object' },
      url: { displayName: 'Blob URL', group: 'Recording', type: 'string' },
      resolvedMimeType: { displayName: 'Recorded Mime Type', group: 'Recording', type: 'string' },
      duration: { displayName: 'Duration', group: 'Recording', type: 'number' },
      size: { displayName: 'Size', group: 'Recording', type: 'number' },
      Error: { displayName: 'Error', group: 'Recording', type: 'string' }
    },

    signals: {
      Start: {
        displayName: 'Start',
        group: 'Recording',
        signal: function () {
          this.startRecording();
        }
      },
      Stop: {
        displayName: 'Stop',
        group: 'Recording',
        signal: function () {
          this.stopRecording(false);
        }
      },
      Cancel: {
        displayName: 'Cancel',
        group: 'Recording',
        signal: function () {
          this.stopRecording(true);
        }
      }
    },

    methods: {
      /* An unconnected input has no value at runtime, so every read is guarded. */
      _input: function (name, fallback) {
        var v = this.inputs ? this.inputs[name] : undefined;
        return v === undefined || v === null || v === '' ? fallback : v;
      },

      _fail: function (err) {
        var kind = classify(err);
        this.setOutputs({ recording: false, Error: messageFor(kind, err) });
        this._releaseStream();
        // 🔴 ORDER MATTERS, and it was measured rather than reasoned about.
        // `Failure` fires for every failure, named or not, so a graph can carry
        // one catch-all wire without enumerating the three specific cases — but
        // a graph that wires BOTH (which is the obvious thing to do, and what
        // the demo does) sees whichever lands LAST. With the specific signal
        // first, a denied prompt drove the States node to `Failed` and the
        // "Denied" branch was dead on arrival. The general one goes first so the
        // specific one wins.
        this.sendSignalOnOutput('Failure');
        if (kind !== 'Failure') this.sendSignalOnOutput(kind);
      },

      /* Stops only tracks this node opened. A stream arriving on the `Media
         Stream` input belongs to the node that created it — stopping those would
         black out a Web Camera preview the author is still showing. */
      _releaseStream: function () {
        if (this._maxTimer) {
          clearTimeout(this._maxTimer);
          this._maxTimer = null;
        }
        if (this._stream && this._ownsStream) {
          var tracks = typeof this._stream.getTracks === 'function' ? this._stream.getTracks() : [];
          for (var i = 0; i < tracks.length; i++) {
            try {
              tracks[i].stop();
            } catch (e) {
              /* a track already ended throws on some engines; nothing to undo */
            }
          }
        }
        this._stream = null;
        this._ownsStream = false;
        this._recorder = null;
      },

      _revokeUrl: function () {
        if (this._objectUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
          try {
            URL.revokeObjectURL(this._objectUrl);
          } catch (e) {
            /* already revoked */
          }
        }
        this._objectUrl = '';
      },

      startRecording: function () {
        var node = this;

        if (this._recorder && this._recorder.state === 'recording') return;

        if (typeof MediaRecorder === 'undefined') {
          this.setOutputs({ recording: false, Error: 'MediaRecorder is not available in this browser' });
          this.sendSignalOnOutput('Failure');
          return;
        }

        var mode = this._input('mode', 'audio') === 'video' ? 'video' : 'audio';
        var supplied = this.inputs ? this.inputs.stream : undefined;
        var hasSupplied = !!(supplied && typeof supplied.getTracks === 'function');

        // The previous take's URL is dropped here rather than on Stop: the graph
        // is still showing it right up to the moment a new recording begins.
        this._revokeUrl();
        this._cancelled = false;
        this._chunks = [];
        this.setOutputs({ url: '', file: null, size: 0, duration: 0, Error: '' });

        function begin(stream, owns) {
          node._stream = stream;
          node._ownsStream = owns;

          var mime = pickMimeType(mode, node._input('mimeType', ''));
          var recorder;
          try {
            recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
          } catch (err) {
            node._fail(err);
            return;
          }
          node._recorder = recorder;

          recorder.ondataavailable = function (event) {
            if (event.data && event.data.size > 0) node._chunks.push(event.data);
          };
          recorder.onerror = function (event) {
            node._fail(event && event.error ? event.error : event);
          };
          recorder.onstop = function () {
            node._finish(recorder.mimeType || mime, mode);
          };

          try {
            recorder.start(TIMESLICE_MS);
          } catch (err) {
            node._fail(err);
            return;
          }

          node._startedAt = Date.now();
          node.setOutputs({ recording: true, resolvedMimeType: recorder.mimeType || mime || '' });

          var max = Number(node._input('maxDuration', 0));
          if (max > 0) {
            node._maxTimer = setTimeout(function () {
              node._maxTimer = null;
              node.stopRecording(false);
            }, max * 1000);
          }

          node.sendSignalOnOutput('Started');
        }

        if (hasSupplied) {
          // Already-granted stream: no second permission prompt, and its tracks
          // are not ours to stop.
          begin(supplied, false);
          return;
        }

        if (
          typeof navigator === 'undefined' ||
          !navigator.mediaDevices ||
          typeof navigator.mediaDevices.getUserMedia !== 'function'
        ) {
          this.setOutputs({ recording: false, Error: 'getUserMedia is not available — recording needs https or localhost' });
          this.sendSignalOnOutput('Failure');
          return;
        }

        navigator.mediaDevices.getUserMedia({ audio: true, video: mode === 'video' }).then(
          function (stream) {
            // Cancel can land while the permission prompt is still open. Without
            // this the stream arrives after teardown and stays live forever with
            // nothing holding a reference to stop it.
            if (node._cancelled || node._deleted) {
              var tracks = stream.getTracks();
              for (var i = 0; i < tracks.length; i++) tracks[i].stop();
              return;
            }
            begin(stream, true);
          },
          function (err) {
            node._fail(err);
          }
        );
      },

      stopRecording: function (discard) {
        this._cancelled = !!discard;
        if (this._maxTimer) {
          clearTimeout(this._maxTimer);
          this._maxTimer = null;
        }

        var recorder = this._recorder;
        if (!recorder || recorder.state === 'inactive') {
          // Nothing is running. A Cancel arriving between the Start signal and
          // the permission answer still has to release whatever turns up, which
          // `_cancelled` above handles; a Cancel with a stream already open has
          // to release it here.
          if (discard) {
            this._chunks = [];
            this._releaseStream();
            this.setOutputs({ recording: false });
          }
          return;
        }

        try {
          recorder.stop();
        } catch (err) {
          this._fail(err);
        }
      },

      _finish: function (mime, mode) {
        var seconds = this._startedAt ? (Date.now() - this._startedAt) / 1000 : 0;
        var chunks = this._chunks;
        this._chunks = [];
        this._startedAt = 0;

        // Cancel: the tracks still have to be released, and nothing is published.
        if (this._cancelled) {
          this._cancelled = false;
          this._releaseStream();
          this.setOutputs({ recording: false });
          return;
        }

        this._releaseStream();

        if (!chunks.length) {
          this.setOutputs({ recording: false, Error: 'The recording contained no data' });
          this.sendSignalOnOutput('Failure');
          return;
        }

        var type = mime || (mode === 'video' ? 'video/webm' : 'audio/webm');
        var blob = new Blob(chunks, { type: type });
        var name = this._input('fileName', '') || (mode === 'video' ? 'video' : 'audio') + '-' + Date.now() + '.' + extensionFor(type, mode);

        var file;
        try {
          file = new File([blob], name, { type: type });
        } catch (e) {
          // Older Safari has no File constructor; a named Blob uploads the same.
          file = blob;
          file.name = name;
        }

        var url = '';
        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          url = URL.createObjectURL(blob);
        }
        this._objectUrl = url;

        this.setOutputs({
          recording: false,
          file: file,
          url: url,
          size: blob.size,
          duration: Math.round(seconds * 10) / 10,
          resolvedMimeType: type,
          Error: ''
        });
        this.sendSignalOnOutput('Stopped');
      },

      /* ⚠️ Declared as `_onNodeDeleted`, NOT as the SDK's `onNodeDeleted`.
         The shim installs the latter as
           `e.methods._onNodeDeleted = function(){ …; e.methods.onNodeDeleted.value.call(this) }`
         while `prototypeExtensions` stores the method as a BARE FUNCTION — and
         `nodedefinition.ts` deliberately no longer rewrites that object in place
         (its comment explains why: doing so made `defineNode` non-idempotent).
         So `.value` is undefined and the SDK's own unmount hook throws a
         TypeError at the exact moment it is supposed to free the device.
         Overriding `_onNodeDeleted` directly lands it on the prototype as an
         ordinary method, which is the path every built-in node uses. */
      _onNodeDeleted: function () {
        var base = Object.getPrototypeOf(Object.getPrototypeOf(this));
        if (base && typeof base._onNodeDeleted === 'function') base._onNodeDeleted.call(this);

        this._cancelled = true;
        var recorder = this._recorder;
        if (recorder && recorder.state !== 'inactive') {
          // Drop the handlers first: `onstop` would otherwise run `_finish` and
          // publish outputs on a node that no longer exists.
          recorder.ondataavailable = null;
          recorder.onerror = null;
          recorder.onstop = null;
          try {
            recorder.stop();
          } catch (e) {
            /* already inactive */
          }
        }
        this._chunks = [];
        this._releaseStream();
        this._revokeUrl();
      }
    }
  });

  Noodl.defineModule({
    nodes: [recordMediaNode],
    reactNodes: [],
    setup: function () {}
  });
})();
