import { expect } from "chai";
import { ethers } from "hardhat";
import { time, mine } from "@nomicfoundation/hardhat-network-helpers";
import { GovernanceToken, DAO, Treasury } from "../typechain-types";

// ─── Fixture ──────────────────────────────────────────────────────────────────
// votingDelay = 0 so proposals enter Active immediately (simplifies most tests).
// cancelProposal tests use a separate deployment with votingDelay > 0.

async function deployFixture() {
  const [owner, alice, bob, carol, nobody] = await ethers.getSigners();

  const Token = await ethers.getContractFactory("GovernanceToken");
  const token = (await Token.deploy()) as GovernanceToken;

  // Distribute tokens and self-delegate so vote-weight checkpoints are written
  await token.mint(alice.address, ethers.parseUnits("400000", 18));
  await token.mint(bob.address,   ethers.parseUnits("200000", 18));
  await token.mint(carol.address, ethers.parseUnits("10000",  18));
  // nobody gets no tokens

  await token.connect(alice).delegate(alice.address);
  await token.connect(bob).delegate(bob.address);
  await token.connect(carol).delegate(carol.address);
  // owner does NOT delegate — keeps quorum maths simple (their 1M tokens are inert)

  const DAO = await ethers.getContractFactory("DAO");
  const dao = (await DAO.deploy(await token.getAddress(), 0)) as DAO;

  const TreasuryFactory = await ethers.getContractFactory("Treasury");
  const treasury = (await TreasuryFactory.deploy(await dao.getAddress())) as Treasury;

  // Fund treasury with 1 ETH for the release() execution test
  await owner.sendTransaction({
    to: await treasury.getAddress(),
    value: ethers.parseEther("1"),
  });

  const VOTING_PERIOD = 7 * 24 * 60 * 60; // 7 days

  return { token, dao, treasury, owner, alice, bob, carol, nobody, VOTING_PERIOD };
}

