# Stage 2 — Raffle Draw

## What this stage does

After the boarding window closes on Day 12, fairly pick the winners, package the result in a format the on-chain contract can verify, and hand the resulting Merkle root to the multisig owner so they can publish it via `closeRaffle(root)`. Then load each winner's proof into Postgres so the relayer (Stage 4) can serve them.

This is a one-shot operation, run by a human operator on Day 12. The CLI is structured as three deliberate subcommands with human checkpoints between each. There is no automated path from "draw" to "live" — every step requires an operator action, and `closeRaffle()` itself is always a multisig signer action, never a CLI call.

The single highest-risk failure mode in this stage is the Merkle leaf encoding mismatching the on-chain contract — wrong root would brick every claim, and the root is a one-shot owner transaction. This stage exists in part to give that mismatch every opportunity to be caught: by the cross-language test vector, by the pre-flight verifier subcommand, and by the operator's human eyeballs.

---

## The Day 12 operational flow

1. Boarding window closes at `TRANSITION_WINDOW_END`.
2. Operator runs `airdrop-raffle draw --seed <int>`. CLI emits `winners.csv`, `merkle_tree.json`, `proofs.json`, `merkle_root.txt`, `manifest.json` to a local output directory.
3. Operator runs `airdrop-raffle verify --output-dir <dir>`. Re-hashes the tree, asserts the root matches `merkle_root.txt`, verifies every proof against the recomputed root. **This is the gate before the multisig signs.**
4. Operator commits the artifact directory to a private ops repo (or `vultisig/mergecontract`) for durability + audit trail.
5. Operator hands `merkle_root.txt` to the multisig signer.
6. Multisig signer optionally re-runs the verify step from a different machine, then calls `AirdropClaim.closeRaffle(merkleRoot)` on mainnet.
7. Operator runs `airdrop-raffle load-proofs --output-dir <dir>`. Inserts every proof into `agent_raffle_proofs` in a single transaction. Stage 1's `/airdrop/status` endpoint immediately starts returning `won` / `lost` to all users.

---

## Randomness

The randomness source is `crypto/rand`-generated 64-bit integer the operator captures at draw time. The seed is recorded in `manifest.json` and published in a post-draw note (X post or commit message in the artifact repo). Anyone can re-run the draw with the same seed and verify the same winners.

This is "trust Vultisig but verifiable after the fact" rather than "trustless via on-chain randomness." For a one-shot internal-promotion campaign with a small audience that already trusts Vultisig with their MPC vaults, the simpler approach is appropriate.

---

## Leaf encoding

**Provisional, pending review of `ETHClaim.sol` in `vultisig/mergecontract`.** Subject to change if the existing contract's encoding differs.

```
leaf = keccak256(bytes.concat(keccak256(abi.encode(recipient, amount))))
```

