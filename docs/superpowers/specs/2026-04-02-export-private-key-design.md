# Export Private Key

## Purpose

Allow users to export their private key from station-mobile so they can import it into another wallet (e.g., Terra Station desktop, Keplr, or a future VultiAgent app). This is a migration utility — the app is merging into VultiAgent and keychain continuity cannot be guaranteed.

## Scope

- Export decrypted private key hex for non-Ledger wallets
- Password verification before reveal
- Copy to clipboard

Out of scope: encrypted file export, QR code export, seed phrase export, Ledger wallet export.

## Flow

1. User taps **"Export Private Key"** in WalletHome management section
2. Navigates to `ExportPrivateKey` screen with wallet name/address as route params
3. Screen shows warning text, password input, and "Reveal" button
4. User enters wallet password → taps "Reveal"
5. On success: private key hex displayed in monospace text area + "Copy to Clipboard" button
6. On failure: inline error message, user can retry
7. "Done" button navigates back

## New Files

### `src/screens/ExportPrivateKey.tsx`

- Route params: `{ wallet: { name: string; address: string } }`
- Uses `getDecyrptedKey(name, password)` from `utils/wallet.ts` to decrypt
- Uses `expo-clipboard` for copy functionality
- Password input with `secureTextEntry`
- Warning text: "Anyone with this key can access your funds. Never share it."
- After reveal: monospace selectable text showing hex private key
- Copy button with brief "Copied!" feedback state
- Matches existing dark theme (`#02122B` background, same Text/Button components)

## Modified Files

### `src/screens/WalletHome.tsx`

- Add "Export Private Key" button in the management section, between "Add Wallet" and "Remove Wallet"
- Only shown for non-Ledger wallets. WalletHome route params don't include `ledger`, so use `getAuthDataValue(wallet.name)` to check `ledger` status at render time (async, via `useQuery` or `useEffect`)

### `src/navigation/MainNavigator.tsx`

- Add `ExportPrivateKey` route to `MainStackParams` type
- Register `ExportPrivateKey` screen in the Stack.Navigator

## Security Considerations

- Private key decrypted only after correct password provided (same gate as existing flows)
- No clipboard auto-clear — matches industry standard (MetaMask, Trust Wallet don't do this either)
- No screenshot prevention — not reliably enforceable cross-platform, adds complexity for a migration utility
- Warning text displayed before and after reveal

## Key Format

- secp256k1 private key as hex string (64 characters)
- BIP44 derivation path: coinType 330 (Terra)
- Compatible with any wallet that accepts raw hex private key import for Terra/Cosmos chains
