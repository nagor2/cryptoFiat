// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IDAO.sol";
import "./ICDP.sol";

contract InflationFund {
    IDAO immutable dao;
    IERC20 coin;
    ICDP cdp;

    uint256 public lastEmission;
    event inflationEmission(uint256 amount, address spender);

    constructor(address _INTDAOaddress){
        dao = IDAO(_INTDAOaddress);
        lastEmission = block.timestamp;
    }

    function renewContracts() public{
        coin = IERC20(dao.addresses("stableCoin"));
        cdp = ICDP(dao.addresses("cdp"));
    }

    function claimEmission() external{
        uint256 period = block.timestamp - lastEmission;
        require (period>=365 days, "too early to claim");
        uint256 amount = period/365 days*dao.params("annualInflationPercent")*coin.totalSupply()/100;
        lastEmission = block.timestamp;
        require (amount>0, "nothing to emit");
        cdp.claimEmission(amount, dao.addresses("inflationSpender"));
        emit inflationEmission(amount, dao.addresses("inflationSpender"));
    }
}
