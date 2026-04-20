import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import { View, TextInput, StyleSheet, ScrollView } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import QRCode from 'react-native-qrcode-svg'
import {
  RouteProp,
  useRoute,
  useNavigation,
} from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getDecyrptedKey } from 'utils/wallet'
import {
  exportVaultShare,
  shareVaultFile,
} from 'services/exportVaultShare'
import { isVaultFastVault } from 'services/migrateToVault'
import Text from 'components/Text'
import Button from 'components/Button'
import MigrationToolbar from 'components/migration/MigrationToolbar'
import { formStyles } from 'components/migration/migrationStyles'
import { COLORS, MONO_FONT } from 'consts/theme'

import type { MainStackParams } from 'navigation/MainNavigator'

export default function ExportPrivateKey(): React.ReactElement {
  const { params } =
    useRoute<RouteProp<MainStackParams, 'ExportPrivateKey'>>()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const { wallet } = params

  const [password, setPassword] = useState('')
  const [privateKey, setPrivateKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const [exportPassword, setExportPassword] = useState('')
  const [showExportForm, setShowExportForm] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const [isFastVault, setIsFastVault] = useState(false)

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  useEffect(() => {
    isVaultFastVault(wallet.name).then(setIsFastVault)
  }, [wallet.name])

  useEffect(() => {
    return (): void => {
      Clipboard.setStringAsync('')
      setPrivateKey(null)
      setPassword('')
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleReveal = useCallback(async () => {
    setError('')
    try {
      const key = await getDecyrptedKey(wallet.name, password)
      setPrivateKey(key)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('Ledger')) {
        setError('Export is not available for Ledger wallets')
      } else {
        setError('Incorrect password')
      }
    }
  }, [wallet.name, password])

  const handleCopy = useCallback(async () => {
    if (!privateKey) return
    await Clipboard.setStringAsync(privateKey)
    setCopied(true)
    timerRef.current = setTimeout(() => setCopied(false), 2000)
  }, [privateKey])

  const handleExportVaultShare =
    useCallback(async (): Promise<void> => {
      if (exportPassword.length === 0) return
      if (!isFastVault && !privateKey) return
      setExporting(true)
      setExportError('')
      try {
        const fileUri = await exportVaultShare(
          wallet.name,
          exportPassword,
          isFastVault ? undefined : privateKey ?? undefined
        )
        await shareVaultFile(fileUri)
        setShowExportForm(false)
        setExportPassword('')
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        // eslint-disable-next-line no-console -- user-facing export failure needs error logging
        console.error('Vault share export failed:', msg, e)
        setExportError(`Export failed: ${msg}`)
      } finally {
        setExporting(false)
      }
    }, [isFastVault, privateKey, wallet.name, exportPassword])

  // Pick the primary CTA for the current state. The footer only ever
  // shows one primary button at a time, sticky to the bottom of the
  // screen — matches the migration-flow layout (VaultName/Email/etc).
  type Cta = {
    title: string
    onPress: () => void | Promise<void>
    disabled?: boolean
    testID?: string
  }
  let primary: Cta | null = null
  if (!isFastVault && !privateKey) {
    primary = {
      title: 'Reveal Private Key',
      onPress: handleReveal,
      disabled: password.length === 0,
    }
  } else if (!isFastVault && privateKey && !showExportForm) {
    primary = {
      title: copied ? 'Copied!' : 'Copy to Clipboard',
      onPress: handleCopy,
    }
  } else if ((isFastVault || privateKey) && !showExportForm) {
    primary = {
      title: 'Export as Vault Share',
      onPress: (): void => setShowExportForm(true),
    }
  } else if (showExportForm) {
    primary = {
      title: exporting ? 'Exporting...' : 'Export .vult File',
      onPress: handleExportVaultShare,
      disabled: exportPassword.length === 0 || exporting,
    }
  }

  return (
    <View style={styles.container}>
      <View style={{ paddingTop: insets.top }}>
        <MigrationToolbar
          onBack={() => navigation.goBack()}
          testID="export-back"
        />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Export Private Key</Text>
        <Text style={styles.walletName}>{wallet.name}</Text>
        <Text style={styles.address}>{wallet.address}</Text>

        <View style={styles.warningCard}>
          <Text style={styles.warningText}>
            Anyone with this key can access your funds. Never share
            it.
          </Text>
        </View>

        {!isFastVault && !privateKey && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Enter wallet password"
              placeholderTextColor={COLORS.textSecondary}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
            />
            {error !== '' && (
              <Text style={styles.errorText}>{error}</Text>
            )}
          </>
        )}

        {!isFastVault && privateKey && (
          <>
            <View style={styles.qrContainer}>
              <QRCode
                value={privateKey}
                size={200}
                backgroundColor={COLORS.surface}
                color={COLORS.textPrimary}
              />
            </View>
            <View style={styles.keyCard}>
              <Text style={styles.keyText} selectable>
                {privateKey}
              </Text>
            </View>
          </>
        )}

        {showExportForm && (
          <View style={styles.exportForm}>
            <Text style={styles.exportLabel}>
              Set a password to encrypt the vault file:
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Export password"
              placeholderTextColor={COLORS.textSecondary}
              secureTextEntry
              value={exportPassword}
              onChangeText={setExportPassword}
              autoCapitalize="none"
            />
            {exportError !== '' && (
              <Text style={styles.errorText}>{exportError}</Text>
            )}
          </View>
        )}
      </ScrollView>

      <View
        style={[
          formStyles.buttonContainer,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        {primary && (
          <Button
            title={primary.title}
            theme="ctaBlue"
            titleFontType="brockmann-medium"
            onPress={primary.onPress}
            disabled={primary.disabled}
            containerStyle={formStyles.ctaButton}
          />
        )}
        <Button
          title="Done"
          theme="secondaryDark"
          titleFontType="brockmann-medium"
          onPress={async () => {
            await Clipboard.setStringAsync('')
            navigation.goBack()
          }}
          containerStyle={[formStyles.ctaButton, styles.doneButton]}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, alignItems: 'center' },
  title: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '600',
    marginTop: 8,
  },
  walletName: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 8,
  },
  address: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 24,
  },
  warningCard: {
    backgroundColor: '#3D1A1A',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  warningText: {
    color: COLORS.error,
    fontSize: 14,
    textAlign: 'center',
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: 12,
  },
  errorText: { color: COLORS.error, fontSize: 13, marginBottom: 12 },
  qrContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  },
  keyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 16,
  },
  keyText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: MONO_FONT,
    lineHeight: 20,
  },
  doneButton: { marginTop: 8 },
  exportForm: {
    width: '100%',
    marginBottom: 12,
  },
  exportLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 8,
  },
})
