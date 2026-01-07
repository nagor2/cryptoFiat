// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.19 <0.9.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./IDAO.sol";

contract flatCoin is ERC20{

    /// @notice DAO interface.
    IDAO immutable dao;
    
    /// @notice Emitted when new flatCoins are minted
    event Mint(address indexed to, uint256 amount);
    
    /// @notice Emitted when flatCoins are burned
    event Burn(address indexed from, uint256 amount);

    /// @notice Constructor for flatCoin contract.
    /// @param _INTDAOaddress address of the main DAO contract.
    constructor(address _INTDAOaddress) ERC20("dotFlat", "DFC") payable{
        dao = IDAO(_INTDAOaddress);
    }

    // @notice Modifier to check that the caller is authorized by the DAO
    modifier isAuthorized() {
        require(dao.isAuthorized(msg.sender), "authorized only");
        _;
    }

    /// @notice Minting additional flatcoins. Only an authorized address can execute this function.
    /// @param to Address to receive newly minted flatcoins.
    /// @param amount Amount of flatcoins to mint.
    function mint(address to, uint256 amount) external isAuthorized{
        _mint(to, amount);
        emit Mint(to, amount);
    }

    /// @notice Burning flatcoins. Only an authorized address can execute this function.
    /// @param from Address to burn flatcoins from.
    /// @param amount Amount of flatcoins to burn.
    function burn(address from, uint256 amount) external isAuthorized{
        _burn(from, amount);
        emit Burn(from, amount);
    }
}