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
    return {
      privateKey: mk.privateKey.toString('hex'),
      publicKey: mk.publicKey?.toProto()?.toString() || '',
      publicKey64: mk.publicKey?.toProto()?.toString() || '',
      address: mk.accAddress,
      mnemonic: mk.mnemonic,
    }
  },
}

export default TerraWallet
