// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./IDAO.sol";

contract stableCoin is ERC20{
    IDAO dao;

    constructor(address _INTDAOaddress) ERC20("True Stable Coin", "TSC"){
        dao = IDAO(_INTDAOaddress);
        dao.setAddressOnce("stableCoin", address(this));
    }

    function mint(address to, uint256 amount) external{
        require (msg.sender == dao.addresses("cdp"), "only collateral contract is authorized to mint");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external{
        require (msg.sender == dao.addresses("cdp"), "only collateral contract is authorized to burn");
        _burn(from, amount);
    }
}