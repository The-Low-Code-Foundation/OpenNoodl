/* NodeGX MapLibre GL module — hand-authored (LBR-007, phase 65: re-author of the
   proprietary mapbox-gl v2 module). MapLibre GL JS is vendored beside this file
   as maplibre-gl.js (v4.7.1, BSD-3-Clause, LICENSE.txt included) and loaded as a
   manifest dependency; its stylesheet ships as maplibre-gl.css. This file holds
   only the Noodl SDK shim and the node definition. */

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

/* ── MapLibre Map node ─────────────────────────────────────────────────────────
 *
 * A map node backed by the vendored MapLibre GL JS build loaded as a manifest
 * dependency (`maplibre-gl.js`, BSD-3-Clause — see LICENSE.txt beside it). The
 * port surface is modeled on the retired Mapbox module's "Mapbox Map" node
 * (style, coordinates/camera, events) so graphs migrate conceptually 1:1, plus
 * a `Markers` array input that replaces the common single-node marker case.
 *
 * Zero configuration: the default style is the free, token-less MapLibre demo
 * style (https://demotiles.maplibre.org/style.json), so the node renders a
 * world map with nothing connected. No access token, no project settings.
 */
(function () {
  if (typeof Noodl === 'undefined' || typeof Noodl.defineReactNode !== 'function') return;

  var DEFAULT_STYLE = 'https://demotiles.maplibre.org/style.json';

  // Every input can arrive undefined (an unconnected input has NO default at
  // render time) — coerce before use, never trust.
  function num(v, fallback) {
    if (typeof v === 'string' && v.trim() !== '') v = parseFloat(v);
    return typeof v === 'number' && isFinite(v) ? v : fallback;
  }

  function centerFrom(props) {
    // Geopoint (an object {longitude, latitude}) wins over the two number
    // inputs when it is provided — same precedence the Mapbox node used.
    var gp = props.geopoint;
    if (gp && typeof gp === 'object' && isFinite(Number(gp.longitude)) && isFinite(Number(gp.latitude))) {
      return [Number(gp.longitude), Number(gp.latitude)];
    }
    return [num(props.longitude, 0), num(props.latitude, 0)];
  }

  function callIfFn(fn, arg) {
    if (typeof fn === 'function') fn(arg);
  }

  function MapLibreMapComponent(props) {
    var containerRef = React.useRef(null);
    var mapState = React.useState(null);
    var map = mapState[0];
    var setMap = mapState[1];
    var markersRef = React.useRef([]);
    // Latest props for event handlers registered once at map creation.
    var propsRef = React.useRef(props);
    propsRef.current = props;

    // Create the map once.
    React.useEffect(function () {
      if (!containerRef.current || typeof maplibregl === 'undefined') return;

      var m = new maplibregl.Map({
        container: containerRef.current,
        style: typeof props.styleUrl === 'string' && props.styleUrl.trim() !== '' ? props.styleUrl : DEFAULT_STYLE,
        center: centerFrom(props),
        zoom: num(props.zoom, 0),
        bearing: num(props.bearing, 0),
        pitch: num(props.pitch, 0),
        interactive: props.interactive !== false
      });

      var emitCamera = function () {
        var p = propsRef.current;
        var c = m.getCenter();
        callIfFn(p.outLongitude, c.lng);
        callIfFn(p.outLatitude, c.lat);
        callIfFn(p.outZoom, m.getZoom());
        callIfFn(p.outBearing, m.getBearing());
        callIfFn(p.outPitch, m.getPitch());
      };

      m.on('load', function () {
        emitCamera();
        callIfFn(propsRef.current.onLoaded);
      });
      m.on('moveend', function () {
        emitCamera();
        callIfFn(propsRef.current.onMoved);
      });
      m.on('click', function (e) {
        var p = propsRef.current;
        if (e && e.lngLat) {
          callIfFn(p.onClickLongitude, e.lngLat.lng);
          callIfFn(p.onClickLatitude, e.lngLat.lat);
        }
        callIfFn(p.onClick);
      });

      callIfFn(props.outMap, m);
      setMap(m);

      // Keep the canvas sized to the node.
      var ro = null;
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(function () {
          try {
            m.resize();
          } catch (err) {
            /* map already removed */
          }
        });
        ro.observe(containerRef.current);
      }

      return function () {
        if (ro) ro.disconnect();
        markersRef.current = [];
        try {
          m.remove();
        } catch (err) {
          /* already gone */
        }
        setMap(null);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Style URL changes.
    React.useEffect(
      function () {
        if (!map) return;
        var url = typeof props.styleUrl === 'string' && props.styleUrl.trim() !== '' ? props.styleUrl : DEFAULT_STYLE;
        try {
          map.setStyle(url);
        } catch (err) {
          /* invalid style URL — keep the previous style */
        }
      },
      [map, props.styleUrl]
    );

    // Camera inputs → jump the camera (connected data drives the map).
    React.useEffect(
      function () {
        if (!map) return;
        map.jumpTo({
          center: centerFrom(props),
          zoom: num(props.zoom, 0),
          bearing: num(props.bearing, 0),
          pitch: num(props.pitch, 0)
        });
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [map, props.geopoint, props.longitude, props.latitude, props.zoom, props.bearing, props.pitch]
    );

    // Markers: an array of { longitude, latitude, color?, tooltip? }.
    React.useEffect(
      function () {
        if (!map) return;

        // Remove the previous generation.
        for (var i = 0; i < markersRef.current.length; i++) {
          try {
            markersRef.current[i].remove();
          } catch (err) {
            /* already removed */
          }
        }
        markersRef.current = [];

        var items = props.markers;
        if (!items || typeof items.length !== 'number') return;

        for (var j = 0; j < items.length; j++) {
          (function (item, index) {
            if (!item || typeof item !== 'object') return;
            var lng = num(item.longitude, undefined);
            var lat = num(item.latitude, undefined);
            if (lng === undefined || lat === undefined) return;

            var opts = {};
            if (typeof item.color === 'string' && item.color.trim() !== '') opts.color = item.color;

            var marker = new maplibregl.Marker(opts).setLngLat([lng, lat]);
            if (item.tooltip !== undefined && item.tooltip !== null && String(item.tooltip).trim() !== '') {
              marker.setPopup(new maplibregl.Popup({ offset: 24 }).setText(String(item.tooltip)));
            }
            marker.addTo(map);

            var el = marker.getElement();
            if (el) {
              el.style.cursor = 'pointer';
              el.addEventListener('click', function () {
                var p = propsRef.current;
                callIfFn(p.onMarkerIndex, index);
                callIfFn(p.onMarkerClicked);
              });
            }
            markersRef.current.push(marker);
          })(items[j], j);
        }
      },
      [map, props.markers]
    );

    var style = Object.assign({ width: '100%', height: '100%', minHeight: '40px' }, props.style);
    return React.createElement('div', { className: props.className, style: style, ref: containerRef });
  }

  var mapNode = Noodl.defineReactNode({
    name: 'nodegx.maplibre.map',
    displayName: 'MapLibre Map',
    category: 'Visual',
    docs: 'https://maplibre.org/maplibre-gl-js/docs/',
    getReactComponent: function () {
      return MapLibreMapComponent;
    },
    inputProps: {
      styleUrl: {
        displayName: 'Style',
        group: 'Map',
        type: 'string',
        default: DEFAULT_STYLE
      },
      interactive: {
        displayName: 'Interactive',
        group: 'Map',
        type: 'boolean',
        default: true
      },
      geopoint: {
        displayName: 'Geopoint',
        group: 'Coordinates',
        type: 'object'
      },
      longitude: {
        displayName: 'Longitude',
        group: 'Coordinates',
        type: 'number',
        default: 0
      },
      latitude: {
        displayName: 'Latitude',
        group: 'Coordinates',
        type: 'number',
        default: 0
      },
      zoom: {
        displayName: 'Zoom',
        group: 'Coordinates',
        type: 'number',
        default: 0
      },
      bearing: {
        displayName: 'Bearing',
        group: 'Coordinates',
        type: 'number',
        default: 0
      },
      pitch: {
        displayName: 'Pitch',
        group: 'Coordinates',
        type: 'number',
        default: 0
      },
      markers: {
        displayName: 'Markers',
        group: 'Markers',
        type: 'array'
      }
    },
    outputProps: {
      outMap: { displayName: 'Map Object', type: 'object', group: 'MapLibre' },
      outLongitude: { displayName: 'Longitude', editorName: 'Camera Longitude', type: 'number', group: 'Coordinates' },
      outLatitude: { displayName: 'Latitude', editorName: 'Camera Latitude', type: 'number', group: 'Coordinates' },
      outZoom: { displayName: 'Zoom', type: 'number', group: 'Coordinates' },
      outBearing: { displayName: 'Bearing', type: 'number', group: 'Coordinates' },
      outPitch: { displayName: 'Pitch', type: 'number', group: 'Coordinates' },
      onLoaded: { displayName: 'Map Loaded', type: 'signal', group: 'Events' },
      onMoved: { displayName: 'Map Moved', type: 'signal', group: 'Events' },
      onClick: { displayName: 'Click', type: 'signal', group: 'Map Clicked' },
      onClickLongitude: {
        displayName: 'Longitude',
        editorName: 'Clicked Longitude',
        type: 'number',
        group: 'Map Clicked'
      },
      onClickLatitude: {
        displayName: 'Latitude',
        editorName: 'Clicked Latitude',
        type: 'number',
        group: 'Map Clicked'
      },
      onMarkerClicked: { displayName: 'Marker Clicked', type: 'signal', group: 'Markers' },
      onMarkerIndex: { displayName: 'Marker Index', editorName: 'Clicked Marker Index', type: 'number', group: 'Markers' }
    }
  });

  Noodl.defineModule({
    reactNodes: [mapNode],
    nodes: [],
    setup: function () {}
  });
})();
