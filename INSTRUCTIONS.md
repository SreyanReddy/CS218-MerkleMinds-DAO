# INSTRUCTIONS — Run CS218 MerkleMinds DAO from zero

Every command assumes you are in the repo root
(`CS218-MerkleMinds-DAO/`) unless a step says otherwise.

---

## 0. Prerequisites

Install once on your machine:

| Tool | Version | Check |
| ---- | ------- | ----- |
| Node.js | 18 LTS or 20 LTS (Hardhat does **not** support Node 22/23 cleanly) | `node -v` |
| npm | comes with Node | `npm -v` |
| Git | any recent | `git --version` |
| MetaMask | browser extension | https://metamask.io |

If `node -v` shows v22 or v23, install nvm and pin to 20:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
exec $SHELL
nvm install 20
nvm use 20
```

---

## 1. Install dependencies

```bash
# From repo root — installs Hardhat, OpenZeppelin, TypeChain, ethers, etc.
npm install

# Frontend dependencies (React 19 + react-scripts 5 need --legacy-peer-deps)
cd frontend
npm install --legacy-peer-deps
cd ..
```

---

## 2. Compile, test, gas, coverage (optional sanity checks)

```bash
npx hardhat compile                 # 0 warnings, 29 artifacts
npx hardhat test                    # 21 tests, all passing
REPORT_GAS=true npx hardhat test    # also writes gas-report.txt
npx hardhat coverage                # writes ./coverage/
```

---

## 3. Start the local blockchain

Open **Terminal A** and run:

```bash
npx hardhat node
```

Leave this terminal running for the rest of the session.
It prints 20 pre-funded accounts (10 000 ETH each) with their **private keys** —
you will copy some of these into MetaMask in step 5.

Typical output (abbreviated):

```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (10000 ETH)
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

Account #2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC (10000 ETH)
Private Key: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cddbb5c8
...
```

> These are Hardhat’s default deterministic accounts. Same keys appear every time,
> so it is safe (and necessary) to paste them into MetaMask for local testing.

---

## 4. Deploy the three contracts

Open **Terminal B** (keep Terminal A running):

```bash
# Distributes 100k GT to accounts #1, #2, #3 and auto-delegates each of them.
# Also writes frontend/src/contract.js with ABIs + addresses.
npx hardhat run scripts/deploy.ts --network localhost
```

Expected output:

```
GovernanceToken deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
DAO deployed to:             0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
Treasury deployed to:        0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
Minted 100 000 GT to 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
Minted 100 000 GT to 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
Minted 100 000 GT to 0x90F79bf6EB2c4f870365E785982E1f101E93b906
```

> **Every time you restart Terminal A (`hardhat node`), you MUST rerun this deploy
> command.** Restarting the node wipes all state; the addresses in
> `frontend/src/contract.js` will otherwise point to nothing, which produces the
> `could not decode result data (value="0x")` error in MetaMask.

---

## 5. Add the Hardhat network + accounts to MetaMask

### 5a. Add the network

1. Open MetaMask → click the network dropdown (top-left) → **Add a custom network**.
2. Fill in:

   | Field | Value |
   | ----- | ----- |
   | Network name | `Hardhat Local` |
   | Default RPC URL | `http://127.0.0.1:8545` |
   | Chain ID | `31337` |
   | Currency symbol | `ETH` |
   | Block explorer URL | *(leave blank)* |

3. Click **Save**, then switch MetaMask to this new `Hardhat Local` network.

### 5b. Import Hardhat accounts

In MetaMask: account icon (top-right) → **Add account or hardware wallet**
→ **Import account** → paste a private key from Terminal A.

Recommended:

| Role | Hardhat account | Private key (paste into MetaMask) |
| ---- | --------------- | --------------------------------- |
| Deployer (holds 1M GT) | #0 | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| Voter Alice (100k GT) | #1 | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| Voter Bob   (100k GT) | #2 | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cddbb5c8` |

Rename each imported account in MetaMask (e.g. `Hardhat #0 — Deployer`) so you can
switch between them easily when testing.

### 5c. Add the GT token (optional, just to see the balance in MetaMask)

