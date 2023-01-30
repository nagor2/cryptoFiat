pragma solidity >=0.4.22 <0.9.0;
import "./INTDAO.sol";
import "./stableCoin.sol";
import "./CDP.sol";

    struct Deposit {
        address owner;
        uint256 coinsDeposited;
        uint256 timeOpened;
        uint256 period;
        uint256 currentInterestRate;
        uint256 lastTimeUpdated;
        uint256 accumulatedInterest;
    }

contract DepositContract {

    INTDAO dao;
    stableCoin coin;
    CDP cdp;
    uint256 public counter;
    mapping(uint256 => Deposit) public deposits;
    event DepositOpened(uint256 id, uint256 amount, uint256 rate);

    constructor(address INTDAOaddress){
        dao = INTDAO(INTDAOaddress);
        dao.setAddressOnce('deposit',payable(address(this)));
        coin = stableCoin(payable(dao.addresses('stableCoin')));
        cdp = CDP(payable(dao.addresses('cdp')));
    }

    function renewContracts() public {
        coin = stableCoin(payable(dao.addresses('stableCoin')));
        cdp = CDP(payable(dao.addresses('cdp')));
    }

    function deposit() public{
        uint256 amount = coin.allowance(msg.sender, address(this));
        require (amount>0, "you have to approve coins first");
        require (coin.transferFrom(msg.sender, address(this), amount), "Could not transfer coins for some reason");
        Deposit storage d = deposits[++counter];
        d.owner = msg.sender;
        d.lastTimeUpdated = block.timestamp;
        d.timeOpened = block.timestamp;
        d.coinsDeposited = amount;
        d.currentInterestRate = dao.params("depositRate");
        d.period = block.timestamp + dao.params("defaultDepositPeriod");
        emit DepositOpened(counter, amount, d.currentInterestRate);
    }

    function withdraw(uint256 id, uint256 amount) public{
        claimInterest(id);
        Deposit storage d = deposits[id];
        require(msg.sender == d.owner, "only owner may init withdrawal");
        require (amount<=d.coinsDeposited, "not enough coins on deposit");
        require(coin.transfer(d.owner, amount), "Could not transfer coins for some reason");
        d.coinsDeposited -= amount;
        if (block.timestamp>d.period)
            d.currentInterestRate = dao.params("depositRate");
    }

    function topUp(uint256 id) public{
        claimInterest(id);
        Deposit storage d = deposits[id];
        uint256 amount = coin.allowance(msg.sender, address(this));
        require (amount>0, "You should approve first");
        require(coin.transferFrom(msg.sender, address(this), amount), "Could not transfer coins for some reason");
        if (block.timestamp>d.period)
            d.currentInterestRate = dao.params("depositRate");
        d.coinsDeposited += amount;
    }

    function overallInterest(uint256 id) public view returns (uint256 interest){
        Deposit storage d = deposits[id];
        return d.coinsDeposited*(block.timestamp - d.lastTimeUpdated)/1 days*d.currentInterestRate/36500 + d.accumulatedInterest;
    }

    function updateInterest(uint256 id) public returns (uint256 accumulated){
        Deposit storage d = deposits[id];
        d.accumulatedInterest = overallInterest(id);
        d.lastTimeUpdated = block.timestamp;
        if (block.timestamp>d.period)
            d.currentInterestRate = dao.params("depositRate");
        return d.accumulatedInterest;
    }

    function claimInterest(uint256 id) public {
        uint256 interest = updateInterest(id);
        Deposit storage d = deposits[id];
        cdp.claimInterest(overallInterest(id), d.owner);
        d.accumulatedInterest = 0;
    }
}
