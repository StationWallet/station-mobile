# Stage 0 — Pre-flight Setup

Personal punchlist of everything that has to be in place before Stage 1 code can ship. No code outputs — every item here is procurement, coordination, or a decision someone else owns. Tick boxes as items complete.

Sequenced by what blocks what. The Decisions table at the top is the artifact to drop into a Slack thread with Founder/Strategy.

> **2026-04-21 update:** Stakeholders dropped the Terra Classic eligibility check. The two-tier (Station OG / Vault OG) split is gone — there's now one raffle pool, one slot count, one VULT amount per winner. Archive node procurement, hosting account, Mintscan/Hexxagon outreach, and the snapshot extractor are all out of scope.
>
> **2026-04-23 update:** Merkle tree dropped in favour of an on-chain `mapping(address => uint256) allowance` populated by the multisig via batched `setWinners(...)` calls. The "leaf encoding spec + cross-language test vector" cross-mission item is gone (was deck Risk #1). The multisig signer now needs to budget gas for ~7 batched setWinners txs on Day 12 (~$2k at 30 gwei, up to ~$6k in a gas spike) — flag to whoever holds the ETH treasury.

---

## Decisions to push to Strategy/Founder

Drop this table into a Slack thread. Each row needs a yes-on-default or an override. Defaults are from the campaign deck where one exists.

| # | Decision | Default | Why we need it locked | Owner |
|---|---|---|---|---|
| 1 | Slot count (number of winners) | TBD (deck previously implied ~700 across two tiers) | Sizes the raffle pool and total VULT budget | Founder |
| 2 | VULT per winner | TBD (deck previously had a 1,500 / 3,000 split — pick one number now) | Sizes total VULT prize budget | Founder |
| 3 | `TRANSITION_WINDOW_END` (boarding closes) | TBD | When `/airdrop/register` starts rejecting | Strategy |
| 4 | `QUEST_ACTIVATION_TIMESTAMP` (Day 13 wall clock) | TBD | Quest events fired before this are rejected | Strategy |
| 5 | `DEFI_ACTION_CONTRACT_ALLOWLIST` | TBD | Which contract addresses count for the DeFi quest | Product |
| 6 | Beta launch date (Day 28) | TBD | Drives in-app countdown + claim window open | Founder |
| 7 | Recovery timeout (claim window length) | TBD | How long after Day 28 the claim endpoint stays open | Strategy/Eng |
| 8 | Final 5-quest list | swap, bridge, defi_action, alert?, DCA? | Quest validators can't ship without exact list | Product |

Engineering-side decisions (don't need Founder, but lock before deploy):

| # | Decision | Default | Owner |
|---|---|---|---|
| 9 | KMS provider | AWS KMS | Eng lead |
| 10 | Stuck-tx auto-bump in v1 | No (manual re-broadcast) | Eng lead |
| 11 | Raffle randomness source | `crypto/rand` u64 seed, recorded in the post-draw manifest for audit | Eng lead |
| 12 | `quest_metadata` JSONB schema locked across MCP, agent-backend, and airdrop teams | Schema in `stage-3-quest-tracking.md` "Cross-team contract" section | MCP eng + agent-backend eng + airdrop eng |

---

## Procurement

- [ ] **Spend approval.**
  - What: Budget sign-off for AWS KMS (negligible, <$10/mo) and one-time treasury asks (~5 ETH + the VULT prize pool).
  - Done when: Whoever owns the budget says yes in writing (Slack message, email, or signed-off doc) I can point back to.

- [ ] **AWS account / sub-account.**
  - What: An AWS account where airdrop infra lives. Immediate use is KMS (Stages 3+4); could later host RDS replicas or other infra.
  - Done when: I have IAM access with permission to create KMS keys, and the billing owner is named.

- [ ] **One AWS KMS key for the relayer wallet.**
  - What: `airdrop-relayer-wallet` — signs EIP-1559 EVM transactions when paying out VULT claims. `Sign` permission only, scoped to the agent-backend service identity.
  - Done when: ARN is in env var (`KMS_RELAYER_KEY_ARN`) and a test goroutine in agent-backend can sign + verify a no-op message via it. The EVM address derived from the key's public key is captured for treasury funding.
  - Depends on: AWS account.
  - Note: original plan included a second `airdrop-quest-oracle` KMS key for EIP-712 attestations. Dropped 2026-04-22 — eligibility is enforced backend-side, not on-chain, since the backend is the only relayer (a backend compromise would also compromise any on-chain attestation key, so the attestation provided no real defence).

---

## Cross-mission alignment

- [ ] **vultisig-contract ownership decided.**
  - What: Decide whether the Solidity work in `vultisig/vultisig-contract` is mine end-to-end or a teammate's. Determines whether the next item is "write the contract" or "agree the spec with them."
  - Done when: Assignment is named in writing — Slack, this doc, or a GitHub issue on vultisig-contract.
  - Note: there is no existing `ETHClaim.sol` in `vultisig-contract` to fork from (campaign deck reference was aspirational). `AirdropClaim.sol` is net-new; pattern after the repo's existing `Stake.sol` / `Token.sol` style.

- [ ] **Multisig owner address captured.**
  - What: The mainnet address of the Vultisig multisig that will own `AirdropClaim.sol` — passed as the constructor's `_initialOwner` and the only address authorised to call `setWinners`, `closeRaffle`, `recoverERC20`. No precedent for this address in `vultisig/vultisig-contract`'s existing `script/Deploy*.s.sol` files, so it must be confirmed externally with the treasury team.
  - Done when: address is recorded in this doc and in `script/DeployAirdropClaim.s.sol` (or the deploy `.env`).
  - Depends on: nothing — pure ask.

- [ ] **VULT mainnet token address captured.**
  - What: The deployed mainnet ERC-20 address of VULT. `Token.sol` exists in `vultisig-contract` but no deployment config references a deployed address — must be confirmed with whoever holds the VULT token contract.
  - Done when: address is recorded in this doc and in `script/DeployAirdropClaim.s.sol` (or the deploy `.env`). The contract's constructor `_vult` argument is fed from this.
  - Depends on: nothing — pure ask.
  - Why both this and the previous item are blockers: the `AirdropClaim.sol` constructor takes both as required arguments. Without them, the deploy script is incomplete.

- [ ] **`quest_metadata` cross-team contract locked.**
  - What: The `agent_tx_proposals.quest_metadata` JSONB shape is agreed and committed by all three teams (MCP server, agent-backend, airdrop eng). Schema lives in `stage-3-quest-tracking.md` "Cross-team contract" section. MCP-side build_* tools emit it; agent-backend-side scheduler.go writes it to the new column at proposal-creation time.
  - Done when: PR open in `vultisig/mcp` adding `quest_metadata` to at least `build_swap_tx` and `build_evm_tx` results; PR open in `vultisig/agent-backend` adding the migration + scheduler.go change. Both reviewed and merged before Stage 3 ships.
  - Why this is Stage 0: Stage 3 is hard-blocked on this. Without `quest_metadata`, the airdrop module has no reliable way to classify or evaluate a tx and quest tracking can't function.

- [ ] **App team API shapes confirmed.**
  - What: Whoever's building the agent-app registration + status UI agrees the request/response shapes for `POST /airdrop/register`, `GET /airdrop/status`, `POST /airdrop/claim`.
  - Done when: A short shared doc or OpenAPI fragment is pinned somewhere both teams can see, and the app team can mock against it.

- [ ] **Artifact storage repo identified.**
  - What: A private repo (or a folder in `vultisig/vultisig-contract`) where the operator commits the Day 12 raffle artifacts (`winners.csv`, `manifest.json`) for durability + audit. Multisig signer pulls `winners.csv` from here to construct the batched `setWinners(...)` calls.
  - Done when: Repo path is named, operator has push access, decision recorded in this doc.

---

## Treasury

- [ ] **Relayer wallet funded with ETH.**
  - What: ~5 ETH at the relayer wallet address (the EVM address derived from `KMS_RELAYER_KEY_ARN`'s public key). Sized for the planned winner count at 30 gwei + buffer.
  - Done when: ETH visible at the relayer address on Etherscan; the multisig owner who funded it confirms; a refill runbook is written down for Day 28+.
  - Depends on: KMS keys (so the relayer address is known); spend approval.

- [ ] **VULT prize pool funded.**
  - What: `slot_count × amount_per_winner × 1.05` VULT, sent to the deployed `AirdropClaim.sol` contract.
  - Done when: Tokens visible at the contract address on Etherscan; multisig owner confirms.
  - Depends on: Decisions table rows 1–2 locked; vultisig-contract deployed (separate mission).

---

## Stage 0 done when

Every checkbox above is ticked, the decisions table has been signed off (or overrides applied to env defaults), and the test scripts referenced in "Done when" lines have been run successfully. At that point Stage 1 code can be written and deployed against real infrastructure with no placeholder values left.
