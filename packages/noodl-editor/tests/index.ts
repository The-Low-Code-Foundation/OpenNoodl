// Setup the platform before anything else is loading
// This is a problem since we are calling the platform when importing
import '@noodl/platform-electron';

// Progress breadcrumbs: the CI runner kills a silent run after 900s, and
// without per-spec logging there is no way to tell WHERE it stalled. One log
// line per spec makes the last-started spec visible in the runner output.
declare const jasmine: TSFixme;
if (typeof jasmine !== 'undefined' && jasmine.getEnv) {
  jasmine.getEnv().addReporter({
    specStarted(result: TSFixme) {
      console.log('[spec-start]', result.fullName);
    }
  });
}

export * from './ai';
export * from './canvas';
export * from './cloud';
export * from './components';
export * from './git';
export * from './import-engine';
export * from './import-flow';
export * from './lessons';
export * from './models';
export * from './nodegraph';
export * from './nodepicker';
export * from './platform';
export * from './project';
export * from './projectmerger';
export * from './projectpatcher';
export * from './services';
export * from './utils';
export * from './schemas';
export * from './io';
export * from './structure';
export * from './validation';
export * from './versioning';
