import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import Svg, { Circle, Path } from 'react-native-svg'
import * as Clipboard from 'expo-clipboard'
import { useSetRecoilState } from 'recoil'

import Button from 'components/Button'
import QrCodeButton from 'components/QrCodeButton'
import Text from 'components/Text'
import MigrationToolbar from 'components/migration/MigrationToolbar'
import TerraIcon from 'assets/svg/Terra'
import { MIGRATION } from 'consts/migration'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'
import { useWalletNav } from 'navigation/hooks'
import {
  DEFAULT_IMPORT_CHAINS,
  discoverImportWalletChains,
  STATION_DISCOVERY_CHAINS,
  type ImportWalletDiscoveryResult,
} from 'services/importWalletDiscovery'
import { validatePrivateKey } from 'services/privateKeyImport'
import {
  validateSeedPhrase,
  type SeedImportChain,
} from 'services/seedPhraseImport'
import RecoverWalletStore from 'stores/RecoverWalletStore'
import { formatSeedStringToArray } from 'utils/wallet'

type Nav = StackNavigationProp<MigrationStackParams, 'RecoverSeed'>
type ImportTab = 'seed' | 'private-key'
type ScreenState =
  | 'input'
  | 'scanning'
  | 'found'
  | 'none'
  | 'customize'

function ImportIcon({
  color = MIGRATION.textLink,
}: {
  color?: string
}): React.ReactElement {
  return (
    <View style={[styles.iconCircle, { borderColor: `${color}55` }]}>
      <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
        <Path
          d="M15.5 11.8 12 15.3l-3.5-3.5M12 14.8V8"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M3 5h7M3 10h4M3 15h3"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  )
}

function CubeIcon({
  color = MIGRATION.successGreen,
}: {
  color?: string
}): React.ReactElement {
  return (
    <View style={[styles.iconCircle, { borderColor: color }]}>
      <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
        <Path
          d="m11 3.8 5.2 3v5.9l-5.2 3-5.2-3V6.8l5.2-3Z"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <Path
          d="M6 7.2 11 10l5-2.8M11 10v5.4"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <Circle cx={5} cy={4.6} r={1} fill={color} />
        <Circle cx={17} cy={4.6} r={1} fill={color} />
        <Circle cx={4.6} cy={16} r={1} fill={color} />
        <Circle cx={17.4} cy={16} r={1} fill={color} />
      </Svg>
    </View>
  )
}

function ChainMark(): React.ReactElement {
  return (
    <View style={styles.chainIcon}>
      <TerraIcon width={24} height={24} />
    </View>
  )
}

function CopyIcon(): React.ReactElement {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M7 7V4.8C7 3.8 7.8 3 8.8 3h6.4c1 0 1.8.8 1.8 1.8v6.4c0 1-.8 1.8-1.8 1.8H13"
        stroke={MIGRATION.textPrimary}
        strokeWidth={1.5}
      />
      <Path
        d="M3 8.8C3 7.8 3.8 7 4.8 7h6.4c1 0 1.8.8 1.8 1.8v6.4c0 1-.8 1.8-1.8 1.8H4.8c-1 0-1.8-.8-1.8-1.8V8.8Z"
        stroke={MIGRATION.textPrimary}
        strokeWidth={1.5}
      />
    </Svg>
  )
}

function QrIcon(): React.ReactElement {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M3 3h5v5H3V3ZM12 3h5v5h-5V3ZM3 12h5v5H3v-5ZM12 12h2v2h-2v-2ZM15 12h2v2h-2v-2ZM12 15h2v2h-2v-2ZM15 15h2v2h-2v-2Z"
        stroke={MIGRATION.textPrimary}
        strokeWidth={1.3}
      />
    </Svg>
  )
}

function chainLabel(chain: SeedImportChain): string {
  if (chain === 'TerraClassic') return 'Terra Classic'
  if (chain === 'Bitcoin-Cash') return 'Bitcoin Cash'
  if (chain === 'CronosChain') return 'Cronos'
  if (chain === 'MayaChain') return 'MayaChain'
  return chain
}

