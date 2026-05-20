import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("AltW", function () {
  async function deployAltWFixture() {
    const [owner, otherAccount] = await hre.ethers.getSigners();

    const AltW = await hre.ethers.getContractFactory("AltW");
    const altw = await AltW.deploy();

    return { altw, owner, otherAccount };
  }

  it("define o supply inicial de 1 bilhao", async function () {
    const { altw, owner } = await loadFixture(deployAltWFixture);

    const totalSupply = await altw.totalSupply();

    expect(totalSupply).to.equal(1_000_000_000n);
    expect(await altw.balanceOf(owner.address)).to.equal(totalSupply);
  });

  it("configura nome, simbolo e decimais", async function () {
    const { altw } = await loadFixture(deployAltWFixture);

    expect(await altw.name()).to.equal("503-ALTW-001");
    expect(await altw.symbol()).to.equal("ALTW");
    expect(await altw.decimals()).to.equal(0);
  });

  it("permite transferir AltW", async function () {
    const { altw, owner, otherAccount } = await loadFixture(deployAltWFixture);

    await expect(altw.transfer(otherAccount.address, 1_000_000_000n))
      .to.emit(altw, "Transfer")
      .withArgs(owner.address, otherAccount.address, 1_000_000_000n);

    expect(await altw.balanceOf(owner.address)).to.equal(0);
    expect(await altw.balanceOf(otherAccount.address)).to.equal(1_000_000_000n);
  });
});
