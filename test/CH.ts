import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const COLLATERAL_AMOUNT = 1_000_000_000n;

describe("ClearingHouse", function () {
  async function deployClearingHouseFixture() {
    const [depositor, trustee, beneficiary, otherAccount] =
      await hre.ethers.getSigners();

    const AltW = await hre.ethers.getContractFactory("AltW");
    const alt = await AltW.deploy();

    const ClearingHouse = await hre.ethers.getContractFactory("ClearingHouse");
    const clearingHouse = await ClearingHouse.deploy(
      await alt.getAddress(),
      trustee.address,
    );

    return {
      alt,
      clearingHouse,
      depositor,
      trustee,
      beneficiary,
      otherAccount,
    };
  }

  it("deposita ALTW como garantia e bloqueia ate o prazo", async function () {
    const { alt, clearingHouse, depositor, beneficiary } = await loadFixture(
      deployClearingHouseFixture,
    );
    const amount = COLLATERAL_AMOUNT;
    const unlockAt = (await time.latest()) + 60 * 60;

    await alt.approve(await clearingHouse.getAddress(), amount);

    await expect(
      clearingHouse.depositCollateral(amount, beneficiary.address, unlockAt),
    )
      .to.emit(clearingHouse, "CollateralDeposited")
      .withArgs(1, depositor.address, beneficiary.address, amount, unlockAt);

    const contractBalance = await alt.balanceOf(
      await clearingHouse.getAddress(),
    );
    const totalLocked = await clearingHouse.totalLocked();

    expect(contractBalance).to.equal(amount);
    expect(totalLocked).to.equal(amount);
    expect(await clearingHouse.lockedByDepositor(depositor.address)).to.equal(
      amount,
    );
    expect(
      await clearingHouse.guaranteedToBeneficiary(beneficiary.address),
    ).to.equal(amount);
  });

  it("define o trustee como owner", async function () {
    const { clearingHouse, trustee } = await loadFixture(
      deployClearingHouseFixture,
    );

    expect(await clearingHouse.owner()).to.equal(trustee.address);
  });

  it("nao permite ao trustee liberar ao depositante antes do vencimento", async function () {
    const { alt, clearingHouse, trustee, beneficiary } = await loadFixture(
      deployClearingHouseFixture,
    );
    const amount = COLLATERAL_AMOUNT;
    const unlockAt = (await time.latest()) + 60 * 60;

    await alt.approve(await clearingHouse.getAddress(), amount);
    await clearingHouse.depositCollateral(
      amount,
      beneficiary.address,
      unlockAt,
    );

    await expect(
      clearingHouse.connect(trustee).releaseCollateralToDepositor(1),
    ).to.be.revertedWithCustomError(clearingHouse, "CollateralStillLocked");
  });

  it("permite ao trustee liberar ao depositante depois do vencimento", async function () {
    const { alt, clearingHouse, depositor, trustee, beneficiary } =
      await loadFixture(deployClearingHouseFixture);
    const amount = COLLATERAL_AMOUNT;
    const unlockAt = (await time.latest()) + 60 * 60;
    const depositorBalanceBefore = await alt.balanceOf(depositor.address);

    await alt.approve(await clearingHouse.getAddress(), amount);
    await clearingHouse.depositCollateral(
      amount,
      beneficiary.address,
      unlockAt,
    );

    await time.increaseTo(unlockAt);

    await expect(clearingHouse.connect(trustee).releaseCollateralToDepositor(1))
      .to.emit(clearingHouse, "CollateralReleasedToDepositor")
      .withArgs(1, depositor.address, amount);

    expect(await alt.balanceOf(depositor.address)).to.equal(
      depositorBalanceBefore,
    );
    expect(await alt.balanceOf(await clearingHouse.getAddress())).to.equal(0);
    expect(await clearingHouse.totalLocked()).to.equal(0);
    expect(await clearingHouse.lockedByDepositor(depositor.address)).to.equal(
      0,
    );
    expect(
      await clearingHouse.guaranteedToBeneficiary(beneficiary.address),
    ).to.equal(0);
  });

  it("bloqueia por 30 dias e depois libera ao depositante", async function () {
    const { alt, clearingHouse, depositor, trustee, beneficiary } =
      await loadFixture(deployClearingHouseFixture);
    const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
    const amount = COLLATERAL_AMOUNT;
    const unlockAt = (await time.latest()) + thirtyDaysInSeconds;
    const depositorBalanceBefore = await alt.balanceOf(depositor.address);

    await alt.approve(await clearingHouse.getAddress(), amount);
    await clearingHouse.depositCollateral(
      amount,
      beneficiary.address,
      unlockAt,
    );

    expect(await alt.balanceOf(await clearingHouse.getAddress())).to.equal(
      amount,
    );

    await time.increaseTo(unlockAt);

    await expect(
      clearingHouse.connect(trustee).releaseCollateralToDepositor(1),
    )
      .to.emit(clearingHouse, "CollateralReleasedToDepositor")
      .withArgs(1, depositor.address, amount);

    expect(await alt.balanceOf(depositor.address)).to.equal(
      depositorBalanceBefore,
    );
    expect(await alt.balanceOf(await clearingHouse.getAddress())).to.equal(0);
    expect(await clearingHouse.totalLocked()).to.equal(0);
  });

  it("permite ao trustee cancelar antes do vencimento e devolver ao depositante", async function () {
    const { alt, clearingHouse, depositor, trustee, beneficiary } =
      await loadFixture(deployClearingHouseFixture);
    const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
    const amount = COLLATERAL_AMOUNT;
    const unlockAt = (await time.latest()) + thirtyDaysInSeconds;
    const depositorBalanceBefore = await alt.balanceOf(depositor.address);

    await alt.approve(await clearingHouse.getAddress(), amount);
    await clearingHouse.depositCollateral(
      amount,
      beneficiary.address,
      unlockAt,
    );

    await expect(clearingHouse.connect(trustee).cancelAndReturnToDepositor(1))
      .to.emit(clearingHouse, "CollateralCancelled")
      .withArgs(1, depositor.address, beneficiary.address, amount);

    expect(await alt.balanceOf(depositor.address)).to.equal(
      depositorBalanceBefore,
    );
    expect(await alt.balanceOf(await clearingHouse.getAddress())).to.equal(0);
    expect(await clearingHouse.totalLocked()).to.equal(0);
  });

  it("bloqueia cancelamento por quem nao e trustee", async function () {
    const { alt, clearingHouse, beneficiary, otherAccount } = await loadFixture(
      deployClearingHouseFixture,
    );
    const amount = COLLATERAL_AMOUNT;
    const unlockAt = (await time.latest()) + 30 * 24 * 60 * 60;

    await alt.approve(await clearingHouse.getAddress(), amount);
    await clearingHouse.depositCollateral(
      amount,
      beneficiary.address,
      unlockAt,
    );

    await expect(
      clearingHouse.connect(otherAccount).cancelAndReturnToDepositor(1),
    ).to.be.revertedWithCustomError(clearingHouse, "OwnableUnauthorizedAccount");
  });

  it("nao permite liberar depois que o trustee cancelou", async function () {
    const { alt, clearingHouse, trustee, beneficiary } = await loadFixture(
      deployClearingHouseFixture,
    );
    const amount = COLLATERAL_AMOUNT;
    const unlockAt = (await time.latest()) + 30 * 24 * 60 * 60;

    await alt.approve(await clearingHouse.getAddress(), amount);
    await clearingHouse.depositCollateral(
      amount,
      beneficiary.address,
      unlockAt,
    );
    await clearingHouse.connect(trustee).cancelAndReturnToDepositor(1);
    await time.increaseTo(unlockAt);

    await expect(
      clearingHouse.connect(trustee).releaseCollateralToBeneficiary(1),
    ).to.be.revertedWithCustomError(clearingHouse, "CollateralAlreadyReleased");
  });

  it("bloqueia liberacao ao depositante por quem nao e trustee", async function () {
    const { alt, clearingHouse, beneficiary, otherAccount } = await loadFixture(
      deployClearingHouseFixture,
    );
    const amount = COLLATERAL_AMOUNT;
    const unlockAt = (await time.latest()) + 60 * 60;

    await alt.approve(await clearingHouse.getAddress(), amount);
    await clearingHouse.depositCollateral(
      amount,
      beneficiary.address,
      unlockAt,
    );
    await time.increaseTo(unlockAt);

    await expect(
      clearingHouse.connect(otherAccount).releaseCollateralToDepositor(1),
    ).to.be.revertedWithCustomError(
      clearingHouse,
      "OwnableUnauthorizedAccount",
    );
  });

  it("permite ao trustee liberar a garantia para o beneficiario", async function () {
    const { alt, clearingHouse, depositor, trustee, beneficiary } =
      await loadFixture(deployClearingHouseFixture);
    const amount = COLLATERAL_AMOUNT;
    const unlockAt = (await time.latest()) + 60 * 60;

    await alt.approve(await clearingHouse.getAddress(), amount);
    await clearingHouse.depositCollateral(
      amount,
      beneficiary.address,
      unlockAt,
    );
    await time.increaseTo(unlockAt);

    await expect(
      clearingHouse.connect(trustee).releaseCollateralToBeneficiary(1),
    )
      .to.emit(clearingHouse, "CollateralReleasedToBeneficiary")
      .withArgs(1, depositor.address, beneficiary.address, amount);

    expect(await alt.balanceOf(beneficiary.address)).to.equal(amount);
    expect(await alt.balanceOf(await clearingHouse.getAddress())).to.equal(0);
    expect(await clearingHouse.totalLocked()).to.equal(0);
    expect(await clearingHouse.lockedByDepositor(depositor.address)).to.equal(
      0,
    );
    expect(
      await clearingHouse.guaranteedToBeneficiary(beneficiary.address),
    ).to.equal(0);
  });

  it("nao permite ao trustee liberar ao beneficiario antes do vencimento", async function () {
    const { alt, clearingHouse, trustee, beneficiary } = await loadFixture(
      deployClearingHouseFixture,
    );
    const amount = COLLATERAL_AMOUNT;
    const unlockAt = (await time.latest()) + 60 * 60;

    await alt.approve(await clearingHouse.getAddress(), amount);
    await clearingHouse.depositCollateral(
      amount,
      beneficiary.address,
      unlockAt,
    );

    await expect(
      clearingHouse.connect(trustee).releaseCollateralToBeneficiary(1),
    ).to.be.revertedWithCustomError(clearingHouse, "CollateralStillLocked");
  });

  it("bloqueia liberacao ao beneficiario por quem nao e trustee", async function () {
    const { alt, clearingHouse, beneficiary, otherAccount } = await loadFixture(
      deployClearingHouseFixture,
    );
    const amount = COLLATERAL_AMOUNT;
    const unlockAt = (await time.latest()) + 60 * 60;

    await alt.approve(await clearingHouse.getAddress(), amount);
    await clearingHouse.depositCollateral(
      amount,
      beneficiary.address,
      unlockAt,
    );

    await expect(
      clearingHouse.connect(otherAccount).releaseCollateralToBeneficiary(1),
    ).to.be.revertedWithCustomError(
      clearingHouse,
      "OwnableUnauthorizedAccount",
    );
  });

  it("nao permite liberar novamente depois que o trustee liberou ao beneficiario", async function () {
    const { alt, clearingHouse, trustee, beneficiary } = await loadFixture(
      deployClearingHouseFixture,
    );
    const amount = COLLATERAL_AMOUNT;
    const unlockAt = (await time.latest()) + 60 * 60;

    await alt.approve(await clearingHouse.getAddress(), amount);
    await clearingHouse.depositCollateral(
      amount,
      beneficiary.address,
      unlockAt,
    );
    await time.increaseTo(unlockAt);
    await clearingHouse.connect(trustee).releaseCollateralToBeneficiary(1);

    await expect(
      clearingHouse.connect(trustee).releaseCollateralToDepositor(1),
    ).to.be.revertedWithCustomError(clearingHouse, "CollateralAlreadyReleased");
  });
});
