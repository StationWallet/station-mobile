/**
 * Exclude `version`, `android.versionCode`, and `ios.buildNumber` from the
 * fingerprint hash so bumping the app version does not invalidate the
 * runtime-version fingerprint.
 *
 * This pairs with `"appVersionSource": "remote"` + `"autoIncrement": true`
 * in eas.json: EAS can safely auto-bump versionCode/buildNumber without
 * causing a "Runtime version calculated on local machine / on EAS" mismatch
 * in expo-updates.
 *
 * See expo/expo#28712 — the `ExpoConfigVersions` skip was added precisely
 * to unblock this workflow.
 */
module.exports = {
  sourceSkips: ['ExpoConfigVersions'],
}
