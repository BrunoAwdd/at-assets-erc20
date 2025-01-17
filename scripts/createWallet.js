const { Wallet } = require("ethers");

function createWallet() {
  const wallet = Wallet.createRandom(); // Gera uma carteira aleatória

  console.log("Nova carteira criada!");
  console.log("Endereço:", wallet.address);
  console.log("Chave privada:", wallet.privateKey);

  console.log(
    "\nIMPORTANTE: Salve a chave privada em um local seguro. Sem ela, você perderá acesso à carteira!"
  );
}

createWallet();
