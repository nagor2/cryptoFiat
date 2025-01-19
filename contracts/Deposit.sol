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

/// @title Deposit contract
contract DepositContract is ReentrancyGuard{
    /// @notice contract address
    address public immutable address_this;

    /// @notice DAO interface.
    IDAO immutable dao;

    /// @notice flatcoin interface.
    IERC20 coin;

    /// @notice CDP interface.
    ICDP cdp;

    /// @notice Counter for deposits.
    uint32 public depositsCounter;

    /// @notice Mapping storing all deposits.
    mapping(uint32 => Deposit) public deposits;

    /// @notice Emitted when a new deposit is opened.
    /// @param id ID of the deposit.
    /// @param amount Amount of flatcoins deposited.
    /// @param rate Annual interest rate on the deposit.
    /// @param owner Address of the deposit owner.
    event DepositOpened(uint32 indexed id, uint256 amount, uint256 rate, address indexed owner);

    /// @notice Constructor for the Deposit contract.
    /// @param _INTDAOaddress Address of the main DAO contract.
    constructor(address _INTDAOaddress) payable{
        dao = IDAO(_INTDAOaddress);
        address_this = address(this);
    }

    /// @notice Reinitialize the needed interfaces when the addresses of contracts are changed by voting or initialize interfaces just after deployment.
    function renewContracts() external {
        coin = IERC20(dao.addresses("flatCoin"));
        cdp = ICDP(dao.addresses("cdp"));
    }

    /// @notice Deposits flatcoins into the contract. Ensure that spending is allowed for this contract address before calling this function. A DepositOpened event is emitted with the owner and other relevant parameters.
    function deposit() nonReentrant external{
        uint256 amount = coin.allowance(msg.sender, address_this);
        require (amount>0, "you have to approve coins first");
        require(coin.transferFrom(msg.sender, address_this, amount),"failed to transfer");
        Deposit storage d = deposits[++depositsCounter];
        d.owner = msg.sender;
        d.lastTimeUpdated = block.timestamp;
        d.timeOpened = block.timestamp;
        d.coinsDeposited = amount;
        d.currentInterestRate = dao.params("depositRate");
        d.period = block.timestamp + dao.params("defaultDepositPeriod");
        emit DepositOpened(depositsCounter, d.coinsDeposited, d.currentInterestRate, d.owner);
    }

    /// @notice Withdraws flatcoins from the deposit. Only the owner of the deposit can withdraw funds. If the deposit balance reaches zero, it is considered closed.
    /// @param id The ID of the deposit.
    /// @param amount The amount of funds to withdraw.
    function withdraw(uint32 id, uint256 amount) nonReentrant external{
        updateInterest(id);
        Deposit storage d = deposits[id];
        require(msg.sender == d.owner, "only owner may init withdrawal");
        require (!d.closed, "deposit is closed");
        require (amount<=d.coinsDeposited, "not enough coins on deposit");
        require (coin.transfer(d.owner, amount),"could not transfer");
        d.coinsDeposited -= amount;
        if (d.coinsDeposited==0){
            getInterest(id);
            d.closed = true;
        }
    }

    /// @notice  Tops up an existing deposit if it is not closed. Ensure that you are the owner of the deposit and that you have allowed spending for the contract. You may accidentally top up someone else's deposit, so verify the deposit ID carefully.
    /// @param id The ID of the deposit.
    function topUp(uint32 id) nonReentrant external{
        updateInterest(id);
        Deposit storage d = deposits[id];
        require (!d.closed, "deposit is closed");
        uint256 amount = coin.allowance(msg.sender, address_this);
        require (amount>0, "You should approve first");
        require (coin.transferFrom(msg.sender, address_this, amount), "transfer failed");
        d.coinsDeposited += amount;
    }

    /// @notice Returns the overall accumulated interest for a given deposit.
    /// @param id The ID of the deposit.
    /// @return interest Overall accumulated interest.
    function overallInterest(uint32 id) public view returns (uint256 interest){
        Deposit storage d = deposits[id];
        return d.coinsDeposited*(block.timestamp - d.lastTimeUpdated)/1 days*d.currentInterestRate/36500 + d.accumulatedInterest;
    }

    /// @notice Updates the stored interest to reflect the current rate. Users generally do not need to invoke this unless they want to update their interest rate to the current one if it has changed.
    /// @param id The ID of the deposit.
    /// @return accumulated Overall accumulated interest.
    function updateInterest(uint32 id) public returns (uint256 accumulated){
        Deposit storage d = deposits[id];
        d.accumulatedInterest = overallInterest(id);
        d.lastTimeUpdated = block.timestamp;
        if (block.timestamp>=d.period)
            d.currentInterestRate = dao.params("depositRate");
        return d.accumulatedInterest;
    }

    /// @notice Claims the accumulated interest while keeping the principal funds in the deposit. The owner's earnings will be transferred from the stabilization fund (CDP balance of flatcoins) if available. If the CDP balance is insufficient, the contract will transfer all available funds to the user and provide an allowance to spend the remaining amount. To top up the stabilization fund, one can initiate an auction using the initCoinsBuyOutForStabilization function in the Auction contract.
    /// @param id The ID of the deposit.
    function claimInterest(uint32 id) nonReentrant external{
        updateInterest(id);
        getInterest(id);
    }

    function getInterest(uint32 id) internal{
        cdp.claimInterest(overallInterest(id), deposits[id].owner);
        deposits[id].accumulatedInterest = 0;
    }
}
