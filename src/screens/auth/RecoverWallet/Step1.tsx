import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import MigrationToolbar from 'components/migration/MigrationToolbar'
import authStyles from '../authStyles'

const Step1 = ({
  navigation,
}: {
  navigation: { navigate: (screen: string) => void }
}): React.ReactElement => {
  const insets = useSafeAreaInsets()
  const nav = useNavigation()

  return (
    <View style={authStyles.container}>
      <View style={{ paddingTop: insets.top }}>
        <MigrationToolbar onBack={() => nav.goBack()} />
      </View>
      <ScrollView
        contentContainerStyle={authStyles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={authStyles.title}>Recover Wallet</Text>
        <Text style={[authStyles.subtitle, { marginBottom: 40 }]}>
          Choose how to recover your wallet
        </Text>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={authStyles.button}
            onPress={() => navigation.navigate('Step2Seed')}
          >
            <Text style={authStyles.buttonText}>
              Enter seed phrase
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

Step1.navigationOptions = {
  headerShown: false,
}

const styles = StyleSheet.create({
  buttons: { gap: 14 },
})

export default Step1
