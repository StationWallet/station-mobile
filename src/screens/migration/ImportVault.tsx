import React from 'react'
import { View, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import Svg, { Path, Circle } from 'react-native-svg'

import Text from 'components/Text'
import Button from 'components/Button'
import GlassButton from 'components/migration/GlassButton'
import FileDropZone from 'components/migration/FileDropZone'
import DecryptPasswordSheet from 'components/migration/DecryptPasswordSheet'
import { useImportFlow } from 'hooks/useImportFlow'
import { MIGRATION } from 'consts/migration'

function BackChevron() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18L9 12L15 6"
        stroke="#F0F4FC"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function InfoIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke="#F0F4FC" strokeWidth={1.5} />
      <Path
        d="M12 16V12M12 8H12.01"
        stroke="#F0F4FC"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export default function ImportVault() {
  const navigation = useNavigation()
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <GlassButton onPress={() => navigation.goBack()} testID="import-vault-back">
          <BackChevron />
        </GlassButton>
        <Text fontType="brockmann-medium" style={styles.toolbarTitle}>
          Import Vault
        </Text>
        <GlassButton onPress={() => {}} testID="import-vault-info">
          <InfoIcon />
        </GlassButton>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.dropZoneWrapper}>
          <FileDropZone
            fileState={fileState}
            fileName={fileName ?? undefined}
            onPress={pickFile}
            onClear={resetSelection}
          />
        </View>

        <Text fontType="brockmann-medium" style={styles.supportedText}>
          Supported file types: .bak & .vult
        </Text>
      </View>

      {/* Bottom section */}
      <View style={styles.bottom}>
        {fileState === 'success' && fileName ? (
          <View style={styles.selectedBadgeRow}>
            <View style={styles.selectedBadge}>
              <Text fontType="brockmann-medium" style={styles.selectedBadgeText} numberOfLines={1}>
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

      {/* Decrypt Password Sheet */}
      <DecryptPasswordSheet
        visible={showPasswordSheet}
        onSubmit={submitPassword}
        onDismiss={dismissPasswordSheet}
        error={passwordError ?? undefined}
        loading={decrypting}
      />
    </SafeAreaView>
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
    backgroundColor: '#061B3A',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    maxWidth: '100%',
  },
  selectedBadgeText: {
    fontSize: 13,
    color: '#F0F4FC',
    flexShrink: 1,
  },
  ctaButton: {
    width: '100%',
    borderRadius: 99,
    height: 46,
  },
})