// Advance one block so snapshotBlock is strictly in the past for getPastVotes
async function minePast() {
  await mine(1);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DAO Governance", function () {

  // ── Deployment ──────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("sets the governance token address", async function () {
      const { dao, token } = await deployFixture();
      expect(await dao.token()).to.equal(await token.getAddress());
    });

    it("sets quorumPercent to 30", async function () {
      const { dao } = await deployFixture();
      expect(await dao.quorumPercent()).to.equal(30);
    });
  });

  // ── createProposal ──────────────────────────────────────────────────────────
  describe("createProposal", function () {
    it("token holder can create a proposal and count increments", async function () {
      const { dao, treasury, alice, VOTING_PERIOD } = await deployFixture();
      const data = treasury.interface.encodeFunctionData("setValue", [1]);
      await dao
        .connect(alice)
        .createProposal("Proposal 1", await treasury.getAddress(), data, VOTING_PERIOD);
      expect(await dao.proposalCount()).to.equal(1);
    });

    it("non-token-holder cannot create a proposal", async function () {
      const { dao, treasury, nobody, VOTING_PERIOD } = await deployFixture();
      const data = treasury.interface.encodeFunctionData("setValue", [1]);
      await expect(
        dao.connect(nobody).createProposal("Bad", await treasury.getAddress(), data, VOTING_PERIOD)
      ).to.be.revertedWith("Not a token holder");
    });

    it("emits ProposalCreated event", async function () {
      const { dao, treasury, alice, VOTING_PERIOD } = await deployFixture();
      const data = treasury.interface.encodeFunctionData("setValue", [1]);
      await expect(
        dao.connect(alice).createProposal("P", await treasury.getAddress(), data, VOTING_PERIOD)
      ).to.emit(dao, "ProposalCreated");
    });
  });

  // ── vote ────────────────────────────────────────────────────────────────────
  describe("vote", function () {
    it("token holder can vote yes and VoteCast event is emitted", async function () {
      const { dao, treasury, alice, VOTING_PERIOD } = await deployFixture();
      const data = treasury.interface.encodeFunctionData("setValue", [1]);
      await dao
        .connect(alice)
        .createProposal("P", await treasury.getAddress(), data, VOTING_PERIOD);
      const id = await dao.proposalCount();
      await minePast();
      await expect(dao.connect(alice).vote(id, true))
        .to.emit(dao, "VoteCast")
        .withArgs(id, alice.address, true, ethers.parseUnits("400000", 18));
    });

    it("non-token-holder cannot vote", async function () {
      const { dao, treasury, alice, nobody, VOTING_PERIOD } = await deployFixture();
      const data = treasury.interface.encodeFunctionData("setValue", [1]);
      await dao
        .connect(alice)
        .createProposal("P", await treasury.getAddress(), data, VOTING_PERIOD);
      const id = await dao.proposalCount();
      await minePast();
      await expect(dao.connect(nobody).vote(id, true)).to.be.revertedWith(
        "No voting power"
      );
    });

    it("double-voting on the same proposal reverts", async function () {
      const { dao, treasury, alice, VOTING_PERIOD } = await deployFixture();
      const data = treasury.interface.encodeFunctionData("setValue", [1]);
      await dao
        .connect(alice)
        .createProposal("P", await treasury.getAddress(), data, VOTING_PERIOD);
      const id = await dao.proposalCount();
      await minePast();
      await dao.connect(alice).vote(id, true);
      await expect(dao.connect(alice).vote(id, true)).to.be.revertedWith(
        "Already voted"
      );
    });

    it("cannot vote after the voting deadline", async function () {
      const { dao, treasury, alice, VOTING_PERIOD } = await deployFixture();
      const data = treasury.interface.encodeFunctionData("setValue", [1]);
      await dao
        .connect(alice)
        .createProposal("P", await treasury.getAddress(), data, VOTING_PERIOD);
      const id = await dao.proposalCount();
      await time.increase(VOTING_PERIOD + 1);
      await expect(dao.connect(alice).vote(id, true)).to.be.revertedWith(
        "Voting ended"
      );
    });
  });

  // ── executeProposal ─────────────────────────────────────────────────────────
  describe("executeProposal", function () {
    it("happy path: executes after deadline and changes Treasury state", async function () {
      const { dao, treasury, alice, bob, VOTING_PERIOD } = await deployFixture();
      const data = treasury.interface.encodeFunctionData("setValue", [42]);
      await dao
        .connect(alice)
        .createProposal("Set 42", await treasury.getAddress(), data, VOTING_PERIOD);
      const id = await dao.proposalCount();
      await minePast();
      await dao.connect(alice).vote(id, true); // 400k votes
      await dao.connect(bob).vote(id, true);   // 200k votes → 600k / 1 610k ≈ 37% > 30%
      await time.increase(VOTING_PERIOD + 1);
      await dao.executeProposal(id);
      expect(await treasury.storedValue()).to.equal(42);
    });

    it("executeProposal reverts before the deadline", async function () {
      const { dao, treasury, alice, VOTING_PERIOD } = await deployFixture();
      const data = treasury.interface.encodeFunctionData("setValue", [1]);
      await dao
        .connect(alice)
        .createProposal("P", await treasury.getAddress(), data, VOTING_PERIOD);
      const id = await dao.proposalCount();
      await minePast();
      await dao.connect(alice).vote(id, true);
      await expect(dao.executeProposal(id)).to.be.revertedWith("Voting still active");
    });

    it("proposal below quorum cannot execute even if all votes are yes", async function () {
      // carol has 10k out of 1 610k total ≈ 0.6% — well below 30% quorum
      const { dao, treasury, carol, VOTING_PERIOD } = await deployFixture();
      const data = treasury.interface.encodeFunctionData("setValue", [1]);
      await dao
        .connect(carol)
        .createProposal("Low quorum", await treasury.getAddress(), data, VOTING_PERIOD);
      const id = await dao.proposalCount();
      await minePast();
      await dao.connect(carol).vote(id, true);
      await time.increase(VOTING_PERIOD + 1);
      await expect(dao.executeProposal(id)).to.be.revertedWith("Quorum not reached");
    });

    it("defeated proposal (no votes > yes votes) cannot be executed", async function () {
      const { dao, treasury, alice, bob, carol, VOTING_PERIOD } = await deployFixture();
      const data = treasury.interface.encodeFunctionData("setValue", [1]);
      await dao
        .connect(alice)
        .createProposal("Rejected", await treasury.getAddress(), data, VOTING_PERIOD);
      const id = await dao.proposalCount();
      await minePast();
      await dao.connect(carol).vote(id, true);  // 10k yes
      await dao.connect(alice).vote(id, false); // 400k no
      await dao.connect(bob).vote(id, false);   // 200k no — quorum met but no > yes
      await time.increase(VOTING_PERIOD + 1);
      await expect(dao.executeProposal(id)).to.be.revertedWith("Proposal rejected");
    });

    it("successful vote triggers real state change via Treasury.release()", async function () {
      const { dao, treasury, alice, bob, owner, VOTING_PERIOD } = await deployFixture();
      const data = treasury.interface.encodeFunctionData("release", [
        owner.address,
        ethers.parseEther("0.5"),
      ]);
      await dao
        .connect(alice)
        .createProposal("Release ETH", await treasury.getAddress(), data, VOTING_PERIOD);
      const id = await dao.proposalCount();
      await minePast();
      await dao.connect(alice).vote(id, true);
      await dao.connect(bob).vote(id, true);
      await time.increase(VOTING_PERIOD + 1);

      const balBefore = await ethers.provider.getBalance(owner.address);
      await dao.connect(alice).executeProposal(id); // alice calls so owner balance isn't muddied by gas
      const balAfter = await ethers.provider.getBalance(owner.address);

      expect(balAfter - balBefore).to.equal(ethers.parseEther("0.5"));
    });

    it("emits ProposalExecuted event", async function () {
      const { dao, treasury, alice, bob, VOTING_PERIOD } = await deployFixture();
      const data = treasury.interface.encodeFunctionData("setValue", [1]);
      await dao
        .connect(alice)
        .createProposal("P", await treasury.getAddress(), data, VOTING_PERIOD);
      const id = await dao.proposalCount();
      await minePast();
      await dao.connect(alice).vote(id, true);
      await dao.connect(bob).vote(id, true);
      await time.increase(VOTING_PERIOD + 1);
      await expect(dao.executeProposal(id))
        .to.emit(dao, "ProposalExecuted")
        .withArgs(id);
    });
  });

  // ── cancelProposal ──────────────────────────────────────────────────────────
  // Uses a separate deployment with votingDelay = 1 day so the Pending phase exists
  describe("cancelProposal", function () {
    async function deployWithDelay() {
      const [owner, alice, bob] = await ethers.getSigners();
      const Token = await ethers.getContractFactory("GovernanceToken");
      const token = await Token.deploy();
      await token.mint(alice.address, ethers.parseUnits("400000", 18));
      await token.mint(bob.address,   ethers.parseUnits("200000", 18));
      await token.connect(alice).delegate(alice.address);
      await token.connect(bob).delegate(bob.address);

      const DELAY  = 86400;      // 1 day
      const PERIOD = 7 * 86400;  // 7 days

      const DAO = await ethers.getContractFactory("DAO");
      const dao = await DAO.deploy(await token.getAddress(), DELAY);
      const TF  = await ethers.getContractFactory("Treasury");
      const treasury = await TF.deploy(await dao.getAddress());

      return { dao, treasury, alice, bob, DELAY, PERIOD };
    }

    it("creator can cancel a proposal during the Pending phase", async function () {
      const { dao, treasury, alice, PERIOD } = await deployWithDelay();
      const data = treasury.interface.encodeFunctionData("setValue", [1]);
      await dao.connect(alice).createProposal("P", await treasury.getAddress(), data, PERIOD);
      const id = await dao.proposalCount();
      await dao.connect(alice).cancelProposal(id);
      expect(await dao.getProposalStatus(id)).to.equal(5); // Status.Cancelled
    });

    it("non-creator cannot cancel a proposal", async function () {
      const { dao, treasury, alice, bob, PERIOD } = await deployWithDelay();
      const data = treasury.interface.encodeFunctionData("setValue", [1]);
      await dao.connect(alice).createProposal("Alice's proposal", await treasury.getAddress(), data, PERIOD);
      const id = await dao.proposalCount();
      await expect(dao.connect(bob).cancelProposal(id)).to.be.revertedWith(
        "Not proposer"
      );
    });

    it("emits ProposalCancelled event", async function () {
      const { dao, treasury, alice, PERIOD } = await deployWithDelay();
      const data = treasury.interface.encodeFunctionData("setValue", [1]);
      await dao.connect(alice).createProposal("P", await treasury.getAddress(), data, PERIOD);
      const id = await dao.proposalCount();
      await expect(dao.connect(alice).cancelProposal(id))
        .to.emit(dao, "ProposalCancelled")
        .withArgs(id);
    });
  });

  // ── AccessControl ───────────────────────────────────────────────────────────
  describe("AccessControl — setQuorumPercent", function () {
    it("admin can update quorumPercent", async function () {
      const { dao, owner } = await deployFixture();
      await dao.connect(owner).setQuorumPercent(50);
      expect(await dao.quorumPercent()).to.equal(50);
    });

    it("non-admin cannot update quorumPercent", async function () {
      const { dao, alice } = await deployFixture();
      await expect(dao.connect(alice).setQuorumPercent(50)).to.be.reverted;
    });
  });

  // ── Treasury Security ────────────────────────────────────────────────────────
  describe("Treasury Security", function () {
    it("non-DAO address cannot call release", async function () {
      const { treasury, alice } = await deployFixture();
      await expect(
        treasury.connect(alice).release(alice.address, 1)
      ).to.be.revertedWith("Not DAO");
    });
  });
});