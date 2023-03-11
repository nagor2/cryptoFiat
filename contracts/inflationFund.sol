// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.4.22 <0.9.0;
import "./INTDAO.sol";
import "./stableCoin.sol";
import "./CDP.sol";

contract InflationFund {
    INTDAO dao;
    stableCoin coin;
    CDP cdp;

    uint256 public lastEmission;
    event inflationEmission(uint256 amount);

    constructor(address payable INTDAOaddress){
        dao = INTDAO(INTDAOaddress);
        dao.setAddressOnce('inflationFund',payable(address(this)));
        coin = stableCoin(payable(dao.addresses('stableCoin')));
        cdp = CDP(payable(dao.addresses('cdp')));
        lastEmission = block.timestamp;
    }

    function renewContracts() public {
        coin = stableCoin(payable(dao.addresses('stableCoin')));
        cdp = CDP(payable(dao.addresses('cdp')));
    }

    function claimEmission() public{
        uint256 period = block.timestamp - lastEmission;
        require (period>=363 days, "too early to claim");
        uint256 amount = period/365 days*dao.params("annualInflationPercent")*coin.totalSupply()/100;
        lastEmission = block.timestamp;
        require (amount>0, "nothing to emit");
        cdp.claimEmission(amount,address(this));
        emit inflationEmission(amount);
    }

    function claimTransfer() public{
        coin.transfer(dao.addresses("inflationSpender"), coin.balanceOf(address(this)));
    }
}
