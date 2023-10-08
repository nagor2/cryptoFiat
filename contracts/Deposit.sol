// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./IDAO.sol";
import "./ICDP.sol";

    struct Deposit {
        address owner;
        uint256 coinsDeposited;
        uint256 timeOpened;
        uint256 period;
        uint256 currentInterestRate;
        uint256 lastTimeUpdated;
        uint256 accumulatedInterest;
        bool closed;
    }

contract DepositContract is ReentrancyGuard{
    IDAO immutable dao;
    IERC20 coin;
    ICDP cdp;
    uint32 public counter;
    mapping(uint32 => Deposit) public deposits;
    event DepositOpened(uint32 indexed id, uint256 amount, uint256 rate, address indexed owner);

    constructor(address _INTDAOaddress){
        dao = IDAO(_INTDAOaddress);
    }

    function renewContracts() public {
        coin = IERC20(dao.addresses("stableCoin"));
        cdp = ICDP(dao.addresses("cdp"));
    }

    function deposit() nonReentrant external{
        uint256 amount = coin.allowance(msg.sender, address(this));
        require (amount>0, "you have to approve coins first");
        coin.transferFrom(msg.sender, address(this), amount);
        Deposit storage d = deposits[++counter];
        d.owner = msg.sender;
        d.lastTimeUpdated = block.timestamp;
        d.timeOpened = block.timestamp;
        d.coinsDeposited = amount;
        d.currentInterestRate = dao.params("depositRate");
        d.period = block.timestamp + dao.params("defaultDepositPeriod");
        emit DepositOpened(counter, d.coinsDeposited, d.currentInterestRate, d.owner);
    }

    function withdraw(uint32 id, uint256 amount) nonReentrant external{
        updateInterest(id);
        Deposit storage d = deposits[id];
        require(msg.sender == d.owner, "only owner may init withdrawal");
        require (!d.closed, "deposit is closed");
        require (amount<=d.coinsDeposited, "not enough coins on deposit");
        coin.transfer(d.owner, amount);
        d.coinsDeposited -= amount;
        if (d.coinsDeposited==0)
            d.closed = true;
        if (block.timestamp>d.period)
            d.currentInterestRate = dao.params("depositRate");
    }

    function topUp(uint32 id) nonReentrant external{
        updateInterest(id);
        Deposit storage d = deposits[id];
        require (!d.closed, "deposit is closed, open a new one, please");
        uint256 amount = coin.allowance(msg.sender, address(this));
        require (amount>0, "You should approve first");
        require (coin.transferFrom(msg.sender, address(this), amount), "Could not transfer coins for some reason");
        if (block.timestamp>d.period)
            d.currentInterestRate = dao.params("depositRate");
        d.coinsDeposited += amount;
    }

    function overallInterest(uint32 id) public view returns (uint256 interest){
        Deposit storage d = deposits[id];
        return d.coinsDeposited*(block.timestamp - d.lastTimeUpdated)/1 days*d.currentInterestRate/36500 + d.accumulatedInterest;
    }

    function updateInterest(uint32 id) public returns (uint256 accumulated){
        Deposit storage d = deposits[id];
        d.accumulatedInterest = overallInterest(id);
        d.lastTimeUpdated = block.timestamp;
        if (block.timestamp>d.period)
            d.currentInterestRate = dao.params("depositRate");
        return d.accumulatedInterest;
    }

    function claimInterest(uint32 id) nonReentrant external{
        updateInterest(id);
        cdp.claimInterest(overallInterest(id), deposits[id].owner);
        deposits[id].accumulatedInterest = 0;
    }
}
