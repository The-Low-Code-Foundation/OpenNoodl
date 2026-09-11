// A kit that throws before it can register anything. AC4: the rest of the app must still export.
(function () {
  var settings = null;
  // Reading a property off null at module scope — the shape a half-finished kit actually fails in.
  Noodl.defineModule({ reactNodes: [{ name: 'qa.thrower.Stamp', getReactComponent: function () {} }] });
  window.setup = settings.missing.deeper;
})();
