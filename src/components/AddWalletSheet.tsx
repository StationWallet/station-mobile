import React from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'

import Text from 'components/Text'
import { MIGRATION } from 'consts/migration'

const ICON_BLUE = MIGRATION.textLink
const ICON_YELLOW = '#FFB833'

function PlusCircleIcon(): React.ReactElement {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle
        cx={12}
        cy={12}
        r={10}
        stroke={ICON_BLUE}
        strokeWidth={1.5}
      />
      <Path
        d="M12 8V16M8 12H16"
        stroke={ICON_BLUE}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  )
}

function RestoreIcon(): React.ReactElement {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 12C3 7.029 7.029 3 12 3C15.027 3 17.71 4.495 19.355 6.79"
        stroke={ICON_BLUE}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M21 12C21 16.971 16.971 21 12 21C8.973 21 6.29 19.505 4.645 17.21"
        stroke={ICON_BLUE}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M19.5 3V7H15.5"
        stroke={ICON_BLUE}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4.5 21V17H8.5"
        stroke={ICON_BLUE}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function BoltIcon(): React.ReactElement {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2L4 14H11L10 22L19 10H12L13 2Z"
        fill={ICON_YELLOW}
        stroke={ICON_YELLOW}
        strokeWidth={1.5}
        strokeLinejoin="round"
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

  const dismissAnd = (action: () => void) => (): void => {
    onDismiss()
    requestAnimationFrame(action)
  }

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <View style={styles.grabber} />

          <Text fontType="brockmann-medium" style={styles.title}>
            Add Wallet
          </Text>
          <Text fontType="brockmann-medium" style={styles.subtitle}>
            Choose how to add a wallet
          </Text>

          <View style={styles.buttons}>
            <TouchableOpacity
              testID="add-wallet-create"
              accessibilityRole="button"
              accessibilityLabel="Create New Wallet"
              style={styles.button}
              onPress={dismissAnd(onCreate)}
            >
              <PlusCircleIcon />
              <Text fontType="brockmann-medium" style={styles.buttonLabel}>
                Create New Wallet
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="add-wallet-recover"
              accessibilityRole="button"
              accessibilityLabel="Recover Wallet"
              style={styles.button}
              onPress={dismissAnd(onRecover)}
            >
              <RestoreIcon />
              <Text fontType="brockmann-medium" style={styles.buttonLabel}>
                Recover Wallet
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="add-wallet-import"
              accessibilityRole="button"
              accessibilityLabel="Import Fast Vault"
              style={styles.button}
              onPress={dismissAnd(onImport)}
            >
              <BoltIcon />
              <Text fontType="brockmann-medium" style={styles.buttonLabel}>
                Import Fast Vault
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: MIGRATION.bg,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: MIGRATION.strokeInput,
    paddingHorizontal: 16,
    paddingTop: 7,
    alignItems: 'center',
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 9999,
    backgroundColor: '#333333',
    marginBottom: 24,
  },
  title: {
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: -0.3,
    color: MIGRATION.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.12,
    color: MIGRATION.textTertiary,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttons: {
    width: '100%',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    height: MIGRATION.ctaHeight,
    borderRadius: MIGRATION.radiusPill,
    backgroundColor: MIGRATION.buttonSecondary,
    borderWidth: 1,
    borderColor: MIGRATION.borderExtraLight,
  },
  buttonLabel: {
    color: MIGRATION.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
})
