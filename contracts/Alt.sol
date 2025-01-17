import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Alt is ERC20, ERC20Burnable, Ownable {
    constructor() ERC20("503-ALT", "ALT") Ownable(msg.sender) {
        //_mint(msg.sender, 1000 * 10 ** decimals());
        _mint(msg.sender, 6_802_250_000);
    }

    function decimals() public view virtual override returns (uint8) {
        return 0;
    }
}