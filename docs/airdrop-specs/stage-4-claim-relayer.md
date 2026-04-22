# Stage 4 — Claim Relayer

## What this stage does

Day 28+. User taps "claim my VULT" in the agent. We pay the gas (the user has no ETH), submit the on-chain claim transaction, watch it confirm, and surface the result back to the user via `/airdrop/status`.

Two invariants must hold:

1. **At most one on-chain claim per user, ever.** Network retries, double-taps, races between threads, restarts mid-submit — none of these can result in two on-chain txs for the same vault.
2. **No claim is forgotten across service restarts.** If we crash after broadcasting but before recording confirmation, the next process must pick up where we left off.

This is the only stage that touches mainnet. It's also where the operator interface lives — a basic HTML dashboard for monitoring relayer health and triggering manual rebroadcasts on stuck transactions.

---

## The Day 28+ claim flow

1. User taps "claim" in the agent. App POSTs `/airdrop/claim` with their JWT.
2. Backend validates window, kill switch, eligibility, and "not already claimed."
3. Backend takes a serializing lock on the relayer state singleton, fetches the next nonce, builds + signs + broadcasts the claim tx via the EVM RPC, inserts the `claim_submissions` row, increments the nonce, commits.
4. Backend returns `{tx_hash, status: 'submitted', nonce}` — sub-second response.
5. Background monitor goroutine polls submitted-but-unconfirmed rows every N seconds, asks the RPC for receipts, updates each row to `confirmed` or `failed` as receipts come in.
6. User polls `/airdrop/status`, sees `already_claimed: true` once their tx is `confirmed`.

Concurrency model: claim handlers serialize through `SELECT FOR UPDATE` on the relayer state singleton. ~700 claims × ~1 sec per claim = ~12 min total processing if every winner claims at once. Confirmation runs in parallel in the background, so user-visible latency is just the submission window.

---

## Auth model

| Surface | Auth |
|---|---|
| `POST /airdrop/claim` | JWT (existing middleware) |
| `GET /internal/relayer/*` | `X-Internal-Token` header (same secret as quest endpoints) |
| `POST /internal/relayer/rebroadcast` | `X-Internal-Token` |
| `GET /ops/*`, `POST /ops/*` | HTTP Basic Auth via `OPS_USERNAME` + `OPS_PASSWORD` env vars |

---

## Endpoints

### `POST /airdrop/claim`

**Purpose:** initiate the on-chain VULT claim for the user identified by the JWT.

**Request:**
```http
POST /airdrop/claim
Authorization: Bearer <jwt>
```

Empty body. Public key from JWT, recipient + amount + proof from `agent_raffle_proofs` lookup.

**Response — 200 (fresh submission):**
```json
{
  "tx_hash": "0x...",
  "status": "submitted",
  "nonce": 42,
  "submitted_at": "2026-05-15T18:00:00Z"
}
```

**Response — 200 (already submitted, idempotent retry):**
```json
{
  "tx_hash": "0x...",
  "status": "submitted" | "confirmed",
  "nonce": 42,
  "submitted_at": "2026-05-15T18:00:00Z",
  "confirmed_at": "2026-05-15T18:01:23Z"     // only if confirmed
}
```

**Errors:**

| Status | Body | When |
|---|---|---|
| 401 | (handled by middleware) | Missing or invalid JWT |
| 403 | `{"error":"NOT_CLAIM_ELIGIBLE"}` | User isn't a raffle winner OR hasn't completed ≥ QUEST_THRESHOLD quests |
| 403 | `{"error":"CLAIM_WINDOW_NOT_OPEN"}` | `now() < CLAIM_WINDOW_OPEN_AT` |
| 403 | `{"error":"CLAIM_DISABLED"}` | `CLAIM_ENABLED == false` (operator kill switch) |
| 503 | `{"error":"RPC_UNAVAILABLE"}` | EVM RPC didn't respond or returned a non-revert error |
| 503 | `{"error":"KMS_UNAVAILABLE"}` | KMS Sign API failed (relayer wallet signing) |
| 500 | `{"error":"BROADCAST_REJECTED","detail":"..."}` | RPC accepted the tx but returned a logical error (e.g. nonce already used, insufficient funds) — relayer state may need ops attention |