Where `recipient` is a 20-byte EVM address and `amount` is a `uint256` representing VULT in base units (the contract's smallest unit, typically 1e18 per VULT for an ERC-20).

This is the OpenZeppelin standard double-hashed leaf. The double hash defends against second-preimage attacks where an intermediate node hash could be misrepresented as a leaf. Compatible with OZ's off-the-shelf `MerkleProof.sol`, which the contract mission is expected to use.

The encoding is locked into a `LEAF_ENCODING.md` and `test_vector.json` in the `mergecontract` repo (see Stage 0 cross-mission alignment). Both this CLI and the Solidity contract test the same vector. Any divergence fails CI on both sides.

---

## Recipient address

`recipient` for each winner is read directly from `agent_airdrop_registrations.recipient_address` — the column is `NOT NULL`, captured client-side at registration time (see Stage 1). The CLI never derives, never inspects vault internals, never falls back. If the registration row is missing for some reason, that's a hard error.

---

## Subcommands

All three are routed from one binary: `airdrop-raffle <subcommand>`.

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
6. For each winner, build the leaf using the locked encoding.
7. Build the Merkle tree over all leaves. Compute the root.
8. Serialize artifacts:
   - `winners.csv` — `public_key, recipient, amount, registered_at, source` per row, header line included.
   - `merkle_tree.json` — full tree (all internal node hashes) for audit.
   - `proofs.json` — `{ public_key: { leaf, proof: [hex_hash, ...] } }` map.
   - `merkle_root.txt` — single hex string, no newline, no `0x` prefix (for unambiguous copy-paste into the multisig tx).
   - `manifest.json` — `{ seed, slot_count, vult_amount, registration_count, winner_count, leaf_encoding_version, draw_timestamp, undersubscribed: bool }`.
9. Write all five files to `--output-dir`.
10. Print a summary: winner count, root hex, seed, undersubscribed flag. Operator commits the directory to the ops repo for durability.

**Exit codes:** `0` success, `1` input validation error, `2` zero registrations, `4` output write error.

**Idempotency:** re-running with the same `--seed` against the same registrations table produces byte-identical output. Same `--output-dir` is overwritten by the operator's intent.

### `airdrop-raffle verify`

**Inputs:**

| Flag | Required | Notes |
|---|---|---|
| `--output-dir <path>` | yes | Directory containing artifacts from a prior `draw`. |
| `--sample-size <int>` | no, default 10 | How many proofs to spot-check. |

**Behavior:**

1. Read `merkle_tree.json`, `merkle_root.txt`, `proofs.json`.
2. Re-hash the tree from the leaves up using the same encoding. Assert the recomputed root equals `merkle_root.txt`.
3. Pick `--sample-size` random proofs from `proofs.json`. For each, run the standard Merkle proof verification: walk the proof path from the leaf, recompute the root, assert it equals `merkle_root.txt`.
4. Print pass/fail per check.
5. Exit `0` on all-pass, non-zero on any failure.

**Why this exists:** before the multisig signer broadcasts `closeRaffle()`, this command provides a clean cryptographic "yes, the file you're about to commit on-chain matches the tree we drew" assertion. The operator runs it; the multisig signer can run it independently from a different machine.

### `airdrop-raffle load-proofs`

**Inputs:**

| Flag | Required | Notes |
|---|---|---|
| `--output-dir <path>` | yes | |
| `--db-url <conn>` | yes | |

**Behavior:**

1. Re-run the full `verify` checks first (defensive — if verify fails, refuse to load).
2. Read `proofs.json`, `merkle_root.txt`, `manifest.json`.
3. Open a Postgres transaction.
4. **Refuse** if `agent_raffle_proofs` already has any rows (raffle already loaded). Operator must explicitly `TRUNCATE agent_raffle_proofs` to re-load. Exit non-zero with a clear message.
5. `INSERT INTO agent_raffle_proofs (...) VALUES (...)` for every winner. Batched multi-row INSERT.
6. COMMIT.
7. Print a summary.

**Atomicity:** all proofs land in one transaction. Stage 1's `/airdrop/status` flips from `awaiting_draw` → `won` / `lost` for all users in that single commit.

---

## Schema

```sql
CREATE TABLE agent_raffle_proofs (
    public_key  TEXT          PRIMARY KEY,                     -- joins to agent_airdrop_registrations
    recipient   TEXT          NOT NULL,                        -- the 0x... EVM address VULT will be paid to
    amount      NUMERIC(78,0) NOT NULL,
    leaf        BYTEA         NOT NULL,                        -- 32 bytes
    proof       BYTEA[]       NOT NULL,                        -- array of 32-byte sibling hashes (root-side last)
    loaded_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
```

PK on `public_key` covers the only access pattern (Stage 1 status check, Stage 4 claim build). No secondary indexes needed.

`EXISTS(SELECT 1 FROM agent_raffle_proofs LIMIT 1)` is the canonical "raffle has been drawn" signal — Stage 1's `/airdrop/status` reads it. `load-proofs` runs in a single Postgres transaction, so partial loads aren't a real failure mode and a separate state table is unnecessary.

`recipient` is denormalized from `agent_airdrop_registrations.recipient_address` so the relayer (Stage 4) can build claim calldata in a single PK-lookup against `agent_raffle_proofs` without joining.

---

## Configuration

No new env vars. All inputs are CLI flags so the same binary can target dev / staging / prod by varying the flags rather than swapping config.

Artifact durability is achieved by the operator committing the output directory to a private ops repo (or `vultisig/mergecontract`) after the draw — same audit trail as a versioned bucket, no AWS dependency in the CLI.

---

## Observability

This is a CLI, not a service — no Prometheus surface. Observability is:

- Structured JSON logs to stdout for each subcommand (one line per major step).
- The `agent_airdrop_state` row IS the canonical "raffle was drawn" record; ops can `psql` it to confirm.
- S3 versioned object lifecycle is the audit trail for prior runs.

---

## Tests

**Unit (in `internal/service/airdrop/raffle/*_test.go`):**
- Leaf encoding matches the cross-language `test_vector.json` (loaded from disk; same file as `mergecontract`'s Foundry test).
- PRNG produces same output for same seed (regression-tested with a hardcoded seed and expected first 10 outputs).
- Fisher–Yates shuffle is uniform (statistical sanity check across many runs with different seeds).
- Undersubscription path: 10 entries, 700 slots → all 10 win, banner printed.
- Zero entries: hard-fail with exit code 2.
- Oversubscription: 1000 entries, 700 slots → 700 distinct winners, no duplicates.
- Idempotency: same block hash + same registrations → same merkle root, same proofs.
- Recipient passthrough: `recipient_address` from the registration row appears unchanged in the resulting leaf and `winners.csv`.

**Integration (real Postgres):**
- Full pipeline: seed registrations table → `draw` → artifacts in output dir → `verify` passes → `load-proofs` → proofs in DB.
- Re-run `load-proofs` against already-loaded state → refuses with clear error.
- `verify` against deliberately-corrupted `merkle_tree.json` → fails non-zero.
- `verify` against deliberately-corrupted `proofs.json` (one bad proof in 1000) → catches the bad proof if it's in the sample, otherwise passes (sampling is acknowledged probabilistic).

**Cross-language (with `mergecontract`):**
- `test_vector.json` round-trips: Go encoder produces the same `expected_leaf_hex` as the Foundry test.
- E2E: drawn root → `closeRaffle(root)` on a Foundry-deployed `AirdropClaim.sol` → submit a single proof + recipient + amount via the contract's verify path → contract accepts.

---

## Files

```
cmd/airdrop-raffle/
├── main.go              CLI entrypoint, subcommand routing (cobra or flag stdlib)
├── draw.go              draw subcommand
├── verify.go            verify subcommand
└── load_proofs.go       load-proofs subcommand

internal/service/airdrop/raffle/
├── selection.go         Fisher-Yates draw against a seeded PRNG
├── leaf_encoding.go     ← Highest-risk file. Must match Solidity byte-for-byte. Tested against shared vector.
├── merkle.go            Tree build + proof generation (wraps a vetted library; no hand-rolled merkle math)
└── output.go            Serialize artifacts to disk

internal/storage/postgres/
├── migrations/XXXXXXXXXXXXXX_create_agent_raffle_proofs.sql
└── sqlc/airdrop_raffle.sql      Insert proofs (batched), read for verify
```

---

## Open dependencies

- **Stage 0 — leaf encoding test vector finalized in `mergecontract`.** The Go encoder test won't pass until the vector exists. Block on this before merging the `leaf_encoding.go` PR.
- **Stage 0 — `slot_count` and `vult_amount` decisions locked.** These are CLI flags; without locked values the CLI can run against placeholders in dev but won't ship to mainnet.
- **Stage 0 — private ops repo (or `mergecontract`) available to the operator** for committing artifact directories post-draw.
- **Stage 1 — `recipient_address` column added** (done — see Stage 1 spec amendment).
- **Stage 4 — relayer reads `agent_raffle_proofs`.** This spec defines the table; Stage 4 spec consumes it.
- **`ETHClaim.sol` review.** The leaf encoding above is provisional. Once the contract mission has a draft, confirm the encoding matches; otherwise this spec needs an update.

---

## Done when

- All three subcommands implemented and unit-tested.
- Cross-language test vector verifies on both sides (Go test in this repo + Foundry test in `mergecontract`).
- Integration test against real Postgres passes.
- E2E test: drawn root submitted to Foundry-deployed `AirdropClaim.sol`, single winner proof verified by the contract.
- Pre-flight `verify` subcommand demonstrated to detect a deliberately-corrupted tree.
- A short operator runbook (`docs/runbooks/raffle-day-12.md`) drafted: "what to do, in order, on Day 12."
