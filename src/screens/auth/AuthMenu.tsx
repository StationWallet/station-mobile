import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from 'consts/theme'
import authStyles from './authStyles'
import { useWalletNav } from 'navigation/hooks'

const AuthMenu = ({
  navigation,
}: {
  navigation: {
    navigate: (screen: string) => void
    goBack: () => void
    getState: () => { routes?: Array<{ name: string }> }
  }
}): React.ReactElement => {
  const { goToMigration } = useWalletNav()
  const navState = navigation.getState()
  const isAddMode = navState?.routes?.some(
    (r: { name: string }) => r.name === 'AddWalletMenu'
  )

  return (
    <SafeAreaView style={authStyles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
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
            onPress={() =>
              navigation.navigate(
                isAddMode ? 'AddNewWallet' : 'NewWallet'
              )
            }
          >
            <Text style={authStyles.buttonText}>
              Create New Wallet
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              navigation.navigate(
                isAddMode ? 'AddRecoverWallet' : 'RecoverWallet'
              )
            }
          >
            <Text style={styles.secondaryButtonText}>
              Recover Wallet
            </Text>
          </TouchableOpacity>

          {__DEV__ && (
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
                testID="dev-crypto-test"
                style={styles.secondaryButton}
                onPress={() => navigation.navigate('CryptoTest')}
              >
                <Text style={styles.secondaryButtonText}>
                  Crypto Tests (dev)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="dev-full-e2e-test"
                style={styles.secondaryButton}
                onPress={() => navigation.navigate('FullE2ETest')}
              >
                <Text style={styles.secondaryButtonText}>
                  Full E2E Test (dev)
                </Text>
              </TouchableOpacity>
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
              <TouchableOpacity
                testID="dev-seed-premigrated"
                style={styles.secondaryButton}
                onPress={() => navigation.navigate('SeedPreMigrated')}
              >
                <Text style={styles.secondaryButtonText}>
                  Seed Pre-Migrated (dev)
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
      {isAddMode && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
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
    paddingVertical: 40,
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
    backgroundColor: COLORS.surface,
    borderRadius: 99,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    padding: 8,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
})

export default AuthMenu
