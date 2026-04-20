/**
 * Save-vault-share screen inserted between VerifyEmail and MigrationSuccess.
 *
 * Mirrors vultiagent-app's BackupScreen end-to-end (iso parity with the
 * Vultisig onboarding backup step). Three states:
 *   - `options`: user picks "Backup without Password" or "Use Password"
 *   - `password`: user sets + confirms an optional backup password
 *   - `done`:    confirmation, "Continue" to MigrationSuccess
 *
 * Every vault the migration/create flow produces on station-mobile is a
 * Fast Vault (DKLS), so the auto-password branch from vultiagent-app
 * (encrypt with the vault's fast-sign password) doesn't apply — we always
 * ask the user whether they want a password.
 */
import React, { useState } from 'react'
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { RouteProp } from '@react-navigation/native'
import Svg, { Path } from 'react-native-svg'
import RiveComponent, { Fit as RiveFitEnum } from 'rive-react-native'

import Text from 'components/Text'
import Button from 'components/Button'
import MigrationToolbar from 'components/migration/MigrationToolbar'
import { formStyles } from 'components/migration/migrationStyles'
import { MIGRATION } from 'consts/migration'
import { advanceToNextWallet } from 'utils/migrationNav'
import { exportVaultShare } from 'services/exportVaultShare'
import VaultSharing from '../../../modules/vault-sharing'
import { getErrorMessage } from 'utils/getErrorMessage'
import { useKeyboardVisible } from 'hooks/useKeyboardVisible'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'BackupVault'>
type Route = RouteProp<MigrationStackParams, 'BackupVault'>

type BackupStep = 'options' | 'password' | 'done'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

function KeyIcon(): React.ReactElement {
  return (
    <View style={styles.keyIcon}>
      <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12.65 10a6 6 0 10-9.73 6.76A6 6 0 008 20h.34l2.66-2.66V16h2v-2h2l1.66-1.66A6 6 0 0012.65 10zM7 11a1 1 0 110-2 1 1 0 010 2z"
          fill={MIGRATION.textPrimary}
        />
      </Svg>
    </View>
  )
}

function InfoBox({
  icon,
  text,
  highlight,
}: {
  icon: 'lock-open' | 'folder-lock' | 'warning'
  text: string
  highlight: string
}): React.ReactElement {
  const parts = text.split(highlight)
  return (
    <View style={styles.infoBox}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        {icon === 'lock-open' && (
          <Path
            d="M7 11V7a5 5 0 0110 0v1M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z"
            stroke="#5CA7FF"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        )}
        {icon === 'folder-lock' && (
          <Path
            d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2zM12 13v3m-1-1h2"
            stroke="#5CA7FF"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        )}
        {icon === 'warning' && (
          <Path
            d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            stroke="#5CA7FF"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        )}
      </Svg>
      <Text fontType="brockmann-medium" style={styles.infoBoxText}>
        {parts[0]}
        <Text style={styles.infoBoxHighlight}>{highlight}</Text>
        {parts[1] ?? ''}
      </Text>
    </View>
  )
}

