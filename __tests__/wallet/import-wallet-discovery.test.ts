import {
  DEFAULT_IMPORT_CHAINS,
  discoverImportWalletChains,
  STATION_DISCOVERY_CHAINS,
} from 'services/importWalletDiscovery'

jest.mock('@vultisig/walletcore-native', () => {
  const coinTypes = {
    ethereum: 60,
    solana: 501,
    sui: 784,
    thorchain: 931,
    cosmos: 118,
    kujira: 118,
    dydx: 118,
    osmosis: 118,
    terraV2: 330,
    terra: 330,
    noble: 118,
    akash: 118,
    ton: 607,
    tron: 195,
  }

  return {
    NativeWalletCore: {
      getInstance: () => ({
        CoinType: coinTypes,
        HDWallet: {
          createWithMnemonic: () => ({
            getAddressForCoin: (coinType: number) =>
              `address-${coinType}`,
            getAddressDerivation: (
              coinType: number,
              derivation: number
            ) => `address-${coinType}-${derivation}`,
            getKeyForCoin: () => ({
              data: () => new Uint8Array(32).fill(1),
              getPublicKeySecp256k1: () => ({
                data: () => new Uint8Array(33).fill(2),
                delete: jest.fn(),
              }),
              delete: jest.fn(),
            }),
            delete: jest.fn(),
          }),
        },
      }),
    },
  }
})

jest.mock('../../src/config/env', () => ({
  env: {
    vultisigApiUrl: 'https://api.vultisig.test',
  },
}))

const TREZOR_12 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe('import wallet chain discovery', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('uses Terra as the no-active default', () => {
    expect(DEFAULT_IMPORT_CHAINS).toEqual(['Terra'])
  })

  it('matches the Vultiagent discovery chain set', () => {
    expect(
      STATION_DISCOVERY_CHAINS.map((config) => config.chain)
    ).toEqual([
      'Ethereum',
      'Solana',
      'Sui',
      'THORChain',
      'MayaChain',
      'Cosmos',
      'Kujira',
      'Dydx',
      'Osmosis',
      'Terra',
      'TerraClassic',
      'Noble',
      'Akash',
      'Ton',
      'Tron',
    ])
  })

  it('returns chains with a non-zero native balance', async () => {
    const fetchMock = jest.fn(async (input, init) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : null

      if (body?.method === 'eth_getBalance') {
        return { json: async () => ({ result: '0x7b' }) }
      }
      if (body?.method === 'getBalance') {
        return { json: async () => ({ result: { value: 0 } }) }
      }
      if (body?.method === 'suix_getBalance') {
        return {
          json: async () => ({ result: { totalBalance: '0' } }),
        }
      }
      if (url.includes('terra-lcd.publicnode.com')) {
        return {
          json: async () => ({
            balances: [{ denom: 'uluna', amount: '123' }],
          }),
        }
      }
      if (url.includes('/ton/v3/wallet')) {
        return { json: async () => ({ balance: '0' }) }
      }
      if (url.includes('trongrid')) {
        return { json: async () => ({ balance: 0 }) }
      }

      return {
        json: async () => ({
          balances: [{ denom: 'uluna', amount: '0' }],
        }),
      }
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const progress: number[] = []
    const discovered: string[] = []
    const results = await discoverImportWalletChains(
      TREZOR_12,
      (p) => progress.push(p),
      (result) => discovered.push(result.chain)
    )

    expect(results.map((result) => result.chain)).toEqual([
      'Ethereum',
      'Terra',
    ])
    expect(discovered).toEqual(['Ethereum', 'Terra'])
    expect(progress).toHaveLength(STATION_DISCOVERY_CHAINS.length)
    expect(progress[progress.length - 1]).toBe(1)
  })

  it('treats failed balance requests as inactive chains', async () => {
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(
        new Error('offline')
      ) as unknown as typeof fetch

    await expect(
      discoverImportWalletChains(TREZOR_12)
    ).resolves.toEqual([])
  })
})
