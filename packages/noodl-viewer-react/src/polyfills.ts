/**
 * Installs the one polyfill the viewer still carries, for iPads and browsers from
 * roughly 2018 or earlier.
 *
 * Note the shim is a partial one: the real `String.prototype.matchAll` returns an
 * iterator of match arrays and throws when handed a non-global RegExp, whereas this
 * returns a plain array and always forces the `g` flag. That is enough for the
 * viewer's own callers and has been in place for years, so it is left as-is.
 */
export default function registerPolyfills(): void {
  if (!String.prototype.matchAll) {
    //old iPads and browsers (~2018 or earlier)
    // eslint-disable-next-line no-extend-native
    String.prototype.matchAll = function matchAll(this: string, pattern: string | RegExp) {
      const regex = new RegExp(pattern, 'g');
      const matches: RegExpMatchArray[] = [];

      const match_result = this.match(regex);

      for (const index in match_result) {
        const item = match_result[index];
        matches[index as unknown as number] = item.match(new RegExp(pattern));
      }
      return matches as unknown as RegExpStringIterator<RegExpExecArray>;
    };
  }
}
