import { NativeModule, requireNativeModule } from 'expo'

declare class ExpoDklsModule extends NativeModule {
  // Keygen
  isAvailable(): boolean
  createKeygenSetupMessage(threshold: number, partyIds: string[]): Promise<string>
  createKeygenSession(setupBase64: string, localPartyId: string): Promise<number>
  getOutboundMessage(handleId: number): Promise<string | null>
  getMessageReceiver(handleId: number, messageBase64: string, index: number): Promise<string | null>
  inputMessage(handleId: number, messageBase64: string): Promise<boolean>
  finishKeygen(handleId: number): Promise<{ keyshare: string; publicKey: string; chainCode: string }>
  freeKeygenSession(handleId: number): void
  freeKeyshare(handleId: number): void

  // Key Import (Seed Phrase → DKLS MPC)
  createDklsKeyImportSession(privateKeyHex: string, chainCodeHex: string, threshold: number, partyIds: string[]): Promise<{ setupMessage: string; sessionHandle: number }>
  createSchnorrKeyImportSession(privateKeyHex: string, chainCodeHex: string, threshold: number, partyIds: string[]): Promise<{ setupMessage: string; sessionHandle: number }>

  // Keysign (ECDSA / DKLS)
  loadKeyshare(keyshareBase64: string): Promise<number>
  getKeyshareKeyId(handleId: number): Promise<string>
  createSignSetupMessage(keyIdBase64: string, chainPath: string, messageHashHex: string, partyIds: string[]): Promise<string>
  createSignSession(setupBase64: string, localPartyId: string, keyshareHandleId: number): Promise<number>
  getSignOutboundMessage(handleId: number): Promise<string | null>
  getSignMessageReceiver(handleId: number, messageBase64: string, index: number): Promise<string | null>
  inputSignMessage(handleId: number, messageBase64: string): Promise<boolean>
  finishSign(handleId: number): Promise<string> // hex: R || S || recovery_id
  freeSignSession(handleId: number): void

  // Schnorr (EdDSA) Keygen - already exists in Swift
  createSchnorrKeygenSession(setupBase64: string, localPartyId: string): Promise<number>
  getSchnorrOutboundMessage(handleId: number): Promise<string | null>
  getSchnorrMessageReceiver(handleId: number, messageBase64: string, index: number): Promise<string | null>
  inputSchnorrMessage(handleId: number, messageBase64: string): Promise<boolean>
  finishSchnorrKeygen(handleId: number): Promise<{ keyshare: string; publicKey: string }>
  freeSchnorrSession(handleId: number): void

  // Schnorr (EdDSA) Keysign
  loadSchnorrKeyshare(keyshareBase64: string): Promise<number>
  getSchnorrKeyshareKeyId(handleId: number): Promise<string>
  createSchnorrSignSetupMessage(keyIdBase64: string, chainPath: string, messageHashHex: string, partyIds: string[]): Promise<string>
  createSchnorrSignSession(setupBase64: string, localPartyId: string, keyshareHandleId: number): Promise<number>
  getSchnorrSignOutboundMessage(handleId: number): Promise<string | null>
  getSchnorrSignMessageReceiver(handleId: number, messageBase64: string, index: number): Promise<string | null>
  inputSchnorrSignMessage(handleId: number, messageBase64: string): Promise<boolean>
  finishSchnorrSign(handleId: number): Promise<string> // hex: R || S
  freeSchnorrSignSession(handleId: number): void
}

export default requireNativeModule<ExpoDklsModule>('ExpoDkls')