MetaMask → **Tokens** → **Import tokens** → **Custom token** →
paste the `GovernanceToken` address printed in step 4
(e.g. `0x5FbDB2315678afecb367f032d93F642f64180aa3`). Symbol `GT`, decimals `18`.

---

## 6. Start the DApp

Open **Terminal C** (Terminals A and B stay open):

```bash
cd frontend
npm start
```

The browser opens `http://localhost:3000` automatically.

Click **Connect MetaMask**. The DApp will:

- verify MetaMask is on chainId `31337` (red callout if not),
- verify there is code at each contract address (red callout if not — tells you
  to rerun the deploy script),
- load balances, voting power, quorum %, treasury ETH, etc.

---

## 7. Using the DApp — UI tour

Once you click **Connect MetaMask** the page fills with live on-chain data.
Here is what every region does, top to bottom.

### 7.1 Header (top bar)

| Element | Meaning |
| ------- | ------- |
| **DAO Governance DApp / CS218 — MerkleMinds** | Title |
| **Connect MetaMask** button | First click connects your wallet. After connection the button shows `✓ 0xf39F…2266` (your active account). |
| **chainId** chip | Should show `31337` in **green**. If it is red, MetaMask is on the wrong network — switch to `Hardhat Local`. |

### 7.2 Messages bar

- **Red callout** (“Problem: …”) = a fatal condition the app detected before doing anything
  dangerous. Examples: wrong network, no contract code at the deployed addresses,
  `contract.js` not populated yet. The text of the callout tells you which terminal
  command to run to fix it.
