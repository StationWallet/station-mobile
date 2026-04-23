# Stage 2 — Raffle Draw

## What this stage does

After the boarding window closes on Day 12, fairly pick the winners, hand the resulting list to the multisig owner so they can publish it via batched `setWinners(...)` calls on the contract, and load the same list into Postgres so Stage 1's status endpoint and Stage 4's relayer have the data they need.

This is a one-shot operation, run by a human operator on Day 12. No off-chain Merkle tree, no proofs, no leaf encoding (all dropped 2026-04-23 — see `sibling-on-chain-contract.md` for the reasoning). The CLI is one subcommand. The on-chain "publish the winners" step is owned by the multisig signer, who reads `winners.csv` and constructs the batched `setWinners` calls.

The contract is the source of truth for who's a winner. The backend's `agent_raffle_winners` table is a local cache for status display — it should match the contract's `allowance` mapping after Day 12. Any divergence is a Day 12 op error, caught by an integration check in the runbook.

---

## The Day 12 operational flow

1. Boarding window closes at `TRANSITION_WINDOW_END`.
2. Operator runs `airdrop-raffle draw --seed <int>`. CLI emits `winners.csv` and `manifest.json` to a local output directory.
3. Operator commits the artifact directory to a private ops repo (or `vultisig/mergecontract`) for durability + audit trail.
4. Operator hands `winners.csv` to the multisig signer.
5. Multisig signer reviews the CSV (row count, eyeball spot-check), splits it into batches of ~100, and calls `AirdropClaim.setWinners(addresses, amounts)` once per batch (~7 txs total for 700 winners).
6. Operator runs `airdrop-raffle load-winners --output-dir <dir>`. Inserts every winner into `agent_raffle_winners` in a single transaction. Stage 1's `/airdrop/status` endpoint immediately starts returning `won` / `lost` to all users.
7. Operator runs `airdrop-raffle verify-onchain --output-dir <dir>`. Reads each row of `winners.csv`, calls `allowance(recipient)` on the contract, asserts each value matches. **This catches multisig batch errors** (missed batch, wrong amount, wrong address) before users start claiming.

Both `load-winners` and `verify-onchain` are simple enough to be added to the same binary as `draw`. The hard work is over once `draw` runs.

---

## Randomness

The randomness source is a `crypto/rand`-generated 64-bit integer the operator captures at draw time. The seed is recorded in `manifest.json` and published in a post-draw note (X post or commit message in the artifact repo). Anyone can re-run the draw with the same seed and verify the same winners.

This is "trust Vultisig but verifiable after the fact" rather than "trustless via on-chain randomness." For a one-shot internal-promotion campaign with a small audience that already trusts Vultisig with their MPC vaults, the simpler approach is appropriate.

---

## Recipient address

`recipient` for each winner is read directly from `agent_airdrop_registrations.recipient_address` — the column is `NOT NULL`, captured client-side at registration time (see Stage 1). The CLI never derives, never inspects vault internals, never falls back. If the registration row is missing for some reason, that's a hard error.

---

## Subcommands

All routed from one binary: `airdrop-raffle <subcommand>`.

### `airdrop-raffle draw`

**Inputs (flags):**

| Flag | Required | Notes |
|---|---|---|
| `--seed <uint64>` | no, default = `crypto/rand` u64 | The PRNG seed. Default mints a fresh random one and prints it; pass explicitly to reproduce a prior draw. |
| `--slot-count <int>` | yes | Number of winners to draw. From Stage 0 decisions. |
| `--vult-amount <decimal>` | yes | VULT per winner, in base units. Accepts up to a `uint256`. |
| `--output-dir <path>` | yes | Local directory for artifacts. Created if missing. |
| `--db-url <conn>` | yes | Postgres connection string. Reads from `agent_airdrop_registrations`. |

**Behavior:**

