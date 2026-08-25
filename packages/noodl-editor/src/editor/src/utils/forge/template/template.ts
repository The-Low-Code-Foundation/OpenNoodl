export interface TemplateListFilter {}

export interface TemplateItem {
  iconURL: string;
  title: string;
  desc: string;
  category: string;
  projectURL: string;
}

/**
 * A source of project templates: it can say which templates it offers, and it can
 * materialise one of them into a project directory.
 *
 * ## 🔴 Why `install` is not called `download` (FB-005 T1)
 *
 * It used to be, and the rename is the whole fix. The old comment on it read
 * *"@param destination The destination we will save the ZIP file"*, and
 * `TemplateRegistry` was written against exactly that: download a zip to a path,
 * then unzip it next door. But the only implementation that was ever reached —
 * `EmbeddedTemplateProvider` — writes a `project.json` **into a directory**. Two
 * opposite contracts, both `(url: string, destination: string) => Promise<void>`,
 * so the compiler had nothing to say and the registry unzipped a directory.
 *
 * A type signature is not a contract. The name now carries the half the signature
 * cannot: `destination` is the project directory, and an implementation is done
 * when a project is sitting in it.
 */
export interface ITemplateProvider {
  /**
   * Returns the provider name. Used when reporting which provider refused.
   */
  get name(): string;

  list(options: TemplateListFilter): Promise<ReadonlyArray<TemplateItem>>;

  /**
   * Whether this provider claims `url`. The first provider that claims a URL
   * installs it; no other provider is consulted.
   */
  canInstall(url: string): Promise<boolean>;

  /**
   * Materialise the template at `url` into `destination`.
   *
   * @param url Template URL, e.g. `embedded://hello-world`
   * @param destination The **project directory** the template is written into.
   *   The provider creates it if it does not exist. On return it must hold a
   *   loadable project.
   */
  install(url: string, destination: string): Promise<void>;
}
