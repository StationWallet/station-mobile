# Sibling Spec — On-Chain Contract (`AirdropClaim.sol`)

## What this spec covers

The Solidity contract that holds the VULT prize pool, accepts the raffle merkle root from the multisig owner, and pays VULT to claiming winners. **Owned by the contract engineer** (separate engineer, in the existing `vultisig/mergecontract` repo). Documented here so the backend ↔ contract interface is shared and both teams can review.

The contract is a fork of the team's existing `ETHClaim.sol` per the campaign deck, with simplifications applied during the 2026-04-22 spec-simplification pass.

---

## What changed from the original plan

Two things are off the table compared to the campaign deck's original sketch:

1. **No EIP-712 quest attestation step.** The deck originally had the contract verify a backend-signed `QuestAttestation` before paying out. Dropped 2026-04-22 because the backend is the only relayer (a backend compromise would also compromise any on-chain attestation key, so the on-chain check provided no real defence). Quest eligibility is now enforced backend-side only.
2. **No `tier` field in the leaf.** The original two-tier (Station OG / Vault OG) raffle was simplified to a single pool on 2026-04-21 (Terra Classic eligibility check was dropped). Leaves bind to `(recipient, amount)` only.

What remains is a minimal merkle-claim contract.

---

## Tech stack

- Solidity ^0.8.20+
- Foundry (`forge` for tests, `cast` for deploy)
- OpenZeppelin contracts: `Ownable`, `SafeERC20`, `MerkleProof`
- Ethereum mainnet (chain ID 1)

---

## Contract surface

### Storage

```solidity
contract AirdropClaim is Ownable {
    IERC20 public immutable vult;
    bytes32 public merkleRoot;
    bool public raffleClosed;
    mapping(address => bool) public claimed;
}
```

### Constructor

```solidity
constructor(IERC20 _vult, address _initialOwner)
```

- Stores the VULT token address.
- Sets the owner (the Vultisig multisig).
- `merkleRoot` is zero, `raffleClosed` is false at deploy.

### `closeRaffle(bytes32 _merkleRoot) external onlyOwner`

Owner submits the merkle root from the off-chain raffle draw.

- Reverts if `raffleClosed` is already true (one-shot — the root cannot be changed).
- Sets `merkleRoot = _merkleRoot`.
- Sets `raffleClosed = true`.
- Emits `RaffleClosed(_merkleRoot)`.

### `claim(address recipient, uint256 amount, bytes32[] calldata proof) external`

Anyone can call (in practice the relayer always does). Pays `amount` VULT to `recipient` if the proof is valid and the recipient hasn't claimed yet.

Behavior:
1. Reverts if `!raffleClosed`.
2. Reverts if `claimed[recipient]` is true.
3. Computes the leaf: `keccak256(bytes.concat(keccak256(abi.encode(recipient, amount))))`.
4. Verifies via `MerkleProof.verify(proof, merkleRoot, leaf)`. Reverts if invalid.
5. Sets `claimed[recipient] = true`.
6. Calls `vult.safeTransfer(recipient, amount)`.
7. Emits `Claimed(recipient, amount)`.

Note that the contract is **agnostic to who calls it** — the relayer pays gas in practice, but a winner could claim themselves if they had ETH. The `claimed` mapping is keyed on `recipient`, not `msg.sender`.

### `recoverERC20(IERC20 token, uint256 amount, address to) external onlyOwner`

End-of-campaign cleanup. Owner can pull any ERC-20 (including VULT) from the contract — typically called after the claim window has wound down to reclaim unclaimed VULT.

- Calls `token.safeTransfer(to, amount)`.
- Emits `Recovered(token, amount, to)`.

