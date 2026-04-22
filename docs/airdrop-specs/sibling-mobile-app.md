# Sibling Spec — Mobile App (Vultiverse Airdrop UX)

## What this spec covers

The mobile app (currently `station-mobile`, becoming `vultiagent-app` post-rebrand) changes needed to deliver the Vultiverse Airdrop user experience. **Owned by the mobile engineer, not the backend team.** Documented here so the backend ↔ app contract is shared and either side can review.

The same mental model as the backend specs: plain-English context up top, concrete tasks below, explicit interface contracts where the app talks to the backend.

---

## What's already shipped

A lot of the rebrand and migration work has already landed (PRs #38–#63 in `StationWallet/station-mobile`). The relevant pieces:

- **RiveIntro screen** (PR #63) — the Vultiverse-themed Rive animation with the swipe-up-to-board gesture and the chevron hint.
- **Migration flow** (PRs #38, #41, #42, #44, #45, #51, #52, #54) — Station → Fast Vault import via seed phrase or vault share. Lands the user with a working Fast Vault.
- **Waiting screen** (PR #62) — the post-import "you're aboard" placeholder, currently with generic "increase your chance for rewards" copy.
- **Auth menu + bottom-sheet** (PR #54) — Add Wallet flows.

What still needs to be built is the wiring between those screens and the airdrop backend.

---

## User flows the app must support

### Flow 1 — Boarding (Days 8–12)

1. User launches the app for the first time after the Day 8 update (or installs fresh).
2. RiveIntro plays, user swipes up.
3. AuthMenu offers: Import Seed Phrase / Import Vault Share / Create New Vault.
4. User picks a path. Existing migration / vault-creation UI runs through to a working Fast Vault.
5. **App computes the user's EVM address** from the new Fast Vault locally — see [EVM address derivation](#evm-address-derivation) below.
6. App acquires a JWT via the existing `POST /auth/token` flow (vault sig → 24h JWT).
7. App calls `POST /airdrop/register` with `{ source: "seed" | "vault_share", recipient_address }`.
8. App stores the response (`registered_at`, `recipient_address`, `source`).
9. App transitions to the waiting screen.

### Flow 2 — Pending (Days 8–28+)

The waiting screen is a state machine driven by `GET /airdrop/status`.

App polls the endpoint while the screen is active (suggested cadence: every 30s) and renders one of these states:

| `raffle_state` | Quest fields | What the app shows |
|---|---|---|
| `pending` | n/a | "Boarding open. Window closes in HH:MM." Countdown timer driven by `window_closes_at` from `/airdrop/stats`. |
| `awaiting_draw` | n/a | "Boarding closed. Drawing winners — back soon." |
| `lost` | n/a | Consolation copy: "No win this time. Try the agent — it's open to everyone." |
| `won`, `quests_completed < 3`, `claim_eligible: false` | per-quest state map | "You won! Complete 3 of 5 quests to claim." Renders the 5 quest tiles, each marked completed/pending. |
| `won`, `claim_eligible: true`, `already_claimed: false` | n/a | "You're cleared to claim." Shows a prominent **Claim my VULT** button. |
| `won`, `already_claimed: true` | n/a | "VULT received." Etherscan link if the app has the tx_hash from the prior claim response. |

Not registered (`registered: false`) — show the same boarding entry CTA as a fresh user.

### Flow 3 — Quest earning (Days 13–27)

The user just uses VultiAgent normally. They chat with the agent, build swap/bridge/DeFi-action transactions, sign and broadcast each via the existing tool-call UX.

**The app's only specific responsibility here is what it already does:** call `POST /conversations/{id}/tool-result` after a tool-built transaction is signed and broadcast. The backend's quest-tracking layer (Stage 3) hooks off that existing notification — no new API call from the app for quests.

The waiting screen, when active, polls `/airdrop/status` and re-renders the quest tile map as quests tick over.

### Flow 4 — Claim (Day 28+)

1. User taps **Claim my VULT** on the waiting screen.
2. App POSTs `/airdrop/claim` (JWT only, no body).
3. App receives `{ tx_hash, status: 'submitted', nonce, submitted_at }`.
4. App switches the waiting screen to "Claim submitted." Renders the tx_hash with an Etherscan link. Optionally shows a spinner / "this usually takes 30–60 seconds."
5. App keeps polling `/airdrop/status`. Once the response shows `already_claimed: true`, switch to the "VULT received" state.

If the POST returns 503 (RPC or KMS transient failure) — show a "couldn't submit, try again" toast and let the user re-tap. Idempotency at the backend means a second tap that races a successful first tap will return the same tx_hash.

If the POST returns 403 with `CLAIM_DISABLED` — show "claims temporarily paused, please check back" and stop polling for a few minutes (operator kill switch is on).

---

## EVM address derivation

The backend never derives EVM addresses. **The app does.** This is load-bearing: every winner's prize is paid to the address the app sends at registration time, and that address is committed to a Merkle tree on Day 12 — wrong address = wrong recipient = user can't recover their VULT.

### Standard case (most users)

The Fast Vault has an ECDSA public key. EVM address is the standard Ethereum derivation:

1. Take the uncompressed ECDSA public key (64 bytes — strip the `0x04` prefix if present).
2. Compute `keccak256` of those 64 bytes.
3. Take the last 20 bytes.
4. Format with `0x` prefix → that's the EVM address.

The Vultisig SDK / wallet-core / mpc-native package the app already uses for Ethereum operations exposes this derivation directly — use the existing helper, do not hand-roll.

### Legacy Terra-only case

A subset of legacy Station Wallet vaults are **Terra-only** — the original Station Wallet only exposed Terra keys, and even after migration to a Fast Vault, the resulting vault structure may not have a usable ECDSA key from which an EVM address can be derived.

For these vaults the app must:

1. Detect the Terra-only condition during the post-migration `recipient_address` computation step. Concretely: attempt the ECDSA derivation; if no usable key is available, fall through to the prompt path.
2. Show a UI prompting the user for an EVM address: "Where would you like to receive your VULT? Paste an Ethereum address." Include explainer copy (e.g. "this is because your vault was migrated from a Terra-only wallet").
3. Validate format client-side: must match `^0x[a-fA-F0-9]{40}$`.
4. Send that address as `recipient_address` in the `POST /airdrop/register` call.

The user can also opt to provide their own address in the standard case if the team decides to add an "edit recipient" UI — but the default flow uses the derived address with no extra friction for non-Terra-only users.

---

## API contract reference

For each endpoint, the canonical spec lives in the backend stage docs. The app implements the consumer side of these.

| Endpoint | Spec doc | Used in flow |
|---|---|---|
| `POST /auth/token` | (existing agent-backend) | All flows — bootstrap |
| `POST /airdrop/register` | `stage-1-boarding.md` | Flow 1 |
| `GET /airdrop/status` | `stage-1-boarding.md` | Flow 2, 3, 4 (polling) |
| `POST /airdrop/claim` | `stage-4-claim-relayer.md` | Flow 4 |
| `POST /conversations/{id}/tool-result` | (existing agent-backend) | Flow 3 — the app already calls this; no change |

`GET /airdrop/stats` is used by marketing / web, **not the app**.

---

## Polling cadence

| Screen | Polling target | Cadence |
|---|---|---|
| Waiting screen, `pending` state | `/airdrop/status` | Every 30s while screen is foreground |
| Waiting screen, `awaiting_draw` | `/airdrop/status` | Every 15s (more eager — waiting for the result) |
| Waiting screen, `won, claim_eligible: false` | `/airdrop/status` | Every 60s |
| Waiting screen, post-claim (`status: submitted`) | `/airdrop/status` | Every 10s until `already_claimed: true` or 5 min timeout |

All polling pauses when the screen is backgrounded. No background fetch.

---

## Error UX

The app must handle these error responses gracefully:

| Backend response | App UX |
|---|---|
| 401 (JWT expired) | Re-acquire JWT via `/auth/token` and retry the failing call once. Surface only on second failure. |
| 403 `WINDOW_NOT_OPEN` (register) | "Boarding hasn't opened yet. Try again on Day 8." |
| 403 `WINDOW_CLOSED` (register) | "Boarding has closed. The agent is open to everyone — explore!" |
| 403 `NOT_CLAIM_ELIGIBLE` (claim) | Should never happen if the app reads `claim_eligible: true` first. Treat as a stale-state bug; refresh status. |
| 403 `CLAIM_WINDOW_NOT_OPEN` (claim) | "Claiming opens on [Day 28]." Show countdown. |
| 403 `CLAIM_DISABLED` (claim) | "Claims temporarily paused. Check back soon." |
| 503 (claim) | "Network issue, try again in a moment." |
| 5xx generic | Retry once with backoff, then show generic "something went wrong" with a "report" affordance. |

---

## What the app does NOT do

To make the contract clear:

- **Does not** sign claim transactions. The relayer signs them with its own KMS key.
- **Does not** know about the Merkle proof, the contract address, or any Ethereum chain interaction beyond receiving an `etherscan.io/tx/<hash>` URL to display.
- **Does not** track quest events itself. Tool-result reporting (already a thing) is the only signal.
- **Does not** verify the user is eligible — backend does. App reads `claim_eligible` from `/airdrop/status` and uses it as a UI gate only.
- **Does not** know the random seed used for the raffle, the slot count, the VULT amount, or the merkle root — these are backend / contract concerns. App reads outcomes only.

---

## Open dependencies

- Backend Stage 1 endpoints live in staging (Day 8 deadline).
- Designs / Figma frames for each waiting-screen state.
- Final copy for each state.
- Mobile engineer assigned.

---

## Done when

- Each user flow above has UI implementation.
- EVM address derivation works correctly for standard vaults (golden test against a known seed).
- Terra-only prompt UX implemented and tested by deliberately simulating a Terra-only vault.
- All seven `raffle_state` × quest-state × claim-state combinations render correctly.
- Polling pauses on background; resumes on foreground.
- Error UX matches the table above.
- Manual QA against backend staging covering: register → status pending → status awaiting_draw → status won → quest tile updates → claim → status confirmed.