1. Connect to DB. Read all rows from `agent_airdrop_registrations`.
2. **Hard fail** if registration count == 0 (exit code 2).
3. **Loud warning + proceed** if registration count ≤ slot_count: print a multi-line banner like `WARNING: undersubscribed (50 entries vs 700 slots). All entries will win. Prize pool will be undersubscribed by 650 × amount VULT.` All entries are winners.
4. Otherwise, seed PRNG with `--seed` (or freshly generated u64), run Fisher–Yates shuffle, take the first `slot_count` entries.
5. For each winner, read `recipient_address` from the registration row.
6. Serialize artifacts:
   - `winners.csv` — `public_key, recipient, amount, registered_at, source` per row, header line included. **This is the file the multisig signer reads to construct setWinners batches.**
   - `manifest.json` — `{ seed, slot_count, vult_amount, registration_count, winner_count, draw_timestamp, undersubscribed: bool }`.
7. Write both files to `--output-dir`.
8. Print a summary: winner count, seed, undersubscribed flag, output path. Operator commits the directory to the ops repo for durability.

**Exit codes:** `0` success, `1` input validation error, `2` zero registrations, `4` output write error.

**Idempotency:** re-running with the same `--seed` against the same registrations table produces byte-identical output.

### `airdrop-raffle load-winners`

**Inputs:**

| Flag | Required | Notes |
|---|---|---|
| `--output-dir <path>` | yes | Directory containing `winners.csv` from a prior `draw`. |
| `--db-url <conn>` | yes | |

**Behavior:**

1. Read `winners.csv`.
2. Open a Postgres transaction.
3. **Refuse** if `agent_raffle_winners` already has any rows (raffle already loaded). Operator must explicitly `TRUNCATE agent_raffle_winners` to re-load. Exit non-zero with a clear message.
4. `INSERT INTO agent_raffle_winners (...) VALUES (...)` for every row in the CSV. Batched multi-row INSERT.
5. COMMIT.
6. Print a summary.

**Atomicity:** all winners land in one transaction. Stage 1's `/airdrop/status` flips from `awaiting_draw` → `won` / `lost` for all users in that single commit.

### `airdrop-raffle verify-onchain`

**Inputs:**

| Flag | Required | Notes |
|---|---|---|
| `--output-dir <path>` | yes | |
| `--rpc-url <url>` | yes | Ethereum RPC. Read-only — no signing. |
| `--contract <0x...>` | yes | Deployed `AirdropClaim` address. |

**Behavior:**

1. Read `winners.csv`.
2. For each row, call `allowance(recipient)` on the contract.
3. Assert returned value equals the CSV's `amount`. Print pass/fail per row.
4. Summary: matched / mismatched / total. Exit `0` on full match, non-zero otherwise.

**Why this exists:** the multisig is splitting `winners.csv` into ~7 batched `setWinners` calls, manually. Missed batch, wrong amount, fat-fingered address — all are possible. Running this command after the multisig finishes is the canary that catches those errors *before* users start claiming on Day 28.

This is the spiritual replacement for the old `verify` Merkle subcommand: same intent (catch multisig-side errors at the gate), much simpler implementation (just read the contract, no tree replay).

---

## Schema

```sql
CREATE TABLE agent_raffle_winners (
    public_key  TEXT          PRIMARY KEY,                     -- joins to agent_airdrop_registrations
    recipient   TEXT          NOT NULL,                        -- the 0x... EVM address VULT will be paid to
    amount      NUMERIC(78,0) NOT NULL,
    loaded_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
```

PK on `public_key` covers the only access pattern (Stage 1 status check, Stage 4 claim build). No secondary indexes needed.

`EXISTS(SELECT 1 FROM agent_raffle_winners LIMIT 1)` is the canonical "raffle has been drawn" signal — Stage 1's `/airdrop/status` reads it. `load-winners` runs in a single Postgres transaction, so partial loads aren't a real failure mode.

`recipient` is denormalized from `agent_airdrop_registrations.recipient_address` so the relayer (Stage 4) can build claim calldata in a single PK-lookup against `agent_raffle_winners` without joining.

No `leaf` or `proof[]` columns — those were Merkle artifacts and are gone.

---

## Configuration

