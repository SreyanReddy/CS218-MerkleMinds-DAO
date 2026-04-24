const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DAO Governance Contract", function () {

  let token, treasury, dao;
  let owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy Token
    const Token = await ethers.getContractFactory("GovernanceToken");
    token = await Token.deploy();
    await token.waitForDeployment();

    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy();
    await treasury.waitForDeployment();

    // Deploy DAO (IMPORTANT: use getAddress)
    const DAO = await ethers.getContractFactory("DAO");

    dao = await DAO.deploy(
      await token.getAddress(),
      await treasury.getAddress()
    );

    await dao.waitForDeployment();

    // Give user1 tokens for voting
    await token.transfer(user1.address, ethers.parseEther("100"));
  });

  // ---------------- TEST 1 ----------------
  it("Non-token holder cannot vote", async function () {
    await dao.createProposal(
      "Test Proposal",
      await treasury.getAddress(),
      "0x"
    );

    await expect(
      dao.connect(user2).vote(0, true)
    ).to.be.reverted;
  });

  // ---------------- TEST 2 ----------------
  it("Prevents double voting", async function () {
    await dao.createProposal(
      "Test Proposal",
      await treasury.getAddress(),
      "0x"
    );

    await dao.connect(user1).vote(0, true);

    await expect(
      dao.connect(user1).vote(0, true)
    ).to.be.reverted;
  });

  // ---------------- TEST 3 ----------------
  it("Quorum failure prevents execution", async function () {
    await dao.createProposal(
      "Test Proposal",
      await treasury.getAddress(),
      "0x"
    );

    await dao.connect(user1).vote(0, true);

    await expect(
      dao.executeProposal(0)
    ).to.be.reverted;
  });

});