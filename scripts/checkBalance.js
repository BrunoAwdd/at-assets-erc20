require("dotenv").config();
const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);

console.log(process.env.SEPOLIA_RPC_URL);

async function checkBalance() {
  const address = "0x0e6f26B372D8bBe4Cf05cc79C41e52CaA21bBa7a"; // Substitua pelo endereço da sua carteira
  const balance = await provider.getBalance(address);

  console.log(`Saldo de ${address}: ${ethers.formatEther(balance)} ETH`);
}

checkBalance();
