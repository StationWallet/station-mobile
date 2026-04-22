# Stage 1 — Boarding

## What this stage does

When a user opens the app during the 5-day boarding window and imports their wallet, we record their entry and tell them they're in. We also expose a public counter so marketing can post live "X passengers aboard" updates.

That's it. No eligibility check (Terra Classic was dropped 2026-04-21). No tier assignment. No quest tracking (Stage 3). No raffle logic (Stage 2). One table, three endpoints.

**Hard deadline:** all three endpoints live in staging before Day 8.

---

## Auth model

All write/read endpoints scoped to a vault use the existing JWT auth: client first calls `POST /auth/token` with a vault ECDSA signature, gets a 24h JWT, then calls airdrop endpoints with `Authorization: Bearer <jwt>`. Public key is derived from the JWT claim — never sent in request bodies. The existing middleware in `agent-backend/internal/api/middleware.go` already handles validation.

`GET /airdrop/stats` is the one public endpoint — no auth.

---

## Endpoints

### `POST /airdrop/register`

**Purpose:** record this vault's entry into the raffle.

**Request:**
```http
POST /airdrop/register
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "source": "seed" | "vault_share",
  "recipient_address": "0x..."
}
```

`source` is the import flow the user came through: `seed` for "import a seed phrase into a Fast Vault," `vault_share` for "import an existing Vultisig vault share."

`recipient_address` is the EVM address VULT will be paid to if this entry wins. **Required.** The client computes it locally from the vault — for standard Vultisig vaults that means deriving the EVM address from the vault's ECDSA public key; for legacy Terra-only vaults (which can't derive one) the client prompts the user for an address. **The backend never derives, never inspects vault internals, never tries to detect Terra-only — it just stores what the client sends.** This keeps backend logic simple and puts the derivation in the place that already has the vault material.

**Response — 200 (new row OR existing row):**
```json
{
  "registered_at": "2026-04-25T12:34:56Z",
  "source": "seed",
  "recipient_address": "0x..."
}
```

The client can tell whether this was a fresh registration or a retry by inspecting `registered_at` (recent vs. old).

**Errors:**

| Status | Body | When |
|---|---|---|
| 401 | (handled by middleware) | Missing or invalid JWT |
| 400 | `{"error":"INVALID_SOURCE"}` | `source` missing, or value not in enum |
| 400 | `{"error":"INVALID_RECIPIENT_ADDRESS"}` | `recipient_address` missing, or doesn't match `^0x[a-fA-F0-9]{40}$` |
| 403 | `{"error":"WINDOW_NOT_OPEN"}` | `now() < TRANSITION_WINDOW_START` |
| 403 | `{"error":"WINDOW_CLOSED"}` | `now() >= TRANSITION_WINDOW_END` |

**Behavior:**

1. Validate body shape; reject with `400 INVALID_SOURCE` if `source` is missing or not in the enum.
2. Validate `recipient_address` against `^0x[a-fA-F0-9]{40}$` (no EIP-55 checksum required); reject with `400 INVALID_RECIPIENT_ADDRESS` if missing or malformed.
3. Check window: if `now()` is outside `[TRANSITION_WINDOW_START, TRANSITION_WINDOW_END)`, reject with the appropriate 403.
4. `INSERT ... ON CONFLICT (public_key) DO NOTHING RETURNING ...`, then `SELECT` to return the actual row. Existing row wins — both `source` and `recipient_address` are **immutable** after first registration. Re-registering with different values is a no-op (returns the original row); the analytics signal stays clean.
5. Return the row at 200.

### `GET /airdrop/status`

**Purpose:** drive the in-app pending screen.

**Request:**
```http
GET /airdrop/status
Authorization: Bearer <jwt>
```

**Response — 200, registered:**
```json
{
  "registered": true,
  "registered_at": "2026-04-25T12:34:56Z",
  "source": "seed",
  "recipient_address": "0x...",
  "raffle_state": "pending" | "awaiting_draw" | "won" | "lost",

  // Stage 3 fields (always present after Stage 3 ships):
  "quests": {
    "swap":        "completed" | "pending",
    "bridge":      "completed" | "pending",
    "defi_action": "completed" | "pending",
    "alert":       "completed" | "pending",
    "dca":         "completed" | "pending"
  },
  "quests_completed": 2,
  "claim_eligible": false,

  // Stage 4 field (always present after Stage 4 ships):
  "already_claimed": false
}
```

**Response — 200, not registered:**
```json
{ "registered": false }
```

`claim_eligible` is the composite the app uses to enable the claim button. Backend computes it: `claim_eligible = (raffle_state == "won") AND (quests_completed >= QUEST_THRESHOLD) AND (already_claimed == false)`. Single source of truth — the client doesn't recompute.

`quest_states` and `already_claimed` come from the Stage 3 / Stage 4 tables (`agent_user_quests`, `agent_claim_submissions`); Stage 1 spec defines the response shape; Stage 3 / Stage 4 specs define the underlying writes.

**Raffle state machine** (computed at request time):

| State | Condition |
|---|---|
| `pending` | `now() < TRANSITION_WINDOW_END` |
| `awaiting_draw` | `now() >= TRANSITION_WINDOW_END` AND `NOT EXISTS(SELECT 1 FROM agent_raffle_proofs LIMIT 1)` |
| `won` | a row exists in `agent_raffle_proofs` for this public_key |
| `lost` | window closed AND `EXISTS(SELECT 1 FROM agent_raffle_proofs LIMIT 1)` AND no row for this public_key |

The "raffle has been drawn" signal is just `EXISTS(SELECT 1 FROM agent_raffle_proofs LIMIT 1)` — Stage 2's `load-proofs` runs in a single transaction, so this is reliable.

**Errors:** `401` only.

### `GET /airdrop/stats`

