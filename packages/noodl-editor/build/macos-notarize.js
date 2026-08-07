// electron-builder `afterSign` hook: notarise the signed macOS .app with Apple.
//
// This runs after code-signing and before the .dmg/.zip are assembled. It is a
// deliberate no-op unless it is (a) a macOS build and (b) the required Apple
// credentials are present in the environment. That keeps it safe for:
//   - local ad-hoc / unsigned builds
//   - CI nightly builds (DISABLE_SIGNING=true)
//   - non-macOS platforms
// and only performs the real (slow, network, Apple-side) notarisation on a
// release build that has the credentials.
//
// Credentials (set as CI secrets, never committed):
//   APPLE_ID                     Apple Developer account email
//   APPLE_APP_SPECIFIC_PASSWORD  app-specific password for that account
//   APPLE_TEAM_ID                Developer Team ID
// or, alternatively (App Store Connect API key):
//   APPLE_API_KEY                path to the .p8 key file
//   APPLE_API_KEY_ID             key ID
//   APPLE_API_ISSUER             issuer ID
//
// See dev-docs/guidelines/RELEASE-PROCESS.md for how these are provisioned.

const { notarize } = require('@electron/notarize');

function valueToBoolean(value) {
  return value === true || value === 'true' || value === '1';
}

module.exports = async function notarizeHook(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  if (valueToBoolean(process.env.DISABLE_SIGNING)) {
    console.log('[notarize] DISABLE_SIGNING set — skipping notarisation.');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;
  const appBundleId = context.packager.appInfo.id;

  const hasPassword = process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID;
  const hasApiKey = process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER;

  if (!hasPassword && !hasApiKey) {
    console.log(
      '[notarize] No Apple credentials in the environment — skipping notarisation. ' +
        'The build is signed (or ad-hoc signed) but NOT notarised; Gatekeeper will warn on a clean machine. ' +
        'Set APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID (or APPLE_API_KEY/APPLE_API_KEY_ID/APPLE_API_ISSUER) to notarise.'
    );
    return;
  }

  // Apple will not notarise an app that is not signed with a Developer ID, and
  // the error it returns for one is unhelpful and arrives after a long upload.
  // On CI the *only* source of a Developer ID is CSC_LINK, so "Apple
  // credentials but no certificate" is knowable here, cheaply, and is the exact
  // half-provisioned state a human lands in when the five secrets are added one
  // at a time. Fail with the reason instead of with Apple's.
  //
  // Deliberately CI-only: a local build can legitimately sign from the
  // developer's own keychain, where there is no CSC_LINK to look at.
  if (process.env.CI && !process.env.CSC_LINK) {
    throw new Error(
      '[notarize] Apple notarisation credentials are set, but CSC_LINK is not — there is no Developer ID ' +
        'certificate to sign with, and Apple cannot notarise an unsigned app. Add the CSC_LINK and ' +
        'CSC_KEY_PASSWORD repository secrets (see dev-docs/guidelines/RELEASE-PROCESS.md §1a), or remove ' +
        'APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID to go back to publishing an unsigned draft.'
    );
  }

  console.log(`[notarize] Notarising ${appPath} (${appBundleId}) with Apple — this can take several minutes...`);

  const options = hasApiKey
    ? {
        appBundleId,
        appPath,
        appleApiKey: process.env.APPLE_API_KEY,
        appleApiKeyId: process.env.APPLE_API_KEY_ID,
        appleApiIssuer: process.env.APPLE_API_ISSUER
      }
    : {
        appBundleId,
        appPath,
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID
      };

  await notarize(options);

  console.log('[notarize] Notarisation complete — ticket will be stapled by electron-builder.');
};
