# Shared Concerns — Cross-Cutting Infrastructure

## What this doc covers

Things that don't belong to any single stage but get used across multiple. Implementing these once, in shared packages, prevents the "Stage 4 reimplements Stage 3's KMS signer" pattern.

**Read this before starting code on any stage.** It's the canonical reference for the env-var inventory, the auth model, the schema overview, and the order in which to lay things down.

If you're picking up a stage and find yourself building something that "feels generic" — check here first. If it's not in this doc and seems like it should be, add it before duplicating code.

---

## Implementation order

A single engineer can ship the whole pipeline in roughly this sequence. Stages have hard external deadlines (Day 8, 12, 13, 28); shared infra has none, so it slots in wherever attention is available.

1. **This doc + the shared infra it scopes** (auth middleware, env-var loader, KMS signer, EVM client). Roughly a day's work; no external dependencies.
2. **Stage 1 — Boarding.** Hard deadline Day 8. Must be live in staging first.
3. **Stage 2 — Raffle Draw CLI.** Doesn't deploy as a service; can be developed in parallel with Stage 3 once Stage 1 is in staging. One subcommand (`draw`) plus `load-winners` and `verify-onchain` helpers.
4. **Stage 3 — Quest Tracking.** Needs the runtime hook into the existing `tool-result` handler — coordinate with the agent codebase's review cycle.
5. **Stage 4 — Claim Relayer.** Depends on Stage 2's `agent_raffle_winners` table existing and on Stage 3's `eligibility.go` helper.

Sibling missions run in parallel:
- **Mobile app** (`sibling-mobile-app.md`) needs the Stage 1 endpoints in staging by Day 8 to wire up boarding.
- **On-chain contract** (`sibling-on-chain-contract.md`) needs to be deployed before the Day 12 raffle, and the multisig must finish the batched `setWinners(...)` calls before Day 28. Stage 2's `verify-onchain` subcommand is the gate confirming the on-chain mapping matches `winners.csv`.

---

## Auth model — three surfaces

Three distinct auth mechanisms, each owning a clear path prefix:

| Surface | Auth | Used by | Implemented in |
|---|---|---|---|
| `/airdrop/register`, `/airdrop/status`, `/airdrop/claim` | JWT (existing `/auth/token` flow — vault ECDSA sig → 24h JWT) | Mobile app | Existing `internal/api/middleware.go` — no changes needed |
| `/internal/quests/event`, `/internal/relayer/balance`, `/internal/relayer/stuck-claims` | `X-Internal-Token: <secret>` matching `INTERNAL_API_KEY` env var | Other parts of the same service binary (executor.go), curl by ops | New: `internal/api/middleware/internal_token.go` |
| `/ops/*` (HTML pages, including `POST /ops/rebroadcast`) | HTTP Basic Auth via `OPS_USERNAME` + `OPS_PASSWORD` env vars | Operator's browser, or curl-from-script | Inlined: 5-line stdlib check in the ops handler |
| `/airdrop/stats` | None (public) | Marketing | n/a |
| `/healthz` | None (existing) | Load balancer | Existing |

The internal-token middleware is tiny (~15 lines). Implement it once in the shared infra phase; every internal endpoint picks it up via route registration. Basic Auth is inlined in the ops handler — only one route group uses it, so no shared package warranted.

---

## Env var inventory

All 19 vars across the 5 stages, in one table. Locked values come from the Stage 0 decisions table; defaults are reasonable starting values for staging.

| Var | Stage | Type | Default | Notes |
|---|---|---|---|---|
| `TRANSITION_WINDOW_START` | 1 | RFC3339 | none | Boarding opens at this timestamp; 403 before |
| `TRANSITION_WINDOW_END` | 1 | RFC3339 | none | Boarding closes at this timestamp; 403 after |
| `INTERNAL_API_KEY` | 3, 4 | string secret | none | `X-Internal-Token` shared secret for `/internal/*` |
| `QUEST_ACTIVATION_TIMESTAMP` | 3 | RFC3339 | none | Day 13 wall clock; quest events before this rejected |
| `QUEST_THRESHOLD` | 3 | int | 3 | How many of 5 quests needed to be claim-eligible |
| `DEFI_ACTION_CONTRACT_ALLOWLIST` | 3 | comma-separated 0x-addresses | none | Allow-list for the `defi_action` quest |
| `SWAP_QUEST_MIN_USD` | 3 | int | 10 | Min USD value for a swap to count |
| `BRIDGE_QUEST_MIN_USD` | 3 | int | 10 | Min USD value for a bridge to count |
| `KMS_RELAYER_KEY_ARN` | 4 | AWS ARN | none | The single KMS key — signs claim txs |
| `EVM_RPC_URL` | 4 | URL | none | Ethereum mainnet RPC. Free public endpoint OK. |
| `EVM_CHAIN_ID` | 4 | int | 1 | 1 for mainnet |
| `AIRDROP_CLAIM_CONTRACT_ADDRESS` | 4 | 0x-address | none | Deployed `AirdropClaim.sol` address |
| `CLAIM_WINDOW_OPEN_AT` | 4 | RFC3339 | none | Day 28 wall clock; claims rejected before |
| `CLAIM_ENABLED` | 4 | bool | true | Operator kill switch; checked on every request |
| `LOW_BALANCE_THRESHOLD_ETH` | 4 | decimal | 0.5 | Triggers `low_balance_warning` in balance endpoint |
| `CONFIRMATION_BLOCKS` | 4 | int | 1 | Reorg depth before marking confirmed |
| `CONFIRMATION_POLL_INTERVAL_SECONDS` | 4 | int | 15 | How often the monitor checks receipts |
| `OPS_USERNAME` | 4 | string | none | Basic Auth user for `/ops/*` |
| `OPS_PASSWORD` | 4 | string secret | none | Basic Auth password |

