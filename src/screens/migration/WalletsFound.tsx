import React, { useMemo } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { RouteProp } from '@react-navigation/native'

import Text from 'components/Text'
import MigrationToolbar from 'components/migration/MigrationToolbar'
import WalletCard from 'components/WalletCard'
import { MIGRATION } from 'consts/migration'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'WalletsFound'>
type Route = RouteProp<MigrationStackParams, 'WalletsFound'>

export default function WalletsFound(): React.ReactElement {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { wallets, results } = route.params

  const migratedNames = useMemo(
    () =>
      new Set(
        (results ?? [])
          .filter((r) => r.success)
          .map((r) => r.wallet.name)
      ),
    [results]
  )

  return (
    <SafeAreaView style={styles.container}>
      <MigrationToolbar
        onBack={() => navigation.goBack()}
        testID="wallets-back"
      />

      <Text fontType="brockmann-medium" style={styles.title}>
        Your wallets
      </Text>
      <Text fontType="brockmann" style={styles.subtitle}>
        Handle each one separately.
      </Text>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {wallets.map((wallet, index) => {
          const migrated =
            migratedNames.has(wallet.name) || wallet.ledger
          return (
            <WalletCard
              key={wallet.name}
              name={wallet.name}
              address={wallet.address}
              terraOnly={false}
              isFastVault={migrated}
              onPress={() => {
                if (migrated) {
                  navigation.navigate('MigrationSuccess', {
                    migratedWalletName: wallet.name,
                    wallets,
                    results,
                  })
                } else {
                  navigation.navigate('VaultEmail', {
                    walletName: wallet.name,
                    wallets,
                    mode: 'migrate',
                  })
                }
              }}
              onExport={() => {}}
              onDelete={() => {}}
              testID={`wallet-card-${index}`}
            />
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIGRATION.bg,
  },
  title: {
    fontSize: 22,
    color: MIGRATION.textPrimary,
    lineHeight: 24,
    marginBottom: 4,
    paddingHorizontal: MIGRATION.screenPadding,
  },
  subtitle: {
    fontSize: 14,
    color: MIGRATION.textTertiary,
    lineHeight: 20,
    paddingHorizontal: MIGRATION.screenPadding,
    marginBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: MIGRATION.screenPadding,
    paddingBottom: 24,
    gap: MIGRATION.cardGap,
  },
})
