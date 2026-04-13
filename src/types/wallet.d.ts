interface LocalWallet {
  name: string
  address: string
  ledger: boolean
  path?: number
  terraOnly?: boolean
}
