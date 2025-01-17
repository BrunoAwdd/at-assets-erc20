import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("Alt", function () {
  async function deployAltFixture() {
    const [owner, otherAccount] = await hre.ethers.getSigners();

    // Deploy do contrato Alt
    const Alt = await hre.ethers.getContractFactory("Alt");
    const alt = await Alt.deploy();

    return { alt, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Deve definir o supply inicial corretamente", async function () {
      const { alt, owner } = await loadFixture(deployAltFixture);

      const totalSupply = await alt.totalSupply();
      const ownerBalance = await alt.balanceOf(owner.address);

      expect(totalSupply).to.equal(6_802_250_000);
      expect(ownerBalance).to.equal(totalSupply);
    });

    it("Deve configurar o owner corretamente", async function () {
      const { alt, owner } = await loadFixture(deployAltFixture);

      expect(await alt.owner()).to.equal(owner.address);
    });

    it("Deve ter 0 decimais", async function () {
      const { alt } = await loadFixture(deployAltFixture);

      expect(await alt.decimals()).to.equal(0);
    });
  });

  describe("Transfers", function () {
    it("Deve permitir transferências de tokens", async function () {
      const { alt, owner, otherAccount } = await loadFixture(deployAltFixture);

      // Transfere 100 tokens para outra conta
      await alt.transfer(otherAccount.address, 100);

      const ownerBalance = await alt.balanceOf(owner.address);
      const otherBalance = await alt.balanceOf(otherAccount.address);

      expect(ownerBalance).to.equal(6_802_250_000 - 100);
      expect(otherBalance).to.equal(100);
    });

    it("Deve emitir um evento ao transferir tokens", async function () {
      const { alt, owner, otherAccount } = await loadFixture(deployAltFixture);

      await expect(alt.transfer(otherAccount.address, 100))
        .to.emit(alt, "Transfer")
        .withArgs(owner.address, otherAccount.address, 100);
    });
  });

  describe("Burning Tokens", function () {
    it("Deve permitir ao owner queimar tokens", async function () {
      const { alt, owner } = await loadFixture(deployAltFixture);

      await alt.burn(50);

      const totalSupply = await alt.totalSupply();
      const ownerBalance = await alt.balanceOf(owner.address);

      expect(totalSupply).to.equal(6_802_250_000 - 50);
      expect(ownerBalance).to.equal(6_802_250_000 - 50);
    });

    it("Deve emitir um evento ao queimar tokens", async function () {
      const { alt, owner } = await loadFixture(deployAltFixture);

      await expect(alt.burn(50))
        .to.emit(alt, "Transfer")
        .withArgs(owner.address, hre.ethers.constants.AddressZero, 50);
    });
  });
});
