# Vultiverse Airdrop — Spec Index

A 28-day promotional airdrop for the Station → VultiAgent rebrand. Users board during a 5-day window, a fixed number win the raffle, winners complete 3 of 5 in-app activities, then claim VULT through the agent — with the backend paying gas via a relayer wallet.

For a non-technical walkthrough start with [`overview.md`](overview.md). Technical detail lives in the per-component specs below — they are the canonical source of truth, this file is just navigation.

## Backend (this team)

- [`shared-concerns.md`](shared-concerns.md) — Cross-cutting infrastructure: auth model, env-var inventory, schema overview, shared Go packages, implementation order. **Read first.**
- [`stage-0-preflight.md`](stage-0-preflight.md) — Procurement, cross-mission alignment, treasury, and the decisions table for Strategy/Founder. No code outputs.
- [`stage-1-boarding.md`](stage-1-boarding.md) — Days 8–12. Three endpoints (`POST /airdrop/register`, `GET /airdrop/status`, `GET /airdrop/stats`), one table.
- [`stage-2-raffle-draw.md`](stage-2-raffle-draw.md) — Day 12. Single `airdrop-raffle` CLI with `draw`, `load-winners`, `verify-onchain` subcommands. Hands `winners.csv` to the multisig for batched `setWinners(...)` calls. One table for winners.
- [`stage-3-quest-tracking.md`](stage-3-quest-tracking.md) — Days 13–27. One internal endpoint, two tables, hard-coded validators per quest type. Backend-side eligibility (no on-chain attestation).
- [`stage-4-claim-relayer.md`](stage-4-claim-relayer.md) — Day 28+. On-chain submission path, operator UI, confirmation monitor. Two tables.

## Sibling missions (other engineers)

- [`sibling-mobile-app.md`](sibling-mobile-app.md) — Mobile app changes: UI flows, EVM address derivation, polling cadence, error UX.
- [`sibling-on-chain-contract.md`](sibling-on-chain-contract.md) — `AirdropClaim.sol` surface (mapping-based allowance, no Merkle), deploy + `setWinners` steps.

## Source ticket

[ai-combinator/vultihub#18](https://github.com/ai-combinator/vultihub/issues/18) — the upstream mission.
