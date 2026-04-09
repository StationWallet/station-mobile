import React, { useState } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { RouteProp } from '@react-navigation/native'

import Text from 'components/Text'
import GlassButton from 'components/migration/GlassButton'
import WalletMigrationCard from 'components/migration/WalletMigrationCard'
import { MIGRATION } from 'consts/migration'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'WalletsFound'>
type Route = RouteProp<MigrationStackParams, 'WalletsFound'>

export default function WalletsFound() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { wallets } = route.params

  const [migratedNames, setMigratedNames] = useState<Set<string>>(new Set())

  return (
    <SafeAreaView style={styles.container}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <GlassButton onPress={() => navigation.goBack()} testID="wallets-back">
          <Text style={styles.chevron}>{'\u2039'}</Text>
        </GlassButton>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text fontType="brockmann-medium" style={styles.title}>
          Your wallets
        </Text>
        <Text fontType="brockmann" style={styles.subtitle}>
          Handle each one separately.
        </Text>
      </View>

      {/* Wallet list */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {wallets.map((wallet, index) => (
          <View key={wallet.name} style={styles.cardWrapper}>
            <WalletMigrationCard
              name={wallet.name}
              address={wallet.address}
              migrated={migratedNames.has(wallet.name)}
              onMigrate={() => {
                navigation.navigate('VaultEmail', {
                  walletName: wallet.name,
                  wallets,
                  mode: 'migrate',
                })
              }}
              testID={`wallet-card-${index}`}
            />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIGRATION.bg,
  },
  toolbar: {
    paddingHorizontal: MIGRATION.screenPadding,
    paddingTop: 8,
    paddingBottom: 4,
  },
  header: {
    paddingHorizontal: MIGRATION.screenPadding,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    color: MIGRATION.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: MIGRATION.textTertiary,
  },
  chevron: {
    fontSize: 24,
    color: MIGRATION.textPrimary,
    marginTop: -2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: MIGRATION.screenPadding,
    paddingBottom: 24,
    gap: MIGRATION.cardGap,
  },
  cardWrapper: {},
})
