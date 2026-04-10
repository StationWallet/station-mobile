import { useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import * as DocumentPicker from 'expo-document-picker'
import { File, Paths } from 'expo-file-system'

import { importVaultBackup, persistImportedVault } from 'services/importVaultBackup'
import { getErrorMessage } from 'utils/getErrorMessage'

import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'ImportVault'>
const DETOX_STAGED_FILES = ['detox-import.vult', 'detox-import.bak']

export type FileState = 'empty' | 'error' | 'success'

const isVaultBackupFile = (name: string) => /\.(vult|bak)$/i.test(name)

export function useImportFlow() {
  const navigation = useNavigation<Nav>()

  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [fileState, setFileState] = useState<FileState>('empty')

  // Password sheet state
  const [showPasswordSheet, setShowPasswordSheet] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [decrypting, setDecrypting] = useState(false)

  const ctaTitle = loading ? 'Importing...' : 'Continue'

  const navigateAfterImport = (vaultName: string) => {
    setFileContent(null)
    navigation.navigate('MigrationSuccess', { results: [], importedVaultName: vaultName })
  }

  const persistAndNavigate = async (vaultBytes: Uint8Array, vaultName: string) => {
    await persistImportedVault(vaultBytes, vaultName)
    navigateAfterImport(vaultName)
  }

  const importDetoxStagedFile = async () => {
    if (!__DEV__) return false

    let stagedFile: InstanceType<typeof File> | null = null
    for (const name of DETOX_STAGED_FILES) {
      const candidate = new File(Paths.document, name)
      if (candidate.exists) { stagedFile = candidate; break }
    }
    if (!stagedFile) return false

    const stagedContent = (await stagedFile.text()).trim()
    setFileName(stagedFile.name)
    setFileContent(stagedContent)
    setFileState('success')

    if (isVaultBackupFile(stagedFile.name)) {
      setLoading(true)
      try {
        const result = importVaultBackup({
          content: stagedContent,
          fileName: stagedFile.name,
        })

        if (result.needsPassword) {
          setLoading(false)
          setShowPasswordSheet(true)
          return true
        }

        await persistAndNavigate(result.vaultBytes, result.vaultName)
        setLoading(false)
        return true
      } catch (err) {
        setLoading(false)
        Alert.alert('Import failed', getErrorMessage(err))
        return false
      }
    }

    return false
  }

  const pickFile = async () => {
    try {
      if (await importDetoxStagedFile()) return

      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      })

      if (result.canceled) return

      const file = result.assets[0]
      if (!file) {
        Alert.alert('Error', 'No vault file was selected.')
        return
      }

      if (!isVaultBackupFile(file.name)) {
        setFileName(file.name)
        setFileContent(null)
        setFileState('error')
        return
      }

      const selectedFile = new File(file.uri)
      const content = (await selectedFile.text()).trim()
      console.log(`[Import] Read file: ${file.name}, ${content.length} chars`)

      setFileName(file.name)
      setFileContent(content)
      setFileState('success')
    } catch (err) {
      Alert.alert('Error', `Failed to read file: ${getErrorMessage(err)}`)
    }
  }

  const importVault = async () => {
    if (!fileContent || !fileName) return

    try {
      setLoading(true)
      const result = importVaultBackup({
        content: fileContent,
        fileName,
      })

      if (result.needsPassword) {
        setLoading(false)
        setShowPasswordSheet(true)
        return
      }

      await persistAndNavigate(result.vaultBytes, result.vaultName)
      setLoading(false)
    } catch (err) {
      setLoading(false)
      Alert.alert('Import failed', getErrorMessage(err))
    }
  }

  const submitPassword = async (pwd: string) => {
    if (!fileContent || !fileName || !pwd.trim()) return

    try {
      setDecrypting(true)
      setPasswordError(null)

      const result = importVaultBackup({
        content: fileContent,
        fileName,
        password: pwd.trim(),
      })

      if (result.needsPassword) {
        setDecrypting(false)
        setPasswordError('Incorrect password, try again')
        return
      }

      await persistAndNavigate(result.vaultBytes, result.vaultName)
      setDecrypting(false)
      setShowPasswordSheet(false)
    } catch {
      setDecrypting(false)
      setPasswordError('Incorrect password, try again')
    }
  }

  const dismissPasswordSheet = () => {
    setShowPasswordSheet(false)
    setPasswordError(null)
  }

  const resetSelection = () => {
    setFileName(null)
    setFileContent(null)
    setFileState('empty')
    setPasswordError(null)
    setShowPasswordSheet(false)
  }

  return {
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
  }
}
