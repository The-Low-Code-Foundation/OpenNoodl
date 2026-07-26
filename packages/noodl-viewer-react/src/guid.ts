//adapted from http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript

/**
 * A random RFC-4122-*shaped* identifier. Note this is **not** a real UUID: the
 * version and variant nibbles are not set, and the entropy comes from
 * `Math.random`, so it is unsuitable for anything security-bearing. It exists to
 * give nodes, component instances and DOM ids a unique-enough handle within one
 * running viewer.
 */
function guid(): string {
  function s4(): string {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

export default guid;