**Purpose:** marketing's live "passengers aboard" counter.

**Request:** no auth, no body.

**Response — 200:**
```json
{
  "total_registrations": 1234,
  "by_source": { "seed": 800, "vault_share": 434 },
  "window_state": "upcoming" | "open" | "closed",
  "window_opens_at": "2026-04-25T00:00:00Z",
  "window_closes_at": "2026-04-30T00:00:00Z"
}
```

**Behavior:**

1. Try Redis `GET airdrop:stats`. On hit, return immediately.
2. On miss: query Postgres for the counts, compute window state, marshal, write to Redis with `SETEX airdrop:stats 30 <body>`, return.

No stampede protection — the surface is small and 30s TTL is short enough that even cold-miss bursts are fine.

**Errors:** none expected; if Redis is down, fall back to direct DB query and skip the cache write.

---

## Schema

```sql
-- Migration: XXXXXXXXXXXXXX_create_airdrop_registrations.sql

CREATE TYPE airdrop_registration_source AS ENUM ('seed', 'vault_share');

CREATE TABLE agent_airdrop_registrations (
    public_key        TEXT                        PRIMARY KEY,
    source            airdrop_registration_source NOT NULL,
    recipient_address TEXT                        NOT NULL,    -- 0x-prefixed EVM address; client computes; backend never derives
    registered_at     TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
);
```

No secondary indexes — the only queries are by public_key (PK lookup) and full-table aggregations for `/airdrop/stats` (cached 30s, table is small). `recipient_address` is consumed at draw time by Stage 2.

Naming follows the existing `agent_*` convention.

---

## Configuration

New env vars introduced by this stage:

| Var | Type | Notes |
|---|---|---|
| `TRANSITION_WINDOW_START` | RFC3339 timestamp | When `/airdrop/register` starts accepting |
| `TRANSITION_WINDOW_END`   | RFC3339 timestamp | When `/airdrop/register` starts rejecting |

Both values are sourced from the Stage 0 decisions table.

---

## Observability

Prometheus metrics (following existing `agent-backend` conventions in `internal/metrics/`):

| Metric | Type | Labels |
|---|---|---|
| `airdrop_register_total` | Counter | `result` ∈ `{created, existing, window_not_open, window_closed, invalid_source}` |
| `airdrop_status_total` | Counter | `state` ∈ `{not_registered, pending, awaiting_draw, won, lost}` |
| `airdrop_stats_cache_total` | Counter | `result` ∈ `{hit, miss, redis_error}` |

Per-endpoint latency + error metrics come from the existing HTTP middleware automatically.

Structured logs include: `public_key` (first 8 chars only — privacy), `source`, `request_id`, `result`. The existing logrus context wiring handles this if we add the fields per request.

---

## Tests

**Unit (in `internal/service/airdrop/registration_test.go`):**
- Source enum validation: missing, empty, wrong value, valid `seed`, valid `vault_share`.
- Recipient validation: missing (rejected), valid lowercase, valid mixed-case, missing 0x prefix, wrong length, non-hex chars.
- Window enforcement: before-start, at-start, mid-window, at-end, after-end. Use an injected clock.
- Idempotency: register twice returns same row; second source / recipient_address values are ignored.
- Raffle state computation: each of the four states with mocked `raffle_proofs` and clock.

**Integration (against real Postgres + Redis):**
- Full round-trip: register → status (own status, pending) → stats (count incremented).
- Concurrent register: 100 parallel calls for the same public_key insert exactly one row.
- Concurrent register: 100 parallel calls for 100 different public_keys insert 100 rows.
- Stats cache hit + miss: first call increments `cache_miss`, subsequent calls within 30s increment `cache_hit`.
- Window transition: register at `TRANSITION_WINDOW_END - 1s` succeeds, at `TRANSITION_WINDOW_END + 1s` returns `WINDOW_CLOSED`.

**Load:**
- 1000 concurrent registers across 1000 distinct public keys: p99 latency under 100ms.
- 100 RPS sustained against `/airdrop/stats` for 1 minute: cache hit rate above 95%.

---

## Files

```
internal/api/airdrop/
├── register.go         POST /airdrop/register handler
├── status.go           GET /airdrop/status handler
└── stats.go            GET /airdrop/stats handler

internal/service/airdrop/
└── registration.go     Pure business logic — register, status, stats. DB + Redis injected; no I/O in unit tests.

internal/storage/postgres/
├── migrations/XXXXXXXXXXXXXX_create_airdrop_registrations.sql
└── sqlc/airdrop_registrations.sql     Insert (idempotent), select-by-pk, count-all, count-by-source

internal/api/server.go   (edit) — register the three new routes under existing JWT middleware (and bare for /stats)
internal/config/config.go (edit) — add TRANSITION_WINDOW_START / _END env vars
```

Routes register under existing patterns — JWT-scoped routes go through the same middleware as `/agent/conversations/*`; the public stats endpoint sits alongside `/healthz`.

---

## Open dependencies

- **Stage 2 contract — `agent_raffle_proofs` table exists.** Stage 1's status endpoint reads it for the `won` / `lost` / `awaiting_draw` state. Stage 2 spec defines the schema.
- **Stage 0 decisions table rows 1, 3, 4** — `slot_count` is not used by Stage 1 directly but informs the load-test sizing and the marketing copy ("X of N entries"). `TRANSITION_WINDOW_END` is the load-bearing env var; without it Stage 1 cannot deploy.

---

## Done when

- Migration committed and applied to staging.
- Three endpoints respond with documented shapes against documented status codes.
- Unit and integration tests above pass.
- Load test meets p99 < 100ms for register and cache hit rate > 95% for stats.
- All three endpoints live in staging by Day 8.
- Stats endpoint URL handed to marketing for their live counter.
