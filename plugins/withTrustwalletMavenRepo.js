const {
  withProjectBuildGradle,
  createRunOncePlugin,
} = require('@expo/config-plugins')

/**
 * Injects the Trust Wallet GitHub Packages Maven repository into
 * android/build.gradle's `allprojects.repositories {}` block so that
 * `@vultisig/walletcore-native`'s transitive `com.trustwallet:wallet-core`
 * dependency resolves from the consuming app's Gradle classpath.
 *
 * Gradle resolves transitive Maven deps against the consuming project's
 * repositories, not the declaring submodule's — so the repo MUST live at
 * the app level even though the dependency originates from a subproject.
 *
 * Credentials are resolved at Gradle-run time in this order (GitHub's
 * documented pattern for the Gradle registry):
 *
 *   1. Project property `gpr.key` — passed on the Gradle command line
 *      via `-Pgpr.key=...` (see `eas.json` → `android.gradleCommand`).
 *      On EAS Build this is populated from the `GITHUB_PACKAGES_TOKEN`
 *      environment variable, which sidesteps a known EAS bug where
 *      build-env vars don't propagate to the Gradle JVM
 *      (expo/eas-cli#1858).
 *   2. Environment variable `GITHUB_PACKAGES_TOKEN` — fallback for local
 *      development where the shell exports the token directly and the
 *      JVM inherits it as expected.
 *
 * For local work you can alternately put the token in
 * `~/.gradle/gradle.properties`:
 *     gpr.key=ghp_xxx...
 *
 *   - GITHUB_PACKAGES_TOKEN = classic PAT with `read:packages` scope.
 *     Generate one at https://github.com/settings/tokens/new (classic
 *     tokens only — fine-grained tokens are not supported by the
 *     GitHub Packages Maven registry yet).
 *
 * GitHub Packages' Basic Auth requires a non-empty `username`, but the
 * value is not validated against the token — any literal works — so we
 * hardcode `"token"`.
 */
const MARKER =
  '// trustwallet-maven-repo (managed by withTrustwalletMavenRepo)'

const REPO_BLOCK = [
  `    ${MARKER}`,
  '    maven {',
  '      url = uri("https://maven.pkg.github.com/trustwallet/wallet-core")',
  '      credentials {',
  '        username = "token"',
  '        password = project.findProperty("gpr.key") ?: System.getenv("GITHUB_PACKAGES_TOKEN") ?: ""',
  '      }',
  '      content { includeGroup("com.trustwallet") }',
  '    }',
].join('\n')

/**
 * Find the matching `}` for the `{` at `openIndex`, handling nested braces
 * and skipping over string literals so we don't get confused by `{` or `}`
 * inside a URL or credential value.
 */
function findMatchingClose(source, openIndex) {
  let depth = 0
  let i = openIndex
  const len = source.length
  while (i < len) {
    const ch = source[i]
    if (ch === '"' || ch === "'") {
      const quote = ch
      i++
      while (i < len && source[i] !== quote) {
        if (source[i] === '\\') i++
        i++
      }
      i++
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return -1
}

const withTrustwalletMavenRepo = (config) =>
  withProjectBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.contents.includes(MARKER)) {
      return modConfig
    }

    const contents = modConfig.modResults.contents
    const allprojectsIdx = contents.indexOf('allprojects')
    if (allprojectsIdx === -1) {
      throw new Error(
        '[withTrustwalletMavenRepo] no allprojects block in android/build.gradle'
      )
    }

    const repositoriesIdx = contents.indexOf(
      'repositories',
      allprojectsIdx
    )
    if (repositoriesIdx === -1) {
      throw new Error(
        '[withTrustwalletMavenRepo] no repositories block inside allprojects'
      )
    }

    const openBraceIdx = contents.indexOf('{', repositoriesIdx)
    if (openBraceIdx === -1) {
      throw new Error(
        '[withTrustwalletMavenRepo] malformed repositories block'
      )
    }

    const closeBraceIdx = findMatchingClose(contents, openBraceIdx)
    if (closeBraceIdx === -1) {
      throw new Error(
        '[withTrustwalletMavenRepo] unterminated repositories block'
      )
    }

    const before = contents.slice(0, closeBraceIdx)
    const after = contents.slice(closeBraceIdx)
    modConfig.modResults.contents = `${before}${REPO_BLOCK}\n  ${after}`

    return modConfig
  })

module.exports = createRunOncePlugin(
  withTrustwalletMavenRepo,
  'withTrustwalletMavenRepo',
  '1.0.0'
)
