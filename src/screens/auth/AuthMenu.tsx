import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COLORS } from 'consts/theme'
import { DevFlags } from '../../config/env'
import authStyles from './authStyles'
import { useWalletNav } from 'navigation/hooks'
import PrimaryBackground from 'components/PrimaryBackground'

const AuthMenu = ({
  navigation,
}: {
  navigation: { navigate: (screen: string) => void }
}): React.ReactElement => {
  const { goToMigration, startCreateVault, startImportVault, startSeedRecoveryInput } =
    useWalletNav()
  const insets = useSafeAreaInsets()

  return (
    <View style={authStyles.container}>
      <PrimaryBackground />
      <ScrollView
        testID="auth-scroll"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 120,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>S</Text>
          </View>
          <Text style={[authStyles.title, { fontSize: 28 }]}>
            Station Wallet
          </Text>
          <Text
            style={[
              authStyles.subtitle,
              { textAlign: 'center', marginBottom: 0 },
            ]}
          >
            Create or recover your Terra wallet
          </Text>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={authStyles.button}
            onPress={startCreateVault}
          >
            <Text style={authStyles.buttonText}>
              Create New Wallet
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={startSeedRecoveryInput}
          >
            <Text style={styles.secondaryButtonText}>
              Recover Wallet
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="auth-import-fast-vault"
            style={styles.secondaryButton}
            onPress={startImportVault}
          >
            <Text style={styles.secondaryButtonText}>
              Import Fast Vault
            </Text>
          </TouchableOpacity>

          {DevFlags.SeedLegacyData && (
            <>
              {goToMigration && (
                <TouchableOpacity
                  testID="dev-create-fast-vault"
                  style={styles.secondaryButton}
                  onPress={goToMigration}
                >
                  <Text style={styles.secondaryButtonText}>
                    Create Fast Vault (dev)
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                testID="dev-seed-legacy"
                style={styles.secondaryButton}
                onPress={() => navigation.navigate('SeedLegacyData')}
              >
                <Text style={styles.secondaryButtonText}>
                  Seed Legacy Data (dev)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="dev-seed-corrupt"
                style={styles.secondaryButton}
                onPress={() => navigation.navigate('SeedCorruptData')}
              >
                <Text style={styles.secondaryButtonText}>
                  Seed Corrupt Data (dev)
                </Text>
              </TouchableOpacity>
            </>
          )}

          {DevFlags.StateReset && (
            <TouchableOpacity
              testID="dev-reset-state"
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('StateReset')}
            >
              <Text style={styles.secondaryButtonText}>
                Reset State (dev)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

AuthMenu.navigationOptions = {
  headerShown: false,
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 120,
    paddingBottom: 40,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  buttons: {
    gap: 14,
  },
  secondaryButton: {
    backgroundColor: '#11284A',
    borderRadius: 99,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
    boxShadow:
      '0 -1px 0.5px 0 #0F1C3E inset, 0 1px 1px 0 rgba(255, 255, 255, 0.10) inset',
  },
  secondaryButtonText: {
    color: '#F0F4FC',
    fontSize: 14,
    fontWeight: '600',
  },
})

export default AuthMenu
