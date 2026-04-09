import { useMemo, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import * as DocumentPicker from 'expo-document-picker'
import { File, Paths } from 'expo-file-system'

import { importVaultBackup, persistImportedVault } from 'services/importVaultBackup'

import type { MigrationStackParams } from 'navigation/MigrationNavigator'

type Nav = StackNavigationProp<MigrationStackParams, 'ImportVault'>
const DETOX_STAGED_IMPORT_FILE = 'detox-import.vult'

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
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [decrypting, setDecrypting] = useState(false)

  const ctaTitle = useMemo(() => {
    if (loading) return 'Importing...'
    return fileState === 'success' ? 'Continue' : 'Continue'
  }, [fileState, loading])

  const navigateAfterImport = () => {
    navigation.navigate('MigrationSuccess', { results: [] })
  }

  const importDetoxStagedFile = async () => {
    if (!__DEV__) return false

    const stagedFile = new File(Paths.document, DETOX_STAGED_IMPORT_FILE)
    if (!stagedFile.exists) return false

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

        await persistImportedVault(stagedContent, stagedFile.name)
        setLoading(false)
        navigateAfterImport()
        return true
      } catch (err) {
        setLoading(false)
        Alert.alert('Import failed', err instanceof Error ? err.message : String(err))
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
      Alert.alert('Error', `Failed to read file: ${err instanceof Error ? err.message : String(err)}`)
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

      await persistImportedVault(fileContent, fileName)
      setLoading(false)
      navigateAfterImport()
    } catch (err) {
      setLoading(false)
      Alert.alert('Import failed', err instanceof Error ? err.message : String(err))
    }
  }

  const submitPassword = async (pwd?: string) => {
    const pw = pwd ?? password
    if (!fileContent || !fileName || !pw.trim()) return

    try {
      setDecrypting(true)
      setPasswordError(null)

      const result = importVaultBackup({
        content: fileContent,
        fileName,
        password: pw.trim(),
      })

      if (result.needsPassword) {
        setDecrypting(false)
        setPasswordError('Incorrect password, try again')
        return
      }

      await persistImportedVault(fileContent, fileName, pw.trim())
      setDecrypting(false)
      setShowPasswordSheet(false)
      navigateAfterImport()
    } catch {
      setDecrypting(false)
      setPasswordError('Incorrect password, try again')
    }
  }

  const dismissPasswordSheet = () => {
    setShowPasswordSheet(false)
    setPassword('')
    setPasswordError(null)
  }

  const resetSelection = () => {
    setFileName(null)
    setFileContent(null)
    setFileState('empty')
    setPassword('')
    setPasswordError(null)
    setShowPasswordSheet(false)
  }

  return {
    loading,
    fileName,
    fileContent,
    fileState,
    ctaTitle,
    pickFile,
    importDetoxStagedFile,
    importVault,
    resetSelection,
    showPasswordSheet,
    password,
    passwordError,
    decrypting,
    setPassword,
    submitPassword,
    dismissPasswordSheet,
  }
}
