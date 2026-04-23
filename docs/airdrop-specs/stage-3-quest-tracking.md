# Stage 3 — Quest Tracking

## What this stage does

Winning the raffle doesn't immediately get the user VULT. Winners must complete **3 of 5 in-app activities** during Days 13–27 first — swap a token, bridge between chains, do a DeFi action, set up an alert, set up a DCA. This filters bots and rewards engagement before payout.

Every time a user signs and broadcasts a transaction the agent built for them, the agent-backend's existing tx-proposal `/sign` handler fires a quest event into the airdrop module. The event includes a normalised `quest_metadata` payload that the agent layer pre-computed at proposal-creation time (USD value, chain IDs, target contract). The airdrop module then runs the per-quest validator against that payload and, if it qualifies, marks the quest complete. Once a user hits 3 quests they're flagged `claim_eligible`; Stage 4's relayer reads that flag before submitting any on-chain claim.

**Eligibility is enforced backend-side, not on-chain.** The contract trusts the relayer to only submit claims for eligible users. Since the backend is the only relayer and a backend compromise would also compromise any on-chain attestation key, an EIP-712 attestation step would add complexity without meaningful security. (Decision recorded 2026-04-22.)

This stage is alive between Day 13 and Day 27 (the quest-earning window) and the eligibility data continues to be readable indefinitely after that for late claims.

> **2026-04-23 update.** The classifier-based design (sniffing JSONB at quest-event time) was dropped in favour of the agent layer pre-computing a normalised `quest_metadata` field at proposal-creation time. The change moves the work to where the truth lives — the build_* tool that built the tx already knows the USD amount, the route, the target contract. Ripping classification logic out of the airdrop module and replacing it with a clean lookup table is both simpler and more reliable. See "Cross-team contract" below.

---

## The 5 quests

| ID | Triggering tool | Validator reads from `quest_metadata` |
|---|---|---|
| `swap` | `build_swap_tx` | `amount_usd >= SWAP_QUEST_MIN_USD`, `token_in_symbol != token_out_symbol`, `router_address` present |
| `bridge` | `build_swap_tx` (cross-chain), or a future `build_bridge_tx` | `amount_usd >= BRIDGE_QUEST_MIN_USD`, `source_chain_id != dest_chain_id` |
| `defi_action` | `build_evm_tx` | `target_contract` in `DEFI_ACTION_CONTRACT_ALLOWLIST` |
| `alert` | (TBD with Product) | (TBD) |
| `dca` | (TBD with Product) | (TBD) |

The first three are well-defined; `alert` and `dca` are pending Product lock per the Stage 0 decisions table. The validator code for those two ships as stubs that return "not counting" until the rules are filled in. The dispatch table (`tool_name` → `quest_type`) is generic, so adding a new quest is a one-file change with no architectural impact.

3-of-5 is the threshold. This is `QUEST_THRESHOLD = 3` in config — could move if Product changes their mind.

---

## Cross-team contract — the `quest_metadata` shape

The hook depends on two new columns on `agent_tx_proposals`, populated by the agent-backend at proposal-creation time. Without these columns, this stage cannot ship.

```sql
ALTER TABLE agent_tx_proposals ADD COLUMN tool_name TEXT;        -- e.g. "build_swap_tx"
ALTER TABLE agent_tx_proposals ADD COLUMN quest_metadata JSONB;  -- normalised, see below
```

`quest_metadata` schema — flat JSON object, all fields optional, validators only read what they need:

```json
{
  "amount_usd":         25.50,
  "token_in_symbol":    "USDC",
  "token_out_symbol":   "ETH",
  "source_chain_id":    1,
  "dest_chain_id":      1,
  "target_contract":    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  "router_address":     "0x6131b5fae19ea4f9d964eac0408e4408b66337b5"
}
```

Notes:
- `amount_usd` is a JSON number (decimal, not an integer in cents). For swap/bridge it's the USD value of the user-side amount, computed by whichever tool built the tx using its existing quote pipeline.
- Chain IDs are **integers** (1, 42161, 8453, …), not strings. This is a deliberate divergence from the existing `tx_proposals.chain` column (which holds strings like "ethereum"). Integers are the universal EVM convention; the validators do `source_chain_id != dest_chain_id` cleanly without string-normalisation.
- Addresses are lowercase hex with `0x` prefix. The DeFi-action validator does a lowercase compare against the configured allowlist.
- For tools that don't compute USD value (e.g. native sends with no quote), `amount_usd` is omitted. The validators treat absence as "below threshold" and reject the event.

**Three-team responsibility split:**

