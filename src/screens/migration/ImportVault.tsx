import React, { useState } from 'react'
import { View, StyleSheet, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import Svg, { Path, Circle } from 'react-native-svg'
import Animated, {
  FadeInRight,
  FadeOutLeft,
} from 'react-native-reanimated'

import Text from 'components/Text'
import Button from 'components/Button'
import GlassButton from 'components/migration/GlassButton'
import FileDropZone from 'components/migration/FileDropZone'
import DecryptPasswordSheet from 'components/migration/DecryptPasswordSheet'
import { useImportFlow } from 'hooks/useImportFlow'
import { MIGRATION } from 'consts/migration'
import { useWalletNav } from 'navigation/hooks'

function BackChevron(): React.ReactElement {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18L9 12L15 6"
        stroke={MIGRATION.textPrimary}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function InfoIcon(): React.ReactElement {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12"
        cy="12"
        r="10"
        stroke={MIGRATION.textPrimary}
        strokeWidth={1.5}
      />
      <Path
        d="M12 16V12M12 8H12.01"
        stroke={MIGRATION.textPrimary}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function ImportTooltip({
  visible,
  onDismiss,
}: {
  visible: boolean
  onDismiss: () => void
}): React.ReactElement | null {
  if (!visible) return null

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss tooltip"
        style={styles.tooltipBackdrop}
        onPress={onDismiss}
      />
      <View style={styles.tooltip}>
        <View style={styles.tooltipCaret} />
        <Text fontType="satoshi-medium" style={styles.tooltipTitle}>
          Import vault share
        </Text>
        <Text fontType="brockmann" style={styles.tooltipDescription}>
          Use a vault share to recover your vault. Supported file
          types: .bak & .vult
        </Text>
      </View>
    </>
  )
}

export default function ImportVault(): React.ReactElement {
  const navigation = useNavigation()
  const { goHome } = useWalletNav()
  const [showTooltip, setShowTooltip] = useState(false)

  const handleBack = (): void => {
    if (navigation.canGoBack()) {
      navigation.goBack()
    } else {
      goHome()
    }
  }
  const {
    loading,
    fileName,
    fileState,
    ctaTitle,
    pickFile,
    importVault,
    resetSelection,
    showPasswordSheet,
    passwordError,
    decrypting,
    submitPassword,
    dismissPasswordSheet,
  } = useImportFlow()

  const canContinue = fileState === 'success'

  const insets = useSafeAreaInsets()

  return (
    <View style={styles.container}>
      <View style={[styles.toolbar, { paddingTop: insets.top + 8 }]}>
        <GlassButton onPress={handleBack} testID="import-vault-back">
          <BackChevron />
        </GlassButton>
        <Text fontType="brockmann-medium" style={styles.toolbarTitle}>
          Import Vault
        </Text>
        <View style={styles.infoButtonWrapper}>
          <GlassButton
            onPress={() => setShowTooltip((v) => !v)}
            testID="import-vault-info"
          >
            <InfoIcon />
          </GlassButton>
          <ImportTooltip
            visible={showTooltip}
            onDismiss={() => setShowTooltip(false)}
          />
        </View>
      </View>

      <Animated.View
        entering={FadeInRight.duration(250)}
        exiting={FadeOutLeft.duration(250)}
        style={styles.content}
      >
        <View style={styles.dropZoneWrapper}>
          <FileDropZone
            fileState={fileState}
            fileName={fileName ?? undefined}
            onPress={pickFile}
            onClear={resetSelection}
          />
        </View>

        <Text
          fontType="brockmann-medium"
          style={styles.supportedText}
        >
          Supported file types: .bak & .vult
        </Text>
      </Animated.View>

      <View
        style={[
          styles.bottom,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        {fileState === 'success' && fileName ? (
          <View style={styles.selectedBadgeRow}>
            <View style={styles.selectedBadge}>
              <Text
                fontType="brockmann-medium"
                style={styles.selectedBadgeText}
                numberOfLines={1}
              >
                {fileName}
              </Text>
            </View>
          </View>
        ) : null}

        <Button
          testID="import-continue"
          title={ctaTitle}
          theme="ctaBlue"
          titleFontType="brockmann-medium"
          onPress={importVault}
          disabled={!canContinue || loading}
          containerStyle={styles.ctaButton}
        />
      </View>

      <DecryptPasswordSheet
        visible={showPasswordSheet}
        onSubmit={submitPassword}
        onDismiss={dismissPasswordSheet}
        error={passwordError ?? undefined}
        loading={decrypting}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIGRATION.bg,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: MIGRATION.screenPadding,
    paddingTop: 8,
    paddingBottom: 8,
  },
  toolbarTitle: {
    fontSize: 17,
    color: MIGRATION.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  content: {
    flex: 1,
    paddingHorizontal: MIGRATION.screenPadding,
    justifyContent: 'center',
  },
  dropZoneWrapper: {
    paddingHorizontal: 16,
  },
  supportedText: {
    fontSize: 13,
    color: MIGRATION.textTertiary,
    textAlign: 'center',
    marginTop: 20,
    letterSpacing: 0.06,
  },
  bottom: {
    paddingHorizontal: MIGRATION.screenPadding,
    paddingBottom: 24,
  },
  selectedBadgeRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'center',
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MIGRATION.surface1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    maxWidth: '100%',
  },
  selectedBadgeText: {
    fontSize: 13,
    color: MIGRATION.textPrimary,
    flexShrink: 1,
  },
  ctaButton: {
    width: '100%',
    borderRadius: MIGRATION.radiusPill,
    height: MIGRATION.ctaHeight,
  },
  infoButtonWrapper: {
    position: 'relative' as const,
  },
  tooltipBackdrop: {
    position: 'absolute' as const,
    top: -100,
    left: -500,
    right: -500,
    bottom: -1000,
    zIndex: 999,
  },
  tooltip: {
    position: 'absolute' as const,
    top: '100%' as unknown as number,
    right: 0,
    marginTop: 14,
    width: 280,
    backgroundColor: '#F0F4FC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    zIndex: 1000,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 8,
  },
  tooltipCaret: {
    position: 'absolute' as const,
    top: -6,
    right: 14,
    width: 14,
    height: 14,
    backgroundColor: '#F0F4FC',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  tooltipTitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#02122B',
    marginBottom: 3,
  },
  tooltipDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: '#02122B',
  },
})
