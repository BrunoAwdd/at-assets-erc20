// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SALT - Security ALT Token (ERC-1400 compatible, ERC-20 retrocompatível)
 * @dev Implementa os pilares do padrão ERC-1400:
 *   - ERC-1594: Transferências com validação (canTransfer / transferWithData)
 *   - ERC-1643: Gestão de documentos legais on-chain
 *   - ERC-1644: Controle por autoridade (forceTransfer)
 *   - ERC-1410: Partições (classes de tokens: LOCKED / UNLOCKED)
 *
 * A interface ERC-20 continua funcionando normalmente para compatibilidade
 * com exchanges e carteiras existentes.
 *
 * Invariante de partição:
 *   - Transferências ERC-20 padrão (transfer/transferFrom/transferWithData)
 *     movem exclusivamente tokens da partição UNLOCKED.
 *   - transferByPartition e redeemByPartition operam em qualquer partição
 *     via flag _byPartition que suspende o hook _update.
 *   - movePartition rebalanceia partições sem alterar o saldo ERC-20.
 */
contract SALT is ERC20, ERC20Burnable, Ownable {

    // ─── CONSTANTES DE PARTIÇÃO ────────────────────────────────────────────
    bytes32 public constant PARTITION_UNLOCKED = keccak256("UNLOCKED");
    bytes32 public constant PARTITION_LOCKED   = keccak256("LOCKED");

    // ─── ESTADO ────────────────────────────────────────────────────────────

    /// @dev Indica se novos tokens ainda podem ser emitidos
    bool public isIssuable = true;

    /// @dev Indica se um controller pode fazer force-transfer
    bool public isControllable = true;

    /// @dev Controllers autorizados a fazer force-transfer
    mapping(address => bool) public controllers;

    /// @dev Endereços bloqueados para transferência (KYC / compliance)
    mapping(address => bool) public blocked;

    /// @dev Endereços com acesso de leitura privilegiada (investidores KYC)
    mapping(address => bool) public viewers;

    // ERC-1410: saldo por partição para cada holder
    mapping(address => mapping(bytes32 => uint256)) private _balanceByPartition;

    /// @dev Quando true, o hook _update não ajusta _balanceByPartition
    ///      (a função chamadora cuida das partições manualmente)
    bool private _byPartition;

    // ERC-1643: documentos legais atrelados ao token
    struct Document {
        string uri;
        bytes32 documentHash;
        uint256 lastModified;
    }
    mapping(bytes32 => Document) private _documents;
    bytes32[] private _documentNames;

    // ─── EVENTOS ───────────────────────────────────────────────────────────

    // ERC-1400
    event Issued(address indexed operator, address indexed to, uint256 value, bytes data);
    event Redeemed(address indexed operator, address indexed from, uint256 value, bytes data);
    event AuthorizedOperator(address indexed operator, address indexed tokenHolder);
    event RevokedOperator(address indexed operator, address indexed tokenHolder);

    // ERC-1410
    event IssuedByPartition(bytes32 indexed partition, address indexed to, uint256 value, bytes data);
    event RedeemedByPartition(bytes32 indexed partition, address indexed from, uint256 value, bytes data);
    event TransferByPartition(bytes32 indexed fromPartition, address indexed from, address indexed to, uint256 value);
    event PartitionMoved(bytes32 indexed fromPartition, bytes32 indexed toPartition, address indexed holder, uint256 value);

    // ERC-1643
    event DocumentUpdated(bytes32 indexed name, string uri, bytes32 documentHash);
    event DocumentRemoved(bytes32 indexed name, string uri, bytes32 documentHash);

    // ERC-1644
    event ControllerTransfer(address indexed controller, address indexed from, address indexed to, uint256 value);

    // Compliance
    event AddressBlocked(address indexed addr);
    event AddressUnblocked(address indexed addr);
    event IssuanceLocked();
    event ControllabilityRevoked();

    // Viewers
    event ViewerAdded(address indexed addr);
    event ViewerRemoved(address indexed addr);

    // ─── MODIFICADORES ─────────────────────────────────────────────────────

    modifier onlyController() {
        require(controllers[msg.sender] || msg.sender == owner(), "SALT: not a controller");
        _;
    }

    modifier onlyIssuable() {
        require(isIssuable, "SALT: issuance is locked");
        _;
    }

    modifier notBlocked(address from, address to) {
        require(!blocked[from], "SALT: sender is blocked");
        require(!blocked[to], "SALT: recipient is blocked");
        _;
    }

    // ─── CONSTRUTOR ────────────────────────────────────────────────────────

    constructor() ERC20("503-SALT", "SALT") Ownable(msg.sender) {
        // Emite o supply total na partição UNLOCKED
        uint256 initialSupply = 6_802_250_000;
        _issueByPartition(PARTITION_UNLOCKED, msg.sender, initialSupply, "");
    }

    // ─── ERC-20 OVERRIDE ───────────────────────────────────────────────────

    function decimals() public view virtual override returns (uint8) {
        return 0;
    }

    /// @dev Valida bloqueios antes de qualquer transferência ERC-20 padrão
    function transfer(address to, uint256 amount)
        public override notBlocked(msg.sender, to) returns (bool)
    {
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount)
        public override notBlocked(from, to) returns (bool)
    {
        return super.transferFrom(from, to, amount);
    }

    /**
     * @dev Hook central do ERC-20. Mantém _balanceByPartition[UNLOCKED] em
     *      sincronia com o saldo ERC-20 para todas as operações padrão.
     *      Quando _byPartition=true a função chamadora gerencia as partições.
     */
    function _update(address from, address to, uint256 value)
        internal virtual override(ERC20)
    {
        if (!_byPartition) {
            if (from != address(0)) {
                require(
                    _balanceByPartition[from][PARTITION_UNLOCKED] >= value,
                    "SALT: insufficient unlocked balance"
                );
                _balanceByPartition[from][PARTITION_UNLOCKED] -= value;
            }
            if (to != address(0)) {
                _balanceByPartition[to][PARTITION_UNLOCKED] += value;
            }
        }
        super._update(from, to, value);
    }

    // ─── ERC-1594: Transferência com Dados e Validação ─────────────────────

    /**
     * @notice Verifica se uma transferência pode ser realizada.
     * @return (statusCode, reason, partitionCode)
     *   statusCode: 0x51 = sucesso, 0x50 = falha
     */
    function canTransfer(address to, uint256 value, bytes calldata /*data*/)
        external view returns (bytes1, bytes32, bytes32)
    {
        if (blocked[msg.sender]) return (0x50, bytes32("Sender blocked"), bytes32(0));
        if (blocked[to])         return (0x50, bytes32("Recipient blocked"), bytes32(0));
        if (_balanceByPartition[msg.sender][PARTITION_UNLOCKED] < value)
            return (0x50, bytes32("Insufficient unlocked balance"), bytes32(0));

        return (0x51, bytes32("Transfer OK"), PARTITION_UNLOCKED);
    }

    /**
     * @notice Transferência ERC-20 com dados extras (para auditoria/compliance).
     *         Opera na partição UNLOCKED.
     */
    function transferWithData(address to, uint256 value, bytes calldata /*data*/)
        external notBlocked(msg.sender, to)
    {
        _transfer(msg.sender, to, value);
    }

    /**
     * @notice Emissão com dados — apenas owner enquanto isIssuable=true.
     *         Tokens são emitidos na partição UNLOCKED.
     */
    function issue(address tokenHolder, uint256 value, bytes calldata data)
        external onlyOwner onlyIssuable
    {
        _issueByPartition(PARTITION_UNLOCKED, tokenHolder, value, data);
        emit Issued(msg.sender, tokenHolder, value, data);
    }

    /**
     * @notice Queima tokens do próprio chamador da partição UNLOCKED.
     */
    function redeem(uint256 value, bytes calldata data) external {
        // _update cuida de subtrair de PARTITION_UNLOCKED automaticamente
        _burn(msg.sender, value);
        emit Redeemed(msg.sender, msg.sender, value, data);
    }

    /**
     * @notice Queima tokens de uma partição específica do chamador.
     */
    function redeemByPartition(bytes32 partition, uint256 value, bytes calldata data) external {
        require(_balanceByPartition[msg.sender][partition] >= value, "SALT: insufficient partition balance");
        _byPartition = true;
        _burn(msg.sender, value);
        _byPartition = false;
        _balanceByPartition[msg.sender][partition] -= value;
        emit RedeemedByPartition(partition, msg.sender, value, data);
        emit Redeemed(msg.sender, msg.sender, value, data);
    }

    /**
     * @notice Bloqueia a emissão de novos tokens permanentemente.
     */
    function lockIssuance() external onlyOwner {
        isIssuable = false;
        emit IssuanceLocked();
    }

    // ─── ERC-1644: Controller Operations ──────────────────────────────────

    /**
     * @notice Força uma transferência de `from` para `to` (uso regulatório).
     *         Opera na partição UNLOCKED. Para tokens LOCKED use
     *         movePartition antes de chamar esta função.
     */
    function controllerTransfer(
        address from,
        address to,
        uint256 value,
        bytes calldata /*data*/,
        bytes calldata /*operatorData*/
    ) external onlyController {
        require(isControllable, "SALT: controllability revoked");
        // _update mantém PARTITION_UNLOCKED em sincronia automaticamente
        _transfer(from, to, value);
        emit ControllerTransfer(msg.sender, from, to, value);
    }

    /**
     * @notice Revoga permanentemente o poder de force-transfer.
     */
    function revokeControllability() external onlyOwner {
        isControllable = false;
        emit ControllabilityRevoked();
    }

    /**
     * @notice Adiciona um controller.
     */
    function addController(address controller) external onlyOwner {
        controllers[controller] = true;
        emit AuthorizedOperator(controller, address(0));
    }

    /**
     * @notice Remove um controller.
     */
    function removeController(address controller) external onlyOwner {
        controllers[controller] = false;
        emit RevokedOperator(controller, address(0));
    }

    // ─── VIEWERS: Acesso de leitura privilegiada ───────────────────────────

    /**
     * @notice Concede acesso de leitura privilegiada a um endereço (investidor KYC).
     */
    function addViewer(address addr) external onlyOwner {
        viewers[addr] = true;
        emit ViewerAdded(addr);
    }

    /**
     * @notice Revoga o acesso de leitura privilegiada.
     */
    function removeViewer(address addr) external onlyOwner {
        viewers[addr] = false;
        emit ViewerRemoved(addr);
    }

    // ─── ERC-1410: Partições ───────────────────────────────────────────────

    /**
     * @notice Retorna o saldo de uma partição específica de um holder.
     */
    function balanceOfByPartition(bytes32 partition, address tokenHolder)
        external view returns (uint256)
    {
        return _balanceByPartition[tokenHolder][partition];
    }

    /**
     * @notice Transfere tokens de uma partição específica para outro endereço.
     *         A partição é preservada no destinatário.
     */
    function transferByPartition(
        bytes32 fromPartition,
        address to,
        uint256 value,
        bytes calldata data
    ) external notBlocked(msg.sender, to) returns (bytes32) {
        require(_balanceByPartition[msg.sender][fromPartition] >= value, "SALT: insufficient partition balance");
        _byPartition = true;
        _transfer(msg.sender, to, value);
        _byPartition = false;
        _balanceByPartition[msg.sender][fromPartition] -= value;
        _balanceByPartition[to][fromPartition] += value;
        emit TransferByPartition(fromPartition, msg.sender, to, value);
        return fromPartition;
    }

    /**
     * @notice Move tokens entre partições de um mesmo holder (ex: LOCKED → UNLOCKED).
     *         O saldo ERC-20 total permanece inalterado.
     */
    function movePartition(bytes32 fromPartition, bytes32 toPartition, uint256 value)
        external
    {
        require(_balanceByPartition[msg.sender][fromPartition] >= value, "SALT: insufficient partition balance");
        _balanceByPartition[msg.sender][fromPartition] -= value;
        _balanceByPartition[msg.sender][toPartition] += value;
        emit PartitionMoved(fromPartition, toPartition, msg.sender, value);
    }

    // ─── ERC-1643: Documentos ──────────────────────────────────────────────

    /**
     * @notice Adiciona ou atualiza um documento legal vinculado ao token.
     */
    function setDocument(bytes32 name, string calldata uri, bytes32 documentHash)
        external onlyOwner
    {
        if (_documents[name].lastModified == 0) {
            _documentNames.push(name);
        }
        _documents[name] = Document({ uri: uri, documentHash: documentHash, lastModified: block.timestamp });
        emit DocumentUpdated(name, uri, documentHash);
    }

    /**
     * @notice Remove um documento legal registrado.
     */
    function removeDocument(bytes32 name) external onlyOwner {
        Document memory doc = _documents[name];
        require(doc.lastModified != 0, "SALT: document does not exist");

        uint256 len = _documentNames.length;
        for (uint256 i = 0; i < len; i++) {
            if (_documentNames[i] == name) {
                _documentNames[i] = _documentNames[len - 1];
                _documentNames.pop();
                break;
            }
        }

        emit DocumentRemoved(name, doc.uri, doc.documentHash);
        delete _documents[name];
    }

    /**
     * @notice Retorna os dados de um documento pelo seu nome.
     */
    function getDocument(bytes32 name)
        external view returns (string memory, bytes32, uint256)
    {
        Document memory doc = _documents[name];
        return (doc.uri, doc.documentHash, doc.lastModified);
    }

    /**
     * @notice Lista todos os nomes de documentos registrados.
     */
    function getAllDocuments() external view returns (bytes32[] memory) {
        return _documentNames;
    }

    // ─── COMPLIANCE: Bloqueio de Endereços ────────────────────────────────

    /**
     * @notice Bloqueia um endereço (KYC, sanção, etc).
     */
    function blockAddress(address addr) external onlyController {
        blocked[addr] = true;
        emit AddressBlocked(addr);
    }

    /**
     * @notice Desbloqueia um endereço.
     */
    function unblockAddress(address addr) external onlyController {
        blocked[addr] = false;
        emit AddressUnblocked(addr);
    }

    // ─── INTERNAL ──────────────────────────────────────────────────────────

    function _issueByPartition(bytes32 partition, address to, uint256 value, bytes memory data) internal {
        _byPartition = true;
        _mint(to, value);
        _byPartition = false;
        _balanceByPartition[to][partition] += value;
        emit IssuedByPartition(partition, to, value, data);
    }
}
