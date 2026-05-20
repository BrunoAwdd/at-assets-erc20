import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const INITIAL_SUPPLY = 1_360_450_000n;

describe("SALTT", function () {
  async function deploySALTTFixture() {
    const [owner, controller, alice, bob, charlie] =
      await hre.ethers.getSigners();

    const SALTT = await hre.ethers.getContractFactory("SALTT");
    const saltt = await SALTT.deploy();

    const PARTITION_UNLOCKED = await saltt.PARTITION_UNLOCKED();
    const PARTITION_LOCKED = await saltt.PARTITION_LOCKED();

    return { saltt, owner, controller, alice, bob, charlie, PARTITION_UNLOCKED, PARTITION_LOCKED };
  }

  // ─── Deployment ────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("deve ter nome e símbolo corretos", async function () {
      const { saltt } = await loadFixture(deploySALTTFixture);
      expect(await saltt.name()).to.equal("503-SALTT");
      expect(await saltt.symbol()).to.equal("SALTT");
    });

    it("deve ter 0 decimais", async function () {
      const { saltt } = await loadFixture(deploySALTTFixture);
      expect(await saltt.decimals()).to.equal(0);
    });

    it("deve emitir o supply total para o owner", async function () {
      const { saltt, owner } = await loadFixture(deploySALTTFixture);
      expect(await saltt.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await saltt.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });

    it("deve atribuir o supply inteiro à partição UNLOCKED do owner", async function () {
      const { saltt, owner, PARTITION_UNLOCKED } = await loadFixture(deploySALTTFixture);
      expect(await saltt.balanceOfByPartition(PARTITION_UNLOCKED, owner.address))
        .to.equal(INITIAL_SUPPLY);
    });

    it("deve ter partição LOCKED zerada no owner", async function () {
      const { saltt, owner, PARTITION_LOCKED } = await loadFixture(deploySALTTFixture);
      expect(await saltt.balanceOfByPartition(PARTITION_LOCKED, owner.address)).to.equal(0n);
    });

    it("deve configurar o owner corretamente", async function () {
      const { saltt, owner } = await loadFixture(deploySALTTFixture);
      expect(await saltt.owner()).to.equal(owner.address);
    });

    it("deve iniciar com isIssuable=true e isControllable=true", async function () {
      const { saltt } = await loadFixture(deploySALTTFixture);
      expect(await saltt.isIssuable()).to.be.true;
      expect(await saltt.isControllable()).to.be.true;
    });
  });

  // ─── ERC-20 ────────────────────────────────────────────────────────────

  describe("ERC-20", function () {
    it("transfer: move saldo ERC-20 e partição UNLOCKED", async function () {
      const { saltt, owner, alice, PARTITION_UNLOCKED } = await loadFixture(deploySALTTFixture);
      await saltt.transfer(alice.address, 1000n);
      expect(await saltt.balanceOf(alice.address)).to.equal(1000n);
      expect(await saltt.balanceOfByPartition(PARTITION_UNLOCKED, alice.address)).to.equal(1000n);
      expect(await saltt.balanceOfByPartition(PARTITION_UNLOCKED, owner.address))
        .to.equal(INITIAL_SUPPLY - 1000n);
    });

    it("transferFrom: move saldo com allowance e atualiza partição", async function () {
      const { saltt, owner, alice, bob, PARTITION_UNLOCKED } = await loadFixture(deploySALTTFixture);
      await saltt.approve(alice.address, 200n);
      await saltt.connect(alice).transferFrom(owner.address, bob.address, 200n);
      expect(await saltt.balanceOf(bob.address)).to.equal(200n);
      expect(await saltt.balanceOfByPartition(PARTITION_UNLOCKED, bob.address)).to.equal(200n);
    });

    it("transfer: reverte se saldo insuficiente", async function () {
      const { saltt, alice, bob } = await loadFixture(deploySALTTFixture);
      await expect(saltt.connect(alice).transfer(bob.address, 1n)).to.be.reverted;
    });
  });

  // ─── Compliance ────────────────────────────────────────────────────────

  describe("Compliance: Bloqueio de endereços", function () {
    it("bloqueia remetente na transfer", async function () {
      const { saltt, owner, alice, bob } = await loadFixture(deploySALTTFixture);
      await saltt.transfer(alice.address, 500n);
      await saltt.blockAddress(alice.address);
      await expect(saltt.connect(alice).transfer(bob.address, 100n))
        .to.be.revertedWith("SALTT: sender is blocked");
    });

    it("bloqueia destinatário na transfer", async function () {
      const { saltt, alice } = await loadFixture(deploySALTTFixture);
      await saltt.blockAddress(alice.address);
      await expect(saltt.transfer(alice.address, 100n))
        .to.be.revertedWith("SALTT: recipient is blocked");
    });

    it("apenas controller pode bloquear/desbloquear", async function () {
      const { saltt, alice, bob } = await loadFixture(deploySALTTFixture);
      await expect(saltt.connect(alice).blockAddress(bob.address))
        .to.be.revertedWith("SALTT: not a controller");
    });

    it("unblockAddress restaura transferência", async function () {
      const { saltt, alice } = await loadFixture(deploySALTTFixture);
      await saltt.blockAddress(alice.address);
      await saltt.unblockAddress(alice.address);
      await expect(saltt.transfer(alice.address, 100n)).to.not.be.reverted;
    });
  });

  // ─── ERC-1594 ──────────────────────────────────────────────────────────

  describe("ERC-1594", function () {
    it("canTransfer: retorna 0x51 quando válido", async function () {
      const { saltt, alice } = await loadFixture(deploySALTTFixture);
      const [code] = await saltt.canTransfer(alice.address, 100n, "0x");
      expect(code).to.equal("0x51");
    });

    it("canTransfer: retorna 0x50 quando UNLOCKED insuficiente", async function () {
      const { saltt, alice, PARTITION_UNLOCKED, PARTITION_LOCKED } =
        await loadFixture(deploySALTTFixture);
      await saltt.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, INITIAL_SUPPLY);
      const [code] = await saltt.canTransfer(alice.address, 1n, "0x");
      expect(code).to.equal("0x50");
    });

    it("issue: owner emite tokens na partição UNLOCKED", async function () {
      const { saltt, alice, PARTITION_UNLOCKED } = await loadFixture(deploySALTTFixture);
      await saltt.issue(alice.address, 500n, "0x");
      expect(await saltt.balanceOf(alice.address)).to.equal(500n);
      expect(await saltt.balanceOfByPartition(PARTITION_UNLOCKED, alice.address)).to.equal(500n);
    });

    it("issue: reverte após lockIssuance", async function () {
      const { saltt, alice } = await loadFixture(deploySALTTFixture);
      await saltt.lockIssuance();
      await expect(saltt.issue(alice.address, 1n, "0x"))
        .to.be.revertedWith("SALTT: issuance is locked");
    });

    it("redeem: queima da partição UNLOCKED", async function () {
      const { saltt, owner, PARTITION_UNLOCKED } = await loadFixture(deploySALTTFixture);
      await saltt.redeem(1000n, "0x");
      expect(await saltt.totalSupply()).to.equal(INITIAL_SUPPLY - 1000n);
      expect(await saltt.balanceOfByPartition(PARTITION_UNLOCKED, owner.address))
        .to.equal(INITIAL_SUPPLY - 1000n);
    });

    it("redeem: reverte se saldo UNLOCKED insuficiente", async function () {
      const { saltt, PARTITION_UNLOCKED, PARTITION_LOCKED } =
        await loadFixture(deploySALTTFixture);
      await saltt.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, INITIAL_SUPPLY);
      await expect(saltt.redeem(1n, "0x"))
        .to.be.revertedWith("SALTT: insufficient unlocked balance");
    });

    it("redeemByPartition: queima de partição LOCKED", async function () {
      const { saltt, owner, PARTITION_UNLOCKED, PARTITION_LOCKED } =
        await loadFixture(deploySALTTFixture);
      await saltt.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, 500n);
      await saltt.redeemByPartition(PARTITION_LOCKED, 500n, "0x");
      expect(await saltt.balanceOfByPartition(PARTITION_LOCKED, owner.address)).to.equal(0n);
      expect(await saltt.totalSupply()).to.equal(INITIAL_SUPPLY - 500n);
    });
  });

  // ─── ERC-1644 ──────────────────────────────────────────────────────────

  describe("ERC-1644: Controller Operations", function () {
    it("controllerTransfer: controller força transferência", async function () {
      const { saltt, owner, controller, alice, bob, PARTITION_UNLOCKED } =
        await loadFixture(deploySALTTFixture);
      await saltt.addController(controller.address);
      await saltt.transfer(alice.address, 1000n);
      await saltt.connect(controller).controllerTransfer(alice.address, bob.address, 500n, "0x", "0x");
      expect(await saltt.balanceOf(bob.address)).to.equal(500n);
      expect(await saltt.balanceOfByPartition(PARTITION_UNLOCKED, bob.address)).to.equal(500n);
    });

    it("controllerTransfer: não-controller reverte", async function () {
      const { saltt, owner, alice, bob } = await loadFixture(deploySALTTFixture);
      await expect(saltt.connect(alice).controllerTransfer(owner.address, bob.address, 1n, "0x", "0x"))
        .to.be.revertedWith("SALTT: not a controller");
    });

    it("controllerTransfer: reverte após revokeControllability", async function () {
      const { saltt, owner, alice } = await loadFixture(deploySALTTFixture);
      await saltt.revokeControllability();
      await expect(saltt.controllerTransfer(owner.address, alice.address, 1n, "0x", "0x"))
        .to.be.revertedWith("SALTT: controllability revoked");
    });
  });

  // ─── ERC-1410 ──────────────────────────────────────────────────────────

  describe("ERC-1410: Partições", function () {
    it("transferByPartition: transfere UNLOCKED mantendo partição", async function () {
      const { saltt, owner, alice, PARTITION_UNLOCKED } = await loadFixture(deploySALTTFixture);
      await saltt.transferByPartition(PARTITION_UNLOCKED, alice.address, 800n, "0x");
      expect(await saltt.balanceOfByPartition(PARTITION_UNLOCKED, alice.address)).to.equal(800n);
      expect(await saltt.balanceOfByPartition(PARTITION_UNLOCKED, owner.address))
        .to.equal(INITIAL_SUPPLY - 800n);
    });

    it("transferByPartition: transfere LOCKED corretamente", async function () {
      const { saltt, owner, alice, PARTITION_UNLOCKED, PARTITION_LOCKED } =
        await loadFixture(deploySALTTFixture);
      await saltt.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, 1000n);
      await saltt.transferByPartition(PARTITION_LOCKED, alice.address, 1000n, "0x");
      expect(await saltt.balanceOfByPartition(PARTITION_LOCKED, alice.address)).to.equal(1000n);
      expect(await saltt.balanceOfByPartition(PARTITION_LOCKED, owner.address)).to.equal(0n);
    });

    it("movePartition: move sem alterar saldo ERC-20", async function () {
      const { saltt, owner, PARTITION_UNLOCKED, PARTITION_LOCKED } =
        await loadFixture(deploySALTTFixture);
      const before = await saltt.balanceOf(owner.address);
      await saltt.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, 2000n);
      expect(await saltt.balanceOf(owner.address)).to.equal(before);
      expect(await saltt.balanceOfByPartition(PARTITION_LOCKED, owner.address)).to.equal(2000n);
    });

    it("movePartition: emite PartitionMoved", async function () {
      const { saltt, owner, PARTITION_UNLOCKED, PARTITION_LOCKED } =
        await loadFixture(deploySALTTFixture);
      await expect(saltt.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, 500n))
        .to.emit(saltt, "PartitionMoved")
        .withArgs(PARTITION_UNLOCKED, PARTITION_LOCKED, owner.address, 500n);
    });
  });

  // ─── ERC-1643 ──────────────────────────────────────────────────────────

  describe("ERC-1643: Documentos", function () {
    const docName = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("prospecto-saltt"));
    const docUri = "ipfs://Qm456def";
    const docHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("conteudo-saltt"));

    it("setDocument / getDocument / removeDocument funcionam", async function () {
      const { saltt } = await loadFixture(deploySALTTFixture);
      await saltt.setDocument(docName, docUri, docHash);
      const [uri, , ts] = await saltt.getDocument(docName);
      expect(uri).to.equal(docUri);
      expect(ts).to.be.gt(0n);

      await saltt.removeDocument(docName);
      const [uriAfter, , tsAfter] = await saltt.getDocument(docName);
      expect(uriAfter).to.equal("");
      expect(tsAfter).to.equal(0n);
    });

    it("removeDocument: reverte se não existe", async function () {
      const { saltt } = await loadFixture(deploySALTTFixture);
      await expect(saltt.removeDocument(docName))
        .to.be.revertedWith("SALTT: document does not exist");
    });

    it("apenas owner pode gerenciar documentos", async function () {
      const { saltt, alice } = await loadFixture(deploySALTTFixture);
      await expect(saltt.connect(alice).setDocument(docName, docUri, docHash))
        .to.be.revertedWithCustomError(saltt, "OwnableUnauthorizedAccount");
    });
  });

  // ─── Viewers ───────────────────────────────────────────────────────────

  describe("Viewers: Acesso de leitura privilegiada", function () {
    it("owner pode adicionar viewer", async function () {
      const { saltt, alice } = await loadFixture(deploySALTTFixture);
      await saltt.addViewer(alice.address);
      expect(await saltt.viewers(alice.address)).to.be.true;
    });

    it("addViewer emite ViewerAdded", async function () {
      const { saltt, alice } = await loadFixture(deploySALTTFixture);
      await expect(saltt.addViewer(alice.address))
        .to.emit(saltt, "ViewerAdded")
        .withArgs(alice.address);
    });

    it("owner pode remover viewer", async function () {
      const { saltt, alice } = await loadFixture(deploySALTTFixture);
      await saltt.addViewer(alice.address);
      await saltt.removeViewer(alice.address);
      expect(await saltt.viewers(alice.address)).to.be.false;
    });

    it("removeViewer emite ViewerRemoved", async function () {
      const { saltt, alice } = await loadFixture(deploySALTTFixture);
      await saltt.addViewer(alice.address);
      await expect(saltt.removeViewer(alice.address))
        .to.emit(saltt, "ViewerRemoved")
        .withArgs(alice.address);
    });

    it("apenas owner pode adicionar viewer", async function () {
      const { saltt, alice, bob } = await loadFixture(deploySALTTFixture);
      await expect(saltt.connect(alice).addViewer(bob.address))
        .to.be.revertedWithCustomError(saltt, "OwnableUnauthorizedAccount");
    });

    it("apenas owner pode remover viewer", async function () {
      const { saltt, alice, bob } = await loadFixture(deploySALTTFixture);
      await saltt.addViewer(bob.address);
      await expect(saltt.connect(alice).removeViewer(bob.address))
        .to.be.revertedWithCustomError(saltt, "OwnableUnauthorizedAccount");
    });

    it("endereço não adicionado não é viewer", async function () {
      const { saltt, alice } = await loadFixture(deploySALTTFixture);
      expect(await saltt.viewers(alice.address)).to.be.false;
    });

    it("viewer pode coexistir com controller sem conflito", async function () {
      const { saltt, alice } = await loadFixture(deploySALTTFixture);
      await saltt.addViewer(alice.address);
      await saltt.addController(alice.address);
      expect(await saltt.viewers(alice.address)).to.be.true;
      expect(await saltt.controllers(alice.address)).to.be.true;
    });
  });

  // ─── Invariantes ───────────────────────────────────────────────────────

  describe("Invariantes de partição", function () {
    it("soma das partições iguala balanceOf após múltiplas operações", async function () {
      const { saltt, owner, alice, bob, PARTITION_UNLOCKED, PARTITION_LOCKED } =
        await loadFixture(deploySALTTFixture);

      await saltt.transfer(alice.address, 5000n);
      await saltt.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, 2000n);
      await saltt.transferByPartition(PARTITION_LOCKED, bob.address, 1000n, "0x");
      await saltt.issue(alice.address, 500n, "0x");
      await saltt.redeem(100n, "0x");

      for (const signer of [owner, alice, bob]) {
        const erc20 = await saltt.balanceOf(signer.address);
        const unlocked = await saltt.balanceOfByPartition(PARTITION_UNLOCKED, signer.address);
        const locked = await saltt.balanceOfByPartition(PARTITION_LOCKED, signer.address);
        expect(unlocked + locked).to.equal(erc20,
          `Partições desincronizadas para ${signer.address}`);
      }
    });

    it("tokens LOCKED bloqueiam transfer ERC-20 quando UNLOCKED zerado", async function () {
      const { saltt, alice, PARTITION_UNLOCKED, PARTITION_LOCKED } =
        await loadFixture(deploySALTTFixture);
      await saltt.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, INITIAL_SUPPLY);
      await expect(saltt.transfer(alice.address, 1n))
        .to.be.revertedWith("SALTT: insufficient unlocked balance");
    });
  });
});
