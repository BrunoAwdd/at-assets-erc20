import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Asset", function () {
  async function deployAssetFixture() {
    const [owner, otherAccount] = await ethers.getSigners();

    // Deploy do contrato Asset
    const Asset = await ethers.getContractFactory("Asset");
    const asset = await Asset.deploy();

    return { asset, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Deve definir o supply inicial corretamente", async function () {
      const { asset, owner } = await loadFixture(deployAssetFixture);

      const totalSupply = await asset.totalSupply();
      const ownerBalance = await asset.balanceOf(owner.address);

      expect(totalSupply).to.equal(1_360_000_000);
      expect(ownerBalance).to.equal(totalSupply);
    });

    it("Deve configurar o owner corretamente", async function () {
      const { asset, owner } = await loadFixture(deployAssetFixture);

      expect(await asset.owner()).to.equal(owner.address);
    });

    it("Deve ter 0 decimais", async function () {
      const { asset } = await loadFixture(deployAssetFixture);

      expect(await asset.decimals()).to.equal(0);
    });
  });

  describe("Transfers", function () {
    it("Deve permitir transferências de tokens", async function () {
      const { asset, owner, otherAccount } = await loadFixture(
        deployAssetFixture
      );

      // Transfere 100 tokens para outra conta
      await asset.transfer(otherAccount.address, 100);

      const ownerBalance = await asset.balanceOf(owner.address);
      const otherBalance = await asset.balanceOf(otherAccount.address);

      expect(ownerBalance).to.equal(1_360_000_000 - 100);
      expect(otherBalance).to.equal(100);
    });

    it("Deve emitir um evento ao transferir tokens", async function () {
      const { asset, owner, otherAccount } = await loadFixture(
        deployAssetFixture
      );

      await expect(asset.transfer(otherAccount.address, 100))
        .to.emit(asset, "Transfer")
        .withArgs(owner.address, otherAccount.address, 100);
    });
  });

  describe("Burning Tokens", function () {
    it("Deve permitir ao owner queimar tokens", async function () {
      const { asset, owner } = await loadFixture(deployAssetFixture);

      await asset.burn(50);

      const totalSupply = await asset.totalSupply();
      const ownerBalance = await asset.balanceOf(owner.address);

      expect(totalSupply).to.equal(1_360_000_000 - 50);
      expect(ownerBalance).to.equal(1_360_000_000 - 50);
    });

    it("Deve emitir um evento ao queimar tokens", async function () {
      const { asset, owner } = await loadFixture(deployAssetFixture);

      await expect(asset.burn(50))
        .to.emit(asset, "Transfer")
        .withArgs(owner.address, ethers.constants.AddressZero, 50);
    });
  });

  describe("Minting Tokens", function () {
    it("Deve permitir ao owner mintar tokens", async function () {
      const { asset, otherAccount } = await loadFixture(deployAssetFixture);

      await asset.mint(otherAccount.address, 1000);

      const otherBalance = await asset.balanceOf(otherAccount.address);
      const totalSupply = await asset.totalSupply();

      expect(otherBalance).to.equal(1000);
      expect(totalSupply).to.equal(1_360_000_000 + 1000);
    });

    it("Deve reverter se um não-owner tentar mintar tokens", async function () {
      const { asset, otherAccount } = await loadFixture(deployAssetFixture);

      await expect(
        asset.connect(otherAccount).mint(otherAccount.address, 1000)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
