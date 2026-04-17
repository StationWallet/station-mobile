import type { MpcProtocol } from './fastVaultServer'

export async function setupBatchImport(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stub retains signature parity with real impl
  _input: {
    name: string
    session_id: string
    hex_encryption_key: string
    hex_chain_code: string
    local_party_id: string
    encryption_password: string
    email: string
    protocols: MpcProtocol[]
    chains?: string[]
  }
): Promise<void> {
  // No-op: stubbed so Detox UI tests don't hit the real server.
}

export async function verifyVaultEmail(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stub retains signature parity with real impl
  _input: {
    public_key: string
    code: string
  }
): Promise<void> {
  // No-op: any 4-digit code "verifies" in stub mode.
}
