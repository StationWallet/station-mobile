# Sibling Spec — On-Chain Contract (`AirdropClaim.sol`)

## What this spec covers

The Solidity contract that holds the VULT prize pool, accepts a per-recipient allowance map from the multisig owner, and pays VULT to claiming winners. **Owned by the contract engineer** (separate engineer, in the existing `vultisig/vultisig-contract` repo). Documented here so the backend ↔ contract interface is shared and both teams can review.

The contract is net-new code in `vultisig/vultisig-contract` (no existing `ETHClaim.sol` to fork from — the campaign deck's reference was aspirational). Patterns follow the team's existing contracts in that repo (`Stake.sol`, `Token.sol`, `LaunchList.sol`) — Foundry-built, OZ ^5.2.0, Solidity ^0.8.28. The simplified surface (mapping-based allowance + setWinners + claim) reflects the 2026-04-22 (eligibility moves backend-side) and 2026-04-23 (Merkle dropped) decisions.

---

## What changed from the original plan

Three things are off the table compared to the campaign deck's original sketch:

1. **No EIP-712 quest attestation step.** The deck originally had the contract verify a backend-signed `QuestAttestation` before paying out. Dropped 2026-04-22 because the backend is the only relayer (a backend compromise would also compromise any on-chain attestation key, so the on-chain check provided no real defence). Quest eligibility is now enforced backend-side only.
2. **No `tier` field.** The original two-tier (Station OG / Vault OG) raffle was simplified to a single pool on 2026-04-21 (Terra Classic eligibility check was dropped). All winners receive the same `amount`.
3. **No Merkle tree.** Dropped 2026-04-23 after a careful gas + complexity comparison. For 700 winners with a centralised relayer paying gas, the Merkle approach was actually *more* expensive (~$7k vs ~$5k all-in at 30 gwei, due to per-claim proof verification gas), and added the highest-risk failure mode in the entire system (cross-language leaf encoding mismatch). The current design stores winner allowances in a `mapping(address => uint256)` populated by the multisig before the claim window opens.

What remains is a minimal allowance-based claim contract — about 30 lines of Solidity.

---

## Tech stack

- Solidity ^0.8.28 (matches existing `Token.sol` in vultisig-contract)
- Foundry (`forge` for tests, `cast` for deploy) — `foundry.toml` already in repo root
- OpenZeppelin contracts ^5.2.0 (already vendored under `lib/openzeppelin-contracts`): `Ownable`, `SafeERC20`
- Ethereum mainnet (chain ID 1)

---

## Contract surface

### Storage

```solidity
contract AirdropClaim is Ownable {
    IERC20  public immutable vult;
    mapping(address => uint256) public allowance;   // recipient => VULT amount; 0 = not winner OR already claimed
}
```

That's it. No merkle root, no claimed mapping, no `raffleClosed` bool. The single mapping is both the eligibility check and the dedup mechanism — `claim()` zeros the slot.

### Constructor

```solidity
constructor(IERC20 _vult, address _initialOwner)
```

- Stores the VULT token address.
- Sets the owner (the Vultisig multisig).
- `allowance` mapping is empty at deploy.

### `setWinners(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner`

Owner populates the allowance map. Called by the multisig in batched chunks (~100 entries per tx) on Day 12, after the off-chain raffle draw produces `winners.csv`.

Behavior:
1. Reverts if `recipients.length != amounts.length`.
2. For `i` in `recipients`: `allowance[recipients[i]] = amounts[i]`.
3. Emits one `WinnerSet(recipient, amount)` per entry (so indexers + the operator can audit who got allocated what).

**Idempotency / re-entry:** can be called multiple times. Re-running with the same address overwrites the allowance — this is intentional (lets the multisig fix typos, add missed winners, or zero out an entry that shouldn't have been included). It's also the operational footgun: **don't include addresses that have already claimed**, because that would re-arm them. This is documented in the Day 12 runbook; the multisig signer's checklist includes "diff against any prior `setWinners` calls + any confirmed `Claimed` events."

### `claim(address recipient) external`

Anyone can call (in practice the relayer always does). Pays the recipient's allowance, zeros the slot.

Behavior:
1. `uint256 amount = allowance[recipient]`.
2. Reverts if `amount == 0` (`"no allowance"`).
3. `allowance[recipient] = 0`.
4. Calls `vult.safeTransfer(recipient, amount)`.
5. Emits `Claimed(recipient, amount)`.

Note that the contract is **agnostic to who calls it** — the relayer pays gas in practice, but a winner could claim themselves if they had ETH. Allocation is keyed on `recipient`, not `msg.sender`.

### `recoverERC20(IERC20 token, uint256 amount, address to) external onlyOwner`

End-of-campaign cleanup. Owner can pull any ERC-20 (including VULT) from the contract — typically called after the claim window has wound down to reclaim unclaimed VULT.

- Calls `token.safeTransfer(to, amount)`.
- Emits `Recovered(token, amount, to)`.

No restrictions on token / amount / recipient — the owner is trusted (it's the multisig).

### Events

```solidity
event WinnerSet(address indexed recipient, uint256 amount);
event Claimed(address indexed recipient, uint256 amount);
event Recovered(address indexed token, uint256 amount, address to);
```

The `Claimed` event is what the relayer's confirmation monitor watches to detect successful payouts. The `WinnerSet` event is the audit trail for "who did the multisig allocate VULT to."

---

## Per-claim gas (budget context)

Approximate gas accounting at 30 gwei:

| Item | Gas |
|---|---|
| Tx base + calldata (`claim(address)` is small) | ~25,000 |
| Read `allowance[recipient]` | 2,100 |
| Write `allowance[recipient] = 0` (refund-eligible) | ~0 net (refund cap) |
| ERC-20 transfer to fresh recipient (cold SSTORE on their balance) | ~33,000 |
| Emit `Claimed` | ~1,500 |
| **Total** | **~62,000** |

700 claims × 62k × 30 gwei ≈ 0.13 ETH (~$455). Stage 0 provisions ~5 ETH at the relayer for buffer against gas spikes and rebroadcasts.

---

## Tests (Foundry)

- Constructor sets owner + token correctly.
- `setWinners` populates the mapping; `WinnerSet` events match.
- `setWinners` reverts on length mismatch.
- `setWinners` reverts when called by non-owner.
- `setWinners` is re-callable; second call overwrites.
- `claim` with non-zero allowance transfers VULT, zeros slot, emits `Claimed`.
- `claim` reverts when allowance is zero (never set OR already claimed).
- `claim` reverts when called twice for the same recipient (second call sees zeroed slot).
- `claim` works regardless of `msg.sender` (relayer or anyone else).
- `recoverERC20` is owner-only; transfers expected amount.

No cross-language test vector. No Merkle proof tests.

---

## Deploy + setup steps

The "Day 0 → Day 28 critical path" from the contract side:

1. **Deploy** with `(VULT_TOKEN_ADDRESS, MULTISIG_ADDRESS)` via `script/DeployAirdropClaim.s.sol`. Can happen any time before Day 12 — no dependency on the raffle draw.
2. **Verify on Etherscan** (Foundry's `--verify` flag during deploy, or `forge verify-contract` after).
3. **Capture the deployed address** — pass it to backend as `AIRDROP_CLAIM_CONTRACT_ADDRESS` env var.
4. **Multisig sends VULT prize pool** to the contract address. Amount: `slot_count × amount_per_winner × 1.05` (5% buffer per the funding sizing).
5. **Backend (Stage 2)** runs the raffle CLI on Day 12; produces `winners.csv`.
6. **Multisig calls `setWinners(addresses, amounts)`** in batched chunks (~100/batch, ~7 txs total for 700 winners) before the relayer goes live on Day 28.
7. **Backend (Stage 4)** relayer goes live; starts processing claims.
8. **End of campaign**: backend operator flips `CLAIM_ENABLED=false` so the relayer stops accepting new claims. Multisig then calls `recoverERC20(VULT_TOKEN, vult.balanceOf(thisContract), treasuryAddress)` to drain unclaimed VULT back to treasury. The contract is then dormant — no `selfdestruct`, no upgrade path. Stays deployed indefinitely so the public can verify the historical state on Etherscan.

Setup gas (one-time): ~700k for deploy + ~18M total across the setWinners batches ≈ **~$2k at 30 gwei** (~$6k at 100 gwei spike). Treasury should be aware of this Day 12 burn.

---

## Cross-mission interfaces

**To the backend:**
- The deployed contract address (post-deploy step 3 above).
- The compiled ABI (Foundry generates this — backend imports for `claim()` calldata construction).
- A local Foundry/Anvil deployment fixture for backend's integration tests against a fork.

**From the backend:**
- The `winners.csv` artifact produced by the Stage 2 raffle CLI. Multisig pulls this from the operator-committed artifact directory and constructs the batched `setWinners` calls.

**To the operator:**
- An Etherscan link per `setWinners` batch confirmation.
- An Etherscan link for `recoverERC20(...)` confirmation at end of campaign.

---

## Security posture

- **Owner is trusted** — it's the Vultisig multisig. `recoverERC20` is unrestricted because there's no scenario where the multisig wants to be limited.
- **No reentrancy concerns** in `claim` — single external call (`safeTransfer`) at the end after state is updated. VULT is a standard ERC-20 (no callback hooks).
- **`setWinners` is repeatable, with one footgun.** Re-calling for an already-claimed address re-arms their allowance and lets them claim again. Mitigated operationally by the multisig signer's checklist (diff against confirmed `Claimed` events). Could be hardened by adding a separate `mapping(address => bool) claimed` and refusing to overwrite, but that adds gas and storage; the operational mitigation is judged sufficient.
- **`claim` has no caller restrictions** — anyone with an allowance can submit, paying gas. This is intentional: it means a user with their own ETH could in principle claim without the relayer if the relayer is down. (No app UX for this, but the contract supports it.)

---

## Open dependencies

- **VULT token mainnet address — UNKNOWN.** `Token.sol` exists in `vultisig-contract` but no deployment config in the repo references a deployed mainnet address. Must be confirmed with whoever holds the VULT token contract before deploy. Hard blocker for the constructor.
- **Multisig owner address — UNKNOWN.** No precedent in the repo's existing `script/Deploy*.s.sol` files. Must be confirmed with whoever holds the Vultisig treasury multisig. Hard blocker for the constructor's `_initialOwner` argument.
- Free public Ethereum RPC for backend integration testing — operator concern.

Both UNKNOWN items are tracked in Stage 0's procurement section as hard prerequisites (see `stage-0-preflight.md`).

---

## Done when

- Contract deployed to mainnet via `script/DeployAirdropClaim.s.sol` and verified on Etherscan.
- All Foundry tests passing.
- Multisig has tested the `setWinners` + `claim` flow on a testnet (Sepolia or similar) end-to-end.
- Multisig has tested `recoverERC20` on testnet.
- Backend's integration tests pass against a Foundry-deployed fixture of this contract.
