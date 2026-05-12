import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import Svg, {
  Circle,
  Defs,
  G,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg'
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

const PRIVATE_KEY_SCROLL_Y = 380
const IMPORT_ICON_BLUE = '#59bdff'
const IMPORT_ICON_STROKE_WIDTH = 1.65

function ImportIcon({
  color = IMPORT_ICON_BLUE,
}: {
  color?: string
}): React.ReactElement {
  return (
    <View style={[styles.iconCircle, styles.importIconCircle]}>
      <Svg
        width={49}
        height={49}
        viewBox="0 0 49 49"
        style={styles.importIconGlow}
      >
        <Defs>
          <RadialGradient
            id="importIconGlow"
            cx="50%"
            cy="50%"
            r="50%"
          >
            <Stop offset="0%" stopColor={color} stopOpacity={0.26} />
            <Stop offset="58%" stopColor={color} stopOpacity={0.1} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle
          cx={24.5}
          cy={24.5}
          r={23}
          fill="url(#importIconGlow)"
        />
      </Svg>
      <Svg width={25} height={25} viewBox="0 0 20 20" fill="none">
        <Path
          d="M15.5 11.8 12 15.3l-3.5-3.5M12 14.8V8"
          stroke={color}
          strokeWidth={IMPORT_ICON_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M3 5h7M3 10h4M3 15h3"
          stroke={color}
          strokeWidth={IMPORT_ICON_STROKE_WIDTH}
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
          d="M11 3.6 17 7v7l-6 3.4L5 14V7l6-3.4Z"
          fill={color}
          opacity={0.95}
        />
        <Path
          d="M5.6 7.3 11 10.4l5.4-3.1M11 10.4v6.1"
          stroke={MIGRATION.bg}
          strokeWidth={1.35}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={5} cy={4.6} r={1} fill={color} />
        <Circle cx={17} cy={4.6} r={1} fill={color} />
        <Circle cx={4.6} cy={16} r={1} fill={color} />
        <Circle cx={17.4} cy={16} r={1} fill={color} />
      </Svg>
    </View>
  )
}

function chainInitials(chain?: SeedImportChain): string {
  if (typeof chain !== 'string') return ''
  if (chain === 'TerraClassic') return 'TC'
  if (chain === 'THORChain') return 'TH'
  if (chain === 'MayaChain') return 'MY'
  if (chain === 'Dydx') return 'DY'
  return chain.slice(0, 2).toUpperCase()
}

function ChainMark({
  chain = 'Terra',
}: {
  chain?: SeedImportChain
}): React.ReactElement {
  if (chain === 'Terra' || chain === 'TerraClassic') {
    return (
      <View style={styles.chainIcon}>
        <TerraIcon width={24} height={24} />
      </View>
    )
  }

  const mark = renderChainLogo(chain)
  if (mark) return <View style={styles.chainIcon}>{mark}</View>

  return (
    <View style={[styles.chainIcon, styles.genericChainIcon]}>
      <Text
        fontType="brockmann-medium"
        style={styles.genericChainIconText}
      >
        {chainInitials(chain)}
      </Text>
    </View>
  )
}

function renderChainLogo(
  chain?: SeedImportChain
): React.ReactElement | null {
  switch (chain) {
    case 'Ethereum':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path d="M12 2 6 12l6-3 6 3-6-10Z" fill="#8C8C8C" />
          <Path d="M12 9 6 12l6 3 6-3-6-3Z" fill="#3C3C3D" />
          <Path d="M6 13.2 12 22l6-8.8-6 3-6-3Z" fill="#8C8C8C" />
        </Svg>
      )
    case 'Solana':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path d="M6 6h12l-3 3H3l3-3Z" fill="#14F195" />
          <Path d="M3 10.5h12l3 3H6l-3-3Z" fill="#9945FF" />
          <Path d="M6 15h12l-3 3H3l3-3Z" fill="#14F195" />
        </Svg>
      )
    case 'Sui':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path
            d="M12 3c2.7 3.4 6 7.2 6 11.1A6 6 0 0 1 6 14.1C6 10.2 9.3 6.4 12 3Z"
            fill="#6FBCF0"
          />
          <Path
            d="M8.4 14.2c1.8 2.2 4.6 2.5 7.2.5"
            stroke="#FFFFFF"
            strokeWidth={1.5}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      )
    case 'THORChain':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path d="M15 2 5 13h5l-1 9 10-12h-5l1-8Z" fill="#00E6D0" />
        </Svg>
      )
    case 'MayaChain':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={10} fill="#050B1F" />
          <Path
            d="M5 16 8 7l4 6 4-6 3 9h-3l-1-4-3 4-3-4-1 4H5Z"
            fill="#10D4D4"
          />
        </Svg>
      )
    case 'Cosmos':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={3} fill="#FFFFFF" />
          <G stroke="#6F74DD" strokeWidth={1.4} fill="none">
            <Path d="M4 12c2.8-4.8 13.2-4.8 16 0-2.8 4.8-13.2 4.8-16 0Z" />
            <Path d="M8 4c5.5.1 10.7 9.1 8 16-5.5-.1-10.7-9.1-8-16Z" />
            <Path d="M16 4C10.5 4.1 5.3 13.1 8 20c5.5-.1 10.7-9.1 8-16Z" />
          </G>
        </Svg>
      )
    case 'Kujira':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={10} fill="#111827" />
          <Path
            d="M4 13c3-4.8 10.5-6.2 16-3-1.8.1-3 .6-4 1.6 1.7.4 3 1.3 4 2.9-5.6 2.1-11.2 1.8-16-1.5Z"
            fill="#E53935"
          />
        </Svg>
      )
    case 'Dydx':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={10} fill="#6966FF" />
          <Path
            d="M8 17 16 7M7 8l4 4M13 12l4 4"
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      )
    case 'Osmosis':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={10} fill="#2D0B59" />
          <Path
            d="M12 5c3.3 0 6 2.7 6 6 0 4-3.3 7-6 8-2.7-1-6-4-6-8 0-3.3 2.7-6 6-6Z"
            fill="#B14CFF"
          />
          <Circle
            cx={12}
            cy={11}
            r={3}
            fill="#FFFFFF"
            opacity={0.9}
          />
        </Svg>
      )
    case 'Noble':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={10} fill="#E8EAED" />
          <Path
            d="M7 17V7h3l4 5.6V7h3v10h-3l-4-5.6V17H7Z"
            fill="#111827"
          />
        </Svg>
      )
    case 'Akash':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={10} fill="#FF414C" />
          <Path d="M12 5 19 18h-4l-3-6-3 6H5l7-13Z" fill="#FFFFFF" />
        </Svg>
      )
    case 'Ton':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={10} fill="#0098EA" />
          <Path d="M5 8h14l-7 10L5 8Z" fill="#FFFFFF" />
          <Path d="M8 9h8l-4 6-4-6Z" fill="#0098EA" />
        </Svg>
      )
    case 'Tron':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={10} fill="#EB0029" />
          <Path
            d="M6 5 19 8.2 11 19 6 5Zm2.3 2.2 3 8.2 1.3-5.6-4.3-2.6Zm5.5 3.1-1.2 5.2 4-5.6-2.8.4ZM9.6 7.4l4.2 2.4 2.5-.4-6.7-2Z"
            fill="#FFFFFF"
          />
        </Svg>
      )
    default:
      return null
  }
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
  if (chain === 'Dydx') return 'dYdX'
  return chain
}

