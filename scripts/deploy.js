const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const { ethers, network, artifacts } = hre;
  const [deployer] = await ethers.getSigners();

  console.log(`Network: ${network.name}`);
  console.log(`Deploying with account: ${deployer.address}`);

  const Token = await ethers.getContractFactory("GovernanceToken");
  const token = await Token.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`GovernanceToken deployed at: ${tokenAddress}`);

  await token.delegate(deployer.address);

  const votingDelay = 86400;
  const DAO = await ethers.getContractFactory("DAO");
  const dao = await DAO.deploy(tokenAddress, votingDelay);
  await dao.waitForDeployment();
  const daoAddress = await dao.getAddress();
  console.log(`DAO deployed at: ${daoAddress}`);

  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(daoAddress);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log(`Treasury deployed at: ${treasuryAddress}`);

  const [daoArtifact, tokenArtifact, treasuryArtifact] = await Promise.all([
    artifacts.readArtifact("DAO"),
    artifacts.readArtifact("GovernanceToken"),
    artifacts.readArtifact("Treasury"),
  ]);

  const networkInfo = await ethers.provider.getNetwork();
  const deploymentData = {
    network: network.name,
    chainId: Number(networkInfo.chainId),
    addresses: {
      dao: daoAddress,
      token: tokenAddress,
      treasury: treasuryAddress,
    },
    abi: {
      dao: daoArtifact.abi,
      token: tokenArtifact.abi,
      treasury: treasuryArtifact.abi,
    },
  };

  const frontendContractPath = path.join(
    __dirname,
    "..",
    "frontend",
    "src",
    "contract.js"
  );
  const deploymentFilePath = path.join(
    __dirname,
    "..",
    "deployments",
    `${network.name}.json`
  );

  fs.mkdirSync(path.dirname(frontendContractPath), { recursive: true });
  fs.mkdirSync(path.dirname(deploymentFilePath), { recursive: true });

  const frontendFileContents = `export const CONTRACT_CONFIG = ${JSON.stringify(
    deploymentData,
    null,
    2
  )};
`;

  fs.writeFileSync(frontendContractPath, frontendFileContents);
  fs.writeFileSync(deploymentFilePath, JSON.stringify(deploymentData, null, 2));

  console.log(`Wrote frontend contract config: ${frontendContractPath}`);
  console.log(`Wrote deployment snapshot: ${deploymentFilePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
