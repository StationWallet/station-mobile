import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useSetRecoilState } from 'recoil'
import NewWalletStore from 'stores/NewWalletStore'
import MigrationToolbar from 'components/migration/MigrationToolbar'
import { COLORS } from 'consts/theme'
import authStyles from '../authStyles'

const Step1 = ({
  navigation,
}: {
  navigation: { navigate: (screen: string) => void }
}): React.ReactElement => {
  const insets = useSafeAreaInsets()
  const nav = useNavigation()
  const [name, setName] = useState('')
  const setStoreName = useSetRecoilState(NewWalletStore.name)

  const canProceed = name.trim().length > 0

  const handleNext = (): void => {
    setStoreName(name.trim())
    navigation.navigate('NewWalletStep2')
  }

  return (
    <View style={authStyles.container}>
      <View style={{ paddingTop: insets.top }}>
        <MigrationToolbar onBack={() => nav.goBack()} />
      </View>
      <ScrollView
        contentContainerStyle={authStyles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={authStyles.title}>Create a wallet</Text>
        <Text style={authStyles.subtitle}>
          Choose a name for your wallet
        </Text>

        <View style={authStyles.inputGroup}>
          <Text style={authStyles.label}>Wallet Name</Text>
          <TextInput
            style={authStyles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. My Wallet"
            placeholderTextColor={COLORS.textSecondary}
            autoFocus
            returnKeyType="next"
            onSubmitEditing={() => canProceed && handleNext()}
          />
        </View>

        <TouchableOpacity
          style={[
            authStyles.button,
            !canProceed && authStyles.buttonDisabled,
          ]}
          onPress={handleNext}
          disabled={!canProceed}
        >
          <Text style={authStyles.buttonText}>Next</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

Step1.navigationOptions = {
  headerShown: false,
}

export default Step1
