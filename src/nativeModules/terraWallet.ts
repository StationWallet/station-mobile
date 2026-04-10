import { MnemonicKey } from '@terra-money/terra.js'

export type TerraWalletType = {
  getNewWallet(): Promise<{
    privateKey: string
    publicKey: string
    publicKey64: string
    address: string
    mnemonic: string
  }>
}

// Pure JS replacement for the native TerraWallet module using terra.js
const TerraWallet: TerraWalletType = {
  getNewWallet: async () => {
    const mk = new MnemonicKey()
    const pubKeyBase64 =
      (mk.publicKey as { key?: string } | null)?.key || ''
    return {
      privateKey: mk.privateKey.toString('hex'),
      publicKey: pubKeyBase64,
      publicKey64: pubKeyBase64,
      address: mk.accAddress,
      mnemonic: mk.mnemonic,
    }
  },
}

export default TerraWallet
