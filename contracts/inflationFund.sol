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

    constructor(address INTDAOaddress){
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
        uint256 amount = (block.timestamp - lastEmission)/365 days*dao.params("annualInflationPercent")*coin.totalSupply()/100;
        require (amount>0, "nothing to emit");
        cdp.claimEmission(amount,address(this));
        lastEmission = block.timestamp;
        emit inflationEmission(amount);
    }

    function claimTransfer(uint256 amount) public{
        coin.transfer(dao.addresses("inflationSpender"), amount);
    }
}
