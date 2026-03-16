import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AltT is ERC20, ERC20Burnable, Ownable {
    constructor() ERC20("503-ALTT", "ALTT") Ownable(msg.sender) {
        //_mint(msg.sender, 1000 * 10 ** decimals());
        _mint(msg.sender, 1_360_450_000);
    }

    function decimals() public view virtual override returns (uint8) {
        return 0;
    }
}