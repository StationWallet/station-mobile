# Vultiverse Airdrop — Plain-English Overview

A non-technical end-to-end walkthrough of what this campaign is and what gets built. For the technical spec index see [`README.md`](README.md). Component-by-component:

- **Backend** (this team) — [`stage-0-preflight.md`](stage-0-preflight.md) through [`stage-4-claim-relayer.md`](stage-4-claim-relayer.md), plus [`shared-concerns.md`](shared-concerns.md).
- **Mobile app** (sibling mission) — [`sibling-mobile-app.md`](sibling-mobile-app.md).
- **On-chain contract** (sibling mission) — [`sibling-on-chain-contract.md`](sibling-on-chain-contract.md).

---

## The setup

Vultisig is rebranding **Station Wallet** (a wallet app with around 500k installs that mostly sit dormant on people's phones) into **VultiAgent** — a chat-style crypto wallet where you talk to your wallet and it does things for you ("swap 100 USDC for ETH", "bridge to Arbitrum", etc.).

To wake those dormant users up, mark the relaunch, and create a viral moment, we're running an airdrop. Some users will get free **VULT** (Vultisig's token) for participating early.

---

## How a user experiences it

Imagine you're a Station Wallet user who hasn't opened the app in a year.

**Day 1–7.** Vultisig posts teaser content on social media. You start seeing hints something's coming.

**Day 8.** The Station app updates on your phone. You open it, see the new VultiAgent branding, and a screen says "import your seed phrase or vault to enter the raffle for free VULT." You import. The app shows "you're aboard, here's a countdown screen until the launch." You're now an entrant in a raffle.

**Day 12.** The boarding window closes. Behind the scenes, we draw a fixed number of winners (say 700, of however many imported). Winners' app screens update: "you won! Complete 3 in-app activities to claim your VULT." Losers see: "thanks for boarding, no win this time."

**Day 13–27.** You're a winner. To unlock the claim, you have to do **3 of 5 in-app activities** through the agent — swap a token, bridge between chains, do a DeFi action, etc. The agent is fully functional during this window so you're using the new product as you earn the right to claim.

**Day 28+.** You finished 3 quests. The app shows a big "claim my VULT" button. You tap it. A few seconds later, VULT appears in your wallet. You never paid gas, you never approved a transaction, you never had any ETH — the backend handled all of that on your behalf. This is the **hero moment** for the campaign — "I talked to my wallet and tokens appeared."

---

## What the backend has to do, end to end

Five things, sequenced by when each one fires.

### 1. Take registrations during the 5-day boarding window (Days 8–12)

Three HTTP endpoints in the existing `agent-backend` repo:
- One the app calls when a user imports — records them in a `registrations` table.
- One the app polls to show "you're registered, here's your status."
- One marketing reads to post live boarding-count tweets.

Plus one row in the database per user who joined.

### 2. On Day 12, draw winners and publish them on-chain

Once boarding closes, an operator (a human) runs a CLI tool that:
1. Reads everyone who registered.
2. Randomly picks the winners.
3. Spits out a `winners.csv` with one row per winner — Ethereum address + VULT amount.

The operator then hands `winners.csv` to whoever holds the multisig wallet that owns the on-chain contract. The multisig signer splits the list into chunks of about 100 and calls `setWinners(addresses[], amounts[])` on the contract once per chunk — about seven transactions in total. Each call writes those winners' allowances into the contract's storage. After this, the contract knows exactly how much VULT each winner address can claim.

The operator also loads the same list into our database so the app's status endpoint can tell each user whether they won or lost, and so the relayer (step 4) can look up "this user's recipient address and amount" when they tap claim.

(Earlier drafts of this campaign used a Merkle tree to compress the winners list into a single hash on-chain. Dropped 2026-04-23 in favour of the simpler mapping above — for our 700-winner scale with a centralised relayer paying gas, the mapping was both cheaper overall and substantially simpler.)

### 3. Day 13–27, watch what users do in the app and tick off quests

Every time the mobile app reports back "the user just signed and broadcast a transaction" (the existing tx-proposal `/sign` call), the backend looks up what kind of transaction it was. The agent already tagged the proposal at creation time with a tool name (`build_swap_tx`, `build_evm_tx`, etc.) and a small `quest_metadata` blob containing normalised data (USD value, source/destination chains, target contract). If it was a swap above $10, we tick the "swap quest" box for that user. If it was a bridge, we tick "bridge quest." Etc.

Once any user has 3 of 5 quests ticked, they're flagged as `claim_eligible` in the database.

### 4. Day 28+, accept claim requests and pay out

The user taps "claim my VULT." The app POSTs to `/airdrop/claim`. The backend:
1. Checks they're a winner with 3 quests done and haven't already claimed.
2. Looks up their recipient address and amount from the database.
3. Builds an Ethereum transaction calling the contract's `claim()` function.
4. **Pays the gas itself** — out of a "relayer wallet" the team funded ahead of time with about 5 ETH.
5. Signs the transaction using a key held in AWS KMS (so the key never lives on a server's disk).
6. Broadcasts it.
7. Returns the transaction hash to the app immediately ("submitted").
8. A background process watches Ethereum, sees the transaction confirm, and updates our database to "confirmed."
9. Next time the user polls `/airdrop/status`, they see `already_claimed: true` and the app shows "VULT received!"

### 5. Run an operator dashboard so a human can fix things if they break

A simple HTML page (no JavaScript, just server-rendered) at `/ops` showing:
- How much ETH is left in the relayer wallet (for "we need to top up" alerts).
- A list of any transactions that have been pending for too long.
- A "rebroadcast with higher gas" button per stuck transaction.

Behind a username/password.

---

## What the on-chain contract does

Lives in a separate repo (`vultisig/vultisig-contract`), built by someone else:
- Holds the VULT prize pool.
- Holds an `allowance` mapping — for each winner address, how much VULT they can claim.
- Has a `setWinners(addresses[], amounts[])` function the multisig owner calls in batches to populate that mapping after the Day 12 draw.
- Has a `claim(recipient)` function that pays the recipient's allowance and zeros the slot.
- Has a `recoverERC20()` function the multisig can call after the campaign to reclaim unclaimed VULT.

Our backend's only on-chain interaction is calling `claim(recipient)` repeatedly, once per claiming user. We also need the contract's address and ABI to build those calls.

---

## What the mobile app does

Lives in the agent-app / station-mobile codebase, built by the mobile engineer:
- The Vultiverse intro screen and migration flow (mostly already shipped).
- Computing the user's Ethereum address from their vault locally (so the backend never has to derive it).
- Calling `POST /airdrop/register` after a successful import.
- Polling `GET /airdrop/status` to drive the pending screen state machine.
- Showing the "claim my VULT" button when the user is claim-eligible, and posting `POST /airdrop/claim` on tap.

---

## The mental model in one sentence

A small Go service that **takes registrations, picks winners, watches the app for qualifying actions, then pays VULT out of a hot wallet on demand** — with a database keeping track of who's at what stage and a tiny dashboard for ops. Surrounded by an on-chain contract that holds the prize pool, and a mobile app that talks to both.
