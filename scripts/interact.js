const hre = require("hardhat");

async function main() {
  const daoAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  const DAO = await hre.ethers.getContractFactory("DAO");
  const dao = await DAO.attach(daoAddress);

  // Create proposal
  const tx1 = await dao.createProposal("Build Web3 DAO Project");
  await tx1.wait();

  console.log("Proposal created");

  // Vote
  const tx2 = await dao.vote(0);
  await tx2.wait();

  console.log("Voted on proposal");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});