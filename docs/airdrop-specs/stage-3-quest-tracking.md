# Stage 3 — Quest Tracking

## What this stage does

Winning the raffle doesn't immediately get the user VULT. Winners must complete **3 of 5 in-app activities** during Days 13–27 first — swap a token, bridge between chains, do a DeFi action, set up an alert, set up a DCA. This filters bots and rewards engagement before payout.

We watch what users do in the agent: every time the mobile app reports back that a tool call's transaction was signed and broadcast (the existing `POST /conversations/{id}/tool-result` notification), we check whether it counts toward a quest. If so, we record an event and mark the quest complete for that user. Once a user hits 3 quests, they're flagged `claim_eligible` in the database — Stage 4's relayer reads that flag before submitting any on-chain claim.

**Eligibility is enforced backend-side, not on-chain.** The contract trusts the relayer to only submit claims for eligible users. Since the backend is the only relayer and a backend compromise would also compromise any on-chain attestation key, an EIP-712 attestation step would add complexity without meaningful security. (Decision recorded 2026-04-22.)

This stage is alive between Day 13 and Day 27 (the quest-earning window) and the eligibility data continues to be readable indefinitely after that for late claims.

---

## The 5 quests

| ID | Triggering tool call | Validator |
|---|---|---|
| `swap` | `build_swap_tx` broadcast | min `amount_usd` (e.g. ≥ $10), allow-listed router contracts |
| `bridge` | `build_bridge_tx` broadcast | source chain ≠ dest chain, min `amount_usd` |
| `defi_action` | `build_evm_tx` broadcast targeting an allow-listed contract | contract address in `DEFI_ACTION_CONTRACT_ALLOWLIST` |
| `alert` | (TBD with Product) | (TBD) |
| `dca` | (TBD with Product) | (TBD) |

The first three are well-defined; `alert` and `dca` are pending Product lock per the Stage 0 decisions table. The validator code for those two ships as stubs that always return "not counting" until the rules are filled in. The hook dispatch in `tool-result` is generic (switches on quest_id), so wiring the stubs in later is a one-file change with no architectural impact.

3-of-5 is the threshold. This is `QUEST_THRESHOLD = 3` in config — could move if Product changes their mind.

---

## Auth model

All quest endpoints are **internal** — paths under `/internal/quests/...`. Every request must carry `X-Internal-Token: <secret>` matching the `INTERNAL_API_KEY` env var. No JWT, no public exposure. Middleware rejects anything missing or wrong with `401 Unauthorized`.

The agent runtime (in this same binary) injects the header on internal calls. If/when other services need to fire quest events, they read the same secret from a shared store.

---

## Endpoints

This stage exposes only one endpoint — the quest event ingester. Eligibility is read directly by Stage 4 from the same database tables this stage writes to.

### `POST /internal/quests/event`

**Purpose:** record a single quest-relevant action. Called from the `POST /conversations/{id}/tool-result` handler (in this binary) after the mobile app reports that a tool call's transaction was signed and broadcast.

**Request:**
```http
POST /internal/quests/event
X-Internal-Token: <secret>
Content-Type: application/json

{
  "public_key": "...",
  "quest_type": "swap" | "bridge" | "defi_action" | "alert" | "dca",
  "tool_call_id": "...",
  "tx_hash": "0x...",
  "data": { /* quest-type-specific fields, see below */ }
}
```

`tool_call_id` is the idempotency key — if the same tool result is reported twice, the second call is a no-op (returns 200 with the existing event row). `tx_hash` is captured for audit (lets ops verify a quest event by inspecting the chain).

Per-quest `data` payloads:

| Quest | `data` shape |
|---|---|
| `swap` | `{ amount_usd, token_in, token_out, chain_id, router_address }` |
| `bridge` | `{ amount_usd, source_chain_id, dest_chain_id }` |
| `defi_action` | `{ contract_address, chain_id, method }` |
| `alert` | TBD |
| `dca` | TBD |

**Response — 200:**
```json
{ "recorded": true, "quest_completed": false, "quests_completed_total": 2 }
```

`recorded` is true for both fresh inserts and idempotent retries. `quest_completed` is true only when this event is the one that flipped the user's `user_quests` row to complete (i.e. the first qualifying event for that quest). `quests_completed_total` is the user's running count (used by callers for logging or UX hints).

**Errors:**

| Status | Body | When |
|---|---|---|
| 401 | `{"error":"UNAUTHORIZED"}` | Missing or wrong `X-Internal-Token` |
| 400 | `{"error":"INVALID_QUEST_TYPE"}` | `quest_type` not in enum |
| 400 | `{"error":"INVALID_PAYLOAD"}` | `data` doesn't match the quest's expected shape |
| 403 | `{"error":"QUEST_NOT_ACTIVE"}` | `now() < QUEST_ACTIVATION_TIMESTAMP` |

