import React, { useState, useCallback } from 'react'
import {
  View,
  TextInput,
  StyleSheet,
  ScrollView,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native'

import { getDecyrptedKey } from 'utils/wallet'
import Text from 'components/Text'
import Button from 'components/Button'

import type { MainStackParams } from 'navigation/MainNavigator'

export default function ExportPrivateKey() {
  const { params } = useRoute<RouteProp<MainStackParams, 'ExportPrivateKey'>>()
  const navigation = useNavigation()
  const { wallet } = params

  const [password, setPassword] = useState('')
  const [privateKey, setPrivateKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleReveal = useCallback(async () => {
    setError('')
    try {
      const key = await getDecyrptedKey(wallet.name, password)
      setPrivateKey(key)
    } catch {
      setError('Incorrect password')
    }
  }, [wallet.name, password])

  const handleCopy = useCallback(async () => {
    if (!privateKey) return
    await Clipboard.setStringAsync(privateKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [privateKey])

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Export Private Key</Text>
      <Text style={styles.address}>{wallet.name}</Text>

      <View style={styles.warningCard}>
        <Text style={styles.warningText}>
          Anyone with this key can access your funds. Never share it.
        </Text>
      </View>

      {privateKey === null ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Enter wallet password"
            placeholderTextColor="#8295AE"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />
          {error !== '' && <Text style={styles.errorText}>{error}</Text>}
          <Button
            title="Reveal Private Key"
            onPress={handleReveal}
            disabled={password.length === 0}
            theme="sapphire"
            containerStyle={styles.button}
          />
        </>
      ) : (
        <>
          <View style={styles.keyCard}>
            <Text style={styles.keyText} selectable>
              {privateKey}
            </Text>
          </View>
          <Button
            title={copied ? 'Copied!' : 'Copy to Clipboard'}
            onPress={handleCopy}
            theme="sapphire"
            containerStyle={styles.button}
          />
        </>
      )}

      <Button
        title="Done"
        onPress={() => navigation.goBack()}
        theme="transparent"
        containerStyle={styles.button}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#02122B' },
  content: { padding: 20, alignItems: 'center' },
  title: { color: '#F0F4FC', fontSize: 20, fontWeight: '600', marginTop: 24 },
  address: { color: '#8295AE', fontSize: 14, marginTop: 8, marginBottom: 24 },
  warningCard: {
    backgroundColor: '#3D1A1A',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  warningText: { color: '#FF5C5C', fontSize: 14, textAlign: 'center' },
  input: {
    backgroundColor: '#061B3A',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    color: '#F0F4FC',
    fontSize: 16,
    marginBottom: 12,
  },
  errorText: { color: '#FF5C5C', fontSize: 13, marginBottom: 12 },
  keyCard: {
    backgroundColor: '#061B3A',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 16,
  },
  keyText: {
    color: '#F0F4FC',
    fontSize: 13,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  button: { width: '100%', marginBottom: 12 },
})
