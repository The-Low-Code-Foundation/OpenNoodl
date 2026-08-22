/* NodeGX Drag To Reorder module — hand-authored (LBR-009 module #6).
   A sortable-list node built directly on pointer events: drag a row with mouse,
   pen or touch, the other rows translate out of the way, a drop indicator marks
   the target slot, and dropping emits the reordered array plus from/to indices.
   No dependencies, no network, no vendored code. */

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
/* ── Drag To Reorder node ─────────────────────────────────────────────────────
 *
 * A vertical sortable list. The node owns its DOM completely: every gesture is
 * handled with pointer events on its own row elements (pointer capture on the
 * pressed row, `touch-action: none` so touch drags are not stolen by page
 * scrolling), so it works the same for mouse, touch and pen without any
 * document-level listeners.
 *
 * Inputs:  Items (array), Label Property, Row Gap, and colour/style tokens.
 * Outputs: Reordered Items (a NEW plain array — the input is never mutated),
 *          From Index, To Index, and a Changed signal fired after the values
 *          above are set.
 *
 * Every input is guarded — an unconnected input has NO default value at the
 * time the component first renders, so nothing here assumes items/gap/label
 * are present or well-typed.
 */
(function () {
  if (typeof Noodl === 'undefined' || typeof Noodl.defineReactNode !== 'function') return;

  /** Noodl array ports can carry a plain array or an array-like Collection
   *  proxy; normalise to a plain array copy and never throw. */
  function toArray(value) {
    if (value === undefined || value === null) return [];
    if (Array.isArray(value)) return Array.prototype.slice.call(value);
    if (typeof value.forEach === 'function') {
      var out = [];
      try {
        value.forEach(function (it) {
          out.push(it);
        });
      } catch (e) {
        return [];
      }
      return out;
    }
    return [];
  }

  /** Display text for one item: `item[labelProperty]`, then a Noodl Model's
   *  `.get(labelProperty)`, then common fallbacks, then JSON. Never throws. */
  function labelFor(item, labelProp) {
    if (item === undefined || item === null) return '';
    if (typeof item !== 'object') return String(item);
    var v;
    try {
      v = item[labelProp];
    } catch (e) {
      v = undefined;
    }
    if ((v === undefined || v === null) && typeof item.get === 'function') {
      try {
        v = item.get(labelProp);
      } catch (e2) {
        v = undefined;
      }
    }
    if (v === undefined || v === null) {
      var fallbacks = ['label', 'title', 'name', 'text'];
      for (var i = 0; i < fallbacks.length && (v === undefined || v === null); i++) {
        try {
          v = item[fallbacks[i]];
        } catch (e3) {
          v = undefined;
        }
      }
    }
    if (v !== undefined && v !== null && typeof v !== 'object') return String(v);
    try {
      return JSON.stringify(item);
    } catch (e4) {
      return String(item);
    }
  }

  function moveItem(arr, from, to) {
    var copy = arr.slice();
    var it = copy.splice(from, 1)[0];
    copy.splice(to, 0, it);
    return copy;
  }

  function DragToReorderComponent(props) {
    props = props || {};
    var inputItems = props.items;
    var gap = typeof props.gap === 'number' && isFinite(props.gap) ? Math.max(0, props.gap) : 8;
    var labelProp =
      typeof props.labelProperty === 'string' && props.labelProperty.length > 0 ? props.labelProperty : 'label';
    var indicatorColor = props.indicatorColor || 'var(--primary)';
    var itemBackground = props.itemBackground || 'var(--surface-raised)';
    var textColor = props.textColor || 'var(--foreground)';
    var borderColor = props.borderColor || 'var(--border)';

    var orderState = React.useState(function () {
      return toArray(inputItems);
    });
    var order = orderState[0];
    var setOrder = orderState[1];

    var dragState = React.useState(null);
    var drag = dragState[0];
    var setDrag = dragState[1];

    var lastInput = React.useRef(inputItems);
    var rowRefs = React.useRef([]);
    var geom = React.useRef(null); // row {top,height} captured at drag start
    var pointer = React.useRef(null); // {id, startY, from} for the active drag
    var orderRef = React.useRef(order);
    var dragRef = React.useRef(drag);
    var emitted = React.useRef(null);

    // Derived state: a new Items input replaces the internal order (and cancels
    // any in-flight drag). Render-phase state update, per the React derived-
    // state pattern.
    if (lastInput.current !== inputItems) {
      lastInput.current = inputItems;
      var fresh = toArray(inputItems);
      order = fresh;
      setOrder(fresh);
      if (drag) {
        drag = null;
        setDrag(null);
        pointer.current = null;
        geom.current = null;
      }
    }
    orderRef.current = order;
    dragRef.current = drag;

    // Seed/refresh the Reordered Items output whenever the order changes, so
    // downstream always has an array even before the first drag. (A drop emits
    // synchronously in endDrag; `emitted` stops this from double-firing.)
    React.useEffect(function () {
      if (emitted.current !== order && typeof props.reorderedItems === 'function') {
        emitted.current = order;
        props.reorderedItems(order.slice());
      }
    });

    function captureGeometry(count) {
      var g = [];
      for (var i = 0; i < count; i++) {
        var el = rowRefs.current[i];
        g.push(el ? { top: el.offsetTop, height: el.offsetHeight } : { top: i * 40, height: 40 });
      }
      return g;
    }

    function endDrag(commit) {
      pointer.current = null;
      var d = dragRef.current;
      geom.current = null;
      setDrag(null);
      if (!commit || !d || d.to === d.from) return;
      var current = orderRef.current || [];
      if (d.from < 0 || d.from >= current.length) return;
      var to = Math.max(0, Math.min(current.length - 1, d.to));
      if (to === d.from) return;
      var next = moveItem(current, d.from, to);
      setOrder(next);
      // Set the value outputs first, then fire Changed, so a graph reacting to
      // Changed reads the fresh values.
      emitted.current = next;
      if (typeof props.reorderedItems === 'function') props.reorderedItems(next.slice());
      if (typeof props.fromIndex === 'function') props.fromIndex(d.from);
      if (typeof props.toIndex === 'function') props.toIndex(to);
      if (typeof props.changed === 'function') props.changed();
    }

    function handleDown(index, e) {
      if (pointer.current) return; // one drag at a time
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var el = rowRefs.current[index];
      if (!el) return;
      geom.current = captureGeometry(orderRef.current.length);
      pointer.current = { id: e.pointerId, startY: e.clientY, from: index };
      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) {
        /* pointer capture is best-effort */
      }
      setDrag({ from: index, to: index, dy: 0 });
      if (e.preventDefault) e.preventDefault();
    }

    function handleMove(e) {
      var p = pointer.current;
      var g = geom.current;
      if (!p || !g || e.pointerId !== p.id) return;
      var row = g[p.from];
      if (!row) return;
      var dy = e.clientY - p.startY;
      var center = row.top + row.height / 2 + dy;
      // Target slot = how many OTHER rows sit above the dragged row's centre.
      var to = 0;
      for (var j = 0; j < g.length; j++) {
        if (j === p.from) continue;
        if (center > g[j].top + g[j].height / 2) to++;
      }
      setDrag({ from: p.from, to: to, dy: dy });
    }

    function handleUp(e) {
      var p = pointer.current;
      if (!p || e.pointerId !== p.id) return;
      endDrag(true);
    }

    function handleCancel(e) {
      var p = pointer.current;
      if (!p || e.pointerId !== p.id) return;
      endDrag(false);
    }

    var n = order.length;
    var g0 = geom.current;
    var dragActive = drag && g0 && g0[drag.from] ? drag : null;
    var shiftAmount = dragActive ? g0[dragActive.from].height + gap : 0;

    // How far row i translates to open the gap for the dragged row.
    function shiftOf(i) {
      if (!dragActive || i === dragActive.from) return 0;
      if (dragActive.to > dragActive.from && i > dragActive.from && i <= dragActive.to) return -shiftAmount;
      if (dragActive.to < dragActive.from && i >= dragActive.to && i < dragActive.from) return shiftAmount;
      return 0;
    }

    var children = [];
    for (var i = 0; i < n; i++) {
      (function (index) {
        var itemStyle = {
          display: 'flex',
          alignItems: 'center',
          padding: '10px 14px',
          marginTop: index === 0 ? 0 : gap + 'px',
          background: itemBackground,
          color: textColor,
          border: '1px solid ' + borderColor,
          borderRadius: '8px',
          boxSizing: 'border-box',
          cursor: dragActive ? 'grabbing' : 'grab',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'none'
        };
        if (dragActive && index === dragActive.from) {
          itemStyle.transform = 'translateY(' + dragActive.dy + 'px)';
          itemStyle.transition = 'none';
          itemStyle.position = 'relative';
          itemStyle.zIndex = 2;
          itemStyle.opacity = 0.92;
          itemStyle.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.25)';
        } else {
          itemStyle.transform = 'translateY(' + shiftOf(index) + 'px)';
          itemStyle.transition = 'transform 130ms ease';
        }
        children.push(
          React.createElement(
            'div',
            {
              key: index,
              role: 'listitem',
              ref: function (el) {
                rowRefs.current[index] = el;
              },
              style: itemStyle,
              onPointerDown: function (e) {
                handleDown(index, e);
              },
              onPointerMove: handleMove,
              onPointerUp: handleUp,
              onPointerCancel: handleCancel
            },
            React.createElement('span', { 'aria-hidden': true, style: { marginRight: '10px', opacity: 0.5 } }, '≡'),
            React.createElement(
              'span',
              {
                style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
              },
              labelFor(order[index], labelProp)
            )
          )
        );
      })(i);
    }

    // Drop indicator: a line at the slot the dragged row will land in, placed
    // using the geometry captured at drag start plus the live translations.
    if (dragActive && dragActive.to !== dragActive.from) {
      var others = [];
      for (var k = 0; k < g0.length; k++) {
        if (k !== dragActive.from) others.push({ top: g0[k].top, height: g0[k].height, orig: k });
      }
      if (others.length > 0) {
        var slot = Math.max(0, Math.min(others.length, dragActive.to));
        var y;
        if (slot > 0) {
          var above = others[slot - 1];
          y = above.top + above.height + shiftOf(above.orig) + gap / 2;
        } else {
          var below = others[0];
          y = below.top + shiftOf(below.orig) - gap / 2;
        }
        children.push(
          React.createElement('div', {
            key: 'drop-indicator',
            style: {
              position: 'absolute',
              left: '2px',
              right: '2px',
              top: y - 1 + 'px',
              height: '2px',
              background: indicatorColor,
              borderRadius: '1px',
              pointerEvents: 'none',
              zIndex: 1
            }
          })
        );
      }
    }

    if (n === 0) {
      children.push(
        React.createElement(
          'div',
          {
            key: 'empty',
            style: {
              padding: '12px 14px',
              color: 'var(--muted-foreground)',
              border: '1px dashed ' + borderColor,
              borderRadius: '8px'
            }
          },
          'No items — connect an array to Items'
        )
      );
    }

    var outerStyle = Object.assign({ position: 'relative', boxSizing: 'border-box' }, props.style);
    if (outerStyle.width === undefined) outerStyle.width = '100%';

    return React.createElement('div', { className: props.className, style: outerStyle, role: 'list' }, children);
  }

  var dragToReorderNode = Noodl.defineReactNode({
    name: 'nodegx.drag-to-reorder',
    displayName: 'Drag To Reorder',
    category: 'Visual',
    getReactComponent: function () {
      return DragToReorderComponent;
    },
    inputProps: {
      items: {
        displayName: 'Items',
        group: 'Data',
        type: 'array'
      },
      labelProperty: {
        displayName: 'Label Property',
        group: 'Data',
        type: { name: 'string' },
        default: 'label'
      },
      gap: {
        displayName: 'Row Gap',
        group: 'Style',
        type: { name: 'number' },
        default: 8
      },
      itemBackground: {
        displayName: 'Item Background',
        group: 'Style',
        type: 'color',
        default: 'var(--surface-raised)'
      },
      textColor: {
        displayName: 'Text Color',
        group: 'Style',
        type: 'color',
        default: 'var(--foreground)'
      },
      borderColor: {
        displayName: 'Border Color',
        group: 'Style',
        type: 'color',
        default: 'var(--border)'
      },
      indicatorColor: {
        displayName: 'Indicator Color',
        group: 'Style',
        type: 'color',
        default: 'var(--primary)'
      }
    },
    outputProps: {
      reorderedItems: {
        displayName: 'Reordered Items',
        group: 'Data',
        type: 'array'
      },
      fromIndex: {
        displayName: 'From Index',
        group: 'Data',
        type: 'number'
      },
      toIndex: {
        displayName: 'To Index',
        group: 'Data',
        type: 'number'
      },
      changed: {
        displayName: 'Changed',
        group: 'Events',
        type: 'signal'
      }
    }
  });

  Noodl.defineModule({
    reactNodes: [dragToReorderNode],
    nodes: [],
    setup: function () {}
  });
})();
