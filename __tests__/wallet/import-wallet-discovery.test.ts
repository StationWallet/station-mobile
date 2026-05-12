import {
  DEFAULT_IMPORT_CHAINS,
  discoverImportWalletChains,
} from 'services/importWalletDiscovery'

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

  it('returns chains with a non-zero native balance', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          balances: [{ denom: 'uluna', amount: '123' }],
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          balances: [{ denom: 'uluna', amount: '0' }],
        }),
      })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const progress: number[] = []
    const results = await discoverImportWalletChains(TREZOR_12, (p) =>
      progress.push(p)
    )

    expect(results).toEqual([
      {
        chain: 'Terra',
        ticker: 'LUNA',
        address: 'terra1amdttz2937a3dytmxmkany53pp6ma6dy4vsllv',
        hasBalance: true,
      },
    ])
    expect(progress).toEqual([0.5, 1])
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
