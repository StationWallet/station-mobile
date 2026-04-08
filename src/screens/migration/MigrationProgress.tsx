import React, { useEffect, useState, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import Text from 'components/Text'
import { VULTISIG } from 'consts/vultisig'
import { migrateAllWallets, MigrationWallet, MigrationResult } from 'services/migrateToVault'

import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'MigrationProgress'>

const MIN_DELAY_PER_WALLET = 700

function WalletProgressCard({
  wallet,
  index,
  completed,
}: {
  wallet: MigrationWallet
  index: number
  completed: boolean
}) {
  const glow = useSharedValue(0)
  const checkScale = useSharedValue(0)

  useEffect(() => {
    if (!completed) {
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      )
    } else {
      glow.value = withTiming(0, { duration: 300 })
      checkScale.value = withSpring(1, { damping: 10, stiffness: 200 })
    }
  }, [completed])

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    borderColor: completed
      ? VULTISIG.accent
      : `rgba(51, 204, 187, ${0.15 + glow.value * 0.35})`,
    shadowColor: VULTISIG.accent,
    shadowOpacity: completed ? 0 : glow.value * 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  }))

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }))

  return (
    <Animated.View
      entering={FadeIn.delay(index * 100).duration(400)}
      style={[styles.walletCard, cardAnimatedStyle]}
      testID={`progress-card-${index}`}
    >
      <View style={styles.walletInfo}>
        <Text style={styles.walletName} fontType="medium">
          {wallet.name}
        </Text>
      </View>
      <Animated.View style={[styles.checkContainer, checkAnimatedStyle]}>
        <Text style={styles.checkMark} fontType="bold">{'✓'}</Text>
      </Animated.View>
    </Animated.View>
  )
}

export default function MigrationProgress() {
  const { params } = useRoute<RouteProp<MigrationStackParams, 'MigrationProgress'>>()
  const navigation = useNavigation<Nav>()
  const { wallets } = params

  const [completedIndices, setCompletedIndices] = useState<Set<number>>(new Set())

  const runMigration = useCallback(async () => {
    const allResults: MigrationResult[] = []

    await migrateAllWallets((result) => {
      allResults.push(result)
    })

    // Animate completions with staggered delays
    for (let i = 0; i < allResults.length; i++) {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          setCompletedIndices((prev) => new Set(prev).add(i))
          resolve()
        }, MIN_DELAY_PER_WALLET)
      })
    }

    // Brief pause after last checkmark before navigating
    setTimeout(() => {
      navigation.navigate('MigrationSuccess', { results: allResults })
    }, 600)
  }, [navigation])

  useEffect(() => {
    runMigration()
  }, [runMigration])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
          <Text style={styles.title} fontType="bold">
            Upgrading Wallets
          </Text>
          <Text style={styles.subtitle} fontType="book">
            Preparing your wallets for Vultisig...
          </Text>
        </Animated.View>

        <View style={styles.walletList}>
          {wallets.map((wallet, index) => (
            <WalletProgressCard
              key={wallet.name}
              wallet={wallet}
              index={index}
              completed={completedIndices.has(index)}
            />
          ))}
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VULTISIG.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    color: VULTISIG.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: VULTISIG.textSecondary,
    lineHeight: 22,
  },
  walletList: {
    flex: 1,
  },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: VULTISIG.card,
    borderWidth: 1,
    borderRadius: VULTISIG.radiusLg,
    padding: 16,
    marginBottom: 12,
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: 16,
    color: VULTISIG.textPrimary,
  },
  checkContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: VULTISIG.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontSize: 18,
    color: VULTISIG.bg,
  },
})
