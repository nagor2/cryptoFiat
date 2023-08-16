// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IDAO.sol";
import "./ICDP.sol";

contract InflationFund {
    IDAO dao;
    IERC20 coin;
    ICDP cdp;

    uint256 public lastEmission;
    event inflationEmission(uint256 amount);

    constructor(address INTDAOaddress){
        dao = IDAO(INTDAOaddress);
        dao.setAddressOnce('inflationFund',address(this));
        lastEmission = block.timestamp;
        renewContracts();
    }

    function renewContracts() public{
        coin = IERC20(dao.addresses('stableCoin'));
        cdp = ICDP(dao.addresses('cdp'));
    }

    function claimEmission() external{
        uint256 period = block.timestamp - lastEmission;
        require (period>=365 days, "too early to claim");
        uint256 amount = period/365 days*dao.params("annualInflationPercent")*coin.totalSupply()/100;
        lastEmission = block.timestamp;
        require (amount>0, "nothing to emit");
        cdp.claimEmission(amount,address(this));
        emit inflationEmission(amount);
    }

    function claimTransfer() external{
        coin.transfer(dao.addresses("inflationSpender"), coin.balanceOf(address(this)));
    }
}