Loaded via the existing `internal/config/config.go` with `envconfig` (or whatever the agent-backend uses today). Add fields to the existing struct rather than introducing a new config struct.

---

## Schema overview

Six new tables, one shared types prefix (`airdrop_*` for Postgres enums). All naming follows the existing `agent_*` convention.

| Table | Owning stage | Purpose | Key columns |
|---|---|---|---|
| `agent_airdrop_registrations` | 1 | One row per user who joined the raffle | `public_key` (PK), `source`, `recipient_address`, `registered_at` |
| `agent_raffle_winners` | 2 | One row per winner; populated by `load-winners` CLI. Mirrors the contract's on-chain `allowance` mapping for status display. | `public_key` (PK), `recipient`, `amount`, `loaded_at` |
| `agent_quest_events` | 3 | Append-only audit log of incoming quest events (counted + rejected) | `tool_call_id` (PK), `public_key`, `quest_id`, `tx_hash`, `status`, `payload`, `created_at` |
| `agent_user_quests` | 3 | Materialized "which quests has each user completed" | `(public_key, quest_id)` (PK), `completed_at` |
| `agent_claim_submissions` | 4 | One row per claim attempt; lifecycle from submitted → confirmed/failed | `nonce` (UNIQUE), `public_key`, `recipient`, `amount`, `tx_hash`, `previous_tx_hashes[]`, `status`, gas fields, timestamps |
| `agent_relayer_state` | 4 | Singleton holding the relayer's `next_nonce` counter | `id=1` (CHECK), `next_nonce`, `last_synced` |

Plus four Postgres enum types:
- `airdrop_registration_source` — `seed`, `vault_share`
- `airdrop_quest_id` — `swap`, `bridge`, `defi_action`, `alert`, `dca`
- `airdrop_quest_event_status` — `counted`, `rejected`
- `airdrop_claim_status` — `submitted`, `confirmed`, `failed`

No foreign keys between airdrop tables — the relationships are by `public_key` value only. This keeps each migration independent and avoids ordering games at deploy time.

### Migration ordering

Goose migration filenames need monotonically increasing timestamps. Create migrations in this order to match the implementation sequence:

1. `XXXXXXXXXXXXXX_create_agent_airdrop_registrations.sql`
2. `XXXXXXXXXXXXXX_create_agent_raffle_winners.sql`
3. `XXXXXXXXXXXXXX_create_agent_quest_events.sql`
4. `XXXXXXXXXXXXXX_create_agent_user_quests.sql`
5. `XXXXXXXXXXXXXX_create_agent_claim_submissions.sql`
6. `XXXXXXXXXXXXXX_create_agent_relayer_state.sql`

Each migration is a single `CREATE TABLE` (plus `CREATE TYPE` for enums where needed). No data migrations.

---

## Shared Go packages

Code that should live in one place even though multiple stages use it.

### `internal/api/middleware/internal_token.go`

```
func InternalTokenAuth(secret string) echo.MiddlewareFunc
```

Reads `X-Internal-Token` header, compares to `secret` (constant-time), 401 on mismatch. Used by Stage 3 (`/internal/quests/event`) and Stage 4 (`/internal/relayer/*`).

### `internal/service/airdrop/quests/eligibility.go`

```
func IsClaimEligible(ctx context.Context, db DB, publicKey string) (eligible bool, reason string, err error)
```

Computes the composite from `agent_raffle_winners`, `agent_user_quests`, and `agent_claim_submissions`. Returns a `reason` string for logging when eligible == false (`"not_a_winner"`, `"only_2_quests_complete"`, `"already_claimed"`, etc.). Called inline by Stage 1's status handler and Stage 4's claim handler — pure DB read, no HTTP boundary.

### `internal/service/airdrop/kms/signer.go`

```
type Signer interface {
    SignDigest(ctx context.Context, digest []byte) (signature []byte, err error)
    Address() common.Address
}

func NewKMSSigner(ctx context.Context, keyARN string) (Signer, error)
```

Wraps AWS KMS `Sign` API. Handles DER → EVM `(r, s, v)` conversion, recovers the EVM address from the public key. Used only by Stage 4's relayer (signing EIP-1559 txs). Lives in a shared package so any future signing need (e.g. if the contract team ever asks for a signed admin call) reuses it.

