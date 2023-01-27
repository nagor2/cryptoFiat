pragma solidity >=0.4.22 <0.9.0;
import "./INTDAO.sol";
import "./stableCoin.sol";
import "./CDP.sol";

    struct Deposit {
        address owner;
        uint256 coinsDeposited;
        uint256 timeOpened;
        uint256 period;
        uint256 currentInterest;
        uint256 lastTimeUpdated;
    }

contract DepositContract {
    INTDAO dao;
    stableCoin coin;
    CDP cdp;

    constructor(address INTDAOaddress){
        dao = INTDAO(INTDAOaddress);
        dao.setAddressOnce('deposit',payable(address(this)));
        coin = stableCoin(payable(dao.addresses('stableCoin')));
        cdp = CDP(payable(dao.addresses('cdp')));
    }
}
