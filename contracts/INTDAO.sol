// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract INTDAO is ReentrancyGuard{
    IERC20 ruleToken;
    mapping (uint32 => mapping(address => uint256)) votes;

    mapping (uint32=>Voting) public votings;
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

    bool public activeVoting;

    mapping (string => uint256) public params;
    mapping (string => address) public addresses;
    mapping (address => bool) public paused;
    mapping (address => bool) public isAuthorized;

    mapping (address => uint256) public pooled;
    uint256 public totalPooled;

    event NewVoting (uint32 indexed id, string indexed name);
    event VotingSucceed (uint32 indexed id);
    event VotingFailed (uint32 indexed id);

    constructor (address[] memory _addresses) {
        params["interestRate"] = 9;
        params["depositRate"]=8;
        params["liquidationFee"] = 13;
        params["collateralDiscount"] = 30;
        params["stabilizationFundPercent"] = 5;
        params["quorum"] = 60;
        params["majority"] = 50;
        params["minCDPBalanceToInitBuyOut"] = 10**19;
        params["absoluteMajority"] = 80;
        params["minRuleTokensToInitVotingPercent"] = 1;
        params["votingDuration"] = 1 days;
        params["auctionTurnDuration"] = 15 minutes;
        params["minAuctionPriceMove"] = 5;
        params["minColleteral"] = 1*10^16; // minColleteral is 0.01 ETH
        params["marginCallTimeLimit"] = 1 days;
        params["annualInflationPercent"] = 1;
        params["defaultDepositPeriod"] = 91 days;
        params["maxCoinsForStabilization"] = 50*10**18;
        params["maxRuleEmissionPercent"] = 1;
        params["highVolatilityEventBarrierPercent"] = 5;
        params["minCoinsToMint"] = 1;

        addresses["weth"] = _addresses[0];
        addresses["cdp"] = _addresses[1];
        addresses["auction"] = _addresses[2];
        addresses["deposit"] = _addresses[3];
        addresses["oracle"] = _addresses[4];
        addresses["inflationFund"] = _addresses[5];
        addresses["rule"] = _addresses[6];
        addresses["stableCoin"] = _addresses[7];
        addresses["cart"] = _addresses[8];

        addresses["inflationSpender"] = _addresses[1];
        isAuthorized[_addresses[3]]=true;
        isAuthorized[_addresses[5]]=true;

        addresses["dao"] = address(this);
        renewContracts();
    }

    function renewContracts() public {
        ruleToken = IERC20(addresses["rule"]);
    }

    function addVoting(uint8 votingType, string memory name, uint value, address addr, bool decision) external{
        require(!activeVoting, "There is an active voting");
        require(votingType>0&&votingType<5, "Incorrect voteing type");
        require(isEnoughTokensPooledToInitVoting(msg.sender), "Too little tokens to init voting");
        votingID++;
        votings[votingID] = Voting(0, votingType, name, value, addr, block.timestamp, decision);
        activeVoting = true;
        emit NewVoting(votingID, name);
    }

    function poolTokens() nonReentrant external returns (bool success) {
        uint256 amount = ruleToken.allowance(msg.sender, address(this));
        require (amount>0, "allow tokens first");
        require(ruleToken.transferFrom(msg.sender, address(this), amount), "Could not pool tokens for some reason");
        pooled[msg.sender] += amount;
        totalPooled += amount;
        return true;
    }

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