503 errors are transient — client retries.

**Behavior:**

1. Verify JWT → `public_key`.
2. Reject if `now() < CLAIM_WINDOW_OPEN_AT`.
3. Reject if `CLAIM_ENABLED == false`.
4. Compute eligibility (`raffle won AND quests_completed >= QUEST_THRESHOLD`). Reject 403 if not.
5. `BEGIN` Postgres transaction.
6. `SELECT ... FROM agent_relayer_state WHERE id = 1 FOR UPDATE` — serializes all claim handlers.
7. `SELECT * FROM agent_claim_submissions WHERE public_key = ? AND status IN ('submitted', 'confirmed')`. If a row exists, COMMIT and return it (idempotent retry).
8. `next_nonce = relayer_state.next_nonce`.
9. Fetch `(recipient, amount, proof)` from `agent_raffle_proofs WHERE public_key = ?`.
10. Query EVM RPC for current gas estimates: `eth_maxPriorityFeePerGas` for tip, latest block's `baseFeePerGas` for the base. `maxFeePerGas = 2 * baseFee + tip` (standard padded formula).
11. Build the calldata for `AirdropClaim.claim(merkleProof[], amount, recipient)`. Exact ABI from `mergecontract`.
12. Build EIP-1559 tx with `next_nonce`, gas params from step 10, calldata, chain ID from `EVM_CHAIN_ID`.
13. Sign the tx via AWS KMS `Sign` with `KMS_RELAYER_KEY_ARN`. Convert returned DER signature to EVM `(r, s, v)` and assemble the signed tx bytes.
14. Broadcast via RPC (`eth_sendRawTransaction`).
15. INSERT `agent_claim_submissions` row with `nonce, recipient, amount, tx_hash, status='submitted', submitted_at=NOW(), max_fee_gwei, max_priority_fee_gwei`.
16. UPDATE `agent_relayer_state SET next_nonce = next_nonce + 1`.
17. COMMIT.
18. Return `{tx_hash, status, nonce, submitted_at}`.

If any of steps 9–14 fail, ROLLBACK. The state row's `next_nonce` is unchanged, no `claim_submissions` row is inserted, and the user can retry. The client receives the appropriate 5xx error.

