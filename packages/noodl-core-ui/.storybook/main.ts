import path from 'path';
import type { StorybookConfig } from '@storybook/react-webpack5';

/*
  🔴 NAT-005 (2026-08-19): **Storybook did not boot in this checkout, and had not for some time.**

    SB_CORE-SERVER_0007 (MainFileEvaluationError)
    ReferenceError: require is not defined in ES module scope

  This file reconstructed `__dirname` from `import.meta.url`, which is the ESM idiom. Storybook
  loads it through `esbuild-register`, and a single `import.meta` in the source makes esbuild emit
  an ES module, which Node's CJS loader then refuses. `__dirname` is already defined here — the
  shim was what broke it.

  ⚠️ The cost of it is worth stating: 99 `.stories.tsx` files exist in this package and **none of
  them could be opened**, which is why the launcher's Community tab could go a whole phase as two
  inline style objects without anybody seeing it outside the running app. A story nobody can render
  is a story nobody wrote.
*/

const editorDir = path.join(__dirname, '../../noodl-editor');
const coreLibDir = path.join(__dirname, '../');

const config: StorybookConfig = {
  /*
    ⚠️ NAT-005: the `*.stories.mdx` glob was dropped. Storybook 8 does not parse the MDX1 story
    format those three design-token files are written in, and webpack answered with
    `Module parse failed: Unexpected token`. Removing the glob makes the other 99 stories load;
    it does not port those three, which is a job of its own and is recorded in NAT-005.
  */
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-measure'
  ],
  framework: {
    name: '@storybook/react-webpack5',
    options: {}
  },
  webpackFinal: (config) => {
    const destinationPath = path.resolve(__dirname, '../../noodl-editor');
    /*
      ⚠️ **NAT-005 fixed a latent bug here and it did NOT fix Storybook — both halves stated,
      because the fix looks like it should have.**

      This helper's job is to let the TypeScript rules also compile files under `noodl-editor`.
      When a rule already had an `include` array it pushed onto it, correctly. When a rule had
      **no** `include` — which means *no restriction*, compile everything — the old `else` set it
      to the editor directory **alone**, turning "compile everything" into "compile only the
      editor". That is a real defect and it is fixed below: an absent `include` needs no edit.

      🔴 **It was not the cause of the outage.** With it fixed, all 99 `.stories.tsx` still fail
      with `Module parse failed: Unexpected token (1:12)` at their first `import type`, having
      been through only the csf and export-order loaders — so the framework's TypeScript rule is
      not reaching them for some other reason, and the honest state is *unknown*, not *narrowed*.
      Do not read the paragraph above as a diagnosis of the remaining failure.
    */
    const addExternalPath = (rules: any[]) => {
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const isTypeScriptRule = rule.test && (RegExp(rule.test).test('.tsx') || RegExp(rule.test).test('.ts'));
        if (isTypeScriptRule) {
          if (Array.isArray(rule.include)) rule.include.push(destinationPath);
          else if (rule.include) rule.include = [rule.include, destinationPath];
          // else: no `include` means no restriction — the editor path is already admitted.
        } else if (rule.oneOf) {
          addExternalPath(rule.oneOf);
        }
      }
    };

    if (config.module?.rules) {
      addExternalPath(config.module.rules as any[]);

      /*
        🔴 NAT-005: a bare `ts-loader` rule for `.ts` used to be pushed here. Under Storybook 8 it
        wins over the framework's own babel rule for the same files and hands back untranspiled
        TypeScript, which webpack then fails to parse at the first `import type` — the reported
        error is `Module parse failed: Unexpected token (1:12)`, on a `.stories.tsx`, which reads
        like a broken story rather than a loader that never ran. `@storybook/react-webpack5`
        already compiles `.ts`/`.tsx`, including the editor paths added by `addExternalPath`
        above, so the rule was doing nothing this config still needs.
      */
    }

    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      '@noodl-core-ui': path.join(coreLibDir, 'src'),
      '@noodl-hooks': path.join(editorDir, 'src/editor/src/hooks'),
      '@noodl-utils': path.join(editorDir, 'src/editor/src/utils'),
      '@noodl-models': path.join(editorDir, 'src/editor/src/models'),
      '@noodl-constants': path.join(editorDir, 'src/editor/src/constants'),
      '@noodl-contexts': path.join(editorDir, 'src/editor/src/contexts'),
      '@noodl-types': path.join(editorDir, 'src/editor/src/types'),
      '@noodl-views': path.join(editorDir, 'src/editor/src/views')
    };

    return config;
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript'
  }
};

export default config;
