import { env } from '../config/env'

export type MpcProtocol = 'ecdsa' | 'eddsa'

/** Register a batch import with vultiserver — ECDSA only, no EdDSA required. */
export async function setupBatchImport(input: {
  name: string
  session_id: string
  hex_encryption_key: string
  hex_chain_code: string
  local_party_id: string
  encryption_password: string
  email: string
  protocols: MpcProtocol[]
  chains?: string[]
}): Promise<void> {
  const url = `${env.vultisigApiUrl}/vault/batch/import`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`setupBatchImport failed: ${res.status} ${text}`)
  }
}

/** Verify vault email with a code sent by vultiserver. */
export async function verifyVaultEmail(input: {
  public_key: string
  code: string
}): Promise<void> {
  const res = await fetch(
    `${env.vultisigApiUrl}/vault/verify/${input.public_key}/${input.code}`,
    { method: 'GET' }
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`verifyVaultEmail failed: ${res.status} ${text}`)
  }
}