- **Blue callout** = normal transactional status (“Submitting proposal…”, “Vote recorded on #1.”).

### 7.3 Stats grid (8 cards)

| Card | What it shows | Read it to answer |
| ---- | ------------- | ----------------- |
| **Your GT balance** | `balanceOf(you)` on the governance token | “How many GT do I own?” |
| **Your voting power** | `getVotes(you)` — the snapshotted delegated balance | “How much weight does my vote carry?” |
| **Token total supply** | `totalSupply()` | Used to compute the 30 % quorum bar |
| **Quorum / delay** | `quorumPercent` % · `votingDelay` s | “How much turnout is needed, and how long do proposals wait before voting?” |
| **Treasury ETH** | `provider.getBalance(treasury)` | Balance of the contract governed by the DAO |
| **DAO / Token / Treasury address** | Short form of each contract | Cross-check against Hardhat deploy logs |

### 7.4 Delegation warning (orange)

Appears only when `delegates(you) == address(0)`.
Click **Delegate GT to Myself** once — this calls `token.delegate(you)` so your
balance starts counting as voting power. `scripts/deploy.ts` pre-delegates
accounts #0–#3 for you, so this warning typically appears only for accounts
you imported yourself.

> **Important:** delegation must happen **before** the proposal is created.
> The DAO snapshots votes at `createProposal` time, not at vote time. If you
> delegate after a proposal exists, your weight on *that* proposal stays 0.

### 7.5 Create Proposal panel

From top to bottom:

1. **Preset action** — dropdown with three options:
   - `Treasury.setValue(uint256)` — ask the DAO to store a number in the Treasury.
   - `Treasury.release(address, uint256)` — ask the DAO to pay ETH from the Treasury.
   - `Custom` — you fill `target` + `calldata` manually.
2. Preset-specific inputs appear underneath (e.g. *Value to store* or *Recipient / Amount*).
3. Click **Apply preset → fill target + calldata** — the target, calldata and a default
   description get written into the form below. You can still edit all three.
4. **Description** — human-readable text shown in the proposal card.
5. **Target contract address** — the contract the DAO will call if the proposal passes.
6. **Calldata** — ABI-encoded function call (hex). `0x` means “don’t call anything, just vote”.
7. **Voting period (days)** — how long the proposal stays Active. Use `1` day for
   local tests so fast-forwarding is easy.
8. **Submit Proposal** — disabled until *Description* is filled. Click it and confirm
   in MetaMask.

### 7.6 Proposals list

One card per proposal. Each card shows:

- `#ID — description` + a coloured **status pill** (`Pending | Active | Defeated | Succeeded | Executed | Cancelled`).
- `Target: 0x…`, `Call: setValue(42)` (the DApp decodes Treasury calls automatically), `Deadline: <local time>`.
- `Yes` / `No` vote counts in GT, and whether quorum has been reached.
- Action buttons that appear based on status:
  - **Status = Active** → **Vote YES** / **Vote NO**
  - **Status = Succeeded** → **Execute**
  - **Status = Pending** → **Cancel (proposer only)**

Click **Refresh** at the top of the list any time you expect state changes
(after a vote, after fast-forwarding time, after an execute).

### 7.7 Switching accounts during testing

To simulate other voters, open MetaMask → account icon → pick a different
imported account (Alice, Bob, …). The DApp listens for MetaMask’s
`accountsChanged` event and auto-reloads, so the stats and voting power update
automatically. Same for `chainChanged`.

---

## 8. Two complete usage scenarios

### Scenario A — Make the DAO write `42` into the Treasury

**Goal:** prove the DAO can call an arbitrary contract function after a
successful vote.

1. In MetaMask, switch to **Hardhat #0 — Deployer**.
2. In the DApp header you should now see `Your GT balance: 1,000,000 GT` and
   `Your voting power: 1,000,000 GT` (deployer was auto-delegated).
3. *Create Proposal* panel:
   - Preset: `Treasury.setValue(uint256)`
   - Value to store: `42`
   - Click **Apply preset** → description is auto-filled to
     `Set Treasury.storedValue to 42`.
   - Voting period (days): `1`
   - Click **Submit Proposal** → confirm in MetaMask.
4. The new proposal appears with status **Active**. Click **Vote YES** → confirm.
5. Fast-forward time — in any terminal:
   ```bash
   npx hardhat console --network localhost
   ```
   Inside the REPL:
   ```js
   await network.provider.send("evm_increaseTime", [86401])
   await network.provider.send("evm_mine")
   .exit
   ```
6. Back in the DApp, click **Refresh** → status flips to **Succeeded**.
7. Click **Execute** → confirm. The DApp reports `Proposal #1 executed.`
8. **Verify on-chain.** In Terminal B:
   ```bash
   npx hardhat console --network localhost
   ```
   ```js
   const t = await ethers.getContractAt("Treasury", "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9")
   await t.storedValue()    // → 42n
   ```
   The DAO just made the Treasury store `42`. That is on-chain composability.

### Scenario B — Release 0.1 ETH from the Treasury to Alice, with multiple voters

**Goal:** show the full three-voter governance flow, ETH transfer, and quorum math.

1. **Fund the Treasury** (it starts with 0 ETH). In Terminal B:
   ```bash
   npx hardhat console --network localhost
   ```
   ```js
   const [deployer] = await ethers.getSigners()
   await deployer.sendTransaction({
     to: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",  // Treasury
     value: ethers.parseEther("1")
   })
   .exit
   ```
   The **Treasury ETH** card should now read `1.0000 ETH` after refreshing.
2. Still on Hardhat #0, in the DApp:
   - Preset: `Treasury.release(address, uint256)`
   - Recipient: paste Alice’s address `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
   - Amount (ETH): `0.1`
   - Click **Apply preset**, set voting period `1` day, click **Submit Proposal**.
3. **Vote from three accounts** so quorum (30 % of 1.3 M GT ≈ 390 k) is easily met:
   - Still as Deployer → **Vote YES**
   - Switch MetaMask to **Hardhat #1 — Alice** → **Vote YES**
   - Switch to **Hardhat #2 — Bob** → **Vote YES**
   
   After all three, the quorum indicator on the card should read *met*.
4. Fast-forward past the deadline (same `evm_increaseTime` + `evm_mine` as Scenario A).
5. Click **Refresh** → status is **Succeeded** → click **Execute**.
6. **Verify.** Alice’s ETH balance in MetaMask went up by ~0.1 ETH. The
   **Treasury ETH** card dropped from `1.0000` to `0.9000`. Proposal status
   switched to **Executed**.

### Scenario C — Cancel a proposal during the Pending phase

**Goal:** show that only the proposer can cancel, and only before voting starts.

Prerequisites: deploy with a non-zero voting delay. `scripts/deploy.ts` uses
`VOTING_DELAY = 86400` (1 day) by default, so newly created proposals sit in
**Pending** for 24 hours.

1. As Hardhat #0, submit any proposal using the `setValue` preset.
2. The proposal card shows status **Pending** (grey pill) — voting has not started.
3. Click **Cancel (proposer only)** → confirm in MetaMask. Status flips to **Cancelled**.
4. Try to cancel from a different account: switch MetaMask to Alice, refresh.
   On a different Pending proposal you created earlier, the Cancel button is still
   there (the UI doesn’t know who the proposer is until you click), but the tx
   reverts with `Not proposer` and the DApp shows the error in the blue status bar.

### Scenario D — Verify a defeated proposal cannot execute

1. As Hardhat #0, submit a proposal.
2. Switch to Alice → **Vote NO**.
3. Switch to Bob → **Vote NO**.
4. Switch back to Deployer → **Vote YES** (but the 1 M deployer GT is still
   counted because deployer is delegated).
5. Fast-forward time, click **Refresh** — note that **Defeated** shows if no > yes.
   Try a combination that flips majority to No (e.g. don’t vote as Deployer and
   only have Alice + Bob vote No).
6. The **Execute** button is not rendered for Defeated proposals, and if you
   manually call `executeProposal` via the console it reverts with
   `Proposal rejected`.

---

## 9. Everyday "cheat sheet" while testing

| I want to… | Do this |
| ---------- | ------- |
| Use a different voter | MetaMask → account switcher → Alice/Bob → the DApp auto-reloads |
| See how much weight my vote has | Look at **Your voting power** — if 0, delegate first |
| See what a proposal will actually execute | Read **Target** + **Call** on the proposal card (the DApp ABI-decodes Treasury calls) |
| Fund the Treasury with ETH | In `hardhat console`, `deployer.sendTransaction({ to: treasuryAddr, value: ethers.parseEther("N") })` |
| Jump past a deadline | `evm_increaseTime` + `evm_mine` in the console |
| Change quorum % (admin only) | `dao.connect(deployer).setQuorumPercent(50)` in the console, or add a button — deployer holds `ADMIN_ROLE` |
| Wipe everything and start fresh | See §11 *Clean reset* below |

---

## 10. Common errors and fixes

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| `could not decode result data (value="0x")` | Wrong MetaMask network, **or** Hardhat node restarted without redeploying | Confirm MetaMask shows chainId `31337`; rerun step 4; refresh the browser tab. |
| `No voting power` when voting | Account never delegated, or delegated **after** the proposal was created | Click *Delegate GT to Myself*, then create a **new** proposal. Old proposals use the snapshot at their own creation block. |
| `Voting still active` on Execute | Deadline hasn’t passed on the local chain | Use `evm_increaseTime` + `evm_mine` from §8 Scenario A step 5. |
| `Quorum not reached` | (yesVotes + noVotes) < 30 % of totalSupply | Vote from more imported accounts. `deploy.ts` funds accounts #1–#3 with 100 k GT each; delegating + voting two of them gets you past 30 % quickly. |
| `AccessControl: ... is missing role` | Non-admin called `setQuorumPercent` | Switch MetaMask to account #0 (the deployer holds `ADMIN_ROLE`). |
| `Not proposer` on Cancel | You are not the original proposer | Cancel can only be called by whoever submitted the proposal. |
| `Execution failed` | The target call reverted (e.g. trying to `release` more ETH than the Treasury holds) | Fund the treasury first (see §8 Scenario B step 1), or lower the amount. |
| React build error on `npm install` in `frontend/` | React 19 + react-scripts 5 peer-dep clash | Use `npm install --legacy-peer-deps` (already documented in step 1). |

---

## 11. Running the full test suite for graders

From repo root, single command that proves correctness, gas, and coverage:

```bash
npx hardhat compile && REPORT_GAS=true npx hardhat test && npx hardhat coverage
```

- 21/21 tests pass
- `gas-report.txt` is created
- `coverage/` directory + `coverage.json` created; line coverage ~78 %, above the
  required 70 %.

---

## 12. Clean reset

If things look weird and you want a fresh start:

```bash
# Stop Terminals A/C (Ctrl-C)
rm -rf artifacts cache typechain-types coverage coverage.json gas-report.txt deployments
# In MetaMask: Settings → Advanced → Clear activity and nonce data (per account)
# Then repeat steps 3 → 7
```