| Layer | Responsibility |
|---|---|
| **MCP team** (`vultisig/mcp` repo) | Each `build_*` tool emits a `quest_metadata` block in its result, populated from the data it already has during quote/build. **Sized:** `build_evm_tx` ~5 lines (chain ID + target_contract are already in the result struct, just expose). `build_swap_tx` ~25 lines (need to call the existing `coingecko.Client` to compute `amount_usd` from the user's input amount + fetched USD price; `bundle.Quote.Router` exists internally but isn't currently exposed in the result struct, so add `RouterAddress`). No new external dependency — CoinGecko client is already wired up in MCP. |
| **agent-backend team** | Migration to add `tool_name` + `quest_metadata` columns. In `internal/service/scheduler/scheduler.go` (call site of `txProposalRepo.Create`; grep for it — currently around line 320, may drift), capture `tool.Name` from the active `result.ToolLogs` entry and forward `tool.Result.quest_metadata` to the new columns. ~10 lines of Go + 1 migration. |
| **Airdrop module (this stage)** | Read the populated columns at quest-event time. Trivial dispatch + validators. |

Stage 0's decisions table tracks the cross-team commit on this schema (row 12).

---

## Auth model

All quest endpoints are **internal** — paths under `/internal/quests/...`. Every request must carry `X-Internal-Token: <secret>` matching the `INTERNAL_API_KEY` env var. No JWT, no public exposure. Middleware rejects anything missing or wrong with `401 Unauthorized`.

The agent-backend's `SignTxProposal` handler injects the header on its in-process call to `/internal/quests/event`. If/when other services need to fire quest events, they read the same secret from a shared store.

---

## Endpoints

This stage exposes only one endpoint — the quest event ingester. Eligibility is read directly by Stage 4 from the same database tables this stage writes to.

### `POST /internal/quests/event`

**Purpose:** record a single quest-relevant action. Called from the existing `SignTxProposal` handler in this binary after the mobile app reports that a tool-built transaction was signed and broadcast. The hook reads `proposal.tool_name` and `proposal.quest_metadata` from the now-marked-signed row and forwards the values here.

**Request:**
```http
POST /internal/quests/event
X-Internal-Token: <secret>
Content-Type: application/json

{
  "public_key":     "...",
  "tool_call_id":   "...",          // proposal_id is fine — same idempotency property
  "tx_hash":        "0x...",
  "tool_name":      "build_swap_tx",
  "quest_metadata": { /* the agent-backend's persisted blob, forwarded as-is */ }
}
```

The handler dispatches `tool_name` → `quest_type` via a 5-line lookup table. If the tool has no quest mapping (e.g. `build_observe_tx`), the handler returns 200 with `recorded: false` — not an error.

`tool_call_id` is the idempotency key — if the same proposal is signed-and-reported twice, the second call is a no-op. In practice the proposal's UUID is fine here. `tx_hash` is captured for audit.

**Response — 200:**
```json
{ "recorded": true, "quest_completed": false, "quests_completed": 2 }
```

`recorded` is true if the event was inserted (fresh OR idempotent retry). `quest_completed` is true only when this event is the one that flipped the user's `user_quests` row to complete. `quests_completed` is the user's running count.

If `tool_name` has no mapping, returns `{ "recorded": false }` with no quest event written.

**Errors:**

| Status | Body | When |
|---|---|---|
| 401 | `{"error":"UNAUTHORIZED"}` | Missing or wrong `X-Internal-Token` |
| 400 | `{"error":"MISSING_FIELDS"}` | `public_key` / `tool_name` / `tool_call_id` missing |
| 403 | `{"error":"QUEST_NOT_ACTIVE"}` | `now() < QUEST_ACTIVATION_TIMESTAMP` |

**Behavior:**

