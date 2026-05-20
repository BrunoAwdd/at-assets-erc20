import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

const INITIAL_SUPPLY = 6_802_250_000n;

describe("SALT", function () {
  async function deploySALTFixture() {
    const [owner, controller, alice, bob, charlie] =
      await hre.ethers.getSigners();

    const SALT = await hre.ethers.getContractFactory("SALT");
    const salt = await SALT.deploy();

    const PARTITION_UNLOCKED = await salt.PARTITION_UNLOCKED();
    const PARTITION_LOCKED = await salt.PARTITION_LOCKED();

    return { salt, owner, controller, alice, bob, charlie, PARTITION_UNLOCKED, PARTITION_LOCKED };
  }

  // ─── Deployment ────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("deve ter nome e símbolo corretos", async function () {
      const { salt } = await loadFixture(deploySALTFixture);
      expect(await salt.name()).to.equal("503-SALT");
      expect(await salt.symbol()).to.equal("SALT");
    });

    it("deve ter 0 decimais", async function () {
      const { salt } = await loadFixture(deploySALTFixture);
      expect(await salt.decimals()).to.equal(0);
    });

    it("deve emitir o supply total para o owner", async function () {
      const { salt, owner } = await loadFixture(deploySALTFixture);
      expect(await salt.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await salt.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });

    it("deve atribuir o supply inteiro à partição UNLOCKED do owner", async function () {
      const { salt, owner, PARTITION_UNLOCKED } = await loadFixture(deploySALTFixture);
      expect(await salt.balanceOfByPartition(PARTITION_UNLOCKED, owner.address))
        .to.equal(INITIAL_SUPPLY);
    });

    it("deve ter partição LOCKED zerada no owner", async function () {
      const { salt, owner, PARTITION_LOCKED } = await loadFixture(deploySALTFixture);
      expect(await salt.balanceOfByPartition(PARTITION_LOCKED, owner.address))
        .to.equal(0n);
    });

    it("deve configurar o owner corretamente", async function () {
      const { salt, owner } = await loadFixture(deploySALTFixture);
      expect(await salt.owner()).to.equal(owner.address);
    });

    it("deve iniciar com isIssuable=true e isControllable=true", async function () {
      const { salt } = await loadFixture(deploySALTFixture);
      expect(await salt.isIssuable()).to.be.true;
      expect(await salt.isControllable()).to.be.true;
    });
  });

  // ─── ERC-20 padrão ─────────────────────────────────────────────────────

  describe("ERC-20", function () {
    it("transfer: move saldo ERC-20 e partição UNLOCKED", async function () {
      const { salt, owner, alice, PARTITION_UNLOCKED } = await loadFixture(deploySALTFixture);
      await salt.transfer(alice.address, 1000n);
      expect(await salt.balanceOf(alice.address)).to.equal(1000n);
      expect(await salt.balanceOfByPartition(PARTITION_UNLOCKED, alice.address)).to.equal(1000n);
      expect(await salt.balanceOfByPartition(PARTITION_UNLOCKED, owner.address))
        .to.equal(INITIAL_SUPPLY - 1000n);
    });

    it("transfer: emite evento Transfer", async function () {
      const { salt, owner, alice } = await loadFixture(deploySALTFixture);
      await expect(salt.transfer(alice.address, 500n))
        .to.emit(salt, "Transfer")
        .withArgs(owner.address, alice.address, 500n);
    });

    it("transferFrom: move saldo com allowance", async function () {
      const { salt, owner, alice, bob, PARTITION_UNLOCKED } = await loadFixture(deploySALTFixture);
      await salt.approve(alice.address, 200n);
      await salt.connect(alice).transferFrom(owner.address, bob.address, 200n);
      expect(await salt.balanceOf(bob.address)).to.equal(200n);
      expect(await salt.balanceOfByPartition(PARTITION_UNLOCKED, bob.address)).to.equal(200n);
    });

    it("transfer: reverte se saldo insuficiente", async function () {
      const { salt, alice, bob } = await loadFixture(deploySALTFixture);
      await expect(salt.connect(alice).transfer(bob.address, 1n))
        .to.be.reverted;
    });
  });

  // ─── Compliance: Bloqueio ──────────────────────────────────────────────

  describe("Compliance: Bloqueio de endereços", function () {
    it("blockAddress: bloqueia remetente (transfer)", async function () {
      const { salt, owner, alice, bob } = await loadFixture(deploySALTFixture);
      await salt.transfer(alice.address, 500n);
      await salt.blockAddress(alice.address);
      await expect(salt.connect(alice).transfer(bob.address, 100n))
        .to.be.revertedWith("SALT: sender is blocked");
    });

    it("blockAddress: bloqueia destinatário (transfer)", async function () {
      const { salt, alice } = await loadFixture(deploySALTFixture);
      await salt.blockAddress(alice.address);
      await expect(salt.transfer(alice.address, 100n))
        .to.be.revertedWith("SALT: recipient is blocked");
    });

    it("blockAddress: bloqueia remetente (transferFrom)", async function () {
      const { salt, owner, alice, bob } = await loadFixture(deploySALTFixture);
      await salt.transfer(alice.address, 500n);
      await salt.connect(alice).approve(bob.address, 500n);
      await salt.blockAddress(alice.address);
      await expect(salt.connect(bob).transferFrom(alice.address, bob.address, 100n))
        .to.be.revertedWith("SALT: sender is blocked");
    });

    it("blockAddress: emite evento AddressBlocked", async function () {
      const { salt, alice } = await loadFixture(deploySALTFixture);
      await expect(salt.blockAddress(alice.address))
        .to.emit(salt, "AddressBlocked")
        .withArgs(alice.address);
    });

    it("unblockAddress: desbloqueia e permite transferência", async function () {
      const { salt, alice } = await loadFixture(deploySALTFixture);
      await salt.blockAddress(alice.address);
      await salt.unblockAddress(alice.address);
      await expect(salt.transfer(alice.address, 100n)).to.not.be.reverted;
    });

    it("unblockAddress: emite evento AddressUnblocked", async function () {
      const { salt, alice } = await loadFixture(deploySALTFixture);
      await salt.blockAddress(alice.address);
      await expect(salt.unblockAddress(alice.address))
        .to.emit(salt, "AddressUnblocked")
        .withArgs(alice.address);
    });

    it("block/unblock: apenas controller pode chamar", async function () {
      const { salt, alice, bob } = await loadFixture(deploySALTFixture);
      await expect(salt.connect(alice).blockAddress(bob.address))
        .to.be.revertedWith("SALT: not a controller");
      await expect(salt.connect(alice).unblockAddress(bob.address))
        .to.be.revertedWith("SALT: not a controller");
    });

    it("controller pode bloquear/desbloquear", async function () {
      const { salt, controller, alice } = await loadFixture(deploySALTFixture);
      await salt.addController(controller.address);
      await expect(salt.connect(controller).blockAddress(alice.address)).to.not.be.reverted;
      await expect(salt.connect(controller).unblockAddress(alice.address)).to.not.be.reverted;
    });
  });

  // ─── ERC-1594: Transferência com Dados e Validação ────────────────────

  describe("ERC-1594", function () {
    describe("canTransfer", function () {
      it("retorna sucesso (0x51) quando transferência é válida", async function () {
        const { salt, alice } = await loadFixture(deploySALTFixture);
        const [code, , partition] = await salt.canTransfer(alice.address, 100n, "0x");
        expect(code).to.equal("0x51");
      });

      it("retorna falha (0x50) quando remetente está bloqueado", async function () {
        const { salt, owner, alice } = await loadFixture(deploySALTFixture);
        await salt.blockAddress(owner.address);
        const [code] = await salt.canTransfer(alice.address, 100n, "0x");
        expect(code).to.equal("0x50");
      });

      it("retorna falha (0x50) quando destinatário está bloqueado", async function () {
        const { salt, alice } = await loadFixture(deploySALTFixture);
        await salt.blockAddress(alice.address);
        const [code] = await salt.canTransfer(alice.address, 100n, "0x");
        expect(code).to.equal("0x50");
      });

      it("retorna falha (0x50) quando saldo UNLOCKED é insuficiente", async function () {
        const { salt, alice, bob } = await loadFixture(deploySALTFixture);
        const [code] = await salt.connect(alice).canTransfer(bob.address, 1n, "0x");
        expect(code).to.equal("0x50");
      });

      it("retorna falha (0x50) quando tokens estão na partição LOCKED", async function () {
        const { salt, owner, alice, PARTITION_UNLOCKED, PARTITION_LOCKED } =
          await loadFixture(deploySALTFixture);
        // Move todo o saldo para LOCKED
        await salt.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, INITIAL_SUPPLY);
        const [code] = await salt.canTransfer(alice.address, 1n, "0x");
        expect(code).to.equal("0x50");
      });
    });

    describe("transferWithData", function () {
      it("transfere tokens e mantém partição em sincronia", async function () {
        const { salt, owner, alice, PARTITION_UNLOCKED } = await loadFixture(deploySALTFixture);
        await salt.transferWithData(alice.address, 300n, "0x");
        expect(await salt.balanceOf(alice.address)).to.equal(300n);
        expect(await salt.balanceOfByPartition(PARTITION_UNLOCKED, alice.address)).to.equal(300n);
      });

      it("reverte se remetente bloqueado", async function () {
        const { salt, owner, alice } = await loadFixture(deploySALTFixture);
        await salt.blockAddress(owner.address);
        await expect(salt.transferWithData(alice.address, 100n, "0x"))
          .to.be.revertedWith("SALT: sender is blocked");
      });
    });

    describe("issue", function () {
      it("owner pode emitir novos tokens na partição UNLOCKED", async function () {
        const { salt, alice, PARTITION_UNLOCKED } = await loadFixture(deploySALTFixture);
        await salt.issue(alice.address, 1000n, "0x");
        expect(await salt.balanceOf(alice.address)).to.equal(1000n);
        expect(await salt.balanceOfByPartition(PARTITION_UNLOCKED, alice.address)).to.equal(1000n);
        expect(await salt.totalSupply()).to.equal(INITIAL_SUPPLY + 1000n);
      });

      it("emite evento Issued e IssuedByPartition", async function () {
        const { salt, alice, PARTITION_UNLOCKED } = await loadFixture(deploySALTFixture);
        const tx = salt.issue(alice.address, 500n, "0x01");
        await expect(tx).to.emit(salt, "IssuedByPartition")
          .withArgs(PARTITION_UNLOCKED, alice.address, 500n, "0x01");
        await expect(tx).to.emit(salt, "Issued");
      });

      it("não-owner não pode emitir", async function () {
        const { salt, alice, bob } = await loadFixture(deploySALTFixture);
        await expect(salt.connect(alice).issue(bob.address, 1n, "0x"))
          .to.be.revertedWithCustomError(salt, "OwnableUnauthorizedAccount");
      });

      it("reverte após lockIssuance", async function () {
        const { salt, alice } = await loadFixture(deploySALTFixture);
        await salt.lockIssuance();
        await expect(salt.issue(alice.address, 1n, "0x"))
          .to.be.revertedWith("SALT: issuance is locked");
      });
    });

    describe("lockIssuance", function () {
      it("define isIssuable=false e emite evento", async function () {
        const { salt } = await loadFixture(deploySALTFixture);
        await expect(salt.lockIssuance()).to.emit(salt, "IssuanceLocked");
        expect(await salt.isIssuable()).to.be.false;
      });

      it("apenas owner pode bloquear emissão", async function () {
        const { salt, alice } = await loadFixture(deploySALTFixture);
        await expect(salt.connect(alice).lockIssuance())
          .to.be.revertedWithCustomError(salt, "OwnableUnauthorizedAccount");
      });
    });

    describe("redeem", function () {
      it("queima tokens da partição UNLOCKED e reduz totalSupply", async function () {
        const { salt, owner, PARTITION_UNLOCKED } = await loadFixture(deploySALTFixture);
        await salt.redeem(1000n, "0x");
        expect(await salt.totalSupply()).to.equal(INITIAL_SUPPLY - 1000n);
        expect(await salt.balanceOfByPartition(PARTITION_UNLOCKED, owner.address))
          .to.equal(INITIAL_SUPPLY - 1000n);
      });

      it("emite evento Redeemed", async function () {
        const { salt, owner } = await loadFixture(deploySALTFixture);
        await expect(salt.redeem(100n, "0xAB"))
          .to.emit(salt, "Redeemed")
          .withArgs(owner.address, owner.address, 100n, "0xab");
      });

      it("reverte se tentar resgatar mais do que o saldo UNLOCKED", async function () {
        const { salt, owner, PARTITION_UNLOCKED, PARTITION_LOCKED } =
          await loadFixture(deploySALTFixture);
        // Move todo saldo para LOCKED — UNLOCKED fica zerado
        await salt.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, INITIAL_SUPPLY);
        await expect(salt.redeem(1n, "0x"))
          .to.be.revertedWith("SALT: insufficient unlocked balance");
      });
    });

    describe("redeemByPartition", function () {
      it("queima tokens de partição específica", async function () {
        const { salt, owner, PARTITION_UNLOCKED, PARTITION_LOCKED } =
          await loadFixture(deploySALTFixture);
        await salt.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, 500n);
        await salt.redeemByPartition(PARTITION_LOCKED, 500n, "0x");
        expect(await salt.balanceOfByPartition(PARTITION_LOCKED, owner.address)).to.equal(0n);
        expect(await salt.totalSupply()).to.equal(INITIAL_SUPPLY - 500n);
      });

      it("emite RedeemedByPartition e Redeemed", async function () {
        const { salt, owner, PARTITION_UNLOCKED, PARTITION_LOCKED } =
          await loadFixture(deploySALTFixture);
        await salt.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, 200n);
        const tx = salt.redeemByPartition(PARTITION_LOCKED, 200n, "0x");
        await expect(tx).to.emit(salt, "RedeemedByPartition")
          .withArgs(PARTITION_LOCKED, owner.address, 200n, "0x");
        await expect(tx).to.emit(salt, "Redeemed");
      });

      it("reverte se saldo insuficiente na partição", async function () {
        const { salt, PARTITION_LOCKED } = await loadFixture(deploySALTFixture);
        await expect(salt.redeemByPartition(PARTITION_LOCKED, 1n, "0x"))
          .to.be.revertedWith("SALT: insufficient partition balance");
      });
    });
  });

  // ─── ERC-1644: Controller Operations ──────────────────────────────────

  describe("ERC-1644: Controller Operations", function () {
    describe("addController / removeController", function () {
      it("owner adiciona controller e emite AuthorizedOperator", async function () {
        const { salt, controller } = await loadFixture(deploySALTFixture);
        await expect(salt.addController(controller.address))
          .to.emit(salt, "AuthorizedOperator")
          .withArgs(controller.address, hre.ethers.ZeroAddress);
        expect(await salt.controllers(controller.address)).to.be.true;
      });

      it("owner remove controller e emite RevokedOperator", async function () {
        const { salt, controller } = await loadFixture(deploySALTFixture);
        await salt.addController(controller.address);
        await expect(salt.removeController(controller.address))
          .to.emit(salt, "RevokedOperator")
          .withArgs(controller.address, hre.ethers.ZeroAddress);
        expect(await salt.controllers(controller.address)).to.be.false;
      });

      it("não-owner não pode adicionar controller", async function () {
        const { salt, alice, bob } = await loadFixture(deploySALTFixture);
        await expect(salt.connect(alice).addController(bob.address))
          .to.be.revertedWithCustomError(salt, "OwnableUnauthorizedAccount");
      });
    });

    describe("controllerTransfer", function () {
      it("controller força transferência entre endereços", async function () {
        const { salt, owner, controller, alice, bob, PARTITION_UNLOCKED } =
          await loadFixture(deploySALTFixture);
        await salt.addController(controller.address);
        await salt.transfer(alice.address, 1000n);

        await salt.connect(controller).controllerTransfer(alice.address, bob.address, 500n, "0x", "0x");

        expect(await salt.balanceOf(alice.address)).to.equal(500n);
        expect(await salt.balanceOf(bob.address)).to.equal(500n);
        expect(await salt.balanceOfByPartition(PARTITION_UNLOCKED, alice.address)).to.equal(500n);
        expect(await salt.balanceOfByPartition(PARTITION_UNLOCKED, bob.address)).to.equal(500n);
      });

      it("owner também pode fazer controllerTransfer", async function () {
        const { salt, owner, alice } = await loadFixture(deploySALTFixture);
        await expect(salt.controllerTransfer(owner.address, alice.address, 100n, "0x", "0x"))
          .to.not.be.reverted;
      });

      it("emite evento ControllerTransfer", async function () {
        const { salt, owner, alice } = await loadFixture(deploySALTFixture);
        await expect(salt.controllerTransfer(owner.address, alice.address, 100n, "0x", "0x"))
          .to.emit(salt, "ControllerTransfer")
          .withArgs(owner.address, owner.address, alice.address, 100n);
      });

      it("não-controller não pode fazer force-transfer", async function () {
        const { salt, owner, alice, bob } = await loadFixture(deploySALTFixture);
        await expect(salt.connect(alice).controllerTransfer(owner.address, bob.address, 100n, "0x", "0x"))
          .to.be.revertedWith("SALT: not a controller");
      });

      it("reverte após revokeControllability", async function () {
        const { salt, owner, alice } = await loadFixture(deploySALTFixture);
        await salt.revokeControllability();
        await expect(salt.controllerTransfer(owner.address, alice.address, 100n, "0x", "0x"))
          .to.be.revertedWith("SALT: controllability revoked");
      });
    });

    describe("revokeControllability", function () {
      it("define isControllable=false e emite evento", async function () {
        const { salt } = await loadFixture(deploySALTFixture);
        await expect(salt.revokeControllability()).to.emit(salt, "ControllabilityRevoked");
        expect(await salt.isControllable()).to.be.false;
      });

      it("apenas owner pode revogar", async function () {
        const { salt, alice } = await loadFixture(deploySALTFixture);
        await expect(salt.connect(alice).revokeControllability())
          .to.be.revertedWithCustomError(salt, "OwnableUnauthorizedAccount");
      });
    });
  });

  // ─── ERC-1410: Partições ───────────────────────────────────────────────

  describe("ERC-1410: Partições", function () {
    describe("transferByPartition", function () {
      it("transfere tokens de UNLOCKED mantendo partição no destinatário", async function () {
        const { salt, owner, alice, PARTITION_UNLOCKED } = await loadFixture(deploySALTFixture);
        await salt.transferByPartition(PARTITION_UNLOCKED, alice.address, 800n, "0x");
        expect(await salt.balanceOf(alice.address)).to.equal(800n);
        expect(await salt.balanceOfByPartition(PARTITION_UNLOCKED, alice.address)).to.equal(800n);
        expect(await salt.balanceOfByPartition(PARTITION_UNLOCKED, owner.address))
          .to.equal(INITIAL_SUPPLY - 800n);
      });

      it("transfere tokens de LOCKED sem alterar totalSupply", async function () {
        const { salt, owner, alice, PARTITION_UNLOCKED, PARTITION_LOCKED } =
          await loadFixture(deploySALTFixture);
        await salt.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, 1000n);
        await salt.transferByPartition(PARTITION_LOCKED, alice.address, 1000n, "0x");
        expect(await salt.balanceOf(alice.address)).to.equal(1000n);
        expect(await salt.balanceOfByPartition(PARTITION_LOCKED, alice.address)).to.equal(1000n);
        expect(await salt.balanceOfByPartition(PARTITION_LOCKED, owner.address)).to.equal(0n);
        expect(await salt.totalSupply()).to.equal(INITIAL_SUPPLY);
      });

      it("emite evento TransferByPartition", async function () {
        const { salt, owner, alice, PARTITION_UNLOCKED } = await loadFixture(deploySALTFixture);
        await expect(salt.transferByPartition(PARTITION_UNLOCKED, alice.address, 50n, "0x"))
          .to.emit(salt, "TransferByPartition")
          .withArgs(PARTITION_UNLOCKED, owner.address, alice.address, 50n);
      });

      it("reverte se saldo insuficiente na partição", async function () {
        const { salt, alice, PARTITION_LOCKED } = await loadFixture(deploySALTFixture);
        await expect(salt.transferByPartition(PARTITION_LOCKED, alice.address, 1n, "0x"))
          .to.be.revertedWith("SALT: insufficient partition balance");
      });

      it("reverte se destinatário bloqueado", async function () {
        const { salt, alice, PARTITION_UNLOCKED } = await loadFixture(deploySALTFixture);
        await salt.blockAddress(alice.address);
        await expect(salt.transferByPartition(PARTITION_UNLOCKED, alice.address, 100n, "0x"))
          .to.be.revertedWith("SALT: recipient is blocked");
      });
    });

    describe("movePartition", function () {
      it("move tokens entre partições sem alterar saldo ERC-20", async function () {
        const { salt, owner, PARTITION_UNLOCKED, PARTITION_LOCKED } =
          await loadFixture(deploySALTFixture);
        const balanceBefore = await salt.balanceOf(owner.address);
        await salt.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, 2000n);
        expect(await salt.balanceOf(owner.address)).to.equal(balanceBefore);
        expect(await salt.balanceOfByPartition(PARTITION_LOCKED, owner.address)).to.equal(2000n);
        expect(await salt.balanceOfByPartition(PARTITION_UNLOCKED, owner.address))
          .to.equal(INITIAL_SUPPLY - 2000n);
      });

      it("emite evento PartitionMoved", async function () {
        const { salt, owner, PARTITION_UNLOCKED, PARTITION_LOCKED } =
          await loadFixture(deploySALTFixture);
        await expect(salt.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, 500n))
          .to.emit(salt, "PartitionMoved")
          .withArgs(PARTITION_UNLOCKED, PARTITION_LOCKED, owner.address, 500n);
      });

      it("reverte se saldo insuficiente na partição de origem", async function () {
        const { salt, PARTITION_LOCKED, PARTITION_UNLOCKED } = await loadFixture(deploySALTFixture);
        await expect(salt.movePartition(PARTITION_LOCKED, PARTITION_UNLOCKED, 1n))
          .to.be.revertedWith("SALT: insufficient partition balance");
      });
    });
  });

  // ─── ERC-1643: Documentos ──────────────────────────────────────────────

  describe("ERC-1643: Documentos", function () {
    const docName = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("prospecto"));
    const docUri = "ipfs://Qm123abc";
    const docHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("conteudo-do-doc"));

    it("setDocument: adiciona documento e emite DocumentUpdated", async function () {
      const { salt } = await loadFixture(deploySALTFixture);
      await expect(salt.setDocument(docName, docUri, docHash))
        .to.emit(salt, "DocumentUpdated")
        .withArgs(docName, docUri, docHash);
    });

    it("getDocument: retorna dados corretos", async function () {
      const { salt } = await loadFixture(deploySALTFixture);
      await salt.setDocument(docName, docUri, docHash);
      const [uri, hash, ts] = await salt.getDocument(docName);
      expect(uri).to.equal(docUri);
      expect(hash).to.equal(docHash);
      expect(ts).to.be.gt(0n);
    });

    it("setDocument: atualiza documento existente sem duplicar em getAllDocuments", async function () {
      const { salt } = await loadFixture(deploySALTFixture);
      await salt.setDocument(docName, docUri, docHash);
      const newUri = "ipfs://Qm456def";
      await salt.setDocument(docName, newUri, docHash);
      const docs = await salt.getAllDocuments();
      expect(docs.length).to.equal(1);
      const [uri] = await salt.getDocument(docName);
      expect(uri).to.equal(newUri);
    });

    it("getAllDocuments: lista todos os nomes", async function () {
      const { salt } = await loadFixture(deploySALTFixture);
      const name2 = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("whitepaper"));
      await salt.setDocument(docName, docUri, docHash);
      await salt.setDocument(name2, "ipfs://white", docHash);
      const docs = await salt.getAllDocuments();
      expect(docs.length).to.equal(2);
      expect(docs).to.include(docName);
      expect(docs).to.include(name2);
    });

    it("removeDocument: remove e emite DocumentRemoved", async function () {
      const { salt } = await loadFixture(deploySALTFixture);
      await salt.setDocument(docName, docUri, docHash);
      await expect(salt.removeDocument(docName))
        .to.emit(salt, "DocumentRemoved")
        .withArgs(docName, docUri, docHash);
      const docs = await salt.getAllDocuments();
      expect(docs.length).to.equal(0);
    });

    it("removeDocument: reverte se documento não existe", async function () {
      const { salt } = await loadFixture(deploySALTFixture);
      await expect(salt.removeDocument(docName))
        .to.be.revertedWith("SALT: document does not exist");
    });

    it("removeDocument: getDocument retorna vazio após remoção", async function () {
      const { salt } = await loadFixture(deploySALTFixture);
      await salt.setDocument(docName, docUri, docHash);
      await salt.removeDocument(docName);
      const [uri, , ts] = await salt.getDocument(docName);
      expect(uri).to.equal("");
      expect(ts).to.equal(0n);
    });

    it("apenas owner pode chamar setDocument e removeDocument", async function () {
      const { salt, alice } = await loadFixture(deploySALTFixture);
      await expect(salt.connect(alice).setDocument(docName, docUri, docHash))
        .to.be.revertedWithCustomError(salt, "OwnableUnauthorizedAccount");
      await salt.setDocument(docName, docUri, docHash);
      await expect(salt.connect(alice).removeDocument(docName))
        .to.be.revertedWithCustomError(salt, "OwnableUnauthorizedAccount");
    });
  });

  // ─── Viewers ───────────────────────────────────────────────────────────

  describe("Viewers: Acesso de leitura privilegiada", function () {
    it("owner pode adicionar viewer", async function () {
      const { salt, alice } = await loadFixture(deploySALTFixture);
      await salt.addViewer(alice.address);
      expect(await salt.viewers(alice.address)).to.be.true;
    });

    it("addViewer emite ViewerAdded", async function () {
      const { salt, alice } = await loadFixture(deploySALTFixture);
      await expect(salt.addViewer(alice.address))
        .to.emit(salt, "ViewerAdded")
        .withArgs(alice.address);
    });

    it("owner pode remover viewer", async function () {
      const { salt, alice } = await loadFixture(deploySALTFixture);
      await salt.addViewer(alice.address);
      await salt.removeViewer(alice.address);
      expect(await salt.viewers(alice.address)).to.be.false;
    });

    it("removeViewer emite ViewerRemoved", async function () {
      const { salt, alice } = await loadFixture(deploySALTFixture);
      await salt.addViewer(alice.address);
      await expect(salt.removeViewer(alice.address))
        .to.emit(salt, "ViewerRemoved")
        .withArgs(alice.address);
    });

    it("apenas owner pode adicionar viewer", async function () {
      const { salt, alice, bob } = await loadFixture(deploySALTFixture);
      await expect(salt.connect(alice).addViewer(bob.address))
        .to.be.revertedWithCustomError(salt, "OwnableUnauthorizedAccount");
    });

    it("apenas owner pode remover viewer", async function () {
      const { salt, alice, bob } = await loadFixture(deploySALTFixture);
      await salt.addViewer(bob.address);
      await expect(salt.connect(alice).removeViewer(bob.address))
        .to.be.revertedWithCustomError(salt, "OwnableUnauthorizedAccount");
    });

    it("endereço não adicionado não é viewer", async function () {
      const { salt, alice } = await loadFixture(deploySALTFixture);
      expect(await salt.viewers(alice.address)).to.be.false;
    });

    it("viewer pode coexistir com controller sem conflito", async function () {
      const { salt, alice } = await loadFixture(deploySALTFixture);
      await salt.addViewer(alice.address);
      await salt.addController(alice.address);
      expect(await salt.viewers(alice.address)).to.be.true;
      expect(await salt.controllers(alice.address)).to.be.true;
    });
  });

  // ─── Invariantes de partição ───────────────────────────────────────────

  describe("Invariantes de partição", function () {
    it("soma das partições deve igualar balanceOf após múltiplas operações", async function () {
      const { salt, owner, alice, bob, PARTITION_UNLOCKED, PARTITION_LOCKED } =
        await loadFixture(deploySALTFixture);

      // operações mistas
      await salt.transfer(alice.address, 5000n);
      await salt.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, 2000n);
      await salt.transferByPartition(PARTITION_LOCKED, bob.address, 1000n, "0x");
      await salt.issue(alice.address, 500n, "0x");
      await salt.redeem(100n, "0x");

      for (const signer of [owner, alice, bob]) {
        const erc20 = await salt.balanceOf(signer.address);
        const unlocked = await salt.balanceOfByPartition(PARTITION_UNLOCKED, signer.address);
        const locked = await salt.balanceOfByPartition(PARTITION_LOCKED, signer.address);
        expect(unlocked + locked).to.equal(erc20,
          `Partições desincronizadas para ${signer.address}`);
      }
    });

    it("transferência ERC-20 padrão não altera partição LOCKED", async function () {
      const { salt, owner, alice, PARTITION_UNLOCKED, PARTITION_LOCKED } =
        await loadFixture(deploySALTFixture);
      await salt.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, 1000n);
      const lockedBefore = await salt.balanceOfByPartition(PARTITION_LOCKED, owner.address);
      await salt.transfer(alice.address, 500n);
      expect(await salt.balanceOfByPartition(PARTITION_LOCKED, owner.address)).to.equal(lockedBefore);
    });

    it("tokens LOCKED bloqueiam transferência ERC-20 quando UNLOCKED é insuficiente", async function () {
      const { salt, owner, alice, PARTITION_UNLOCKED, PARTITION_LOCKED } =
        await loadFixture(deploySALTFixture);
      await salt.movePartition(PARTITION_UNLOCKED, PARTITION_LOCKED, INITIAL_SUPPLY);
      await expect(salt.transfer(alice.address, 1n))
        .to.be.revertedWith("SALT: insufficient unlocked balance");
    });

    it("totalSupply bate com a soma dos balanceOf após issue e redeem", async function () {
      const { salt, alice, bob } = await loadFixture(deploySALTFixture);
      await salt.issue(alice.address, 1000n, "0x");
      await salt.issue(bob.address, 500n, "0x");
      await salt.redeem(200n, "0x");
      const total = await salt.totalSupply();
      const sumBalances =
        (await salt.balanceOf((await hre.ethers.getSigners())[0].address)) +
        (await salt.balanceOf(alice.address)) +
        (await salt.balanceOf(bob.address));
      expect(total).to.equal(sumBalances);
    });
  });
});