If you're new to the KMS-to-EVM dance, the canonical pattern: KMS returns DER-encoded ASN.1 signatures, EVM expects raw `(r, s, v)`. The `r` and `s` come from parsing the DER; `v` requires recovering the public key against the digest and picking the recovery byte that matches.

### `internal/service/airdrop/ethclient/client.go`

```
type Client interface {
    LatestBaseFee(ctx context.Context) (*big.Int, error)
    SuggestGasTipCap(ctx context.Context) (*big.Int, error)
    NonceAt(ctx context.Context, address common.Address, blockNumber *big.Int) (uint64, error)
    SendRawTransaction(ctx context.Context, signedTxBytes []byte) (txHash common.Hash, err error)
    GetTransactionReceipt(ctx context.Context, txHash common.Hash) (*types.Receipt, error)
    BalanceOf(ctx context.Context, token, account common.Address) (*big.Int, error)
    Balance(ctx context.Context, account common.Address) (*big.Int, error)
}

func NewClient(rpcURL string) (Client, error)
```

Thin wrapper over `go-ethereum/ethclient.Client` exposing only the methods the relayer actually needs. Centralized so retry policy, timeout, and any future RPC-rotation logic lives in one place rather than scattered through Stage 4.

---

## Cross-mission interfaces

Three artifacts cross repo boundaries. All need to be locked early to avoid late surprises.

### Backend ↔ `vultisig/mergecontract`

**Inbound:** compiled `AirdropClaim.sol` ABI, deployed mainnet address, local Foundry/Anvil deployment fixture for backend integration tests against a fork.

**Outbound:** the `winners.csv` artifact from Stage 2's `draw` CLI is what the multisig signer uses to construct the batched `setWinners(...)` calls. No off-chain merkle artifacts to share — the contract's `allowance` mapping is the on-chain source of truth.

**When to lock:** the contract ABI must be stable before Stage 4 starts encoding `claim(recipient)` calldata. No cross-language hashing concerns to resolve (Merkle was dropped 2026-04-23, removing what used to be deck Risk #1).

### Backend ↔ Mobile app

**Bidirectional:** the request/response shapes for `/airdrop/register`, `/airdrop/status`, `/airdrop/claim`. Source of truth is the backend stage docs; app team mocks against them.

**When to lock:** before Day 8 (Stage 1 ships). Spec is already in `stage-1-boarding.md` and `stage-4-claim-relayer.md`.

### Backend → Operator

The `winners.csv` artifact from Stage 2's `draw` subcommand, handed to the multisig signer for batched `setWinners(...)` calls. Standard CSV with header row: `public_key, recipient, amount, registered_at, source`. The multisig signer (or their tooling) splits this into ~100-row batches and constructs one `setWinners(addresses[], amounts[])` tx per batch.

---

## Observability conventions

Across all stages:

- **Logging.** Structured JSON via the existing `logrus` setup. Always include: `request_id`, `public_key` (first 8 chars only — privacy), the action verb, and `result`. Per-stage specs add fields specific to their domain (`tool_call_id`, `nonce`, `tx_hash`, etc.).
- **Metrics.** Prometheus, registered under the existing `internal/metrics/` registry. Naming convention `airdrop_<verb>_<unit>` (e.g. `airdrop_register_total`, `airdrop_claim_submit_duration_seconds`). Every endpoint gets a counter + a duration histogram.
- **Alerts.** One alert worth paging on: `airdrop_relayer_eth_balance_wei < 0.5e18`. Wire to whatever the team uses (PagerDuty, Slack, etc.). Other metrics are dashboard fodder, not page-worthy.
- **Tracing.** Use the existing tracing setup if there is one; otherwise nothing new to introduce.

---

## Things this doc explicitly does not cover

To keep scope clear:

- Per-stage business logic (covered by the stage docs).
- Database schema details (each `CREATE TABLE` lives in its stage spec; this doc only lists tables).
- Operational runbooks (Day 12 raffle runbook, Day 28 relayer bringup, oracle key rotation — all are stage-specific or have been removed). They live in `docs/runbooks/` once written.
- The contract source code or contract repo conventions (covered by `sibling-on-chain-contract.md`).
- The mobile app UI implementation (covered by `sibling-mobile-app.md`).
- Anything in the existing `agent-backend` codebase that doesn't change — the existing JWT middleware, the existing tool-result handler, the `cmd/server` entrypoint, etc.

---

## Done when

- The three shared Go packages above exist and have unit tests.
- The six migrations exist and apply cleanly on a fresh DB in order.
- The 19 env vars are loadable from the existing config struct without errors.
- Internal-token middleware rejects missing/wrong tokens with 401; accepts correct tokens.
- Basic Auth middleware returns the `WWW-Authenticate: Basic` challenge on missing creds.
- KMS signer can sign a no-op digest against a real (LocalStack) KMS key and the recovered EVM address matches.
- ETH client can read the latest base fee against a public mainnet RPC.

Once those tick, the per-stage work has the foundations it needs.
