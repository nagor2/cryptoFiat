// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.19 <0.9.0;
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

    /// @notice DAO interface.
    IDAO immutable dao;

    /// @notice stablecoin interface.
    IERC20 coin;

    /// @notice CDP interface.
    ICDP cdp;

    /// @notice Counter for deposits.
    uint32 public depositsCounter;

    /// @notice Deposits storage
    mapping(uint32 => Deposit) public deposits;

    /// @notice This event emitted when the new deposit is opened
    /// @param id ID of the deposit
    /// @param amount How many stablecoins were deposited.
    /// @param rate Annual interest on this deposit.
    /// @param owner Deposit owner's address.
    event DepositOpened(uint32 indexed id, uint256 amount, uint256 rate, address indexed owner);

    /// @notice Constructor for Deposit contract.
    /// @param _INTDAOaddress - the address of main DAO contract.
    constructor(address _INTDAOaddress){
        dao = IDAO(_INTDAOaddress);
    }

    /// @notice This method is used to reinit needed interfaces when the addresses of contracts to use are changed by voting or to init interfaces just after deploy.
    function renewContracts() external {
        coin = IERC20(dao.addresses("stableCoin"));
        cdp = ICDP(dao.addresses("cdp"));
    }

    /// @notice This method is used to deposit stablecoins. Before the call you need to allow spending for this contract.
    /// As the result, the new DepositOpened event is emitted with the owner in parameters mentioned.
    function deposit() nonReentrant external{
        uint256 amount = coin.allowance(msg.sender, address(this));
        require (amount>0, "you have to approve coins first");
        coin.transferFrom(msg.sender, address(this), amount);
        Deposit storage d = deposits[++depositsCounter];
        d.owner = msg.sender;
        d.lastTimeUpdated = block.timestamp;
        d.timeOpened = block.timestamp;
        d.coinsDeposited = amount;
        d.currentInterestRate = dao.params("depositRate");
        d.period = block.timestamp + dao.params("defaultDepositPeriod");
        emit DepositOpened(depositsCounter, d.coinsDeposited, d.currentInterestRate, d.owner);
    }

    /// @notice This method is used to withdraw stablecoins from the deposit. Of course, only the owner of the deposit is able to withdraw.
    /// If there are no funds left on the deposit, it is considered closed.
    /// @param id - the ID of the deposit.
    /// @param amount - the amount of funds to withdraw.
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

    /// @notice This method is used to top up the deposit if it is not closed. Be aware, that you accidentally can top up someone else's deposit.
    /// Mind the id of the deposit and assure you are the owner of it. As with *deposit* function, you have to allow spending first.
    /// @param id - the ID of the deposit.
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

    /// @notice Overall interest of given deposit.
    /// @param id - the ID of the deposit.
    /// @return interest Overall accumulated interest.
    function overallInterest(uint32 id) public view returns (uint256 interest){
        Deposit storage d = deposits[id];
        return d.coinsDeposited*(block.timestamp - d.lastTimeUpdated)/1 days*d.currentInterestRate/36500 + d.accumulatedInterest;
    }

    /// @notice Write down the current overall interest to storage. Usually, there is no need for user to invoke this function unless he wants to change his interest rate to current, if it is changed.
    /// @param id - the ID of the deposit.
    /// @return accumulated Overall accumulated interest
    function updateInterest(uint32 id) public returns (uint256 accumulated){
        Deposit storage d = deposits[id];
        d.accumulatedInterest = overallInterest(id);
        d.lastTimeUpdated = block.timestamp;
        if (block.timestamp>d.period)
            d.currentInterestRate = dao.params("depositRate");
        return d.accumulatedInterest;
    }

    /// @notice Claim your earnings with keeping funds on the deposit. Owner's earnings will be transferred from the stabilization fund (CDP balance of stablecoins) if it is not empty.
    /// If CDP balance is not enough, the contract will transfer all available funds to the user and will give allowance to spend the rest of the sum.
    /// To top up the stabilization fund anyone can init the auction. See the initCoinsBuyOutForStabilization function in Auction contract for more information.
    /// @param id - the ID of the deposit.
    function claimInterest(uint32 id) nonReentrant external{
        updateInterest(id);
        cdp.claimInterest(overallInterest(id), deposits[id].owner);
        deposits[id].accumulatedInterest = 0;
    }
}
