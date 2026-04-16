import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useWalletCreated } from 'navigation/hooks'
import { COLORS, MONO_FONT } from 'consts/theme'

interface Props {
  title: string
  wallet: LocalWallet
  navigation: {
    goBack: () => void
    getParent: () =>
      | {
          navigate: (screen: string) => void
          getState: () => { routes?: Array<{ name: string }> }
        }
      | undefined
  }
}

const WalletSuccessScreen = ({
  title,
  wallet,
  navigation,
}: Props): React.ReactElement => {
  const onWalletCreated = useWalletCreated()
  const insets = useSafeAreaInsets()
  const parentState = navigation.getParent()?.getState()
  const isAddMode = parentState?.routes?.some(
    (r: { name: string }) =>
      r.name === 'AddWalletMenu' ||
      r.name === 'AddNewWallet' ||
      r.name === 'AddRecoverWallet'
  )

  const handleDone = async (): Promise<void> => {
    if (isAddMode) {
      await onWalletCreated()
      navigation.getParent()?.navigate('WalletList')
    } else {
      onWalletCreated()
    }
  }

  return (
    <View
      style={[
        styles.container,
        styles.centered,
        {
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
    >
      <View style={styles.successCircle}>
        <Text style={styles.checkmark}>&#10003;</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.walletName}>{wallet.name}</Text>
      <View style={styles.addressBox}>
        <Text style={styles.addressLabel}>Address</Text>
        <Text style={styles.address} selectable>
          {wallet.address}
        </Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={handleDone}>
        <Text style={styles.buttonText}>Done</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 24 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  checkmark: { color: '#fff', fontSize: 36, fontWeight: '700' },
  title: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  walletName: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginBottom: 24,
  },
  addressBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 40,
  },
  addressLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  address: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: MONO_FONT,
  },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 99,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})

export default WalletSuccessScreen
