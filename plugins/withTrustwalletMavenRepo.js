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
 * The PAT is read from `GITHUB_PACKAGES_TOKEN` at prebuild time (Node side)
 * and baked literally into the generated Groovy. We used to defer the
 * lookup to Gradle via `System.getenv(...)`, but observed 401s on EAS
 * Build even with the env var present in the build environment — Gradle
 * JVM didn't pick it up. Baking at prebuild is robust because Node's
 * `process.env` reliably sees the EAS-injected variable.
 *
 * `android/` is gitignored and Expo prebuild regenerates it on every run,
 * so the baked PAT only lives in the ephemeral build VM — never in git.
 *
 *   - GITHUB_PACKAGES_TOKEN = classic PAT with `read:packages` scope.
 *     Generate one at https://github.com/settings/tokens/new (classic
 *     tokens only — fine-grained tokens are not supported by the
 *     GitHub Packages Maven registry yet). Export it in your shell rc:
 *       export GITHUB_PACKAGES_TOKEN=ghp_xxx...
 *
 * GitHub Packages' Basic Auth requires a non-empty `username`, but the
 * value is not validated against the token — any literal works — so we
 * hardcode `"token"`.
 */
const MARKER =
  '// trustwallet-maven-repo (managed by withTrustwalletMavenRepo)'

function escapeGroovyString(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function buildRepoBlock() {
  const token = process.env.GITHUB_PACKAGES_TOKEN || ''
  if (!token) {
    throw new Error(
      '[withTrustwalletMavenRepo] GITHUB_PACKAGES_TOKEN is not set — ' +
        'Gradle will 401 against maven.pkg.github.com/trustwallet. ' +
        'Export a classic PAT with read:packages scope.'
    )
  }
  const safeToken = escapeGroovyString(token)
  return [
    `    ${MARKER}`,
    '    maven {',
    '      url = uri("https://maven.pkg.github.com/trustwallet/wallet-core")',
    '      credentials {',
    '        username = "token"',
    `        password = "${safeToken}"`,
    '      }',
    '      content { includeGroup("com.trustwallet") }',
    '    }',
  ].join('\n')
}

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
    modConfig.modResults.contents = `${before}${buildRepoBlock()}\n  ${after}`

    return modConfig
  })

module.exports = createRunOncePlugin(
  withTrustwalletMavenRepo,
  'withTrustwalletMavenRepo',
  '1.0.0'
)
