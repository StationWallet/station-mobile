import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native'

const COLORS = {
  bg: '#02122B',
  surface: '#061B3A',
  textPrimary: '#F0F4FC',
  textSecondary: '#8295AE',
  accent: '#0B4EFF',
  border: '#11284A',
}

const MENU_ITEMS: { key: string; label: string; icon: string }[] = [
  { key: 'agent', label: 'Agent', icon: '💬' },
  { key: 'station', label: 'Station Wallet', icon: '👛' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
]

const SCREEN_WIDTH = Dimensions.get('window').width

export default function DrawerPanel({
  onClose,
  onNavigate,
  currentScreen,
}: {
  onClose: () => void
  onNavigate: (screen: string) => void
  currentScreen: string
}) {
  return (
    <View style={styles.overlay}>
      <View style={styles.drawer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>S</Text>
          </View>
          <Text style={styles.vaultName}>Station Wallet</Text>
          <Text style={styles.vaultSub}>Terra Ecosystem</Text>
        </View>

        {/* Menu */}
        <View style={styles.menu}>
          {MENU_ITEMS.map((item) => {
            const active = item.key === currentScreen
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.menuItem, active && styles.menuItemActive]}
                onPress={() => {
                  onNavigate(item.key)
                  onClose()
                }}
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text
                  style={[
                    styles.menuLabel,
                    active && styles.menuLabelActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Station Agent POC</Text>
        </View>
      </View>

      {/* Tap outside to close */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.scrim} />
      </TouchableWithoutFeedback>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 100,
  },
  drawer: {
    width: SCREEN_WIDTH * 0.75,
    backgroundColor: COLORS.bg,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingTop: 60,
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  vaultName: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  vaultSub: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  menu: {
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  menuItemActive: {
    backgroundColor: COLORS.surface,
    borderRightWidth: 3,
    borderRightColor: COLORS.accent,
  },
  menuIcon: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  menuLabel: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  menuLabelActive: {
    color: COLORS.textPrimary,
  },
  footer: {
    marginTop: 'auto',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
})
