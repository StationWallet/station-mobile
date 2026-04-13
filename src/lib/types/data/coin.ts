export type Denom = 'ukrw' | 'umnt' | 'usdr' | 'uusd'

export interface CoinItem {
  amount: string
  denom: string
}

export interface DisplayCoin {
  value: string
  unit: string
}

export type Whitelist = Record<
  string,
  { symbol?: string; name?: string }
>
