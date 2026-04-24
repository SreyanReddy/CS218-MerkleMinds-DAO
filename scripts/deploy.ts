import { ethers } from "hardhat";

async function main() {
  const signers = await ethers.getSigners();
  const [deployer, alice, bob, carol] = signers;

  console.log("Deploying contracts with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH\n"
  );

  // GovernanceToken
  const Token = await ethers.getContractFactory("GovernanceToken");
  const token = await Token.deploy();
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log("GovernanceToken deployed to:", tokenAddr);

  await token.delegate(deployer.address);

  // DAO 
  const VOTING_DELAY = 86400; // 1 day — change to 0 for instant local testing
  const DAO = await ethers.getContractFactory("DAO");
  const dao = await DAO.deploy(tokenAddr, VOTING_DELAY);
  await dao.waitForDeployment();
  const daoAddr = await dao.getAddress();
  console.log("DAO deployed to:            ", daoAddr);

  // Treasury 
  const TreasuryFactory = await ethers.getContractFactory("Treasury");
  const treasury = await TreasuryFactory.deploy(daoAddr);
  await treasury.waitForDeployment();
  const treasuryAddr = await treasury.getAddress();
  console.log("Treasury deployed to:       ", treasuryAddr);

  // Distribute tokens to test accounts 
  const AMOUNT = ethers.parseUnits("100000", 18);
  const testAccounts = [alice, bob, carol].filter(Boolean);
  for (const account of testAccounts) {
    await token.mint(account.address, AMOUNT);
    await token.connect(account).delegate(account.address);
    console.log(`Minted 100 000 GT to ${account.address}`);
  }

  console.log("\n── Deployment Summary ──────────────────────────────────────");
  console.log("GovernanceToken :", tokenAddr);
  console.log("DAO             :", daoAddr);
  console.log("Treasury        :", treasuryAddr);
  console.log("Voting delay    :", VOTING_DELAY, "seconds");
  console.log("Quorum          : 30 %");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