const DISCOVERY_CHAIN_ORDER = new Map(
  STATION_DISCOVERY_CHAINS.map((config, index) => [
    config.chain,
    index,
  ])
)

function sortDiscoveryResults(
  results: ImportWalletDiscoveryResult[]
): ImportWalletDiscoveryResult[] {
  return [...results].sort(
    (a, b) =>
      (DISCOVERY_CHAIN_ORDER.get(a.chain) ??
        Number.MAX_SAFE_INTEGER) -
      (DISCOVERY_CHAIN_ORDER.get(b.chain) ?? Number.MAX_SAFE_INTEGER)
  )
}

function mergeDiscoveryResult(
  results: ImportWalletDiscoveryResult[],
  result: ImportWalletDiscoveryResult
): ImportWalletDiscoveryResult[] {
  return sortDiscoveryResults([
    ...results.filter((item) => item.chain !== result.chain),
    result,
  ])
}

function discoveryChains(
  results: ImportWalletDiscoveryResult[]
): SeedImportChain[] {
  return results.length
    ? results.map((result) => result.chain)
    : DEFAULT_IMPORT_CHAINS
}

export default function RecoverSeed(): React.ReactElement {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const { goHome } = useWalletNav()
  const setSeed = useSetRecoilState(RecoverWalletStore.seed)
  const inputScrollRef = useRef<ScrollView>(null)
  const scanRunIdRef = useRef(0)
  const scanAbortControllerRef = useRef<AbortController | null>(null)
  const latestScanResultsRef = useRef<ImportWalletDiscoveryResult[]>(
    []
  )

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

  // Cancel any in-flight scan if the screen unmounts (back nav, app sleep, etc.).
  useEffect(() => {
    return (): void => {
      scanAbortControllerRef.current?.abort()
    }
  }, [])

  const handleBack = (): void => {
    if (screenState !== 'input') {
      if (screenState === 'scanning') {
        scanRunIdRef.current += 1
        scanAbortControllerRef.current?.abort()
      }
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

    const scanRunId = scanRunIdRef.current + 1
    scanRunIdRef.current = scanRunId
    // Abort any in-flight scan and start fresh. Without a real
    // AbortSignal threaded into fetchWithTimeout the previous run would
    // keep its RPC calls in flight after the user navigates away — wasted
    // bandwidth and a race against setState-after-unmount.
    scanAbortControllerRef.current?.abort()
    const controller = new AbortController()
    scanAbortControllerRef.current = controller
    latestScanResultsRef.current = []
    Keyboard.dismiss()
    setActiveChains([])
    setSelectedChains(DEFAULT_IMPORT_CHAINS)
    setScreenState('scanning')
    setScanProgress(0)
    const results = await discoverImportWalletChains(
      seedText,
      (progress) => {
        if (scanRunIdRef.current === scanRunId) {
          setScanProgress(progress)
        }
      },
      (result) => {
        if (scanRunIdRef.current !== scanRunId) return
        latestScanResultsRef.current = mergeDiscoveryResult(
          latestScanResultsRef.current,
          result
        )
        setActiveChains(latestScanResultsRef.current)
      },
      controller.signal
    )
    if (scanRunIdRef.current !== scanRunId) return

    const sortedResults = sortDiscoveryResults(results)
    latestScanResultsRef.current = sortedResults
    setActiveChains(sortedResults)
    setSelectedChains(discoveryChains(sortedResults))
    setScreenState(sortedResults.length ? 'found' : 'none')
  }

  const selectChainsManually = (): void => {
    // Capture results detected so far, then abort the scan and reset the
    // results ref so a subsequent rescan doesn't accidentally inherit
    // entries written by a still-in-flight batch from this run.
    const detectedResults = latestScanResultsRef.current
    scanRunIdRef.current += 1
    scanAbortControllerRef.current?.abort()
    latestScanResultsRef.current = []
    setActiveChains(detectedResults)
    setSelectedChains(discoveryChains(detectedResults))
    setScreenState('customize')
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

  const scrollToPrivateKeyInput = (): void => {
    setTimeout(() => {
      inputScrollRef.current?.scrollTo({
        y: PRIVATE_KEY_SCROLL_Y,
        animated: true,
      })
    }, 100)
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
            onPress={selectChainsManually}
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
                <ChainMark chain={item.chain} />
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
                <ChainMark chain={item.chain} />
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top }}>
        <MigrationToolbar onBack={handleBack} />
      </View>
      <ScrollView
        ref={inputScrollRef}
        style={styles.inputScroll}
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
              textAlignVertical="top"
              onFocus={scrollToPrivateKeyInput}
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
    </KeyboardAvoidingView>
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
    paddingTop: 32,
    paddingBottom: 96,
  },
  inputScroll: {
    flex: 1,
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
  importIconCircle: {
    borderColor: '#203456',
    borderWidth: 3,
    backgroundColor: '#03132c',
    shadowColor: IMPORT_ICON_BLUE,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  importIconGlow: {
    ...StyleSheet.absoluteFillObject,
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
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  genericChainIcon: {
    backgroundColor: MIGRATION.buttonSecondary,
  },
  genericChainIconText: {
    color: IMPORT_ICON_BLUE,
    fontSize: 9,
    lineHeight: 12,
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