The eligibility check in step 4 calls the shared `eligibility.go` helper from Stage 3 (in-process Go function call, not an HTTP roundtrip — eligibility is a pure DB read with no signing or external calls, so the API-endpoint pattern doesn't apply).

### `GET /internal/relayer/balance`

**Purpose:** ops health check + alert source.

**Request:** `X-Internal-Token: <secret>`.

**Response — 200:**
```json
{
  "relayer_address": "0x...",
  "eth_balance_wei": "5000000000000000000",
  "eth_balance_human": "5.000",
  "vult_contract_balance_wei": "1417500000000000000000000",
  "vult_contract_balance_human": "1417500.000",
  "low_balance_warning": false,
  "low_balance_threshold_eth": "0.5",
  "estimated_claims_remaining": 1234,
  "next_nonce": 42,
  "rpc_block_height": 19400000
}
```

`estimated_claims_remaining = floor(eth_balance / (avg_gas_per_claim * current_gas_price))`. Read live from RPC.

`low_balance_warning = true` when `eth_balance < LOW_BALANCE_THRESHOLD_ETH` (env, default 0.5 ETH).

### `GET /internal/relayer/stuck-claims`

**Purpose:** list submitted-but-unconfirmed claims older than a configurable threshold so ops can decide whether to rebroadcast.

**Request:** `X-Internal-Token: <secret>`. Optional query param `?older_than_minutes=N` (default 10).

**Response — 200:**
```json
{
  "stuck_claims": [
    {
      "public_key": "...",
      "tx_hash": "0x...",
      "nonce": 17,
      "submitted_at": "2026-05-15T17:00:00Z",
      "minutes_pending": 23,
      "max_fee_gwei": 50,
      "max_priority_fee_gwei": 2,
      "previous_tx_hashes": ["0x...prior...", "..."]
    },
    ...
  ],
  "count": 5
}
```

Sorted by `minutes_pending` descending. Empty array (count: 0) is the healthy state.

### `POST /internal/relayer/rebroadcast`

**Purpose:** ops manually re-submits a stuck claim with bumped gas.

**Request:**
```http
POST /internal/relayer/rebroadcast
X-Internal-Token: <secret>
Content-Type: application/json

{ "public_key": "...", "bump_gwei": 50 }
```

`bump_gwei` is added to both `maxPriorityFeePerGas` and `maxFeePerGas` of the previous attempt. Default 50 if omitted.

**Response — 200:**
```json
{
  "new_tx_hash": "0x...",
  "previous_tx_hash": "0x...",
  "new_max_fee_gwei": 100,
  "new_max_priority_fee_gwei": 52,
  "nonce": 17
}
```

**Errors:**

| Status | Body | When |
|---|---|---|
| 401 | `{"error":"UNAUTHORIZED"}` | Missing/wrong `X-Internal-Token` |
| 404 | `{"error":"CLAIM_NOT_FOUND"}` | No `claim_submissions` row for `public_key` |
| 400 | `{"error":"CLAIM_NOT_STUCK","status":"confirmed"}` | The claim has already confirmed — no rebroadcast needed |
| 503 | `{"error":"RPC_UNAVAILABLE"}` | RPC failed |

**Behavior:** read existing row, sign new EIP-1559 tx with **same nonce** + bumped fees, broadcast, append previous `tx_hash` to a `previous_tx_hashes` array column, update `tx_hash` + gas fields. The old tx and new tx race in the mempool — whichever lands first wins, both share the same nonce so only one can confirm.

---

## Operator interface

Server-rendered HTML pages using Go's `html/template`. No JS build, no client-side framework. Lives in the same binary, behind HTTP Basic Auth.

| Path | Page |
|---|---|
| `GET /ops` | Landing page. Links to balance, stuck-claims. Shows last-refreshed time. |
| `GET /ops/balance` | Renders the JSON output of `/internal/relayer/balance` as a styled table. Auto-refreshes every 30s via `<meta http-equiv="refresh">`. Big red banner if `low_balance_warning`. |
| `GET /ops/stuck-claims` | Table of `/internal/relayer/stuck-claims` output. Each row has a "Rebroadcast (+50 gwei)" button. |
| `POST /ops/rebroadcast` | Form handler. Submits `{public_key, bump_gwei}` to the internal endpoint. Renders a success/error page with the new tx hash + Etherscan link. |

The ops pages call the `/internal/*` endpoints in-process (with the same `X-Internal-Token` from config). No new business logic — UI is a thin layer over the internal API.

Templates in `internal/api/ops/templates/`. CSS inlined into `<style>` blocks (no separate static asset pipeline). One Go file per route.

---

## Background workers

### Confirmation monitor

A single goroutine started at service boot. Loop:

1. `SELECT * FROM agent_claim_submissions WHERE status = 'submitted' ORDER BY submitted_at LIMIT 100`.
2. For each row, call `eth_getTransactionReceipt(tx_hash)` via the RPC.
3. If receipt present and `status = 1` (success) and `blockNumber` is at least `latestBlock - CONFIRMATION_BLOCKS` (default 1, set higher for paranoid safety) blocks back: UPDATE row to `status='confirmed', confirmed_at=NOW(), block_number=...`.
4. If receipt present and `status = 0` (revert): UPDATE to `status='failed', failed_at=NOW(), failure_reason='reverted'`. (Operator inspects via Etherscan.)
5. If no receipt: skip — try again next tick.
6. Sleep `CONFIRMATION_POLL_INTERVAL_SECONDS` (default 15).

On startup, the monitor immediately runs once to pick up any rows still in `submitted` from before a restart — guarantees no claim is forgotten.

Lives in `cmd/scheduler/` alongside the existing `agent_scheduled_tasks` poller (reuses the existing scheduler binary; no new process).

---

## Schema

```sql
CREATE TYPE airdrop_claim_status AS ENUM ('submitted', 'confirmed', 'failed');

CREATE TABLE agent_claim_submissions (
    public_key            TEXT                   NOT NULL,
    nonce                 BIGINT                 NOT NULL UNIQUE,                 -- one nonce, one row, ever
    recipient             TEXT                   NOT NULL,
    amount                NUMERIC(78, 0)         NOT NULL,
    tx_hash               TEXT                   NOT NULL,
    previous_tx_hashes    TEXT[]                 NOT NULL DEFAULT '{}',           -- preserved when rebroadcast
    status                airdrop_claim_status   NOT NULL,
    max_fee_gwei          INTEGER                NOT NULL,
    max_priority_fee_gwei INTEGER                NOT NULL,
    block_number          BIGINT,                                                 -- non-null once confirmed
    failure_reason        TEXT,                                                   -- non-null when status='failed'
    submitted_at          TIMESTAMPTZ            NOT NULL,
    confirmed_at          TIMESTAMPTZ,
    failed_at             TIMESTAMPTZ
);

-- "at most one in-flight or completed claim per user"
CREATE UNIQUE INDEX idx_claim_submissions_one_per_user
  ON agent_claim_submissions (public_key)
  WHERE status IN ('submitted', 'confirmed');

-- Confirmation monitor scan
CREATE INDEX idx_claim_submissions_pending
  ON agent_claim_submissions (submitted_at)
  WHERE status = 'submitted';

-- Relayer wallet nonce + general state
CREATE TABLE agent_relayer_state (
    id           INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),                       -- singleton
    next_nonce   BIGINT          NOT NULL,                                       -- starts at the on-chain value at deploy time
    last_synced  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

INSERT INTO agent_relayer_state (id, next_nonce) VALUES (1, 0);                  -- ops sets to actual on-chain nonce before going live
```

`previous_tx_hashes` preserves the audit trail across rebroadcasts. `nonce UNIQUE` is the database-level guard against accidental nonce reuse (anywhere — across all users). The partial unique index on `(public_key)` enforces the "one claim per user" invariant. The `(submitted_at) WHERE status='submitted'` partial index makes the monitor's scan O(unconfirmed) rather than O(all_claims).

---

## Configuration

| Var | Type | Notes |
|---|---|---|
| `KMS_RELAYER_KEY_ARN` | AWS ARN | KMS key signing claim txs (the relayer wallet). Stage 0 procurement. **Single KMS key for the whole airdrop** — no separate quest oracle key. |
| `EVM_RPC_URL` | URL | Ethereum mainnet RPC. Free public endpoint (PublicNode, llamarpc) is acceptable per the eng-side decision. |
| `EVM_CHAIN_ID` | int | 1 for mainnet. |
| `AIRDROP_CLAIM_CONTRACT_ADDRESS` | 0x-address | Same value as Stage 3's `verifyingContract`. |
| `CLAIM_WINDOW_OPEN_AT` | RFC3339 timestamp | Day 28 wall clock; before this, `/airdrop/claim` returns 403. |
| `CLAIM_ENABLED` | bool, default true | Operator kill switch. Read on every request — hot-reload by env-var change + service signal, or a redeploy. |
| `LOW_BALANCE_THRESHOLD_ETH` | decimal, default 0.5 | Triggers `low_balance_warning: true` in `/internal/relayer/balance`. |
| `CONFIRMATION_BLOCKS` | int, default 1 | Required reorg depth before marking a tx `confirmed`. |
| `CONFIRMATION_POLL_INTERVAL_SECONDS` | int, default 15 | How often the monitor checks for receipts. |
| `OPS_USERNAME` / `OPS_PASSWORD` | strings | HTTP Basic Auth credentials for the operator UI. |
| `INTERNAL_API_KEY` | string secret | (Reused from Stage 3.) `X-Internal-Token` header value. |

Initial nonce setup at deploy time: ops queries `eth_getTransactionCount(relayer_address, 'pending')` from the same RPC and writes that value into `agent_relayer_state.next_nonce` via a `psql` UPDATE. Documented in the Day 28 runbook.

---

## Observability

Prometheus metrics:

| Metric | Type | Labels |
|---|---|---|
| `airdrop_claim_request_total` | Counter | `result` ∈ `{submitted, idempotent_retry, not_eligible, window_not_open, disabled, rpc_error, kms_error, broadcast_rejected}` |
| `airdrop_claim_submit_duration_seconds` | Histogram | (handler latency end-to-end) |
| `airdrop_claim_kms_sign_duration_seconds` | Histogram | (KMS Sign call only) |
| `airdrop_claim_broadcast_duration_seconds` | Histogram | (`eth_sendRawTransaction` only) |
| `airdrop_claim_confirmation_total` | Counter | `result` ∈ `{confirmed, reverted, monitor_skipped}` |
| `airdrop_claim_confirmation_lag_seconds` | Histogram | (time from `submitted_at` to `confirmed_at`) |
| `airdrop_relayer_eth_balance_wei` | Gauge | (refreshed by the monitor on each pass) |
| `airdrop_relayer_next_nonce` | Gauge | |
| `airdrop_relayer_rebroadcast_total` | Counter | |

Structured logs include: `public_key` (first 8 chars), `nonce`, `tx_hash`, `request_id`, `result`. KMS errors and broadcast errors carry the underlying error message.

A Prometheus alert on `airdrop_relayer_eth_balance_wei < 0.5e18` pages ops.

---

## Tests

**Unit:**
- Claim eligibility: every combination of (winner / not winner) × (quests met / not met) × (already claimed / not).
- Window enforcement: before, exactly at, after `CLAIM_WINDOW_OPEN_AT`.
- Kill switch: `CLAIM_ENABLED=false` returns `403 CLAIM_DISABLED`.
- Idempotency: two concurrent calls (simulated via mock `FOR UPDATE` serialization) — one inserts, the other returns the inserted row's `tx_hash`.
- Rebroadcast: existing row is updated, `previous_tx_hashes` is appended, nonce unchanged.
- KMS DER → EVM signature: golden test against a known-good signature.

**Integration (real Postgres + LocalStack KMS + Anvil mainnet fork):**
- Full path: synthetic raffle-proofs row → quest fixtures making user eligible → POST /airdrop/claim → tx confirms on Anvil → confirmation monitor flips status → next status request shows `already_claimed: true`.
- Restart-safety: kill the service after the broadcast UPDATE but before… (well, the broadcast and UPDATE are in one txn, so there's no in-between state). Test instead: kill the service immediately after broadcast (one tx in `submitted` state in DB), restart, observe monitor pick up the submitted row on its first tick and confirm against Anvil.
- Concurrency: 50 concurrent /airdrop/claim calls for 50 distinct eligible users → 50 distinct nonces, 50 distinct tx hashes, no DB constraint violations, all submitted within ~50 seconds.
- Concurrency: 50 concurrent /airdrop/claim calls for the same user → exactly one tx submitted, 49 idempotent-retry responses with the same tx_hash.
- Stuck-tx flow: tx broadcast at low gas → never confirms → `/internal/relayer/stuck-claims` lists it → `POST /internal/relayer/rebroadcast` with bump → new tx confirms → original is dropped (same nonce).
- Balance endpoint returns expected values; low-balance threshold flips the warning.

**End-to-end (with `mergecontract`):**
- Drawn root submitted to Foundry-deployed `AirdropClaim.sol` → KMS-signed attestation issued by Stage 3 → claim submitted by Stage 4's relayer against the same contract → contract pays VULT to recipient.

---

## Files

```
cmd/scheduler/
└── main.go    (edit) — add the confirmation monitor goroutine alongside the existing agent_scheduled_tasks loop

internal/api/airdrop/
└── claim.go              POST /airdrop/claim handler

internal/api/relayer/
├── balance.go            GET /internal/relayer/balance
├── stuck_claims.go       GET /internal/relayer/stuck-claims
└── rebroadcast.go        POST /internal/relayer/rebroadcast

internal/api/ops/
├── handler.go            Routing + Basic Auth middleware
├── templates/
│   ├── layout.html
│   ├── balance.html
│   ├── stuck_claims.html
│   └── rebroadcast_result.html
└── ops.go                One file per page wiring data → template

internal/service/airdrop/relayer/
├── claim.go              Top-level claim flow (validation → tx build → broadcast → DB)
├── eligibility.go        (shared with Stage 3 — could live in a common subdir)
├── nonce.go              SELECT FOR UPDATE singleton, increment, etc.
├── kms_signer.go         AWS KMS Sign + DER → EVM (r,s,v) (could share with Stage 3's quest signer)
├── ethclient.go          go-ethereum/ethclient wrapper; gas estimation; tx building; broadcast
├── monitor.go            Background confirmation poller
└── rebroadcast.go        Manual rebroadcast logic shared by /internal/ and /ops/

internal/storage/postgres/
├── migrations/XXXXXXXXXXXXXX_create_agent_claim_submissions.sql
├── migrations/XXXXXXXXXXXXXX_create_agent_relayer_state.sql
└── sqlc/airdrop_claims.sql

docs/runbooks/
├── relayer-day-28.md            "How to bring up the relayer on Day 28"
└── relayer-stuck-tx.md          "What to do when /ops/stuck-claims has rows"
```

---

## Open dependencies

- **Stage 0 — `KMS_RELAYER_KEY_ARN` provisioned, relayer wallet funded with ETH.** Without ETH at the relayer address, every claim 503s.
- **Stage 0 — `AIRDROP_CLAIM_CONTRACT_ADDRESS` known.** From the contract mission's mainnet deploy.
- **Stage 0 — `CLAIM_WINDOW_OPEN_AT` decision locked.**
- **Stage 0 — VULT prize pool funded into `AirdropClaim.sol`.** Without VULT in the contract, claims revert.
- **`mergecontract` — `AirdropClaim.sol` deployed to mainnet** with the claim function ABI matching what we encode in step 12 of the claim flow.
- **Stage 2 — `agent_raffle_proofs` populated.** Pre-condition for the claim handler's proof lookup.
- **Stage 3 — `eligibility.go` shared helper available.** Called inline from the claim handler.
- **EVM RPC chosen** — free public endpoint is acceptable per eng-lead decision.
- **Initial nonce sync** — operator runs the documented `psql` UPDATE on Day 28 before enabling the endpoint.

---

## Done when

- `/airdrop/claim` returns documented shapes against documented status codes.
- DB unique partial index enforces "one claim per user" — concurrency test passes (50 concurrent same-user requests yield exactly one tx).
- 50 concurrent distinct-user requests submit all 50 in ~serialised order, all with distinct nonces.
- Confirmation monitor flips `submitted` → `confirmed` against Anvil within seconds of the receipt landing.
- Restart test: kill mid-pipeline, restart, observe monitor pick up unfinished work.
- Rebroadcast endpoint succeeds with bumped gas; original tx is replaced by the new one.
- `/internal/relayer/balance` returns sane values; low-balance flag flips at the configured threshold.
- `/internal/relayer/stuck-claims` lists pending-too-long rows; empty when none.
- `/ops` UI is reachable behind Basic Auth and renders the three pages correctly.
- E2E test against Foundry-deployed `AirdropClaim.sol` passes start-to-finish: register → win raffle → complete quests → claim → VULT received at recipient.
- Day 28 runbook drafted (`docs/runbooks/relayer-day-28.md`) covering: deploy steps, initial nonce sync, smoke test, kill switch flip-on.
- Stuck-tx runbook drafted covering: how to read `/ops/stuck-claims`, decide bump amount, handle "still stuck after rebroadcast" case (probably a free RPC throttling issue → switch RPC URL or pay for one).