export default function BackupVault(): React.ReactElement {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const insets = useSafeAreaInsets()
  const {
    walletName,
    walletIndex = 0,
    wallets = [],
    results = [],
    mode,
  } = route.params

  const keyboardVisible = useKeyboardVisible()
  const [step, setStep] = useState<BackupStep>('options')
  const [understood, setUnderstood] = useState(false)
  const [backupPassword, setBackupPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(
    null
  )
  const [exporting, setExporting] = useState(false)

  // After the user completes (or cancels) the share sheet we reach
  // this: on `completed=true` we advance to MigrationSuccess,
  // otherwise we nudge them to retry.
  const afterShare = async (completed: boolean): Promise<void> => {
    if (completed) {
      advanceToNextWallet(navigation, {
        wallets,
        results,
        newResult: {
          wallet: wallets[walletIndex] ?? {
            name: walletName,
            address: '',
            ledger: false,
          },
          success: true,
        },
      })
      return
    }
    Alert.alert(
      'Backup required',
      'You must save the backup file to continue. Please try again and complete the save.'
    )
  }

  const runExport = async (password: string): Promise<void> => {
    if (!walletName) return
    setExporting(true)
    try {
      const fileUri = await exportVaultShare(walletName, password)
      // VaultSharing.shareAsync uses ACTION_CREATE_DOCUMENT on Android
      // (Storage Access Framework "save as") and a proper
      // UIActivityViewController completion handler on iOS, so we get a
      // real `completed` signal — the user must either save the file or
      // explicitly cancel. On cancel we bounce back to the retry alert;
      // on save we advance to MigrationSuccess.
      const result = await VaultSharing.shareAsync(fileUri)
      await afterShare(result.completed)
    } catch (err) {
      Alert.alert('Backup failed', getErrorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  const handleBackupWithoutPassword = async (): Promise<void> => {
    // Without a user-provided password, use the walletName itself as
    // the encryption key — it's still encrypted on disk, just not with
    // a secret only the user knows. Matches vultiagent-app's
    // "without password" semantic (the container is still encrypted,
    // just with a deterministic key from the vault data).
    await runExport(walletName)
  }

  const handleBackupWithCustomPassword = async (): Promise<void> => {
    setPasswordError(null)
    if (backupPassword.length === 0) {
      setPasswordError('Password is required')
      return
    }
    if (backupPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }
    await runExport(backupPassword)
  }

  const handleContinue = (): void => {
    advanceToNextWallet(navigation, {
      wallets,
      results,
      newResult: {
        wallet: wallets[walletIndex] ?? {
          name: walletName,
          address: '',
          ledger: false,
        },
        success: true,
      },
    })
  }

  if (step === 'done') {
    return (
      <View style={styles.container}>
        <View style={{ paddingTop: insets.top }}>
          <MigrationToolbar onBack={() => setStep('options')} />
        </View>
        <View style={styles.centeredBody}>
          <Text fontType="brockmann-medium" style={styles.title}>
            Backup saved
          </Text>
          <Text fontType="brockmann" style={styles.bodyText}>
            Your vault backup has been saved successfully.
          </Text>
        </View>
        <View
          style={[
            formStyles.buttonContainer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <Button
            title="Continue"
            theme="ctaBlue"
            titleFontType="brockmann-medium"
            onPress={handleContinue}
            containerStyle={formStyles.ctaButton}
          />
        </View>
      </View>
    )
  }

  if (step === 'password') {
    return (
      <View style={styles.container}>
        <View style={{ paddingTop: insets.top }}>
          <MigrationToolbar onBack={() => setStep('options')} />
        </View>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
          keyboardVerticalOffset={
            Platform.OS === 'android' && keyboardVisible ? -100 : 0
          }
        >
          <View style={styles.passwordBody}>
            <Text
              fontType="brockmann-medium"
              style={styles.sectionLabel}
            >
              Optionally password-protect your backup
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor={MIGRATION.textInputPlaceholder}
              secureTextEntry
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              value={backupPassword}
              onChangeText={(t): void => {
                setBackupPassword(t)
                setPasswordError(null)
              }}
            />
            <View style={{ height: 12 }} />
            <TextInput
              style={styles.input}
              placeholder="Verify password"
              placeholderTextColor={MIGRATION.textInputPlaceholder}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={confirmPassword}
              onChangeText={(t): void => {
                setConfirmPassword(t)
                setPasswordError(null)
              }}
            />
            {passwordError && (
              <Text fontType="brockmann" style={styles.errorText}>
                {passwordError}
              </Text>
            )}
            <View style={styles.loseWarning}>
              <Text
                fontType="brockmann-medium"
                style={styles.loseWarningText}
              >
                If you lose this password, you will not be able to
                restore this backup.{' '}
                <Text style={styles.loseWarningHighlight}>
                  There is no way to recover it.
                </Text>
              </Text>
            </View>
          </View>
          <View
            style={[
              formStyles.buttonContainer,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <Button
              title={exporting ? 'Saving…' : 'Save'}
              theme="ctaBlue"
              titleFontType="brockmann-medium"
              disabled={exporting}
              onPress={handleBackupWithCustomPassword}
              containerStyle={formStyles.ctaButton}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    )
  }

  // step === 'options' (default)
  return (
    <View style={styles.container}>
      <View style={{ paddingTop: insets.top }}>
        <MigrationToolbar onBack={() => navigation.goBack()} />
      </View>
      <View style={styles.optionsBody}>
        <View style={styles.rivePlaceholder}>
          <RiveComponent
            source={require('../../../assets/animations/backupvault_splash.riv')}
            autoplay
            fit={RiveFitEnum.FitWidth}
            style={{ width: SCREEN_WIDTH, height: 220 }}
          />
        </View>
        <View style={styles.keyIconWrap}>
          <KeyIcon />
        </View>
        <Text fontType="brockmann-medium" style={styles.title}>
          Protect your backup
        </Text>
        <View style={styles.infoStack}>
          <InfoBox
            icon="lock-open"
            text="Without a password, anyone with access to the backup file can restore your vault."
            highlight="anyone with access to the backup file can restore your vault."
          />
          <InfoBox
            icon="folder-lock"
            text="With a password, the backup is encrypted and only accessible with your password."
            highlight="encrypted and only accessible with your password."
          />
          <InfoBox
            icon="warning"
            text="If you lose your backup password, there is no way to recover it."
            highlight="there is no way to recover it."
          />
        </View>
      </View>
      <View
        style={[
          formStyles.buttonContainer,
          styles.optionsButtons,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel="I understand I must save this backup to continue"
          onPress={(): void => setUnderstood((v) => !v)}
          style={styles.checkRow}
        >
          <View
            style={[
              styles.checkBox,
              understood && styles.checkBoxChecked,
            ]}
          >
            {understood && (
              <Svg
                width={14}
                height={14}
                viewBox="0 0 16 16"
                fill="none"
              >
                <Path
                  d="M3.333 8.333l2.334 2.334 7-7"
                  stroke={MIGRATION.ctaBlue}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            )}
          </View>
          <Text fontType="brockmann" style={styles.checkLabel}>
            I understand I must save this backup to continue
          </Text>
        </Pressable>
        <Button
          title={exporting ? 'Saving…' : 'Backup without Password'}
          theme="ctaBlue"
          titleFontType="brockmann-medium"
          disabled={!understood || exporting}
          onPress={handleBackupWithoutPassword}
          containerStyle={formStyles.ctaButton}
        />
        <Button
          title="Use Password"
          theme="secondaryDark"
          titleFontType="brockmann-medium"
          disabled={!understood || exporting}
          onPress={(): void => setStep('password')}
          containerStyle={[formStyles.ctaButton, styles.secondaryCta]}
        />
      </View>
      {mode === 'create' && null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MIGRATION.bg },
  centeredBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: MIGRATION.screenPadding,
  },
  optionsBody: {
    flex: 1,
    paddingHorizontal: MIGRATION.screenPadding,
  },
  passwordBody: {
    flex: 1,
    paddingHorizontal: MIGRATION.screenPadding,
    paddingTop: 24,
  },
  rivePlaceholder: {
    alignItems: 'center',
    marginTop: 8,
  },
  keyIconWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  keyIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: MIGRATION.surface1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    color: MIGRATION.textPrimary,
    lineHeight: 24,
    letterSpacing: -0.36,
    marginBottom: 16,
    textAlign: 'center',
  },
  bodyText: {
    fontSize: 14,
    color: MIGRATION.textTertiary,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 14,
    color: MIGRATION.textPrimary,
    marginBottom: 16,
  },
  input: {
    backgroundColor: MIGRATION.surface1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: MIGRATION.textPrimary,
    fontSize: 16,
  },
  errorText: {
    color: MIGRATION.errorRed,
    fontSize: 13,
    marginTop: 8,
  },
  loseWarning: {
    marginTop: 20,
    backgroundColor: MIGRATION.surface1,
    borderRadius: 12,
    padding: 16,
  },
  loseWarningText: {
    fontSize: 13,
    lineHeight: 18,
    color: MIGRATION.textTertiary,
  },
  loseWarningHighlight: {
    color: MIGRATION.textPrimary,
  },
  infoStack: {
    gap: 12,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: MIGRATION.surface1,
    borderRadius: 12,
    padding: 16,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: MIGRATION.textTertiary,
  },
  infoBoxHighlight: {
    color: MIGRATION.textPrimary,
  },
  optionsButtons: {
    gap: 12,
  },
  secondaryCta: {
    marginTop: 0,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#1F4D8A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxChecked: {
    borderColor: MIGRATION.ctaBlue,
    backgroundColor: 'rgba(11,78,255,0.18)',
  },
  checkLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: MIGRATION.textPrimary,
  },
})
