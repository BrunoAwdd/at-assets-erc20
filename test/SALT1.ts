import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const INITIAL_SUPPLY = 1_360_450_000n;

describe("SALT1", function () {
  async function deploySALT1Fixture() {
    const [owner, controller, alice, bob, charlie] =
      await hre.ethers.getSigners();

    const SALT1 = await hre.ethers.getContractFactory("SALT1");
    const salt1 = await SALT1.deploy();

    const PARTITION_UNLOCKED = await salt1.PARTITION_UNLOCKED();
    const PARTITION_LOCKED = await salt1.PARTITION_LOCKED();

    return { salt1, owner, controller, alice, bob, charlie, PARTITION_UNLOCKED, PARTITION_LOCKED };
  }

  // ─── Deployment ────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("deve ter nome e símbolo corretos", async function () {
      const { salt1 } = await loadFixture(deploySALT1Fixture);
      expect(await salt1.name()).to.equal("503-SALT-1");
      expect(await salt1.symbol()).to.equal("SALT1");
    });

    it("deve ter 0 decimais", async function () {
      const { salt1 } = await loadFixture(deploySALT1Fixture);
      expect(await salt1.decimals()).to.equal(0);
    });

    it("deve emitir o supply total para o owner", async function () {
      const { salt1, owner } = await loadFixture(deploySALT1Fixture);
      expect(await salt1.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await salt1.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });

    it("deve atribuir o supply inteiro à partição UNLOCKED do owner", async function () {
      const { salt1, owner, PARTITION_UNLOCKED } = await loadFixture(deploySALT1Fixture);
      expect(await salt1.balanceOfByPartition(PARTITION_UNLOCKED, owner.address))
        .to.equal(INITIAL_SUPPLY);
    });

    it("deve ter partição LOCKED zerada no owner", async function () {
      const { salt1, owner, PARTITION_LOCKED } = await loadFixture(deploySALT1Fixture);
      expect(await salt1.balanceOfByPartition(PARTITION_LOCKED, owner.address)).to.equal(0n);
    });

    it("deve configurar o owner corretamente", async function () {
      const { salt1, owner } = await loadFixture(deploySALT1Fixture);
      expect(await salt1.owner()).to.equal(owner.address);
    });

    it("deve iniciar com isIssuable=true e isControllable=true", async function () {
      const { salt1 } = await loadFixture(deploySALT1Fixture);
      expect(await salt1.isIssuable()).to.be.true;
      expect(await salt1.isControllable()).to.be.true;
    });
  });

  // ─── ERC-20 ────────────────────────────────────────────────────────────

  describe("ERC-20", function () {
    it("transfer: move saldo ERC-20 e partição UNLOCKED", async function () {
      const { salt1, owner, alice, PARTITION_UNLOCKED } = await loadFixture(deploySALT1Fixture);
      await salt1.transfer(alice.address, 1000n);
      expect(await salt1.balanceOf(alice.address)).to.equal(1000n);
      expect(await salt1.balanceOfByPartition(PARTITION_UNLOCKED, alice.address)).to.equal(1000n);
      expect(await salt1.balanceOfByPartition(PARTITION_UNLOCKED, owner.address))
        .to.equal(INITIAL_SUPPLY - 1000n);
    });

    it("transferFrom: move saldo com allowance e atualiza partição", async function () {
      const { salt1, owner, alice, bob, PARTITION_UNLOCKED } = await loadFixture(deploySALT1Fixture);
      await salt1.approve(alice.address, 200n);
      await salt1.connect(alice).transferFrom(owner.address, bob.address, 200n);
      expect(await salt1.balanceOf(bob.address)).to.equal(200n);
      expect(await salt1.balanceOfByPartition(PARTITION_UNLOCKED, bob.address)).to.equal(200n);
    });

    it("transfer: reverte se saldo insuficiente", async function () {
      const { salt1, alice, bob } = await loadFixture(deploySALT1Fixture);
      await expect(salt1.connect(alice).transfer(bob.address, 1n)).to.be.reverted;
    });
  });

  // ─── Compliance ────────────────────────────────────────────────────────

  describe("Compliance: Bloqueio de endereços", function () {
    it("bloqueia remetente na transfer", async function () {
      const { salt1, owner, alice, bob } = await loadFixture(deploySALT1Fixture);
      await salt1.transfer(alice.address, 500n);
      await salt1.blockAddress(alice.address);
      await expect(salt1.connect(alice).transfer(bob.address, 100n))
        .to.be.revertedWith("SALT1: sender is blocked");
    });

    it("bloqueia destinatário na transfer", async function () {
      const { salt1, alice } = await loadFixture(deploySALT1Fixture);
      await salt1.blockAddress(alice.address);
      await expect(salt1.transfer(alice.address, 100n))
        .to.be.revertedWith("SALT1: recipient is blocked");
    });

    it("apenas controller pode bloquear/desbloquear", async function () {
      const { salt1, alice, bob } = await loadFixture(deploySALT1Fixture);
      await expect(salt1.connect(alice).blockAddress(bob.address))
        .to.be.revertedWith("SALT1: not a controller");
    });

    it("unblockAddress restaura transferência", async function () {
      const { salt1, alice } = await loadFixture(deploySALT1Fixture);
      await salt1.blockAddress(alice.address);
      await salt1.unblockAddress(alice.address);
      await expect(salt1.transfer(alice.address, 100n)).to.not.be.reverted;
    });
  });

  // ─── ERC-1594 ──────────────────────────────────────────────────────────

  describe("ERC-1594", function () {
    it("canTransfer: retorna 0x51 quando válido", async function () {
      const { salt1, alice } = await loadFixture(deploySALT1Fixture);
      const [code] = await salt1.canTransfer(alice.address, 100n, "0x");
      expect(code).to.equal("0x51");
    });

    it("canTransfer: retorna 0x50 quando UNLOCKED insuficiente", async function () {
      const { salt1, alice, PARTITION_UNLOCKED, PARTITION_LOCKED } =
        await loadFixture(deploySALT1Fixture);
      await salt1.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, INITIAL_SUPPLY);
      const [code] = await salt1.canTransfer(alice.address, 1n, "0x");
      expect(code).to.equal("0x50");
    });

    it("issue: owner emite tokens na partição UNLOCKED", async function () {
      const { salt1, alice, PARTITION_UNLOCKED } = await loadFixture(deploySALT1Fixture);
      await salt1.issue(alice.address, 500n, "0x");
      expect(await salt1.balanceOf(alice.address)).to.equal(500n);
      expect(await salt1.balanceOfByPartition(PARTITION_UNLOCKED, alice.address)).to.equal(500n);
    });

    it("issue: reverte após lockIssuance", async function () {
      const { salt1, alice } = await loadFixture(deploySALT1Fixture);
      await salt1.lockIssuance();
      await expect(salt1.issue(alice.address, 1n, "0x"))
        .to.be.revertedWith("SALT1: issuance is locked");
    });

    it("redeem: queima da partição UNLOCKED", async function () {
      const { salt1, owner, PARTITION_UNLOCKED } = await loadFixture(deploySALT1Fixture);
      await salt1.redeem(1000n, "0x");
      expect(await salt1.totalSupply()).to.equal(INITIAL_SUPPLY - 1000n);
      expect(await salt1.balanceOfByPartition(PARTITION_UNLOCKED, owner.address))
        .to.equal(INITIAL_SUPPLY - 1000n);
    });

    it("redeem: reverte se saldo UNLOCKED insuficiente", async function () {
      const { salt1, PARTITION_UNLOCKED, PARTITION_LOCKED } =
        await loadFixture(deploySALT1Fixture);
      await salt1.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, INITIAL_SUPPLY);
      await expect(salt1.redeem(1n, "0x"))
        .to.be.revertedWith("SALT1: insufficient unlocked balance");
    });

    it("redeemByPartition: queima de partição LOCKED", async function () {
      const { salt1, owner, PARTITION_UNLOCKED, PARTITION_LOCKED } =
        await loadFixture(deploySALT1Fixture);
      await salt1.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, 500n);
      await salt1.redeemByPartition(PARTITION_LOCKED, 500n, "0x");
      expect(await salt1.balanceOfByPartition(PARTITION_LOCKED, owner.address)).to.equal(0n);
      expect(await salt1.totalSupply()).to.equal(INITIAL_SUPPLY - 500n);
    });
  });

  // ─── ERC-1644 ──────────────────────────────────────────────────────────

  describe("ERC-1644: Controller Operations", function () {
    it("controllerTransfer: controller força transferência", async function () {
      const { salt1, owner, controller, alice, bob, PARTITION_UNLOCKED } =
        await loadFixture(deploySALT1Fixture);
      await salt1.addController(controller.address);
      await salt1.transfer(alice.address, 1000n);
      await salt1.connect(controller).controllerTransfer(alice.address, bob.address, 500n, "0x", "0x");
      expect(await salt1.balanceOf(bob.address)).to.equal(500n);
      expect(await salt1.balanceOfByPartition(PARTITION_UNLOCKED, bob.address)).to.equal(500n);
    });

    it("controllerTransfer: não-controller reverte", async function () {
      const { salt1, owner, alice, bob } = await loadFixture(deploySALT1Fixture);
      await expect(salt1.connect(alice).controllerTransfer(owner.address, bob.address, 1n, "0x", "0x"))
        .to.be.revertedWith("SALT1: not a controller");
    });

    it("controllerTransfer: reverte após revokeControllability", async function () {
      const { salt1, owner, alice } = await loadFixture(deploySALT1Fixture);
      await salt1.revokeControllability();
      await expect(salt1.controllerTransfer(owner.address, alice.address, 1n, "0x", "0x"))
        .to.be.revertedWith("SALT1: controllability revoked");
    });
  });

  // ─── ERC-1410 ──────────────────────────────────────────────────────────

  describe("ERC-1410: Partições", function () {
    it("transferByPartition: transfere UNLOCKED mantendo partição", async function () {
      const { salt1, owner, alice, PARTITION_UNLOCKED } = await loadFixture(deploySALT1Fixture);
      await salt1.transferByPartition(PARTITION_UNLOCKED, alice.address, 800n, "0x");
      expect(await salt1.balanceOfByPartition(PARTITION_UNLOCKED, alice.address)).to.equal(800n);
      expect(await salt1.balanceOfByPartition(PARTITION_UNLOCKED, owner.address))
        .to.equal(INITIAL_SUPPLY - 800n);
    });

    it("transferByPartition: transfere LOCKED corretamente", async function () {
      const { salt1, owner, alice, PARTITION_UNLOCKED, PARTITION_LOCKED } =
        await loadFixture(deploySALT1Fixture);
      await salt1.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, 1000n);
      await salt1.transferByPartition(PARTITION_LOCKED, alice.address, 1000n, "0x");
      expect(await salt1.balanceOfByPartition(PARTITION_LOCKED, alice.address)).to.equal(1000n);
      expect(await salt1.balanceOfByPartition(PARTITION_LOCKED, owner.address)).to.equal(0n);
    });

    it("movePartition: move sem alterar saldo ERC-20", async function () {
      const { salt1, owner, PARTITION_UNLOCKED, PARTITION_LOCKED } =
        await loadFixture(deploySALT1Fixture);
      const before = await salt1.balanceOf(owner.address);
      await salt1.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, 2000n);
      expect(await salt1.balanceOf(owner.address)).to.equal(before);
      expect(await salt1.balanceOfByPartition(PARTITION_LOCKED, owner.address)).to.equal(2000n);
    });

    it("movePartition: emite PartitionMoved", async function () {
      const { salt1, owner, PARTITION_UNLOCKED, PARTITION_LOCKED } =
        await loadFixture(deploySALT1Fixture);
      await expect(salt1.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, 500n))
        .to.emit(salt1, "PartitionMoved")
        .withArgs(PARTITION_UNLOCKED, PARTITION_LOCKED, owner.address, 500n);
    });
  });

  // ─── ERC-1643 ──────────────────────────────────────────────────────────

  describe("ERC-1643: Documentos", function () {
    const docName = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("prospecto-salt1"));
    const docUri = "ipfs://Qm123abc";
    const docHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("conteudo"));

    it("setDocument / getDocument / removeDocument funcionam", async function () {
      const { salt1 } = await loadFixture(deploySALT1Fixture);
      await salt1.setDocument(docName, docUri, docHash);
      const [uri, , ts] = await salt1.getDocument(docName);
      expect(uri).to.equal(docUri);
      expect(ts).to.be.gt(0n);

      await salt1.removeDocument(docName);
      const [uriAfter, , tsAfter] = await salt1.getDocument(docName);
      expect(uriAfter).to.equal("");
      expect(tsAfter).to.equal(0n);
    });

    it("removeDocument: reverte se não existe", async function () {
      const { salt1 } = await loadFixture(deploySALT1Fixture);
      await expect(salt1.removeDocument(docName))
        .to.be.revertedWith("SALT1: document does not exist");
    });

    it("apenas owner pode gerenciar documentos", async function () {
      const { salt1, alice } = await loadFixture(deploySALT1Fixture);
      await expect(salt1.connect(alice).setDocument(docName, docUri, docHash))
        .to.be.revertedWithCustomError(salt1, "OwnableUnauthorizedAccount");
    });
  });

  // ─── Viewers ───────────────────────────────────────────────────────────

  describe("Viewers: Acesso de leitura privilegiada", function () {
    it("owner pode adicionar viewer", async function () {
      const { salt1, alice } = await loadFixture(deploySALT1Fixture);
      await salt1.addViewer(alice.address);
      expect(await salt1.viewers(alice.address)).to.be.true;
    });

    it("addViewer emite ViewerAdded", async function () {
      const { salt1, alice } = await loadFixture(deploySALT1Fixture);
      await expect(salt1.addViewer(alice.address))
        .to.emit(salt1, "ViewerAdded")
        .withArgs(alice.address);
    });

    it("owner pode remover viewer", async function () {
      const { salt1, alice } = await loadFixture(deploySALT1Fixture);
      await salt1.addViewer(alice.address);
      await salt1.removeViewer(alice.address);
      expect(await salt1.viewers(alice.address)).to.be.false;
    });

    it("removeViewer emite ViewerRemoved", async function () {
      const { salt1, alice } = await loadFixture(deploySALT1Fixture);
      await salt1.addViewer(alice.address);
      await expect(salt1.removeViewer(alice.address))
        .to.emit(salt1, "ViewerRemoved")
        .withArgs(alice.address);
    });

    it("apenas owner pode adicionar viewer", async function () {
      const { salt1, alice, bob } = await loadFixture(deploySALT1Fixture);
      await expect(salt1.connect(alice).addViewer(bob.address))
        .to.be.revertedWithCustomError(salt1, "OwnableUnauthorizedAccount");
    });

    it("apenas owner pode remover viewer", async function () {
      const { salt1, alice, bob } = await loadFixture(deploySALT1Fixture);
      await salt1.addViewer(bob.address);
      await expect(salt1.connect(alice).removeViewer(bob.address))
        .to.be.revertedWithCustomError(salt1, "OwnableUnauthorizedAccount");
    });

    it("endereço não adicionado não é viewer", async function () {
      const { salt1, alice } = await loadFixture(deploySALT1Fixture);
      expect(await salt1.viewers(alice.address)).to.be.false;
    });

    it("viewer pode coexistir com controller sem conflito", async function () {
      const { salt1, alice } = await loadFixture(deploySALT1Fixture);
      await salt1.addViewer(alice.address);
      await salt1.addController(alice.address);
      expect(await salt1.viewers(alice.address)).to.be.true;
      expect(await salt1.controllers(alice.address)).to.be.true;
    });
  });

  // ─── Invariantes ───────────────────────────────────────────────────────

  describe("Invariantes de partição", function () {
    it("soma das partições iguala balanceOf após múltiplas operações", async function () {
      const { salt1, owner, alice, bob, PARTITION_UNLOCKED, PARTITION_LOCKED } =
        await loadFixture(deploySALT1Fixture);

      await salt1.transfer(alice.address, 5000n);
      await salt1.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, 2000n);
      await salt1.transferByPartition(PARTITION_LOCKED, bob.address, 1000n, "0x");
      await salt1.issue(alice.address, 500n, "0x");
      await salt1.redeem(100n, "0x");

      for (const signer of [owner, alice, bob]) {
        const erc20 = await salt1.balanceOf(signer.address);
        const unlocked = await salt1.balanceOfByPartition(PARTITION_UNLOCKED, signer.address);
        const locked = await salt1.balanceOfByPartition(PARTITION_LOCKED, signer.address);
        expect(unlocked + locked).to.equal(erc20,
          `Partições desincronizadas para ${signer.address}`);
      }
    });

    it("tokens LOCKED bloqueiam transfer ERC-20 quando UNLOCKED zerado", async function () {
      const { salt1, alice, PARTITION_UNLOCKED, PARTITION_LOCKED } =
        await loadFixture(deploySALT1Fixture);
      await salt1.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, INITIAL_SUPPLY);
      await expect(salt1.transfer(alice.address, 1n))
        .to.be.revertedWith("SALT1: insufficient unlocked balance");
    });
  });
});
