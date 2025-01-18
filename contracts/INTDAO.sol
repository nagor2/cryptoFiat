// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.19 <0.9.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title Interest DAO
contract INTDAO is ReentrancyGuard{

    /// @notice Rule token interface
    IERC20 ruleToken;

    /// @notice Storage of votes
    mapping (uint32 => mapping(address => uint256)) votes;

    /// @notice Storage of votings
    mapping (uint32=>Voting) public votings;

    /// @notice Voting counter
    uint32 public votingID;

    struct Voting {
        uint256 totalPositive;
        uint8 votingType;
        string name;
        uint256 value;
        address addr;
        uint256 startTime;
        bool decision;
    }

    /// @notice Active voting presence flag, as there can be only one active voting.
    bool public activeVoting;

    /// @notice Storage for parameters
    mapping (string => uint256) public params;

    /// @notice Storage for addresses
    mapping (string => address) public addresses;

    /// @notice Storage for paused contracts
    mapping (address => bool) public paused;

    /// @notice Storage for authorized contracts
    mapping (address => bool) public isAuthorized;

    /// @notice Storage for pooled Rule tokens for each holder
    mapping (address => uint256) public pooled;

    /// @notice Total pooled tokens
    uint256 public totalPooled;

    /// @notice Event emitted when new voting is created
    /// @param id ID of the voting
    /// @param name Name of the parameter or address
    /// @param indexedName The same as name, introduced for dapp usage
    event NewVoting (uint32 indexed id, string name, string indexed indexedName);

    /// @notice Event emitted when voting succeeds
    /// @param id ID of the voting
    event VotingSucceed (uint32 indexed id);

    /// @notice Event emitted when voting finishes but fails
    /// @param id ID of the voting
    event VotingFailed (uint32 indexed id);

    /// @notice Constructor of the Interest DAO contract, where all the parameters of the system are initialized
    /// @param _addresses Initial addresses of each contract in the DAO
    constructor (address[] memory _addresses) {
        params["interestRate"] = 9;
        params["depositRate"]=8;
        params["liquidationFee"] = 13;
        params["collateralDiscount"] = 30;
        params["stabilizationFundPercent"] = 5;
        params["quorum"] = 75;
        params["majority"] = 50;
        params["minCDPBalanceToInitBuyOut"] = 10**19;
        params["absoluteMajority"] = 80;
        params["minRuleTokensToInitVotingPercent"] = 1;
        params["votingDuration"] = 1 days;
        params["auctionTurnDuration"] = 15 minutes;
        params["minAuctionPriceMove"] = 5;
        params["marginCallTimeLimit"] = 1 days;
        params["defaultDepositPeriod"] = 91 days;
        params["maxCoinsForStabilization"] = 50*10**18;
        params["maxRuleEmissionPercent"] = 1;
        params["highVolatilityEventBarrierPercent"] = 5;
        params["minCoinsToMint"] = 1;

        addresses["cdp"] = _addresses[0];
        addresses["auction"] = _addresses[1];
        addresses["deposit"] = _addresses[2];
        addresses["oracle"] = _addresses[3];
        addresses["rule"] = _addresses[4];
        addresses["stableCoin"] = _addresses[5];
        addresses["basket"] = _addresses[6];

        isAuthorized[_addresses[0]]=true;
        isAuthorized[_addresses[2]]=true;

        addresses["dao"] = address(this);
        renewContracts();
    }

    /// @notice This method is used to change the Rule token address if it was changed during voting for some reason
    function renewContracts() public {
        ruleToken = IERC20(addresses["rule"]);
    }

    /// @notice Method to initiate a new voting
    /// @param votingType Type of the voting
    /// @param name Name of the parameter or address
    /// @param value Value of the parameter (for type 1 voting)
    /// @param addr Address value (for type 2 voting)
    /// @param decision True/False for type 3 and 4 voting
    function addVoting(uint8 votingType, string memory name, uint value, address addr, bool decision) external{
        require(!activeVoting, "There is an active voting");
        require(votingType>0&&votingType<5, "Incorrect voteing type");
        require(isEnoughTokensPooledToInitVoting(msg.sender), "Too little tokens to init voting");
        votingID++;
        votings[votingID] = Voting(0, votingType, name, value, addr, block.timestamp, decision);
        activeVoting = true;
        emit NewVoting(votingID, name, name);
    }

    /// @notice Pool tokens on the contract to participate in voting
    /// @return success True if successful
    function poolTokens() nonReentrant external returns (bool success) {
        uint256 amount = ruleToken.allowance(msg.sender, address(this));
        require (amount>0, "allow tokens first");
        require(ruleToken.transferFrom(msg.sender, address(this), amount), "Could not pool tokens for some reason");
        pooled[msg.sender] += amount;
        totalPooled += amount;
        return true;
    }

    /// @notice Return tokens from the contract after voting is finished
    /// @return True if successful
    function returnTokens() nonReentrant external returns (bool) {
        require(pooled[msg.sender] > 0, "You must have pooled tokens");
        if (activeVoting && votes[votingID][msg.sender]>0){
            votings[votingID].totalPositive -= votes[votingID][msg.sender];
        }
        ruleToken.transfer(msg.sender, pooled[msg.sender]);
        totalPooled -= pooled[msg.sender];
        pooled[msg.sender] = 0;
        return true;
    }

    /// @notice Vote on the current voting
    /// @param _vote True/False for For/Against the proposal
    function vote(bool _vote) nonReentrant external{
        require(activeVoting, "No active voting found");
        require(votings[votingID].startTime + params["votingDuration"] >= block.timestamp, "Voting is already inactive");
        require(pooled[msg.sender]>0, "You dont have pooled tokens to vote");

        if (_vote) {
            uint256 _votesToAdd = pooled[msg.sender] - votes[votingID][msg.sender];
            votes[votingID][msg.sender] = pooled[msg.sender];
            votings[votingID].totalPositive += _votesToAdd;
        }
        else {
            if (votes[votingID][msg.sender] > 0){
                votings[votingID].totalPositive -= votes[votingID][msg.sender];
                votes[votingID][msg.sender] = 0;
            }
        }
    }

    /// @notice Claim to finish voting
    function claimToFinalizeCurrentVoting() nonReentrant external{
        require (activeVoting, "There is no active voting");
        if (votings[votingID].totalPositive >= ruleToken.totalSupply() * params["absoluteMajority"] / 100) {
            finalizeCurrentVoting();
            return;
        }
        else if (votings[votingID].startTime + params["votingDuration"] <= block.timestamp) {
            if (totalPooled >= params["quorum"] * ruleToken.totalSupply() / 100 && votings[votingID].totalPositive > (totalPooled - votings[votingID].totalPositive)) {
                finalizeCurrentVoting();
                return;
            }
            activeVoting = false;
            emit VotingFailed(votingID);
            return;
        }
    }

    function finalizeCurrentVoting() internal{
        if (votings[votingID].votingType == 1)
            params[votings[votingID].name] = votings[votingID].value;
        if (votings[votingID].votingType == 2)
            addresses[votings[votingID].name] = votings[votingID].addr;
        if (votings[votingID].votingType == 3)
            paused[votings[votingID].addr] = votings[votingID].decision;
        if (votings[votingID].votingType == 4)
            isAuthorized[votings[votingID].addr] = votings[votingID].decision;
        activeVoting = false;
        emit VotingSucceed(votingID);
    }

    function isEnoughTokensPooledToInitVoting(address initiator) internal view returns (bool enough){
        return pooled[initiator]>=ruleToken.totalSupply()*params["minRuleTokensToInitVotingPercent"]/100;
    }
}
