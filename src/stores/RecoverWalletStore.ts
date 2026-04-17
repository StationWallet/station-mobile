import { atom } from 'recoil'
import { StoreKeyEnum } from './StoreKeyEnum'

const seed = atom<string[]>({
  key: StoreKeyEnum.recoverWalletSeed,
  default: [],
})

const qrData = atom<RecoverWalletSchemeDataType | undefined>({
  key: StoreKeyEnum.recoverQRData,
  default: undefined,
})

export default {
  seed,
  qrData,
}
