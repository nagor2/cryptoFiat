// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.19 <0.9.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./IDAO.sol";

contract Rule is ERC20{
    /// @notice DAO interface.
    IDAO immutable dao;

    /// @notice Constructor for the Rule contract. It mints the initial Rule supply to the creator.
    /// @param _INTDAOaddress Address of the main DAO contract.
    constructor(address _INTDAOaddress) ERC20("Rule token", "RLE") payable{
        _mint(msg.sender, 10**6*10**decimals());
        dao = IDAO(_INTDAOaddress);
    }

    // @notice Modifier to check that the caller is authorized by the DAO
    modifier isAuthorized() {
        require(dao.isAuthorized(msg.sender), "authorized only");
        _;
    }

    /// @notice Mint additional Rule tokens. Only an authorized address can execute it.
    /// @param to Address to receive newly minted tokens.
    /// @param amount Amount of tokens to mint.
    function mint(address to, uint256 amount) public isAuthorized{
        _mint(to, amount);
    }

    /// @notice Burn Rule tokens. Only an authorized address can execute it.
    /// @param from Address to burn tokens from.
    /// @param amount Amount of tokens to burn.
    function burn(address from, uint256 amount) public isAuthorized{
        _burn(from, amount);
    }
}
