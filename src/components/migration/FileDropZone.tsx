import React from 'react'
import { TouchableOpacity, View, StyleSheet } from 'react-native'
import Svg, { Path, Polyline } from 'react-native-svg'

import Text from 'components/Text'
import { MIGRATION } from 'consts/migration'
import type { FileState } from 'hooks/useImportFlow'

function CloudUploadIcon({
  color,
}: {
  color: string
}): React.ReactElement {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.5 19C4.01472 19 2 16.9853 2 14.5C2 12.3677 3.48209 10.5841 5.47636 10.1227C5.16509 9.47123 5 8.75452 5 8C5 5.23858 7.23858 3 10 3C12.0503 3 13.8124 4.2341 14.584 6.00901C14.8564 5.96474 15.1357 5.94165 15.4202 5.94165C18.3769 5.94165 20.7635 8.3283 20.7635 11.285C20.7635 11.7479 20.7073 12.1975 20.6013 12.6279C21.4497 13.3986 22 14.5105 22 15.75C22 18.0972 20.0972 20 17.75 20H6.5V19Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 22V14M12 14L15 17M12 14L9 17"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function PageCheckIcon({
  color,
}: {
  color: string
}): React.ReactElement {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Polyline
        points="14 2 14 8 20 8"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 15L11 17L15 13"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

const SUCCESS_GREEN = MIGRATION.successGreen

type Props = {
  onPress: () => void
  fileName?: string
  error?: string
  onClear: () => void
  fileState: FileState
}

const stateConfig = {
  empty: {
    bg: `${MIGRATION.buttonDisabled}80`,
    border: MIGRATION.strokeInput,
    textColor: MIGRATION.textInputPlaceholder,
    text: 'Import your vault share',
    Icon: CloudUploadIcon,
    iconColor: MIGRATION.textLink,
  },
  error: {
    bg: `${MIGRATION.errorRed}0D`,
    border: MIGRATION.errorRed,
    textColor: MIGRATION.errorRed,
    text: 'Unsupported file type, please try again',
    Icon: CloudUploadIcon,
    iconColor: MIGRATION.errorRed,
  },
  success: {
    bg: `${SUCCESS_GREEN}0D`,
    border: SUCCESS_GREEN,
    textColor: SUCCESS_GREEN,
    text: '',
    Icon: PageCheckIcon,
    iconColor: SUCCESS_GREEN,
  },
} as const

export default function FileDropZone({
  onPress,
  fileName,
  error,
  onClear,
  fileState,
}: Props): React.ReactElement {
  const config = stateConfig[fileState]
  const displayText =
    fileState === 'success' ? fileName ?? '' : error || config.text
  const { Icon } = config

  return (
    <View>
      <TouchableOpacity
        testID="import-file-picker"
        onPress={onPress}
        activeOpacity={0.7}
        style={[
          styles.zone,
          { backgroundColor: config.bg, borderColor: config.border },
        ]}
      >
        <Icon color={config.iconColor} />
        <Text
          fontType="brockmann"
          style={[styles.label, { color: config.textColor }]}
          numberOfLines={1}
        >
          {displayText}
        </Text>
      </TouchableOpacity>

      {fileState === 'success' && fileName ? (
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text
              fontType="brockmann-medium"
              style={styles.badgeText}
              numberOfLines={1}
            >
              {fileName}
            </Text>
            <TouchableOpacity
              onPress={onClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.clearIcon}>{'\u2715'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  zone: {
    width: '100%',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: MIGRATION.radiusCard,
    paddingVertical: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  label: {
    fontSize: 14,
    lineHeight: 17,
    letterSpacing: -0.18,
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 16,
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MIGRATION.surface1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 8,
    maxWidth: '100%',
  },
  badgeText: {
    fontSize: 13,
    color: MIGRATION.textPrimary,
    flexShrink: 1,
  },
  clearIcon: {
    fontSize: 14,
    color: MIGRATION.textTertiary,
  },
})