1. Validate envelope (`public_key`, `tool_name`, `tool_call_id`, `tx_hash`).
2. Reject if `now() < QUEST_ACTIVATION_TIMESTAMP` (Day 13).
3. Look up `tool_name` in the dispatch table. If unmapped, return 200 with `recorded: false`.
4. Dispatch to the per-quest validator. Validator returns `{ qualifies: bool, reason: string }`.
5. If `qualifies == false`: insert a `quest_events` row with `counted=false` and the reason. Return 200 with `recorded: true, quest_completed: false`. (Logging the rejection helps Product see why borderline events didn't count.)
6. If `qualifies == true`:
   - `INSERT INTO agent_quest_events ... ON CONFLICT (tool_call_id) DO NOTHING` (idempotent).
   - `INSERT INTO agent_user_quests (public_key, quest_id) VALUES (...) ON CONFLICT DO NOTHING RETURNING xmax = 0 AS was_inserted` to mark the quest complete (no-op if already complete).
   - Read the user's current `quests_completed`.
7. Return 200 with the result fields.

## Eligibility check

Stage 4's relayer reads eligibility directly from the database — there is no `/internal/quests/eligibility` endpoint. The query is:

```sql
SELECT
  EXISTS(SELECT 1 FROM agent_raffle_winners WHERE public_key = $1) AS won_raffle,
  (SELECT COUNT(*) FROM agent_user_quests WHERE public_key = $1) AS quests_completed
```

A user is claim-eligible iff `won_raffle = true AND quests_completed >= QUEST_THRESHOLD AND no row in agent_claim_submissions WHERE public_key = $1 AND status IN ('submitted','confirmed')`.

This composite is also what Stage 1's `/airdrop/status` returns as the `claim_eligible` field. A small shared `eligibility.go` helper lives in `internal/service/airdrop/quests/` and is called from both the status handler (Stage 1) and the claim handler (Stage 4).

---

## Wiring the runtime hook

The hook lives in agent-backend's existing `SignTxProposal` handler (`internal/api/tx_proposals.go:95-117`). After the existing `MarkSigned` call succeeds, add:

1. Re-read the proposal (or pass `proposal.ToolName` + `proposal.QuestMetadata` through `MarkSigned`'s return — implementer's choice).
2. If `tool_name` is empty (proposal predates the migration, or a tool that doesn't tag itself), skip — no quest event fires.
3. Build the request body: `{ public_key, tool_call_id: proposal.ID, tx_hash: req.TxHash, tool_name, quest_metadata }`.
4. POST to `http://localhost:<server-port>/internal/quests/event` with `X-Internal-Token: <INTERNAL_API_KEY>`.
5. Errors are logged but **do not propagate** to the user's `/sign` response. Quest tracking is best-effort — a failed quest hook doesn't fail the user's sign action. If the quest event was lost, the user can re-trigger by repeating the action; ops audits via the `quest_events` table and the `agent_tx_proposals` row's `quest_metadata` field.

The `tool_name → quest_type` map lives in one Go file (`internal/service/airdrop/quests/dispatch.go`):

```go
var toolToQuest = map[string]string{
    "build_swap_tx":   "swap",   // or "bridge" — depends on source_chain_id == dest_chain_id; resolved by the validator dispatch
    "build_bridge_tx": "bridge",
    "build_evm_tx":    "defi_action",
}
```

For `build_swap_tx` specifically, the dispatch needs to inspect `quest_metadata.source_chain_id` vs `dest_chain_id` to decide swap vs bridge — same tool, different quest depending on whether the chains differ. One small switch in the dispatch.

---

## Schema

```sql
CREATE TYPE airdrop_quest_id AS ENUM ('swap', 'bridge', 'defi_action', 'alert', 'dca');

CREATE TABLE agent_quest_events (
    tool_call_id    TEXT             PRIMARY KEY,                       -- idempotency key (in practice, the proposal UUID)
    public_key      TEXT             NOT NULL,
    quest_id        airdrop_quest_id NOT NULL,
    tx_hash         TEXT             NOT NULL,
    counted         BOOLEAN          NOT NULL,                          -- true if the validator qualified this event
    reject_reason   TEXT,                                               -- non-null only when counted = false
    tx_proposal_id  UUID,                                               -- soft reference to agent_tx_proposals(id) for audit. No FK — keeps migrations independent and tolerates proposal cleanup.
    created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quest_events_public_key ON agent_quest_events (public_key);

CREATE TABLE agent_user_quests (
    public_key   TEXT              NOT NULL,
    quest_id     airdrop_quest_id  NOT NULL,
    completed_at TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    PRIMARY KEY (public_key, quest_id)
);
```

Two tables. `quest_events` is the append-only audit log (one row per incoming event, including rejected ones). `user_quests` is the materialised "which quests has each user completed" view.

`tool_call_id` as the events PK gives free idempotency at the database layer. `(public_key, quest_id)` as the user_quests PK gives free deduplication.

`quests_completed` for a user is `SELECT COUNT(*) FROM agent_user_quests WHERE public_key = ?` — fast PK lookup, no separate counter.

The `tool_name` + `quest_metadata` columns on `agent_tx_proposals` are owned by the agent-backend team (see Cross-team contract above), not this stage's migration set.

---

## Configuration

| Var | Type | Notes |
|---|---|---|
| `INTERNAL_API_KEY` | string secret | Shared secret for `X-Internal-Token` on `/internal/*` endpoints |
| `QUEST_ACTIVATION_TIMESTAMP` | RFC3339 timestamp | Day 13 wall clock — events before this are rejected |
| `QUEST_THRESHOLD` | int, default 3 | How many of 5 quests are needed to be claim-eligible |
| `DEFI_ACTION_CONTRACT_ALLOWLIST` | comma-separated 0x-addresses | Allow-list for the `defi_action` quest validator. Lowercased at parse time. |
| `SWAP_QUEST_MIN_USD` | int, default 10 | Min USD value for a swap to count |
| `BRIDGE_QUEST_MIN_USD` | int, default 10 | Min USD value for a bridge to count |

---

## Observability

Prometheus metrics:

| Metric | Type | Labels |
|---|---|---|
| `airdrop_quest_event_total` | Counter | `quest_type`, `result` ∈ `{counted, rejected, idempotent_retry, unmapped_tool}` |
| `airdrop_quest_event_reject_reason_total` | Counter | `quest_type`, `reason` |
| `airdrop_quest_completion_total` | Counter | `quest_type` (incremented when a quest first flips to complete for a user) |

Structured logs include `public_key` (first 8 chars), `tool_name`, `quest_type`, `tool_call_id`, `tx_hash`, `result`, `request_id`.

---

## Tests

**Unit (per quest validator):**
- Boundary cases: just-below threshold, just-above, exact match — using `quest_metadata` fixtures.
- Negative cases: missing `amount_usd` → rejected, contract not on allowlist → rejected, swap with same chain ID and same token → rejected.
- Idempotency: same `tool_call_id` twice yields one row, both responses are 200.
- Unmapped `tool_name`: returns 200 with `recorded: false`, no DB write.

**Unit (eligibility helper):**
- Won raffle + 3 quests + not claimed → eligible.
- Won raffle + 2 quests → not eligible.
- Lost raffle (no winners row) + 3 quests → not eligible.
- Won raffle + 3 quests + already claimed → not eligible.

**Integration (real Postgres):**
- Full path: synthetic `agent_tx_proposals` row with `tool_name` + `quest_metadata` populated → call `SignTxProposal` → quest event recorded → `quests_completed` increments → eligibility check flips to true at 3rd completion.
- Activation timestamp gate: pre-activation event is rejected; post-activation is counted.

---

## Files

```
internal/api/airdrop/
└── quests_event.go      POST /internal/quests/event handler

internal/service/airdrop/quests/
├── dispatch.go          Map tool_name → quest_type (handles swap-vs-bridge by chain ID)
├── validators/
│   ├── swap.go          Reads quest_metadata.amount_usd, token symbols, router_address
│   ├── bridge.go        Reads quest_metadata.amount_usd, source/dest chain IDs
│   ├── defi_action.go   Reads quest_metadata.target_contract; checks allowlist
│   ├── alert.go         Stub until Product locks
│   └── dca.go           Stub until Product locks
└── eligibility.go       Owned by Stage 1's plan (Stage 1 is first consumer); Stage 4 reuses

internal/api/
└── tx_proposals.go      (edit) — add the quest hook to SignTxProposal after MarkSigned succeeds

internal/storage/postgres/
├── migrations/XXXXXXXXXXXXXX_create_agent_quest_events.sql   (shipped by shared-infra plan)
├── migrations/XXXXXXXXXXXXXX_create_agent_user_quests.sql    (shipped by shared-infra plan)
└── sqlc/airdrop_quests.sql
```

---

## Open dependencies

- **MCP team — `quest_metadata` block emitted by `build_swap_tx`, `build_evm_tx`, and any bridge-equivalent tool.** Lock the schema (see "Cross-team contract" above) and ship before this stage can be E2E-tested. **Hard blocker.**
- **agent-backend team — migration adding `tool_name` + `quest_metadata` to `agent_tx_proposals`, plus the ~10-line scheduler.go change to populate them at proposal-creation time.** **Hard blocker.**
- **Stage 0 — `INTERNAL_API_KEY` chosen + injected into the deploy.**
- **Stage 0 — `QUEST_ACTIVATION_TIMESTAMP`, `DEFI_ACTION_CONTRACT_ALLOWLIST` decisions locked.**
- **Stage 0 — final 5-quest list locked by Product** (specifically the `alert` and `dca` validators).
- **Stage 0 — `quest_metadata` schema lock signed off** by MCP team + agent-backend team + airdrop eng (decisions row 12).
- **Stage 1 — status endpoint extension** to include quest fields and `claim_eligible` (done — see Stage 1 spec).
- **Stage 4 — relayer calls `eligibility.go` directly in-process** (it's a shared helper, not an HTTP boundary).

---

## Done when

- The event endpoint responds with documented shapes against documented status codes.
- Three live quest validators (swap, bridge, defi_action) implemented and unit-tested for boundary cases against `quest_metadata` fixtures.
- Stub validators (alert, dca) in place returning "not counting" until Product locks.
- Idempotency: duplicate `tool_call_id` POSTs result in one event row, both 200 responses.
- Activation gate: events pre-activation are rejected; post-activation are counted.
- Eligibility helper returns the correct boolean for all combinations of (won, quests_completed, already_claimed).
- Hook in `SignTxProposal` fires `/internal/quests/event` correctly; failures are logged but not propagated.
- E2E confirmation: at least one real `build_swap_tx` flow in staging produces a populated `quest_metadata` block and a `counted` quest event row.
