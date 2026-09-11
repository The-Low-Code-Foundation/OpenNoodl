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
/**
 * FB-005 T3 — a listing, with the providers that could not answer named.
 *
 * 🔴 **THIS EXISTS BECAUSE A SHORTER LIST AND A BROKEN LIST ARE THE SAME ARRAY.** `list()`
 * catches each provider's failure and carries on, which is the behaviour that makes registering
 * a *network* provider safe — a community outage leaves the embedded templates on the shelf
 * rather than emptying the picker. But it also means the picker cannot tell "the community has
 * nothing" from "the community did not answer", and drawing the second as the first is a screen
 * that quietly lies about how much it is showing.
 *
 * ⚠️ Each item carries the provider that supplied it, because the surface that draws a row is
 * the one that has to say where it came from — and deriving that from the URL's scheme would be
 * a third place that knows what `community://` means.
 */
export type TemplateListing = {
  items: { provider: string; item: TemplateItem }[];
  failures: { provider: string; reason: string }[];
};

export class TemplateRegistry {
  constructor(public readonly providers: ITemplateProvider[]) {}

  /**
   * Every provider's templates, and every provider's failure.
   *
   * ⚠️ A provider is asked even if an earlier one failed: the failures are collected, never
   * thrown, so one unreachable shelf cannot hide a reachable one behind it.
   */
  public async listing(options: TemplateListFilter): Promise<TemplateListing> {
    const listing: TemplateListing = { items: [], failures: [] };

    for (const provider of this.providers) {
      try {
        const response = await provider.list(options);
        for (const item of response) {
          listing.items.push({ provider: provider.name, item });
        }
      } catch (error) {
        console.error(`Error when listing templates via '${provider.name}' provider`);
        console.error(error);
        listing.failures.push({
          provider: provider.name,
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return listing;
  }

  /**
   * The templates, with the failures dropped.
   *
   * ⚠️ Kept as the simple shape for callers that genuinely only want rows. **A surface a user
   * looks at is not one of them** — see `listing`.
   */
  public async list(options: TemplateListFilter): Promise<ReadonlyArray<TemplateItem>> {
    const listing = await this.listing(options);
    return listing.items.map((entry) => entry.item);
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
