import { atom } from 'jotai'

const name = atom<string>('')

const password = atom<string>('')

const seed = atom<string[]>([])

const qrData = atom<RecoverWalletSchemeDataType | undefined>(undefined)

export default {
  name,
  password,
  seed,
  qrData,
}
