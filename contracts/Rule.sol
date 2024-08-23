// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.19 <0.9.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./IDAO.sol";

contract Rule is ERC20{
    /// @notice DAO interface.
    IDAO immutable dao;

    /// @notice Constructor for Rule contract. It mints initial Rule supply to the creator.
    /// @param _INTDAOaddress address of the main DAO contract.
    constructor(address _INTDAOaddress) ERC20("Rule token", "RLE"){
        _mint(msg.sender, 10**6*10**decimals());
        dao = IDAO(_INTDAOaddress);
    }

    /// @notice Minting additional Rule tokens. Only authorized address can execute it.
    /// @param to Address to receive newly minted tokens.
    /// @param amount Amount of tokens to mint.
    function mint(address to, uint256 amount) public{
        require(dao.isAuthorized(msg.sender), "only authorized address may do this");
        _mint(to, amount);
    }

    /// @notice Burning Rule tokens. Only authorized address can execute it.
    /// @param from Address to burn tokens from.
    /// @param amount Amount of tokens to burn.
    function burn(address from, uint256 amount) public{
        require(dao.isAuthorized(msg.sender), "only authorized address may do this");
        _burn(from, amount);
    }
}