**Behavior:**

1. Validate envelope (`quest_type`, `tool_call_id`, `tx_hash`).
2. Reject if `now() < QUEST_ACTIVATION_TIMESTAMP` (Day 13).
3. Dispatch to the per-quest validator (one Go file per quest type). Validator returns `{ qualifies: bool, reason: string }`.
4. If `qualifies == false`: insert a `quest_events` row with `status='rejected'` and the reason. Return 200 with `recorded: true, quest_completed: false`. (Logging the rejection helps Product see why borderline events didn't count.)
5. If `qualifies == true`:
   - `INSERT INTO agent_quest_events ... ON CONFLICT (tool_call_id) DO NOTHING` (idempotent).
   - `INSERT INTO agent_user_quests (public_key, quest_id) VALUES (...) ON CONFLICT DO NOTHING RETURNING xmax = 0 AS was_inserted` to mark the quest complete (no-op if already complete).
   - Read the user's current `quests_completed_total`.
6. Return 200 with the result fields.

## Eligibility check

Stage 4's relayer reads eligibility directly from the database — there is no `/internal/quests/eligibility` endpoint. The query is:

```sql
SELECT
  EXISTS(SELECT 1 FROM agent_raffle_proofs WHERE public_key = $1) AS won_raffle,
  (SELECT COUNT(*) FROM agent_user_quests WHERE public_key = $1) AS quests_completed
```

A user is claim-eligible iff `won_raffle = true AND quests_completed >= QUEST_THRESHOLD AND no row in agent_claim_submissions WHERE public_key = $1 AND status IN ('submitted','confirmed')`.

This composite is also what Stage 1's `/airdrop/status` returns as the `claim_eligible` field. A small shared `eligibility.go` helper lives in `internal/service/airdrop/quests/` and is called from both the status handler (Stage 1) and the claim handler (Stage 4).

---

## Wiring the runtime hook

In the existing `POST /conversations/{id}/tool-result` handler (Stage 4 of the chat lifecycle, not Stage 4 of this spec — different "Stage 4"), after the existing logic stores the tool result as conversation metadata, add:

1. Inspect the incoming `{toolCallId, name, result}`.
2. If `name` matches a quest-relevant tool (`build_swap_tx`, `build_bridge_tx`, `build_evm_tx`, etc.) AND `result` indicates a successful broadcast (looking at the tool result schema — likely a `tx_hash` field), translate to a quest event.
3. POST to `/internal/quests/event` (in-process, but over HTTP per the API-endpoint pattern — uses the `INTERNAL_API_KEY` from config).
4. Errors from `/internal/quests/event` are logged but do not propagate to the handler's response. Quest tracking is best-effort — if it fails, the user can re-trigger by repeating the action; ops audits via the `quest_events` table.

The map from tool name → quest type lives in one Go file (`quest_dispatch.go`). Adding or renaming a triggering tool is a one-line change there.

---

## Schema

```sql
CREATE TYPE airdrop_quest_id AS ENUM ('swap', 'bridge', 'defi_action', 'alert', 'dca');
CREATE TYPE airdrop_quest_event_status AS ENUM ('counted', 'rejected');

CREATE TABLE agent_quest_events (
    tool_call_id  TEXT                          PRIMARY KEY,           -- idempotency key
    public_key    TEXT                          NOT NULL,
    quest_id      airdrop_quest_id              NOT NULL,
    tx_hash       TEXT                          NOT NULL,
    status        airdrop_quest_event_status    NOT NULL,
    reject_reason TEXT,                                                -- non-null only when status='rejected'
    payload       JSONB                         NOT NULL,
    created_at    TIMESTAMPTZ                   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quest_events_public_key ON agent_quest_events (public_key);

CREATE TABLE agent_user_quests (
    public_key   TEXT              NOT NULL,
    quest_id     airdrop_quest_id  NOT NULL,
    completed_at TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    PRIMARY KEY (public_key, quest_id)
);
```

Two tables. `quest_events` is the append-only audit log (one row per incoming event, including rejected ones). `user_quests` is the materialised "which quests has each user completed" view (one row per user-quest combination, exists ⇔ quest is complete).

`tool_call_id` as the events PK gives free idempotency at the database layer. `(public_key, quest_id)` as the user_quests PK gives free deduplication ("a quest is either complete or not, two qualifying events for the same quest = one row").

`quests_completed_total` for a user is `SELECT COUNT(*) FROM agent_user_quests WHERE public_key = ?` — fast PK lookup, no separate counter to keep in sync.

---

## Configuration

| Var | Type | Notes |
|---|---|---|
| `INTERNAL_API_KEY` | string secret | Shared secret for `X-Internal-Token` on `/internal/*` endpoints |
| `QUEST_ACTIVATION_TIMESTAMP` | RFC3339 timestamp | Day 13 wall clock — events before this are rejected |
| `QUEST_THRESHOLD` | int, default 3 | How many of 5 quests are needed to be claim-eligible |
| `DEFI_ACTION_CONTRACT_ALLOWLIST` | comma-separated 0x-addresses | Allow-list for the `defi_action` quest validator |
| `SWAP_QUEST_MIN_USD` | int, default 10 | Min USD value for a swap to count |
| `BRIDGE_QUEST_MIN_USD` | int, default 10 | Min USD value for a bridge to count |

---

## Observability

Prometheus metrics:

| Metric | Type | Labels |
|---|---|---|
| `airdrop_quest_event_total` | Counter | `quest_type`, `result` ∈ `{counted, rejected, idempotent_retry}` |
| `airdrop_quest_event_reject_reason_total` | Counter | `quest_type`, `reason` |
| `airdrop_quest_completion_total` | Counter | `quest_type` (incremented when a quest first flips to complete for a user) |

Structured logs include `public_key` (first 8 chars), `quest_type`, `tool_call_id`, `tx_hash`, `result`, `request_id`.

---

## Tests

**Unit (per quest validator):**
- Boundary cases: just-below threshold, just-above, exact match.
- Negative cases: wrong chain, contract not on allowlist, missing required fields.
- Idempotency: same `tool_call_id` twice yields one row, both responses are 200.

**Unit (eligibility helper):**
- Won raffle + 3 quests + not claimed → eligible.
- Won raffle + 2 quests → not eligible.
- Lost raffle (no proofs row) + 3 quests → not eligible.
- Won raffle + 3 quests + already claimed → not eligible.

**Integration (real Postgres):**
- Full path: tool-result handler receives synthetic broadcast notification → quest event recorded → `quests_completed_total` increments → eligibility check flips to true at 3rd completion.
- Activation timestamp gate: pre-activation event is rejected; post-activation is counted.

---

## Files

```
internal/api/airdrop/
└── quests_event.go      POST /internal/quests/event handler

internal/api/middleware/
└── internal_token.go    Shared-secret check for /internal/* paths

internal/service/airdrop/quests/
├── dispatch.go          Map quest_type → validator; called by event handler
├── validators/
│   ├── swap.go          Hard-coded swap validator
│   ├── bridge.go        Hard-coded bridge validator
│   ├── defi_action.go   Hard-coded DeFi action validator
│   ├── alert.go         Stub until Product locks
│   └── dca.go           Stub until Product locks
└── eligibility.go       Computes claim_eligible from raffle_proofs + user_quests + claim_submissions; called by Stage 1 status + Stage 4 claim

internal/service/agent/conversations/
└── tool_result.go       (edit) — wire the quest hook after the existing tool-result storage logic; map tool name → quest_type via quest_dispatch.go

internal/storage/postgres/
├── migrations/XXXXXXXXXXXXXX_create_agent_quest_events.sql
├── migrations/XXXXXXXXXXXXXX_create_agent_user_quests.sql
└── sqlc/airdrop_quests.sql
```

---

## Open dependencies

- **Stage 0 — `INTERNAL_API_KEY` chosen + injected into the deploy.**
- **Stage 0 — `QUEST_ACTIVATION_TIMESTAMP`, `DEFI_ACTION_CONTRACT_ALLOWLIST` decisions locked.**
- **Stage 0 — final 5-quest list locked by Product** (specifically the `alert` and `dca` validators).
- **Stage 1 — status endpoint extension** to include quest fields and `claim_eligible` (done — see Stage 1 spec).
- **Stage 4 — relayer calls `eligibility.go` directly in-process** (it's a shared helper, not an HTTP boundary).

---

## Done when

- The event endpoint responds with documented shapes against documented status codes.
- Three live quest validators (swap, bridge, defi_action) implemented and unit-tested for boundary cases.
- Stub validators (alert, dca) in place returning "not counting" until Product locks.
- Idempotency: duplicate `tool_call_id` POSTs result in one event row, both 200 responses.
- Activation gate: events pre-activation are rejected; post-activation are counted.
- Eligibility helper returns the correct boolean for all combinations of (won, quests_completed, already_claimed).
- Tool-result hook in the conversations handler fires `/internal/quests/event` correctly; failures are logged but not propagated.
