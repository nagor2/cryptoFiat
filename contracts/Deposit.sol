// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICDP{
    function claimInterest(uint256 amount, address beneficiary) external;
}

interface IDAO{
    function addresses(string memory) external view returns (address);
    function params(string memory) external view returns (uint256);
    function setAddressOnce(string memory, address) external;
}

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

contract DepositContract {
    IDAO dao;
    IERC20 coin;
    ICDP cdp;
    uint256 public counter;
    mapping(uint256 => Deposit) public deposits;
    event DepositOpened(uint256 id, uint256 amount, uint256 rate, address owner);

    constructor(address payable INTDAOaddress){
        dao = IDAO(INTDAOaddress);
        dao.setAddressOnce('deposit',payable(address(this)));
        coin = IERC20(dao.addresses('stableCoin'));
        cdp = ICDP(dao.addresses('cdp'));
    }

    function renewContracts() public {
        coin = IERC20(payable(dao.addresses('stableCoin')));
        cdp = ICDP(payable(dao.addresses('cdp')));
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
        emit DepositOpened(counter, d.coinsDeposited, d.currentInterestRate, d.owner);
    }

    function withdraw(uint256 id, uint256 amount) public{
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

    function topUp(uint256 id) public{
        updateInterest(id);
        Deposit storage d = deposits[id];
        require (!d.closed, "deposit is closed, open a new one, please");
        uint256 amount = coin.allowance(msg.sender, address(this));
        require (amount>0, "You should approve first");
        coin.transferFrom(msg.sender, address(this), amount);
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
        updateInterest(id);
        cdp.claimInterest(overallInterest(id), deposits[id].owner);
        deposits[id].accumulatedInterest = 0;
    }
}
