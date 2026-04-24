const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();

  console.log("Deploying contracts with:", owner.address);

  // Deploy DAO
  const DAO = await ethers.getContractFactory("DAO");
  const dao = await DAO.deploy();
  await dao.waitForDeployment();

  console.log("DAO deployed at:", await dao.getAddress());

  // ✅ VERY IMPORTANT: Give voting power
  await dao.setVotingPower(owner.address, 1);

  console.log("Voting power assigned to:", owner.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});