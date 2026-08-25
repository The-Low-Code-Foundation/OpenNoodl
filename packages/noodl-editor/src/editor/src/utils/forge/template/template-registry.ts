import { ITemplateProvider, TemplateItem, TemplateListFilter } from './template';

/**
 * The set of places a new project can come from.
 *
 * @example List templates
 * ```ts
 *  const templates = await templateRegistry.list({});
 * ```
 *
 * @example Create a project from one
 * ```ts
 *  await templateRegistry.install('embedded://hello-world', projectDirectory);
 * ```
 */
export class TemplateRegistry {
  constructor(public readonly providers: ITemplateProvider[]) {}

  public async list(options: TemplateListFilter): Promise<ReadonlyArray<TemplateItem>> {
    let collection: TemplateItem[] = [];

    for (const provider of this.providers) {
      try {
        const response = await provider.list(options);
        if (response.length > 0) {
          collection = [...collection, ...response];
        }
      } catch (error) {
        console.error(`Error when listing templates via '${provider.name}' provider`);
        console.error(error);
      }
    }

    return collection;
  }

  /**
   * Materialise `templateUrl` into `destination`, using the first provider that claims it.
   *
   * 🔴 **A provider that claims a URL and then fails is not retried by the next one.**
   * The version this replaced wrapped the claim *and* the install in one `try/catch`
   * and swallowed both, so a template that failed halfway through fell out of the loop
   * and the caller was told `Cannot find a valid template provider` — a message about
   * the wrong thing entirely, at the one moment somebody needed to know what broke.
   * A failed claim skips the provider; a failed install is the answer.
   */
  public async install(templateUrl: string, destination: string): Promise<void> {
    for (const provider of this.providers) {
      let claims = false;
      try {
        claims = await provider.canInstall(templateUrl);
      } catch (error) {
        console.error(`Provider '${provider.name}' could not say whether it handles '${templateUrl}'`);
        console.error(error);
        continue;
      }

      if (claims) {
        await provider.install(templateUrl, destination);
        return;
      }
    }

    throw new Error(`No template provider handles '${templateUrl}'`);
  }
}
