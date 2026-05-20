// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ClearingHouse is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct CollateralPosition {
        address depositor;
        address beneficiary;
        uint256 amount;
        uint256 unlockAt;
        bool released;
    }

    IERC20 public immutable collateralToken;
    uint256 public totalLocked;
    uint256 public nextPositionId;

    mapping(uint256 => CollateralPosition) public positions;
    mapping(address => uint256) public lockedByDepositor;
    mapping(address => uint256) public guaranteedToBeneficiary;

    event CollateralDeposited(
        uint256 indexed positionId,
        address indexed depositor,
        address indexed beneficiary,
        uint256 amount,
        uint256 unlockAt
    );
    event CollateralReleasedToDepositor(
        uint256 indexed positionId,
        address indexed depositor,
        uint256 amount
    );
    event CollateralCancelled(
        uint256 indexed positionId,
        address indexed depositor,
        address indexed beneficiary,
        uint256 amount
    );
    event CollateralReleasedToBeneficiary(
        uint256 indexed positionId,
        address indexed depositor,
        address indexed beneficiary,
        uint256 amount
    );

    error InvalidToken();
    error InvalidBeneficiary();
    error InvalidAmount();
    error InvalidUnlockTime();
    error PositionNotFound();
    error CollateralStillLocked(uint256 unlockAt);
    error CollateralAlreadyReleased();

    constructor(
        IERC20 _collateralToken,
        address trusteeOwner
    ) Ownable(trusteeOwner) {
        if (address(_collateralToken) == address(0)) revert InvalidToken();

        collateralToken = _collateralToken;
        nextPositionId = 1;
    }

    modifier whenPositionUnlocked(uint256 positionId) {
        CollateralPosition storage position = positions[positionId];
        if (position.depositor == address(0)) revert PositionNotFound();
        if (block.timestamp < position.unlockAt) {
            revert CollateralStillLocked(position.unlockAt);
        }
        _;
    }

    function depositCollateral(
        uint256 amount,
        address beneficiary,
        uint256 unlockAt
    ) external nonReentrant returns (uint256 positionId) {
        if (amount == 0) revert InvalidAmount();
        if (beneficiary == address(0)) revert InvalidBeneficiary();
        if (unlockAt <= block.timestamp) revert InvalidUnlockTime();

        positionId = nextPositionId++;
        positions[positionId] = CollateralPosition({
            depositor: msg.sender,
            beneficiary: beneficiary,
            amount: amount,
            unlockAt: unlockAt,
            released: false
        });

        lockedByDepositor[msg.sender] += amount;
        guaranteedToBeneficiary[beneficiary] += amount;
        totalLocked += amount;

        collateralToken.safeTransferFrom(msg.sender, address(this), amount);

        emit CollateralDeposited(
            positionId,
            msg.sender,
            beneficiary,
            amount,
            unlockAt
        );
    }

    function releaseCollateralToDepositor(
        uint256 positionId
    ) external onlyOwner nonReentrant whenPositionUnlocked(positionId) {
        CollateralPosition storage position = positions[positionId];
        if (position.released) revert CollateralAlreadyReleased();

        uint256 amount = position.amount;
        position.released = true;

        lockedByDepositor[position.depositor] -= amount;
        guaranteedToBeneficiary[position.beneficiary] -= amount;
        totalLocked -= amount;

        collateralToken.safeTransfer(position.depositor, amount);

        emit CollateralReleasedToDepositor(
            positionId,
            position.depositor,
            amount
        );
    }

    function cancelAndReturnToDepositor(
        uint256 positionId
    ) external onlyOwner nonReentrant {
        CollateralPosition storage position = positions[positionId];
        if (position.depositor == address(0)) revert PositionNotFound();
        if (position.released) revert CollateralAlreadyReleased();

        uint256 amount = position.amount;
        position.released = true;

        lockedByDepositor[position.depositor] -= amount;
        guaranteedToBeneficiary[position.beneficiary] -= amount;
        totalLocked -= amount;

        collateralToken.safeTransfer(position.depositor, amount);

        emit CollateralCancelled(
            positionId,
            position.depositor,
            position.beneficiary,
            amount
        );
    }

    function releaseCollateralToBeneficiary(
        uint256 positionId
    ) external onlyOwner nonReentrant whenPositionUnlocked(positionId) {
        CollateralPosition storage position = positions[positionId];
        if (position.released) revert CollateralAlreadyReleased();

        uint256 amount = position.amount;
        position.released = true;

        lockedByDepositor[position.depositor] -= amount;
        guaranteedToBeneficiary[position.beneficiary] -= amount;
        totalLocked -= amount;

        collateralToken.safeTransfer(position.beneficiary, amount);

        emit CollateralReleasedToBeneficiary(
            positionId,
            position.depositor,
            position.beneficiary,
            amount
        );
    }

    function getPosition(
        uint256 positionId
    )
        external
        view
        returns (
            address depositor,
            address beneficiary,
            uint256 amount,
            uint256 unlockAt,
            bool released
        )
    {
        CollateralPosition storage position = positions[positionId];
        if (position.depositor == address(0)) revert PositionNotFound();

        return (
            position.depositor,
            position.beneficiary,
            position.amount,
            position.unlockAt,
            position.released
        );
    }
}
