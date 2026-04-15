import React from 'react'
import {
  View,
  StyleSheet,
  Dimensions,
  PixelRatio,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg'

import Text from 'components/Text'
import Button from 'components/Button'
import MigrationToolbar from 'components/migration/MigrationToolbar'
import { MIGRATION } from 'consts/migration'
import { formStyles } from 'components/migration/migrationStyles'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'

let RiveComponent: React.ComponentType<
  Record<string, unknown>
> | null = null
try {
  RiveComponent = require('rive-react-native').default
} catch {
  /* rive not available */
}

const riveSource = RiveComponent
  ? require('../../../assets/animations/vault_setup_device1.riv')
  : null

const { width: SCREEN_WIDTH } = Dimensions.get('window')

type Nav = StackNavigationProp<MigrationStackParams, 'VaultSetup'>

function LightningIcon(): React.ReactElement {
  return (
    <View style={styles.iconOuter}>
      <View style={styles.iconInner}>
        <Svg width={18} height={18} viewBox="0 0 16 16" fill="none">
          <Defs>
            <LinearGradient
              id="lightningGrad"
              x1="8"
              y1="0"
              x2="8"
              y2="16"
            >
              <Stop offset="0.0673" stopColor="#F2C375" />
              <Stop offset="0.8383" stopColor="#FFAA1C" />
            </LinearGradient>
          </Defs>
          <Path
            d="M8.5 1L3 9h4.5l-1 6L13 7H8.5l1-6z"
            fill="url(#lightningGrad)"
          />
        </Svg>
      </View>
    </View>
  )
}

function InfoBullet({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}): React.ReactElement {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletIcon}>{icon}</View>
      <View style={styles.bulletText}>
        <Text fontType="brockmann-medium" style={styles.bulletTitle}>
          {title}
        </Text>
        <Text fontType="brockmann" style={styles.bulletDesc}>
          {description}
        </Text>
      </View>
    </View>
  )
}

function DeviceIcon(): React.ReactElement {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2zm5 18a1 1 0 100-2 1 1 0 000 2z"
        fill={MIGRATION.textTertiary}
      />
    </Svg>
  )
}

function ShieldIcon(): React.ReactElement {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2l8 4v6c0 5.25-3.4 9.74-8 11-4.6-1.26-8-5.75-8-11V6l8-4zm-1 10.99h2v2h-2v-2zm0-6h2v4h-2v-4z"
        fill={MIGRATION.textTertiary}
      />
    </Svg>
  )
}

function LockIcon(): React.ReactElement {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8h-1V6A5 5 0 007 6v2H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2zm-6 9a2 2 0 110-4 2 2 0 010 4zm3-9H9V6a3 3 0 116 0v2z"
        fill={MIGRATION.textTertiary}
      />
    </Svg>
  )
}

export default function VaultSetup(): React.ReactElement {
  const navigation = useNavigation<Nav>()

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <MigrationToolbar onBack={() => navigation.goBack()} />

      <View style={styles.content}>
        <Text fontType="brockmann-medium" style={styles.title}>
          Your vault setup
        </Text>

        {/* Fast Vault chip */}
        <View style={styles.chip}>
          <LightningIcon />
          <View style={styles.chipText}>
            <Text
              fontType="brockmann-medium"
              style={styles.chipTitle}
            >
              Fast Vault
            </Text>
            <Text fontType="brockmann" style={styles.chipSubtitle}>
              2-device setup
            </Text>
          </View>
        </View>

        {/* Rive animation */}
        <View style={styles.riveContainer}>
          {RiveComponent && riveSource ? (
            <RiveComponent
              source={riveSource}
              autoplay
              layoutScaleFactor={PixelRatio.get()}
              style={styles.rive}
              onError={() => {}}
            />
          ) : (
            <View style={styles.rivePlaceholder}>
              <Text style={styles.placeholderText}>🔐</Text>
            </View>
          )}
        </View>

        {/* Info bullets */}
        <InfoBullet
          icon={<DeviceIcon />}
          title="1-Device Signing"
          description="Convenient one-device signing on the go. Perfect for daily transactions or trading smaller amounts."
        />
        <InfoBullet
          icon={<ShieldIcon />}
          title="Fast and Secure Setup"
          description="No long setup. Just your email and password, plus two backups."
        />
        <InfoBullet
          icon={<LockIcon />}
          title="Multisig with one device"
          description="A co-signer can never initiate transactions; only assists with signing them."
        />
      </View>

      <View style={styles.bottom}>
        <Button
          testID="vault-setup-get-started"
          title="Get started"
          theme="ctaBlue"
          titleFontType="brockmann-medium"
          containerStyle={formStyles.ctaButton}
          onPress={() => navigation.navigate('VaultName')}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIGRATION.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    color: MIGRATION.textPrimary,
    letterSpacing: -0.36,
    marginTop: 16,
    marginBottom: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MIGRATION.surface1,
    borderRadius: MIGRATION.radiusSmallButton,
    paddingLeft: 8,
    paddingRight: 20,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginBottom: 24,
    gap: 8,
  },
  chipText: {
    gap: 2,
  },
  chipTitle: {
    fontSize: 14,
    color: MIGRATION.textPrimary,
  },
  chipSubtitle: {
    fontSize: 12,
    color: MIGRATION.textTertiary,
  },
  iconOuter: {
    width: 33,
    height: 33,
    backgroundColor: '#03132C',
    borderRadius: 17,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 25,
    height: 25,
    backgroundColor: '#03132C',
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riveContainer: {
    height: 240,
    width: SCREEN_WIDTH - 24,
    marginLeft: -12,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rive: {
    width: '100%',
    height: '100%',
  },
  rivePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 60,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  bulletIcon: {
    marginTop: -2,
  },
  bulletText: {
    flex: 1,
  },
  bulletTitle: {
    fontSize: 15,
    color: MIGRATION.textPrimary,
    marginBottom: 4,
  },
  bulletDesc: {
    fontSize: 13,
    color: MIGRATION.textTertiary,
    lineHeight: 18,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
})
