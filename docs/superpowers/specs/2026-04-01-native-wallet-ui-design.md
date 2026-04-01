# Native Wallet UI — Replace WebView with Native Screens

## Problem

The app's main UI is a WebView loading `https://mobile.station.terra.money`, which is a remote Terra Station web app that makes its own backend calls to dead/rate-limited Terra infrastructure. This produces a "Too many requests" error on the screen. We have no control over that remote web app.

## Goal

Replace the WebView with native React Native screens that use the LCD endpoints we've already fixed (PublicNode/Polkachu). Minimal feature set: wallet balance, send, receive, and transaction history.

## Architecture

Remove `<WebViewContainer>` from `App/index.tsx`. Replace with routing logic:
- If wallets exist (`getWallets()` returns non-empty): show `MainNavigator`
- If no wallets: show `AuthNavigator` (existing native auth screens)

The existing auth flow (NewWallet, RecoverWallet) is unchanged. We add a `MainNavigator` with 4 new screens.

### Navigation Structure

```
App
├── OnBoarding (first run only)
├── AuthNavigator (no wallet)
│   ├── AuthMenu
│   ├── NewWallet (Step1 → Step2 → Step3 → Created)
│   └── RecoverWallet (Step1 → ... → Recovered)
└── MainNavigator (has wallet)
    ├── WalletHome (default)
    ├── Send (Step1: form → Step2: confirm → broadcast)
    ├── Receive
    └── History
```

### Data Layer

All LCD queries use the existing `useLCD()` hook which returns a configured `LCDClient` from `@terra-money/terra.js`. New queries wrapped in `useQuery` from react-query for caching and refetch.

## Screens

### WalletHome

The main screen after login.

- Displays wallet name and address (truncated, tap to copy full address)
- Fetches LUNA balance via LCD: `/cosmos/bank/v1beta1/balances/{address}`
- Shows balance in a dark Card component (reuses existing Card with `dark` prop)
- Two action buttons: "Send" and "Receive"
- Pull-to-refresh to refetch balance
- If multiple wallets exist, show the first one. Wallet switching is out of scope.

### Send

Two-step flow.

**Step 1 — Form:**
- Recipient address input. Validated with `AccAddress.validate()` from `@terra-money/terra.js`. Inline error via FormInput.
- Amount input. Validated client-side against available balance. Inline error if exceeds balance.
- Optional memo input.
- "Next" button navigates to Step 2.

**Step 2 — Confirm & Broadcast:**
- Summary: recipient, amount, memo, estimated fee.
- Fee estimated via `lcd.tx.create()` (transaction simulation).
- "Confirm" button broadcasts via `lcd.tx.broadcastSync()`.
- Polls `lcd.tx.txInfo(hash)` for confirmation (reuses existing polling pattern from `useConfirm.ts`).
- Shows success with tx hash (tappable, opens block explorer) or failure with error message.
- User can go back to Step 1 to retry on failure.

### Receive

Simple screen.

- Full wallet address displayed as text.
- QR code generated from the address.
- "Copy" button copies address to clipboard.

### History

Simple transaction list.

- Fetches from LCD: `/cosmos/tx/v1beta1/txs?events=message.sender='{address}'&order_by=ORDER_BY_DESC&pagination.limit=20`
- Each row: date, message type (e.g. `MsgSend`, `MsgDelegate`), success/fail badge, truncated tx hash.
- Tap opens `https://finder.terra.money/{chainID}/tx/{hash}` in system browser.
- Pull-to-refresh.
- "Load more" button for pagination.

## Reused Existing Code

- **Components:** Card, Text, Button, FormInput, FormLabel, Icon, Header, Body, Loading, Error
- **Styling:** COLOR constants (primary._02 sapphire, white, sky, red), Gotham font family via Text `fontType` prop, LAYOUT utilities
- **Data:** `useLCD()` hook, react-query, `getWallets()` / wallet utils, `AccAddress.validate()`
- **State:** Recoil for app-level state, `useConfig()` for chain config, `useAuth()` for wallet state
- **Patterns:** KeyboardAvoidingView for forms, ScrollView with RefreshControl for pull-to-refresh

## Error Handling

- **Network errors:** react-query handles retries. Failed queries show the existing Error component with retry.
- **Empty balance:** Show "0 LUNA" normally. Send button stays enabled — LCD simulation will reject insufficient funds.
- **No history:** Show "No transactions yet" placeholder text.
- **Invalid send address:** Inline error on FormInput via `AccAddress.validate()`.
- **Amount exceeds balance:** Inline error on FormInput, checked client-side.
- **Broadcast failure:** Show LCD error message on confirm screen. User can go back and retry.
- **Fee estimation failure:** Show error on confirm screen with back option.

## WebView Removal

- Remove `<WebViewContainer>` from the render tree in `App/index.tsx`.
- Keep `WebViewContainer.tsx` file (don't delete) — message-passing patterns may be useful later.
- Remove `<UnderMaintenance>` component render (was WebView-related).
- The JSON parse error ("Unexpected character: a") from the WebView's `onMessage` handler goes away automatically.

## Out of Scope

- Wallet switching (multi-wallet support)
- Staking, governance, contracts, NFTs
- Multi-token support in send flow (only LUNA)
- Parsed/human-readable tx history descriptions
- Settings screen
- Tab-based navigation (can restructure later when more features warrant it)
