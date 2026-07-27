/**
 * A file stored in the backend, as it appears to a graph.
 *
 * Deliberately just a name and a url: `toString` returns the url, so a Cloud File wired
 * into an Image node's Source — or interpolated into a text — works without the author
 * having to know it is an object at all.
 *
 * @module noodl-runtime
 */
class CloudFile {
  readonly name: string;
  readonly url: string;

  constructor({ name, url }: { name: string; url: string }) {
    this.name = name;
    this.url = url;
  }

  getUrl(): string {
    return this.url;
  }

  getName(): string {
    return this.name;
  }

  toString(): string {
    return this.url;
  }
}

export = CloudFile;