No restrictions on token / amount / recipient — the owner is trusted (it's the multisig).

### Events

```solidity
event RaffleClosed(bytes32 merkleRoot);
event Claimed(address indexed recipient, uint256 amount);
event Recovered(address indexed token, uint256 amount, address to);
```

The `Claimed` event is what indexers and the relayer's confirmation monitor watch to detect successful payouts.

---

## Merkle leaf encoding (locked contract with backend)

This is the **single highest-risk decision in the entire system**. If the contract's leaf computation differs by a single byte from the backend's, no claim verifies, the merkle root is wrong, and `closeRaffle()` is a one-shot — there's no recovery short of `recoverERC20()` and a re-deploy.

Locked encoding:

```solidity
bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(recipient, amount))));
```

Where:
- `recipient` is `address` (20 bytes).
- `amount` is `uint256` (32 bytes).
- `abi.encode` produces the ABI-encoded form (each value padded to 32 bytes; total 64 bytes).
- The double-hash is OpenZeppelin's standard pattern — it defends against second-preimage attacks where an intermediate node hash could be misrepresented as a leaf.

### Cross-language test vector

Both repos ship a shared `test_vector.json` of the form:

```json
{
  "vectors": [
    {
      "recipient": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      "amount": "1000000000000000000",
      "expected_leaf_hex": "0x..."
    },
    ...
  ]
}
```

The contract repo's Foundry test consumes this file and asserts `_leaf(recipient, amount) == expected_leaf` for each vector. The backend's Go test consumes the same file and asserts the same. Any divergence breaks CI on both sides.

The vector lives in `vultisig/mergecontract` (a `test/leaf_vector.json` file or similar). Backend pulls it via a vendored copy or a path checkout at test time. Same shape applied across the rest of the campaign — there are no other cross-language hashing concerns now that EIP-712 attestations are out.

---

## Tests (Foundry)

- Constructor sets state correctly.
- `closeRaffle` sets root, can't be called twice.
- `closeRaffle` reverts when called by non-owner.
- `claim` with valid proof + amount transfers VULT and marks claimed.
- `claim` reverts with invalid proof.
- `claim` reverts when called twice for the same recipient.
- `claim` reverts when raffle is not yet closed.
- `claim` works regardless of `msg.sender` (relayer or anyone else).
- `recoverERC20` is owner-only; transfers expected amount.
- Cross-language leaf vector: every vector in `test/leaf_vector.json` produces the expected leaf hash.

---

## Deploy + setup steps

The "Day 28 critical path" from the contract side:

1. **Deploy** with `(VULT_TOKEN_ADDRESS, MULTISIG_ADDRESS)` via `script/DeployAirdropClaim.s.sol`.
2. **Verify on Etherscan** (Foundry's `--verify` flag during deploy, or `forge verify-contract` after).
3. **Capture the deployed address** — pass it to backend as `AIRDROP_CLAIM_CONTRACT_ADDRESS` env var.
4. **Multisig sends VULT prize pool** to the contract address. Amount: `slot_count × amount_per_winner × 1.05` (5% buffer per the funding sizing).
5. **Backend (Stage 2)** runs the raffle CLI on Day 12; produces `merkle_root.txt`.
6. **Multisig calls `closeRaffle(root)`** before the relayer goes live on Day 28.
7. **Backend (Stage 4)** relayer goes live; starts processing claims.
8. **End of campaign**: multisig calls `recoverERC20` to pull unclaimed VULT back to treasury.

---

## Cross-mission interfaces

What this contract exposes / consumes from the other missions.

**To the backend:**
- The deployed contract address (post-deploy step 3 above).
- The compiled ABI (Foundry generates this — backend imports for `claim()` calldata construction).
- A local Foundry/Anvil deployment fixture for backend's integration tests against a fork.

**From the backend:**
- The merkle root produced by the Stage 2 raffle CLI. Multisig pulls this from the operator-committed artifact directory.
- The cross-language `test_vector.json` lives here in mergecontract; backend tests consume it.

**To the operator:**
- An `Etherscan` link for `closeRaffle(...)` confirmation.
- An `Etherscan` link for `recoverERC20(...)` confirmation at end of campaign.

---

## Security posture

- **Owner is trusted** — it's the Vultisig multisig. `recoverERC20` is unrestricted because there's no scenario where the multisig wants to be limited.
- **No reentrancy concerns** in `claim` — single external call (`safeTransfer`) at the end after state is updated. VULT is a standard ERC-20 (no callback hooks).
- **`closeRaffle` is one-shot** — accidentally setting the wrong root can only be recovered by `recoverERC20` + re-deploy. The backend's pre-flight verifier (Stage 2) and the multisig signer's independent re-verification protect against this.
- **`claim` has no caller restrictions** — anyone with a valid proof can submit, paying gas. This is intentional: it means a user with their own ETH could in principle claim without the relayer if the relayer is down. (No app UX for this, but the contract supports it.)

---

## Open dependencies

- VULT token deployed at a known address (separate concern, presumably already done).
- Multisig owner address known (probably already exists for other Vultisig contracts).
- Cross-language test vector format finalized with the backend team (Stage 2 spec).
- Free public Ethereum RPC for backend integration testing — operator concern.

---

## Done when

- Contract deployed to mainnet via `script/DeployAirdropClaim.s.sol` and verified on Etherscan.
- All Foundry tests passing.
- Cross-language leaf vector verified on both sides.
- Multisig has tested the `closeRaffle` flow on a testnet (Sepolia or similar) end-to-end.
- Multisig has tested `recoverERC20` on testnet.
- Backend's integration tests pass against a Foundry-deployed fixture of this contract.
