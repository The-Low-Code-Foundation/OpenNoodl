/* NodeGX Virtual List module — hand-authored (LBR-009 module #5).
   Windowed rendering for large arrays: only the rows that intersect the
   viewport (plus an overscan margin) exist in the DOM, absolutely positioned
   over a full-height spacer. No vendored code, no dependencies, no network. */

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
/* ── Virtual List node ────────────────────────────────────────────────────────
 *
 * A windowed ("virtualised") list. The DOM never holds more than
 * (visible rows + 2 × overscan) row elements, however large the Items array
 * is: a full-height spacer div gives the scrollbar its honest range, and an
 * absolutely-positioned window div carries just the rendered rows, offset to
 * where they belong.
 *
 * Scrolling reads `scrollTop` directly off the element in the scroll event —
 * no smooth-scroll animation, no interpolation. Every input is guarded:
 * an unconnected input arrives as undefined.
 *
 * Per-row rendering is deliberately the simplest honest contract: each row is
 * a single line of text produced from the Row Template input by `{{field}}`
 * substitution (see the entry README). A full component-per-row contract is a
 * follow-up, not something this node pretends to do.
 */
(function () {
  if (typeof Noodl === 'undefined' || typeof Noodl.defineReactNode !== 'function') return;

  var DEFAULT_ITEM_HEIGHT = 40;
  var DEFAULT_OVERSCAN = 6;
  var DEFAULT_LIST_HEIGHT = 400;

  function toNumber(value, fallback) {
    var n = typeof value === 'string' ? parseFloat(value) : value;
    return typeof n === 'number' && isFinite(n) ? n : fallback;
  }

  /** Items may arrive as a plain array, a Noodl Collection, or not at all. */
  function toArray(items) {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    if (Array.isArray(items.items)) return items.items; // Noodl Collection
    if (typeof items.toArray === 'function') {
      try {
        var a = items.toArray();
        return Array.isArray(a) ? a : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  /** Dotted-path lookup that also reaches into a Noodl Object's `.data`. */
  function lookup(item, pathStr) {
    var v = item;
    var parts = pathStr.split('.');
    for (var i = 0; i < parts.length; i++) {
      if (v === null || v === undefined) return undefined;
      var next = v[parts[i]];
      if (next === undefined && v.data && typeof v.data === 'object') next = v.data[parts[i]];
      v = next;
    }
    return v;
  }

  /**
   * `{{field}}` substitution. `{{index}}` is the absolute row index;
   * `{{value}}` is the item itself when the row is a primitive. Output is a
   * plain string handed to React as a text child — never injected as HTML.
   */
  function renderTemplate(template, item, index) {
    if (typeof template !== 'string' || template.length === 0) {
      if (item === null || item === undefined) return '';
      return typeof item === 'object' ? JSON.stringify(item) : String(item);
    }
    return template.replace(/\{\{\s*([\w.$-]+)\s*\}\}/g, function (match, path) {
      if (path === 'index') return String(index);
      if (path === 'value' && (item === null || typeof item !== 'object')) {
        return item === undefined || item === null ? '' : String(item);
      }
      var v = lookup(item, path);
      if (v === null || v === undefined) return '';
      return typeof v === 'object' ? JSON.stringify(v) : String(v);
    });
  }

  class VirtualListComponent extends React.Component {
    constructor(props) {
      super(props);
      this.state = { scrollTop: 0, viewportHeight: 0 };
      this._container = null;
      this._resizeObserver = null;
      this._lastFirst = undefined;
      this._lastCount = undefined;
      this._setContainer = this._setContainer.bind(this);
      this._onScroll = this._onScroll.bind(this);
      this._onResize = this._onResize.bind(this);
    }

    _setContainer(el) {
      this._container = el;
    }

    _onScroll(event) {
      // Read scrollTop directly off the element. No smooth scrolling: with
      // scroll-behavior animation the read lags the gesture and the window
      // is computed for a position the list is not at.
      var scrollTop = event.currentTarget.scrollTop;
      if (scrollTop !== this.state.scrollTop) this.setState({ scrollTop: scrollTop });
    }

    _onResize() {
      if (!this._container) return;
      var h = this._container.clientHeight;
      if (h !== this.state.viewportHeight) this.setState({ viewportHeight: h });
    }

    componentDidMount() {
      this._onResize();
      if (typeof ResizeObserver === 'function' && this._container) {
        this._resizeObserver = new ResizeObserver(this._onResize);
        this._resizeObserver.observe(this._container);
      } else if (typeof window !== 'undefined') {
        window.addEventListener('resize', this._onResize);
      }
      this._pushOutputs();
    }

    componentDidUpdate() {
      this._pushOutputs();
    }

    componentWillUnmount() {
      if (this._resizeObserver) {
        this._resizeObserver.disconnect();
        this._resizeObserver = null;
      } else if (typeof window !== 'undefined') {
        window.removeEventListener('resize', this._onResize);
      }
    }

    /** The window over the items array, derived from raw scrollTop. */
    _window() {
      var props = this.props || {};
      var items = toArray(props.items);
      var itemHeight = toNumber(props.itemHeight, DEFAULT_ITEM_HEIGHT);
      if (!(itemHeight > 0)) itemHeight = DEFAULT_ITEM_HEIGHT;
      var overscan = Math.floor(toNumber(props.overscan, DEFAULT_OVERSCAN));
      if (!(overscan >= 0)) overscan = DEFAULT_OVERSCAN;
      var viewportHeight = this.state.viewportHeight > 0 ? this.state.viewportHeight : 0;
      var scrollTop = this.state.scrollTop > 0 ? this.state.scrollTop : 0;

      var count = items.length;
      var firstVisible = count === 0 ? 0 : Math.min(Math.floor(scrollTop / itemHeight), count - 1);
      var lastVisibleExclusive =
        count === 0
          ? 0
          : Math.min(count, Math.max(firstVisible + 1, Math.ceil((scrollTop + viewportHeight) / itemHeight)));
      var visibleCount = lastVisibleExclusive - firstVisible;

      return {
        items: items,
        itemHeight: itemHeight,
        firstVisible: firstVisible,
        visibleCount: visibleCount,
        renderFirst: Math.max(0, firstVisible - overscan),
        renderLastExclusive: Math.min(count, lastVisibleExclusive + overscan),
        totalHeight: count * itemHeight
      };
    }

    _pushOutputs() {
      var w = this._window();
      if (typeof this.props.firstVisibleIndex === 'function' && w.firstVisible !== this._lastFirst) {
        this._lastFirst = w.firstVisible;
        this.props.firstVisibleIndex(w.firstVisible);
      }
      if (typeof this.props.visibleCount === 'function' && w.visibleCount !== this._lastCount) {
        this._lastCount = w.visibleCount;
        this.props.visibleCount(w.visibleCount);
      }
    }

    render() {
      var props = this.props || {};
      var w = this._window();
      var template = typeof props.template === 'string' ? props.template : '';

      var rows = [];
      for (var i = w.renderFirst; i < w.renderLastExclusive; i++) {
        rows.push(
          React.createElement(
            'div',
            {
              key: i,
              style: {
                height: w.itemHeight + 'px',
                lineHeight: w.itemHeight + 'px',
                padding: '0 12px',
                boxSizing: 'border-box',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                borderBottom: '1px solid var(--border)'
              }
            },
            renderTemplate(template, w.items[i], i)
          )
        );
      }

      var height = props.useContainerSize ? '100%' : toNumber(props.listHeight, DEFAULT_LIST_HEIGHT) + 'px';
      var outerStyle = Object.assign({}, props.style, {
        position: 'relative',
        overflowY: 'auto',
        overflowX: 'hidden',
        width: '100%',
        height: height
      });

      return React.createElement(
        'div',
        { className: props.className, style: outerStyle, ref: this._setContainer, onScroll: this._onScroll },
        React.createElement(
          'div',
          { style: { height: w.totalHeight + 'px', position: 'relative' } },
          React.createElement(
            'div',
            { style: { position: 'absolute', top: w.renderFirst * w.itemHeight + 'px', left: 0, right: 0 } },
            rows
          )
        )
      );
    }
  }

  var virtualListNode = Noodl.defineReactNode({
    name: 'nodegx.virtuallist',
    displayName: 'Virtual List',
    category: 'Visual',
    getReactComponent: function () {
      return VirtualListComponent;
    },
    inputProps: {
      items: {
        displayName: 'Items',
        group: 'Virtual List',
        type: 'array'
      },
      template: {
        displayName: 'Row Template',
        group: 'Virtual List',
        type: { name: 'string' },
        default: '{{value}}'
      },
      itemHeight: {
        displayName: 'Item Height',
        group: 'Virtual List',
        type: { name: 'number' },
        default: 40
      },
      overscan: {
        displayName: 'Overscan',
        group: 'Virtual List',
        type: { name: 'number' },
        default: 6
      },
      useContainerSize: {
        displayName: 'Use Container Size',
        group: 'Layout',
        type: 'boolean',
        default: false
      },
      listHeight: {
        displayName: 'Height',
        group: 'Layout',
        type: { name: 'number' },
        default: 400
      }
    },
    outputProps: {
      firstVisibleIndex: {
        type: 'number',
        displayName: 'First Visible Index',
        group: 'Virtual List'
      },
      visibleCount: {
        type: 'number',
        displayName: 'Visible Count',
        group: 'Virtual List'
      }
    }
  });

  Noodl.defineModule({
    reactNodes: [virtualListNode],
    nodes: [],
    setup: function () {}
  });
})();