export default function RecoverSeed(): React.ReactElement {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const { goHome } = useWalletNav()
  const setSeed = useSetRecoilState(RecoverWalletStore.seed)

  const [tab, setTab] = useState<ImportTab>('seed')
  const [screenState, setScreenState] = useState<ScreenState>('input')
  const [seedText, setSeedText] = useState('')
  const [privateKeyText, setPrivateKeyText] = useState('')
  const [activeChains, setActiveChains] = useState<
    ImportWalletDiscoveryResult[]
  >([])
  const [selectedChains, setSelectedChains] = useState<
    SeedImportChain[]
  >(DEFAULT_IMPORT_CHAINS)
  const [scanProgress, setScanProgress] = useState(0)

  const words = useMemo(
    () => (seedText.trim() ? formatSeedStringToArray(seedText) : []),
    [seedText]
  )
  const wordCount = words.length
  const isValidSeed = useMemo(
    () => validateSeedPhrase(seedText),
    [seedText]
  )
  const privateKey = useMemo(() => {
    if (!privateKeyText.trim()) return null
    try {
      return validatePrivateKey(privateKeyText)
    } catch {
      return null
    }
  }, [privateKeyText])
  const showPrivateKeyError =
    privateKeyText.trim().length > 0 && !privateKey

  const handleBack = (): void => {
    if (screenState !== 'input') {
      setScreenState('input')
      return
    }
    if (navigation.canGoBack()) {
      navigation.goBack()
    } else {
      goHome()
    }
  }

  const continueWithSeedChains = (
    chains: SeedImportChain[]
  ): void => {
    setSeed(words)
    navigation.navigate('VaultName', {
      mode: 'recover-seed',
      seedImportChains: chains.length
        ? chains
        : DEFAULT_IMPORT_CHAINS,
    })
  }

  const scanSeed = async (): Promise<void> => {
    if (!isValidSeed) return

    Keyboard.dismiss()
    setScreenState('scanning')
    setScanProgress(0)
    const results = await discoverImportWalletChains(
      seedText,
      setScanProgress
    )
    const discoveredChains = results.map((result) => result.chain)

    setActiveChains(results)
    setSelectedChains(
      discoveredChains.length
        ? discoveredChains
        : DEFAULT_IMPORT_CHAINS
    )
    setScreenState(results.length ? 'found' : 'none')
  }

  const continuePrivateKey = (): void => {
    if (!privateKey) return
    navigation.navigate('VaultName', {
      mode: 'import-private-key',
      privateKeyHex: privateKey.privateKeyHex,
    })
  }

  const pastePrivateKey = async (): Promise<void> => {
    setPrivateKeyText(await Clipboard.getStringAsync())
  }

  const toggleChain = (chain: SeedImportChain): void => {
    setSelectedChains((current) =>
      current.includes(chain)
        ? current.filter((item) => item !== chain)
        : [...current, chain]
    )
  }

  if (screenState === 'scanning') {
    return (
      <View style={styles.container}>
        <View style={{ paddingTop: insets.top }}>
          <MigrationToolbar onBack={handleBack} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator
            size="large"
            color={MIGRATION.successGreen}
          />
          <Text fontType="brockmann-medium" style={styles.stateTitle}>
            Scanning for chains...
          </Text>
          <Text fontType="brockmann-medium" style={styles.stateText}>
            We&apos;re checking which blockchains have active
            addresses for your seed phrase.{' '}
            <Text style={styles.stateTextHighlight}>
              This process can take up to 2 minutes.
            </Text>
          </Text>
        </View>
        <View
          style={[
            styles.bottomButton,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <Button
            title="Select chains manually"
            theme="secondaryDark"
            titleFontType="brockmann-medium"
            onPress={() => setScreenState('customize')}
            containerStyle={styles.ctaButton}
            testID="import-wallet-select-manually"
          />
          <Text fontType="brockmann" style={styles.progressText}>
            {Math.round(scanProgress * 100)}%
          </Text>
        </View>
      </View>
    )
  }

  if (screenState === 'found') {
    return (
      <View style={styles.container}>
        <View style={{ paddingTop: insets.top }}>
          <MigrationToolbar onBack={handleBack} />
        </View>
        <ScrollView
          contentContainerStyle={styles.resultContent}
          showsVerticalScrollIndicator={false}
        >
          <CubeIcon />
          <Text fontType="brockmann-medium" style={styles.stateTitle}>
            We found {activeChains.length} active{' '}
            {activeChains.length === 1 ? 'chain' : 'chains'}
          </Text>
          <Text fontType="brockmann-medium" style={styles.stateText}>
            Each extra chain increases the time to generate your vault
            and possibility of a timeout.
          </Text>
          <View style={styles.chainList}>
            {activeChains.map((item) => (
              <View key={item.chain} style={styles.chainRow}>
                <ChainMark />
                <Text
                  fontType="brockmann-medium"
                  style={styles.chainText}
                >
                  {chainLabel(item.chain)}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
        <View
          style={[
            styles.bottomButton,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <Button
            title="Get started"
            theme="ctaBlue"
            titleFontType="brockmann-medium"
            onPress={() => continueWithSeedChains(selectedChains)}
            containerStyle={styles.ctaButton}
            testID="import-wallet-get-started"
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => setScreenState('customize')}
            style={styles.textButton}
            testID="import-wallet-customize"
          >
            <Text
              fontType="brockmann-medium"
              style={styles.textButtonText}
            >
              Customize chains
            </Text>
          </Pressable>
        </View>
      </View>
    )
  }

  if (screenState === 'none') {
    return (
      <View style={styles.container}>
        <View style={{ paddingTop: insets.top }}>
          <MigrationToolbar onBack={handleBack} />
        </View>
        <View style={styles.centerContent}>
          <CubeIcon color={MIGRATION.errorRed} />
          <Text fontType="brockmann-medium" style={styles.stateTitle}>
            No active chains found
          </Text>
          <Text fontType="brockmann-medium" style={styles.stateText}>
            We didn&apos;t detect any assets on this seed phrase.
          </Text>
          <Text fontType="brockmann-medium" style={styles.stateText}>
            Each extra chain increases the time to generate your vault
            and possibility of a timeout.
          </Text>
        </View>
        <View
          style={[
            styles.bottomButton,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <Button
            title="Get started"
            theme="ctaBlue"
            titleFontType="brockmann-medium"
            onPress={() =>
              continueWithSeedChains(DEFAULT_IMPORT_CHAINS)
            }
            containerStyle={styles.narrowButton}
            testID="import-wallet-no-active-get-started"
          />
        </View>
      </View>
    )
  }

  if (screenState === 'customize') {
    return (
      <View style={styles.container}>
        <View style={{ paddingTop: insets.top }}>
          <MigrationToolbar onBack={handleBack}>
            <Text fontType="brockmann-medium" style={styles.navTitle}>
              Select chains
            </Text>
            <View style={{ width: 44 }} />
          </MigrationToolbar>
        </View>
        <ScrollView
          contentContainerStyle={styles.customizeContent}
          showsVerticalScrollIndicator={false}
        >
          {STATION_DISCOVERY_CHAINS.map((item) => {
            const selected = selectedChains.includes(item.chain)
            return (
              <Pressable
                key={item.chain}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => toggleChain(item.chain)}
                style={[
                  styles.chainRow,
                  selected && styles.chainRowSelected,
                ]}
              >
                <ChainMark />
                <Text
                  fontType="brockmann-medium"
                  style={styles.chainText}
                >
                  {chainLabel(item.chain)}
                </Text>
                <Text
                  fontType="brockmann-medium"
                  style={styles.checkText}
                >
                  {selected ? '✓' : ''}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
        <View
          style={[
            styles.bottomButton,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <Button
            title="Continue"
            theme="ctaBlue"
            titleFontType="brockmann-medium"
            disabled={selectedChains.length === 0}
            onPress={() => continueWithSeedChains(selectedChains)}
            containerStyle={styles.ctaButton}
            testID="import-wallet-customize-continue"
          />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={{ paddingTop: insets.top }}>
        <MigrationToolbar onBack={handleBack} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ImportIcon />
        <Text fontType="brockmann-medium" style={styles.title}>
          Import wallet
        </Text>
        <Text fontType="brockmann-medium" style={styles.subtitle}>
          Enter your{' '}
          <Text style={styles.subtitleHighlight}>seed phrase</Text> or{' '}
          <Text style={styles.subtitleHighlight}>private key</Text> to
          migrate your existing wallet into Vultisig.
        </Text>

        <View style={styles.segmented}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setTab('seed')}
            style={[
              styles.segment,
              tab === 'seed' && styles.segmentActive,
            ]}
            testID="import-wallet-tab-seed"
          >
            <Text
              fontType="brockmann-medium"
              style={styles.segmentText}
            >
              Seed phrase
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setTab('private-key')}
            style={[
              styles.segment,
              tab === 'private-key' && styles.segmentActive,
            ]}
            testID="import-wallet-tab-private-key"
          >
            <Text
              fontType="brockmann-medium"
              style={styles.segmentText}
            >
              Private key
            </Text>
          </Pressable>
        </View>

        {tab === 'seed' ? (
          <TextInput
            testID="import-wallet-seed-input"
            style={styles.seedInput}
            value={seedText}
            onChangeText={setSeedText}
            placeholder="Enter the 12 or 24 words of your seedphrase"
            placeholderTextColor={MIGRATION.textInputPlaceholder}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            textAlignVertical="top"
          />
        ) : (
          <>
            <View style={styles.chainSelector}>
              <ChainMark />
              <Text
                fontType="brockmann-medium"
                style={styles.chainText}
              >
                Terra
              </Text>
              <Text
                fontType="brockmann-medium"
                style={styles.selectorHint}
              >
                Terra only
              </Text>
            </View>
            <TextInput
              testID="import-wallet-private-key-input"
              style={[
                styles.privateKeyInput,
                showPrivateKeyError && styles.inputError,
              ]}
              value={privateKeyText}
              onChangeText={setPrivateKeyText}
              placeholder="Paste private key"
              placeholderTextColor={MIGRATION.textInputPlaceholder}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              textAlignVertical="top"
            />
            {showPrivateKeyError ? (
              <Text fontType="brockmann" style={styles.errorText}>
                Enter a valid 64-character hex private key.
              </Text>
            ) : null}
            <View style={styles.utilityRow}>
              <Pressable
                onPress={pastePrivateKey}
                style={[styles.utilitySlot, styles.utilityButton]}
                testID="import-wallet-paste-private-key"
              >
                <CopyIcon />
              </Pressable>
              <View style={styles.utilitySlot}>
                <QrCodeButton
                  onRead={({ data }) => setPrivateKeyText(data)}
                >
                  <View style={styles.utilityButton}>
                    <QrIcon />
                  </View>
                </QrCodeButton>
              </View>
            </View>
          </>
        )}
      </ScrollView>
      <View
        style={[
          styles.bottomButton,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <Button
          title="Import"
          theme="ctaBlue"
          titleFontType="brockmann-medium"
          disabled={tab === 'seed' ? !isValidSeed : !privateKey}
          onPress={tab === 'seed' ? scanSeed : continuePrivateKey}
          containerStyle={styles.ctaButton}
          testID="import-wallet-import"
        />
        {tab === 'seed' && wordCount > 0 && !isValidSeed ? (
          <Text fontType="brockmann" style={styles.errorTextCentered}>
            Seed phrase must be valid and contain 12 or 24 words.
          </Text>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIGRATION.bg,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 78,
    paddingBottom: 24,
  },
  iconCircle: {
    width: 49,
    height: 49,
    borderRadius: 25,
    backgroundColor: '#03132c',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    lineHeight: 26,
    color: MIGRATION.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: MIGRATION.textTertiary,
    textAlign: 'center',
    maxWidth: 310,
    marginBottom: 24,
  },
  subtitleHighlight: {
    color: MIGRATION.textPrimary,
  },
  segmented: {
    width: '100%',
    height: 46,
    borderRadius: 44,
    backgroundColor: MIGRATION.surface1,
    padding: 4,
    flexDirection: 'row',
    marginBottom: 24,
  },
  segment: {
    flex: 1,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: MIGRATION.buttonSecondary,
  },
  segmentText: {
    fontSize: 12,
    lineHeight: 16,
    color: MIGRATION.textPrimary,
  },
  seedInput: {
    width: '100%',
    minHeight: 164,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MIGRATION.strokeInput,
    backgroundColor: MIGRATION.surface1,
    color: MIGRATION.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontFamily: 'Brockmann-Medium',
  },
  privateKeyInput: {
    width: '100%',
    minHeight: 112,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MIGRATION.strokeInput,
    backgroundColor: MIGRATION.surface1,
    color: MIGRATION.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontFamily: 'Brockmann-Medium',
  },
  inputError: {
    borderColor: MIGRATION.errorRed,
  },
  errorText: {
    alignSelf: 'flex-start',
    color: MIGRATION.errorRed,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  errorTextCentered: {
    color: MIGRATION.errorRed,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  chainSelector: {
    width: '100%',
    height: 68,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MIGRATION.strokeInput,
    backgroundColor: MIGRATION.surface1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 12,
    marginBottom: 12,
  },
  selectorHint: {
    marginLeft: 'auto',
    fontSize: 12,
    color: MIGRATION.textTertiary,
  },
  utilityRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 12,
  },
  utilitySlot: {
    flex: 1,
  },
  utilityButton: {
    width: '100%',
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: MIGRATION.strokeInput,
    backgroundColor: MIGRATION.surface1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomButton: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  ctaButton: {
    width: '100%',
    height: MIGRATION.ctaHeight,
  },
  narrowButton: {
    width: 194,
    height: MIGRATION.ctaHeight,
    alignSelf: 'center',
  },
  centerContent: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  stateTitle: {
    fontSize: 22,
    lineHeight: 28,
    color: MIGRATION.textPrimary,
    textAlign: 'center',
  },
  stateText: {
    fontSize: 14,
    lineHeight: 20,
    color: MIGRATION.textTertiary,
    textAlign: 'center',
    maxWidth: 310,
  },
  stateTextHighlight: {
    color: MIGRATION.textPrimary,
  },
  progressText: {
    color: MIGRATION.textTertiary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  resultContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 92,
    paddingBottom: 140,
  },
  chainList: {
    width: '100%',
    gap: 12,
    marginTop: 32,
  },
  chainRow: {
    width: '100%',
    minHeight: 68,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: MIGRATION.strokeInput,
    backgroundColor: MIGRATION.surface1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  chainRowSelected: {
    borderColor: MIGRATION.textLink,
  },
  chainText: {
    color: MIGRATION.textPrimary,
    fontSize: 15,
    lineHeight: 20,
  },
  chainIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  textButton: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  textButtonText: {
    color: MIGRATION.textPrimary,
    fontSize: 14,
  },
  navTitle: {
    color: MIGRATION.textPrimary,
    fontSize: 17,
    lineHeight: 20,
  },
  customizeContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 120,
    gap: 12,
  },
  checkText: {
    marginLeft: 'auto',
    color: MIGRATION.successGreen,
    fontSize: 18,
  },
})
