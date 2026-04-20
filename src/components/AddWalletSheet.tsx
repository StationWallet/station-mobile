import React, { useEffect, useState } from 'react'
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import Text from 'components/Text'
import { MIGRATION } from 'consts/migration'

const ICON_BLUE = MIGRATION.textLink
const ANIMATION_DURATION_MS = 220
const SCREEN_HEIGHT = Dimensions.get('window').height

function PlusCircleIcon(): React.ReactElement {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Circle
        cx={10}
        cy={10}
        r={8.25}
        stroke={ICON_BLUE}
        strokeWidth={1.5}
      />
      <Path
        d="M10 6.5v7M6.5 10h7"
        stroke={ICON_BLUE}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  )
}

function SeedPhraseIcon(): React.ReactElement {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M3 5h14M3 10h14M3 15h10"
        stroke={ICON_BLUE}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  )
}

function VaultShareIcon(): React.ReactElement {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M4 4h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z"
        stroke={ICON_BLUE}
        strokeWidth={1.5}
      />
      <Path
        d="M10 8v4M8 10h4"
        stroke={ICON_BLUE}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  )
}

type Props = {
  visible: boolean
  onDismiss: () => void
  onCreate: () => void
  onRecover: () => void
  onImport: () => void
}

export default function AddWalletSheet({
  visible,
  onDismiss,
  onCreate,
  onRecover,
  onImport,
}: Props): React.ReactElement {
  const insets = useSafeAreaInsets()
  const [mounted, setMounted] = useState(false)
  const progress = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      setMounted(true)
      progress.value = withTiming(1, {
        duration: ANIMATION_DURATION_MS,
      })
    } else if (mounted) {
      progress.value = withTiming(
        0,
        { duration: ANIMATION_DURATION_MS },
        (finished) => {
          if (finished) {
            runOnJS(setMounted)(false)
          }
        }
      )
    }
  }, [visible, mounted, progress])

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }))

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0, 1],
          [SCREEN_HEIGHT, 0]
        ),
      },
    ],
  }))

  const dismissAnd = (action: () => void) => (): void => {
    onDismiss()
    requestAnimationFrame(action)
  }

  return (
    <Modal
      animationType="none"
      transparent
      visible={mounted}
      onRequestClose={onDismiss}
    >
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[styles.overlay, overlayStyle]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
        />
      </Animated.View>
      <Animated.View
        pointerEvents={visible ? 'box-none' : 'none'}
        style={[styles.sheetContainer, sheetStyle]}
      >
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 24) + 16 },
          ]}
        >
          <View style={styles.grabber} />

          <Text fontType="brockmann-medium" style={styles.title}>
            Add Wallet
          </Text>

          {/* Create new wallet card */}
          <Pressable
            testID="add-wallet-create"
            accessibilityRole="button"
            accessibilityLabel="Create new wallet"
            style={styles.card}
            onPress={dismissAnd(onCreate)}
          >
            <View style={styles.cardTitleRow}>
              <PlusCircleIcon />
              <Text
                fontType="brockmann-medium"
                style={styles.cardTitle}
              >
                Create new wallet
              </Text>
            </View>
            <Text
              fontType="brockmann-medium"
              style={styles.cardSubtitle}
            >
              Start fresh with a brand-new vault.
            </Text>
          </Pressable>

          {/* Recover / convert seedphrase card */}
          <Pressable
            testID="add-wallet-recover"
            accessibilityRole="button"
            accessibilityLabel="Recover wallet from seed phrase"
            style={styles.card}
            onPress={dismissAnd(onRecover)}
          >
            <View style={styles.cardTitleRow}>
              <SeedPhraseIcon />
              <Text
                fontType="brockmann-medium"
                style={styles.cardTitle}
              >
                Recover wallet
              </Text>
            </View>
            <Text
              fontType="brockmann-medium"
              style={styles.cardSubtitle}
            >
              Enter your seed phrase to recover or convert a legacy
              wallet into a vault.
            </Text>
          </Pressable>

          {/* Import vault share card */}
          <Pressable
            testID="add-wallet-import"
            accessibilityRole="button"
            accessibilityLabel="Import vault share"
            style={styles.card}
            onPress={dismissAnd(onImport)}
          >
            <View style={styles.cardTitleRow}>
              <VaultShareIcon />
              <Text
                fontType="brockmann-medium"
                style={styles.cardTitle}
              >
                Import vault share
              </Text>
            </View>
            <Text
              fontType="brockmann-medium"
              style={styles.cardSubtitle}
            >
              Use a vault share to recover your vault.
            </Text>
            <Text
              fontType="brockmann-medium"
              style={styles.cardCaption}
            >
              Supported file types: .bak & .vult
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: MIGRATION.bg,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: MIGRATION.strokeInput,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },
  grabber: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#333333',
    alignSelf: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    color: MIGRATION.textPrimary,
    textAlign: 'center',
    maxWidth: 340,
    alignSelf: 'center',
    marginBottom: 6,
  },
  card: {
    backgroundColor: MIGRATION.surface1,
    borderRadius: 16,
    padding: 24,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: MIGRATION.textPrimary,
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: MIGRATION.textTertiary,
  },
  cardCaption: {
    fontSize: 10,
    lineHeight: 14,
    color: MIGRATION.textTertiary,
    opacity: 0.7,
    marginTop: 8,
  },
})
