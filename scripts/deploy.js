const hre = require("hardhat");

async function main() {
  console.log("Implantando o contrato na rede Sepolia...");

  // Obtenha o contrato para implantação
  const Contract = await hre.ethers.getContractFactory("Asset");
  const contract = await Contract.deploy();

  console.log(`Contrato implantado em: ${contract.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
