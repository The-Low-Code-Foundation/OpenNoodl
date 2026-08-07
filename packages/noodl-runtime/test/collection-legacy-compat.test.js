/**
 * DEBT-008: legacy ES5 modules vs the class-based runtime.
 *
 * Backbone-era Noodl modules (e.g. the corpus project's `se-topp-fovea`)
 * subclass Collection in ES5 style:
 *
 *   Fovea.DBCollection = Noodl.Collection.extend({
 *     constructor: function () { Noodl.Collection.apply(this, arguments); ... }
 *   });
 *
 * A plain `class Collection extends Array` throws on that `.apply`, killing
 * the module's constructor chain and blanking the whole project. The export
 * is now a Proxy whose apply trap makes function-style invocation a no-op
 * (the class constructor contributed nothing anyway), while `new`, statics,
 * `instanceof` and modern subclassing pass through untouched.
 */

/* eslint-env jest */

const Collection = require('../src/collection');
const Model = require('../src/model');

describe('Collection legacy ES5 compatibility', () => {
  it('still constructs real Array-backed collections with new', () => {
    const c = Collection.create([{ id: 1 }, { id: 2 }]);
    expect(Array.isArray(c)).toBe(true);
    expect(c.size()).toBe(2);
    expect(Collection.instanceOf(c)).toBe(true);
  });

  it('can be invoked without new, as Backbone-era module constructors do', () => {
    expect(() => Collection.apply({}, ['some-id'])).not.toThrow();
    expect(() => Collection.call({})).not.toThrow();
  });

  it('supports the full ES5 subclass pattern from the corpus module', () => {
    function DBCollection() {
      Collection.apply(this, arguments); // the line that used to throw
      this.awaitCallbacks = [];
    }
    DBCollection.prototype = Object.create(Collection.prototype);
    DBCollection.prototype.constructor = DBCollection;

    const instance = new DBCollection('legacy-1');
    expect(instance.awaitCallbacks).toEqual([]);
    expect(instance instanceof Collection).toBe(true);

    // Methods resolve through the patched Array.prototype and behave on the
    // ES5 instance (push works generically on array-likes). Items are Models,
    // as they are for real collections.
    const item = Model.get('legacy-compat-item');
    instance.add(item);
    expect(instance.size()).toBe(1);
    expect(instance.get(0)).toBe(item);
  });

  it('modern class subclassing still works through the proxy', () => {
    class Modern extends Collection {}
    const m = new Modern();
    expect(Array.isArray(m)).toBe(true);
    expect(m instanceof Collection).toBe(true);
  });
});
