import React, { useState } from 'react'
import { View, StyleSheet, TextInput, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { RouteProp } from '@react-navigation/native'
import Animated, {
  FadeInRight,
  FadeOutLeft,
} from 'react-native-reanimated'

import Text from 'components/Text'
import Button from 'components/Button'
import StepProgressBar from 'components/migration/StepProgressBar'
import MigrationToolbar from 'components/migration/MigrationToolbar'
import { formStyles } from 'components/migration/migrationStyles'
import { MIGRATION } from 'consts/migration'
import type { MigrationStackParams } from 'navigation/MigrationNavigator'
import { useWalletNav } from 'navigation/hooks'

type Nav = StackNavigationProp<MigrationStackParams, 'VaultName'>
type Route = RouteProp<MigrationStackParams, 'VaultName'>

export default function VaultName(): React.ReactElement {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { goHome } = useWalletNav()
  const mode = route.params?.mode ?? 'create'
  const insets = useSafeAreaInsets()
  const [name, setName] = useState('')

  const handleBack = (): void => {
    if (navigation.canGoBack()) {
      navigation.goBack()
    } else {
      goHome()
    }
  }

  return (
    <View style={formStyles.container}>
      <View style={formStyles.flex}>
        <View style={{ paddingTop: insets.top }}>
          <MigrationToolbar onBack={handleBack} />
        </View>

        <StepProgressBar currentStep={1} />

        <Animated.View
          entering={FadeInRight.duration(250)}
          exiting={FadeOutLeft.duration(250)}
          style={formStyles.content}
        >
          <Text style={formStyles.title} fontType="brockmann-medium">
            Name your vault
          </Text>
          <Text style={formStyles.subtitle} fontType="brockmann">
            No inspiration? You can always change the name later in
            your settings.
          </Text>

          <View style={styles.inputWrapper}>
            <TextInput
              testID="vault-name-input"
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Saving Vault"
              placeholderTextColor={MIGRATION.textInputPlaceholder}
              autoCorrect={false}
            />
            {name.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setName('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.clearIcon}>{'\u2715'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        <View
          style={[
            formStyles.buttonContainer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <Button
            testID="vault-name-next"
            title="Next"
            theme="ctaBlue"
            disabled={name.trim().length === 0}
            titleFontType="brockmann-medium"
            onPress={() => {
              navigation.navigate('VaultEmail', {
                walletName: name.trim(),
                mode,
              })
            }}
            containerStyle={formStyles.ctaButton}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MIGRATION.surface1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MIGRATION.strokeInput,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 14,
    color: MIGRATION.textPrimary,
    fontFamily: 'Brockmann-Regular',
  },
  clearButton: {
    marginLeft: 8,
  },
  clearIcon: {
    fontSize: 14,
    color: MIGRATION.textTertiary,
  },
})