No new env vars. All inputs are CLI flags so the same binary can target dev / staging / prod by varying the flags rather than swapping config.

Artifact durability is achieved by the operator committing the output directory to a private ops repo (or `vultisig/mergecontract`) after the draw — same audit trail as a versioned bucket, no AWS dependency in the CLI.

---

## Observability

This is a CLI, not a service — no Prometheus surface. Observability is:

- Structured JSON logs to stdout for each subcommand (one line per major step).
- Presence of any row in `agent_raffle_winners` is the canonical "raffle was drawn" record; ops can `psql` it to confirm.
- The committed artifact directory in the ops repo is the audit trail for prior runs.

---

## Tests

**Unit (in `internal/service/airdrop/raffle/*_test.go`):**
- PRNG produces same output for same seed (regression-tested with a hardcoded seed and expected first 10 outputs).
- Fisher–Yates shuffle is uniform (statistical sanity check across many runs with different seeds).
- Undersubscription path: 10 entries, 700 slots → all 10 win, banner printed.
- Zero entries: hard-fail with exit code 2.
- Oversubscription: 1000 entries, 700 slots → 700 distinct winners, no duplicates.
- Idempotency: same `--seed` + same registrations → byte-identical `winners.csv`.
- Recipient passthrough: `recipient_address` from the registration row appears unchanged in `winners.csv`.

**Integration (real Postgres):**
- Full pipeline: seed registrations table → `draw` → `winners.csv` in output dir → `load-winners` → rows in `agent_raffle_winners`.
- Re-run `load-winners` against already-loaded state → refuses with clear error.
- `verify-onchain` against an Anvil-deployed `AirdropClaim` with full + matching mapping → all pass.
- `verify-onchain` against an Anvil-deployed `AirdropClaim` with deliberately-missing entries → reports the gaps non-zero.

**End-to-end (with `mergecontract`):**
- `draw` → operator splits `winners.csv` and calls `setWinners` in batches against a Foundry-deployed `AirdropClaim.sol` → `verify-onchain` passes → `load-winners` → claim flow (Stage 4) succeeds for a sample winner.

---

## Files

```
cmd/airdrop-raffle/
├── main.go              CLI entrypoint, subcommand routing (cobra or flag stdlib)
├── draw.go              draw subcommand
├── load_winners.go      load-winners subcommand
└── verify_onchain.go    verify-onchain subcommand

internal/service/airdrop/raffle/
├── selection.go         Fisher-Yates draw against a seeded PRNG
└── output.go            Serialize winners.csv + manifest.json

internal/storage/postgres/
├── migrations/XXXXXXXXXXXXXX_create_agent_raffle_winners.sql
└── sqlc/airdrop_raffle.sql      Insert winners (batched), read for verify-onchain
```

No more `leaf_encoding.go`, `merkle.go`. Both deleted along with the cross-language test vector dependency.

---

## Open dependencies

- **Stage 0 — `slot_count` and `vult_amount` decisions locked.** These are CLI flags; without locked values the CLI can run against placeholders in dev but won't ship to mainnet.
- **Stage 0 — private ops repo (or `mergecontract`) available to the operator** for committing artifact directories post-draw.
- **Stage 1 — `recipient_address` column populated.** Done — see Stage 1 spec.
- **Stage 4 — relayer reads `agent_raffle_winners`.** This spec defines the table; Stage 4 spec consumes it.
- **`AirdropClaim.sol` deployed and `setWinners` callable** by the multisig before Day 28. The `verify-onchain` subcommand depends on the contract being live.

---

## Done when

- All three subcommands implemented and unit-tested.
- Integration test against real Postgres + Anvil-deployed contract passes.
- E2E test: drawn winners → multisig sets allowances → `verify-onchain` passes → `load-winners` populates DB → single claim succeeds via Stage 4's relayer against the same contract.
- A short operator runbook (`docs/runbooks/raffle-day-12.md`) drafted: "what to do, in order, on Day 12" — including the multisig signer's batch-construction checklist and the post-batch `verify-onchain` gate.
