// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.19 <0.9.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./IDAO.sol";

contract stableCoin is ERC20{

    /// @notice DAO interface.
    IDAO immutable dao;

    /// @notice Constructor for stableCoin contract.
    /// @param _INTDAOaddress address of the main DAO contract.
    constructor(address _INTDAOaddress) ERC20("dot Flat coin", "DFC"){
        dao = IDAO(_INTDAOaddress);
    }

    /// @notice Minting additional stablecoins. Only authorized address can execute it.
    /// @param to Address to receive newly minted stablecoins.
    /// @param amount Amount of stablecoins to mint.
    function mint(address to, uint256 amount) external{
        require(dao.isAuthorized(msg.sender), "only authorized address may do this");
        _mint(to, amount);
    }

    /// @notice Burning stablecoins. Only authorized address can execute it.
    /// @param from Address to burn stablecoins from.
    /// @param amount Amount of stablecoins to burn.
    function burn(address from, uint256 amount) external{
        require(dao.isAuthorized(msg.sender), "only authorized address may do this");
        _burn(from, amount);
    }
}