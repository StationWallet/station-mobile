import {
  setupBatchImport,
  setupBatchKeygen,
  setupKeyImport,
} from 'services/fastVaultServer'

describe('fastVaultServer batch setup payloads', () => {
  let fetchMock: jest.Mock

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(''),
    })
    ;(globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('posts Vultisig-style batch keygen payloads for created fast vaults', async () => {
    await setupBatchKeygen({
      name: 'CreatedFastVault',
      session_id: 'session',
      hex_encryption_key: 'encryption',
      hex_chain_code: 'chain-code',
      local_party_id: 'Server',
      encryption_password: 'password',
      email: 'user@example.com',
      lib_type: 1,
      protocols: ['ecdsa', 'eddsa'],
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.vultisig.com/vault/batch/keygen',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'CreatedFastVault',
          session_id: 'session',
          hex_encryption_key: 'encryption',
          hex_chain_code: 'chain-code',
          local_party_id: 'Server',
          encryption_password: 'password',
          email: 'user@example.com',
          lib_type: 1,
          protocols: ['ecdsa', 'eddsa'],
        }),
      }
    )
  })

  it('posts seed import payloads without the old Station hex_chain_code field', async () => {
    await setupBatchImport({
      name: 'SeedImport',
      session_id: 'session',
      hex_encryption_key: 'encryption',
      local_party_id: 'Server',
      encryption_password: 'password',
      email: 'user@example.com',
      lib_type: 2,
      protocols: ['ecdsa', 'eddsa'],
      chains: ['Ethereum', 'Terra', 'Solana'],
    })

    const request = fetchMock.mock.calls[0][1]
    const body = JSON.parse(request.body)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.vultisig.com/vault/batch/import',
      expect.any(Object)
    )
    expect(body).toEqual({
      name: 'SeedImport',
      session_id: 'session',
      hex_encryption_key: 'encryption',
      local_party_id: 'Server',
      encryption_password: 'password',
      email: 'user@example.com',
      lib_type: 2,
      protocols: ['ecdsa', 'eddsa'],
      chains: ['Ethereum', 'Terra', 'Solana'],
    })
    expect(body.hex_chain_code).toBeUndefined()
  })

  it('posts sequential key import payloads with the seed root chain code', async () => {
    await setupKeyImport({
      name: 'SeedImport',
      session_id: 'session',
      hex_encryption_key: 'encryption',
      hex_chain_code: 'root-chain-code',
      local_party_id: 'Server',
      encryption_password: 'password',
      email: 'user@example.com',
      lib_type: 2,
      chains: ['Ethereum', 'Terra'],
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.vultisig.com/vault/import',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'SeedImport',
          session_id: 'session',
          hex_encryption_key: 'encryption',
          hex_chain_code: 'root-chain-code',
          local_party_id: 'Server',
          encryption_password: 'password',
          email: 'user@example.com',
          lib_type: 2,
          chains: ['Ethereum', 'Terra'],
        }),
      }
    )
  })
})
